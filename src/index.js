import dotenv from "dotenv";
dotenv.config(); // correct way

import express from "express";
import connectDB from "./config/db.js";
import cookieParser from 'cookie-parser'
import cors from "cors";
import authRouter from "./routes/auth.routes.js";
import familyMemberRoute from "./routes/familymember.routes.js";
import fileUploadRouter from "./routes/fileUpload.route.js";

const app = express();

// DB Connection
await connectDB();

app.use(cors({
  origin: ["http://localhost:5173"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", authRouter);
app.use("/api", familyMemberRoute);
app.use("/api", fileUploadRouter);

// Global Error Handler - so you see JSON not that HTML [object Object]
app.use((err, req, res, next) => {
  console.error("Global Error =>", err);
  res.status(500).json({ success: false, message: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});