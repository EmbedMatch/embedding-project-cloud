import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, CheckCircle2, PlayCircle, Loader2, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "";

interface EmbeddingModel {
  name: string;
  deployment: string;
  dimensions: number;
  cost_per_m_tokens: number;
  mteb_score: number;
  size_mb: number;
  provider: string;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "size" | "cost">("score");
  const [selectedDeployments, setSelectedDeployments] = useState<string[]>([]);

  const rawConstraints = localStorage.getItem("constraints");
  const constraints = rawConstraints ? JSON.parse(rawConstraints) : {};

  const params = new URLSearchParams();
  if (constraints.max_size_mb) params.set("max_size_mb", constraints.max_size_mb);
  if (constraints.max_cost_per_m) params.set("max_cost_per_m", constraints.max_cost_per_m);
  if (constraints.min_score) params.set("min_score", constraints.min_score);

  const { data: models = [], isLoading } = useQuery<EmbeddingModel[]>({
    queryKey: ["models", constraints],
    queryFn: () => fetch(`${API_URL}/models/?${params}`).then((r) => r.json()),
  });

  const experimentId = localStorage.getItem("experimentId");
  const hasExperiment = !!experimentId;

  const startBenchmark = useMutation({
    mutationFn: async () => {
      if (!experimentId) throw new Error("No experiment found. Please upload data first.");
      // Verify experiment exists and has a blob
      const checkRes = await fetch(`${API_URL}/experiments/${experimentId}`);
      if (!checkRes.ok) throw new Error("Experiment not found. Please upload data first.");
      const exp = await checkRes.json();
      if (!exp.blob_name) throw new Error("No data file uploaded. Please upload data first.");
      const res = await fetch(`${API_URL}/experiments/${experimentId}/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_models: selectedDeployments, constraints }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to start benchmark" }));
        throw new Error(err.detail ?? "Failed to start benchmark");
      }
      return res.json();
    },
    onSuccess: () => navigate("/results"),
  });

  const toggleModel = (deployment: string) => {
    setSelectedDeployments((prev) =>
      prev.includes(deployment) ? prev.filter((d) => d !== deployment) : [...prev, deployment]
    );
  };

  const sorted = [...models].sort((a, b) => {
    if (sortBy === "score") return b.mteb_score - a.mteb_score;
    if (sortBy === "size") return a.size_mb - b.size_mb;
    return a.cost_per_m_tokens - b.cost_per_m_tokens;
  });

  const filtered = sorted.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.deployment.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Model Leaderboard</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            {isLoading ? "Loading…" : `${filtered.length} models match your constraints`}
          </p>
        </div>

        <Card className="p-6 mb-6 shadow-elevation">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search models…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[200px]">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by MTEB Score</SelectItem>
                <SelectItem value="size">Sort by Size</SelectItem>
                <SelectItem value="cost">Sort by Cost</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {!hasExperiment && (
          <Card className="p-4 mb-6 shadow-elevation bg-yellow-50 border-yellow-200">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                No data uploaded yet. <button className="underline font-medium" onClick={() => navigate("/upload")}>Upload a file</button> first to run a benchmark.
              </span>
            </div>
          </Card>
        )}

        {selectedDeployments.length > 0 && (
          <Card className="p-4 mb-6 shadow-elevation bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="font-medium">
                  {selectedDeployments.length} model{selectedDeployments.length > 1 ? "s" : ""} selected
                </span>
              </div>
              <Button variant="hero" onClick={() => startBenchmark.mutate()} disabled={startBenchmark.isPending}>
                {startBenchmark.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting…</>
                ) : (
                  <><PlayCircle className="w-4 h-4 mr-2" />Start Benchmarking</>
                )}
              </Button>
            </div>
            {startBenchmark.isError && (
              <p className="text-red-600 text-sm mt-2">{startBenchmark.error.message}</p>
            )}
          </Card>
        )}

        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
              Loading models…
            </div>
          )}
          {filtered.map((model, index) => (
            <Card
              key={model.deployment}
              className={`p-6 shadow-elevation transition-all duration-300 hover:shadow-glow cursor-pointer ${
                selectedDeployments.includes(model.deployment)
                  ? "border-2 border-primary bg-primary/5"
                  : "hover:border-primary/30"
              }`}
              onClick={() => toggleModel(model.deployment)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-primary text-primary-foreground font-bold text-xl">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{model.name}</h3>
                      <Badge variant={model.provider === "azure_openai" ? "secondary" : "outline"}>
                        {model.provider === "azure_openai" ? "Azure OpenAI" : "Open Source"}
                      </Badge>
                      {selectedDeployments.includes(model.deployment) && (
                        <Badge className="bg-primary">Selected</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">MTEB Score</div>
                        <div className="text-2xl font-bold text-primary">{model.mteb_score}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Dimensions</div>
                        <div className="text-lg font-semibold">{model.dimensions}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Size</div>
                        <div className="text-lg font-semibold">{model.size_mb} MB</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Cost</div>
                        <div className="text-lg font-semibold text-accent">
                          {model.cost_per_m_tokens === 0 ? "Free" : `$${model.cost_per_m_tokens}/M`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex justify-between mt-8">
          <Button variant="outline" size="lg" onClick={() => navigate("/constraints")}>
            Adjust Constraints
          </Button>
          <Button
            variant="hero"
            size="lg"
            disabled={selectedDeployments.length === 0 || startBenchmark.isPending}
            onClick={() => startBenchmark.mutate()}
          >
            {startBenchmark.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting…</>
            ) : (
              `Benchmark Selected (${selectedDeployments.length})`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
