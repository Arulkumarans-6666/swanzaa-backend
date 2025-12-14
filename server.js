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

dotenv.config();
const app = express();
app.use(express.json());

// allow frontend origin(s)
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

// connect DB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("Mongo connect error", err));

// mount routes
app.use("/api/users", usersRoute);
app.use("/api/auth", authRoute);
app.use("/api/admins", adminRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/quiz", quizRoutes);

// mount student-quiz router (important)
app.use("/api/student-quiz", studentQuizRoutes);

import leaderboardRouter from "./routes/leaderboard.js";
app.use("/api/leaderboard", leaderboardRouter);

import quotesRoute from "./routes/quotes.js";
app.use("/api/quotes", quotesRoute);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log("Server running on port", port));
