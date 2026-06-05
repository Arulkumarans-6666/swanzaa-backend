import mongoose from "mongoose";

const rewardCertificateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    certificateUrl: { type: String, required: true },
    originalFilename: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    uploadLogId: { type: mongoose.Schema.Types.ObjectId, ref: "UploadLog" },
  },
  { timestamps: true }
);

rewardCertificateSchema.index({ uploadLogId: 1 });

export default mongoose.model("RewardCertificate", rewardCertificateSchema);
