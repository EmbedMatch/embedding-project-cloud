const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function uploadFile(file: File): Promise<{ blob_name: string; url: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/uploads/`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof err.detail === "string" ? err.detail : err.detail?.detail || JSON.stringify(err.detail);
    throw new Error(detail || "Upload failed");
  }
  return res.json();
}

export async function createExperiment(data: {
  name: string;
  blob_name: string;
  dataset_type: string;
  description?: string;
  models?: string[];
}): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_URL}/experiments/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = typeof err.detail === "string" ? err.detail : err.detail?.detail || JSON.stringify(err.detail);
    throw new Error(detail || "Failed to create experiment");
  }
  return res.json();
}

export interface ExperimentResult {
  id: string;
  name: string;
  status: string;
  blob_name: string;
  dataset_type: string;
  created_at: string;
  models?: string[];
  results:
  | {
    model: string;
    num_texts: number;
    dimensions: number;
    latency_ms: number;
    relevance_score: number;
    retrieval_accuracy: number;
    mrr?: number;
    recall_at_1?: number;
    recall_at_5?: number;
    recall_at_10?: number;
    pool_size?: number;
    eval_size?: number;
    judge_scores: {
      query: string;
      document_preview: string;
      score: number;
      reason: string;
    }[];
    error?: string;
  }[]
  | null;
}

export interface ExperimentSummary {
  id: string;
  status: string;
  ranked_models: {
    model: string;
    num_texts?: number;
    dimensions?: number;
    latency_ms?: number;
    relevance_score?: number;
    retrieval_accuracy?: number;
    composite_score: number;
    rank: number;
  }[];
  recommendation: {
    model: string;
    composite_score: number;
    relevance_score?: number;
    retrieval_accuracy?: number;
    latency_ms?: number;
    reason: string;
  } | null;
  message?: string;
}

export async function getExperiment(id: string): Promise<ExperimentResult> {
  const res = await fetch(`${API_URL}/experiments/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Experiment not found");
  }
  return res.json();
}

export async function getExperimentSummary(id: string): Promise<ExperimentSummary> {
  const res = await fetch(`${API_URL}/experiments/${id}/summary`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to load summary");
  }
  return res.json();
}

export interface ExperimentProgress {
  id: string;
  status: string;
  progress_percent: number;
  completed_models: number;
  total_models: number;
  per_model: { model: string; status: string }[];
  updated_at: string;
}

export async function getExperimentProgress(id: string): Promise<ExperimentProgress> {
  const res = await fetch(`${API_URL}/experiments/${id}/progress`);
  if (!res.ok) throw new Error("Failed to get progress");
  return res.json();
}

export async function listExperiments(): Promise<ExperimentResult[]> {
  const res = await fetch(`${API_URL}/experiments/`);
  if (!res.ok) throw new Error("Failed to list experiments");
  return res.json();
}
