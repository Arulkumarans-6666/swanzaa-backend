import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

// routes
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

/* =========================
   MIDDLEWARE
========================= */

// JSON parser
app.use(express.json());

// ✅ CORS — FIXED FOR ANDROID (VERY IMPORTANT)
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost",
      "https://localhost",
      "capacitor://localhost",   // 🔥 ANDROID FIX
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Handle preflight requests (MUST)
app.options("*", cors());

/* =========================
   DATABASE
========================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connect error:", err));

/* =========================
   ROUTES
========================= */

app.use("/api/users", usersRoute);
app.use("/api/auth", authRoute);
app.use("/api/admins", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/student-quiz", studentQuizRoutes);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/quotes", quotesRoute);

/* =========================
   SERVER START
========================= */

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
