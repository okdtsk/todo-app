import { get, put } from "./client";
import type { AppSettings } from "../types/api";

export function fetchSettings(): Promise<AppSettings> {
  return get<AppSettings>("/settings");
}

export function updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
  return put<AppSettings>("/settings", data);
}

export function reorderProjects(ids: number[]): Promise<void> {
  return put<void>("/projects/order", ids);
}

export function renameLabel(oldName: string, newName: string): Promise<void> {
  return put<void>("/labels/rename", { old_name: oldName, new_name: newName });
}

export { updateProject, deleteProject } from "./projects";
