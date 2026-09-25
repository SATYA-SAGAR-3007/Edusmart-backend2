const express=require("express")
const router=express.Router()
const { verifyToken } = require("../middleware/authMiddleware")

const attendanceController=require("../controllers/attendanceController")

router.post("/", verifyToken, attendanceController.addAttendance);
router.post("/mark", verifyToken, attendanceController.markBatchAttendance);
router.post("/batch", verifyToken, attendanceController.markBatchAttendance);
router.get("/", verifyToken, attendanceController.getAttendanceRisk);
router.get("/risk", verifyToken, attendanceController.getRiskStudents);
router.get("/student/:id", attendanceController.getStudentAttendance);

module.exports = router;