import { useState } from "react";
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const Upload = () => {
  const [taskType, setTaskType] = useState<"retrieval" | "classification">("retrieval");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  const continueFlow = useMutation({
    mutationFn: async (file: File) => {
      // 1. Upload file to blob storage
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch(`${API_URL}/uploads/`, { method: "POST", body: form });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail ?? "Upload failed");
      }
      const { blob_name, url } = await uploadRes.json();

      // 2. Create experiment
      const expRes = await fetch(`${API_URL}/experiments/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_type: taskType, blob_name, blob_url: url }),
      });
      if (!expRes.ok) {
        const err = await expRes.json().catch(() => ({ detail: "Failed to create experiment" }));
        throw new Error(err.detail ?? "Failed to create experiment");
      }
      return expRes.json();
    },
    onSuccess: (experiment) => {
      localStorage.setItem("experimentId", experiment.id);
      navigate("/constraints");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-hero pt-20 pb-12">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">Upload Your Data</h1>
          <p className="text-xl text-muted-foreground">
            Provide your task-specific data to benchmark embedding models
          </p>
        </div>

        {/* Task Type Selection */}
        <Card className="p-8 mb-6 shadow-elevation">
          <h2 className="text-2xl font-semibold mb-4">Select Task Type</h2>
          <RadioGroup value={taskType} onValueChange={(v) => setTaskType(v as any)} className="gap-4">
            <div className="flex items-start space-x-3 p-4 border-2 border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="retrieval" id="retrieval" className="mt-1" />
              <Label htmlFor="retrieval" className="cursor-pointer flex-1">
                <div className="font-semibold text-lg mb-1">Retrieval</div>
                <p className="text-sm text-muted-foreground">
                  Upload queries and documents. We'll evaluate how well models retrieve relevant documents.
                </p>
                <div className="mt-2 text-xs text-accent font-medium">
                  Format: CSV/JSON with a 'text' or 'document' column
                </div>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-4 border-2 border-border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <RadioGroupItem value="classification" id="classification" className="mt-1" />
              <Label htmlFor="classification" className="cursor-pointer flex-1">
                <div className="font-semibold text-lg mb-1">Classification</div>
                <p className="text-sm text-muted-foreground">
                  Upload labeled examples. We'll test classification accuracy across models.
                </p>
                <div className="mt-2 text-xs text-accent font-medium">
                  Format: CSV/JSON with 'text' and 'label' fields
                </div>
              </Label>
            </div>
          </RadioGroup>
        </Card>

        {/* Upload Area */}
        <Card className="p-8 mb-6 shadow-elevation">
          <h2 className="text-2xl font-semibold mb-4">Upload Data File</h2>

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
            <input type="file" accept=".csv,.json" onChange={handleFileInput} className="hidden" id="file-upload" />

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
                <p className="text-sm text-muted-foreground mt-4">Supported formats: CSV, JSON (max 50MB)</p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <CheckCircle2 className="w-12 h-12 text-accent" />
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-lg">{uploadedFile.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{(uploadedFile.size / 1024).toFixed(2)} KB</p>
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

        {/* Data Preview */}
        {uploadedFile && (
          <Card className="p-8 mb-6 shadow-elevation">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Data Preview</h2>
              <Button variant="ghost" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download Sample
              </Button>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div className="text-muted-foreground mb-2">// Expected structure</div>
              {taskType === "retrieval" ? (
                <pre>{`[
  { "text": "A comprehensive guide to training neural networks..." },
  { "text": "Introduction to transformer architectures..." }
]`}</pre>
              ) : (
                <pre>{`[
  { "text": "This product is amazing!", "label": "positive" },
  { "text": "Very disappointed with quality.", "label": "negative" }
]`}</pre>
              )}
            </div>

            <div className="mt-4 p-4 bg-accent/5 border border-accent/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
              <div className="text-sm">
                <div className="font-medium mb-1">Data Processing</div>
                <p className="text-muted-foreground">
                  Your file will be uploaded to Azure Blob Storage. The benchmark engine will automatically detect text columns and generate evaluation queries.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Continue Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" size="lg" onClick={() => navigate("/")}>
            Cancel
          </Button>
          <Button
            variant="hero"
            size="lg"
            onClick={() => uploadedFile && continueFlow.mutate(uploadedFile)}
            disabled={!uploadedFile || continueFlow.isPending}
          >
            {continueFlow.isPending ? "Uploading…" : "Continue to Constraints"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Upload;
