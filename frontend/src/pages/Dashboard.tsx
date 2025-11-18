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
} from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();

  const experiments = [
    {
      id: "1",
      name: "E-commerce Search Optimization",
      date: "2025-01-15",
      status: "completed",
      bestModel: "bge-large-en-v1.5",
      score: 94.3,
      modelsCompared: 5,
    },
    {
      id: "2",
      name: "Customer Support Classification",
      date: "2025-01-12",
      status: "completed",
      bestModel: "gte-large",
      score: 91.8,
      modelsCompared: 4,
    },
    {
      id: "3",
      name: "Document Retrieval System",
      date: "2025-01-08",
      status: "completed",
      bestModel: "e5-large-v2",
      score: 89.5,
      modelsCompared: 6,
    },
  ];

  const stats = [
    { label: "Total Experiments", value: "12", icon: BarChart3, color: "text-primary" },
    { label: "Models Tested", value: "34", icon: TrendingUp, color: "text-accent" },
    { label: "Avg. Score", value: "91.2%", icon: Award, color: "text-primary" },
    { label: "Data Points", value: "145K", icon: FileText, color: "text-accent" },
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
            {experiments.map((experiment) => (
              <div
                key={experiment.id}
                className="p-6 border border-border rounded-lg hover:border-primary/30 hover:shadow-elevation transition-all cursor-pointer"
                onClick={() => navigate("/results")}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{experiment.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(experiment.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        {experiment.modelsCompared} models compared
                      </div>
                    </div>
                  </div>

                  <Badge className="bg-accent text-accent-foreground">Completed</Badge>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Best Model</div>
                    <div className="font-semibold">{experiment.bestModel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Performance</div>
                    <div className="text-2xl font-bold text-primary">{experiment.score}%</div>
                  </div>
                </div>
              </div>
            ))}
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
