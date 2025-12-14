import mongoose from "mongoose";

const quizSchema = new mongoose.Schema({
  date: { type: String, required: true },       // 2025-05-20
  level: { type: String, required: true },      // beginner / intermediate / advance
  question: { type: String, required: true },
  options: { type: [String], required: true },  // 4 options
  correctIndex: { type: Number, required: true },
  imageUrl: { type: String }
}, { timestamps: true });

export default mongoose.model("Quiz", quizSchema);
