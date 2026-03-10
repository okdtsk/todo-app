package handler

import (
	"encoding/json"
	"net/http"

	"github.com/okdtsk/todo-app/todo-server/db"
	"github.com/okdtsk/todo-app/todo-server/model"
)

// LabelHandler handles HTTP requests for label resources.
type LabelHandler struct {
	store *db.Store
}

// NewLabelHandler creates a new LabelHandler.
func NewLabelHandler(store *db.Store) *LabelHandler {
	return &LabelHandler{store: store}
}

// List handles GET /api/v1/labels.
func (h *LabelHandler) List(w http.ResponseWriter, r *http.Request) {
	labels, err := h.store.ListLabels()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list labels")
		return
	}

	writeJSON(w, http.StatusOK, labels)
}

// Rename handles PUT /api/v1/labels/rename.
func (h *LabelHandler) Rename(w http.ResponseWriter, r *http.Request) {
	var req model.RenameLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.OldName == "" || req.NewName == "" {
		writeError(w, http.StatusBadRequest, "old_name and new_name are required")
		return
	}

	if err := h.store.RenameLabel(req.OldName, req.NewName); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rename label")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
