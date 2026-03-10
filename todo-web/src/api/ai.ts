import { post } from "./client";
import type { AIAnalyzeRequest, AIAnalyzeResponse } from "../types/api";

export function analyzeWithAI(data: AIAnalyzeRequest): Promise<AIAnalyzeResponse> {
  return post<AIAnalyzeResponse>("/ai/analyze", data);
}
