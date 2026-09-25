const db = require("../database/db");

//////////////////////////////////////////////////
// ✅ ADD TASK
//////////////////////////////////////////////////
exports.addTask = async (req, res) => {
  const { title, description, deadline, student_id, status, teacher_id, subject_id, priority } = req.body;

  if (!title || !student_id) {
    return res.status(400).json({ error: "title and student_id are required" });
  }

  try {
    const teacherId = teacher_id || req.user?.id || 1;
    const taskStatus = status || "pending";
    const taskPriority = priority || "medium";
    const formattedDeadline = deadline ? new Date(deadline) : null;

    const [result] = await db.query(
      `INSERT INTO tasks (title, description, deadline, student_id, teacher_id, subject_id, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, formattedDeadline, student_id, teacherId, subject_id || null, taskPriority, taskStatus]
    );

    res.json({
      message: "Task created",
      taskId: result.insertId,
    });
  } catch (err) {
    console.error("Add task error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET ALL TASKS
//////////////////////////////////////////////////
exports.getTasks = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.*, s.name AS student_name, sub.name AS subject_name
       FROM tasks t
       LEFT JOIN students s ON t.student_id = s.id
       LEFT JOIN subjects sub ON t.subject_id = sub.id
       ORDER BY t.id DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET STUDENT TASKS
//////////////////////////////////////////////////
exports.getStudentTasks = async (req, res) => {
  const id = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT t.*, sub.name AS subject_name
       FROM tasks t
       LEFT JOIN subjects sub ON t.subject_id = sub.id
       WHERE t.student_id = ?
       ORDER BY t.deadline ASC, t.id DESC`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Get student tasks error:", err);
    res.status(500).json({ error: err.message });
  }
};