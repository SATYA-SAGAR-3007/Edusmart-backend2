const db = require("../database/db");

//////////////////////////////////////////////////
// ✅ GET DASHBOARD STATS
//////////////////////////////////////////////////
exports.getStats = async (req, res) => {
  try {
    const [studentsResult] = await db.query(
      "SELECT COUNT(*) AS total FROM students WHERE is_active = TRUE"
    );
    const [assignmentsResult] = await db.query(
      "SELECT COUNT(*) AS total FROM assignments"
    );
    const [attendanceResult] = await db.query(
      "SELECT COUNT(*) AS total FROM attendance"
    );

    res.json({
      totalStudents: studentsResult[0]?.total || 0,
      totalAssignments: assignmentsResult[0]?.total || 0,
      totalAttendance: attendanceResult[0]?.total || 0,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: err.message });
  }
};