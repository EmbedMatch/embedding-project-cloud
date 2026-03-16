import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  TrendingUp,
  DollarSign,
  Zap,
  Download,
  Share2,
  CheckCircle2,
  Trophy,
  Loader2,
} from "lucide-react";

interface ModelResult {
  model_name: string;
  task_type: string;
  metrics: {
    accuracy?: number;
    ndcg_at_10?: number;
    latency_ms: number;
    throughput: number;
  };
  status: string;
}

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const experimentId = location.state?.experimentId;
  const [experiment, setExperiment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!experimentId) {
      setLoading(false);
      return;
    }

    const fetchExperiment = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/experiments/${experimentId}`);
        if (response.ok) {
          const data = await response.json();
          setExperiment(data);
        }
      } catch (error) {
        console.error("Failed to fetch experiment", error);
      } finally {
        setLoading(false);
      }
    };

    fetchExperiment();
    // Poll for status every 5 seconds if not completed
    const interval = setInterval(() => {
      if (experiment?.status !== "completed" && experiment?.status !== "failed") {
        fetchExperiment();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [experimentId, experiment?.status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Loading results...</h2>
        </div>
      </div>
    );
  }

  if (!experiment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="text-center max-w-md p-8 bg-card rounded-xl shadow-elevation">
          <h2 className="text-2xl font-bold mb-4">No Experiment Found</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't find the results you're looking for. Please start a new benchmark.
          </p>
          <Button onClick={() => navigate("/upload")} variant="hero">
            Start New Benchmark
          </Button>
        </div>
      </div>
    );
  }

  const results: ModelResult[] = experiment.results || [];
  const completed = experiment.status === "completed";
  const inProgress = experiment.status === "running" || experiment.status === "pending";

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-8 h-8 text-accent" />
              <h1 className="text-4xl font-bold">Benchmark Results</h1>
            </div>
            <p className="text-xl text-muted-foreground">
              {experiment.name} • {experiment.task_type}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="hero" disabled={!completed}>
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>
        </div>

        {inProgress && (
          <Card className="p-8 mb-8 shadow-elevation bg-primary/5 border-primary/20">
            <div className="flex items-center gap-4 mb-4">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <h2 className="text-xl font-semibold text-primary">Benchmark in Progress</h2>
              <Badge variant="outline" className="ml-auto text-primary border-primary/30">
                Status: {experiment.status}
              </Badge>
            </div>
            <Progress value={experiment.progress || 0} className="h-3 mb-2" />
            <p className="text-sm text-muted-foreground">
              Processing models... This may take a few minutes depending on the dataset size.
            </p>
          </Card>
        )}

        {/* Top Performer Card */}
        {completed && results.length > 0 && (
          <Card className="p-8 mb-8 shadow-glow border-primary/30 bg-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Award className="w-32 h-32 text-primary" />
            </div>

            <div className="relative z-10">
              <Badge className="bg-primary mb-4">Winner</Badge>
              <h2 className="text-3xl font-bold mb-2">{results[0].model_name}</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Highest performance score for {experiment.task_type}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1 text-sm uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    Score
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {experiment.task_type === 'retrieval'
                      ? (results[0].metrics.ndcg_at_10! * 100).toFixed(1)
                      : (results[0].metrics.accuracy! * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1 text-sm uppercase tracking-wider">
                    <Zap className="w-4 h-4" />
                    Latency
                  </div>
                  <div className="text-3xl font-bold">{results[0].metrics.latency_ms.toFixed(0)}ms</div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-muted-foreground mb-1 text-sm uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4" />
                    Throughput
                  </div>
                  <div className="text-3xl font-bold">{results[0].metrics.throughput.toFixed(1)} req/s</div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Detailed Comparison */}
        <Card className="p-8 shadow-elevation overflow-hidden">
          <h2 className="text-2xl font-semibold mb-6">Detailed Comparison</h2>
          <div className="overflow-x-auto mx-[-2rem] px-[2rem]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-4 font-semibold">Model Name</th>
                  <th className="pb-4 font-semibold">Status</th>
                  <th className="pb-4 font-semibold text-right">Score</th>
                  <th className="pb-4 font-semibold text-right">Latency</th>
                  <th className="pb-4 font-semibold text-right">Throughput</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        {index === 0 && completed && <CheckCircle2 className="w-5 h-5 text-accent" />}
                        <span className="font-medium">{result.model_name}</span>
                      </div>
                    </td>
                    <td className="py-4 font-mono text-sm uppercase">
                      <Badge variant={result.status === 'completed' ? 'secondary' : 'outline'}>
                        {result.status}
                      </Badge>
                    </td>
                    <td className="py-4 text-right">
                      {result.status === 'completed' ? (
                        <span className="font-bold text-primary">
                          {experiment.task_type === 'retrieval'
                            ? (result.metrics.ndcg_at_10! * 100).toFixed(1)
                            : (result.metrics.accuracy! * 100).toFixed(1)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-4 text-right">
                      {result.status === 'completed' ? `${result.metrics.latency_ms.toFixed(0)}ms` : '-'}
                    </td>
                    <td className="py-4 text-right">
                      {result.status === 'completed' ? `${result.metrics.throughput.toFixed(1)}/s` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" size="lg" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Results;
