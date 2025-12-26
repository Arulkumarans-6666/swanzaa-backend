// backend/routes/admins.js
import express from "express";
import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import auth from "../middleware/auth.js";
import requireSuperAdmin from "../middleware/requireSuperAdmin.js";

const router = express.Router();

/*
----------------------------------------------------------
  ALL ADMIN ROUTES ARE PROTECTED
  Must pass:
  1. auth  → valid token
  2. requireSuperAdmin → role === "superadmin"
----------------------------------------------------------
*/

//
// GET all admins
//
router.get("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const admins = await Admin.find().select("-password");
    res.json({ admins });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//
// GET single admin by ID
//
router.get("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select("-password");

    if (!admin)
      return res.status(404).json({ message: "Admin not found" });

    res.json({ admin });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//
// CREATE admin
//
router.post("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, email, phone, dob, gender, password } = req.body;

    if (await Admin.findOne({ email }))
      return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email,
      phone,
      dob,
      gender,
      password: hashed,
      role: "admin"
    });

    const output = admin.toObject();
    delete output.password;

    res.json({ admin: output });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//
// UPDATE admin
//
router.put("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, phone, dob, gender, password } = req.body;

    const update = { name, phone, dob, gender };

    if (password && password.trim()) {
      update.password = await bcrypt.hash(password, 10);
    }

    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).select("-password");

    if (!admin)
      return res.status(404).json({ message: "Admin not found" });

    res.json({ admin });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

//
// DELETE admin
//
router.delete("/:id", auth, requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await Admin.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Admin not found" });

    res.json({ message: "Deleted" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// PUBLIC ADMIN LOGIN (no auth needed)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin)
      return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match)
      return res.status(400).json({ message: "Invalid credentials" });

    const payload = { userId: admin._id, role: "admin", email: admin.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin"
      }
    });

  } catch (err) {
    console.error("Admin Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// CHANGE PASSWORD (logged in admin)
router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New passwords do not match" });
    }

    // Logged in admin id (from token)
    const admin = await Admin.findById(req.user.userId);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password incorrect" });
    }

    // Update password
    const hashed = await bcrypt.hash(newPassword, 10);
    admin.password = hashed;
    await admin.save();

    res.json({ message: "Password changed successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
