// backend/routes/quiz.js
import express from "express";
import Quiz from "../models/Quiz.js";
import auth from "../middleware/auth.js";
import requireSuperAdmin from "../middleware/requireSuperAdmin.js";
import uploadQuizImage from "../middleware/uploadQuizImage.js";

const router = express.Router();

/*
----------------------------------------------------------
  ALL QUIZ ROUTES ARE PROTECTED
  auth + superadmin
----------------------------------------------------------
*/

// GET questions by date & level
router.get("/:date/:level", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { date, level } = req.params;
    const questions = await Quiz.find({ date, level });
    res.json({ questions });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// CREATE question (supports OLD + NEW)
router.post(
  "/",
  auth,
  requireSuperAdmin,
  uploadQuizImage.single("image"), // optional
  async (req, res) => {
    try {
      let {
        question,
        date,
        level,
        options,
        correctIndex,
      } = req.body;

      // OLD: options comes as string
      if (typeof options === "string") {
        options = JSON.parse(options);
      }

      const data = {
        question,
        date,
        level,
        options,
        correctIndex: Number(correctIndex),
      };

      // OLD: image upload
      if (req.file) {
        data.imageUrl = req.file.path;
      }

      const created = await Quiz.create(data);
      res.json({ question: created });
    } catch (err) {
      console.error("CREATE ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

// UPDATE question (supports OLD + NEW)
router.put(
  "/:id",
  auth,
  requireSuperAdmin,
  uploadQuizImage.single("image"), // optional
  async (req, res) => {
    try {
      let { question, options, correctIndex } = req.body;

      if (typeof options === "string") {
        options = JSON.parse(options);
      }

      const data = {
        question,
        options,
        correctIndex: Number(correctIndex),
      };

      if (req.file) {
        data.imageUrl = req.file.path;
      }

      const updated = await Quiz.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true }
      );

      res.json({ question: updated });
    } catch (err) {
      console.error("UPDATE ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

// DELETE question
router.delete("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    await Quiz.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
