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

  const [maxDimensions, setMaxDimensions] = useState([initialConstraints.maxDimensions]);
  const [maxCost, setMaxCost] = useState([initialConstraints.maxCost]);
  const [minPerformance, setMinPerformance] = useState([initialConstraints.minPerformance]);

  const matchingModels = availableModels.filter((model) =>
    modelMatchesConstraints(model, {
      maxDimensions: maxDimensions[0],
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
  params.set("max_dimensions", String(maxDimensions[0]));
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

        {/* Embedding Dimensions Constraint */}
        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                <HardDrive className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Maximum Dimensions</h2>
                <p className="text-muted-foreground">
                  Limit embedding vector size — directly affects storage cost per vector
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2 self-start">
              {maxDimensions[0]}
            </Badge>
          </div>

          <div className="space-y-6">
            <div>
              <Slider
                value={maxDimensions}
                onValueChange={setMaxDimensions}
                min={128}
                max={4096}
                step={128}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>128</span>
                <span>4,096</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Small", value: 384 },
                { label: "Medium", value: 768 },
                { label: "Large", value: 1536 },
                { label: "Max", value: 4096 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant={maxDimensions[0] === preset.value ? "default" : "outline"}
                  onClick={() => setMaxDimensions([preset.value])}
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
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-lg bg-accent/10 shrink-0">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Maximum Cost</h2>
                <p className="text-muted-foreground">
                  Cost per million tokens (open-source models are free)
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2 self-start">
              {maxCost[0] === 0 ? "Free only" : `≤ $${maxCost[0].toFixed(2)}/M`}
            </Badge>
          </div>

          <div className="space-y-6">
            <div>
              <Slider
                value={maxCost}
                onValueChange={setMaxCost}
                min={0}
                max={0.15}
                step={0.01}
                className="mb-4"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Free only</span>
                <span>$0.15/M tokens</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Free only", value: 0 },
                { label: "≤ $0.10/M", value: 0.10 },
                { label: "Any cost", value: 0.15 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  variant={maxCost[0] === preset.value ? "default" : "outline"}
                  onClick={() => setMaxCost([preset.value])}
                  size="sm"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Performance Constraint */}
        <Card className="p-8 mb-6 shadow-elevation">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            <div className="flex items-start gap-4 flex-1">
              <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-2">Minimum Performance</h2>
                <p className="text-muted-foreground">
                  Set minimum acceptable MTEB score threshold
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-lg px-4 py-2 self-start">
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Matching Models</div>
              <div className="text-4xl font-bold text-primary">{matchingModels}</div>
              <p className="text-sm text-muted-foreground mt-2">
                models meet your constraints from MTEB leaderboard
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="text-sm text-muted-foreground mb-2">Your Constraints</div>
              <div className="space-y-1 text-sm">
                <div>Dimensions: ≤ {maxDimensions[0]}</div>
                <div>Cost: {maxCost[0] === 0 ? "Free only" : `≤ $${maxCost[0].toFixed(2)}/M`}</div>
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
