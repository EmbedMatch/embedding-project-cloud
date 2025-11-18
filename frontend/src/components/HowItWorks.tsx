import { Upload, Settings, BarChart3, Award } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      icon: <Upload className="w-10 h-10" />,
      title: "Upload Your Data",
      description: "Provide your task-specific data: queries and documents for retrieval, or labeled examples for classification.",
      step: "01"
    },
    {
      icon: <Settings className="w-10 h-10" />,
      title: "Define Constraints",
      description: "Set your requirements: maximum model size, budget limits, and performance thresholds.",
      step: "02"
    },
    {
      icon: <BarChart3 className="w-10 h-10" />,
      title: "Automated Benchmarking",
      description: "Our platform selects candidate models from MTEB and runs comprehensive benchmarks on your data.",
      step: "03"
    },
    {
      icon: <Award className="w-10 h-10" />,
      title: "Get Recommendations",
      description: "Receive detailed insights and clear recommendations on which model best fits your specific use case.",
      step: "04"
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">How It Works</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Four simple steps to find your ideal embedding model
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <div className="bg-card border border-border rounded-xl p-6 h-full hover:shadow-elevation transition-all duration-300 hover:-translate-y-1">
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
                  {step.step}
                </div>
                
                <div className="mt-4 mb-4 inline-flex items-center justify-center w-16 h-16 rounded-lg bg-accent/10 text-accent">
                  {step.icon}
                </div>
                
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary to-accent" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
