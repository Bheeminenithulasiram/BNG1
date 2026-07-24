import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-client-react";

const router: IRouter = Router();

router.get(["/healthz", "/api/healthz"], (_req: any, res: any) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
