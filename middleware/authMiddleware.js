// ============================================
// EduSmart - Auth Middleware (JWT Verification)
// ============================================

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "edusmart_super_secret_key_change_in_production";

exports.verifyToken = (req, res, next) => {

  const header = req.headers.authorization;

  if (!header) {
    return res.status(403).json({ message: "No token provided" });
  }

  const token = header.split(" ")[1];

  if (!token) {
    return res.status(403).json({ message: "Malformed token" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};