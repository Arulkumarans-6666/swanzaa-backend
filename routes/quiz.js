// backend/routes/quiz.js
import express from "express";
import Quiz from "../models/Quiz.js";
import auth from "../middleware/auth.js";
import requireSuperAdmin from "../middleware/requireSuperAdmin.js";

const router = express.Router();

/*
----------------------------------------------------------
  ALL QUIZ ROUTES ARE PROTECTED
  Must pass:
  1. auth → valid token
  2. requireSuperAdmin → role === "superadmin"
----------------------------------------------------------
*/

// Get all questions for date+level
router.get("/:date/:level", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { date, level } = req.params;
    const questions = await Quiz.find({ date, level });
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Create a question
router.post("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const question = await Quiz.create(req.body);
    res.json({ question });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Update a question
router.put("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const question = await Quiz.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json({ question });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a question
router.delete("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
