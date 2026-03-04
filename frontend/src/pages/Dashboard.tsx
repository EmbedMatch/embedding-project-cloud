import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Plus, TrendingUp, Clock, BarChart3, FileText, Award, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface ModelResult {
  model_name: string;
  retrieval_score: number;
}

interface Experiment {
  id: string;
  status: string;
  created_at: string;
  task_type: string;
  selected_models: string[];
  results: ModelResult[];
}

const Dashboard = () => {
  const navigate = useNavigate();

  const { data: experiments = [], isLoading } = useQuery<Experiment[]>({
    queryKey: ["experiments"],
    queryFn: () => fetch(`${API_URL}/experiments/`).then((r) => r.json()),
  });

  const completed = experiments.filter((e) => e.status === "completed");
  const totalModels = experiments.reduce((sum, e) => sum + (e.selected_models?.length ?? 0), 0);
  const avgScore =
    completed.length > 0
      ? completed.reduce((sum, e) => {
          const best = [...(e.results ?? [])].sort((a, b) => b.retrieval_score - a.retrieval_score)[0];
          return sum + (best?.retrieval_score ?? 0);
        }, 0) / completed.length
      : 0;

  const stats = [
    { label: "Total Experiments", value: String(experiments.length), icon: BarChart3, color: "text-primary" },
    { label: "Models Tested", value: String(totalModels), icon: TrendingUp, color: "text-accent" },
    { label: "Avg. Best Score", value: completed.length > 0 ? `${(avgScore * 100).toFixed(1)}%` : "—", icon: Award, color: "text-primary" },
    { label: "Completed", value: String(completed.length), icon: FileText, color: "text-accent" },
  ];

  const handleExperimentClick = (experiment: Experiment) => {
    localStorage.setItem("experimentId", experiment.id);
    navigate("/results");
  };

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <LayoutDashboard className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Dashboard</h1>
            </div>
            <p className="text-xl text-muted-foreground">Track your experiments and model performance</p>
          </div>
          <Button variant="hero" size="lg" onClick={() => navigate("/upload")}>
            <Plus className="w-5 h-5 mr-2" />New Benchmark
          </Button>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-6 shadow-elevation">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </Card>
          ))}
        </div>

        <Card className="p-8 shadow-elevation">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Experiments</h2>
          </div>

          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
              <p className="text-muted-foreground">Loading experiments…</p>
            </div>
          )}

          {!isLoading && experiments.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>No experiments yet. Start by uploading your data.</p>
            </div>
          )}

          <div className="space-y-4">
            {experiments.map((experiment) => {
              const bestResult = [...(experiment.results ?? [])].sort((a, b) => b.retrieval_score - a.retrieval_score)[0];
              const statusColor =
                experiment.status === "completed"
                  ? "bg-accent text-accent-foreground"
                  : experiment.status === "failed"
                  ? "bg-red-100 text-red-800"
                  : "bg-yellow-100 text-yellow-800";

              return (
                <div
                  key={experiment.id}
                  className="p-6 border border-border rounded-lg hover:border-primary/30 hover:shadow-elevation transition-all cursor-pointer"
                  onClick={() => handleExperimentClick(experiment)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2 capitalize">{experiment.task_type} Benchmark</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {new Date(experiment.created_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          {experiment.selected_models?.length ?? 0} models
                        </div>
                      </div>
                    </div>
                    <Badge className={statusColor}>{experiment.status}</Badge>
                  </div>

                  {bestResult && (
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Best Model</div>
                        <div className="font-semibold">{bestResult.model_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground mb-1">Relevance Score</div>
                        <div className="text-2xl font-bold text-primary">
                          {(bestResult.retrieval_score * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <Card className="p-6 shadow-elevation hover:shadow-glow transition-all cursor-pointer group" onClick={() => navigate("/upload")}>
            <Plus className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-semibold mb-2">New Benchmark</h3>
            <p className="text-sm text-muted-foreground">Start a new experiment with your data</p>
          </Card>

          <Card className="p-6 shadow-elevation hover:shadow-glow transition-all cursor-pointer group" onClick={() => navigate("/leaderboard")}>
            <TrendingUp className="w-10 h-10 text-accent mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-semibold mb-2">Browse Models</h3>
            <p className="text-sm text-muted-foreground">Explore available Azure OpenAI embedding models</p>
          </Card>

          <Card className="p-6 shadow-elevation hover:shadow-glow transition-all cursor-pointer group">
            <FileText className="w-10 h-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-semibold mb-2">Documentation</h3>
            <p className="text-sm text-muted-foreground">Learn how to optimize your benchmarks</p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
