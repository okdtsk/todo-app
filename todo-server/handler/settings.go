package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/okdtsk/todo-app/todo-server/crypto"
	"github.com/okdtsk/todo-app/todo-server/db"
	"github.com/okdtsk/todo-app/todo-server/model"
)

// SettingsHandler handles HTTP requests for settings.
type SettingsHandler struct {
	store  *db.Store
	encKey []byte
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(store *db.Store, encKey []byte) *SettingsHandler {
	return &SettingsHandler{store: store, encKey: encKey}
}

// Get handles GET /api/v1/settings.
func (h *SettingsHandler) Get(w http.ResponseWriter, r *http.Request) {
	settings, err := h.buildSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load settings")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

// Update handles PUT /api/v1/settings.
func (h *SettingsHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req model.AppSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.AIProvider != "" {
		if err := h.store.SetSetting("ai_provider", req.AIProvider); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save ai_provider")
			return
		}
	}

	if req.AIModel != "" {
		if err := h.store.SetSetting("ai_model", req.AIModel); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save ai_model")
			return
		}
	}

	// Encrypt and store the API key
	if req.AIAPIKey != "" {
		encrypted, err := crypto.Encrypt(req.AIAPIKey, h.encKey)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to encrypt ai_api_key")
			return
		}
		if err := h.store.SetSetting("ai_api_key", encrypted); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save ai_api_key")
			return
		}
	}

	if req.AIProvider != "" {
		if err := h.store.SetSetting("ai_base_url", strings.TrimSpace(req.AIBaseURL)); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save ai_base_url")
			return
		}
	}

	if req.LabelOrder != nil {
		orderJSON, _ := json.Marshal(req.LabelOrder)
		if err := h.store.SetSetting("label_order", string(orderJSON)); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to save label_order")
			return
		}
	}

	settings, err := h.buildSettings()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load settings")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

// decryptAPIKey decrypts the stored API key, falling back to plaintext for legacy values.
func (h *SettingsHandler) decryptAPIKey(stored string) string {
	if stored == "" {
		return ""
	}
	decrypted, err := crypto.Decrypt(stored, h.encKey)
	if err != nil {
		// Legacy plaintext value — re-encrypt it in place
		log.Printf("migrating plaintext ai_api_key to encrypted storage")
		encrypted, encErr := crypto.Encrypt(stored, h.encKey)
		if encErr == nil {
			_ = h.store.SetSetting("ai_api_key", encrypted)
		}
		return stored
	}
	return decrypted
}

func (h *SettingsHandler) buildSettings() (model.AppSettings, error) {
	all, err := h.store.GetAllSettings()
	if err != nil {
		return model.AppSettings{}, err
	}

	apiKey := h.decryptAPIKey(all["ai_api_key"])

	settings := model.AppSettings{
		AIProvider: all["ai_provider"],
		AIModel:    all["ai_model"],
		AIKeySet:   apiKey != "",
		AIBaseURL:  all["ai_base_url"],
		LabelOrder: []string{},
	}

	// Mask the API key
	if apiKey != "" {
		if len(apiKey) > 4 {
			settings.AIAPIKey = "••••" + apiKey[len(apiKey)-4:]
		} else {
			settings.AIAPIKey = "••••"
		}
	}

	if orderJSON := all["label_order"]; orderJSON != "" {
		var order []string
		if err := json.Unmarshal([]byte(orderJSON), &order); err == nil {
			settings.LabelOrder = order
		}
	}

	return settings, nil
}
