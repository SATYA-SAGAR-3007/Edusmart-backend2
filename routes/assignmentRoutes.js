const express=require("express")
const router=express.Router()
const { verifyToken } = require("../middleware/authMiddleware")

const assignmentController=require("../controllers/assignmentController")

router.post("/", verifyToken, assignmentController.addAssignment);
router.post("/submissions", verifyToken, assignmentController.submitAssignment);
router.get("/", verifyToken, assignmentController.getAssignments);
router.get("/insights", verifyToken, assignmentController.getInsights);
router.get("/student/:id", verifyToken, assignmentController.getAssignmentsByStudent);
router.post("/predict", verifyToken, assignmentController.predictScore);
router.get("/insights/student/:id", verifyToken, assignmentController.getStudentInsights);

module.exports = router;