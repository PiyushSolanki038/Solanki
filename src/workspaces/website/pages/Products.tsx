import { Header } from "@/workspaces/website/components/layout/Header";
import { Footer } from "@/workspaces/website/components/layout/Footer";
import { Button } from "@/ui/shadcn/button";
import { Link } from "react-router-dom";
import {
  Calculator, FileText, Users, ArrowRight, Check,
  Workflow, PenTool, Shield, BarChart3, Puzzle,
  RefreshCw, Target, LineChart, Mail, FileStack,
  Zap, History, Share2,Boxes,Factory,Truck
} from "lucide-react";

// Module visuals → intentional branding instead of random screenshots
import cpqCapabilityMap from "@/assets/cpq-capability-map.png";
import clmLifecycle from "@/assets/clm-lifecycle.png";
import crmDiagram from "@/assets/crm-diagram.png";
import automationVisual from "@/assets/automation-visual.png";

/* DATA MODELS */

// Centralized config = scalable + readable
// UI just consumes data, doesn’t make decisions
const modules = [
  {
    id: "cpq",
    icon: Calculator,
    name: "CPQ",
    title: "Configure, Price, Quote",
    description: "Accelerate sales with intelligent configuration and dynamic pricing.",
    image: cpqCapabilityMap,
    imageAlt: "CPQ Capability Map",
    features: [
      { icon: Workflow, title: "Configurator", desc: "Visual guided selling" },
      { icon: Calculator, title: "Dynamic Pricing", desc: "Rule-based discounts" },
      { icon: FileText, title: "Auto Quotes", desc: "Generate in seconds" },
      { icon: Check, title: "Approvals", desc: "Multi-level workflows" },
    ],
    benefits: ["50% faster quotes", "30% larger deals", "No pricing errors"],
  },
  {
    id: "clm",
    icon: FileText,
    name: "CLM",
    title: "Contract Management",
    description: "Manage lifecycle from creation to renewal with AI and compliance.",
    image: clmLifecycle,
    imageAlt: "CLM Lifecycle",
    features: [
      { icon: PenTool, title: "Smart Templates", desc: "Clause library access" },
      { icon: Users, title: "E-Signatures", desc: "Legally binding" },
      { icon: Shield, title: "Compliance", desc: "Auto monitoring" },
      { icon: RefreshCw, title: "Renewals", desc: "Proactive alerts" },
    ],
    benefits: ["65% faster turnaround", "Less legal review", "100% audit trail"],
  },
  {
    id: "crm",
    icon: Users,
    name: "CRM",
    title: "Customer Relations",
    description: "Deepen relationships with 360° views and predictive analytics.",
    image: crmDiagram,
    imageAlt: "CRM Diagram",
    features: [
      { icon: Target, title: "Lead Gen", desc: "Score & nurture" },
      { icon: LineChart, title: "Pipeline", desc: "Visual forecasting" },
      { icon: BarChart3, title: "Analytics", desc: "Deep insights" },
      { icon: Mail, title: "Comms Hub", desc: "Unified messaging" },
    ],
    benefits: ["45% better conversion", "Higher retention", "360° visibility"],
  },
  {
  id: "erp",
  icon: Users,
  name: "ERP",
  title: "Enterprise Resource Planning",
  description: "Centralize and automate core business processes across your organization.",
  image: crmDiagram, // replace with actual ERP image when available
  imageAlt: "ERP System Diagram",
  features: [
    { icon: Boxes, title: "Inventory", desc: "Real-time stock control" },
    { icon: FileText, title: "Finance", desc: "Accounting & reporting" },
    { icon: Factory, title: "Operations", desc: "Production & workflows" },
    { icon: Truck, title: "Supply Chain", desc: "Procurement to delivery" },
  ],
  benefits: [
    "Reduced operational costs",
    "Improved process efficiency",
    "Single source of truth"
  ],
}
,
  {
    id: "document-automation",
    icon: FileStack,
    name: "Doc Gen",
    title: "Intelligent Docs",
    description: "Create and deliver documents at scale with zero manual effort.",
    image: automationVisual,
    imageAlt: "Automation Visual",
    features: [
      { icon: Zap, title: "Dynamic Gen", desc: "PDF & DOCX" },
      { icon: Workflow, title: "Logic", desc: "Smart variables" },
      { icon: History, title: "History", desc: "Version control" },
      { icon: Share2, title: "Secure", desc: "Encrypted sharing" },
    ],
    benefits: ["80% less time", "Zero errors", "Full compliance"],
  },
];

// Flat list - faster render, easier scanning
const integrations = [
  "Salesforce", "HubSpot", "SAP", "Oracle", "Microsoft 365",
  "Slack", "DocuSign", "Stripe", "QuickBooks", "Zendesk"
];

const moduleAccentMap: Record<string, {
  iconShell: string;
  iconColor: string;
  bulletShell: string;
  bulletIcon: string;
  hoverBorder: string;
  cta: string;
}> = {
  cpq: {
    iconShell: "bg-gradient-to-br from-info/80 to-primary/80",
    iconColor: "text-white",
    bulletShell: "bg-info/20",
    bulletIcon: "text-info",
    hoverBorder: "hover:border-info/35",
    cta: "bg-info text-info-foreground hover:bg-info/90",
  },
  clm: {
    iconShell: "bg-gradient-to-br from-primary/90 to-chart-3/90",
    iconColor: "text-white",
    bulletShell: "bg-primary/20",
    bulletIcon: "text-primary",
    hoverBorder: "hover:border-primary/35",
    cta: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
  crm: {
    iconShell: "bg-gradient-to-br from-chart-3/85 to-info/85",
    iconColor: "text-white",
    bulletShell: "bg-chart-3/20",
    bulletIcon: "text-chart-3",
    hoverBorder: "hover:border-chart-3/35",
    cta: "bg-chart-3 text-white hover:bg-chart-3/90",
  },
  erp: {
    iconShell: "bg-gradient-to-br from-primary/85 to-info/80",
    iconColor: "text-white",
    bulletShell: "bg-primary/20",
    bulletIcon: "text-primary",
    hoverBorder: "hover:border-primary/35",
    cta: "bg-primary text-primary-foreground hover:bg-primary/90",
  },
  "document-automation": {
    iconShell: "bg-gradient-to-br from-success/80 to-info/80",
    iconColor: "text-white",
    bulletShell: "bg-success/20",
    bulletIcon: "text-success",
    hoverBorder: "hover:border-success/35",
    cta: "bg-success text-success-foreground hover:bg-success/90",
  },
};

const getModuleAccent = (moduleId: string) => moduleAccentMap[moduleId] ?? moduleAccentMap.cpq;

const Products = () => {
  return (
    // overflow-x-hidden avoids blur blobs causing sideways scroll
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />

      <main>
        {/* Hero Section */}
        {/* Mobile: tighter padding. Desktop: full viewport feel */}
        <section className="flex items-center justify-center relative overflow-hidden pt-20 pb-16 sm:min-h-screen sm:pt-24 sm:pb-0">

          {/* Decorative blob */}
          {/* Hidden on mobile to reduce clutter and wasted space */}
          <div className="hidden sm:block absolute top-1/2 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10" />

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <span className="text-primary font-semibold text-xs sm:text-sm uppercase tracking-wider animate-fade-up">
                Products
              </span>

              {/* Responsive typography: Leading adjusted for mobile readability */}
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-foreground mt-4 mb-6 leading-tight animate-fade-up">
                One Platform,{" "}
                <span className="text-gradient block sm:inline">
                  Infinite Possibilities
                </span>
              </h1>

              {/* Comfortable reading width on phones */}
              <p className="text-base sm:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto px-2 sm:px-0">
                SISWIT brings together CPQ, CLM, CRM, and Document Automation into a unified platform
                that transforms how you sell.
              </p>

              {/* Gentle scroll hint */}
              {/* <div className="animate-bounce mt-8 hidden sm:block">
                <span className="text-xs text-muted-foreground">Scroll to explore</span>
                <div className="w-5 h-8 border-2 border-muted-foreground/30 rounded-full mx-auto mt-2 flex justify-center p-1">
                  <div className="w-1 h-2 bg-primary rounded-full" />
                </div>
              </div> */}
            </div>
          </div>
        </section>

        {/* Product Modules */}
        {modules.map((module, index) => {
          const accent = getModuleAccent(module.id);
          return (
            <section
              key={module.id}
              id={module.id}
              // Mobile: py-12 (breathing room but not huge gaps) Desktop: Full screen focus.
              className={`py-12 lg:min-h-screen flex flex-col justify-center ${index % 2 === 0 ? "bg-secondary/0" : "bg-background"
                }`}
            >
              <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Mobile: Flex Column. Desktop: Grid */}
                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">

                {/* MOBILE LAYOUT LOGIC:
                  We always want the TEXT to appear first on mobile so the user has context before seeing the diagram.
                  On Desktop (lg), we use the Zig-Zag order
                */}
                <div className={`space-y-6 order-1 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${accent.iconShell}`}>
                      <module.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${accent.iconColor}`} />
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {module.title}
                      </span>
                      <h2 className="text-2xl sm:text-3xl sm:text-4xl font-bold leading-tight">
                        {module.name}
                      </h2>
                    </div>
                  </div>

                  <p className="text-sm sm:text-lg text-muted-foreground max-w-lg">
                    {module.description}
                  </p>

                  {/* Benefits */}
                  <div className="space-y-2">
                    {module.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${accent.bulletShell}`}>
                          <Check className={`w-2.5 h-2.5 ${accent.bulletIcon}`} />
                        </div>
                        <span className="text-sm sm:text-base font-medium">
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* CTA - Full width on mobile for better touch target */}
                  <Link to="/contact" className="block w-full sm:w-auto">
                    <Button className={`w-full sm:w-auto group ${accent.cta}`}>
                      Explore {module.name}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>

                {/* Image + Features Container 
                  Mobile: Order 2 (After text)
                  Desktop: Zig-Zag handled by lg:order-X
                */}
                <div className={`w-full order-2 ${index % 2 === 1 ? "lg:order-1" : ""}`}>
                  <div className="flex justify-center mb-6">
                    <img
                      src={module.image}
                      alt={module.imageAlt}
                      // Ensure image scales down on small screens without breaking ratio
                      className="w-full h-auto max-h-[200px] sm:max-h-[350px] lg:max-h-[400px] object-contain"
                    />
                  </div>

                  {/* Mobile Optimization: 
                    Switched from horizontal scroll to a 2-col Grid. 
                    Horizontal scroll on mobile product pages feels "slippery" and hides content 
                    Grid creates a solid "dashboard" feel
                  */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {module.features.map((feature) => (
                      <div
                        key={feature.title}
                        className={`p-3 sm:p-4 rounded-lg bg-card border border-border transition flex flex-col justify-between ${accent.hoverBorder}`}
                      >
                        <feature.icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-2 ${accent.bulletIcon}`} />
                        <div>
                          <h3 className="text-sm font-semibold mb-1">
                            {feature.title}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {feature.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                </div>
              </div>
            </section>
          );
        })}

        {/* Integrations */}
        <section className="py-16 sm:py-20">
          <div className="container mx-auto px-4 text-center">
            <Puzzle className="w-10 h-10 text-primary mx-auto mb-4" />
            <h2 className="text-3xl sm:text-5xl font-bold mb-4">
              Seamless Integrations
            </h2>
            <p className="text-muted-foreground mb-8">
              Works with your existing tools — no disruption.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {integrations.map((name) => (
                <span
                  key={name}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-card border text-sm font-medium whitespace-nowrap"
                >
                  {name}
                </span>
              ))}
              <span className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                + 90 more
              </span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-20 gradient-hero text-center px-4">
          <h2 className="text-3xl sm:text-5xl font-bold mb-6">
            Ready to see it in action?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Get a personalized demo and see the platform in action.
          </p>
          <Link to="/contact">
            <Button size="xl" className="w-full sm:w-auto">
              Request Demo
            </Button>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Products;
