import { Router, type IRouter } from "express";
import healthRouter from "./health";
import brandsRouter from "./brands";
import availabilityRouter from "./availability";

const router: IRouter = Router();

router.use(healthRouter);
router.use(brandsRouter);
router.use(availabilityRouter);

export default router;
