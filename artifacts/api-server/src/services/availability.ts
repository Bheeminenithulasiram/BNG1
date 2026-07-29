import { promises as dns } from "node:dns";

export type AvailabilityStatus = "available" | "taken" | "unknown";

export abstract class AvailabilityChecker {
  abstract check(target: string): Promise<AvailabilityStatus>;
}

/**
 * 1. Domain Name Checking: The "Triple-Check" DNS Resolver
 * Checks A, NS, and MX records in fallback layers.
 * If all 3 layers fail with ENOTFOUND or ENODATA, it is available.
 * Otherwise, it defaults to taken.
 */
export class DomainChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 4000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  async check(domain: string): Promise<AvailabilityStatus> {
    const normalized = domain.toLowerCase().trim();

    const lookup = (async (): Promise<AvailabilityStatus> => {
      let aFailed = false;
      let nsFailed = false;
      let mxFailed = false;

      // Layer 1: A Record Lookup (resolve4)
      try {
        const ips = await dns.resolve4(normalized);
        if (ips && ips.length > 0) return "taken";
      } catch (err: any) {
        if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
          aFailed = true;
        }
      }

      // Layer 2: NS Record Lookup (resolveNs)
      try {
        const ns = await dns.resolveNs(normalized);
        if (ns && ns.length > 0) return "taken";
      } catch (err: any) {
        if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
          nsFailed = true;
        }
      }

      // Layer 3: MX Record Lookup (resolveMx)
      try {
        const mx = await dns.resolveMx(normalized);
        if (mx && mx.length > 0) return "taken";
      } catch (err: any) {
        if (err.code === "ENOTFOUND" || err.code === "ENODATA") {
          mxFailed = true;
        }
      }

      // If all 3 layers failed with ENOTFOUND or ENODATA, the domain is Available
      if (aFailed && nsFailed && mxFailed) {
        return "available";
      }

      // Default to taken if any other error occurred
      return "taken";
    })();

    const timeout = new Promise<AvailabilityStatus>((resolve) =>
      setTimeout(() => resolve("taken"), this.timeoutMs),
    );

    return Promise.race([lookup, timeout]);
  }
}

/**
 * 2. Instagram Method (Scraper + Double-Check Guard + Default to Taken)
 * Queries Instagram page directly. If 404, waits 500ms and checks again.
 * If 404 twice, returns "available".
 * If 200, a redirect, or throws an error (e.g. rate-limiting), defaults to "taken".
 */
export class InstagramChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  private async fetchOnce(username: string): Promise<number> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9._]/g, "");
    if (!cleanUser) return 404;

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

    if (resp.status === 200) {
      if (resp.url && resp.url.includes("accounts/login") && !scraperKey && !zenrowsKey) {
        return 302; // Redirect to login wall (treated as taken)
      }
      const text = await resp.text();
      if (
        text.includes("Page Not Found") ||
        text.includes("isn't available") ||
        text.includes("link you followed may be broken")
      ) {
        return 404;
      }
    }

    return resp.status;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    try {
      const status1 = await this.fetchOnce(username);
      if (status1 === 404) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const status2 = await this.fetchOnce(username);
        if (status2 === 404) {
          return "available";
        }
      }
      return "taken";
    } catch {
      return "taken";
    }
  }
}

/**
 * 3. GitHub Method
 * Queries the public GitHub Users API.
 * A 404 status code twice indicates that the profile is Available.
 * Defaults to Taken on any other status or error.
 */
export class GitHubChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 4000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  private async fetchOnce(username: string): Promise<number> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!cleanUser) return 404;

    const resp: any = await fetch(`https://api.github.com/users/${cleanUser}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return resp.status;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    try {
      const status1 = await this.fetchOnce(username);
      if (status1 === 404) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const status2 = await this.fetchOnce(username);
        if (status2 === 404) {
          return "available";
        }
      }
      return "taken";
    } catch {
      return "taken";
    }
  }
}

/**
 * 4. Twitter / X Method
 * Queries the publish.twitter.com oembed endpoint.
 * A 404 status code twice indicates the profile does not exist (Available).
 * Defaults to Taken on any other status or error.
 */
export class XChecker extends AvailabilityChecker {
  private timeoutMs: number;

  constructor(timeoutMs = 5000) {
    super();
    this.timeoutMs = timeoutMs;
  }

  private async fetchOnce(username: string): Promise<number> {
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!cleanUser) return 404;

    const resp: any = await fetch(`https://publish.twitter.com/oembed?url=https://x.com/${cleanUser}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return resp.status;
  }

  async check(username: string): Promise<AvailabilityStatus> {
    try {
      const status1 = await this.fetchOnce(username);
      if (status1 === 404) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const status2 = await this.fetchOnce(username);
        if (status2 === 404) {
          return "available";
        }
      }
      return "taken";
    } catch {
      return "taken";
    }
  }
}
