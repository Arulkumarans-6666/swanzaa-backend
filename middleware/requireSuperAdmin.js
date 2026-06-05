export default function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== "superadmin") {
    return res.status(403).json({ message: "Access denied (Super Admin only)" });
  }
  next();
}
