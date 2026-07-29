import { Router } from "express";
import { GenerateBrandsBody } from "@workspace/api-client-react";
import { DomainChecker } from "../services/availability";

const router = Router();

function sanitizeGroqKey(rawKey?: string): string {
  if (!rawKey) return "";
  const match = rawKey.match(/(gsk_[A-Za-z0-9]+)/);
  if (match) return match[1];
  return rawKey.trim();
}

const GROQ_API_KEY = sanitizeGroqKey(process.env.GROQ_API_KEY);
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type BrandSuggestion = {
  name: string;
  tagline: string;
  suggestedDomain: string;
};

function cleanName(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  return cleaned || "Brand";
}

function generateLocalSuggestions(
  description: string,
  category: string,
  keywords?: string,
): BrandSuggestion[] {
  const seed = cleanName(keywords || description);
  const categorySeed = cleanName(category);
  const names = [
    `${seed}Nexa`,
    `${seed}Haven`,
    `Dev${seed}`,
    `${categorySeed}Loom`,
    `Pixel${seed}`,
    `${seed}Sprout`,
    `Stack${seed}`,
    `${seed}Vault`,
    `${categorySeed}Vibe`,
    `${seed}Crest`,
    `Site${seed}`,
    `${seed}Pulse`,
    `Build${seed}`,
    `${seed}Sprint`,
    `${categorySeed}Forge`,
    `${seed}Mint`,
    `Launch${seed}`,
    `${seed}Kite`,
  ];

  const taglines = [
    "Built for bold ideas",
    "Make it instantly memorable",
    "Where vision gets named",
    "Simple names, strong starts",
    "Launch with a lasting name",
    "Crafted to stand out",
    "Your idea, beautifully named",
    "Names that mean business",
    "Forge a brand worth remembering",
    "Spark the perfect first impression",
    "A name as bold as you",
    "Ride the next big wave",
    "Say hello to your brand",
    "Keep customers coming back",
    "Reach the top, name first",
    "Fresh, clean, unforgettable",
    "Elevate your online presence",
    "Distinctive identity from day one",
  ];

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  }

  return unique.map((name, index) => ({
    name,
    tagline: taglines[index % taglines.length] as string,
    suggestedDomain: `${name.toLowerCase()}.com`,
  }));
}

function hasGroqApiKey(): boolean {
  return Boolean(GROQ_API_KEY && GROQ_API_KEY !== "placeholder");
}

router.post(["/brands/test-key", "/api/brands/test-key", "/test-key"], async (req: any, res: any) => {
  const key = req.body?.groqApiKey || (req.headers["x-groq-api-key"] as string) || process.env.GROQ_API_KEY || "";
  if (!key || key === "placeholder") {
    res.status(400).json({ ok: false, error: "No GROQ API key provided." });
    return;
  }

  try {
    const resp: any = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 20,
        messages: [{ role: "user", content: "Reply with JSON: {\"ok\":true}" }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      res.status(400).json({ ok: false, error: `Groq API Error (${resp.status}): ${errText || "Invalid key or rate limit"}` });
      return;
    }

    res.json({ ok: true, message: "Groq API key verified successfully! (llama-3.3-70b-versatile)" });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Failed to connect to Groq API" });
  }
});

router.post(["/brands/generate", "/api/brands/generate", "/generate"], async (req: any, res: any) => {
  const parsed = GenerateBrandsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { description, category, keywords, groqApiKey: bodyKey } = parsed.data;
  const headerKey = (req.headers["x-groq-api-key"] as string) || "";
  const effectiveKey = sanitizeGroqKey(bodyKey || headerKey || process.env.GROQ_API_KEY);

  try {
    if (!effectiveKey || effectiveKey === "placeholder") {
      res.json(generateLocalSuggestions(description, category, keywords));
      return;
    }

    function buildPrompt(count: number, excludeNames: string[] = []): string {
      const excludeClause = excludeNames.length
        ? `\nDo NOT reuse any of these already-generated names: ${excludeNames.join(", ")}.`
        : "";

      return `You are a world-class brand naming consultant. You specialize in creating highly relevant, catchy, modern, professional, and DOMAIN-AVAILABLE brand names strictly in the ENGLISH language.

CRITICAL LANGUAGE REQUIREMENT:
- All generated names MUST be in ENGLISH only.
- Do NOT use non-English words, regional transliterations, Sanskrit, Hindi, Latin, or foreign language roots.

DOMAIN AVAILABILITY MIX (TARGET ~80% AVAILABLE, ~20% TAKEN):
- Generate a diverse mix: mostly CREATIVE, DISTINCTIVE compound names (likely available) but also some common 1-word names (webcraft, launchpad, digitalhub) which tend to be taken.
- Use creative patterns for available names: BuildNexa, SiteHaven, StackNexa, Websprout, Siteloom, Pixelsprout, Devnexa, Webkraf, Devsprout, SitevibeHQ, DevnexusPro, PageloomCo.
- Include a few short/common names like "LaunchPad", "WebCraft", "SiteHub" which are likely already registered.
${excludeClause}

Generate exactly ${count} brand name candidates for:
Business Description: ${description}
Industry / Category: ${category}
${keywords ? `Style / Keywords: ${keywords}` : ""}

Respond ONLY with a valid JSON array:
[{"name":"Brandname","tagline":"Clear professional tagline","suggestedDomain":"brandname.com"}]`;
    }

    async function callGroq(prompt: string, keyToUse: string): Promise<BrandSuggestion[]> {
      try {
        if (!keyToUse || keyToUse === "placeholder") {
          console.log("[BrandGen] GROQ_API_KEY missing or placeholder. Using local fallback.");
          return [];
        }
        console.log("[BrandGen] Requesting brand candidates from Groq API...");
        const resp: any = await fetch(GROQ_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${keyToUse}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.9,
            max_tokens: 1500,
            messages: [
              {
                role: "system",
                content: "You are an expert brand naming consultant. Output ONLY a raw, valid JSON array of brand objects with keys 'name', 'tagline', and 'suggestedDomain'. Do NOT include any markdown formatting, code fences, preambles, explanations, or commentary.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "");
          console.warn(`[BrandGen] Groq API response status (${resp.status}): ${errText}`);
          return [];
        }

        const json = (await resp.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const raw = json.choices?.[0]?.message?.content ?? "[]";
        
        // Robust JSON extraction
        const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        const start = cleaned.indexOf("[");
        const end = cleaned.lastIndexOf("]");
        if (start !== -1 && end !== -1 && end > start) {
          const jsonSub = cleaned.substring(start, end + 1);
          const parsed = JSON.parse(jsonSub);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
        const parsedDirect = JSON.parse(cleaned);
        return Array.isArray(parsedDirect) ? parsedDirect : [];
      } catch (err) {
        console.error("[BrandGen] Error calling Groq API:", err);
        return [];
      }
    }

    const domainChecker = new DomainChecker(2000);

    async function checkPool(pool: BrandSuggestion[]) {
      return Promise.all(
        pool.map(async (s) => ({
          s,
          status: await domainChecker.check(s.suggestedDomain),
        })),
      );
    }

    const availablePool: BrandSuggestion[] = [];
    const takenPool: BrandSuggestion[] = [];
    const seenNames = new Set<string>();

    // 80/20 ratio targets: 14 available + 4 taken = 18 total
    const TARGET_TOTAL = 18;
    const TARGET_AVAILABLE = Math.round(TARGET_TOTAL * 0.8); // 14
    const TARGET_TAKEN = TARGET_TOTAL - TARGET_AVAILABLE;    // 4

    // Harvest enough candidates across up to 2 rounds
    for (let round = 1; round <= 2; round++) {
      const hasEnoughAvailable = availablePool.length >= TARGET_AVAILABLE;
      const hasEnoughTaken = takenPool.length >= TARGET_TAKEN;
      if (hasEnoughAvailable && hasEnoughTaken) break;

      const candidates = await callGroq(buildPrompt(35, Array.from(seenNames)), effectiveKey);
      if (candidates.length === 0) break;

      for (const c of candidates) {
        seenNames.add(c.name);
      }

      const checked = await checkPool(candidates);
      const avail = checked.filter((c) => c.status === "available").map((c) => c.s);
      const taken = checked.filter((c) => c.status !== "available").map((c) => c.s);

      availablePool.push(...avail);
      takenPool.push(...taken);
    }

    // Fallback to local brand generator if Groq API key is invalid or rate limited
    if (availablePool.length === 0 && takenPool.length === 0) {
      res.json(generateLocalSuggestions(description, category, keywords));
      return;
    }

    // Build final list: 80% available + 20% taken
    const final: BrandSuggestion[] = [];
    final.push(...availablePool.slice(0, TARGET_AVAILABLE));
    final.push(...takenPool.slice(0, TARGET_TAKEN));

    // If either pool was short, fill remaining slots from the other
    if (final.length < TARGET_TOTAL) {
      const remaining = TARGET_TOTAL - final.length;
      if (availablePool.length > TARGET_AVAILABLE) {
        final.push(...availablePool.slice(TARGET_AVAILABLE, TARGET_AVAILABLE + remaining));
      } else if (takenPool.length > TARGET_TAKEN) {
        final.push(...takenPool.slice(TARGET_TAKEN, TARGET_TAKEN + remaining));
      }
    }

    // Shuffle so available and taken are interleaved (not grouped)
    for (let i = final.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [final[i], final[j]] = [final[j]!, final[i]!];
    }

    res.json(final);
  } catch (err) {
    req.log?.error?.({ err }, "Brand generation failed");
    res.json(generateLocalSuggestions(description, category, keywords));
  }
});

export default router;
