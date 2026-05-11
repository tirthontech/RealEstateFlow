import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import leadsRouter from "./leads";
import propertiesRouter from "./properties";
import dealsRouter from "./deals";
import dashboardRouter from "./dashboard";
import viewingsRouter from "./viewings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(leadsRouter);
router.use(propertiesRouter);
router.use(dealsRouter);
router.use(dashboardRouter);
router.use(viewingsRouter);

export default router;
