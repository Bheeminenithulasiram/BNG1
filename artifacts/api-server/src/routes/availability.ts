import { Router } from "express";
import { CheckBrandAvailabilityBody } from "@workspace/api-client-react";
import {
  DomainChecker,
  XChecker,
  LinkedInChecker,
  InstagramChecker,
} from "../services/availability";

const router = Router();

router.post(["/brands/availability", "/api/brands/availability", "/availability"], async (req: any, res: any) => {
  const parsed = CheckBrandAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { name, domain } = parsed.data;
  // Derive a clean username: lowercase, remove non-alphanumeric
  const username = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  try {
    const domainChecker = new DomainChecker();
    const xChecker = new XChecker();
    const linkedInChecker = new LinkedInChecker();
    const instagramChecker = new InstagramChecker();

    const [domainResult, twitter, linkedin, instagram] = await Promise.all([
      domainChecker.check(domain),
      xChecker.check(username),
      linkedInChecker.check(username),
      instagramChecker.check(username),
    ]);

    res.json({
      domain: { name: domain, status: domainResult },
      social: { instagram, twitter, linkedin },
    });
  } catch (err) {
    req.log.error({ err }, "Availability check failed");
    res.status(500).json({ error: "Availability check failed" });
  }
});

export default router;
