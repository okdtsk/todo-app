# tdtd

Personal TODO management system with multi-client support and AI integration.

## Architecture

```
┌─────────────────────────────────────────────┐
│                 todo-server                 │
│  Go + chi │ SQLite │ REST API + MCP Server  │
└────────────────────┬────────────────────────┘
                     │ HTTP /api/v1
          ┌──────────┼──────────┐
          │          │          │
     todo-web    todo-cli   todo-mcp
  React/TypeScript  Go CLI   MCP Server
  (Web + PWA)                (AI agents)
```

All state lives in `todo-server`. Clients are stateless consumers of the REST API.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Server | Go 1.22+, chi, SQLite (CGO-free) |
| Web | React 18, TypeScript, Vite, Tailwind CSS |
| CLI | Go, cobra |
| MCP | Go, mcp-go |
| AI | OpenAI, Gemini, Anthropic APIs |
| Deploy | Docker + docker-compose |

## Getting Started

### Prerequisites

- Go 1.22+
- Node.js 18+
- npm

### Run Locally

```bash
# Start the API server (port 8080)
cd todo-server && go run main.go

# Start the web client (port 5173)
cd todo-web && npm install && npm run dev
```

### Docker

```bash
docker-compose up --build
```

### Environment Variables

All optional — AI features degrade gracefully without API keys.

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_BASE_URL` | Custom base URL for OpenAI-compatible APIs |
| `OPENAI_MODEL` | OpenAI model override |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Anthropic model override |

AI provider and API keys can also be configured from the Settings UI in `todo-web`.

## Clients

### todo-web

React SPA with PWA support. Views: Today, Inbox, Upcoming, Projects, Labels.

Features:
- Instant task capture with progressive detail disclosure
- Drag-and-drop reordering (desktop and mobile)
- AI assistant for natural language task management
- Image and URL analysis via AI
- Multiple themes
- Responsive layout (desktop + mobile)

### todo-cli

```bash
cd todo-cli && go run main.go list --today
cd todo-cli && go run main.go add "Submit report" --priority high --deadline 2025-01-31
cd todo-cli && go run main.go done 42
```

Reads `TODO_SERVER_URL` from env or `~/.config/todo/config.yaml`.

### todo-mcp

MCP Server for AI agents (Claude Desktop, etc.). Exposes tools: `list_todos`, `create_todo`, `update_todo`, `complete_todo`, `delete_todo`, `daily_summary`.

```bash
cd todo-mcp && go run main.go
```

## API

Base path: `/api/v1` — JSON request/response.

```
GET    /api/v1/todos           # query: project_id, label, priority, done, date
POST   /api/v1/todos
PUT    /api/v1/todos/:id
DELETE /api/v1/todos/:id

GET    /api/v1/projects
POST   /api/v1/projects
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id

GET    /api/v1/labels

GET    /api/v1/settings
PUT    /api/v1/settings

POST   /api/v1/ai/analyze      # Natural language task CRUD with optional image/URL
```

## License

Private project.
