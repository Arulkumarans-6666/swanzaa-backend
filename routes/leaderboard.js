import express from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Student from "../models/Student.js";
import StudentQuizProgress from "../models/StudentQuizProgress.js";
import ExcelJS from "exceljs";

const router = express.Router();

/* ======================================================
   GET /api/leaderboard
====================================================== */
router.get("/", auth, async (req, res) => {
  try {
    const pageReq = Math.max(1, parseInt(req.query.page || "1", 10));
    const perPage = Math.max(1, parseInt(req.query.perPage || "10", 10));

    const agg = await StudentQuizProgress.aggregate([
      {
        $group: {
          _id: "$studentId",
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
      { $sort: { total: -1 } },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $project: {
          studentId: { $toString: "$_id" },
          name: { $ifNull: ["$student.name", "$student.email"] },
          email: "$student.email",
          score: "$total",
        },
      },
    ]);

    const leaderboard = agg.map((r, i) => ({ ...r, rank: i + 1 }));

    res.json({
      top3: leaderboard.slice(0, 3),
      totalCount: leaderboard.length,
      page: pageReq,
      perPage,
      pageList: leaderboard.slice(
        (pageReq - 1) * perPage,
        pageReq * perPage
      ),
    });
  } catch (err) {
    console.error("LEADERBOARD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   GET /api/leaderboard/summary/:id
====================================================== */
router.get("/summary/:id", auth, async (req, res) => {
  try {
    const studentId = req.params.id;

    const student = await Student.findById(studentId).select("name email");
    if (!student) return res.status(404).json({ message: "Student not found" });

    const levelAgg = await StudentQuizProgress.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
      {
        $group: {
          _id: "$level",
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
    ]);

    const levels = { beginner: 0, intermediate: 0, advanced: 0 };

    levelAgg.forEach((r) => {
      const lvl = r._id.toLowerCase();
      if (lvl.startsWith("begin")) levels.beginner += r.total;
      else if (lvl.startsWith("inter")) levels.intermediate += r.total;
      else if (lvl.startsWith("adv")) levels.advanced += r.total;
    });

    const overall =
      levels.beginner + levels.intermediate + levels.advanced;

    const rankAgg = await StudentQuizProgress.aggregate([
      {
        $group: {
          _id: "$studentId",
          total: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    let rank = null;
    rankAgg.forEach((r, i) => {
      if (String(r._id) === String(studentId)) rank = i + 1;
    });

    res.json({
      student: {
        id: studentId,
        name: student.name,
        email: student.email,
      },
      levels,
      overall,
      rank,
    });
  } catch (err) {
    console.error("SUMMARY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   GET /api/leaderboard/report  (EXCEL WITH SUMMARY)
====================================================== */
router.get("/report", auth, async (req, res) => {
  try {
    const raw = await StudentQuizProgress.aggregate([
      {
        $group: {
          _id: {
            studentId: "$studentId",
            date: "$date",
            level: "$level",
          },
          score: { $sum: { $ifNull: ["$totalDiamonds", 0] } },
        },
      },
      {
        $lookup: {
          from: "students",
          localField: "_id.studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
    ]);

    const map = {};

    raw.forEach((r) => {
      const sid = String(r._id.studentId);
      if (!map[sid]) {
        map[sid] = {
          name: r.student.name,
          email: r.student.email,
          dates: {},
          summary: {
            bT: 0, bD: 0,
            iT: 0, iD: 0,
            aT: 0, aD: 0,
          },
        };
      }

      if (!map[sid].dates[r._id.date]) {
        map[sid].dates[r._id.date] = { b: 0, i: 0, a: 0 };
      }

      const lvl = r._id.level.toLowerCase();
      if (lvl.startsWith("begin")) {
        map[sid].dates[r._id.date].b += r.score;
        map[sid].summary.bT += r.score;
        map[sid].summary.bD++;
      } else if (lvl.startsWith("inter")) {
        map[sid].dates[r._id.date].i += r.score;
        map[sid].summary.iT += r.score;
        map[sid].summary.iD++;
      } else if (lvl.startsWith("adv")) {
        map[sid].dates[r._id.date].a += r.score;
        map[sid].summary.aT += r.score;
        map[sid].summary.aD++;
      }
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Leaderboard");

    ws.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Date", key: "date", width: 15 },
      { header: "Beginner", key: "b", width: 15 },
      { header: "Intermediate", key: "i", width: 15 },
      { header: "Advanced", key: "a", width: 15 },
      { header: "Total", key: "t", width: 15 },
    ];

    Object.values(map).forEach((s) => {
      Object.entries(s.dates).forEach(([d, v]) => {
        ws.addRow({
          name: s.name,
          email: s.email,
          date: d,
          b: v.b,
          i: v.i,
          a: v.a,
          t: v.b + v.i + v.a,
        });
      });
    });

    ws.addRow({});
    ws.addRow({ name: "STUDENT AVERAGE SUMMARY" });
    ws.addRow({
      name: "Name",
      b: "Avg Beginner",
      i: "Avg Intermediate",
      a: "Avg Advanced",
      t: "Overall Avg",
    });

    Object.values(map).forEach((s) => {
      const ab = s.summary.bT / (s.summary.bD || 1);
      const ai = s.summary.iT / (s.summary.iD || 1);
      const aa = s.summary.aT / (s.summary.aD || 1);
      const overall = (ab + ai + aa) / 3;

      ws.addRow({
        name: s.name,
        b: ab.toFixed(2),
        i: ai.toFixed(2),
        a: aa.toFixed(2),
        t: overall.toFixed(2),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=leaderboard.xlsx"
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("REPORT ERROR:", err);
    res.status(500).json({ message: "Report failed" });
  }
});

/* ======================================================
   GET /api/leaderboard/charts  ✅ FINAL
====================================================== */
router.get("/charts", auth, async (req, res) => {
  try {
    const { from, to, studentId } = req.query;

    const match = {};

    if (studentId) {
      match.studentId = new mongoose.Types.ObjectId(studentId);
    }

    if (from && to) {
      match.$expr = {
        $and: [
          {
            $gte: [
              { $dateFromString: { dateString: "$date" } },
              new Date(from),
            ],
          },
          {
            $lte: [
              { $dateFromString: { dateString: "$date" } },
              new Date(to),
            ],
          },
        ],
      };
    }

    const agg = await StudentQuizProgress.aggregate([
      { $match: match },
      {
        $group: {
          _id: { date: "$date", level: { $toLower: "$level" } },
          score: { $sum: "$totalDiamonds" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const map = {};
    const totals = { beginner: 0, intermediate: 0, advanced: 0 };

    agg.forEach((r) => {
      if (!map[r._id.date])
        map[r._id.date] = { beginner: 0, intermediate: 0, advanced: 0 };

      if (r._id.level.startsWith("begin")) {
        map[r._id.date].beginner += r.score;
        totals.beginner += r.score;
      } else if (r._id.level.startsWith("inter")) {
        map[r._id.date].intermediate += r.score;
        totals.intermediate += r.score;
      } else if (r._id.level.startsWith("adv")) {
        map[r._id.date].advanced += r.score;
        totals.advanced += r.score;
      }
    });

    const dates = Object.keys(map);

    const normalize = (s, m) => (m ? Math.round((s / m) * 100) : 0);

    res.json({
      dates,
      beginner: dates.map((d) => normalize(map[d].beginner, 50)),
      intermediate: dates.map((d) => normalize(map[d].intermediate, 100)),
      advanced: dates.map((d) => normalize(map[d].advanced, 150)),
      totals,
    });
  } catch (err) {
    console.error("CHART ERROR:", err);
    res.status(500).json({ message: "Chart error" });
  }
});

export default router;
