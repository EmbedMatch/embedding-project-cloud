import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  Award,
  TrendingUp,
  DollarSign,
  Zap,
  Download,
  Share2,
  CheckCircle2,
  Trophy,
} from "lucide-react";

const Results = () => {
  const navigate = useNavigate();

  const benchmarkResults = [
    {
      id: "1",
      name: "bge-large-en-v1.5",
      organization: "BAAI",
      overallScore: 92.5,
      yourDataScore: 94.3,
      retrievalAccuracy: 95.8,
      classificationF1: 92.7,
      speedMs: 12,
      cost: 2.5,
      recommendation: "best",
    },
    {
      id: "2",
      name: "gte-large",
      organization: "Alibaba",
      overallScore: 91.2,
      yourDataScore: 91.8,
      retrievalAccuracy: 93.5,
      classificationF1: 90.1,
      speedMs: 11,
      cost: 2.3,
      recommendation: "cost-effective",
    },
    {
      id: "3",
      name: "e5-large-v2",
      organization: "Microsoft",
      overallScore: 90.8,
      yourDataScore: 90.5,
      retrievalAccuracy: 92.1,
      classificationF1: 88.9,
      speedMs: 13,
      cost: 2.8,
    },
  ];

  const winner = benchmarkResults[0];

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <Award className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Benchmark Results</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Based on your specific data and constraints
          </p>
        </div>

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
                  <h2 className="text-3xl font-bold mb-1">{winner.name}</h2>
                  <Badge variant="secondary" className="text-sm">
                    {winner.organization}
                  </Badge>
                </div>
              </div>

              <p className="text-lg text-muted-foreground mb-6">
                This model achieved the highest performance on your specific dataset while meeting all
                your constraints. It excels in both retrieval accuracy and classification tasks.
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Your Data Score</div>
                  <div className="text-2xl font-bold text-primary">{winner.yourDataScore}%</div>
                </div>
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Retrieval</div>
                  <div className="text-2xl font-bold">{winner.retrievalAccuracy}%</div>
                </div>
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Speed</div>
                  <div className="text-2xl font-bold">{winner.speedMs}ms</div>
                </div>
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">Cost</div>
                  <div className="text-2xl font-bold text-accent">${winner.cost}/M</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="hero" size="lg" className="w-full">
                Deploy This Model
              </Button>
              <Button variant="outline" size="lg">
                View Detailed Report
              </Button>
            </div>
          </div>
        </Card>

        {/* Detailed Comparison */}
        <Card className="p-8 mb-6 shadow-elevation">
          <h2 className="text-2xl font-bold mb-6">Detailed Comparison</h2>

          <div className="space-y-6">
            {benchmarkResults.map((model) => (
              <div
                key={model.id}
                className="p-6 border border-border rounded-lg hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{model.name}</h3>
                      <Badge variant="secondary">{model.organization}</Badge>
                      {model.recommendation === "best" && (
                        <Badge className="bg-primary">
                          <Award className="w-3 h-3 mr-1" />
                          Best Overall
                        </Badge>
                      )}
                      {model.recommendation === "cost-effective" && (
                        <Badge className="bg-accent text-accent-foreground">
                          <DollarSign className="w-3 h-3 mr-1" />
                          Most Cost-Effective
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">{model.yourDataScore}%</div>
                    <div className="text-xs text-muted-foreground">Overall Score</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Retrieval Accuracy</span>
                      <span className="text-sm font-semibold">{model.retrievalAccuracy}%</span>
                    </div>
                    <Progress value={model.retrievalAccuracy} className="h-2" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Classification F1</span>
                      <span className="text-sm font-semibold">{model.classificationF1}%</span>
                    </div>
                    <Progress value={model.classificationF1} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="w-4 h-4" />
                      Speed
                    </div>
                    <span className="font-semibold">{model.speedMs}ms</span>
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
                bge-large-en-v1.5 outperformed other models by 2.5% on your specific retrieval
                tasks.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 rounded-xl border border-accent/20">
              <DollarSign className="w-8 h-8 text-accent mb-3" />
              <h3 className="font-semibold text-lg mb-2">Best Value</h3>
              <p className="text-sm text-muted-foreground">
                gte-large offers 97% of top performance at 8% lower cost, saving ~$400/month at
                scale.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border border-border">
              <CheckCircle2 className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold text-lg mb-2">LLM Judge Validation</h3>
              <p className="text-sm text-muted-foreground">
                Azure OpenAI GPT-5 validated quality scores with 94% agreement on relevance
                assessments.
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3">
            <Button variant="outline" size="lg">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button variant="outline" size="lg">
              <Share2 className="w-4 h-4 mr-2" />
              Share Results
            </Button>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => navigate("/leaderboard")}>
              Try Different Models
            </Button>
            <Button variant="hero" size="lg" onClick={() => navigate("/dashboard")}>
              Save to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Results;
