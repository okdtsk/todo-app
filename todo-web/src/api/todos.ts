import type { Todo, TodoCreateRequest, TodoUpdateRequest } from "../types/api";
import { get, post, put, del } from "./client";

export type TodoQueryParams = {
  project_id?: number;
  label?: string;
  priority?: string;
  done?: boolean;
  date?: string;
};

function buildQuery(params?: TodoQueryParams): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of entries) {
    qs.set(k, String(v));
  }
  return `?${qs.toString()}`;
}

export function fetchTodos(params?: TodoQueryParams): Promise<Todo[]> {
  return get<Todo[]>(`/todos${buildQuery(params)}`);
}

export function createTodo(data: TodoCreateRequest): Promise<Todo> {
  return post<Todo>("/todos", data);
}

export function updateTodo(id: number, data: TodoUpdateRequest): Promise<Todo> {
  return put<Todo>(`/todos/${id}`, data);
}

export function deleteTodo(id: number): Promise<void> {
  return del(`/todos/${id}`);
}

export function reorderTodos(ids: number[]): Promise<void> {
  return put<void>("/todos/order", { ids });
}
