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

// ProjectHandler handles HTTP requests for project resources.
type ProjectHandler struct {
	store *db.Store
}

// NewProjectHandler creates a new ProjectHandler.
func NewProjectHandler(store *db.Store) *ProjectHandler {
	return &ProjectHandler{store: store}
}

// List handles GET /api/v1/projects.
func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	projects, err := h.store.ListProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list projects")
		return
	}

	writeJSON(w, http.StatusOK, projects)
}

// ListArchived handles GET /api/v1/projects/archived.
func (h *ProjectHandler) ListArchived(w http.ResponseWriter, r *http.Request) {
	projects, err := h.store.ListArchivedProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list archived projects")
		return
	}

	writeJSON(w, http.StatusOK, projects)
}

// Create handles POST /api/v1/projects.
func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	project, err := h.store.CreateProject(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create project")
		return
	}

	writeJSON(w, http.StatusCreated, project)
}

// Update handles PUT /api/v1/projects/:id.
func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	var req model.UpdateProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	project, err := h.store.UpdateProject(id, req)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update project")
		return
	}

	writeJSON(w, http.StatusOK, project)
}

// Delete handles DELETE /api/v1/projects/:id.
func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return
	}

	if err := h.store.DeleteProject(id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "project not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Order handles PUT /api/v1/projects/order.
func (h *ProjectHandler) Order(w http.ResponseWriter, r *http.Request) {
	var ids []int
	if err := json.NewDecoder(r.Body).Decode(&ids); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: expected array of project IDs")
		return
	}

	if err := h.store.UpdateProjectOrder(ids); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update project order")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
