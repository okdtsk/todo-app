# CLAUDE.md

## Project Overview

Personal TODO management system with multi-client support and AI integration.
Follows a strict server-client model: `todo-server` owns all data, clients are thin consumers.

---

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
  (Web + Chrome App)         (AI agents)
```

**Rule**: No client holds state. All CRUD goes through `todo-server`.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Server Language | Go 1.22+ |
| Router | chi |
| Storage | SQLite (`modernc.org/sqlite`, CGO-free) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| CLI | Go (`cobra`) |
| MCP Server | Go (`mark3labs/mcp-go`) |
| AI Integration | OpenAI API, Gemini API, Anthropic API |
| Container | Docker + docker-compose |

---

## Project Structure

```
.
├── todo-server/
│   ├── main.go
│   ├── handler/
│   ├── model/
│   ├── db/
│   └── ai/              # AI provider adapters
│       ├── openai.go
│       ├── gemini.go
│       └── anthropic.go
├── todo-web/
│   ├── src/
│   │   ├── components/
│   │   ├── views/       # Inbox, Today, Project, Label, etc.
│   │   ├── types/       # Manually synced with Go structs
│   │   └── api/         # fetch wrappers
│   ├── public/
│   │   └── manifest.json  # Chrome App manifest
│   └── vite.config.ts
├── todo-cli/
│   ├── main.go
│   └── cmd/
├── todo-mcp/
│   ├── main.go
│   └── tools/           # MCP tool definitions
├── docker-compose.yml
└── CLAUDE.md
```

---

## Data Model

### Todo

```go
// todo-server/model/todo.go
type Todo struct {
    ID          int        `json:"id"`
    TaskName    string     `json:"task_name"`
    Description string     `json:"description,omitempty"`
    Priority    Priority   `json:"priority"`              // none | low | medium | high
    Date        *time.Time `json:"date,omitempty"`        // scheduled date
    Deadline    *time.Time `json:"deadline,omitempty"`
    ReminderAt  *time.Time `json:"reminder_at,omitempty"` // date + optional time
    Labels      []string   `json:"labels"`
    ProjectID   *int       `json:"project_id,omitempty"`
    Done        bool       `json:"done"`
    CreatedAt   time.Time  `json:"created_at"`
    UpdatedAt   time.Time  `json:"updated_at"`
}

type Priority string
const (
    PriorityNone   Priority = "none"
    PriorityLow    Priority = "low"
    PriorityMedium Priority = "medium"
    PriorityHigh   Priority = "high"
)

type Project struct {
    ID        int       `json:"id"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
}
```

```typescript
// todo-web/src/types/api.ts
export type Priority = "none" | "low" | "medium" | "high";

export type Todo = {
  id: number;
  task_name: string;
  description?: string;
  priority: Priority;
  date?: string;         // ISO 8601
  deadline?: string;
  reminder_at?: string;
  labels: string[];
  project_id?: number;
  done: boolean;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: number;
  name: string;
  created_at: string;
};
```

---

## API Conventions

- Base path: `/api/v1`
- Request/Response: JSON
- Error response: `{ "error": "message" }`
- Optional fields: omit key entirely if null (not `null`)

### Endpoints

```
# Todos
GET    /api/v1/todos              # query: project_id, label, priority, done, date
POST   /api/v1/todos
PUT    /api/v1/todos/:id
DELETE /api/v1/todos/:id

# Projects
GET    /api/v1/projects
POST   /api/v1/projects
DELETE /api/v1/projects/:id

# Labels
GET    /api/v1/labels

# AI
POST   /api/v1/ai/command         # Natural language task CRUD
POST   /api/v1/ai/daily-summary   # Daily digest generation
```

---

## AI Integration

### Providers

All providers implement a common interface. Provider is selected via config.

```go
// todo-server/ai/provider.go
type Provider interface {
    Complete(ctx context.Context, prompt string) (string, error)
}
// Implementations: OpenAIProvider, GeminiProvider, AnthropicProvider
```

### Features

**Natural language task CRUD** (`POST /api/v1/ai/command`)
- Input: free-form text (e.g. "Add a high priority task to submit report by Friday")
- Server interprets intent → executes CRUD → returns affected todos

**Daily summary** (`POST /api/v1/ai/daily-summary`)
- Aggregates today's todos, overdue items, upcoming deadlines
- Returns a structured markdown digest

### Config

```env
AI_PROVIDER=anthropic          # openai | gemini | anthropic
OPENAI_API_KEY=...
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...
```

---

## Client: todo-web

### Views

| View | Description |
|------|-------------|
| Inbox | All todos without a project |
| Today | Scheduled for today + overdue |
| Upcoming | Date-based timeline view |
| Project | Per-project todo list |
| Labels | Filter by label |

### Chrome App Support

`todo-web` doubles as a Chrome App (PWA).
- `public/manifest.json` with `display: standalone`
- Responsive layout: supports both desktop and mobile

### Design Principles

**Philosophy: "The task list IS the product."**

Everything — sidebar, form, headers — exists only to serve the task list. The app should feel like a well-made native tool, not a designed artifact. Personality comes from excellent interaction design, not decorative styling.

**UX Foundations:**

- **Today is home** — Default view is Today, not Inbox. The first question is "what needs my attention now?", not "what's unprocessed?"
- **Capture is instant** — Task input is a single text field. Press Enter to add. Details (priority, date, project) are progressive — revealed on demand, never required upfront
- **Completion is satisfying** — Checking off a task has a brief, pleasing moment: checkbox fills, text fades with strikethrough, item settles into a "completed" section. Not flashy, but rewarding
- **Counts tell the story** — Sidebar shows task counts next to each view/project. Without counts, the sidebar is just a list of labels; with counts, it communicates workload at a glance

**Visual Design:**

- **Font**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`). No custom fonts. System fonts render natively, load instantly, feel like they belong on the device
- **Background**: Pure white (`#FFFFFF`) for content, barely-tinted gray (`#F8F8FA`) for sidebar. Clean canvas, not a mood board
- **Text**: Near-black (`#1C1C1E`) for task names, medium gray (`#8E8E93`) for metadata, light gray (`#C7C7CC`) for placeholders. Hierarchy through weight and shade, not color
- **Accent**: A single confident blue (`#007AFF`). Used for: interactive elements, active checkbox, focused states. Nothing else
- **Semantic color only**: Red (`#FF3B30`) for overdue/high priority, amber (`#FF9500`) for medium priority. No decorative color anywhere else
- **Borders**: Almost never. Separate sections with whitespace. Use a `1px #F0F0F2` border only where absolutely necessary (sidebar edge, form bottom)

**Layout:**

- **Sidebar**: 240px, subtle background, sticky. Contains: app title, primary nav (Today/Upcoming/Inbox with counts), projects with counts, labels
- **Content**: max-width `640px`, centered, generous padding (`32px` horizontal, `40px` vertical). Narrow width improves readability and focus
- **Task rows**: ~52px height. Circular checkbox (20px) + task name + metadata row. Comfortable click target, not cramped
- **Spacing over decoration**: No card wrappers, no shadows on task items, no background fills on rows. Whitespace alone creates visual groups

**Interaction:**

- **Task input**: Collapsed = subtle "Add a task..." placeholder. Focused = text field with Enter to submit. Optional detail fields expand below only when needed
- **Task item hover**: Subtle background tint, reveal delete button on right
- **Checkbox**: Circular, thin border. Unchecked = `#D1D1D6` border. Hover = accent border. Checked = accent fill with white checkmark
- **Priority**: Small dot (6px) to the left of checkbox. High = red, medium = amber, low = gray, none = hidden. Subtle, never dominant

**Avoid:**

- Custom fonts (loading delay, FOUT, feels over-designed)
- Warm/tinted backgrounds (adds mood where none is needed)
- Card-based layouts for task items (visual noise)
- Large prominent "Add" buttons (captures attention away from tasks)
- Dark mode as default
- Anything that draws attention to the UI rather than the tasks themselves

---

## Client: todo-cli

```bash
todo add "Submit report" --priority high --deadline 2025-01-31
todo list --today
todo done 42
todo summary          # AI daily summary in terminal
```

Built with `cobra`. Reads `TODO_SERVER_URL` from env or `~/.config/todo/config.yaml`.

---

## Client: todo-mcp

Exposes `todo-server` as an MCP Server so AI agents (Claude Desktop etc.) can manage todos.

### MCP Tools

| Tool | Description |
|------|-------------|
| `list_todos` | Get todos with optional filters |
| `create_todo` | Create a new todo |
| `update_todo` | Update fields of existing todo |
| `complete_todo` | Mark todo as done |
| `delete_todo` | Delete a todo |
| `daily_summary` | Get AI-generated daily digest |

---

## Development Commands

```bash
# Server
cd todo-server && go run main.go          # port 8080
cd todo-server && go build -o server .

# Web
cd todo-web && npm run dev                # port 5173
cd todo-web && npm run build

# CLI
cd todo-cli && go run main.go list --today

# MCP
cd todo-mcp && go run main.go

# All-in-one
docker-compose up --build
```

---

## Code Style

### Go
- Errors: always handle explicitly, never discard with `_`
- No ORM: use `database/sql` directly
- Handlers thin: delegate logic to service layer
- AI provider: always accept `context.Context` for timeout control

### TypeScript / React
- Functional components only
- All props explicitly typed
- No `any`
- API calls isolated in `src/api/`

---

## Constraints

- No external auth (personal use)
- SQLite only — no Docker volume complexity
- Keep dependencies minimal per component
- AI features are opt-in; app must be fully functional without an API key
