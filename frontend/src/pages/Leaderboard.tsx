import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpDown, CheckCircle2, ExternalLink, PlayCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Model {
  id: string;
  name: string;
  organization: string;
  size: number;
  cost: number;
  mtebScore: number;
  retrievalScore: number;
  classificationScore: number;
  selected?: boolean;
}

const mockModels: Model[] = [
  {
    id: "1",
    name: "bge-large-en-v1.5",
    organization: "BAAI",
    size: 335,
    cost: 2.5,
    mtebScore: 89.2,
    retrievalScore: 91.5,
    classificationScore: 87.3,
  },
  {
    id: "2",
    name: "gte-large",
    organization: "Alibaba",
    size: 335,
    cost: 2.3,
    mtebScore: 88.7,
    retrievalScore: 90.8,
    classificationScore: 86.9,
  },
  {
    id: "3",
    name: "e5-large-v2",
    organization: "Microsoft",
    size: 335,
    cost: 2.8,
    mtebScore: 88.4,
    retrievalScore: 90.2,
    classificationScore: 86.5,
  },
  {
    id: "4",
    name: "instructor-xl",
    organization: "GTR",
    size: 1340,
    cost: 8.5,
    mtebScore: 87.9,
    retrievalScore: 89.7,
    classificationScore: 85.8,
  },
  {
    id: "5",
    name: "bge-base-en-v1.5",
    organization: "BAAI",
    size: 109,
    cost: 1.2,
    mtebScore: 86.5,
    retrievalScore: 88.3,
    classificationScore: 84.2,
  },
];

const Leaderboard = () => {
  const navigate = useNavigate();
  const [models] = useState<Model[]>(mockModels);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "size" | "cost">("score");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  const toggleModelSelection = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const sortedModels = [...models].sort((a, b) => {
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

  const filteredModels = sortedModels.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.organization.toLowerCase().includes(searchQuery.toLowerCase())
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
            {filteredModels.length} models match your constraints
          </p>
        </div>

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

            <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as "score" | "size" | "cost")}>
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
          </div>
        </Card>

        {/* Selected Models Banner */}
        {selectedModels.length > 0 && (
          <Card className="p-4 mb-6 shadow-elevation bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="font-medium">
                  {selectedModels.length} model{selectedModels.length > 1 ? "s" : ""} selected
                </span>
              </div>
              <Button variant="hero" onClick={() => navigate("/results")}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Start Benchmarking
              </Button>
            </div>
          </Card>
        )}

        {/* Models Grid */}
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
                      {selectedModels.includes(model.id) && (
                        <Badge className="bg-primary">Selected</Badge>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">MTEB Score</div>
                        <div className="text-2xl font-bold text-primary">
                          {model.mtebScore}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Retrieval</div>
                        <div className="text-lg font-semibold">{model.retrievalScore}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Classification</div>
                        <div className="text-lg font-semibold">
                          {model.classificationScore}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Size</div>
                        <div className="text-lg font-semibold">{model.size} MB</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Cost</div>
                        <div className="text-lg font-semibold text-accent">
                          ${model.cost}/M
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-5 h-5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-8">
          <Button variant="outline" size="lg" onClick={() => navigate("/constraints")}>
            Adjust Constraints
          </Button>
          <Button
            variant="hero"
            size="lg"
            disabled={selectedModels.length === 0}
            onClick={() => navigate("/results")}
          >
            Benchmark Selected ({selectedModels.length})
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
