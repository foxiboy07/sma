import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import brandsRouter from "./brands";
import flowsRouter from "./flows";
import contactsRouter from "./contacts";
import conversationsRouter from "./conversations";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(brandsRouter);
router.use(flowsRouter);
router.use(contactsRouter);
router.use(conversationsRouter);
router.use(settingsRouter);

export default router;
