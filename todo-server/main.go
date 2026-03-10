package main

import (
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"crypto/rand"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/okdtsk/todo-app/todo-server/ai"
	"github.com/okdtsk/todo-app/todo-server/crypto"
	"github.com/okdtsk/todo-app/todo-server/db"
	"github.com/okdtsk/todo-app/todo-server/handler"
)

// loadEncryptionKey returns a 32-byte AES key.
// Priority: ENCRYPTION_KEY env var > .encryption_key file next to DB > auto-generate.
func loadEncryptionKey(dbPath string) []byte {
	// 1. From environment variable
	if envKey := os.Getenv("ENCRYPTION_KEY"); envKey != "" {
		return crypto.DeriveKey(envKey)
	}

	// 2. From file next to the database
	keyFile := filepath.Join(filepath.Dir(dbPath), ".encryption_key")
	if data, err := os.ReadFile(keyFile); err == nil {
		return crypto.DeriveKey(string(data))
	}

	// 3. Auto-generate and persist
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		log.Fatalf("failed to generate encryption key: %v", err)
	}
	keyHex := hex.EncodeToString(raw)
	if err := os.WriteFile(keyFile, []byte(keyHex), 0600); err != nil {
		log.Fatalf("failed to write encryption key file %s: %v", keyFile, err)
	}
	log.Printf("generated encryption key file: %s", keyFile)
	return crypto.DeriveKey(keyHex)
}

func main() {
	dsn := os.Getenv("DB_PATH")
	if dsn == "" {
		dsn = "todo.db"
	}

	store, err := db.New(dsn)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			log.Printf("error closing database: %v", err)
		}
	}()

	encKey := loadEncryptionKey(dsn)

	// Initialize AI provider from env vars (optional — DB settings take priority)
	var fallbackProvider ai.Provider
	if key := os.Getenv("GEMINI_API_KEY"); key != "" {
		model := os.Getenv("GEMINI_MODEL")
		fallbackProvider = ai.NewGeminiProvider(key, model)
		log.Println("Gemini AI provider initialized (env)")
	} else if key := os.Getenv("OPENAI_API_KEY"); key != "" {
		model := os.Getenv("OPENAI_MODEL")
		baseURL := os.Getenv("OPENAI_BASE_URL")
		fallbackProvider = ai.NewOpenAIProvider(key, model, baseURL)
		log.Println("OpenAI AI provider initialized (env)")
	} else if key := os.Getenv("ANTHROPIC_API_KEY"); key != "" {
		model := os.Getenv("ANTHROPIC_MODEL")
		fallbackProvider = ai.NewAnthropicProvider(key, model)
		log.Println("Anthropic AI provider initialized (env)")
	} else {
		log.Println("No AI API key set — AI features rely on Settings configuration")
	}

	todoH := handler.NewTodoHandler(store)
	projectH := handler.NewProjectHandler(store)
	labelH := handler.NewLabelHandler(store)
	settingsH := handler.NewSettingsHandler(store, encKey)
	aiH := handler.NewAIHandler(store, fallbackProvider, encKey)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		// Todos
		r.Get("/todos", todoH.List)
		r.Post("/todos", todoH.Create)
		r.Put("/todos/order", todoH.Order)
		r.Put("/todos/{id}", todoH.Update)
		r.Delete("/todos/{id}", todoH.Delete)

		// Projects
		r.Get("/projects", projectH.List)
		r.Get("/projects/archived", projectH.ListArchived)
		r.Post("/projects", projectH.Create)
		r.Put("/projects/order", projectH.Order)
		r.Put("/projects/{id}", projectH.Update)
		r.Delete("/projects/{id}", projectH.Delete)

		// Labels
		r.Get("/labels", labelH.List)
		r.Put("/labels/rename", labelH.Rename)

		// Settings
		r.Get("/settings", settingsH.Get)
		r.Put("/settings", settingsH.Update)

		// AI
		r.Post("/ai/analyze", aiH.Analyze)
		r.Post("/ai/command", aiH.Command)
		r.Post("/ai/daily-summary", aiH.DailySummary)
	})

	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := host + ":" + port

	log.Printf("starting server on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
