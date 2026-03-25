import { useState } from "react";
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import { Checkbox} from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, createExperiment } from "@/lib/api";

const SAMPLE_DATASETS = [
  { name: "Tech Articles", file: "tech-articles.csv", description: "100 science & technology articles (AG News)" },
  { name: "Product Reviews", file: "product-reviews.csv", description: "100 Amazon product reviews" },
  { name: "News Headlines", file: "news-headlines.csv", description: "100 world/sports/business headlines (AG News)" },
];

const AVAILABLE_MODELS = [
  { id: "text-embedding-ada-002", label: "Ada 002", provider: "Azure OpenAI" },
  { id: "text-embedding-3-large", label: "Embedding 3 Large", provider: "Azure OpenAI" },
  { id: "all-MiniLM-L6-v2", label: "MiniLM L6 v2", provider: "Open Source" },
  { id: "bge-base-en-v1.5", label: "BGE Base v1.5", provider: "Open Source" },
  { id: "bge-small-en-v1.5", label: "BGE Small v1.5", provider: "Open Source" },
];


const Upload = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>(
    AVAILABLE_MODELS.map((m) => m.id)
  );
  const navigate = useNavigate();
  const { toast } = useToast();

  const toggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : [...prev, modelId]
    );
  };

  const selectAll = () => setSelectedModels(AVAILABLE_MODELS.map((m) => m.id));
  const selectNone = () => setSelectedModels([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/csv" || file.type === "application/json")) {
      setUploadedFile(file);
      toast({ title: "File selected", description: `${file.name} ready to upload.` });
    } else {
      toast({ title: "Invalid file type", description: "Please upload a CSV or JSON file.", variant: "destructive" });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      toast({ title: "File selected", description: `${file.name} ready to upload.` });
    }
  };

  const handleUseSample = async (sampleFile: string) => {
    const res = await fetch(`/samples/${sampleFile}`);
    const blob = await res.blob();
    const file = new File([blob], sampleFile, { type: "text/csv" });
    setUploadedFile(file);
    toast({ title: "Sample loaded", description: `${sampleFile} ready to upload.` });
  };

  const handleSubmit = async () => {
    if (!uploadedFile) return;
    setIsSubmitting(true);

    try {
      const upload = await uploadFile(uploadedFile);

      const datasetType = uploadedFile.name.endsWith(".json") ? "json" : "csv";
      const experiment = await createExperiment({
        name: uploadedFile.name.replace(/\.[^.]+$/, ""),
        blob_name: upload.blob_name,
        dataset_type: datasetType,
        models: selectedModels,
      });

      toast({ title: "Benchmark started", description: "Your experiment is being processed." });
      navigate(`/results?id=${experiment.id}`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Upload Your Data</h1>
          <p className="text-xl text-muted-foreground">
            Upload a dataset to benchmark how well embedding models capture its semantic structure
          </p>
        </div>

        {/* Sample Datasets */}
        <Card className="p-8 mb-6 shadow-elevation">
          <h2 className="text-2xl font-semibold mb-4">Try a Sample Dataset</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_DATASETS.map((sample) => (
              <div key={sample.file} className="p-4 border-2 border-border rounded-lg hover:border-primary transition-colors">
                <button
                  onClick={() => handleUseSample(sample.file)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{sample.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{sample.description}</p>
                </button>
                <a
                  href={`/samples/${sample.file}`}
                  download={sample.file}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="w-3 h-3" /> Download CSV
                </a>
              </div>
            ))}
          </div>
        </Card>

        {/* Upload Area */}
        <Card className="p-8 mb-6 shadow-elevation">
          <h2 className="text-2xl font-semibold mb-4">Or Upload Your Own</h2>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
            />

            {!uploadedFile ? (
              <>
                <UploadIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">Drop your file here</h3>
                <p className="text-muted-foreground mb-4">or</p>
                <Label htmlFor="file-upload">
                  <Button variant="hero" size="lg" asChild>
                    <span>Browse Files</span>
                  </Button>
                </Label>
                <p className="text-sm text-muted-foreground mt-4">
                  CSV or JSON with a <code className="text-primary">text</code> column (max 50MB)
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <CheckCircle2 className="w-12 h-12 text-accent" />
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-lg">{uploadedFile.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(uploadedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Label htmlFor="file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>Change File</span>
                  </Button>
                </Label>
              </div>
            )}
          </div>
        </Card>

        {/* Model Selection */}
        {uploadedFile && (
          <Card className="p-8 mb-6 shadow-elevation">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Choose Models</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select all
                </Button>
                <Button variant="outline" size="sm" onClick={selectNone}>
                  Select none
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {AVAILABLE_MODELS.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    selectedModels.includes(model.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <Checkbox
                    id={`model-${model.id}`}
                    checked={selectedModels.includes(model.id)}
                    onCheckedChange={() => toggleModel(model.id)}
                  />
                  <div>
                    <div className="font-medium text-sm">{model.label}</div>
                    <div className="text-xs text-muted-foreground">{model.provider}</div>
                  </div>
                </label>
              ))}
            </div>
            {selectedModels.length === 0 && (
              <p className="text-sm text-destructive mt-3">
                Select at least one model to start the benchmark.
              </p>
            )}
          </Card>
        )}

        {/* Format Hint */}
        {uploadedFile && (
          <Card className="p-6 mb-6 shadow-elevation">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
              <div className="text-sm">
                <div className="font-medium mb-1">Expected Format</div>
                <p className="text-muted-foreground">
                  CSV or JSON with a <code className="text-primary">text</code> column.
                  Each row should contain a document or passage to embed.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/")}>
            Cancel
          </Button>
          <Button
            variant="hero"
            size="lg"
            onClick={handleSubmit}
            disabled={!uploadedFile || isSubmitting || selectedModels.length === 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Start Benchmark"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Upload;
