import mongoose from "mongoose";

const uploadLogSchema = new mongoose.Schema(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    filename: { type: String, required: true }, // name of ZIP or "Single Upload" or "Multiple PDFs"
    status: { type: String, enum: ["success", "partial_success", "failed"], default: "success" },
    totalFiles: { type: Number, default: 0 },
    assignedCount: { type: Number, default: 0 },
    errors: { type: [String], default: [] },
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

export default mongoose.model("UploadLog", uploadLogSchema);
