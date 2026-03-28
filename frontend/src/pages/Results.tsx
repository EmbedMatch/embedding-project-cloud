import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Award,
  Loader2,
  AlertCircle,
  BarChart3,
  Zap,
  Target,
  Cpu,
  Trophy,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import {
  type ExperimentResult,
  type ExperimentProgress,
  type ExperimentSummary,
  getExperiment,
  getExperimentProgress,
  getExperimentSummary,
} from "@/lib/api";

type ModelResult = NonNullable<ExperimentResult["results"]>[number];

// ─── Data-driven progress component ─────────────────────────────────────────
interface BenchmarkProgressProps {
  status: string;
  progress: ExperimentProgress | null;
}

function BenchmarkProgress({ status, progress }: BenchmarkProgressProps) {
  const [displayPct, setDisplayPct] = useState(0);

  const completedModels = progress?.completed_models ?? 0;
  const totalModels = progress?.total_models ?? 5;
  const isIndeterminate = status === "created" || status === "loading" ||
    (status === "processing" && completedModels === 0);

  // Compute real progress percentage
  const targetPct = status === "completed" ? 100
    : status === "created" || status === "loading" ? 5
    : completedModels === 0 ? 10
    : Math.round(15 + (completedModels / totalModels) * 80);

  // Smooth animation toward target
  useEffect(() => {
    const t = setTimeout(() => {
      setDisplayPct((prev) => {
        if (prev < targetPct) return Math.min(prev + 1, targetPct);
        return prev;
      });
    }, 18);
    return () => clearTimeout(t);
  }, [displayPct, targetPct]);

  // Build dynamic stage list
  const stages: { label: string; state: "done" | "active" | "pending" }[] = [];

  // Stage 1: Queued
  const queuedDone = status !== "created" && status !== "loading";
  stages.push({
    label: "Queued",
    state: queuedDone ? "done" : status === "created" ? "active" : "pending",
  });

  // Stage 2: LLM prep
  const prepDone = completedModels > 0;
  stages.push({
    label: "Preparing evaluation data",
    state: prepDone ? "done" : queuedDone ? "active" : "pending",
  });

  // Stage 3+: Per-model
  const perModel = progress?.per_model ?? [];
  let foundActive = false;
  for (const m of perModel) {
    const isDone = m.status === "done" || m.status === "failed";
    const isNext = !isDone && prepDone && !foundActive;
    if (isNext) foundActive = true;
    stages.push({
      label: m.model,
      state: isDone ? "done" : isNext ? "active" : "pending",
    });
  }

  // If no per_model data yet, show a placeholder
  if (perModel.length === 0 && queuedDone) {
    stages.push({ label: `Benchmarking ${totalModels} models`, state: "pending" });
  }

  // Subtitle text
  const subtitle = status === "loading" ? "Loading experiment..."
    : status === "created" ? "Queued — waiting for worker..."
    : completedModels === 0 ? "Preparing evaluation data — this may take a minute."
    : `Benchmarking models — ${completedModels} of ${totalModels} complete.`;

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-2xl mx-auto px-6">
        <Card className="p-10 shadow-elevation text-center">
          {/* Animated ring */}
          <div className="relative mx-auto mb-8 w-28 h-28">
            <svg viewBox="0 0 100 100" className={`w-full h-full -rotate-90 ${isIndeterminate ? "animate-pulse" : ""}`}>
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - displayPct / 100)}`}
                style={{ transition: "stroke-dashoffset 0.4s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{displayPct}%</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold mb-2">Benchmarking in Progress</h2>
          <p className="text-muted-foreground mb-8">{subtitle}</p>

          {/* Stage list */}
          <div className="space-y-3 text-left">
            {stages.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                {s.state === "done" ? (
                  <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                ) : s.state === "active" ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    s.state !== "pending" ? "text-foreground font-medium" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Linear progress bar */}
          <div className="mt-8 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${displayPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Status: <span className="font-mono">{status}</span>
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─── Score bar component ──────────────────────────────────────────────────────
function ScoreBar({
  value,
  max = 100,
  color = "primary",
  animate = true,
}: {
  value: number;
  max?: number;
  color?: "primary" | "accent" | "warning";
  animate?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const pct = Math.min((value / max) * 100, 100);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), animate ? 100 : 0);
    return () => clearTimeout(t);
  }, [pct, animate]);

  const gradients: Record<string, string> = {
    primary: "from-primary to-[hsl(240,80%,55%)]",
    accent: "from-accent to-[hsl(180,85%,55%)]",
    warning: "from-[hsl(38,92%,50%)] to-[hsl(45,93%,47%)]",
  };

  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${gradients[color]} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ─── Per-model detail card ────────────────────────────────────────────────────
function ModelCard({
  r,
  rank,
  isBest,
}: {
  r: ModelResult;
  rank: number;
  isBest: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const relevancePct = (r.relevance_score / 10) * 100;

  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isBest
          ? "border-accent/60 bg-accent/5 shadow-[0_0_24px_hsl(180_85%_45%/0.12)]"
          : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
              isBest
                ? "bg-accent text-accent-foreground"
                : rank === 2
                ? "bg-muted text-foreground"
                : "bg-muted/60 text-muted-foreground"
            }`}
          >
            {isBest ? <Trophy className="w-4 h-4" /> : `#${rank}`}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate" title={r.model}>{r.model}</div>
            {isBest && (
              <Badge className="mt-1 bg-accent/20 text-accent border-accent/30 text-xs">
                Best Model
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Toggle details"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Score rows */}
      <div className="px-5 pb-5 space-y-4">
        {r.mrr !== undefined && (
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3" /> Mean Reciprocal Rank (MRR)
              </span>
              <span className="font-bold text-foreground">
                {r.mrr.toFixed(3)}
              </span>
            </div>
            <ScoreBar value={r.mrr * 100} max={100} color="primary" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> {r.mrr !== undefined ? "Recall@5" : "Retrieval Accuracy"}
              </span>
              <span className="font-bold text-foreground">
                {((r.recall_at_5 ?? r.retrieval_accuracy) * 100).toFixed(1)}%
              </span>
            </div>
            <ScoreBar value={(r.recall_at_5 ?? r.retrieval_accuracy) * 100} max={100} color="accent" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" /> Relevance
              </span>
              <span className="font-bold text-foreground">
                {r.relevance_score}/10
              </span>
            </div>
            <ScoreBar value={relevancePct} max={100} color="warning" />
          </div>
        </div>
        <div className="flex justify-between text-xs pt-1">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap className="w-3 h-3" /> Latency
          </span>
          <span className="font-mono font-medium">{r.latency_ms?.toFixed(0)} ms</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="w-3 h-3" /> Dimensions
          </span>
          <span className="font-mono font-medium">{r.dimensions}</span>
        </div>
      </div>

      {/* Expanded judge scores */}
      {expanded && r.judge_scores && r.judge_scores.length > 0 && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Judge Evaluations
          </div>
          {r.judge_scores.slice(0, 5).map((js, i) => (
            <div key={i} className="text-xs p-3 bg-muted/30 rounded-lg">
              <div className="flex items-start justify-between mb-1 gap-2">
                <span className="font-medium truncate" title={js.query}>{js.query}</span>
                <Badge
                  className={`shrink-0 text-xs ${
                    js.score >= 8
                      ? "bg-accent/20 text-accent"
                      : js.score >= 5
                      ? "bg-primary/20 text-primary"
                      : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {js.score}/10
                </Badge>
              </div>
              <p className="text-muted-foreground line-clamp-2">{js.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Visual comparison chart (pure CSS) ──────────────────────────────────────
function ComparisonChart({ results }: { results: ModelResult[] }) {
  const valid = results.filter((r) => !r.error);
  const getScore = (r: ModelResult) => r.mrr ?? r.retrieval_accuracy;
  const maxScore = Math.max(...valid.map(getScore));

  return (
    <div className="space-y-3">
      {valid.map((r, i) => {
        const score = getScore(r);
        const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-36 text-xs font-medium truncate shrink-0 text-right">
              {r.model.split("/").pop() ?? r.model}
            </div>
            <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent rounded transition-all duration-700 ease-out flex items-center justify-end pr-2"
                style={{ width: `${pct}%` }}
              >
                <span className="text-xs font-bold text-white">
                  {r.mrr !== undefined ? score.toFixed(3) : `${(score * 100).toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Results page ────────────────────────────────────────────────────────
const Results = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const experimentId = searchParams.get("id");

  const [experiment, setExperiment] = useState<ExperimentResult | null>(null);
  const [progress, setProgress] = useState<ExperimentProgress | null>(null);
  const [summary, setSummary] = useState<ExperimentSummary | null>(null);
  const [error, setError] = useState<string | null>(
    experimentId ? null : "No experiment ID provided",
  );

  useEffect(() => {
    if (!experimentId) return;
    let active = true;
    let hasFetchedSummary = false;
    let isFirstRun = true;

    const poll = async () => {
      if (isFirstRun) {
        setSummary(null);
        isFirstRun = false;
      }
      try {
        const [data, prog] = await Promise.all([
          getExperiment(experimentId),
          getExperimentProgress(experimentId),
        ]);
        if (!active) return;
        setExperiment(data);
        setProgress(prog);

        if (data.status === "completed" && !hasFetchedSummary) {
          try {
            const summaryData = await getExperimentSummary(experimentId);
            if (!active) return;
            setSummary(summaryData);
            hasFetchedSummary = true;
          } catch {
            // Keep UI fallback ranking if summary is not yet available.
          }
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load experiment");
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [experimentId]);

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-6">
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Error</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate("/upload")}>Try Again</Button>
          </Card>
        </div>
      </div>
    );
  }

  // ── Loading / queued / processing → show progress UI ──
  if (!experiment || experiment.status === "created" || experiment.status === "processing") {
    return (
      <BenchmarkProgress
        status={experiment?.status ?? "loading"}
        progress={progress}
      />
    );
  }

  // ── Failed ──
  if (experiment.status === "failed") {
    return (
      <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-6">
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-2xl font-bold mb-2">Benchmark Failed</h2>
            <p className="text-muted-foreground mb-4">
              Something went wrong while processing your experiment.
            </p>
            <Button onClick={() => navigate("/upload")}>Try Again</Button>
          </Card>
        </div>
      </div>
    );
  }

  const results = experiment.results ?? [];
  const valid = results.filter((r) => !r.error);
  const bestRetrieval = valid.length > 0
    ? Math.max(...valid.map((r) => r.retrieval_accuracy * 100))
    : null;
  const bestRelevance = valid.length > 0
    ? Math.max(...valid.map((r) => r.relevance_score))
    : null;
  const fastestLatency = valid.length > 0
    ? Math.min(...valid.map((r) => r.latency_ms))
    : null;
  const mrrValues = valid
    .map((r) => r.mrr)
    .filter((mrr): mrr is number => mrr != null);
  const recallAt5Values = valid
    .map((r) => r.recall_at_5)
    .filter((recall): recall is number => recall != null);
  const bestMrr = mrrValues.length > 0 ? Math.max(...mrrValues) : null;
  const bestRecallAt5 = recallAt5Values.length > 0 ? Math.max(...recallAt5Values) : null;
  const getScore = (r: ModelResult) => r.mrr ?? r.retrieval_accuracy;

  const rankByModel = new Map(
    (summary?.ranked_models ?? []).map((r) => [r.model, r.rank]),
  );
  const compositeByModel = new Map(
    (summary?.ranked_models ?? []).map((r) => [r.model, r.composite_score]),
  );
  const bestModelName =
    summary?.recommendation?.model ??
    (valid.length > 0
      ? valid.reduce((a, b) =>
          getScore(a) > getScore(b) ? a : b,
        ).model
      : null);

  const sorted = [...valid].sort((a, b) => {
    const rankA = rankByModel.get(a.model);
    const rankB = rankByModel.get(b.model);
    if (rankA != null && rankB != null) return rankA - rankB;
    if (rankA != null) return -1;
    if (rankB != null) return 1;
    return getScore(b) - getScore(a);
  });
  const failed = results.filter((r) => r.error);

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-16">
      <div className="max-w-6xl mx-auto px-6">
        {/* ── Page header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Benchmark Results</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Dataset: {experiment.name} {/* &mdash;{" "}
            <span className="text-sm font-mono">{experimentId}</span> */}
          </p>
        </div>

        {/* ── Backend post-benchmark recommendation ── */}
        {summary?.recommendation && (
          <Card className="p-6 mb-8 shadow-elevation border-accent/40 bg-accent/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">
                  Recommended after benchmarking your selected models
                </div>
                <div className="text-2xl font-bold text-accent">
                  {summary.recommendation.model}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Composite score: {summary.recommendation.composite_score}/10
                </p>
              </div>
            </div>
            <p className="text-sm mt-3">{summary.recommendation.reason}</p>
          </Card>
        )}

        {/* ── Summary stats row ── */}
        {valid.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Models Tested",
                value: results.length,
                icon: Cpu,
                color: "text-primary",
              },
              {
                label: bestMrr != null ? "Best MRR" : "Best Retrieval",
                value: bestMrr != null
                  ? bestMrr.toFixed(3)
                  : bestRetrieval == null
                  ? "—"
                  : `${bestRetrieval.toFixed(1)}%`,
                icon: Target,
                color: "text-accent",
              },
              {
                label: bestRecallAt5 != null ? "Best Recall@5" : "Best Relevance",
                value: bestRecallAt5 != null
                  ? `${(bestRecallAt5 * 100).toFixed(1)}%`
                  : bestRelevance == null
                  ? "—"
                  : `${bestRelevance}/10`,
                icon: BarChart3,
                color: "text-primary",
              },
              {
                label: "Fastest Latency",
                value: fastestLatency == null ? "—" : `${fastestLatency.toFixed(0)} ms`,
                icon: Zap,
                color: "text-accent",
              },
            ].map((s) => (
              <Card key={s.label} className="p-5 shadow-elevation">
                <s.icon className={`w-6 h-6 ${s.color} mb-3`} />
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </Card>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left: model cards ── */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-bold mb-2">
              Per-Model Results
              {sorted.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({sorted.length} models)
                </span>
              )}
            </h2>

            {sorted.map((r, idx) => (
              <ModelCard
                key={r.model}
                r={r}
                rank={idx + 1}
                isBest={r.model === bestModelName}
              />
            ))}

            {/* Failed models */}
            {failed.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-center gap-2 mb-3 text-destructive font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  {failed.length} model(s) failed
                </div>
                {failed.map((r, i) => (
                  <div key={i} className="text-sm text-muted-foreground">
                    <span className="font-mono font-medium text-foreground">
                      {r.model}
                    </span>
                    : {r.error}
                  </div>
                ))}
              </div>
            )}

            {results.length === 0 && (
              <Card className="p-8 text-center text-muted-foreground">
                No results available yet.
              </Card>
            )}
          </div>

          {/* ── Right: comparison chart + summary table ── */}
          <div className="space-y-6">
            {/* Horizontal bar chart */}
            {sorted.length > 0 && (
              <Card className="p-6 shadow-elevation">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Performance Comparison
                </h3>
                <ComparisonChart results={results} />
              </Card>
            )}

            {/* Summary table */}
            {sorted.length > 0 && (
              <Card className="p-6 shadow-elevation overflow-x-auto">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" />
                  {summary ? "Composite Leaderboard" : "Leaderboard"}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-3">#</th>
                      <th className="text-left py-2 pr-3">Model</th>
                      {summary && (
                        <th className="text-center py-2 pr-3">Comp.</th>
                      )}
                      <th className="text-center py-2 pr-3">MRR</th>
                      <th className="text-center py-2 pr-3">Acc.</th>
                      <th className="text-center py-2 pr-3">R@5</th>
                      <th className="text-center py-2">Rel.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr
                        key={r.model}
                        className={`border-b border-border/50 last:border-0 ${
                          i === 0 ? "font-bold" : ""
                        }`}
                      >
                        <td className="py-2 pr-3 text-muted-foreground">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </td>
                        <td className="py-2 pr-3 font-mono truncate max-w-[80px]">
                          {r.model.split("/").pop() ?? r.model}
                        </td>
                        {summary && (
                          <td className="py-2 pr-3 text-center">
                            {(compositeByModel.get(r.model) ?? 0).toFixed(2)}
                          </td>
                        )}
                        <td className="py-2 pr-3 text-center text-[10px] md:text-xs">
                          {r.mrr !== undefined ? r.mrr.toFixed(3) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-center">
                          {(r.retrieval_accuracy * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 pr-3 text-center text-[10px] md:text-xs text-muted-foreground">
                          {r.recall_at_5 !== undefined ? `${(r.recall_at_5 * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="py-2 text-center">{r.relevance_score}/10</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-4 mt-10">
          <Button variant="hero" size="lg" onClick={() => navigate("/upload")}>
            New Benchmark
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Results;
