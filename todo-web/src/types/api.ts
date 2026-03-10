export type Priority = "none" | "low" | "medium" | "high";

export type Todo = {
  id: number;
  task_name: string;
  description?: string;
  priority: Priority;
  date?: string;
  deadline?: string;
  reminder_at?: string;
  labels: string[];
  project_id?: number;
  done: boolean;
  created_at: string;
  updated_at: string;
};

export type TodoCreateRequest = {
  task_name: string;
  description?: string;
  priority: Priority;
  date?: string;
  deadline?: string;
  reminder_at?: string;
  labels?: string[];
  project_id?: number;
};

export type TodoUpdateRequest = Partial<TodoCreateRequest> & {
  done?: boolean;
};

export type Project = {
  id: number;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
};

export type ProjectCreateRequest = {
  name: string;
  color?: string;
};

export type ProjectUpdateRequest = {
  name?: string;
  color?: string;
  archived?: boolean;
};

export type ApiError = {
  error: string;
};

export type AppSettings = {
  ai_provider: string;
  ai_model: string;
  ai_api_key: string;
  ai_key_set: boolean;
  ai_base_url: string;
  label_order: string[];
};

export type AIAnalyzeRequest = {
  message: string;
  url?: string;
  image?: string;
  image_type?: string;
};

export type AIAction = {
  type: "create" | "update" | "complete" | "delete" | "create_project" | "update_project" | "delete_project";
  todo_id?: number;
  task_name?: string;
  description?: string;
  priority?: Priority;
  date?: string;
  deadline?: string;
  labels?: string[];
  project_id?: number;
  project_name?: string;
  project_color?: string;
};

export type AIAnalyzeResponse = {
  summary: string;
  actions: AIAction[];
  todos: Todo[];
};
