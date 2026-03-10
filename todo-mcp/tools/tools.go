package tools

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

// Register adds all todo MCP tools to the server.
func Register(s *server.MCPServer, serverURL string) {
	registerListTodos(s, serverURL)
	registerCreateTodo(s, serverURL)
	registerUpdateTodo(s, serverURL)
	registerCompleteTodo(s, serverURL)
	registerDeleteTodo(s, serverURL)
	registerListProjects(s, serverURL)
	registerCreateProject(s, serverURL)
	registerUpdateProject(s, serverURL)
	registerDeleteProject(s, serverURL)
	registerDailySummary(s, serverURL)
}

// --- list_todos ---

func registerListTodos(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("list_todos",
		mcp.WithDescription("Get todos with optional filters"),
		mcp.WithNumber("project_id",
			mcp.Description("Filter by project ID"),
		),
		mcp.WithString("label",
			mcp.Description("Filter by label"),
		),
		mcp.WithString("priority",
			mcp.Description("Filter by priority"),
			mcp.Enum("none", "low", "medium", "high"),
		),
		mcp.WithBoolean("done",
			mcp.Description("Filter by completion status"),
		),
		mcp.WithString("date",
			mcp.Description("Filter by scheduled date (ISO 8601, e.g. 2025-01-31)"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		params := url.Values{}

		if v, ok := req.GetArguments()["project_id"]; ok {
			if n, ok := v.(float64); ok {
				params.Set("project_id", fmt.Sprintf("%d", int(n)))
			}
		}
		if v, ok := req.GetArguments()["label"]; ok {
			if s, ok := v.(string); ok && s != "" {
				params.Set("label", s)
			}
		}
		if v, ok := req.GetArguments()["priority"]; ok {
			if s, ok := v.(string); ok && s != "" {
				params.Set("priority", s)
			}
		}
		if v, ok := req.GetArguments()["done"]; ok {
			if b, ok := v.(bool); ok {
				params.Set("done", fmt.Sprintf("%t", b))
			}
		}
		if v, ok := req.GetArguments()["date"]; ok {
			if s, ok := v.(string); ok && s != "" {
				params.Set("date", s)
			}
		}

		u := fmt.Sprintf("%s/api/v1/todos", serverURL)
		if encoded := params.Encode(); encoded != "" {
			u += "?" + encoded
		}

		body, err := doGet(ctx, u)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to list todos: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- create_todo ---

func registerCreateTodo(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("create_todo",
		mcp.WithDescription("Create a new todo"),
		mcp.WithString("task_name",
			mcp.Required(),
			mcp.Description("Name of the task"),
		),
		mcp.WithString("description",
			mcp.Description("Detailed description of the task"),
		),
		mcp.WithString("priority",
			mcp.Description("Task priority"),
			mcp.Enum("none", "low", "medium", "high"),
		),
		mcp.WithString("date",
			mcp.Description("Scheduled date (ISO 8601, e.g. 2025-01-31)"),
		),
		mcp.WithString("deadline",
			mcp.Description("Deadline date (ISO 8601, e.g. 2025-01-31)"),
		),
		mcp.WithString("reminder_at",
			mcp.Description("Reminder datetime (ISO 8601, e.g. 2025-01-31T09:00:00Z)"),
		),
		mcp.WithNumber("project_id",
			mcp.Description("Project ID to assign the todo to"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		payload := make(map[string]interface{})

		taskName, ok := req.GetArguments()["task_name"]
		if !ok {
			return mcp.NewToolResultError("task_name is required"), nil
		}
		payload["task_name"] = taskName

		for _, key := range []string{"description", "priority", "date", "deadline", "reminder_at"} {
			if v, ok := req.GetArguments()[key]; ok {
				if s, ok := v.(string); ok && s != "" {
					payload[key] = s
				}
			}
		}
		if v, ok := req.GetArguments()["project_id"]; ok {
			if n, ok := v.(float64); ok {
				payload["project_id"] = int(n)
			}
		}

		body, err := doPost(ctx, fmt.Sprintf("%s/api/v1/todos", serverURL), payload)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to create todo: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- update_todo ---

func registerUpdateTodo(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("update_todo",
		mcp.WithDescription("Update fields of an existing todo"),
		mcp.WithNumber("id",
			mcp.Required(),
			mcp.Description("ID of the todo to update"),
		),
		mcp.WithString("task_name",
			mcp.Description("New task name"),
		),
		mcp.WithString("description",
			mcp.Description("New description"),
		),
		mcp.WithString("priority",
			mcp.Description("New priority"),
			mcp.Enum("none", "low", "medium", "high"),
		),
		mcp.WithString("date",
			mcp.Description("New scheduled date (ISO 8601)"),
		),
		mcp.WithString("deadline",
			mcp.Description("New deadline (ISO 8601)"),
		),
		mcp.WithString("reminder_at",
			mcp.Description("New reminder datetime (ISO 8601)"),
		),
		mcp.WithBoolean("done",
			mcp.Description("Completion status"),
		),
		mcp.WithNumber("project_id",
			mcp.Description("New project ID"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		idVal, ok := req.GetArguments()["id"]
		if !ok {
			return mcp.NewToolResultError("id is required"), nil
		}
		id := int(idVal.(float64))

		payload := make(map[string]interface{})
		for _, key := range []string{"task_name", "description", "priority", "date", "deadline", "reminder_at"} {
			if v, ok := req.GetArguments()[key]; ok {
				if s, ok := v.(string); ok && s != "" {
					payload[key] = s
				}
			}
		}
		if v, ok := req.GetArguments()["done"]; ok {
			if b, ok := v.(bool); ok {
				payload["done"] = b
			}
		}
		if v, ok := req.GetArguments()["project_id"]; ok {
			if n, ok := v.(float64); ok {
				payload["project_id"] = int(n)
			}
		}

		body, err := doPut(ctx, fmt.Sprintf("%s/api/v1/todos/%d", serverURL, id), payload)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to update todo: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- complete_todo ---

func registerCompleteTodo(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("complete_todo",
		mcp.WithDescription("Mark a todo as done"),
		mcp.WithNumber("id",
			mcp.Required(),
			mcp.Description("ID of the todo to complete"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		idVal, ok := req.GetArguments()["id"]
		if !ok {
			return mcp.NewToolResultError("id is required"), nil
		}
		id := int(idVal.(float64))

		payload := map[string]interface{}{"done": true}
		body, err := doPut(ctx, fmt.Sprintf("%s/api/v1/todos/%d", serverURL, id), payload)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to complete todo: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- delete_todo ---

func registerDeleteTodo(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("delete_todo",
		mcp.WithDescription("Delete a todo"),
		mcp.WithNumber("id",
			mcp.Required(),
			mcp.Description("ID of the todo to delete"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		idVal, ok := req.GetArguments()["id"]
		if !ok {
			return mcp.NewToolResultError("id is required"), nil
		}
		id := int(idVal.(float64))

		err := doDelete(ctx, fmt.Sprintf("%s/api/v1/todos/%d", serverURL, id))
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to delete todo: %v", err)), nil
		}
		return mcp.NewToolResultText(fmt.Sprintf("Todo %d deleted successfully", id)), nil
	})
}

// --- list_projects ---

func registerListProjects(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("list_projects",
		mcp.WithDescription("Get all projects"),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		body, err := doGet(ctx, fmt.Sprintf("%s/api/v1/projects", serverURL))
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to list projects: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- create_project ---

func registerCreateProject(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("create_project",
		mcp.WithDescription("Create a new project"),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("Name of the project"),
		),
		mcp.WithString("color",
			mcp.Description("Project color (hex, e.g. #007AFF)"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		payload := make(map[string]interface{})

		name, ok := req.GetArguments()["name"]
		if !ok {
			return mcp.NewToolResultError("name is required"), nil
		}
		payload["name"] = name

		if v, ok := req.GetArguments()["color"]; ok {
			if s, ok := v.(string); ok && s != "" {
				payload["color"] = s
			}
		}

		body, err := doPost(ctx, fmt.Sprintf("%s/api/v1/projects", serverURL), payload)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to create project: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- update_project ---

func registerUpdateProject(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("update_project",
		mcp.WithDescription("Update an existing project"),
		mcp.WithNumber("id",
			mcp.Required(),
			mcp.Description("ID of the project to update"),
		),
		mcp.WithString("name",
			mcp.Description("New project name"),
		),
		mcp.WithString("color",
			mcp.Description("New project color (hex, e.g. #007AFF)"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		idVal, ok := req.GetArguments()["id"]
		if !ok {
			return mcp.NewToolResultError("id is required"), nil
		}
		id := int(idVal.(float64))

		payload := make(map[string]interface{})
		if v, ok := req.GetArguments()["name"]; ok {
			if s, ok := v.(string); ok && s != "" {
				payload["name"] = s
			}
		}
		if v, ok := req.GetArguments()["color"]; ok {
			if s, ok := v.(string); ok && s != "" {
				payload["color"] = s
			}
		}

		body, err := doPut(ctx, fmt.Sprintf("%s/api/v1/projects/%d", serverURL, id), payload)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to update project: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- delete_project ---

func registerDeleteProject(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("delete_project",
		mcp.WithDescription("Delete a project"),
		mcp.WithNumber("id",
			mcp.Required(),
			mcp.Description("ID of the project to delete"),
		),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		idVal, ok := req.GetArguments()["id"]
		if !ok {
			return mcp.NewToolResultError("id is required"), nil
		}
		id := int(idVal.(float64))

		err := doDelete(ctx, fmt.Sprintf("%s/api/v1/projects/%d", serverURL, id))
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to delete project: %v", err)), nil
		}
		return mcp.NewToolResultText(fmt.Sprintf("Project %d deleted successfully", id)), nil
	})
}

// --- daily_summary ---

func registerDailySummary(s *server.MCPServer, serverURL string) {
	tool := mcp.NewTool("daily_summary",
		mcp.WithDescription("Get AI-generated daily digest of todos"),
	)

	s.AddTool(tool, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		body, err := doPost(ctx, fmt.Sprintf("%s/api/v1/ai/daily-summary", serverURL), nil)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("failed to get daily summary: %v", err)), nil
		}
		return mcp.NewToolResultText(string(body)), nil
	})
}

// --- HTTP helpers ---

func doGet(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	return doRequest(req)
}

func doPost(ctx context.Context, url string, payload interface{}) ([]byte, error) {
	var bodyReader io.Reader
	if payload != nil {
		data, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("marshaling payload: %w", err)
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return doRequest(req)
}

func doPut(ctx context.Context, url string, payload interface{}) ([]byte, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshaling payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	return doRequest(req)
}

func doDelete(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}
	_, err = doRequest(req)
	return err
}

func doRequest(req *http.Request) ([]byte, error) {
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}
