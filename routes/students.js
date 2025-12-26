// backend/routes/students.js
import express from "express";
import Student from "../models/Student.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import auth from "../middleware/auth.js";
import requireSuperAdmin from "../middleware/requireSuperAdmin.js";

const router = express.Router();

/*
----------------------------------------------------------
  PUBLIC STUDENT LOGIN
----------------------------------------------------------
*/
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const student = await Student.findOne({ email });
    if (!student)
      return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, student.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const payload = {
      userId: student._id,
      role: "student",
      email: student.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });

    res.json({
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        role: "student",
      },
    });
  } catch (err) {
    console.error("Student Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
----------------------------------------------------------
  ADMIN + SUPER ADMIN CAN VIEW
----------------------------------------------------------
*/

// GET all students
router.get("/", auth, async (req, res) => {
  try {
    const students = await Student.find().select("-password");
    res.json({ students });
  } catch (err) {
    console.error("GET /students error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET single student by id
// Note: keeps same auth middleware as GET / so permissions remain unchanged.
router.get("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate id format quickly to avoid unnecessary DB error (optional)
    if (!id || id.length < 12) {
      return res.status(400).json({ message: "Invalid student id" });
    }

    const student = await Student.findById(id).select("-password");
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({ student });
  } catch (err) {
    console.error("GET /students/:id error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/*
----------------------------------------------------------
  ONLY SUPER ADMIN CAN CREATE / EDIT / DELETE
----------------------------------------------------------
*/

// CREATE
router.post("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, dob, gender, className, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const exists = await Student.findOne({ email });
    if (exists)
      return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const student = await Student.create({
      name,
      email,
      phone,
      dob,
      gender,
      className,
      password: hashed,
      role: "student",
    });

    const output = student.toObject();
    delete output.password;

    res.status(201).json({ student: output });
  } catch (err) {
    console.error("POST /students ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE
router.put("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, phone, dob, gender, className, password } = req.body;

    const update = { name, phone, dob, gender, className };

    if (password && password.trim()) {
      update.password = await bcrypt.hash(password, 10);
    }

    const student = await Student.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select("-password");

    if (!student)
      return res.status(404).json({ message: "Student not found" });

    res.json({ student });
  } catch (err) {
    console.error("PUT /students/:id ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE
router.delete("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await Student.findByIdAndDelete(req.params.id);
    if (!deleted)
      return res.status(404).json({ message: "Student not found" });

    res.json({ message: "Student deleted" });
  } catch (err) {
    console.error("DELETE /students error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// CHANGE PASSWORD (logged in student)
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Logged in student (from token)
    const student = await Student.findById(req.user.userId);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const match = await bcrypt.compare(currentPassword, student.password);
    if (!match) {
      return res.status(400).json({ message: "Current password incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    student.password = hashed;
    await student.save();

    res.json({ message: "Password changed successfully" });

  } catch (err) {
    console.error("Student change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
