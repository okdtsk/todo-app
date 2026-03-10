package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/okdtsk/todo-app/todo-server/db"
	"github.com/okdtsk/todo-app/todo-server/model"
)

// TodoHandler handles HTTP requests for todo resources.
type TodoHandler struct {
	store *db.Store
}

// NewTodoHandler creates a new TodoHandler.
func NewTodoHandler(store *db.Store) *TodoHandler {
	return &TodoHandler{store: store}
}

// List handles GET /api/v1/todos.
func (h *TodoHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	var projectID *int
	if v := q.Get("project_id"); v != "" {
		id, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid project_id")
			return
		}
		projectID = &id
	}

	var label *string
	if v := q.Get("label"); v != "" {
		label = &v
	}

	var priority *string
	if v := q.Get("priority"); v != "" {
		priority = &v
	}

	var done *bool
	if v := q.Get("done"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid done parameter")
			return
		}
		done = &b
	}

	var date *string
	if v := q.Get("date"); v != "" {
		date = &v
	}

	todos, err := h.store.ListTodos(projectID, label, priority, done, date)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list todos")
		return
	}

	writeJSON(w, http.StatusOK, todos)
}

// Create handles POST /api/v1/todos.
func (h *TodoHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateTodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.TaskName == "" {
		writeError(w, http.StatusBadRequest, "task_name is required")
		return
	}

	if req.Priority != "" && !model.ValidPriority(req.Priority) {
		writeError(w, http.StatusBadRequest, "invalid priority")
		return
	}

	todo, err := h.store.CreateTodo(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create todo")
		return
	}

	writeJSON(w, http.StatusCreated, todo)
}

// Order handles PUT /api/v1/todos/order.
func (h *TodoHandler) Order(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IDs []int `json:"ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.IDs) == 0 {
		writeError(w, http.StatusBadRequest, "ids is required")
		return
	}

	if err := h.store.UpdateTodoOrder(req.IDs); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update todo order")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Update handles PUT /api/v1/todos/:id.
func (h *TodoHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid todo id")
		return
	}

	var req model.UpdateTodoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	todo, err := h.store.UpdateTodo(id, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "todo not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update todo")
		return
	}

	writeJSON(w, http.StatusOK, todo)
}

// Delete handles DELETE /api/v1/todos/:id.
func (h *TodoHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid todo id")
		return
	}

	if err := h.store.DeleteTodo(id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "todo not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete todo")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
