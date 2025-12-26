import express from "express";
import mongoose from "mongoose";
import Quiz from "../models/Quiz.js";
import StudentQuizProgress from "../models/StudentQuizProgress.js";
import auth from "../middleware/auth.js";

const router = express.Router();

/* ======================================================
   1) GET overall total diamonds
   URL: GET /api/student-quiz/total
====================================================== */
router.get("/total", auth, async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(400).json({ message: "Missing user" });
    }

    const result = await StudentQuizProgress.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
    ]);

    const total = (result && result[0] && Number(result[0].total)) || 0;
    return res.json({ total });
  } catch (err) {
    console.error("GET TOTAL DIAMONDS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   2) GET QUIZ QUESTIONS FOR STUDENT (date + level)
   🔥 imageUrl FORCE INCLUDED
   URL: GET /api/student-quiz/:date/:level
====================================================== */
router.get("/:date/:level", auth, async (req, res) => {
  try {
    const { date, level } = req.params;
    const userId = req.user?.userId;

    // 🔥 IMPORTANT FIX — imageUrl explicitly selected
    const questions = await Quiz.find(
      { date, level },
      {
        question: 1,
        options: 1,
        correctIndex: 1,
        imageUrl: 1,
      }
    );

    let progress = await StudentQuizProgress.findOne({
      studentId: userId,
      date,
      level,
    });

    if (!progress) {
      progress = await StudentQuizProgress.create({
        studentId: userId,
        date,
        level,
        answers: [],
        totalDiamonds: 0,
        completed: false,
      });
    }

    const normalizedProgress = progress.toObject();
    normalizedProgress.answers = (normalizedProgress.answers || []).map((a) => ({
      questionId: a.questionId ? String(a.questionId) : a.questionId,
      attempts: Number(a.attempts || 0),
      earnedDiamonds: Number(a.earnedDiamonds || 0),
      isCorrect: !!a.isCorrect,
      _id: a._id,
    }));
    normalizedProgress.totalDiamonds = Number(
      normalizedProgress.totalDiamonds || 0
    );
    normalizedProgress.completed = !!normalizedProgress.completed;

    if (!questions.length) {
      if (!progress.completed) {
        progress.completed = true;
        await progress.save();
      }

      return res.json({
        questions: [],
        progress: normalizedProgress,
        message: "No quiz created for today",
      });
    }

    return res.json({ questions, progress: normalizedProgress });
  } catch (err) {
    console.error("GET QUIZ ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   3) POST ANSWER
   URL: POST /api/student-quiz/answer
====================================================== */
router.post("/answer", auth, async (req, res) => {
  try {
    const { questionId, date, level, isCorrect } = req.body;
    const userId = req.user?.userId;

    if (!questionId || !date || !level || typeof isCorrect === "undefined") {
      return res.status(400).json({ message: "Missing parameters" });
    }

    let progress = await StudentQuizProgress.findOne({
      studentId: userId,
      date,
      level,
    });

    if (!progress) {
      progress = await StudentQuizProgress.create({
        studentId: userId,
        date,
        level,
        answers: [],
        totalDiamonds: 0,
        completed: false,
      });
    }

    if (progress.completed) {
      return res.json({
        blocked: true,
        message: "Quiz already completed today",
      });
    }

    const exists = progress.answers.some(
      (a) => String(a.questionId) === String(questionId)
    );

    if (!exists) {
      progress.answers.push({
        questionId: String(questionId),
        attempts: 0,
        earnedDiamonds: 0,
        isCorrect: false,
      });
      await progress.save();
    }

    await StudentQuizProgress.updateOne(
      {
        studentId: userId,
        date,
        level,
        "answers.questionId": String(questionId),
      },
      {
        $inc: { "answers.$.attempts": 1 },
      }
    );

    const freshProgress = await StudentQuizProgress.findOne({
      studentId: userId,
      date,
      level,
    });

    const updatedAnswer = freshProgress.answers.find(
      (a) => String(a.questionId) === String(questionId)
    );

    const attemptsNow = Number(updatedAnswer.attempts || 0);
    let diamonds = 0;
    const lvl = level.toLowerCase();

    if (isCorrect) {
      if (lvl === "beginner") {
        if (attemptsNow === 1) diamonds = 10;
        else if (attemptsNow === 2) diamonds = 5;
        else if (attemptsNow === 3) diamonds = 3;
      } else if (lvl === "intermediate") {
        if (attemptsNow === 1) diamonds = 20;
        else if (attemptsNow === 2) diamonds = 15;
        else if (attemptsNow === 3) diamonds = 10;
        else diamonds = 5;
      } else if (lvl === "advance" || lvl === "advanced") {
        if (attemptsNow === 1) diamonds = 30;
        else if (attemptsNow === 2) diamonds = 25;
        else if (attemptsNow === 3) diamonds = 20;
        else diamonds = 10;
      }

      await StudentQuizProgress.updateOne(
        {
          studentId: userId,
          date,
          level,
          "answers.questionId": String(questionId),
        },
        {
          $set: {
            "answers.$.isCorrect": true,
            "answers.$.earnedDiamonds": diamonds,
          },
        }
      );
    }

    const afterProgress = await StudentQuizProgress.findOne({
      studentId: userId,
      date,
      level,
    });

    afterProgress.totalDiamonds = afterProgress.answers.reduce(
      (sum, a) => sum + Number(a.earnedDiamonds || 0),
      0
    );

    const totalQuestions = await Quiz.countDocuments({ date, level });
    const correctCount = afterProgress.answers.filter(
      (a) => a.isCorrect
    ).length;

    afterProgress.completed =
      totalQuestions === 0 || correctCount === totalQuestions;

    await afterProgress.save();

    const normalizedAnswers = afterProgress.answers.map((a) => ({
      questionId: String(a.questionId),
      attempts: Number(a.attempts || 0),
      earnedDiamonds: Number(a.earnedDiamonds || 0),
      isCorrect: !!a.isCorrect,
    }));

    return res.json({
      success: true,
      totalDiamonds: afterProgress.totalDiamonds,
      total: afterProgress.totalDiamonds,
      completed: afterProgress.completed,
      progress: {
        totalDiamonds: afterProgress.totalDiamonds,
        completed: afterProgress.completed,
        answers: normalizedAnswers,
      },
    });
  } catch (err) {
    console.error("ANSWER SAVE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
