const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");

const adminController = require("../controllers/adminController");

// Authentication
router.post("/login", adminController.adminLogin);
router.post("/signup", adminController.adminSignup);
router.post("/register", adminController.adminSignup);
router.get("/organizations", adminController.getAllOrganizations);

// Class & Subject / Teacher Allocation & Cascading Enrollments
router.post("/assign-subject-teacher", verifyToken, adminController.assignSubjectTeacher);
router.post("/class/assign-teacher", verifyToken, adminController.assignSubjectTeacher);
router.post("/assign-subject-to-class", verifyToken, adminController.assignSubjectToClass);
router.post("/assign-students-to-class", verifyToken, adminController.assignStudentsToClass);
router.post("/student/assign-class", verifyToken, adminController.assignStudentsToClass);
router.post("/replace-subject-teacher", verifyToken, adminController.replaceSubjectTeacher);
router.post("/remove-student-from-class", verifyToken, adminController.removeStudentFromClass);
router.post("/remove-subject-from-class", verifyToken, adminController.removeSubjectFromClass);
router.post("/assign-class-teacher", verifyToken, adminController.assignClassTeacher);

// Monitoring Class Performance Across All Subjects
router.get("/class-performance/:class_id", verifyToken, adminController.getClassFullPerformance);
router.get("/class/:class_id/performance", verifyToken, adminController.getClassFullPerformance);

// Academic Structure Queries
router.get("/unassigned-students", verifyToken, adminController.getUnassignedStudents);
router.get("/classes", verifyToken, adminController.getAllClasses);
router.post("/classes", verifyToken, adminController.createClass);
router.get("/teachers", verifyToken, adminController.getAllTeachers);
router.get("/subjects", verifyToken, adminController.getAllSubjects);
router.post("/subjects", verifyToken, adminController.createSubject);
router.get("/departments", verifyToken, adminController.getAllDepartments);
router.get("/analytics", verifyToken, adminController.getSystemAnalytics);
router.get("/stats", verifyToken, adminController.getSystemAnalytics);

// Faculty & Class Allocation Synchronizer
router.get("/sync-faculties", async (req, res) => {
  try {
    const syncAll = require("../database/sync_faculty_classes");
    const result = await syncAll();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

