import { Brain, DollarSign, Gauge, Shield, Cloud, LineChart } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <Brain className="w-8 h-8" />,
      title: "MTEB Integration",
      description: "Direct access to the most comprehensive embedding model leaderboard with 150+ models evaluated."
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: "Cost-Aware Selection",
      description: "Filter and compare models based on inference costs to optimize your budget without sacrificing quality."
    },
    {
      icon: <Gauge className="w-8 h-8" />,
      title: "Performance Metrics",
      description: "Detailed benchmarks across retrieval accuracy, classification F1, and embedding quality scores."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure Processing",
      description: "Your data is processed securely and never stored. Full privacy compliance for enterprise workloads."
    },
    {
      icon: <Cloud className="w-8 h-8" />,
      title: "Azure-Powered",
      description: "Built on Azure infrastructure for reliability and scalability. Compute-heavy tasks run on Azure Functions."
    },
    {
      icon: <LineChart className="w-8 h-8" />,
      title: "LLM-as-Judge",
      description: "Advanced evaluation using Azure OpenAI for cases without labeled data, ensuring accurate quality assessment."
    }
  ];

  return (
    <section id="features" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Powerful Features</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to make data-driven embedding model decisions
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group bg-card border border-border rounded-xl p-8 hover:shadow-elevation transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-accent opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
              <div className="relative">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-accent/10 text-accent mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
