import { Header } from "@/workspaces/website/components/layout/Header";
import { Footer } from "@/workspaces/website/components/layout/Footer";
import { Button } from "@/ui/shadcn/button";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Building2, Rocket, Users, ArrowRight, Check,
  Briefcase, HeartPulse, Landmark, ShoppingCart,
  Factory, Plane, GraduationCap, Tv
} from "lucide-react";
import solutionsIndustries from "@/assets/solutions-industries.png";

/* ---------------- DATA ---------------- */

const businessSizes = [
  {
    id: "enterprise",
    icon: Building2,
    title: "Enterprise",
    subtitle: "1000+ employees",
    description:
      "Scalable solutions for complex organizations with advanced security, compliance, and customization.",
    features: [
      "Unlimited users and storage",
      "Advanced security (SSO, SCIM)",
      "Custom integrations & APIs",
      "Dedicated success manager",
      "24/7 priority support",
      "On-premise deployment",
    ],
  },
  {
    id: "midmarket",
    icon: Users,
    title: "Mid-Market",
    subtitle: "100–999 employees",
    description:
      "Powerful tools with flexibility to scale as your business grows.",
    features: [
      "Up to 500 users",
      "Role-based access",
      "Standard integrations",
      "Onboarding support",
      "Business-hours support",
      "Cloud deployment",
    ],
  },
  {
    id: "startups",
    icon: Rocket,
    title: "Startups",
    subtitle: "Under 100 employees",
    description:
      "Launch fast with essential features and grow at your own pace.",
    features: [
      "Up to 50 users",
      // Updated line to include Auto Document and ERP
      "CPQ, CLM, CRM, Auto Doc & ERP", 
      "Essential integrations",
      "Self-service onboarding",
      "Email support",
      "Cloud deployment",
    ],
  },
];

type Industry = {
  icon: typeof Briefcase;
  title: string;
  description: string;
};

const industries: Industry[] = [
  { icon: Briefcase, title: "Professional Services", description: "Proposals, contracts & client management." },
  { icon: HeartPulse, title: "Healthcare", description: "HIPAA-ready vendor & relationship tools." },
  { icon: Landmark, title: "Financial Services", description: "Secure platforms for complex financial products." },
  { icon: ShoppingCart, title: "Retail & E-commerce", description: "Unified pricing & supplier contracts." },
  { icon: Factory, title: "Manufacturing", description: "Product configuration & distributor management." },
  { icon: Plane, title: "Travel & Hospitality", description: "Dynamic pricing & partner contracts." },
  { icon: GraduationCap, title: "Education", description: "Enrollment & vendor relationship tools." },
  { icon: Tv, title: "Media & Entertainment", description: "Rights & talent contract management." },
];

/* ---------------- INDUSTRY SECTION ---------------- */

const IndustrySolutions = ({ industries }: { industries: Industry[] }) => {
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisible((v) => new Set(v).add(index));
            obs.disconnect();
          }
        },
        { threshold: 0.2 }
      );

      obs.observe(card);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section className="py-20 bg-secondary/0">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Industry-Specific Solutions
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Built-in workflows and integrations designed for your industry.
            </p>
          </div>

          <img
            src={solutionsIndustries}
            alt="Industry solutions"
            className="hidden lg:block rounded-2xl"
          />
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((item, i) => (
            <div
              key={item.title}
              ref={(el) => (cardRefs.current[i] = el)}
              className={`p-6 rounded-xl bg-card border transition-all duration-500
                ${visible.has(i) ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}
                hover:-translate-y-2 hover:shadow-lg`}
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ---------------- MAIN PAGE ---------------- */

const Solutions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20">
        {/* HERO */}
        <section className="py-20 gradient-hero text-center">
          <div className="container mx-auto px-4 max-w-3xl">
            <span className="text-primary text-sm font-semibold uppercase">
              Solutions
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold mt-4 mb-6">
              Tailored for Your <span className="text-gradient">Business</span>
            </h1>
            <p className="text-muted-foreground">
              From startups to enterprises, SISWIT grows with you.
            </p>
          </div>
        </section>

        {/* BUSINESS SIZE */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8">
              {businessSizes.map((size) => (
                <div
                  key={size.id}
                  className="bg-card p-8 rounded-2xl border hover:-translate-y-2 transition"
                >
                  <size.icon className="w-10 h-10 text-primary mb-4" />
                  <h3 className="text-xl font-bold">{size.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{size.subtitle}</p>
                  <p className="text-sm mb-6">{size.description}</p>

                  <ul className="space-y-2 mb-6">
                    {size.features.map((f) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link to="/contact">
                    <Button className="w-full">
                      Get Started <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <IndustrySolutions industries={industries} />

        {/* CTA */}
        <section className="py-20 gradient-hero text-center">
          <h2 className="text-3xl font-bold mb-4">
            Not sure what fits you?
          </h2>
          <p className="text-muted-foreground mb-6">
            Let our experts guide you.
          </p>
          <Link to="/contact">
            <Button size="lg">
              Talk to an Expert <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Solutions;
