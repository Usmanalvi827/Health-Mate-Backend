import express from "express";
import { getFamilyMember, registerFamilyMember } from "../controllers/familymember.controller.js";
import authUser from "../middleware/auth.middleware.js";
const familyMemberRoute = express.Router();

familyMemberRoute.post("/family-members", authUser ,registerFamilyMember);
familyMemberRoute.get("/family-members", authUser ,getFamilyMember);


export default familyMemberRoute;
