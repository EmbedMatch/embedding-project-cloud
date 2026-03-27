import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ArrowUpDown,
  CheckCircle2,
  ExternalLink,
  PlayCircle,
  Loader2,
  Upload,
  FileText,
  Trash2,
  Filter,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, createExperiment } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  availableModels,
  modelMatchesConstraints,
  parseConstraintsFromParams,
  type Model,
} from "@/lib/modelCatalog";

const Leaderboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dataset context from URL params (set by Upload page or inline upload)
  const blobName = searchParams.get("blob_name");
  const datasetType = searchParams.get("dataset_type") || "csv";
  const filename = searchParams.get("filename") || "dataset";
  const hasDataset = Boolean(blobName);
  const constraints = parseConstraintsFromParams(searchParams);

  const [models] = useState<Model[]>(availableModels);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "size" | "cost">("score");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const constraintMatchedModels = useMemo(
    () => models.filter((m) => modelMatchesConstraints(m, constraints)),
    [constraints, models],
  );

  const sortedModels = useMemo(() => {
    return [...constraintMatchedModels].sort((a, b) => {
      switch (sortBy) {
        case "score":
          return b.mtebScore - a.mtebScore;
        case "size":
          return a.size - b.size;
        case "cost":
          return a.cost - b.cost;
        default:
          return 0;
      }
    });
  }, [constraintMatchedModels, sortBy]);

  const filteredModels = useMemo(
    () =>
      sortedModels.filter(
        (model) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          model.organization.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [searchQuery, sortedModels],
  );

  const recommendedModels = useMemo(
    () =>
      [...constraintMatchedModels]
        .sort((a, b) => {
          if (b.mtebScore !== a.mtebScore) return b.mtebScore - a.mtebScore;
          if (a.cost !== b.cost) return a.cost - b.cost;
          return a.size - b.size;
        })
        .slice(0, 3),
    [constraintMatchedModels],
  );

  const recommendedIds = useMemo(
    () => new Set(recommendedModels.map((m) => m.id)),
    [recommendedModels],
  );

  const toggleModelSelection = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  };

  const selectAll = () => setSelectedModels(filteredModels.map((m) => m.id));
  const selectRecommended = () =>
    setSelectedModels(recommendedModels.map((m) => m.id));

  // ── Inline upload handler ──
  const handleInlineUpload = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const upload = await uploadFile(file);
      const type = file.name.endsWith(".json") ? "json" : "csv";

      // Update URL params in-place (no full navigation), while preserving constraints.
      const params = new URLSearchParams(searchParams);
      params.set("blob_name", upload.blob_name);
      params.set("dataset_type", type);
      params.set("filename", file.name);
      setSearchParams(params);

      toast({
        title: "Dataset uploaded",
        description: `${file.name} is ready for benchmarking.`,
      });
    } catch (err) {
      toast({
        title: "Upload failed",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleInlineUpload(file);
  };

  const handleRemoveDataset = () => {
    // Clear dataset params from URL; constraints remain.
    const params = new URLSearchParams(searchParams);
    params.delete("blob_name");
    params.delete("dataset_type");
    params.delete("filename");
    setSearchParams(params);
    toast({
      title: "Dataset removed",
      description: "Upload a new dataset to benchmark.",
    });
  };

  // ── Start benchmark ──
  const handleStartBenchmark = async () => {
    if (!blobName || selectedModels.length === 0) return;
    setIsStarting(true);

    try {
      const experiment = await createExperiment({
        name: filename.replace(/\.[^.]+$/, ""),
        blob_name: blobName,
        dataset_type: datasetType,
        models: selectedModels,
      });

      toast({
        title: "Benchmark started",
        description: "Your experiment is being processed.",
      });
      navigate(`/results?id=${experiment.id}`);
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error
            ? err.message
            : "Failed to start benchmark",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-8 h-8 text-accent" />
            <h1 className="text-4xl font-bold">Model Leaderboard</h1>
          </div>
          <p className="text-xl text-muted-foreground">
            {filteredModels.length} models currently match your constraints
          </p>
        </div>

        {/* Hidden file input for inline upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Dataset status card */}
        {hasDataset ? (
          <Card className="p-4 mb-6 shadow-elevation bg-accent/5 border-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  Dataset: <span className="font-semibold">{filename}</span>
                  <span className="text-muted-foreground ml-2">
                    ({datasetType.toUpperCase()})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />{" "}
                      Uploading...
                    </>
                  ) : (
                    "Change Dataset"
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleRemoveDataset}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5 mb-6 shadow-elevation border-dashed border-2 border-border hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <div>
                  <div className="font-medium">No dataset uploaded</div>
                  <p className="text-sm text-muted-foreground">
                    Select recommended models, then upload a dataset to start
                    benchmarking
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" /> Upload Dataset
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/upload")}
                >
                  Full Upload Page
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Active constraints summary */}
        <Card className="p-4 mb-6 shadow-elevation border-primary/20 bg-primary/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">
                Active constraints
              </div>
              <div className="font-medium text-sm">
                Size ≤ {constraints.maxSize} MB · Cost ≤ ${constraints.maxCost}
                /M · Performance ≥ {constraints.minPerformance}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">
                Constraint matches
              </div>
              <div className="text-2xl font-bold text-primary">
                {constraintMatchedModels.length}
              </div>
            </div>
          </div>
        </Card>

        {/* Filters */}
        <Card className="p-6 mb-6 shadow-elevation">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search models or organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={sortBy}
              onValueChange={(v: string) =>
                setSortBy(v as "score" | "size" | "cost")
              }
            >
              <SelectTrigger className="w-[200px]">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Sort by Score</SelectItem>
                <SelectItem value="size">Sort by Size</SelectItem>
                <SelectItem value="cost">Sort by Cost</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectRecommended}>
                <Sparkles className="w-4 h-4 mr-2" />
                Select Recommended ({recommendedModels.length})
              </Button>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select visible
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedModels([])}
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>

        {/* Selected Models Banner — benchmark action gated on dataset */}
        {selectedModels.length > 0 && (
          <Card className="p-4 mb-6 shadow-elevation bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="font-medium">
                  {selectedModels.length} model
                  {selectedModels.length > 1 ? "s" : ""} selected
                </span>
              </div>
              <Button
                variant="hero"
                onClick={handleStartBenchmark}
                disabled={isStarting || !hasDataset}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" /> Start Benchmarking
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Models Grid */}
        {filteredModels.length > 0 ? (
          <div className="space-y-4">
            {filteredModels.map((model, index) => (
              <Card
                key={model.id}
                className={`p-6 shadow-elevation transition-all duration-300 hover:shadow-glow cursor-pointer ${
                  selectedModels.includes(model.id)
                    ? "border-2 border-primary bg-primary/5"
                    : "hover:border-primary/30"
                }`}
                onClick={() => toggleModelSelection(model.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-primary text-primary-foreground font-bold text-xl">
                      {index + 1}
                    </div>

                    {/* Model Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold">{model.name}</h3>
                        <Badge variant="secondary">{model.organization}</Badge>
                        {recommendedIds.has(model.id) && (
                          <Badge className="bg-accent text-accent-foreground">
                            Recommended
                          </Badge>
                        )}
                        {selectedModels.includes(model.id) && (
                          <Badge className="bg-primary">Selected</Badge>
                        )}
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            MTEB Score
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {model.mtebScore}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Retrieval
                          </div>
                          <div className="text-lg font-semibold">
                            {model.retrievalScore}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Classification
                          </div>
                          <div className="text-lg font-semibold">
                            {model.classificationScore}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Size
                          </div>
                          <div className="text-lg font-semibold">
                            {model.size} MB
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">
                            Cost
                          </div>
                          <div className="text-lg font-semibold text-accent">
                            {model.cost === 0 ? "Free" : `$${model.cost}/M`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 shadow-elevation border-dashed border-2 border-border text-center">
            <Filter className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No model matches</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Relax one of your constraints or clear search to see more options.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                const query = params.toString();
                navigate(query ? `/constraints?${query}` : "/constraints");
              }}
            >
              Adjust Constraints
            </Button>
          </Card>
        )}

        {/* Bottom Actions */}
        <div className="flex justify-start mt-8">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              const query = params.toString();
              navigate(query ? `/constraints?${query}` : "/constraints");
            }}
          >
            Filter by Constraints
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
