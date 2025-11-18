import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const CTA = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-5" />
      
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ready to Find Your Perfect Model?
        </h2>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Stop settling for generic solutions. Get model recommendations tailored to your data, constraints, and use case.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" variant="hero" className="text-lg px-8 py-6" onClick={() => window.location.href = '/upload'}>
            Start Free Benchmark
            <ArrowRight className="ml-2" />
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6">
            View Documentation
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          No credit card required • Process up to 1,000 samples free
        </p>
      </div>
    </section>
  );
};

export default CTA;
