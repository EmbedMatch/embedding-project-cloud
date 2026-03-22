import { useState } from "react";
import { Upload as UploadIcon, FileText, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, createExperiment } from "@/lib/api";

const SAMPLE_DATASETS = [
  { name: "Tech Articles", file: "tech-articles.csv", description: "10 ML/AI concept descriptions" },
  { name: "Product Reviews", file: "product-reviews.csv", description: "10 consumer product descriptions" },
  { name: "News Headlines", file: "news-headlines.csv", description: "10 world news stories" },
];

const Upload = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
              <button
                key={sample.file}
                onClick={() => handleUseSample(sample.file)}
                className="p-4 border-2 border-border rounded-lg hover:border-primary transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Download className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{sample.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">{sample.description}</p>
              </button>
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
            disabled={!uploadedFile || isSubmitting}
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
