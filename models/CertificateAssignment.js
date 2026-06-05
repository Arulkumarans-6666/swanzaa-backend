import mongoose from "mongoose";

const certificateAssignmentSchema = new mongoose.Schema(
  {
    certificateId: { type: mongoose.Schema.Types.ObjectId, ref: "RewardCertificate", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    mappedField: { type: String, required: true }, // "studentId", "email", "registrationNumber"
    mappedValue: { type: String, required: true },
  },
  { timestamps: true }
);

certificateAssignmentSchema.index({ studentId: 1 });
certificateAssignmentSchema.index({ certificateId: 1 });

export default mongoose.model("CertificateAssignment", certificateAssignmentSchema);
