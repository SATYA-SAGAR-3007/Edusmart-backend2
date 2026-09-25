const db = require("../database/db");
const { exec } = require("child_process");
const path = require("path");

//////////////////////////////////////////////////
// ✅ ADD ASSIGNMENT
//////////////////////////////////////////////////
exports.addAssignment = async (req, res) => {
  const { student_id, topic, title, score, max_score, date, due_date, teacher_id, subject_id, class_id, description } = req.body;
  const assignmentTitle = title || topic;

  if (!assignmentTitle) {
    return res.status(400).json({ error: "Topic/Title is required" });
  }

  try {
    const teacherId = teacher_id || req.user?.id || 1;
    const subjectId = subject_id || 1;
    const maxScoreVal = parseFloat(max_score) || 100;
    const dueDate = due_date || date || new Date().toISOString().slice(0, 10);

    // 1. Create assignment definition
    const [assignResult] = await db.query(
      `INSERT INTO assignments (teacher_id, subject_id, title, description, max_score, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teacherId, subjectId, assignmentTitle, description || null, maxScoreVal, dueDate]
    );

    const assignmentId = assignResult.insertId;

    // 2. If student_id was provided, record their submission/score
    if (student_id) {
      const scoreVal = score !== undefined && score !== null && score !== "" ? parseFloat(score) : null;
      await db.query(
        `INSERT INTO assignment_submissions (assignment_id, student_id, score, status, submitted_at, graded_at)
         VALUES (?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE score = VALUES(score), status = VALUES(status)`,
        [assignmentId, student_id, scoreVal, scoreVal !== null ? "graded" : "submitted"]
      );
    } else if (class_id) {
      // Auto-assign to all enrolled students in the class
      const [students] = await db.query(
        "SELECT id FROM students WHERE class_id = ? AND is_active = TRUE",
        [class_id]
      );
      for (const st of students) {
        await db.query(
          `INSERT INTO assignment_submissions (assignment_id, student_id, status)
           VALUES (?, ?, 'pending')
           ON DUPLICATE KEY UPDATE status = status`,
          [assignmentId, st.id]
        );
      }
    }

    res.json({
      message: "Assignment added",
      assignmentId: assignmentId,
    });
  } catch (err) {
    console.error("Add assignment error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ SUBMIT ASSIGNMENT (Student Turn-in)
//////////////////////////////////////////////////
exports.submitAssignment = async (req, res) => {
  const { assignment_id, student_id, content } = req.body;
  const targetStudentId = student_id || req.user?.id;

  if (!assignment_id || !targetStudentId) {
    return res.status(400).json({ error: "assignment_id and student_id are required" });
  }

  try {
    await db.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, status, submitted_at, remarks)
       VALUES (?, ?, 'submitted', NOW(), ?)
       ON DUPLICATE KEY UPDATE status = 'submitted', submitted_at = NOW(), remarks = VALUES(remarks)`,
      [assignment_id, targetStudentId, content || null]
    );

    res.json({ message: "Homework submitted successfully", assignment_id, student_id: targetStudentId });
  } catch (err) {
    console.error("Submit assignment error:", err);
    res.status(500).json({ error: err.message });
  }
};


//////////////////////////////////////////////////
// ✅ GET ALL ASSIGNMENTS
//////////////////////////////////////////////////
exports.getAssignments = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         a.id,
         sub.student_id,
         a.title AS topic,
         a.title,
         COALESCE(sub.score, 0) AS score,
         a.max_score,
         COALESCE(DATE_FORMAT(a.due_date, '%Y-%m-%d'), DATE_FORMAT(sub.created_at, '%Y-%m-%d')) AS date,
         COALESCE(sub.status, 'pending') AS status
       FROM assignments a
       LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id
       ORDER BY a.id DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Get assignments error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET INSIGHTS (Aggregated)
//////////////////////////////////////////////////
exports.getInsights = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         a.title AS topic,
         COALESCE(AVG(sub.score), 0) AS score,
         a.max_score
       FROM assignments a
       LEFT JOIN assignment_submissions sub ON a.id = sub.assignment_id
       GROUP BY a.id, a.title, a.max_score`
    );

    const insights = rows.map((a) => {
      const max = parseFloat(a.max_score) || 100;
      const score = parseFloat(a.score) || 0;
      const percentage = (score / max) * 100;

      let level = "Good";
      if (percentage < 50) level = "Bad";
      else if (percentage < 75) level = "Average";

      return {
        topic: a.topic,
        percentage: Math.round(percentage),
        level,
      };
    });

    const weakTopics = insights
      .filter((i) => i.level === "Bad")
      .map((i) => i.topic);

    res.json({
      insights,
      weakTopics,
    });
  } catch (err) {
    console.error("Get insights error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET ASSIGNMENTS BY STUDENT
//////////////////////////////////////////////////
exports.getAssignmentsByStudent = async (req, res) => {
  const studentId = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT 
         a.title AS topic,
         a.title,
         COALESCE(sub.score, 0) AS score,
         a.max_score,
         COALESCE(DATE_FORMAT(a.due_date, '%Y-%m-%d'), DATE_FORMAT(sub.created_at, '%Y-%m-%d')) AS date,
         COALESCE(sub.status, 'pending') AS status
       FROM assignments a
       JOIN assignment_submissions sub ON a.id = sub.assignment_id
       WHERE sub.student_id = ?
       ORDER BY a.id DESC`,
      [studentId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Get assignments by student error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ PREDICT SCORE (ML Random Forest Engine)
//////////////////////////////////////////////////
const mlService = require("../services/mlService");

exports.predictScore = async (req, res) => {
  let { attendance, assignmentScore } = req.body;

  try {
    const result = await mlService.predictPerformance({
      attendance: attendance || 0,
      assignment_score: assignmentScore || 0,
    });

    res.json({
      predicted_score: result.predicted_score,
      predicted_grade: result.predicted_grade,
      metrics_breakdown: result.metrics_breakdown,
      engine: result.engine,
    });
  } catch (err) {
    console.error("Predict score error:", err);
    res.status(500).json({ error: "Prediction failed" });
  }
};

//////////////////////////////////////////////////
// ✅ GET STUDENT INSIGHTS
//////////////////////////////////////////////////
exports.getStudentInsights = async (req, res) => {
  const id = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT 
         a.title AS topic,
         COALESCE(sub.score, 0) AS score,
         a.max_score
       FROM assignments a
       JOIN assignment_submissions sub ON a.id = sub.assignment_id
       WHERE sub.student_id = ?`,
      [id]
    );

    const weakTopics = rows
      .filter((r) => {
        const max = parseFloat(r.max_score) || 100;
        const score = parseFloat(r.score) || 0;
        return (score / max) * 100 < 50;
      })
      .map((r) => r.topic);

    res.json({
      weakTopics,
    });
  } catch (err) {
    console.error("Get student insights error:", err);
    res.status(500).json({ error: err.message });
  }
};
