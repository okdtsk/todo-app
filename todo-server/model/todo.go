package model

import (
	"encoding/json"
	"time"
)

// Priority represents the urgency level of a todo item.
type Priority string

const (
	PriorityNone   Priority = "none"
	PriorityLow    Priority = "low"
	PriorityMedium Priority = "medium"
	PriorityHigh   Priority = "high"
)

// ValidPriority checks whether a given priority value is valid.
func ValidPriority(p Priority) bool {
	switch p {
	case PriorityNone, PriorityLow, PriorityMedium, PriorityHigh:
		return true
	}
	return false
}

// Todo represents a single task.
type Todo struct {
	ID          int        `json:"id"`
	TaskName    string     `json:"task_name"`
	Description string     `json:"description,omitempty"`
	Priority    Priority   `json:"priority"`
	Date        *time.Time `json:"date,omitempty"`
	Deadline    *time.Time `json:"deadline,omitempty"`
	ReminderAt  *time.Time `json:"reminder_at,omitempty"`
	Labels      []string   `json:"labels"`
	ProjectID   *int       `json:"project_id,omitempty"`
	Done        bool       `json:"done"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// MarshalJSON ensures labels is always serialized as [] instead of null.
func (t Todo) MarshalJSON() ([]byte, error) {
	type Alias Todo
	labels := t.Labels
	if labels == nil {
		labels = []string{}
	}
	return json.Marshal(&struct {
		Alias
		Labels []string `json:"labels"`
	}{
		Alias:  Alias(t),
		Labels: labels,
	})
}

// CreateTodoRequest is the payload for creating a todo.
type CreateTodoRequest struct {
	TaskName    string   `json:"task_name"`
	Description string   `json:"description,omitempty"`
	Priority    Priority `json:"priority,omitempty"`
	Date        *string  `json:"date,omitempty"`
	Deadline    *string  `json:"deadline,omitempty"`
	ReminderAt  *string  `json:"reminder_at,omitempty"`
	Labels      []string `json:"labels,omitempty"`
	ProjectID   *int     `json:"project_id,omitempty"`
}

// UpdateTodoRequest is the payload for updating a todo.
type UpdateTodoRequest struct {
	TaskName    *string  `json:"task_name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Priority    *string  `json:"priority,omitempty"`
	Date        *string  `json:"date,omitempty"`
	Deadline    *string  `json:"deadline,omitempty"`
	ReminderAt  *string  `json:"reminder_at,omitempty"`
	Labels      []string `json:"labels,omitempty"`
	ProjectID   *int     `json:"project_id,omitempty"`
	Done        *bool    `json:"done,omitempty"`
}

// Project represents a collection of todos.
type Project struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	SortOrder int       `json:"sort_order"`
	Archived  bool      `json:"archived"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateProjectRequest is the payload for creating a project.
type CreateProjectRequest struct {
	Name  string `json:"name"`
	Color string `json:"color,omitempty"`
}

// UpdateProjectRequest is the payload for updating a project.
type UpdateProjectRequest struct {
	Name     *string `json:"name,omitempty"`
	Color    *string `json:"color,omitempty"`
	Archived *bool   `json:"archived,omitempty"`
}

// ErrorResponse is the standard error envelope.
type ErrorResponse struct {
	Error string `json:"error"`
}

// AppSettings represents application-wide settings.
type AppSettings struct {
	AIProvider string   `json:"ai_provider"`
	AIModel    string   `json:"ai_model"`
	AIAPIKey   string   `json:"ai_api_key"`
	AIKeySet   bool     `json:"ai_key_set"`
	LabelOrder []string `json:"label_order"`
}

// RenameLabelRequest is the payload for renaming a label.
type RenameLabelRequest struct {
	OldName string `json:"old_name"`
	NewName string `json:"new_name"`
}

// AICommandRequest is the payload for AI command endpoint.
type AICommandRequest struct {
	Command string `json:"command"`
}

// AICommandResponse is the response for AI command endpoint.
type AICommandResponse struct {
	Message string `json:"message"`
}

// AIAnalyzeRequest is the payload for AI analyze endpoint.
type AIAnalyzeRequest struct {
	Message   string `json:"message"`
	URL       string `json:"url,omitempty"`
	Image     string `json:"image,omitempty"`      // base64 encoded
	ImageType string `json:"image_type,omitempty"` // MIME type e.g. "image/png"
}

// AIAction represents a single action returned by AI.
type AIAction struct {
	Type        string   `json:"type"` // "create", "update", "complete", "delete", "create_project", "update_project", "delete_project"
	TodoID      int      `json:"todo_id,omitempty"`
	TaskName    string   `json:"task_name,omitempty"`
	Description string   `json:"description,omitempty"`
	Priority    string   `json:"priority,omitempty"`
	Date        string   `json:"date,omitempty"`
	Deadline    string   `json:"deadline,omitempty"`
	Labels      []string `json:"labels,omitempty"`
	ProjectID   *int     `json:"project_id,omitempty"`
	// Project fields
	ProjectName  string `json:"project_name,omitempty"`
	ProjectColor string `json:"project_color,omitempty"`
}

// AIAnalyzeResponse is the response for AI analyze endpoint.
type AIAnalyzeResponse struct {
	Summary  string     `json:"summary"`
	Actions  []AIAction `json:"actions"`
	Todos    []Todo     `json:"todos"`
	Projects []Project  `json:"projects,omitempty"`
}
