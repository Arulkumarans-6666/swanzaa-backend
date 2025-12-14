// backend/routes/users.js
import express from "express";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
const router = express.Router();

router.get("/", async (req,res)=>{
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).select("-password").sort({ createdAt: -1 });
    res.json({ users });
  } catch(err){
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", async (req,res)=>{
  try {
    const { name, email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    if (await User.findOne({ email })) return res.status(400).json({ message: "Email already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed, role: role || "student" });
    await user.save();
    const out = user.toObject(); delete out.password;
    res.status(201).json({ user: out });
  } catch(err){
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req,res)=>{
  try {
    const u = await User.findById(req.params.id).select("-password");
    if (!u) return res.status(404).json({ message: "User not found" });
    res.json({ user: u });
  } catch(err){ console.error(err); res.status(500).json({ message: "Server error" }); }
});

router.put("/:id", async (req,res)=>{
  try {
    const payload = { name: req.body.name, role: req.body.role };
    if (req.body.password) payload.password = await bcrypt.hash(req.body.password, 10);
    const updated = await User.findByIdAndUpdate(req.params.id, payload, { new: true }).select("-password");
    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ user: updated });
  } catch(err){ console.error(err); res.status(500).json({ message: "Server error" }); }
});

router.delete("/:id", async (req,res)=>{
  try {
    const r = await User.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Deleted" });
  } catch(err){ console.error(err); res.status(500).json({ message: "Server error" }); }
});

export default router;
