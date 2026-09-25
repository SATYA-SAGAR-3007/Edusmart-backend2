const db = require("../database/db");
const bcrypt = require("bcrypt");

//////////////////////////////////////////////////
// ✅ ADD STUDENT
//////////////////////////////////////////////////
exports.addStudent = async (req, res) => {
  const { name, email, department, year, phone, roll_number, password, organization_id, class_id } = req.body;

  if (!name || !email || !year) {
    return res.status(400).json({ error: "Name, email, and year are required" });
  }

  try {
    const orgId = organization_id || 1;
    const classId = class_id || 1;
    let deptId = 1;

    if (department) {
      const [deptRows] = await db.query(
        "SELECT id FROM departments WHERE name LIKE ? OR code LIKE ? LIMIT 1",
        [`%${department}%`, `%${department}%`]
      );
      if (deptRows.length > 0) {
        deptId = deptRows[0].id;
      }
    }

    const defaultPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash("student123", 10);

    const [result] = await db.query(
      `INSERT INTO students (name, email, password, organization_id, department_id, class_id, year, phone, roll_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, defaultPassword, orgId, deptId, classId, year, phone || null, roll_number || null]
    );

    const newStudentId = result.insertId;

    // Automatically record in class_students junction
    await db.query(
      `INSERT INTO class_students (class_id, student_id, academic_year, roll_number_in_class)
       VALUES (?, ?, '2025-2026', ?)
       ON DUPLICATE KEY UPDATE roll_number_in_class = VALUES(roll_number_in_class)`,
      [classId, newStudentId, roll_number || null]
    );

    res.json({
      message: "Student added successfully",
      studentId: newStudentId,
    });
  } catch (err) {
    console.error("Add student error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET ALL STUDENTS
//////////////////////////////////////////////////
exports.getStudents = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.name, s.email, s.year, s.semester, s.roll_number, s.phone,
              COALESCE(d.name, 'General') AS department,
              c.name AS class_name, c.code AS class_code,
              s.organization_id, s.department_id, s.class_id, s.created_at
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.is_active = TRUE
       ORDER BY s.id DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Get students error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET STUDENT BY ID
//////////////////////////////////////////////////
exports.getStudentById = async (req, res) => {
  const id = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT s.id, s.name, s.email, s.year, s.semester, s.roll_number, s.phone,
              COALESCE(d.name, 'General') AS department,
              c.name AS class_name, c.code AS class_code,
              s.organization_id, s.department_id, s.class_id, s.created_at
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Get student by ID error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ DELETE STUDENT
//////////////////////////////////////////////////
exports.deleteStudent = async (req, res) => {
  const id = req.params.id;

  try {
    await db.query("DELETE FROM students WHERE id = ?", [id]);

    res.json({
      message: "Student deleted",
    });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ GET STUDENTS BY TEACHER
//////////////////////////////////////////////////
exports.getStudentsByTeacher = async (req, res) => {
  const teacherId = req.user?.id;

  try {
    // If enrollments exist for this teacher, fetch enrolled students;
    // otherwise fallback to all active students in the teacher's department/school
    const [enrolled] = await db.query(
      `SELECT DISTINCT s.id, s.name, s.email, s.year, s.semester, s.roll_number,
              COALESCE(d.name, 'General') AS department
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE e.teacher_id = ? AND s.is_active = TRUE`,
      [teacherId]
    );

    if (enrolled.length > 0) {
      return res.json(enrolled);
    }

    // Fallback: return active students
    const [allStudents] = await db.query(
      `SELECT s.id, s.name, s.email, s.year, s.semester, s.roll_number,
              COALESCE(d.name, 'General') AS department
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.is_active = TRUE
       ORDER BY s.id DESC`
    );

    res.json(allStudents);
  } catch (err) {
    console.error("Get students by teacher error:", err);
    res.status(500).json({ error: err.message });
  }
};