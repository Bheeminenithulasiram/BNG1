import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGenerateBrands } from "@workspace/api-client-react";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ArrowUp, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import BrandDetails from "@/components/BrandDetails";

type BrandSuggestion = {
  name: string;
  tagline: string;
  suggestedDomain: string;
};

const formSchema = z.object({
  description: z.string().min(1, "Please describe what you're building").max(500, "Too long"),
  category: z.string().min(2, "Please select or enter a category"),
  keywords: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

// The Radix Select uses react-remove-scroll, which can leave the page scroll-locked
// (body[data-scroll-locked] → overflow:hidden, plus pointer-events:none) after it
// closes — that prevents the user from scrolling back up. Clear any leftover lock.
function releaseScrollLock() {
  document.body.removeAttribute("data-scroll-locked");
  if (document.body.style.pointerEvents === "none") {
    document.body.style.pointerEvents = "";
  }
}

// Smoothness is handled by `scroll-behavior: smooth` on <html> (see index.css).
// This plain call animates in browsers that support it and falls back to an
// instant jump where it doesn't — either way it reliably reaches the target.
function smoothScrollTo(targetY: number) {
  window.scrollTo(0, targetY);
}

// Absolute document offset of an element's top.
function offsetTop(el: HTMLElement | null): number {
  return el ? el.getBoundingClientRect().top + window.scrollY : 0;
}

export default function Home() {
  const [brands, setBrands] = useState<BrandSuggestion[]>([]);
  const generateBrandsMutation = useGenerateBrands();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [scrollNonce, setScrollNonce] = useState(0);
  const [generateNonce, setGenerateNonce] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const resultsRef = useRef<HTMLElement | null>(null);
  const detailsRef = useRef<HTMLElement | null>(null);

  const [activeTab, setActiveTab] = useState<"generate" | "check">("generate");
  const [customName, setCustomName] = useState("");

  function handleTabChange(tab: "generate" | "check") {
    setActiveTab(tab);
    setBrands([]);
    setSelectedIndex(null);
    setCustomName("");
    form.reset();
  }

  function handleCustomCheck() {
    const trimmed = customName.trim();
    if (!trimmed) return;

    const suggestedDomain = `${trimmed.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
    setBrands([
      {
        name: trimmed,
        tagline: "Custom Brand Name Search",
        suggestedDomain,
      },
    ]);
    setSelectedIndex(0);
    setGenerateNonce((n) => n + 1);
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
      category: "",
      keywords: ""
    }
  });

  function onSubmit(values: FormValues) {
    setSelectedIndex(null);
    generateBrandsMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          setBrands(data);
          setGenerateNonce((n) => n + 1);
        }
      }
    );
  }

  function handleSelectChip(index: number) {
    setSelectedIndex(index);
    setScrollNonce((n) => n + 1);
  }

  // Scroll up to the previous section (details → chips → hero), one step per click.
  function scrollUpOneSection() {
    const tops = [0]; // hero / form section
    if (resultsRef.current) tops.push(offsetTop(resultsRef.current));
    if (detailsRef.current) tops.push(offsetTop(detailsRef.current));
    tops.sort((a, b) => a - b);

    const y = window.scrollY;
    // Nearest section top strictly above the current position.
    const target = tops.filter((t) => t < y - 2).pop() ?? 0;
    smoothScrollTo(target);
    setShowBackToTop(target > 0);
  }
  // Show the "back to top" button once the user scrolls past the hero.
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // After generating, scroll the brands section to fill the viewport.
  useEffect(() => {
    if (generateNonce > 0) {
      releaseScrollLock();
      smoothScrollTo(offsetTop(resultsRef.current));
      setShowBackToTop(true);
    }
  }, [generateNonce]);

  // After picking a chip, scroll the details section to fill the viewport.
  useEffect(() => {
    if (selectedIndex !== null) {
      releaseScrollLock();
      smoothScrollTo(offsetTop(detailsRef.current));
      setShowBackToTop(true);
    }
  }, [scrollNonce, selectedIndex]);

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[50%] rounded-full bg-chart-4/5 blur-[100px] pointer-events-none" />

      <main className="relative z-10 w-full">
        {/* SECTION 1 — input form (full screen) */}
        <section className="min-h-[100dvh] w-full flex flex-col items-center justify-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

          <div className="w-full max-w-2xl text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none py-1.5 px-4 text-sm rounded-full font-medium">
              <Sparkles className="w-4 h-4 mr-2" />
              AI-Powered Discovery
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-[1.1]">
              Name your next <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-chart-4">big idea.</span>
            </h1>
          </div>

          <div className="w-full max-w-2xl bg-card rounded-2xl shadow-xl shadow-primary/5 border border-border p-6 md:p-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            {/* Custom Tab Switcher */}
            <div className="flex p-1 bg-muted rounded-xl mb-6 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => handleTabChange("generate")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === "generate"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                AI Generator
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("check")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === "check"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Check Custom Name
              </button>
            </div>

            {activeTab === "generate" ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }: { field: any }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">What are you building?</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="A marketplace for vintage film cameras and lenses..."
                            className="resize-none min-h-[120px] text-base"
                            data-testid="input-description"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">Industry / Category</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <select
                                {...field}
                                data-testid="select-category"
                                className={`w-full h-12 appearance-none rounded-md border border-input bg-background pl-3 pr-10 text-base shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 ${field.value ? 'text-foreground' : 'text-muted-foreground'}`}
                              >
                                <option value="" disabled>Select industry</option>
                                <option value="technology">Technology & SaaS</option>
                                <option value="ecommerce">E-Commerce & Retail</option>
                                <option value="health">Health & Wellness</option>
                                <option value="finance">Finance & Fintech</option>
                                <option value="food">Food & Beverage</option>
                                <option value="creative">Creative & Agency</option>
                                <option value="education">Education & Edtech</option>
                                <option value="other">Other</option>
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="keywords"
                      render={({ field }: { field: any }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">Style hints <span className="text-muted-foreground font-normal">(Optional)</span></FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. minimalist, playful, futuristic"
                              className="text-base h-12"
                              data-testid="input-keywords"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full text-lg h-14 font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      disabled={generateBrandsMutation.isPending}
                      data-testid="button-submit-generate"
                    >
                      {generateBrandsMutation.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Conjuring names...
                        </>
                      ) : (
                        <>
                          Generate Brands
                          <Sparkles className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                    {generateBrandsMutation.isError && (
                      <p className="text-sm text-destructive text-center mt-3 font-medium bg-destructive/10 py-2 rounded-lg" data-testid="error-message">
                        Something went wrong. Please try again.
                      </p>
                    )}
                  </div>
                </form>
              </Form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-base font-semibold block">Enter your brand name</label>
                  <Input
                    placeholder="e.g. Schedlio"
                    className="text-base h-12"
                    value={customName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomName(e.target.value)}
                    data-testid="input-custom-name"
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") handleCustomCheck();
                    }}
                  />
                </div>
                <div className="pt-4">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full text-lg h-14 font-bold rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    onClick={handleCustomCheck}
                    disabled={!customName.trim()}
                    data-testid="button-submit-check"
                  >
                    Check Availability
                    <Globe className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </div>

        </section>

        {/* SECTION 2 — generated brand chips (full screen) */}
        {brands.length > 0 && (
          <section
            ref={resultsRef}
            id="results"
            className="min-h-[100dvh] w-full flex flex-col justify-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
          >
            <div className="w-full max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-3xl font-bold tracking-tight">Generated Brands</h2>
                <Button
                  variant="outline"
                  onClick={() => form.handleSubmit(onSubmit)()}
                  disabled={generateBrandsMutation.isPending}
                  className="hidden md:flex"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${generateBrandsMutation.isPending ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>
              <p className="text-muted-foreground mb-8">
                Tap a name to check domain &amp; social availability.
              </p>

              {/* Chips container — 3 equal columns of clickable brand chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-testid="brand-chips">
                {brands.map((brand, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSelectChip(index)}
                    aria-pressed={selectedIndex === index}
                    data-testid={`brand-chip-${index}`}
                    title={brand.name}
                    className={`w-full px-5 py-2.5 rounded-full text-base font-semibold border text-center truncate transition-colors duration-200 ${selectedIndex === index
                        ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25'
                        : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-primary/5'
                      }`}
                  >
                    {brand.name}
                  </button>
                ))}
              </div>

            </div>
          </section>
        )}

        {/* SECTION 3 — selected brand details (full screen) */}
        {brands.length > 0 && selectedIndex !== null && (
          <section
            ref={detailsRef}
            className="min-h-[100dvh] w-full flex flex-col justify-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
          >
            <div className="w-full max-w-2xl mx-auto">
              <BrandDetails key={brands[selectedIndex].name} brand={brands[selectedIndex]} />
            </div>
          </section>
        )}
      </main>

      {/* Scroll up one section at a time (details → chips → hero) */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollUpOneSection}
          aria-label="Scroll up one section"
          data-testid="back-to-top"
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-transform animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
