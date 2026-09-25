const db = require("../database/db");
const mlService = require("../services/mlService");

//////////////////////////////////////////////////
// 1. 🎯 ATTENDANCE RISK PREDICTION
//////////////////////////////////////////////////
exports.predictAttendanceRisk = async (req, res) => {
  const { student_id, attendance_percentage, absent_streak, total_classes } = req.body;

  try {
    let attPct = attendance_percentage;
    let streak = absent_streak || 0;
    let total = total_classes || 30;
    let missed = 0;

    // If student_id is provided, pull real data from DB
    if (student_id) {
      const [attRows] = await db.query(
        "SELECT status, date FROM attendance WHERE student_id = ? ORDER BY date DESC",
        [student_id]
      );

      if (attRows.length > 0) {
        total = attRows.length;
        const presentCount = attRows.filter((r) => r.status === "present").length;
        attPct = Math.round((presentCount / total) * 100);
        missed = total - presentCount;

        // Calculate consecutive absent streak from recent days
        streak = 0;
        for (const row of attRows) {
          if (row.status === "absent") {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    const prediction = await mlService.predictAttendanceRisk({
      attendance_percentage: attPct !== undefined ? attPct : 75,
      absent_streak: streak,
      total_classes: total,
      classes_missed: missed,
    });

    res.json({
      student_id: student_id || null,
      ...prediction,
    });
  } catch (err) {
    console.error("Attendance risk prediction error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 2. 📈 PERFORMANCE PREDICTION
//////////////////////////////////////////////////
exports.predictPerformance = async (req, res) => {
  const { student_id, attendance, assignmentScore, submissionRate, taskRate } = req.body;

  try {
    let attVal = attendance;
    let assignVal = assignmentScore;
    let submVal = submissionRate || 85;
    let taskVal = taskRate || 75;

    // If student_id is provided, aggregate real metrics from DB
    if (student_id) {
      // 1. Attendance percentage
      const [attRows] = await db.query(
        "SELECT status FROM attendance WHERE student_id = ?",
        [student_id]
      );
      if (attRows.length > 0) {
        const present = attRows.filter((r) => r.status === "present").length;
        attVal = Math.round((present / attRows.length) * 100);
      }

      // 2. Average assignment score
      const [assignRows] = await db.query(
        `SELECT sub.score, a.max_score 
         FROM assignment_submissions sub
         JOIN assignments a ON sub.assignment_id = a.id
         WHERE sub.student_id = ? AND sub.score IS NOT NULL`,
        [student_id]
      );
      if (assignRows.length > 0) {
        const totalPct = assignRows.reduce((sum, r) => sum + (r.score / r.max_score) * 100, 0);
        assignVal = Math.round(totalPct / assignRows.length);
      }

      // 3. Task completion percentage
      const [taskRows] = await db.query(
        "SELECT status FROM tasks WHERE student_id = ?",
        [student_id]
      );
      if (taskRows.length > 0) {
        const completed = taskRows.filter((r) => r.status === "completed").length;
        taskVal = Math.round((completed / taskRows.length) * 100);
      }
    }

    const prediction = await mlService.predictPerformance({
      attendance: attVal !== undefined ? attVal : 75,
      assignment_score: assignVal !== undefined ? assignVal : 70,
      submission_rate: submVal,
      task_rate: taskVal,
    });

    res.json({
      student_id: student_id || null,
      ...prediction,
    });
  } catch (err) {
    console.error("Performance prediction error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 3. 🧠 CLASS-SUBJECT UNDERSTANDING INSIGHTS
// Categorizes as: ["Bad", "Average", "Good", "Better", "Excellent"]
//////////////////////////////////////////////////
exports.getClassSubjectInsights = async (req, res) => {
  const { class_id, subject_id } = req.body;

  if (!class_id || !subject_id) {
    return res.status(400).json({ error: "class_id and subject_id are required" });
  }

  try {
    // 1. Fetch Class and Subject meta
    const [classRows] = await db.query("SELECT name, code FROM classes WHERE id = ?", [class_id]);
    const [subjRows] = await db.query("SELECT name, code FROM subjects WHERE id = ?", [subject_id]);

    const className = classRows[0]?.name || `Class #${class_id}`;
    const subjectName = subjRows[0]?.name || `Subject #${subject_id}`;

    // 2. Fetch all students in this class
    const [students] = await db.query(
      `SELECT DISTINCT s.id AS student_id, s.name AS student_name, s.roll_number
       FROM students s
       WHERE s.class_id = ? AND s.is_active = TRUE`,
      [class_id]
    );

    if (students.length === 0) {
      return res.json({
        class_name: className,
        subject_name: subjectName,
        total_students: 0,
        overall_insight: "Average",
        message: "No active students enrolled in this class.",
      });
    }

    // 3. For each student, query their assignment scores and attendance for this subject
    const studentDataPayload = [];

    for (const st of students) {
      // Assignment average for this subject
      const [scores] = await db.query(
        `SELECT sub.score, a.max_score
         FROM assignment_submissions sub
         JOIN assignments a ON sub.assignment_id = a.id
         WHERE sub.student_id = ? AND a.subject_id = ? AND sub.score IS NOT NULL`,
        [st.student_id, subject_id]
      );

      let avgScore = 70; // baseline if no assignments yet
      if (scores.length > 0) {
        const total = scores.reduce((acc, r) => acc + (r.score / r.max_score) * 100, 0);
        avgScore = Math.round(total / scores.length);
      }

      // Subject-specific attendance
      const [att] = await db.query(
        `SELECT status FROM attendance WHERE student_id = ? AND subject_id = ?`,
        [st.student_id, subject_id]
      );

      let attPct = 80;
      if (att.length > 0) {
        const present = att.filter((r) => r.status === "present").length;
        attPct = Math.round((present / att.length) * 100);
      }

      studentDataPayload.push({
        student_id: st.student_id,
        student_name: st.student_name,
        assignment_score: avgScore,
        attendance: attPct,
        punctuality: 85,
      });
    }

    // 4. Pass to Random Forest model
    const insights = await mlService.getClassSubjectInsights({
      class_name: className,
      subject_name: subjectName,
      students: studentDataPayload,
    });

    res.json(insights);
  } catch (err) {
    console.error("Class subject insights error:", err);
    res.status(500).json({ error: err.message });
  }
};
