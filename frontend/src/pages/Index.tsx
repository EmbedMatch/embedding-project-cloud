import Hero from "@/components/Hero";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import CTA from "@/components/CTA";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <footer className="border-t border-border py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-gradient-primary" />
            <span className="text-lg font-bold">EmbedMatch</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2025 EmbedMatch. Powered by MTEB and Azure.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
