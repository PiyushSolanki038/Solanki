import { Header } from "@/workspaces/website/components/layout/Header";
import { Footer } from "@/workspaces/website/components/layout/Footer";
import { Button } from "@/ui/shadcn/button";
import { Link } from "react-router-dom";
import { Check, X, ArrowRight, HelpCircle } from "lucide-react";
import { useState } from "react";

const plans = [
  {
    name: "Starter",
    // Added ERP to description
    description: "Perfect for small teams getting started with CPQ, CLM, CRM, and ERP.",
    price: { monthly: 49, annually: 39 },
    popular: false,
    features: [
      { name: "Up to 10 users", included: true },
      { name: "CPQ Basic", included: true },
      { name: "CLM Basic", included: true },
      { name: "CRM Basic", included: true },
      // Added ERP Basic feature
      { name: "ERP Basic", included: true },
      { name: "5,000 records", included: true },
      { name: "Email support", included: true },
      { name: "Basic integrations", included: true },
      { name: "Standard reports", included: true },
      { name: "API access", included: false },
      { name: "Custom workflows", included: false },
      { name: "Advanced analytics", included: false },
      { name: "Dedicated support", included: false },
    ],
  },
  {
    name: "Professional",
    description: "For growing teams that need advanced features and integrations.",
    price: { monthly: 99, annually: 79 },
    popular: true,
    features: [
      { name: "Up to 50 users", included: true },
      { name: "CPQ Advanced", included: true },
      { name: "CLM Advanced", included: true },
      { name: "CRM Advanced", included: true },
      // Added ERP Advanced feature
      { name: "ERP Advanced", included: true },
      { name: "50,000 records", included: true },
      { name: "Priority support", included: true },
      { name: "All integrations", included: true },
      { name: "Advanced reports", included: true },
      { name: "API access", included: true },
      { name: "Custom workflows", included: true },
      { name: "Advanced analytics", included: false },
      { name: "Dedicated support", included: false },
    ],
  },
  {
    name: "Enterprise",
    description: "For large organizations with complex requirements and compliance needs.",
    price: { monthly: null, annually: null },
    popular: false,
    features: [
      { name: "Unlimited users", included: true },
      { name: "CPQ Enterprise", included: true },
      { name: "CLM Enterprise", included: true },
      { name: "CRM Enterprise", included: true },
      // Added ERP Enterprise feature
      { name: "ERP Enterprise", included: true },
      { name: "Unlimited records", included: true },
      { name: "24/7 support", included: true },
      { name: "Custom integrations", included: true },
      { name: "Custom reports", included: true },
      { name: "Full API access", included: true },
      { name: "Custom workflows", included: true },
      { name: "Advanced analytics", included: true },
      { name: "Dedicated support", included: true },
    ],
  },
];

const faqs = [
  {
    question: "Can I switch plans later?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! We offer a 14-day free trial on all plans with full feature access. No credit card required.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards, ACH transfers, and wire transfers for enterprise accounts.",
  },
  {
    question: "Do you offer discounts for nonprofits?",
    answer:
      "Yes, we offer special pricing for nonprofits and educational institutions. Contact us for details.",
  },
];

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    // Reverted to min-h-screen and removed snap/overflow classes so the Header stickiness/blur works correctly with window scroll
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {/* Hero */}
        {/* Kept min-h-screen to maintain the section-wise feel but allowed natural scrolling */}
        <section className="min-h-screen flex flex-col justify-center pt-28 pb-10 gradient-hero relative overflow-hidden">
          <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl mx-auto text-center">
              <span className="text-primary font-semibold text-sm uppercase tracking-wider">
                Pricing
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mt-4 mb-6">
                Simple, Transparent{" "}
                <span className="text-gradient">Pricing</span>
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                {/* Updated text to include ERP */}
                Choose the plan that fits your business. All plans include our core CPQ, CLM, CRM, and ERP features.
              </p>

              {/* Toggle */}
              <div className="inline-flex items-center gap-4 p-1 rounded-xl bg-secondary/0 border border-border">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    !isAnnual
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-6 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    isAnnual
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Annual
                  <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        {/* Kept large padding and flex center to maintain focus on cards */}
        <section className="min-h-screen flex flex-col justify-center py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative bg-card rounded-2xl p-8 border flex flex-col ${
                    plan.popular
                      ? "border-primary shadow-glow scale-105 z-10"
                      : "border-border shadow-card"
                  } hover:shadow-card-hover transition-all duration-300`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-primary-foreground text-sm font-medium">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </h3>
                  {/* Added min-h to description to prevent minor misalignments if text length varies significantly */}
                  <p className="text-muted-foreground text-sm mb-6 min-h-[40px]">
                    {plan.description}
                  </p>

                  {/* Added fixed minimum height and flex-col/justify-end here. 
                      This forces the price container to be the same height on all cards,
                      aligning the buttons immediately below. */}
                  <div className="mb-8 min-h-[8rem] flex flex-col justify-end">
                    {plan.price.monthly ? (
                      <>
                        <div>
                          <span className="text-5xl font-bold text-foreground">
                            ₹{isAnnual ? plan.price.annually : plan.price.monthly}
                          </span>
                          <span className="text-muted-foreground ml-1">
                            /user/month
                          </span>
                        </div>
                        {isAnnual && (
                          <p className="text-sm text-primary mt-1">
                            Billed annually
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-foreground pb-2">
                        Custom Pricing
                      </span>
                    )}
                  </div>

                  <Link to="/contact">
                    <Button
                      variant={plan.popular ? "hero" : "outline"}
                      className="w-full mb-8"
                    >
                      {plan.price.monthly
                        ? "Start Free Trial"
                        : "Contact Sales"}
                    </Button>
                  </Link>

                  <ul className="space-y-3 flex-grow">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.name}
                        className="flex items-center gap-3"
                      >
                        {feature.included ? (
                          <Check className="w-5 h-5 text-primary flex-shrink-0" />
                        ) : (
                          <X className="w-5 h-5 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        <span
                          className={
                            feature.included
                              ? "text-foreground"
                              : "text-muted-foreground/60"
                          }
                        >
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="min-h-[80vh] flex flex-col justify-center py-20 bg-secondary/0">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <HelpCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="space-y-6">
                {faqs.map((faq) => (
                  <div
                    key={faq.question}
                    className="p-6 rounded-xl bg-card border border-border"
                  >
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {faq.question}
                    </h3>
                    <p className="text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 gradient-hero">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                Ready to get started?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Start your 14-day free trial today. No credit card required.
              </p>
              <Link to="/contact">
                <Button variant="hero" size="xl" className="group">
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;