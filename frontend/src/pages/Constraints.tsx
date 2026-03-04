import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Zap, DollarSign, HardDrive } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const Constraints = () => {
  const navigate = useNavigate();
  const [maxSize, setMaxSize] = useState([2000]);
  const [maxCost, setMaxCost] = useState([50]);
  const [minPerformance, setMinPerformance] = useState([50]);

  const { data: allModels = [] } = useQuery<unknown[]>({
    queryKey: ["models"],
    queryFn: () => fetch(`${API_URL}/models/`).then((r) => r.json()),
  });

  const { data: filteredModels = [] } = useQuery<unknown[]>({
    queryKey: ["models", maxSize[0], maxCost[0], minPerformance[0]],
    queryFn: () =>
      fetch(
        `${API_URL}/models/?max_size_mb=${maxSize[0]}&max_cost_per_m=${maxCost[0]}&min_score=${minPerformance[0]}`
      ).then((r) => r.json()),
  });

  const handleFindModels = () => {
    localStorage.setItem(
      "constraints",
      JSON.stringify({ max_size_mb: maxSize[0], max_cost_per_m: maxCost[0], min_score: minPerformance[0] })
    );
    navigate("/leaderboard");
  };

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Define Constraints</h1>
          </div>
          <p className="text-xl text-muted-foreground">Set your requirements to filter the best embedding models</p>
        </div>

        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-primary/10"><HardDrive className="w-6 h-6 text-primary" /></div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Maximum Model Size</h2>
              <p className="text-muted-foreground">Limit model size based on your deployment constraints</p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">{maxSize[0]} MB</Badge>
          </div>
          <Slider value={maxSize} onValueChange={setMaxSize} min={50} max={2000} step={50} className="mb-4" />
          <div className="flex justify-between text-sm text-muted-foreground mb-4"><span>50 MB</span><span>2,000 MB</span></div>
          <div className="grid grid-cols-4 gap-3">
            {[{ label: "Tiny", value: 100 }, { label: "Small", value: 300 }, { label: "Medium", value: 500 }, { label: "Large", value: 1000 }].map((p) => (
              <Button key={p.label} variant={maxSize[0] === p.value ? "default" : "outline"} onClick={() => setMaxSize([p.value])} size="sm">{p.label}</Button>
            ))}
          </div>
        </Card>

        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-accent/10"><DollarSign className="w-6 h-6 text-accent" /></div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Maximum Cost</h2>
              <p className="text-muted-foreground">Set your budget for inference costs per million tokens</p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">${maxCost[0]}/M</Badge>
          </div>
          <Slider value={maxCost} onValueChange={setMaxCost} min={1} max={50} step={1} className="mb-4" />
          <div className="flex justify-between text-sm text-muted-foreground mb-4"><span>$1/M tokens</span><span>$50/M tokens</span></div>
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="text-sm font-medium mb-2">Estimated Monthly Cost</div>
            <div className="text-2xl font-bold text-accent">${(maxCost[0] * 10).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Based on 10M tokens/month average usage</p>
          </div>
        </Card>

        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-primary/10"><Zap className="w-6 h-6 text-primary" /></div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Minimum MTEB Score</h2>
              <p className="text-muted-foreground">Set minimum acceptable MTEB leaderboard score</p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">{minPerformance[0]}</Badge>
          </div>
          <Slider value={minPerformance} onValueChange={setMinPerformance} min={50} max={70} step={1} className="mb-4" />
          <div className="flex justify-between text-sm text-muted-foreground mb-4"><span>50</span><span>70</span></div>
          <div className="grid grid-cols-3 gap-3">
            {[{ label: "Any", value: 50 }, { label: "Good (61+)", value: 61 }, { label: "Best (64+)", value: 64 }].map((p) => (
              <Button key={p.label} variant={minPerformance[0] === p.value ? "default" : "outline"} onClick={() => setMinPerformance([p.value])} size="sm">{p.label}</Button>
            ))}
          </div>
        </Card>

        <Card className="p-8 mb-6 shadow-elevation bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Matching Models</div>
              <div className="text-4xl font-bold text-primary">{filteredModels.length}</div>
              <p className="text-sm text-muted-foreground mt-2">of {allModels.length} available models meet your constraints</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-2">Your Constraints</div>
              <div className="space-y-1 text-sm">
                <div>Size: ≤ {maxSize[0]} MB</div>
                <div>Cost: ≤ ${maxCost[0]}/M</div>
                <div>MTEB Score: ≥ {minPerformance[0]}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-between gap-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/upload")}>Back</Button>
          <Button variant="hero" size="lg" onClick={handleFindModels}>View Matching Models</Button>
        </div>
      </div>
    </div>
  );
};

export default Constraints;
