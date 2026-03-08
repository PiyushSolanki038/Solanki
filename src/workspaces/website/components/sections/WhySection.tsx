import { Shield, Zap, TrendingUp, Bot, Lock, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const reasons = [
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "SOC 2 Type II certified with end-to-end encryption, role-based access controls, and comprehensive audit logs.",
  },
  {
    icon: Zap,
    title: "Lightning Performance",
    description: "99.99% uptime SLA with global CDN distribution ensuring sub-second response times worldwide.",
  },
  {
    icon: TrendingUp,
    title: "Infinite Scalability",
    description: "Auto-scaling infrastructure that grows with your business, from startup to Fortune 500.",
  },
  {
    icon: Bot,
    title: "AI-Powered Insights",
    description: "Machine learning models that predict trends, automate tasks, and surface actionable insights.",
  },
  {
    icon: Lock,
    title: "Compliance Ready",
    description: "Built-in compliance for GDPR, HIPAA, and SOX with automated policy enforcement.",
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Multi-region deployment with data residency options to meet local regulations.",
  },
];

const stats = [
  { value: "500+", label: "Enterprise Clients" },
  { value: "99.99%", label: "Uptime SLA" },
  { value: "50M+", label: "Contracts Processed" },
  { value: "150+", label: "Countries Served" },
];

export function WhySection() {
  const [isVisible, setIsVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const statsObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    if (statsRef.current) {
      statsObserver.observe(statsRef.current);
    }

    return () => {
      observer.disconnect();
      statsObserver.disconnect();
    };
  }, []);

  return (
    <section className="py-24 bg-secondary/0 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }} />
      </div>

      {/* Floating gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div 
          ref={sectionRef}
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="text-primary font-semibold text-sm uppercase tracking-wider inline-block">
            Why Choose SISWIT
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mt-4 mb-6">
            Built for Enterprise,{" "}
            <span className="text-gradient">Loved by Teams</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            We've engineered SISWIT to meet the most demanding enterprise requirements 
            while keeping it intuitive enough for every team member.
          </p>
        </div>

        {/* Reasons Grid with staggered animations */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {reasons.map((reason, index) => (
            <div
              key={reason.title}
              className={`group p-6 rounded-xl bg-card border border-border transition-all duration-500 
                hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-2 hover:scale-[1.02]
                ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
              style={{ 
                transitionDelay: isVisible ? `${index * 100}ms` : '0ms',
              }}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 
                group-hover:bg-primary/20 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                <reason.icon className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                {reason.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {reason.description}
              </p>
              {/* Animated bottom border */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent 
                scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-xl" />
            </div>
          ))}
        </div>

        {/* Stats with counter animation effect */}
        <div 
          ref={statsRef}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <div 
              key={stat.label} 
              className={`text-center group transition-all duration-700 ${
                statsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
              }`}
              style={{ transitionDelay: statsVisible ? `${index * 150}ms` : '0ms' }}
            >
              <div className="text-4xl sm:text-5xl font-bold text-gradient mb-2 
                group-hover:scale-110 transition-transform duration-300">
                {stat.value}
              </div>
              <div className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
