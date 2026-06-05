import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  dob: { type: String, required: true },
  gender: { type: String, required: true },
  className: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: "student" },
}, { timestamps: true });

export default mongoose.model("Student", studentSchema);
