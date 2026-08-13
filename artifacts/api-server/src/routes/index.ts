import { Router, type IRouter } from "express";
import healthRouter from "./health";
import eventsRouter from "./events";
import categoriesRouter from "./categories";
import contentRouter from "./content";
import registrationsRouter from "./registrations";
import squareRouter from "./square";
import adminRouter from "./admin";
import storageRouter from "./storage";
import galleryRouter from "./gallery";
import cronRouter from "./cron";

const router: IRouter = Router();

router.use(healthRouter);
router.use(eventsRouter);
router.use(categoriesRouter);
router.use(contentRouter);
router.use(registrationsRouter);
router.use(squareRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(galleryRouter);
router.use(cronRouter);

export default router;
