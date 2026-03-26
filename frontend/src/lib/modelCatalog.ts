export interface Model {
  id: string;
  name: string;
  organization: string;
  size: number;
  cost: number;
  mtebScore: number;
  retrievalScore: number;
  classificationScore: number;
}

export interface ModelConstraints {
  maxSize: number;
  maxCost: number;
  minPerformance: number;
}

export const DEFAULT_CONSTRAINTS: ModelConstraints = {
  maxSize: 500,
  maxCost: 10,
  minPerformance: 70,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const parseNumericParam = (
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
};

export const parseConstraintsFromParams = (
  params: URLSearchParams,
): ModelConstraints => ({
  maxSize: parseNumericParam(
    params.get("max_size"),
    DEFAULT_CONSTRAINTS.maxSize,
    50,
    2000,
  ),
  maxCost: parseNumericParam(
    params.get("max_cost"),
    DEFAULT_CONSTRAINTS.maxCost,
    1,
    50,
  ),
  minPerformance: parseNumericParam(
    params.get("min_performance"),
    DEFAULT_CONSTRAINTS.minPerformance,
    50,
    95,
  ),
});

export const modelMatchesConstraints = (
  model: Model,
  constraints: ModelConstraints,
): boolean =>
  model.size <= constraints.maxSize &&
  model.cost <= constraints.maxCost &&
  model.mtebScore >= constraints.minPerformance;

// Keep this list aligned with backend SUPPORTED_MODELS.
export const availableModels: Model[] = [
  {
    id: "text-embedding-ada-002",
    name: "Ada 002",
    organization: "Azure OpenAI",
    size: 350,
    cost: 0.1,
    mtebScore: 81.0,
    retrievalScore: 83.5,
    classificationScore: 78.3,
  },
  {
    id: "text-embedding-3-large",
    name: "Embedding 3 Large",
    organization: "Azure OpenAI",
    size: 800,
    cost: 0.13,
    mtebScore: 87.2,
    retrievalScore: 91.5,
    classificationScore: 85.1,
  },
  {
    id: "all-MiniLM-L6-v2",
    name: "MiniLM L6 v2",
    organization: "Sentence Transformers",
    size: 80,
    cost: 0,
    mtebScore: 78.9,
    retrievalScore: 76.4,
    classificationScore: 81.2,
  },
  {
    id: "bge-base-en-v1.5",
    name: "BGE Base v1.5",
    organization: "BAAI",
    size: 109,
    cost: 0,
    mtebScore: 86.5,
    retrievalScore: 88.3,
    classificationScore: 84.2,
  },
  {
    id: "bge-small-en-v1.5",
    name: "BGE Small v1.5",
    organization: "BAAI",
    size: 33,
    cost: 0,
    mtebScore: 84.0,
    retrievalScore: 85.1,
    classificationScore: 82.0,
  },
];
