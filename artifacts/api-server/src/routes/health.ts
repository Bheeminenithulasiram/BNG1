import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-client-react";

const router: IRouter = Router();

router.get(["/healthz", "/api/healthz"], (_req: any, res: any) => {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(geminiKey && geminiKey !== "placeholder"),
    geminiKeyPrefix: geminiKey ? `${geminiKey.substring(0, 10)}...` : "none",
    hasGroqKey: Boolean(groqKey && groqKey !== "placeholder"),
    groqKeyPrefix: groqKey ? `${groqKey.substring(0, 10)}...` : "none",
  });
});

export default router;
