import multer from "multer";

const storage = multer.diskStorage({});

const uploadCertificate = multer({
  storage,
});

export default uploadCertificate;