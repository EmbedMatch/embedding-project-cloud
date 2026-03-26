import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Zap, DollarSign, HardDrive, AlertCircle, Upload } from "lucide-react";
import {
  availableModels,
  modelMatchesConstraints,
  parseConstraintsFromParams,
} from "@/lib/modelCatalog";

const Constraints = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Dataset context from URL params
  const blobName = searchParams.get("blob_name");
  const datasetType = searchParams.get("dataset_type") || "csv";
  const filename = searchParams.get("filename") || "dataset";
  const hasDataset = Boolean(blobName);
  const initialConstraints = parseConstraintsFromParams(searchParams);

  const [maxSize, setMaxSize] = useState([initialConstraints.maxSize]); // MB
  const [maxCost, setMaxCost] = useState([initialConstraints.maxCost]); // $/million tokens
  const [minPerformance, setMinPerformance] = useState([initialConstraints.minPerformance]); // percentage

  const matchingModels = availableModels.filter((model) =>
    modelMatchesConstraints(model, {
      maxSize: maxSize[0],
      maxCost: maxCost[0],
      minPerformance: minPerformance[0],
    }),
  ).length;

  // Build URL params string to carry forward
  const params = new URLSearchParams();
  if (hasDataset) {
    params.set("blob_name", blobName!);
    params.set("dataset_type", datasetType);
    params.set("filename", filename);
  }
  params.set("max_size", String(maxSize[0]));
  params.set("max_cost", String(maxCost[0]));
  params.set("min_performance", String(minPerformance[0]));
  const leaderboardUrl = `/leaderboard?${params.toString()}`;

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Define Constraints</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            Set your requirements to filter the best embedding models
          </p>
        </div>

        {/* No-dataset warning */}
        {!hasDataset && (
          <Card className="p-6 mb-6 shadow-elevation border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <div className="font-semibold">No dataset uploaded</div>
                  <p className="text-sm text-muted-foreground">
                    Upload a dataset first to run benchmarks with these constraints.
                    You can still explore the constraint filters below.
                  </p>
                </div>
              </div>
              <Button variant="hero" onClick={() => navigate("/upload")}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Dataset
              </Button>
            </div>
          </Card>
        )}

        {/* Dataset context banner */}
        {hasDataset && (
          <Card className="p-4 mb-6 shadow-elevation bg-accent/5 border-accent/20">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent" />
              <span className="text-sm">
                Dataset: <span className="font-semibold">{filename}</span>
                <span className="text-muted-foreground ml-2">({datasetType.toUpperCase()})</span>
              </span>
            </div>
          </Card>
        )}

        {/* Model Size Constraint */}
        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <HardDrive className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Maximum Model Size</h2>
              <p className="text-muted-foreground">
                Limit model size based on your deployment constraints
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {maxSize[0]} MB
            </Badge>
          </div>

          <div className="space-y-6">
            <div>
              <Slider
                value={maxSize}
                onValueChange={setMaxSize}
                min={50}
                max={2000}
                step={50}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>50 MB</span>
                <span>2,000 MB</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Tiny", value: 100 },
                { label: "Small", value: 300 },
                { label: "Medium", value: 500 },
                { label: "Large", value: 1000 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant={maxSize[0] === preset.value ? "default" : "outline"}
                  onClick={() => setMaxSize([preset.value])}
                  size="sm"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Cost Constraint */}
        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-accent/10">
              <DollarSign className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Maximum Cost</h2>
              <p className="text-muted-foreground">
                Set your budget for inference costs per million tokens
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              ${maxCost[0]}/M
            </Badge>
          </div>

          <div className="space-y-6">
            <div>
              <Slider
                value={maxCost}
                onValueChange={setMaxCost}
                min={1}
                max={50}
                step={1}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>$1/M tokens</span>
                <span>$50/M tokens</span>
              </div>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="text-sm font-medium mb-2">Estimated Monthly Cost</div>
              <div className="text-2xl font-bold text-accent">
                ${(maxCost[0] * 10).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on 10M tokens/month average usage
              </p>
            </div>
          </div>
        </Card>

        {/* Performance Constraint */}
        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">Minimum Performance</h2>
              <p className="text-muted-foreground">
                Set minimum acceptable MTEB score threshold
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {minPerformance[0]}%
            </Badge>
          </div>

          <div className="space-y-6">
            <div>
              <Slider
                value={minPerformance}
                onValueChange={setMinPerformance}
                min={50}
                max={95}
                step={5}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>50%</span>
                <span>95%</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Good", value: 70, color: "bg-yellow-500" },
                { label: "Great", value: 80, color: "bg-green-500" },
                { label: "Excellent", value: 90, color: "bg-blue-500" },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant={minPerformance[0] === preset.value ? "default" : "outline"}
                  onClick={() => setMinPerformance([preset.value])}
                  size="sm"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Summary */}
        <Card className="p-8 mb-6 shadow-elevation bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Matching Models</div>
              <div className="text-4xl font-bold text-primary">{matchingModels}</div>
              <p className="text-sm text-muted-foreground mt-2">
                models meet your constraints from MTEB leaderboard
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-2">Your Constraints</div>
              <div className="space-y-1 text-sm">
                <div>Size: ≤ {maxSize[0]} MB</div>
                <div>Cost: ≤ ${maxCost[0]}/M</div>
                <div>Performance: ≥ {minPerformance[0]}%</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between gap-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/upload")}>
            Back
          </Button>
          <Button
            variant="hero"
            size="lg"
            onClick={() => navigate(leaderboardUrl)}
          >
            View Matching Models
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Constraints;
