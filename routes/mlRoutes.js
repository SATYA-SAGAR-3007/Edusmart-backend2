const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const mlController = require("../controllers/mlController");

// Attendance risk prediction (Random Forest)
router.post("/attendance-risk", verifyToken, mlController.predictAttendanceRisk);

// Academic performance prediction (Random Forest Regressor)
router.post("/predict-performance", verifyToken, mlController.predictPerformance);

// Class-subject understanding insights (["Bad", "Average", "Good", "Better", "Excellent"])
router.post("/class-subject-insights", verifyToken, mlController.getClassSubjectInsights);

module.exports = router;
