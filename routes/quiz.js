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

// GET all questions for admin panel
router.get("/admin/questions", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { page = 1, limit = 10, search = "", date = "", startDate = "", endDate = "", sortBy = "newest" } = req.query;

    const queryObj = {};

    if (search) {
      queryObj.$or = [
        { question: { $regex: search, $options: "i" } },
        { level: { $regex: search, $options: "i" } },
        { date: { $regex: search, $options: "i" } }
      ];
    }

    if (date) {
      queryObj.date = date;
    } else if (startDate && endDate) {
      queryObj.date = { $gte: startDate, $lte: endDate };
    }

    const sortObj = {};
    if (sortBy === "oldest") {
      sortObj.date = 1;
      sortObj.createdAt = 1;
    } else {
      sortObj.date = -1;
      sortObj.createdAt = -1;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skipNum = (pageNum - 1) * limitNum;

    const total = await Quiz.countDocuments(queryObj);
    const questions = await Quiz.find(queryObj)
      .sort(sortObj)
      .skip(skipNum)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      questions,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (err) {
    console.error("Admin questions API error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

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
