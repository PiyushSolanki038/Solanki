import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Phone } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import ctaGrowthBg from "@/assets/cta-growth-bg.png";

export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Image with overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={ctaGrowthBg}
          alt="Business growth and digital transformation visualization"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 gradient-hero" />
      </div>
      
      {/* Animated orbs */}
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/30 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-accent/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "-2s" }} />

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Ready to Transform Your{" "}
            <span className="text-gradient">Business Operations?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Join 500+ enterprises that have already streamlined their CPQ, CLM, and CRM 
            processes with SISWIT. Get started with a personalized demo today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <Button variant="hero" size="xl" className="group w-full sm:w-auto">
                <Calendar className="w-5 h-5" />
                Schedule Demo
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="heroOutline" size="xl" className="w-full sm:w-auto">
                <Phone className="w-5 h-5" />
                Talk to Sales
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 pt-8 border-t border-border/20">
            <p className="text-sm text-muted-foreground mb-4">
              Trusted by industry leaders
            </p>
            <div className="flex flex-wrap justify-center gap-8 opacity-60">
              {["Fortune 500", "Gartner Recognized", "SOC 2 Certified", "ISO 27001"].map((badge) => (
                <span key={badge} className="text-sm font-medium text-foreground">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
