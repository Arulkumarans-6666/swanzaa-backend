// backend/routes/leaderboard.js
import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Student from "../models/Student.js";
import StudentQuizProgress from "../models/StudentQuizProgress.js";

const router = express.Router();

/**
 * GET /api/leaderboard
 * Query:
 *   - page (default 1)
 *   - perPage (default 10)
 *   - focus (optional boolean) -> if true, return the page that contains the logged-in user
 *
 * Response:
 * {
 *   top3: [{ studentId, name, score, rank },...],
 *   page: number,
 *   perPage: number,
 *   totalCount: number,
 *   userRank: number | null,
 *   pageList: [{ studentId, name, score, rank, isYou }, ...]
 * }
 */
router.get("/", auth, async (req, res) => {
  try {
    const userId = req.user?.userId ? String(req.user.userId) : null;
    const pageReq = Math.max(1, parseInt(req.query.page || "1", 10));
    const perPage = Math.max(1, parseInt(req.query.perPage || "10", 10));
    const focus = req.query.focus === "true" || req.query.focus === "1";

    // 1) Aggregate totals per student and lookup their Student doc
    // Use $ifNull guards to avoid null issues
    const pipeline = [
      {
        $group: {
          _id: "$studentId",
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
      { $sort: { total: -1 } },
      {
        $lookup: {
          from: "students", // collection name (lowercase + plural) - matches Student model
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          studentId: { $toString: "$_id" },
          total: 1,
          name: {
            $ifNull: ["$student.name", "$student.email", "Unknown"],
          },
        },
      },
    ];

    const agg = await StudentQuizProgress.aggregate(pipeline).allowDiskUse(true);

    if (!agg || agg.length === 0) {
      return res.json({
        top3: [],
        page: 1,
        perPage,
        totalCount: 0,
        userRank: null,
        pageList: [],
      });
    }

    // 2) Build leaderboard array with ranks (1-based)
    const leaderboard = agg.map((row, idx) => ({
      studentId: row.studentId,
      name: row.name || "Unknown",
      score: Number(row.total || 0),
      rank: idx + 1,
    }));

    const totalCount = leaderboard.length;
    const top3 = leaderboard.slice(0, 3);

    // 3) Find user rank if present
    let userRank = null;
    if (userId) {
      const found = leaderboard.find((l) => String(l.studentId) === String(userId));
      if (found) userRank = found.rank;
    }

    // 4) Decide page to return
    let pageToReturn = pageReq;
    if (focus && userRank) {
      pageToReturn = Math.floor((userRank - 1) / perPage) + 1;
    } else {
      const maxPage = Math.max(1, Math.ceil(totalCount / perPage));
      if (pageToReturn > maxPage) pageToReturn = maxPage;
    }

    const start = (pageToReturn - 1) * perPage;
    const pageRows = leaderboard.slice(start, start + perPage).map((p) => ({
      ...p,
      isYou: userId ? String(p.studentId) === String(userId) : false,
    }));

    return res.json({
      top3,
      page: pageToReturn,
      perPage,
      totalCount,
      userRank,
      pageList: pageRows,
    });
  } catch (err) {
    // log full stack for debugging
    console.error("LEADERBOARD ERROR:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", error: String(err?.message || err) });
  }
});

/**
 * NEW ROUTE: GET /api/leaderboard/summary/:id
 * Returns per-level totals (beginner/intermediate/advanced), overall total and rank for a student.
 * Protected with `auth` like other leaderboard routes.
 *
 * Response:
 * {
 *   student: { id, name, email },
 *   levels: { beginner, intermediate, advanced },
 *   overall: Number,
 *   rank: Number | null
 * }
 */
router.get("/summary/:id", auth, async (req, res) => {
  try {
    const studentId = req.params.id;
    if (!studentId) return res.status(400).json({ message: "Missing student id" });

    // Find student basic info
    const student = await Student.findById(studentId).select("name email");
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Aggregate totals grouped by level for this student
    const levelAgg = await StudentQuizProgress.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: "$level",
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
    ]);

    // Normalize levels
    const levels = { beginner: 0, intermediate: 0, advanced: 0 };
    (levelAgg || []).forEach((r) => {
      const lvl = String(r._id || "").toLowerCase();
      if (lvl.includes("begin")) levels.beginner = Number(r.total || 0);
      else if (lvl.includes("inter")) levels.intermediate = Number(r.total || 0);
      else if (lvl.includes("advance")) levels.advanced = Number(r.total || 0);
    });

    const overall = levels.beginner + levels.intermediate + levels.advanced;

    // Compute rank by aggregating totals for all students (same logic as leaderboard root)
    const leaderboardAgg = await StudentQuizProgress.aggregate([
      {
        $group: {
          _id: "$studentId",
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    let rank = null;
    (leaderboardAgg || []).forEach((row, idx) => {
      if (String(row._id) === String(studentId)) {
        rank = idx + 1;
      }
    });

    return res.json({
      student: { id: studentId, name: student.name, email: student.email },
      levels,
      overall,
      rank,
    });
  } catch (err) {
    console.error("LEADERBOARD SUMMARY ERROR:", err && err.stack ? err.stack : err);
    return res.status(500).json({ message: "Server error", error: String(err?.message || err) });
  }
});

export default router;
