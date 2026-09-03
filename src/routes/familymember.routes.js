import express from "express";
import { deleteFamilyMember, getFamilyMember, registerFamilyMember, updateFamilyMember } from "../controllers/familymember.controller.js";
import authUser from "../middleware/auth.middleware.js";
const familyMemberRoute = express.Router();

familyMemberRoute.post("/family-members", authUser ,registerFamilyMember);
familyMemberRoute.get("/family-members", authUser ,getFamilyMember);
familyMemberRoute.put("/family-members/:id", authUser, updateFamilyMember);
familyMemberRoute.delete("/family-members/:id", authUser, deleteFamilyMember);


export default familyMemberRoute;
