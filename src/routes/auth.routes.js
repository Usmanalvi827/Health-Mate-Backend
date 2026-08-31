import express from "express";
import {
  getMeProfile,
  loginController,
  logoutController,
  refreshToken,
  registerController,
} from "../controllers/auth.controller.js";
import authUser from "../middleware/auth.middleware.js";
const authRouter = express.Router();

authRouter.post("/register", registerController);
authRouter.post("/login", loginController);
authRouter.post("/refresh-Token", refreshToken);
authRouter.get("/get-me", authUser, getMeProfile);
authRouter.post("/logout", logoutController);

export default authRouter;
