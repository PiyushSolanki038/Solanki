import { Header } from "@/workspaces/website/components/layout/Header";
import { Footer } from "@/workspaces/website/components/layout/Footer";
import { HeroSection } from "@/workspaces/website/components/sections/HeroSection";
import { FeaturesSection } from "@/workspaces/website/components/sections/FeaturesSection";
import { WhySection } from "@/workspaces/website/components/sections/WhySection";
import { LeadershipSection } from "@/workspaces/website/components/sections/LeadershipSection";
import { CTASection } from "@/workspaces/website/components/sections/CTASection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <FeaturesSection />
        <WhySection />
        <LeadershipSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
