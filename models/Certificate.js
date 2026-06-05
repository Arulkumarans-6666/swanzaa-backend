import mongoose from "mongoose";

const certificateSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    studentName: String,
    certificateName: String,
    certificateUrl: String,
  },
  { timestamps: true }
);

export default mongoose.model("Certificate", certificateSchema);