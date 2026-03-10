import { get } from "./client";

export function fetchLabels(): Promise<string[]> {
  return get<string[]>("/labels");
}
