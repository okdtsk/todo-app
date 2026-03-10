package main

import (
	"fmt"
	"os"

	"github.com/mark3labs/mcp-go/server"
	"github.com/okdtsk/todo-app/todo-mcp/tools"
)

func main() {
	serverURL := os.Getenv("TODO_SERVER_URL")
	if serverURL == "" {
		serverURL = "http://localhost:8080"
	}

	s := server.NewMCPServer(
		"todo-mcp",
		"0.1.0",
		server.WithToolCapabilities(false),
		server.WithRecovery(),
	)

	tools.Register(s, serverURL)

	if err := server.ServeStdio(s); err != nil {
		fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		os.Exit(1)
	}
}
