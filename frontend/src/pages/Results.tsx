import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Award, Loader2, AlertCircle } from "lucide-react";
import { type ExperimentResult, getExperiment } from "@/lib/api";

type ModelResult = NonNullable<ExperimentResult["results"]>[number];

const Results = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const experimentId = searchParams.get("id");

  const [experiment, setExperiment] = useState<ExperimentResult | null>(null);
  const [error, setError] = useState<string | null>(
    experimentId ? null : "No experiment ID provided",
  );
  const [polling, setPolling] = useState(!!experimentId);

  useEffect(() => {
    if (!experimentId) return;

    let active = true;
    const poll = async () => {
      try {
        const data = await getExperiment(experimentId);
        if (!active) return;
        setExperiment(data);

        if (data.status === "completed" || data.status === "failed") {
          setPolling(false);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load experiment");
        setPolling(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [experimentId]);

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

  if (!experiment || polling) {
    return (
      <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
        <div className="max-w-3xl mx-auto px-6">
          <Card className="p-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-6 text-primary animate-spin" />
            <h2 className="text-2xl font-bold mb-2">
              {experiment?.status === "processing" ? "Benchmarking in progress..." : "Loading experiment..."}
            </h2>
            <p className="text-muted-foreground">
              Embedding your data with Azure OpenAI. This may take a moment.
            </p>
            {experiment && (
              <p className="text-sm text-muted-foreground mt-4">
                Status: <span className="font-mono">{experiment.status}</span>
              </p>
            )}
          </Card>
        </div>
      </div>
    );
  }

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

  const results = experiment.results;

  return (
      <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
          <div className="max-w-5xl mx-auto px-6">
              <div className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                      <Award className="w-8 h-8 text-accent" />
                      <h1 className="text-4xl font-bold">Benchmark Results</h1>
                  </div>
                  <p className="text-xl text-muted-foreground">
                      Experiment: {experiment.name}
                  </p>
              </div>

              {results && results.length > 0 && (
                  <Card className="p-8 mb-6 shadow-elevation">
                      <h2 className="text-2xl font-bold mb-6">
                          Model Comparison ({results.length} models)
                      </h2>

                      {/* Summary comparison table */}
                      <div className="overflow-x-auto mb-8">
                          <table className="w-full text-sm">
                              <thead>
                                  <tr className="border-b">
                                      <th className="text-left py-3 pr-4">Model</th>
                                      <th className="text-center py-3 pr-4">Dimensions</th>
                                      <th className="text-center py-3 pr-4">Latency</th>
                                      <th className="text-center py-3 pr-4">Relevance</th>
                                      <th className="text-center py-3">Retrieval Accuracy</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {results.map((r: ModelResult, idx: number) => (
                                      <tr key={idx} className="border-b last:border-0">
                                          <td className="py-3 pr-4 font-bold text-primary">{r.model}</td>
                                          {r.error ? (
                                              <td colSpan={4} className="py-3 text-center text-destructive">
                                                  {r.error}
                                              </td>
                                          ) : (
                                              <>
                                                  <td className="py-3 pr-4 text-center">{r.dimensions}</td>
                                                  <td className="py-3 pr-4 text-center">{r.latency_ms?.toFixed(0)}ms</td>
                                                  <td className="py-3 pr-4 text-center font-bold">{r.relevance_score}/10</td>
                                                  <td className="py-3 text-center font-bold">{(r.retrieval_accuracy * 100).toFixed(1)}%</td>
                                              </>
                                          )}
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>

                      {/* Per-model detail cards */}
                      {results.filter((r: ModelResult) => !r.error).map((r: ModelResult, idx: number) => (
                          <div key={idx} className="mb-6 p-4 bg-muted/20 rounded-lg">
                              <h3 className="text-lg font-bold mb-3">{r.model}</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                  <div className="p-3 bg-muted/30 rounded">
                                      <div className="text-xs text-muted-foreground">Texts</div>
                                      <div className="text-xl font-bold">{r.num_texts}</div>
                                  </div>
                                  <div className="p-3 bg-muted/30 rounded">
                                      <div className="text-xs text-muted-foreground">Dimensions</div>
                                      <div className="text-xl font-bold">{r.dimensions}</div>
                                  </div>
                                  <div className="p-3 bg-muted/30 rounded">
                                      <div className="text-xs text-muted-foreground">Latency</div>
                                      <div className="text-xl font-bold">{r.latency_ms?.toFixed(0)}ms</div>
                                  </div>
                                  <div className="p-3 bg-muted/30 rounded">
                                      <div className="text-xs text-muted-foreground">Retrieval Accuracy</div>
                                      <div className="text-xl font-bold">{(r.retrieval_accuracy * 100).toFixed(1)}%</div>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </Card>
              )}

              <div className="flex justify-between">
                  <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate("/upload")}
                  >
                      New Benchmark
                  </Button>
                  <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate("/")}
                  >
                      Home
                  </Button>
              </div>
          </div>
      </div>
  );
};

export default Results;
