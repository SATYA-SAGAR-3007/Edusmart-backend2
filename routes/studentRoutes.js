const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const studentController = require("../controllers/studentController");

// Specific routes first
router.get("/my-students", verifyToken, studentController.getStudentsByTeacher);

// General collection routes
router.post("/", verifyToken, studentController.addStudent);
router.get("/", verifyToken, studentController.getStudents);

// Parameterized item routes
router.get("/:id", verifyToken, studentController.getStudentById);
router.delete("/:id", verifyToken, studentController.deleteStudent);

module.exports = router;