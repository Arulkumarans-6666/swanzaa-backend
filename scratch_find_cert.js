import mongoose from "mongoose";
import dotenv from "dotenv";
import RewardCertificate from "./models/RewardCertificate.js";
import Certificate from "./models/Certificate.js";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const id = "6a21afdb66229575fe5381a9";
  
  const newCert = await RewardCertificate.findById(id).lean();
  console.log("New Certificate:", newCert);

  const oldCert = await Certificate.findById(id).lean();
  console.log("Old Certificate:", oldCert);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
