import express from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import mongoose from "mongoose";
import Certificate from "../models/Certificate.js";
import RewardCertificate from "../models/RewardCertificate.js";
import CertificateAssignment from "../models/CertificateAssignment.js";
import UploadLog from "../models/UploadLog.js";
import Student from "../models/Student.js";
import uploadCertificate from "../middleware/uploadCertificate.js";
import cloudinary from "../config/cloudinary.js";
import auth from "../middleware/auth.js";
import requireSuperAdmin from "../middleware/requireSuperAdmin.js";

const router = express.Router();

// Helper to recursively read all files in a directory
function getFilesRec(dir, filesList = []) {
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFilesRec(name, filesList);
    } else {
      filesList.push(name);
    }
  }
  return filesList;
}

/* ==========================================================
   1) OLD UPLOAD CERTIFICATE (FOR BACKWARD COMPATIBILITY)
   ========================================================== */
router.post(
  "/upload",
  uploadCertificate.single("certificate"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const result = await cloudinary.uploader.upload(
        req.file.path,
        {
          folder: "certificates",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        }
      );

      const certificate = await Certificate.create({
        studentId: req.body.studentId,
        studentName: req.body.studentName,
        certificateName:
          req.body.certificateName ||
          "Participation Certificate",
        certificateUrl: result.secure_url,
      });

      res.status(201).json({
        success: true,
        certificate,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  }
);

/* ==========================================================
   2) SINGLE CERTIFICATE UPLOAD (NEW SYSTEM)
   ========================================================== */
router.post(
  "/upload-single",
  auth,
  requireSuperAdmin,
  uploadCertificate.single("certificate"),
  async (req, res) => {
    try {
      const { studentId, certificateName } = req.body;
      if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
      }

      const student = await Student.findById(studentId);
      if (!student) {
        return res.status(400).json({ success: false, message: "Student not found" });
      }

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(
        req.file.path,
        {
          folder: "certificates",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        }
      );

      // Create Upload Log
      const uploadLog = await UploadLog.create({
        uploadedBy: req.user.userId,
        filename: req.file.originalname,
        status: "success",
        totalFiles: 1,
        assignedCount: 1,
        errors: [],
      });

      // Create Certificate
      const rewardCert = await RewardCertificate.create({
        title: certificateName || "Participation Certificate",
        certificateUrl: result.secure_url,
        originalFilename: req.file.originalname,
        uploadedBy: req.user.userId,
        uploadLogId: uploadLog._id,
      });

      // Assign to Student
      await CertificateAssignment.create({
        certificateId: rewardCert._id,
        studentId: student._id,
        mappedField: "studentId",
        mappedValue: student._id.toString(),
      });

      res.status(201).json({
        success: true,
        certificate: rewardCert,
      });
    } catch (err) {
      console.error("Single Upload Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/* ==========================================================
   3) BULK CERTIFICATES UPLOAD (PDFs or ZIP)
   ========================================================== */
router.post(
  "/upload-bulk",
  auth,
  requireSuperAdmin,
  uploadCertificate.array("certificates", 100),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "No files uploaded" });
      }

      const { certificateName } = req.body;

      // Create initial Upload Log
      const uploadLog = new UploadLog({
        uploadedBy: req.user.userId,
        filename: req.files.length === 1 ? req.files[0].originalname : "Multiple PDFs",
        status: "failed",
        totalFiles: 0,
        assignedCount: 0,
        errors: [],
      });
      await uploadLog.save();

      const filesToProcess = [];

      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === ".zip") {
          // Process ZIP
          const tempDirName = `temp_zip_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const tempDirPath = path.join("uploads", tempDirName);
          fs.mkdirSync(tempDirPath, { recursive: true });

          try {
            const zip = new AdmZip(file.path);
            zip.extractAllTo(tempDirPath, true);

            const allExtractedFiles = getFilesRec(tempDirPath);
            for (const extractedFile of allExtractedFiles) {
              const baseName = path.basename(extractedFile);
              // Skip OS hidden files and __MACOSX directories
              if (baseName.startsWith(".") || extractedFile.includes("__MACOSX")) {
                continue;
              }
              const extractedExt = path.extname(extractedFile).toLowerCase();
              if (extractedExt === ".pdf" || [".png", ".jpg", ".jpeg"].includes(extractedExt)) {
                filesToProcess.push({
                  tempPath: extractedFile,
                  originalname: baseName,
                  isTemp: true,
                  tempDirToDelete: tempDirPath,
                });
              }
            }
          } catch (zipErr) {
            uploadLog.errors.push(`ZIP Extraction Failed for ${file.originalname}: ${zipErr.message}`);
          }
        } else if (ext === ".pdf" || [".png", ".jpg", ".jpeg"].includes(ext)) {
          // Process direct file
          filesToProcess.push({
            tempPath: file.path,
            originalname: file.originalname,
            isTemp: false,
          });
        } else {
          uploadLog.errors.push(`Unsupported file format skipped: ${file.originalname}`);
        }
      }

      uploadLog.totalFiles = filesToProcess.length;

      // Match and Upload each file
      for (const f of filesToProcess) {
        const ext = path.extname(f.originalname).toLowerCase();
        const filenameWithoutExt = path.basename(f.originalname, ext).trim();

        let student = null;
        let matchedField = "";
        let matchedValue = "";

        // 1. Match by Student ID (Mongoose ObjectId format)
        if (mongoose.Types.ObjectId.isValid(filenameWithoutExt)) {
          student = await Student.findById(filenameWithoutExt);
          if (student) {
            matchedField = "studentId";
            matchedValue = student._id.toString();
          }
        }

        // 2. Match by Email
        if (!student) {
          student = await Student.findOne({ email: filenameWithoutExt });
          if (student) {
            matchedField = "email";
            matchedValue = student.email;
          }
        }

        // 3. Match by Registration Number (Email Prefix e.g. 99220041351)
        if (!student) {
          student = await Student.findOne({
            email: { $regex: new RegExp("^" + filenameWithoutExt + "@", "i") },
          });
          if (student) {
            matchedField = "registrationNumber";
            matchedValue = filenameWithoutExt;
          }
        }

        if (!student) {
          uploadLog.errors.push(`Could not map file "${f.originalname}": No student found matching ID, Email, or Reg Number.`);
          continue;
        }

        // Upload to Cloudinary
        try {
          const result = await cloudinary.uploader.upload(
            f.tempPath,
            {
              folder: "certificates",
              resource_type: "auto",
              use_filename: true,
              unique_filename: true,
            }
          );

          const rewardCert = await RewardCertificate.create({
            title: certificateName || filenameWithoutExt || "Participation Certificate",
            certificateUrl: result.secure_url,
            originalFilename: f.originalname,
            uploadedBy: req.user.userId,
            uploadLogId: uploadLog._id,
          });

          await CertificateAssignment.create({
            certificateId: rewardCert._id,
            studentId: student._id,
            mappedField: matchedField,
            mappedValue: matchedValue,
          });

          uploadLog.assignedCount += 1;
        } catch (uploadErr) {
          console.error("Cloudinary bulk upload error:", uploadErr);
          uploadLog.errors.push(`Cloudinary upload failed for "${f.originalname}": ${uploadErr.message}`);
        }
      }

      // Update upload log status
      if (uploadLog.assignedCount === uploadLog.totalFiles && uploadLog.errors.length === 0) {
        uploadLog.status = "success";
      } else if (uploadLog.assignedCount > 0) {
        uploadLog.status = "partial_success";
      } else {
        uploadLog.status = "failed";
      }

      await uploadLog.save();

      // Clean up temp directories
      const dirsToDelete = [...new Set(filesToProcess.filter((x) => x.isTemp).map((x) => x.tempDirToDelete))];
      for (const d of dirsToDelete) {
        try {
          fs.rmSync(d, { recursive: true, force: true });
        } catch (rmErr) {
          console.error("Failed to delete temp ZIP extraction folder", d, rmErr);
        }
      }

      res.json({
        success: true,
        log: uploadLog,
      });
    } catch (err) {
      console.error("Bulk Upload Error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

/* ==========================================================
   4) FETCH UPLOAD LOGS
   ========================================================== */
router.get("/logs", auth, requireSuperAdmin, async (req, res) => {
  try {
    const logs = await UploadLog.find()
      .populate("uploadedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ==========================================================
   5) SECURE STUDENT CERTIFICATES (COMBINES OLD + NEW SYSTEMS)
   ========================================================== */
router.get("/student/:studentId", auth, async (req, res) => {
  try {
    // Security check: if student, restrict to own certificates
    if (req.user.role === "student" && req.user.userId !== req.params.studentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const studentId = req.params.studentId;

    // Fetch from old model
    const oldCerts = await Certificate.find({ studentId })
      .sort({ createdAt: -1 })
      .lean();

    // Fetch from new assignments model
    const newAssignments = await CertificateAssignment.find({ studentId })
      .populate("certificateId")
      .sort({ createdAt: -1 })
      .lean();

    const newCerts = newAssignments
      .filter((a) => a.certificateId)
      .map((a) => ({
        _id: a.certificateId._id.toString(),
        studentId: a.studentId.toString(),
        studentName: a.mappedField === "email" ? a.mappedValue : "Student",
        certificateName: a.certificateId.title,
        certificateUrl: a.certificateId.certificateUrl,
        createdAt: a.certificateId.createdAt,
        isNewSystem: true,
      }));

    // Combine and sort by date
    const allCerts = [...oldCerts, ...newCerts].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(allCerts);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* ==========================================================
   5.5) DOWNLOAD PROXY ENDPOINT
   ========================================================== */
function getCloudinaryInfo(url) {
  if (!url || !url.includes("res.cloudinary.com")) {
    return null;
  }
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length < 4) return null;

    const cloudName = pathParts[0];
    const resourceType = pathParts[1];
    const type = pathParts[2];

    let startIndex = 3;
    if (pathParts[startIndex].startsWith("v") && !isNaN(pathParts[startIndex].substring(1))) {
      startIndex = 4;
    }

    const publicIdWithFormat = pathParts.slice(startIndex).join("/");
    const lastDotIndex = publicIdWithFormat.lastIndexOf(".");
    let publicId = publicIdWithFormat;
    let format = "";
    if (lastDotIndex !== -1) {
      publicId = publicIdWithFormat.substring(0, lastDotIndex);
      format = publicIdWithFormat.substring(lastDotIndex + 1);
    }

    return {
      cloudName,
      resourceType,
      type,
      publicId,
      format
    };
  } catch (err) {
    console.error("Error parsing Cloudinary URL:", err);
    return null;
  }
}

router.get("/download/:id", async (req, res) => {
  try {
    let token = req.query.token;
    if (!token) {
      const authHeader = req.header("Authorization") || "";
      token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized: No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
    }

    const userId = decoded.userId;
    const role = decoded.role;
    const certId = req.params.id;

    let certificateUrl = "";
    let title = "Certificate";
    let studentId = "";

    const newCert = await RewardCertificate.findById(certId).lean();
    if (newCert) {
      certificateUrl = newCert.certificateUrl;
      title = newCert.title;

      const assignment = await CertificateAssignment.findOne({ certificateId: certId }).lean();
      if (assignment) {
        studentId = assignment.studentId.toString();
      }
    } else {
      const oldCert = await Certificate.findById(certId).lean();
      if (oldCert) {
        certificateUrl = oldCert.certificateUrl;
        title = oldCert.certificateName;
        studentId = oldCert.studentId.toString();
      }
    }

    if (!certificateUrl) {
      return res.status(404).json({ success: false, message: "Certificate not found" });
    }

    if (role === "student" && userId !== studentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Securely retrieve the file from storage
    let fetchUrl = certificateUrl;
    const cloudinaryInfo = getCloudinaryInfo(certificateUrl);
    if (cloudinaryInfo) {
      try {
        fetchUrl = cloudinary.utils.private_download_url(
          cloudinaryInfo.publicId,
          cloudinaryInfo.format || "pdf",
          {
            resource_type: cloudinaryInfo.resourceType,
            type: cloudinaryInfo.type,
          }
        );
      } catch (signErr) {
        console.error("Failed to generate private download URL:", signErr);
      }
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      return res.status(500).json({ success: false, message: "Failed to retrieve certificate from storage" });
    }

    const buffer = await response.arrayBuffer();
    const cleanTitle = title.replace(/[^a-zA-Z0-9\s-_]/g, "").trim() || "Certificate";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cleanTitle}.pdf"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Download proxy error:", err);
    res.status(500).json({ success: false, message: "Server error during download" });
  }
});

/* ==========================================================
   6) ALL CERTIFICATES
   ========================================================== */
router.get("/", auth, requireSuperAdmin, async (req, res) => {
  try {
    const certificates = await Certificate.find()
      .sort({ createdAt: -1 })
      .lean();
    res.json(certificates);
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

export default router;