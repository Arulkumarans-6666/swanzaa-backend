import mongoose from "mongoose";

const progressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  date: { type: String, required: true },
  level: { type: String, required: true },

  answers: [
    {
      questionId: String,
      attempts: Number,          // how many tries for this question
      earnedDiamonds: Number,    // 10 / 5 / 3 / 0
      isCorrect: Boolean
    }
  ],

  totalDiamonds: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },

}, { timestamps: true });

export default mongoose.model("StudentQuizProgress", progressSchema);
