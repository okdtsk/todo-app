package handler

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/okdtsk/todo-app/todo-server/ai"
	"github.com/okdtsk/todo-app/todo-server/crypto"
	"github.com/okdtsk/todo-app/todo-server/db"
	"github.com/okdtsk/todo-app/todo-server/model"
)

// AIHandler handles HTTP requests for AI endpoints.
type AIHandler struct {
	store    *db.Store
	provider *ai.GeminiProvider
	encKey   []byte
}

// NewAIHandler creates a new AIHandler.
func NewAIHandler(store *db.Store, provider *ai.GeminiProvider, encKey []byte) *AIHandler {
	return &AIHandler{store: store, provider: provider, encKey: encKey}
}

// getProvider returns an AI provider, checking DB settings first then falling back to env-var provider.
func (h *AIHandler) getProvider() *ai.GeminiProvider {
	stored, _ := h.store.GetSetting("ai_api_key")
	if stored != "" {
		key, err := crypto.Decrypt(stored, h.encKey)
		if err != nil {
			// Legacy plaintext fallback
			key = stored
		}
		model, _ := h.store.GetSetting("ai_model")
		return ai.NewGeminiProvider(key, model)
	}
	return h.provider
}

// Analyze handles POST /api/v1/ai/analyze.
// Accepts a message with optional URL or image, sends to Gemini for analysis,
// executes the returned todo actions, and returns results.
func (h *AIHandler) Analyze(w http.ResponseWriter, r *http.Request) {
	provider := h.getProvider()
	if provider == nil {
		writeError(w, http.StatusServiceUnavailable, "AI provider not configured. Set GEMINI_API_KEY or configure in Settings.")
		return
	}

	var req model.AIAnalyzeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	// Build context: current todos and projects
	todos, err := h.store.ListTodos(nil, nil, nil, nil, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load todos")
		return
	}
	projects, err := h.store.ListProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load projects")
		return
	}

	// Fetch URL content if provided
	var urlContent string
	if req.URL != "" {
		urlContent, err = fetchURLContent(req.URL)
		if err != nil {
			log.Printf("failed to fetch URL %s: %v", req.URL, err)
			urlContent = fmt.Sprintf("[Failed to fetch URL: %v]", err)
		}
	}

	// Build prompt
	prompt := buildAnalyzePrompt(req.Message, urlContent, todos, projects)

	// Decode image if present
	var imageData []byte
	imageMIME := req.ImageType
	if req.Image != "" {
		imageData, err = base64.StdEncoding.DecodeString(req.Image)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid base64 image data")
			return
		}
		if imageMIME == "" {
			imageMIME = "image/png"
		}
	}

	// Call Gemini
	ctx := r.Context()
	var result string
	if len(imageData) > 0 {
		result, err = provider.CompleteMultimodal(ctx, prompt, imageData, imageMIME)
	} else {
		result, err = provider.Complete(ctx, prompt)
	}
	if err != nil {
		log.Printf("AI analyze error: %v", err)
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("AI processing failed: %v", err))
		return
	}

	// Parse AI response
	actions, summary, err := parseAIResponse(result)
	if err != nil {
		log.Printf("AI response parse error: %v\nRaw: %s", err, result)
		writeError(w, http.StatusInternalServerError, "failed to parse AI response")
		return
	}

	// Execute actions
	var affectedTodos []model.Todo
	var affectedProjects []model.Project
	for _, action := range actions {
		switch action.Type {
		case "create":
			todo, err := h.executeCreate(action)
			if err != nil {
				log.Printf("AI create error: %v", err)
				continue
			}
			affectedTodos = append(affectedTodos, todo)

		case "update":
			todo, err := h.executeUpdate(action)
			if err != nil {
				log.Printf("AI update error: %v", err)
				continue
			}
			affectedTodos = append(affectedTodos, todo)

		case "complete":
			done := true
			todo, err := h.store.UpdateTodo(action.TodoID, model.UpdateTodoRequest{Done: &done})
			if err != nil {
				log.Printf("AI complete error: %v", err)
				continue
			}
			affectedTodos = append(affectedTodos, todo)

		case "delete":
			if err := h.store.DeleteTodo(action.TodoID); err != nil {
				log.Printf("AI delete error: %v", err)
			}

		case "create_project":
			project, err := h.store.CreateProject(model.CreateProjectRequest{
				Name:  action.ProjectName,
				Color: action.ProjectColor,
			})
			if err != nil {
				log.Printf("AI create_project error: %v", err)
				continue
			}
			affectedProjects = append(affectedProjects, project)

		case "update_project":
			if action.ProjectID == nil {
				log.Printf("AI update_project error: project_id is required")
				continue
			}
			req := model.UpdateProjectRequest{}
			if action.ProjectName != "" {
				req.Name = &action.ProjectName
			}
			if action.ProjectColor != "" {
				req.Color = &action.ProjectColor
			}
			project, err := h.store.UpdateProject(*action.ProjectID, req)
			if err != nil {
				log.Printf("AI update_project error: %v", err)
				continue
			}
			affectedProjects = append(affectedProjects, project)

		case "delete_project":
			if action.ProjectID == nil {
				log.Printf("AI delete_project error: project_id is required")
				continue
			}
			if err := h.store.DeleteProject(*action.ProjectID); err != nil {
				log.Printf("AI delete_project error: %v", err)
			}
		}
	}

	resp := model.AIAnalyzeResponse{
		Summary:  summary,
		Actions:  actions,
		Todos:    affectedTodos,
		Projects: affectedProjects,
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *AIHandler) executeCreate(action model.AIAction) (model.Todo, error) {
	priority := model.Priority(action.Priority)
	if !model.ValidPriority(priority) {
		priority = model.PriorityNone
	}

	req := model.CreateTodoRequest{
		TaskName:    action.TaskName,
		Description: action.Description,
		Priority:    priority,
		Labels:      action.Labels,
		ProjectID:   action.ProjectID,
	}

	if action.Date != "" {
		req.Date = &action.Date
	}
	if action.Deadline != "" {
		req.Deadline = &action.Deadline
	}

	return h.store.CreateTodo(req)
}

func (h *AIHandler) executeUpdate(action model.AIAction) (model.Todo, error) {
	req := model.UpdateTodoRequest{}

	if action.TaskName != "" {
		req.TaskName = &action.TaskName
	}
	if action.Description != "" {
		req.Description = &action.Description
	}
	if action.Priority != "" {
		req.Priority = &action.Priority
	}
	if action.Date != "" {
		req.Date = &action.Date
	}
	if action.Deadline != "" {
		req.Deadline = &action.Deadline
	}
	if action.Labels != nil {
		req.Labels = action.Labels
	}
	if action.ProjectID != nil {
		req.ProjectID = action.ProjectID
	}

	return h.store.UpdateTodo(action.TodoID, req)
}

// Command handles POST /api/v1/ai/command (stub).
func (h *AIHandler) Command(w http.ResponseWriter, r *http.Request) {
	var req model.AICommandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	resp := model.AICommandResponse{
		Message: "AI command processing is not yet implemented",
	}
	writeJSON(w, http.StatusOK, resp)
}

// DailySummary handles POST /api/v1/ai/daily-summary (stub).
func (h *AIHandler) DailySummary(w http.ResponseWriter, r *http.Request) {
	resp := model.AICommandResponse{
		Message: "AI daily summary is not yet implemented",
	}
	writeJSON(w, http.StatusOK, resp)
}

func buildAnalyzePrompt(message, urlContent string, todos []model.Todo, projects []model.Project) string {
	todosJSON, _ := json.Marshal(todos)
	projectsJSON, _ := json.Marshal(projects)
	today := time.Now().Format("2006-01-02")

	var sb strings.Builder
	sb.WriteString(`You are a task management AI assistant. Analyze the user's input and generate todo actions.

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no code fences, no explanation outside JSON.

Today's date: `)
	sb.WriteString(today)
	sb.WriteString(`

Current projects:
`)
	sb.Write(projectsJSON)
	sb.WriteString(`

Current todos (active and completed):
`)
	sb.Write(todosJSON)
	sb.WriteString(`

User message: `)
	sb.WriteString(message)

	if urlContent != "" {
		sb.WriteString(`

URL content:
`)
		// Truncate very long content
		if len(urlContent) > 30000 {
			urlContent = urlContent[:30000] + "\n... [truncated]"
		}
		sb.WriteString(urlContent)
	}

	sb.WriteString(`

Respond with this exact JSON structure:
{
  "summary": "Brief description of what actions were taken",
  "actions": [
    {
      "type": "create",
      "task_name": "Task title",
      "description": "Optional description",
      "priority": "none|low|medium|high",
      "date": "2025-01-01T00:00:00Z",
      "deadline": "2025-01-31T00:00:00Z",
      "labels": ["label1"],
      "project_id": 1
    },
    {
      "type": "update",
      "todo_id": 123,
      "task_name": "Updated title"
    },
    {
      "type": "complete",
      "todo_id": 123
    },
    {
      "type": "delete",
      "todo_id": 123
    },
    {
      "type": "create_project",
      "project_name": "Project Name",
      "project_color": "#007AFF"
    },
    {
      "type": "update_project",
      "project_id": 1,
      "project_name": "New Name",
      "project_color": "#34C759"
    },
    {
      "type": "delete_project",
      "project_id": 1
    }
  ]
}

Rules:
- Only include fields that are relevant for each action
- For "create": task_name is required. Use appropriate priority. Set date/deadline only if clearly implied.
- For "update"/"complete"/"delete": todo_id must reference an existing todo ID from the current todos list.
- For "create_project": project_name is required. project_color is optional (hex color like "#007AFF").
- For "update_project": project_id is required. Include only the fields to change.
- For "delete_project": project_id must reference an existing project ID.
- project_id for todos must reference an existing project ID, or omit it. If creating todos for a new project, use "create_project" first.
- Dates must be in ISO 8601 format (e.g. "2025-01-01T00:00:00Z").
- If the user's input is in a language other than English, keep task/project names in that same language.
- Be practical: create actionable, specific tasks rather than vague ones.
- If analyzing a URL or image, extract concrete action items from the content.
- When creating a project and todos together, put create_project actions BEFORE create todo actions that reference them.
`)

	return sb.String()
}

func fetchURLContent(url string) (string, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("URL returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 100*1024))
	if err != nil {
		return "", fmt.Errorf("read URL body: %w", err)
	}

	return string(body), nil
}

func parseAIResponse(raw string) ([]model.AIAction, string, error) {
	// Strip markdown code fences if present
	raw = strings.TrimSpace(raw)
	if strings.HasPrefix(raw, "```") {
		lines := strings.Split(raw, "\n")
		// Remove first and last lines (code fences)
		if len(lines) >= 2 {
			lines = lines[1:]
		}
		if len(lines) >= 1 && strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), "```") {
			lines = lines[:len(lines)-1]
		}
		raw = strings.Join(lines, "\n")
	}

	var parsed struct {
		Summary string           `json:"summary"`
		Actions []model.AIAction `json:"actions"`
	}

	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		return nil, "", fmt.Errorf("parse AI JSON: %w\nraw: %s", err, raw)
	}

	if parsed.Actions == nil {
		parsed.Actions = []model.AIAction{}
	}

	return parsed.Actions, parsed.Summary, nil
}
