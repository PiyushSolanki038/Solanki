import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Linkedin, Mail } from "lucide-react";
import { leadershipData, LeadershipMember } from "@/data/leadershipData";
import { Button } from "@/ui/shadcn/button";
import { cn } from "@/core/utils/utils";

/**
 * LeadershipCard - Individual card component for each leadership member
 */
function LeadershipCard({ member }: { member: LeadershipMember }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <article
      className="group relative flex flex-col items-center p-6 bg-card rounded-2xl border border-border/50 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:scale-[1.02] hover:border-primary/20"
      role="article"
      aria-label={`${member.name}, ${member.role}`}
    >
      {/* Profile Image */}
      <div className="relative w-32 h-32 mb-4 rounded-full overflow-hidden ring-4 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted animate-pulse rounded-full" />
        )}
        <img
          src={member.imageUrl}
          alt={`Portrait of ${member.name}`}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            imageLoaded ? "opacity-100" : "opacity-0"
          )}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
        />
      </div>

      {/* Name & Role */}
      <h3 className="text-lg font-semibold text-foreground text-center">
        {member.name}
      </h3>
      <p className="text-sm font-medium text-primary mb-3">{member.role}</p>

      {/* Bio */}
      <p className="text-sm text-muted-foreground text-center leading-relaxed mb-4 line-clamp-3">
        {member.bio}
      </p>

      {/* Social Links */}
      <div className="flex items-center gap-3 mt-auto">
        {member.linkedIn && (
          <a
            href={member.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Visit ${member.name}'s LinkedIn profile`}
            className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors duration-200"
          >
            <Linkedin className="w-4 h-4" />
          </a>
        )}
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            aria-label={`Send email to ${member.name}`}
            className="p-2 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors duration-200"
          >
            <Mail className="w-4 h-4" />
          </a>
        )}
      </div>
    </article>
  );
}

/**
 * LeadershipSection - Responsive slider showcasing company leadership
 */
export function LeadershipSection() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      slidesToScroll: 1,
    },
    [
      Autoplay({
        delay: 4000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
  }, [emblaApi, onSelect]);

  return (
    <section
      className="py-20 lg:py-28 bg-muted/30"
      aria-labelledby="leadership-heading"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold tracking-wider uppercase bg-primary/10 text-primary rounded-full">
            Our Team
          </span>
          <h2
            id="leadership-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4"
          >
            Meet the Leadership Team
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            The visionaries driving SISWIT forward
          </p>
        </div>

        {/* Slider Container */}
        <div className="relative">
          {/* Navigation Arrows */}
          <Button
            variant="outline"
            size="icon"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 hidden md:flex h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-background hover:border-primary/30 disabled:opacity-50"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 hidden md:flex h-12 w-12 rounded-full bg-background/80 backdrop-blur-sm border-border/50 shadow-lg hover:bg-background hover:border-primary/30 disabled:opacity-50"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          {/* Embla Carousel */}
          <div className="overflow-hidden mx-0 md:mx-8" ref={emblaRef}>
            <div className="flex gap-6">
              {leadershipData.map((member) => (
                <div
                  key={member.id}
                  className="flex-none w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] xl:w-[calc(25%-18px)]"
                >
                  <LeadershipCard member={member} />
                </div>
              ))}
            </div>
          </div>

          {/* Mobile Navigation Arrows */}
          <div className="flex justify-center gap-4 mt-6 md:hidden">
            <Button
              variant="outline"
              size="icon"
              onClick={scrollPrev}
              className="h-10 w-10 rounded-full"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={scrollNext}
              className="h-10 w-10 rounded-full"
              aria-label="Next slide"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Pagination Dots */}
        <div
          className="flex justify-center gap-2 mt-8"
          role="tablist"
          aria-label="Slider pagination"
        >
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                selectedIndex === index
                  ? "bg-primary w-8"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              role="tab"
              aria-selected={selectedIndex === index}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
