import { useState } from "react";
import { Sparkles, Headphones, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function NavBar() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="font-bold tracking-tight text-lg">
              BrandGen
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSupportOpen(true)}
              className="gap-2 rounded-full border-primary/20 text-primary hover:bg-primary/10 text-xs sm:text-sm"
              data-testid="button-support"
            >
              <Headphones className="h-4 w-4" />
              <span className="font-semibold hidden sm:inline">Help & Support</span>
            </Button>
          </div>
        </div>
      </header>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Headphones className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl">BrandGen Help & Architecture</DialogTitle>
            </div>
            <DialogDescription>
              Enterprise-grade AI brand naming engine and real-time DNS/RDAP availability verification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-sm">
            <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Zap className="h-4 w-4 text-primary" />
                <span>AI Name Generation</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                BrandGen generates highly creative, domain-optimized brand name candidates tailored to your industry, vision, and key themes.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/40 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Multi-Tier Availability Engine</span>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Domain status is verified using VeriSign RDAP protocol with fallback to Node NS resolution and Google DNS-over-HTTPS. Social handles are inspected live across X, LinkedIn, and Instagram.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
