package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/okdtsk/todo-app/todo-server/model"

	_ "modernc.org/sqlite"
)

// Store wraps a sql.DB connection and provides data access methods.
type Store struct {
	db *sql.DB
}

// New opens a SQLite database and runs migrations.
func New(dsn string) (*Store, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// Enable WAL mode for better concurrent reads.
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}

	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS todos (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		task_name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		priority TEXT NOT NULL DEFAULT 'none',
		date DATETIME,
		deadline DATETIME,
		reminder_at DATETIME,
		labels TEXT NOT NULL DEFAULT '[]',
		project_id INTEGER,
		done INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT (datetime('now')),
		updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
	);
	`
	if _, err := s.db.Exec(schema); err != nil {
		return fmt.Errorf("exec schema: %w", err)
	}

	// Add color column to projects if not exists.
	_, err := s.db.Exec("ALTER TABLE projects ADD COLUMN color TEXT NOT NULL DEFAULT ''")
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		// ignore duplicate column error
	}

	// Add sort_order column to projects if not exists.
	_, err = s.db.Exec("ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		// ignore duplicate column error
	}

	// Add sort_order column to todos if not exists.
	_, err = s.db.Exec("ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		// ignore duplicate column error
	}

	// Add archived column to projects if not exists.
	_, err = s.db.Exec("ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")
	if err != nil && !strings.Contains(err.Error(), "duplicate column") {
		// ignore duplicate column error
	}

	// Settings table for app-wide configuration.
	_, err = s.db.Exec(`CREATE TABLE IF NOT EXISTS settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	)`)
	if err != nil {
		return fmt.Errorf("create settings table: %w", err)
	}

	return nil
}

// parseTime parses an ISO 8601 string into *time.Time.
func parseTime(s *string) (*time.Time, error) {
	if s == nil || *s == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, *s)
	if err != nil {
		return nil, fmt.Errorf("parse time %q: %w", *s, err)
	}
	return &t, nil
}

// nullTimeStr converts a sql.NullString to *time.Time.
func nullTimeStr(ns sql.NullString) *time.Time {
	if !ns.Valid || ns.String == "" {
		return nil
	}
	t, err := time.Parse(time.RFC3339, ns.String)
	if err != nil {
		// Try parsing without timezone.
		t, err = time.Parse("2006-01-02T15:04:05", ns.String)
		if err != nil {
			return nil
		}
	}
	return &t
}

func scanTodo(row interface{ Scan(dest ...any) error }) (model.Todo, error) {
	var t model.Todo
	var desc, labelsJSON string
	var dateStr, deadlineStr, reminderStr sql.NullString
	var projectID sql.NullInt64
	var done int
	var createdStr, updatedStr string

	err := row.Scan(
		&t.ID,
		&t.TaskName,
		&desc,
		&t.Priority,
		&dateStr,
		&deadlineStr,
		&reminderStr,
		&labelsJSON,
		&projectID,
		&done,
		&createdStr,
		&updatedStr,
	)
	if err != nil {
		return t, err
	}

	t.Description = desc
	t.Done = done != 0
	t.Date = nullTimeStr(dateStr)
	t.Deadline = nullTimeStr(deadlineStr)
	t.ReminderAt = nullTimeStr(reminderStr)

	if projectID.Valid {
		pid := int(projectID.Int64)
		t.ProjectID = &pid
	}

	if err := json.Unmarshal([]byte(labelsJSON), &t.Labels); err != nil {
		t.Labels = []string{}
	}

	t.CreatedAt, _ = time.Parse(time.RFC3339, createdStr)
	if t.CreatedAt.IsZero() {
		t.CreatedAt, _ = time.Parse("2006-01-02T15:04:05", createdStr)
	}
	t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedStr)
	if t.UpdatedAt.IsZero() {
		t.UpdatedAt, _ = time.Parse("2006-01-02T15:04:05", updatedStr)
	}

	return t, nil
}

const todoCols = "id, task_name, description, priority, date, deadline, reminder_at, labels, project_id, done, created_at, updated_at"

// ListTodos returns todos filtered by optional query parameters.
func (s *Store) ListTodos(projectID *int, label, priority *string, done *bool, date *string) ([]model.Todo, error) {
	query := "SELECT " + todoCols + " FROM todos WHERE 1=1"
	var args []any

	if projectID != nil {
		query += " AND project_id = ?"
		args = append(args, *projectID)
	}
	if priority != nil && *priority != "" {
		query += " AND priority = ?"
		args = append(args, *priority)
	}
	if done != nil {
		if *done {
			query += " AND done = 1"
		} else {
			query += " AND done = 0"
		}
	}
	if date != nil && *date != "" {
		query += " AND date(date) = date(?)"
		args = append(args, *date)
	}
	if label != nil && *label != "" {
		// Match label inside JSON array.
		query += " AND labels LIKE ?"
		args = append(args, "%"+*label+"%")
	}

	query += " ORDER BY sort_order ASC, created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	var todos []model.Todo
	for rows.Next() {
		t, err := scanTodo(rows)
		if err != nil {
			return nil, fmt.Errorf("scan todo: %w", err)
		}
		todos = append(todos, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	if todos == nil {
		todos = []model.Todo{}
	}
	return todos, nil
}

// GetTodo returns a single todo by ID.
func (s *Store) GetTodo(id int) (model.Todo, error) {
	row := s.db.QueryRow("SELECT "+todoCols+" FROM todos WHERE id = ?", id)
	return scanTodo(row)
}

// CreateTodo inserts a new todo.
func (s *Store) CreateTodo(req model.CreateTodoRequest) (model.Todo, error) {
	priority := req.Priority
	if priority == "" {
		priority = model.PriorityNone
	}

	dateVal, err := parseTime(req.Date)
	if err != nil {
		return model.Todo{}, fmt.Errorf("parse date: %w", err)
	}
	deadlineVal, err := parseTime(req.Deadline)
	if err != nil {
		return model.Todo{}, fmt.Errorf("parse deadline: %w", err)
	}
	reminderVal, err := parseTime(req.ReminderAt)
	if err != nil {
		return model.Todo{}, fmt.Errorf("parse reminder_at: %w", err)
	}

	labels := req.Labels
	if labels == nil {
		labels = []string{}
	}
	labelsJSON, err := json.Marshal(labels)
	if err != nil {
		return model.Todo{}, fmt.Errorf("marshal labels: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)

	var dateArg, deadlineArg, reminderArg any
	if dateVal != nil {
		dateArg = dateVal.Format(time.RFC3339)
	}
	if deadlineVal != nil {
		deadlineArg = deadlineVal.Format(time.RFC3339)
	}
	if reminderVal != nil {
		reminderArg = reminderVal.Format(time.RFC3339)
	}

	var projectArg any
	if req.ProjectID != nil {
		projectArg = *req.ProjectID
	}

	// Set sort_order to max+1
	var maxOrder int
	_ = s.db.QueryRow("SELECT COALESCE(MAX(sort_order), -1) FROM todos").Scan(&maxOrder)

	result, err := s.db.Exec(
		`INSERT INTO todos (task_name, description, priority, date, deadline, reminder_at, labels, project_id, done, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
		req.TaskName, req.Description, priority, dateArg, deadlineArg, reminderArg, string(labelsJSON), projectArg, maxOrder+1, now, now,
	)
	if err != nil {
		return model.Todo{}, fmt.Errorf("insert todo: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return model.Todo{}, fmt.Errorf("last insert id: %w", err)
	}

	return s.GetTodo(int(id))
}

// UpdateTodo updates an existing todo.
func (s *Store) UpdateTodo(id int, req model.UpdateTodoRequest) (model.Todo, error) {
	var setClauses []string
	var args []any

	if req.TaskName != nil {
		setClauses = append(setClauses, "task_name = ?")
		args = append(args, *req.TaskName)
	}
	if req.Description != nil {
		setClauses = append(setClauses, "description = ?")
		args = append(args, *req.Description)
	}
	if req.Priority != nil {
		if !model.ValidPriority(model.Priority(*req.Priority)) {
			return model.Todo{}, fmt.Errorf("invalid priority: %s", *req.Priority)
		}
		setClauses = append(setClauses, "priority = ?")
		args = append(args, *req.Priority)
	}
	if req.Date != nil {
		t, err := parseTime(req.Date)
		if err != nil {
			return model.Todo{}, fmt.Errorf("parse date: %w", err)
		}
		if t != nil {
			setClauses = append(setClauses, "date = ?")
			args = append(args, t.Format(time.RFC3339))
		} else {
			setClauses = append(setClauses, "date = NULL")
		}
	}
	if req.Deadline != nil {
		t, err := parseTime(req.Deadline)
		if err != nil {
			return model.Todo{}, fmt.Errorf("parse deadline: %w", err)
		}
		if t != nil {
			setClauses = append(setClauses, "deadline = ?")
			args = append(args, t.Format(time.RFC3339))
		} else {
			setClauses = append(setClauses, "deadline = NULL")
		}
	}
	if req.ReminderAt != nil {
		t, err := parseTime(req.ReminderAt)
		if err != nil {
			return model.Todo{}, fmt.Errorf("parse reminder_at: %w", err)
		}
		if t != nil {
			setClauses = append(setClauses, "reminder_at = ?")
			args = append(args, t.Format(time.RFC3339))
		} else {
			setClauses = append(setClauses, "reminder_at = NULL")
		}
	}
	if req.Labels != nil {
		labelsJSON, err := json.Marshal(req.Labels)
		if err != nil {
			return model.Todo{}, fmt.Errorf("marshal labels: %w", err)
		}
		setClauses = append(setClauses, "labels = ?")
		args = append(args, string(labelsJSON))
	}
	if req.ProjectID != nil {
		setClauses = append(setClauses, "project_id = ?")
		args = append(args, *req.ProjectID)
	}
	if req.Done != nil {
		doneVal := 0
		if *req.Done {
			doneVal = 1
		}
		setClauses = append(setClauses, "done = ?")
		args = append(args, doneVal)
	}

	if len(setClauses) == 0 {
		return s.GetTodo(id)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	setClauses = append(setClauses, "updated_at = ?")
	args = append(args, now)
	args = append(args, id)

	query := fmt.Sprintf("UPDATE todos SET %s WHERE id = ?", strings.Join(setClauses, ", "))
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return model.Todo{}, fmt.Errorf("update todo: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return model.Todo{}, fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return model.Todo{}, sql.ErrNoRows
	}

	return s.GetTodo(id)
}

// UpdateTodoOrder sets the sort_order for todos based on the given ID order.
func (s *Store) UpdateTodoOrder(ids []int) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	for i, id := range ids {
		if _, err := tx.Exec("UPDATE todos SET sort_order = ? WHERE id = ?", i, id); err != nil {
			return fmt.Errorf("update sort_order: %w", err)
		}
	}

	return tx.Commit()
}

// DeleteTodo removes a todo by ID.
func (s *Store) DeleteTodo(id int) error {
	result, err := s.db.Exec("DELETE FROM todos WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete todo: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) scanProject(row interface{ Scan(dest ...any) error }) (model.Project, error) {
	var p model.Project
	var archived int
	var createdStr string
	err := row.Scan(&p.ID, &p.Name, &p.Color, &p.SortOrder, &archived, &createdStr)
	if err != nil {
		return p, err
	}
	p.Archived = archived != 0
	p.CreatedAt, _ = time.Parse(time.RFC3339, createdStr)
	if p.CreatedAt.IsZero() {
		p.CreatedAt, _ = time.Parse("2006-01-02T15:04:05", createdStr)
	}
	return p, nil
}

func (s *Store) listProjectsWhere(where string, args ...any) ([]model.Project, error) {
	query := "SELECT id, name, color, sort_order, archived, created_at FROM projects"
	if where != "" {
		query += " WHERE " + where
	}
	query += " ORDER BY sort_order ASC, created_at DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query projects: %w", err)
	}
	defer rows.Close()

	var projects []model.Project
	for rows.Next() {
		p, err := s.scanProject(rows)
		if err != nil {
			return nil, fmt.Errorf("scan project: %w", err)
		}
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	if projects == nil {
		projects = []model.Project{}
	}
	return projects, nil
}

// ListProjects returns all active (non-archived) projects.
func (s *Store) ListProjects() ([]model.Project, error) {
	return s.listProjectsWhere("archived = 0")
}

// ListArchivedProjects returns all archived projects.
func (s *Store) ListArchivedProjects() ([]model.Project, error) {
	return s.listProjectsWhere("archived = 1")
}

// CreateProject inserts a new project.
func (s *Store) CreateProject(req model.CreateProjectRequest) (model.Project, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	// Set sort_order to max+1
	var maxOrder int
	_ = s.db.QueryRow("SELECT COALESCE(MAX(sort_order), -1) FROM projects").Scan(&maxOrder)

	result, err := s.db.Exec("INSERT INTO projects (name, color, sort_order, created_at) VALUES (?, ?, ?, ?)", req.Name, req.Color, maxOrder+1, now)
	if err != nil {
		return model.Project{}, fmt.Errorf("insert project: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return model.Project{}, fmt.Errorf("last insert id: %w", err)
	}

	return s.getProject(int(id))
}

// UpdateProject updates an existing project.
func (s *Store) UpdateProject(id int, req model.UpdateProjectRequest) (model.Project, error) {
	var setClauses []string
	var args []any

	if req.Name != nil {
		setClauses = append(setClauses, "name = ?")
		args = append(args, *req.Name)
	}
	if req.Color != nil {
		setClauses = append(setClauses, "color = ?")
		args = append(args, *req.Color)
	}
	if req.Archived != nil {
		archived := 0
		if *req.Archived {
			archived = 1
		}
		setClauses = append(setClauses, "archived = ?")
		args = append(args, archived)
	}

	if len(setClauses) == 0 {
		return s.getProject(id)
	}

	args = append(args, id)
	query := fmt.Sprintf("UPDATE projects SET %s WHERE id = ?", strings.Join(setClauses, ", "))
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return model.Project{}, fmt.Errorf("update project: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return model.Project{}, fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return model.Project{}, sql.ErrNoRows
	}

	return s.getProject(id)
}

func (s *Store) getProject(id int) (model.Project, error) {
	row := s.db.QueryRow("SELECT id, name, color, sort_order, archived, created_at FROM projects WHERE id = ?", id)
	return s.scanProjectRow(row)
}

// scanProjectRow scans a single *sql.Row into a Project (mirrors scanProject for *sql.Rows).
func (s *Store) scanProjectRow(row *sql.Row) (model.Project, error) {
	var p model.Project
	var createdStr string
	var archived int
	err := row.Scan(&p.ID, &p.Name, &p.Color, &p.SortOrder, &archived, &createdStr)
	if err != nil {
		return model.Project{}, err
	}
	p.Archived = archived != 0
	p.CreatedAt, _ = time.Parse(time.RFC3339, createdStr)
	return p, nil
}

// UpdateProjectOrder sets the sort_order for projects based on the given ID order.
func (s *Store) UpdateProjectOrder(ids []int) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	for i, id := range ids {
		if _, err := tx.Exec("UPDATE projects SET sort_order = ? WHERE id = ?", i, id); err != nil {
			return fmt.Errorf("update sort_order: %w", err)
		}
	}

	return tx.Commit()
}

// DeleteProject removes a project by ID.
func (s *Store) DeleteProject(id int) error {
	result, err := s.db.Exec("DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete project: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetSetting retrieves a setting value by key.
func (s *Store) GetSetting(key string) (string, error) {
	var value string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// SetSetting stores a setting value.
func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
	return err
}

// GetAllSettings retrieves all settings as a map.
func (s *Store) GetAllSettings() (map[string]string, error) {
	rows, err := s.db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, fmt.Errorf("query settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("scan setting: %w", err)
		}
		settings[k] = v
	}
	return settings, rows.Err()
}

// RenameLabel renames a label across all todos.
func (s *Store) RenameLabel(oldName, newName string) error {
	rows, err := s.db.Query("SELECT id, labels FROM todos WHERE labels LIKE ?", "%"+oldName+"%")
	if err != nil {
		return fmt.Errorf("query todos for label rename: %w", err)
	}
	defer rows.Close()

	type todoLabels struct {
		id     int
		labels string
	}
	var updates []todoLabels
	for rows.Next() {
		var tl todoLabels
		if err := rows.Scan(&tl.id, &tl.labels); err != nil {
			return fmt.Errorf("scan todo: %w", err)
		}
		updates = append(updates, tl)
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("rows iteration: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	for _, tl := range updates {
		var labels []string
		if err := json.Unmarshal([]byte(tl.labels), &labels); err != nil {
			continue
		}
		changed := false
		for i, l := range labels {
			if l == oldName {
				labels[i] = newName
				changed = true
			}
		}
		if !changed {
			continue
		}
		labelsJSON, _ := json.Marshal(labels)
		if _, err := s.db.Exec("UPDATE todos SET labels = ?, updated_at = ? WHERE id = ?", string(labelsJSON), now, tl.id); err != nil {
			return fmt.Errorf("update todo labels: %w", err)
		}
	}

	// Also update label_order in settings
	orderJSON, _ := s.GetSetting("label_order")
	if orderJSON != "" {
		var order []string
		if err := json.Unmarshal([]byte(orderJSON), &order); err == nil {
			for i, l := range order {
				if l == oldName {
					order[i] = newName
				}
			}
			newOrderJSON, _ := json.Marshal(order)
			_ = s.SetSetting("label_order", string(newOrderJSON))
		}
	}

	return nil
}

// ListLabels returns all distinct labels across todos.
func (s *Store) ListLabels() ([]string, error) {
	rows, err := s.db.Query("SELECT DISTINCT labels FROM todos WHERE labels != '[]'")
	if err != nil {
		return nil, fmt.Errorf("query labels: %w", err)
	}
	defer rows.Close()

	labelSet := make(map[string]struct{})
	for rows.Next() {
		var labelsJSON string
		if err := rows.Scan(&labelsJSON); err != nil {
			return nil, fmt.Errorf("scan labels: %w", err)
		}
		var labels []string
		if err := json.Unmarshal([]byte(labelsJSON), &labels); err != nil {
			continue
		}
		for _, l := range labels {
			labelSet[l] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	// Sort by stored order, then append remaining labels
	orderJSON, _ := s.GetSetting("label_order")
	var order []string
	if orderJSON != "" {
		_ = json.Unmarshal([]byte(orderJSON), &order)
	}

	result := make([]string, 0, len(labelSet))
	seen := make(map[string]bool)
	for _, l := range order {
		if _, exists := labelSet[l]; exists {
			result = append(result, l)
			seen[l] = true
		}
	}
	for l := range labelSet {
		if !seen[l] {
			result = append(result, l)
		}
	}
	return result, nil
}
