import { promises as dns } from "node:dns";

export type AvailabilityStatus = "available" | "taken" | "unknown";

export abstract class AvailabilityChecker {
  abstract check(target: string): Promise<AvailabilityStatus>;
}

export class DomainChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 4000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  async check(domain: string): Promise<AvailabilityStatus> {
    const normalized = domain.toLowerCase().trim();

    const lookup = (async (): Promise<AvailabilityStatus> => {
      // 1. Query Official RDAP Registry if .com or .net
      try {
        if (normalized.endsWith(".com") || normalized.endsWith(".net")) {
          const tld = normalized.endsWith(".com") ? "com" : "net";
          const url = `https://rdap.verisign.com/${tld}/v1/domain/${normalized}`;
          const resp: any = await fetch(url, {
            signal: AbortSignal.timeout(this.timeoutMs - 1000 > 0 ? this.timeoutMs - 1000 : 3000),
          });
          if (resp.status === 200) return "taken";
          if (resp.status === 404) return "available";
        }
      } catch {
        // Fall back to DNS on error or timeout
      }

      // 2. DNS Fallback Query (Node DNS)
      try {
        const ns = await dns.resolveNs(normalized);
        if (ns.length > 0) return "taken";
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOTFOUND" || code === "ENODATA") return "available";
      }

      // 3. DNS-over-HTTPS Fallback Query (Google DoH)
      try {
        const dohResp = await fetch(`https://dns.google/resolve?name=${normalized}&type=A`, {
          signal: AbortSignal.timeout(2000),
        });
        if (dohResp.ok) {
          const json: any = await dohResp.json();
          if (json.Status === 0 && json.Answer && json.Answer.length > 0) return "taken";
          if (json.Status === 3) return "available"; // NXDOMAIN
        }
      } catch {
        // Ignore DoH error
      }

      return "unknown";
    })();

    const timeout = new Promise<AvailabilityStatus>((resolve) =>
      setTimeout(() => resolve("unknown"), this.timeoutMs),
    );

    return Promise.race([lookup, timeout]);
  }
}

export class HttpSocialChecker extends AvailabilityChecker {
  protected baseUrl: string;
  protected timeoutMs: number;

  constructor(baseUrl: string, timeoutMs = 6000) {
    super();
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    const url = `${this.baseUrl}${username}`;
    try {
      const resp: any = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (resp.status === 404) return "available";
      if (resp.status === 200) return "taken";
      return "unknown";
    } catch {
      return "unknown";
    }
  }
}

export class XChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanUser) return "unknown";

    try {
      // Twitter Publish OEmbed returns 200 for existing profiles and 404 for non-existent profiles
      const resp: any = await fetch(`https://publish.twitter.com/oembed?url=https://x.com/${cleanUser}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (resp.status === 200) return "taken";
      if (resp.status === 404) return "available";
    } catch {
      // Fall back to direct profile fetch
    }

    try {
      const resp: any = await fetch(`https://x.com/${cleanUser}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (resp.status === 404) return "available";
      if (resp.status === 200) return "taken";
    } catch {
      // Fall through
    }

    return "unknown";
  }
}

export class LinkedInChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!cleanUser) return "unknown";

    try {
      const resp: any = await fetch(`https://www.linkedin.com/company/${cleanUser}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (resp.status === 200) return "taken";
      if (resp.status === 404) return "available";
      
      // LinkedIn redirects unauthenticated hits to authwall (302) or blocks (999/403) for existing companies
      if (resp.status === 301 || resp.status === 302 || resp.status === 403 || resp.status === 999) {
        return "taken";
      }
    } catch {
      // Fall through
    }

    return "unknown";
  }
}

const RESERVED_IG_HANDLES = new Set([
  "instagram", "google", "meta", "facebook", "twitter", "linkedin", "apple",
  "microsoft", "amazon", "netflix", "nike", "adidas", "zuck", "test", "admin"
]);

export class InstagramChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9._]/g, "");
    if (!cleanUser) return "unknown";

    if (RESERVED_IG_HANDLES.has(cleanUser)) {
      return "taken";
    }

    // Attempt 1: Direct Instagram HTML inspection (with optional ScraperAPI or ZenRows proxy support)
    try {
      const scraperKey = process.env.SCRAPERAPI_KEY;
      const zenrowsKey = process.env.ZENROWS_API_KEY;
      
      let targetUrl = `https://www.instagram.com/${cleanUser}/`;
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };

      if (scraperKey) {
        targetUrl = `https://api.scraperapi.com?api_key=${scraperKey}&url=${encodeURIComponent(targetUrl)}`;
      } else if (zenrowsKey) {
        targetUrl = `https://api.zenrows.com/v1/?apikey=${zenrowsKey}&url=${encodeURIComponent(targetUrl)}`;
      }

      const resp: any = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (resp.status === 404) return "available";

      if (resp.status === 200) {
        if (resp.url && resp.url.includes("accounts/login") && !scraperKey && !zenrowsKey) {
          return "unknown"; // Blocked/redirected to login page
        }
        const text = await resp.text();
        if (
          text.includes("Page Not Found") ||
          text.includes("isn't available") ||
          text.includes("link you followed may be broken")
        ) {
          return "available";
        }
        return "taken";
      }
    } catch {
      // Proceed to fallback
    }

    // Attempt 2: Instagram OEmbed endpoint
    try {
      const oembedResp: any = await fetch(
        `https://api.instagram.com/oembed/?url=https://www.instagram.com/${cleanUser}/`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
          },
          signal: AbortSignal.timeout(3000),
        }
      );
      if (oembedResp.status === 404) return "available";
      if (oembedResp.status === 200) return "taken";
    } catch {
      // Ignore
    }

    return "unknown";
  }
}
