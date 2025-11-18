import { Button } from "@/components/ui/button";
import { ArrowRight, Database, Zap, TrendingUp } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="AI Embeddings Background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-block mb-6 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full backdrop-blur-sm">
          <span className="text-sm font-medium text-primary">Powered by MTEB Leaderboard</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent leading-tight">
          Find the Perfect
          <br />
          Embedding Model
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
          Stop guessing. Benchmark top models on your data with constraints that matter—size, cost, and performance.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Button size="lg" variant="hero" className="text-lg px-8 py-6" onClick={() => window.location.href = '/upload'}>
            Start Benchmarking
            <ArrowRight className="ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6" onClick={() => window.location.href = '/leaderboard'}>
            View Leaderboard
          </Button>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-20">
          <FeatureCard
            icon={<Database className="w-8 h-8" />}
            title="Upload Your Data"
            description="Bring your retrieval or classification tasks. We'll handle the rest."
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Set Constraints"
            description="Filter by model size, pricing, and performance requirements."
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Get Insights"
            description="See which models excel on your data with detailed benchmark results."
          />
        </div>
      </div>
    </section>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => {
  return (
    <div className="group relative bg-card border border-border rounded-xl p-6 hover:shadow-elevation transition-all duration-300 hover:-translate-y-1">
      <div className="absolute inset-0 bg-gradient-primary opacity-0 group-hover:opacity-5 rounded-xl transition-opacity duration-300" />
      <div className="relative">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-gradient-primary group-hover:text-primary-foreground transition-all duration-300">
          {icon}
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

export default Hero;
