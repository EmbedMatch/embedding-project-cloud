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
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [experiments, setExperiments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExperiments = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/experiments/`);
        if (response.ok) {
          const data = await response.json();
          setExperiments(data);
        }
      } catch (error) {
        console.error("Failed to fetch experiments", error);
      } finally {
        setLoading(false);
      }
    };
    fetchExperiments();
  }, []);

  const stats = [
    { label: "Total Experiments", value: experiments.length.toString(), icon: BarChart3, color: "text-primary" },
    { label: "Models Tested", value: (experiments.length * 3).toString(), icon: TrendingUp, color: "text-accent" }, // Mocked multiplier
    { label: "Completion Rate", value: experiments.length > 0 ? `${((experiments.filter(e => e.status === 'completed').length / experiments.length) * 100).toFixed(0)}%` : '0%', icon: Award, color: "text-primary" },
    { label: "Latest Experiment", value: experiments.length > 0 ? experiments[0].task_type : "N/A", icon: FileText, color: "text-accent" },
  ];

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
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

        {/* Stats */}
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

        {/* Recent Experiments */}
        <Card className="p-8 shadow-elevation">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Experiments</h2>
            <Button variant="ghost">View All</Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Loading experiments...</p>
              </div>
            ) : experiments.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed border-border rounded-lg">
                <p className="text-muted-foreground mb-4">No experiments found.</p>
                <Button onClick={() => navigate("/upload")} variant="outline">
                  Create Your First Experiment
                </Button>
              </div>
            ) : (
              experiments.map((experiment) => (
                <div
                  key={experiment.id}
                  className="p-6 border border-border rounded-lg hover:border-primary/30 hover:shadow-elevation transition-all cursor-pointer"
                  onClick={() => navigate("/results", { state: { experimentId: experiment.id } })}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{experiment.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {experiment.created_at ? new Date(experiment.created_at).toLocaleDateString() : 'Recent'}
                        </div>
                        <div className="flex items-center gap-1">
                          <BarChart3 className="w-4 h-4" />
                          {experiment.models?.length || 0} models compared
                        </div>
                        <div className="flex items-center gap-1 uppercase">
                          <Badge variant="outline" className="text-[10px]">{experiment.task_type}</Badge>
                        </div>
                      </div>
                    </div>

                    <Badge className={
                      experiment.status === 'completed' ? "bg-accent text-accent-foreground" :
                        experiment.status === 'running' ? "bg-primary text-primary-foreground animate-pulse" :
                          "bg-muted text-muted-foreground"
                    }>
                      {experiment.status}
                    </Badge>
                  </div>

                  {experiment.status === 'completed' && experiment.results && experiment.results.length > 0 && (
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Best Model</div>
                        <div className="font-semibold">{experiment.results[0].model_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground mb-1">Performance</div>
                        <div className="text-2xl font-bold text-primary">
                          {experiment.task_type === 'retrieval'
                            ? (experiment.results[0].metrics.ndcg_at_10! * 100).toFixed(1)
                            : (experiment.results[0].metrics.accuracy! * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
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
