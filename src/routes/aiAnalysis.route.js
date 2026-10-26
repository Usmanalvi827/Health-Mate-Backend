import express from "express";
import { aiAnalysisController } from "../controllers/aiAnalysisController.js";
import authUser from "../middleware/auth.middleware.js";
const aiAnalysisRouter = express.Router();

aiAnalysisRouter.post("/ai-analysis/:id", authUser, aiAnalysisController);

export default aiAnalysisRouter;
