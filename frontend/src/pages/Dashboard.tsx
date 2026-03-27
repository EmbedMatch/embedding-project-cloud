import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Plus,
  TrendingUp,
  Clock,
  BarChart3,
  FileText,
  Award,
  Loader2,
  Trophy,
  Target,
  Zap,
  AlertCircle,
} from "lucide-react";
import { type ExperimentResult, listExperiments } from "@/lib/api";

// ─── Tiny animated score bar ──────────────────────────────────────────────────
function MiniBar({ pct, color = "primary" }: { pct: number; color?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);
  const grad =
    color === "accent"
      ? "from-accent to-[hsl(180,85%,55%)]"
      : "from-primary to-[hsl(240,80%,55%)]";
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="p-6 border border-border rounded-lg animate-pulse space-y-3">
      <div className="h-5 bg-muted rounded w-2/3" />
      <div className="h-3 bg-muted rounded w-1/3" />
      <div className="h-8 bg-muted rounded w-full mt-4" />
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-accent/20 text-accent border-accent/30",
    processing: "bg-primary/20 text-primary border-primary/30",
    failed: "bg-destructive/20 text-destructive border-destructive/30",
    pending: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={`capitalize text-xs ${map[status] ?? map.pending}`}>
      {status === "processing" && (
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      )}
      {status}
    </Badge>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<ExperimentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await listExperiments();
        if (active) setExperiments(data);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : "Failed to load experiments");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    // Poll every 10 s for running experiments
    const interval = setInterval(load, 10_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // ── Helpers ──
  // Old experiments stored results as a single dict; normalise to array.
  const toArray = (r: ExperimentResult["results"]) =>
    Array.isArray(r) ? r : r ? [r] : [];

  // ── Computed stats ──
  const completed = experiments.filter((e) => e.status === "completed");
  const allModels = new Set(
    completed.flatMap((e) => toArray(e.results).map((r) => r.model)),
  );
  const allAccuracies = completed.flatMap((e) =>
    toArray(e.results)
      .filter((r) => !r.error && r.retrieval_accuracy != null)
      .map((r) => r.retrieval_accuracy * 100),
  );
  const avgScore =
    allAccuracies.length > 0
      ? allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length
      : null;

  const stats = [
    {
      label: "Total Experiments",
      value: loading ? "—" : experiments.length.toString(),
      icon: BarChart3,
      color: "text-primary",
    },
    {
      label: "Models Tested",
      value: loading ? "—" : allModels.size.toString(),
      icon: TrendingUp,
      color: "text-accent",
    },
    {
      label: "Avg. Retrieval Acc.",
      value: loading ? "—" : avgScore !== null ? `${avgScore.toFixed(1)}%` : "N/A",
      icon: Award,
      color: "text-primary",
    },
    {
      label: "Completed Runs",
      value: loading ? "—" : completed.length.toString(),
      icon: Target,
      color: "text-accent",
    },
  ];

  // Sort: most recent first
  const sorted = [...experiments].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Header ── */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <LayoutDashboard className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Dashboard</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Track your experiments and model performance
            </p>
          </div>
          <Button variant="hero" size="lg" onClick={() => navigate("/upload")}>
            <Plus className="w-5 h-5 mr-2" />
            New Benchmark
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-6 shadow-elevation">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-7 h-7 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* ── Recent Experiments ── */}
        <Card className="p-8 shadow-elevation mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Experiments</h2>
            {!loading && experiments.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {experiments.length} total
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {!loading && !error && experiments.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No experiments yet</p>
              <p className="text-sm mt-1">
                Run your first benchmark to see results here.
              </p>
              <Button
                className="mt-6"
                variant="hero"
                onClick={() => navigate("/upload")}
              >
                <Plus className="w-4 h-4 mr-2" /> New Benchmark
              </Button>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-4">
              {sorted.map((exp) => {
                const validResults = toArray(exp.results).filter((r) => !r.error && r.retrieval_accuracy != null);
                const best =
                  validResults.length > 0
                    ? validResults.reduce((a, b) =>
                        a.retrieval_accuracy > b.retrieval_accuracy ? a : b,
                      )
                    : null;
                const topAccuracy = best
                  ? (best.retrieval_accuracy * 100).toFixed(1)
                  : null;

                return (
                  <div
                    key={exp.id}
                    className="p-6 border border-border rounded-xl hover:border-primary/30 hover:shadow-elevation transition-all cursor-pointer group"
                    onClick={() =>
                      exp.status === "completed"
                        ? navigate(`/results?id=${exp.id}`)
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors truncate">
                          {exp.name}
                        </h3>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(exp.created_at).toLocaleDateString()}
                          </span>
                          {validResults.length > 0 && (
                            <span className="flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              {validResults.length} models
                            </span>
                          )}
                          <span className="font-mono opacity-60">
                            {exp.dataset_type}
                          </span>
                        </div>
                      </div>
                      <StatusBadge status={exp.status} />
                    </div>

                    {/* Per-model mini bars */}
                    {validResults.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {[...validResults]
                          .sort((a, b) => b.retrieval_accuracy - a.retrieval_accuracy)
                          .slice(0, 3)
                          .map((r, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs font-mono text-muted-foreground w-32 truncate shrink-0">
                                {r.model.split("/").pop() ?? r.model}
                              </span>
                              <div className="flex-1">
                                <MiniBar
                                  pct={r.retrieval_accuracy * 100}
                                  color={i === 0 ? "accent" : "primary"}
                                />
                              </div>
                              <span className="text-xs font-bold w-12 text-right shrink-0">
                                {(r.retrieval_accuracy * 100).toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        {validResults.length > 3 && (
                          <p className="text-xs text-muted-foreground text-right">
                            +{validResults.length - 3} more models
                          </p>
                        )}
                      </div>
                    )}

                    {/* Best model summary */}
                    {best && (
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-accent" />
                          <div>
                            <div className="text-xs text-muted-foreground">
                              Best Model
                            </div>
                            <div className="text-sm font-semibold">{best.model}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Target className="w-3 h-3" /> Retrieval
                          </div>
                          <div className="text-xl font-bold text-primary">
                            {topAccuracy}%
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                            <Zap className="w-3 h-3" /> Latency
                          </div>
                          <div className="text-xl font-bold text-accent">
                            {best.latency_ms?.toFixed(0)} ms
                          </div>
                        </div>
                      </div>
                    )}

                    {exp.status === "processing" && (
                      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full animate-[progress-pulse_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Quick Actions ── */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card
            className="p-6 shadow-elevation hover:shadow-glow transition-all cursor-pointer group"
            onClick={() => navigate("/upload")}
          >
            <Plus className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-semibold mb-2">New Benchmark</h3>
            <p className="text-sm text-muted-foreground">
              Start a new experiment with your data
            </p>
          </Card>

          <Card
            className="p-6 shadow-elevation hover:shadow-glow transition-all cursor-pointer group"
            onClick={() => navigate("/leaderboard")}
          >
            <TrendingUp className="w-10 h-10 text-accent mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-semibold mb-2">Browse Models</h3>
            <p className="text-sm text-muted-foreground">
              Explore MTEB leaderboard models
            </p>
          </Card>

          <Card className="p-6 shadow-elevation hover:shadow-glow transition-all cursor-pointer group">
            <FileText className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-semibold mb-2">Documentation</h3>
            <p className="text-sm text-muted-foreground">
              Learn how to optimize your benchmarks
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
