// backend/createTestStudent.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Student from "./models/Student.js";

dotenv.config();

// 1️⃣ CONNECT TO MONGO
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err);
    process.exit(1);
  }
}

// 2️⃣ CREATE TEST STUDENT
async function createStudent() {
  await connectDB();

  const email = "99220041351@klu.ac.in";
  const password = "123456";

  // Check if already exists
  const exists = await Student.findOne({ email });
  if (exists) {
    console.log("⚠ Student already exists:", exists.email);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);

  const student = await Student.create({
    name: "Test Student",
    email,
    phone: "9876543210",
    dob: "2000-01-01",
    gender: "Male",
    className: "A1",
    password: hashed,
    role: "student",
  });

  console.log("🎉 Student Created Successfully!");
  console.log("📧 Email:", student.email);
  console.log("🔑 Password:", password);

  process.exit(0);
}

createStudent();
