import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { Award, TrendingUp, DollarSign, Zap, CheckCircle2, Trophy, Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface ModelResult {
  model_name: string;
  retrieval_score: number;
  latency_ms: number;
  cost_per_m_tokens: number;
  dimensions: number;
}

interface BenchmarkProgress {
  current_model: string;
  completed_models: number;
  total_models: number;
}

interface Experiment {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  task_type: string;
  selected_models: string[];
  results: ModelResult[];
  progress?: BenchmarkProgress | null;
  error?: string;
  created_at: string;
}

const Results = () => {
  const navigate = useNavigate();
  const experimentId = localStorage.getItem("experimentId");

  const { data: experiment, refetch } = useQuery<Experiment>({
    queryKey: ["experiment", experimentId],
    queryFn: () => fetch(`${API_URL}/experiments/${experimentId}`).then((r) => r.json()),
    enabled: !!experimentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 3000 : false;
    },
  });

  useEffect(() => {
    if (experiment?.status === "completed" || experiment?.status === "failed") {
      refetch();
    }
  }, [experiment?.status]);

  // Detect stuck experiments (pending for more than 5 minutes)
  const isStuck =
    experiment?.status === "pending" &&
    experiment.created_at &&
    Date.now() - new Date(experiment.created_at).getTime() > 5 * 60 * 1000;

  if (!experimentId) {
    return (
      <div className="min-h-screen bg-gradient-hero pt-20 pb-12 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Experiment Found</h2>
          <p className="text-muted-foreground mb-6">Start a new benchmark to see results here.</p>
          <Button variant="hero" onClick={() => navigate("/upload")}>Start New Benchmark</Button>
        </Card>
      </div>
    );
  }

  const isPending = !experiment || experiment.status === "pending" || experiment.status === "running";
  const isFailed = experiment?.status === "failed";
  const results = experiment?.results ?? [];
  const sorted = [...results].sort((a, b) => b.retrieval_score - a.retrieval_score);
  const winner = sorted[0];
  const winner2 = sorted.length > 1 ? sorted[1] : null;

  const progress = experiment?.progress;
  const totalModels = progress?.total_models ?? experiment?.selected_models?.length ?? 0;
  const completedModels = progress?.completed_models ?? (experiment?.status === "completed" ? totalModels : 0);
  const progressPct = totalModels > 0 ? (completedModels / totalModels) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Benchmark Results</h1>
          </div>
          <p className="text-xl text-muted-foreground">Based on your specific data and constraints</p>
        </div>

        {/* Loading / Progress state */}
        {isPending && (
          <Card className="p-8 shadow-elevation mb-8">
            <div className="flex items-center gap-4 mb-6">
              <Loader2 className="w-10 h-10 animate-spin text-primary flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold">
                  {experiment?.status === "running" ? "Benchmarking in Progress…" : "Queued for Benchmarking…"}
                </h2>
                <p className="text-muted-foreground">
                  {progress
                    ? `Processing model ${completedModels + 1} of ${totalModels}`
                    : "Waiting for Azure Function to pick up the job…"}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {totalModels > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>{completedModels} of {totalModels} models complete</span>
                  <span>{Math.round(progressPct)}%</span>
                </div>
                <Progress value={progressPct} className="h-3" />
              </div>
            )}

            {/* Current model */}
            {progress?.current_model && (
              <div className="p-3 bg-muted/30 rounded-lg text-sm">
                <span className="text-muted-foreground">Currently evaluating: </span>
                <span className="font-semibold">{progress.current_model}</span>
              </div>
            )}

            {/* Partial results */}
            {results.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-sm text-muted-foreground mb-3">Results so far:</h3>
                <div className="space-y-2">
                  {results.map((r) => (
                    <div key={r.model_name} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-sm">{r.model_name}</span>
                      </div>
                      <span className="text-sm font-bold text-primary">{(r.retrieval_score * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stuck warning */}
            {isStuck && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800">This benchmark seems to be taking longer than expected.</p>
                  <p className="text-yellow-700 mt-1">
                    The Azure Function may have encountered an issue. You can try starting a new benchmark
                    or check the Status page.
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Error state */}
        {isFailed && (
          <Card className="p-8 shadow-elevation mb-8 border-red-200">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-red-600 mb-3">Benchmark Failed</h2>
                <p className="text-muted-foreground mb-4">{experiment?.error ?? "An unexpected error occurred."}</p>
                {results.length > 0 && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {results.length} model(s) completed before the failure. Partial results are shown below.
                  </p>
                )}
                <Button variant="outline" onClick={() => navigate("/leaderboard")}>Try Again</Button>
              </div>
            </div>
          </Card>
        )}

        {/* Results (show when completed OR when there are partial results from a failure) */}
        {((!isPending && !isFailed) || (isFailed && results.length > 0)) && winner && (
          <>
            {/* Winner Card */}
            <Card className="p-8 mb-8 shadow-glow border-2 border-primary bg-gradient-to-br from-primary/10 via-transparent to-accent/10 relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-primary text-primary-foreground rounded-full font-bold shadow-elevation">
                  <Trophy className="w-5 h-5" />
                  Recommended
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-start gap-8">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-primary text-primary-foreground font-bold text-2xl shadow-elevation">
                      1
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold mb-1">{winner.model_name}</h2>
                      <Badge variant={winner.cost_per_m_tokens === 0 ? "outline" : "secondary"}>
                        {winner.cost_per_m_tokens === 0 ? "Open Source" : "Azure OpenAI"}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-lg text-muted-foreground mb-6">
                    This model achieved the highest relevance score on your dataset, as judged by GPT-4o-mini
                    across multiple generated queries.
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">Relevance Score</div>
                      <div className="text-2xl font-bold text-primary">{(winner.retrieval_score * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">Latency/doc</div>
                      <div className="text-2xl font-bold">{winner.latency_ms.toFixed(0)}ms</div>
                    </div>
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                      <div className="text-2xl font-bold">{winner.dimensions}</div>
                    </div>
                    <div className="p-4 bg-card rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground mb-1">Cost</div>
                      <div className="text-2xl font-bold text-accent">
                        {winner.cost_per_m_tokens === 0 ? "Free" : `$${winner.cost_per_m_tokens}/M`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Detailed Comparison */}
            <Card className="p-8 mb-6 shadow-elevation">
              <h2 className="text-2xl font-bold mb-6">Detailed Comparison</h2>
              <div className="space-y-6">
                {sorted.map((model, i) => (
                  <div key={model.model_name} className="p-6 border border-border rounded-lg hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{model.model_name}</h3>
                        {i === 0 && <Badge className="bg-primary"><Award className="w-3 h-3 mr-1" />Best Overall</Badge>}
                        {i === 1 && winner2 && winner2.cost_per_m_tokens < winner.cost_per_m_tokens && (
                          <Badge className="bg-accent text-accent-foreground"><DollarSign className="w-3 h-3 mr-1" />Most Cost-Effective</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">{(model.retrieval_score * 100).toFixed(1)}%</div>
                        <div className="text-xs text-muted-foreground">Relevance Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Retrieval Relevance</span>
                          <span className="text-sm font-semibold">{(model.retrieval_score * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={model.retrieval_score * 100} className="h-2" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Dimensions</span>
                          <span className="text-sm font-semibold">{model.dimensions}</span>
                        </div>
                        <Progress value={(model.dimensions / 3072) * 100} className="h-2" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Zap className="w-4 h-4" />Latency/doc
                        </div>
                        <span className="font-semibold">{model.latency_ms.toFixed(0)}ms</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Key Insights */}
            <Card className="p-8 mb-6 shadow-elevation">
              <h2 className="text-2xl font-bold mb-6">Key Insights</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
                  <TrendingUp className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Performance Winner</h3>
                  <p className="text-sm text-muted-foreground">
                    {winner.model_name} scored {(winner.retrieval_score * 100).toFixed(1)}% relevance on your data.
                  </p>
                </div>
                <div className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 rounded-xl border border-accent/20">
                  <DollarSign className="w-8 h-8 text-accent mb-3" />
                  <h3 className="font-semibold text-lg mb-2">Cost</h3>
                  <p className="text-sm text-muted-foreground">
                    {winner.cost_per_m_tokens === 0
                      ? `${winner.model_name} is free (runs locally).`
                      : `${winner.model_name} costs $${winner.cost_per_m_tokens}/M tokens.`}
                    {winner2 && winner2.cost_per_m_tokens < winner.cost_per_m_tokens
                      ? ` ${winner2.model_name} is cheaper at ${winner2.cost_per_m_tokens === 0 ? "free" : `$${winner2.cost_per_m_tokens}/M`}.`
                      : ""}
                  </p>
                </div>
                <div className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border border-border">
                  <CheckCircle2 className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-2">LLM Judge Validation</h3>
                  <p className="text-sm text-muted-foreground">
                    Azure OpenAI GPT-4o-mini evaluated retrieved documents for relevance across auto-generated queries.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/leaderboard")}>
            Try Different Models
          </Button>
          <Button variant="hero" size="lg" onClick={() => navigate("/dashboard")}>
            View Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Results;
