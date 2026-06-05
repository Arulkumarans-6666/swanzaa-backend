// backend/createAdmin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./models/User.js"; // adjust path if needed

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = "admin@gmail.com";
  const exists = await User.findOne({ email });
  if (exists) {
    console.log("User already exists:", exists.email);
    process.exit(0);
  }
  const hashed = await bcrypt.hash("Admin123", 10);
  const user = await User.create({ name: "Admin", email, password: hashed, role: "superadmin" });
  console.log("Created:", user.email);
  process.exit(0);
}
run().catch(e=>{ console.error(e); process.exit(1); });
