import { useEffect, type ReactNode } from "react";
import { useCheckBrandAvailability, type AvailabilityStatus } from "@workspace/api-client-react";
import { Globe, Loader2, Check, X, Linkedin, HelpCircle } from "lucide-react";
import { SiInstagram, SiX } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type BrandSuggestion = {
  name: string;
  tagline: string;
  suggestedDomain: string;
};

export default function BrandDetails({ brand }: { brand: BrandSuggestion }) {
  const checkAvailability = useCheckBrandAvailability();

  useEffect(() => {
    checkAvailability.mutate({
      data: {
        name: brand.name,
        domain: brand.suggestedDomain,
      },
    });
    // Remounted per brand (keyed by name), so fetch once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = checkAvailability.data;
  const handle = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Always show X, Instagram and LinkedIn, each with its availability status.
  const socials = data
    ? [
        { platform: "X", status: data.social.twitter, icon: <SiX className="w-5 h-5" /> },
        { platform: "Instagram", status: data.social.instagram, icon: <SiInstagram className="w-5 h-5" /> },
        { platform: "LinkedIn", status: data.social.linkedin, icon: <Linkedin className="w-5 h-5" /> },
      ]
    : [];
  const domainStatus: AvailabilityStatus = data?.domain.status ?? "unknown";
  const hasUnverified = socials.some((s) => s.status === "unknown");

  return (
    <div
      className="border border-primary rounded-2xl bg-card shadow-md ring-1 ring-primary/20 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
      data-testid="brand-details"
    >
      {/* Header */}
      <div className="p-6 md:p-8 border-b bg-gradient-to-r from-primary/5 to-chart-4/5">
        <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4">
          <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight" data-testid="text-brand-name">
            {brand.name}
          </h3>
          <p className="text-base text-muted-foreground font-medium" data-testid="text-brand-tagline">
            {brand.tagline}
          </p>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-muted/30">
        {checkAvailability.isPending ? (
          <AvailabilitySkeleton />
        ) : checkAvailability.isError ? (
          <div className="text-center py-8 text-destructive flex flex-col items-center">
            <X className="w-8 h-8 mb-2 opacity-50" />
            <p>Failed to check availability. Please try again.</p>
          </div>
        ) : data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Domain Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Domain
              </h4>
              <div className="flex items-center justify-between gap-3 p-4 rounded-xl border bg-background shadow-sm">
                <span className="text-lg font-semibold truncate">{data.domain.name}</span>
                <StatusBadge status={domainStatus} />
              </div>
            </div>

            {/* Social Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Social Handles
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {socials.map((s) => (
                  <SocialRow
                    key={s.platform}
                    platform={s.platform}
                    handle={handle}
                    status={s.status}
                    icon={s.icon}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: AvailabilityStatus }) {
  if (status === "available") {
    return (
      <Badge variant="outline" className="shrink-0 whitespace-nowrap bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3 py-1 gap-1.5">
        <Check className="w-3.5 h-3.5" />
        Available
      </Badge>
    );
  }
  if (status === "taken") {
    return (
      <Badge variant="outline" className="shrink-0 whitespace-nowrap bg-rose-500/10 text-rose-600 border-rose-500/20 px-3 py-1 gap-1.5">
        <X className="w-3.5 h-3.5" />
        Taken
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="shrink-0 whitespace-nowrap bg-muted text-muted-foreground border-border px-3 py-1 gap-1.5">
      <HelpCircle className="w-3.5 h-3.5" />
      Unverified
    </Badge>
  );
}

function SocialRow({
  platform,
  handle,
  status,
  icon,
}: {
  platform: string;
  handle: string;
  status: AvailabilityStatus;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-3 rounded-xl border bg-background shadow-sm">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`shrink-0 text-muted-foreground ${status === "available" ? "text-primary" : ""}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{platform}</p>
          <p className="text-sm font-semibold truncate">{handle}</p>
        </div>
      </div>
      <div className="flex items-center justify-center w-6 h-6 shrink-0">
        {status === "available" ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : status === "taken" ? (
          <X className="w-4 h-4 text-rose-500" />
        ) : (
          <HelpCircle className="w-4 h-4 text-muted-foreground" aria-label="Couldn't verify" />
        )}
      </div>
    </div>
  );
}

function AvailabilitySkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-3 text-muted-foreground py-4 animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-medium">Checking live availability...</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 opacity-60">
        <div className="space-y-4">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-32 rounded-md" />
          <div className="grid grid-cols-1 gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
