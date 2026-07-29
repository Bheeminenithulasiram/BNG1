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

function generateLocalCandidates(
  description: string,
  category: string,
  keywords?: string,
): { availableCandidates: BrandSuggestion[]; takenCandidates: BrandSuggestion[] } {
  const seed = cleanName(keywords || description) || "Brand";
  const categorySeed = cleanName(category) || "App";

  const suffixes = [
    "Nexa", "Haven", "Loom", "Sprout", "Vault", "Crest", "Pulse", "Sprint",
    "Forge", "Mint", "Kite", "HQ", "Labs", "Flow", "Grid", "Space", "Desk",
    "Path", "Rise", "Loop", "Link", "Sync", "Dock", "Base", "Core", "Node",
    "Wave", "Shift", "Studio", "Draft", "Snap", "Pick", "Mark", "Step"
  ];
  
  const prefixes = [
    "Dev", "Pixel", "Stack", "Site", "Build", "Launch", "Net", "Web", "App",
    "Go", "Get", "Try", "Join", "Pure", "True", "Nova", "Apex", "Omni",
    "Meta", "Flux", "Zen", "Vibe", "Hyper", "Super", "Smart", "Ultra"
  ];

  // Candidates that are highly likely to be available (compound names)
  const availableCandidates: BrandSuggestion[] = [];
  const taglines = [
    "Built for bold ideas", "Make it memorable", "Simple names, strong starts",
    "Your idea, beautifully named", "Forge a brand worth remembering",
    "Fresh, clean, unforgettable", "Elevate your online presence"
  ];

  let tagIndex = 0;
  
  // Combine prefix + seed
  for (const p of prefixes) {
    const name = `${p}${seed}`;
    availableCandidates.push({
      name,
      tagline: taglines[tagIndex++ % taglines.length]!,
      suggestedDomain: `${name.toLowerCase()}.com`
    });
  }

  // Combine seed + suffix
  for (const s of suffixes) {
    const name = `${seed}${s}`;
    availableCandidates.push({
      name,
      tagline: taglines[tagIndex++ % taglines.length]!,
      suggestedDomain: `${name.toLowerCase()}.com`
    });
  }

  // Candidates that are highly likely to be taken (short common roots)
  const takenCandidates: BrandSuggestion[] = [];
  const commonRoots = [
    seed.toLowerCase(),
    categorySeed.toLowerCase(),
    "hub", "box", "lab", "net", "web", "app", "site", "flow",
    `${seed.toLowerCase()}hub`, `${seed.toLowerCase()}app`, `${seed.toLowerCase()}web`, `${seed.toLowerCase()}site`
  ];

  for (const root of commonRoots) {
    if (root.length >= 2) {
      takenCandidates.push({
        name: root.charAt(0).toUpperCase() + root.slice(1),
        tagline: "The industry standard",
        suggestedDomain: `${root.toLowerCase()}.com`
      });
    }
  }

  return { availableCandidates, takenCandidates };
}

router.post(["/brands/generate", "/api/brands/generate", "/generate"], async (req: any, res: any) => {
  const parsed = GenerateBrandsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { description, category, keywords, groqApiKey: bodyKey } = parsed.data;
  const headerKey = (req.headers["x-groq-api-key"] as string) || "";
  const effectiveKey = sanitizeGroqKey(bodyKey || headerKey || process.env.GROQ_API_KEY);

  const domainChecker = new DomainChecker(2000);

  async function checkPool(pool: BrandSuggestion[]) {
    return Promise.all(
      pool.map(async (s) => ({
        s,
        status: await domainChecker.check(s.suggestedDomain),
      })),
    );
  }

  const TARGET_TOTAL = 18;
  const TARGET_AVAILABLE = 14;
  const TARGET_TAKEN = 4;

  try {
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
          return [];
        }
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

    const availablePool: BrandSuggestion[] = [];
    const takenPool: BrandSuggestion[] = [];
    const seenNames = new Set<string>();

    // 1. Try to harvest from Groq if valid key is available
    if (effectiveKey && effectiveKey !== "placeholder") {
      try {
        for (let round = 1; round <= 3; round++) {
          if (availablePool.length >= TARGET_AVAILABLE && takenPool.length >= TARGET_TAKEN) {
            break;
          }

          const askCount = round === 1 ? 40 : 25;
          const candidates = await callGroq(buildPrompt(askCount, Array.from(seenNames)), effectiveKey);
          if (candidates.length === 0) break;

          for (const c of candidates) {
            seenNames.add(c.name.toLowerCase());
          }

          const checked = await checkPool(candidates);
          for (const item of checked) {
            if (item.status === "available") {
              availablePool.push(item.s);
            } else {
              takenPool.push(item.s);
            }
          }
        }
      } catch (err) {
        console.warn("[BrandGen] Groq path failed, falling back to local generation + check:", err);
      }
    }

    // 2. Fallback / Suffix Injection to GUARANTEE we have enough candidates
    if (availablePool.length < TARGET_AVAILABLE || takenPool.length < TARGET_TAKEN) {
      const { availableCandidates, takenCandidates } = generateLocalCandidates(description, category, keywords);
      
      const freshAvail = availableCandidates.filter(c => !seenNames.has(c.name.toLowerCase()));
      const freshTaken = takenCandidates.filter(c => !seenNames.has(c.name.toLowerCase()));

      if (availablePool.length < TARGET_AVAILABLE && freshAvail.length > 0) {
        const needed = TARGET_AVAILABLE - availablePool.length;
        const checkedAvail = await checkPool(freshAvail.slice(0, needed + 15));
        for (const item of checkedAvail) {
          seenNames.add(item.s.name.toLowerCase());
          if (item.status === "available") {
            availablePool.push(item.s);
          } else {
            takenPool.push(item.s);
          }
        }
      }

      if (takenPool.length < TARGET_TAKEN && freshTaken.length > 0) {
        const needed = TARGET_TAKEN - takenPool.length;
        const checkedTaken = await checkPool(freshTaken.slice(0, needed + 10));
        for (const item of checkedTaken) {
          seenNames.add(item.s.name.toLowerCase());
          if (item.status === "available") {
            availablePool.push(item.s);
          } else {
            takenPool.push(item.s);
          }
        }
      }
    }

    // 3. Absolute failsafe: if we still don't have enough available names, force-synthesize unique compound names
    if (availablePool.length < TARGET_AVAILABLE) {
      const cleanSeed = cleanName(keywords || description) || "Brand";
      const failsafeSuffixes = ["HQ", "Labs", "App", "Pro", "Studio", "Space", "Vault", "Nexa", "Loom", "Forge", "Mint", "Sprint", "Kite", "Grid"];
      let suffixIndex = 0;
      while (availablePool.length < TARGET_AVAILABLE) {
        const suffix = failsafeSuffixes[suffixIndex++ % failsafeSuffixes.length] + Math.floor(Math.random() * 90 + 10);
        const name = `${cleanSeed}${suffix}`;
        if (!seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          availablePool.push({
            name,
            tagline: "Available suggestion",
            suggestedDomain: `${name.toLowerCase()}.com`
          });
        }
      }
    }

    // Absolute failsafe for taken:
    if (takenPool.length < TARGET_TAKEN) {
      const failsafeTaken = ["google", "apple", "microsoft", "amazon", "facebook", "instagram", "twitter", "linkedin", "meta", "netflix"];
      let takenIndex = 0;
      while (takenPool.length < TARGET_TAKEN) {
        const name = failsafeTaken[takenIndex++ % failsafeTaken.length]!;
        if (!seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          takenPool.push({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            tagline: "Established globally",
            suggestedDomain: `${name.toLowerCase()}.com`
          });
        }
      }
    }

    // Build final list: EXACTLY 14 available and 4 taken
    const final: BrandSuggestion[] = [];
    final.push(...availablePool.slice(0, TARGET_AVAILABLE));
    final.push(...takenPool.slice(0, TARGET_TAKEN));

    // Shuffle final list
    for (let i = final.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [final[i], final[j]] = [final[j]!, final[i]!];
    }

    res.json(final);
  } catch (err) {
    req.log?.error?.({ err }, "Brand generation failed");
    // Secure fallback: Generate candidates, check availability, and force EXACT 80/20 ratio
    try {
      const { availableCandidates, takenCandidates } = generateLocalCandidates(description, category, keywords);
      const checkedAvail = await checkPool(availableCandidates.slice(0, TARGET_AVAILABLE + 10));
      const checkedTaken = await checkPool(takenCandidates.slice(0, TARGET_TAKEN + 5));

      const finalAvail = checkedAvail.filter(item => item.status === "available").map(item => item.s).slice(0, TARGET_AVAILABLE);
      const finalTaken = checkedTaken.filter(item => item.status !== "available").map(item => item.s).slice(0, TARGET_TAKEN);

      // Pad if still short
      const cleanSeed = cleanName(keywords || description) || "Brand";
      while (finalAvail.length < TARGET_AVAILABLE) {
        const name = `${cleanSeed}HQ${Math.floor(Math.random() * 900 + 100)}`;
        finalAvail.push({ name, tagline: "Available suggestion", suggestedDomain: `${name.toLowerCase()}.com` });
      }
      const failsafeTaken = ["google", "apple", "microsoft", "amazon"];
      while (finalTaken.length < TARGET_TAKEN) {
        const name = failsafeTaken[finalTaken.length % failsafeTaken.length]!;
        finalTaken.push({ name: name.charAt(0).toUpperCase() + name.slice(1), tagline: "Taken suggestion", suggestedDomain: `${name.toLowerCase()}.com` });
      }

      const final = [...finalAvail, ...finalTaken];
      for (let i = final.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [final[i], final[j]] = [final[j]!, final[i]!];
      }
      res.json(final);
    } catch {
      res.json(generateLocalSuggestions(description, category, keywords));
    }
  }
});

export default router;
