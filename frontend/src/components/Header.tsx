import { Button } from "@/components/ui/button";

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary" />
          <span className="text-xl font-bold">EmbedMatch</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </a>
          <a href="/leaderboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Models
          </a>
          <a href="/test" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Status
          </a>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="hero" onClick={() => window.location.href = '/upload'}>Get Started</Button>
        </div>
      </nav>
    </header>
  );
};

export default Header;
