import type { Project, ProjectCreateRequest, ProjectUpdateRequest } from "../types/api";
import { get, post, put, del } from "./client";

export function fetchProjects(): Promise<Project[]> {
  return get<Project[]>("/projects");
}

export function fetchArchivedProjects(): Promise<Project[]> {
  return get<Project[]>("/projects/archived");
}

export function createProject(data: ProjectCreateRequest): Promise<Project> {
  return post<Project>("/projects", data);
}

export function updateProject(id: number, data: ProjectUpdateRequest): Promise<Project> {
  return put<Project>(`/projects/${id}`, data);
}

export function deleteProject(id: number): Promise<void> {
  return del(`/projects/${id}`);
}
