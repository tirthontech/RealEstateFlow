import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentsRouter from "./agents";
import leadsRouter from "./leads";
import propertiesRouter from "./properties";
import dealsRouter from "./deals";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentsRouter);
router.use(leadsRouter);
router.use(propertiesRouter);
router.use(dealsRouter);
router.use(dashboardRouter);

export default router;
