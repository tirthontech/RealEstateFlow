import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import adminRouter from "./admin";
import agentsRouter from "./agents";
import leadsRouter from "./leads";
import propertiesRouter from "./properties";
import dealsRouter from "./deals";
import dashboardRouter from "./dashboard";
import viewingsRouter from "./viewings";
import unitsRouter from "./units";
import notificationsRouter from "./notifications";
import activitiesRouter from "./activities";

const router: IRouter = Router();

// Public routes (no auth required)
router.use(healthRouter);
router.use(authRouter);

// Admin routes (auth + isAdmin enforced inside adminRouter) — scoped to /admin/*
router.use("/admin", adminRouter);

// Protected routes — require valid JWT
router.use(authMiddleware as any);
router.use(agentsRouter);
router.use(leadsRouter);
router.use(propertiesRouter);
router.use(dealsRouter);
router.use(dashboardRouter);
router.use(viewingsRouter);
router.use(unitsRouter);
router.use(notificationsRouter);
router.use(activitiesRouter);

export default router;
