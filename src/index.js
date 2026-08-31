import dotenv from "dotenv";
dotenv.config("./.env");
import express from "express";
import connectDB from "./config/db.js";
import cookieParser from 'cookie-parser'
import cors from "cors";
import authRouter from "./routes/auth.routes.js";
import familyMemberRoute from "./routes/familymember.routes.js";

const app = express();

// DB Connection-->>
await connectDB();
app.use(cors({
  origin: [
    "http://localhost:5173",
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRouter);

app.use("/api", familyMemberRoute)

// Test route to check if the server is running
// app.get("/health", (req, res) => {
//   res.send("Hello, World!");
// });



// Redis-Connection
app.listen(5000, () => console.log("Server + Redis Ready"));


// Start the server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
