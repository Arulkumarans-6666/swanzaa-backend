// backend/server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

import studentQuizRoutes from "./routes/studentQuiz.js";
import usersRoute from "./routes/users.js";
import authRoute from "./routes/auth.js";
import adminRoutes from "./routes/admins.js";
import studentRoutes from "./routes/students.js";
import quizRoutes from "./routes/quiz.js";
import leaderboardRouter from "./routes/leaderboard.js";
import quotesRoute from "./routes/quotes.js";

dotenv.config();

const app = express();
app.use(express.json());

// 🔥 FIXED CORS FOR WEB + MOBILE
app.use(cors({
  origin: true,          // ✅ allow ALL origins (capacitor, browser)
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 🔥 VERY IMPORTANT (preflight fix)
app.options("*", cors());

// DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("Mongo connect error", err));

// Routes
app.use("/api/users", usersRoute);
app.use("/api/auth", authRoute);
app.use("/api/admins", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/student-quiz", studentQuizRoutes);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/quotes", quotesRoute);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log("Server running on port", port));
