const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const performanceController = require("../controllers/performanceController");

// Classes in charge of (Faculty gets only her assigned classes, Admin gets all)
router.get("/classes", verifyToken, performanceController.getFacultyClasses);
router.get("/my-classes", verifyToken, performanceController.getFacultyClasses);

// Comprehensive Dual-Risk Radar (Attendance Risk + Academic Performance Risk)
router.get("/risk", verifyToken, performanceController.getComprehensiveRiskRadar);
router.get("/risk-radar", verifyToken, performanceController.getComprehensiveRiskRadar);

// Student 360° performance profile (subject breakdown + AI prediction)
router.get("/student/:id", verifyToken, performanceController.getStudentPerformance);

// Class performance summary & ranking
router.get("/class/:class_id", verifyToken, performanceController.getClassPerformance);

// Teacher academic performance
router.get("/teacher/:teacher_id", verifyToken, performanceController.getTeacherPerformance);

// Institution / Class Leaderboard
router.get("/leaderboard", verifyToken, performanceController.getLeaderboard);

module.exports = router;
