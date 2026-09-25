const db = require("../database/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "edusmart_super_secret_key_change_in_production";

//////////////////////////////////////////////////
// ✅ TEACHER SIGNUP
//////////////////////////////////////////////////
exports.teacherSignup = async (req, res) => {
  const { name, email, username, password, organization_id, department_id, designation } = req.body;

  if (!name || !email || !username || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    // Check duplicate
    const [existing] = await db.query(
      "SELECT id FROM teachers WHERE email = ? OR username = ?",
      [email, username]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Teacher with this email or username already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const orgId = organization_id || 1;
    const deptId = department_id || 1;
    const desig = designation || "lecturer";

    const [result] = await db.query(
      `INSERT INTO teachers (name, email, username, password, organization_id, department_id, designation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, username, hashedPassword, orgId, deptId, desig]
    );

    const newTeacherId = result.insertId;
    const token = jwt.sign(
      { id: newTeacherId, role: "teacher", email, name },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Teacher registered successfully",
      token,
      teacher: {
        id: newTeacherId,
        name,
        email,
        username,
        organization_id: orgId,
        department_id: deptId,
        designation: desig,
      },
    });
  } catch (err) {
    console.error("Teacher signup error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ TEACHER LOGIN
//////////////////////////////////////////////////
exports.teacherLogin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM teachers WHERE username = ? OR email = ?",
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    const teacher = rows[0];
    const match = await bcrypt.compare(password, teacher.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: teacher.id, role: "teacher", email: teacher.email },
      SECRET,
      { expiresIn: "1d" }
    );

    const { password: _, ...teacherData } = teacher;

    res.json({
      message: "Login successful",
      token: token,
      teacher: teacherData,
    });
  } catch (err) {
    console.error("Teacher login error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ STUDENT SIGNUP
//////////////////////////////////////////////////
exports.studentSignup = async (req, res) => {
  const { name, email, password, department, year, roll_number, phone, organization_id, class_id } = req.body;

  if (!name || !email || !password || !year) {
    return res.status(400).json({ message: "All required fields must be filled" });
  }

  try {
    const [existing] = await db.query(
      "SELECT id FROM students WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Student with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const orgId = organization_id || 1;
    const classId = class_id || 1;
    let deptId = 1;

    // If department name was provided as string, attempt to find its department_id
    if (department) {
      const [deptRows] = await db.query(
        "SELECT id FROM departments WHERE name LIKE ? OR code LIKE ? LIMIT 1",
        [`%${department}%`, `%${department}%`]
      );
      if (deptRows.length > 0) {
        deptId = deptRows[0].id;
      }
    }

    const [result] = await db.query(
      `INSERT INTO students (name, email, password, organization_id, department_id, class_id, year, roll_number, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, orgId, deptId, classId, year, roll_number || null, phone || null]
    );

    const newStudentId = result.insertId;

    // Record in class_students junction
    await db.query(
      `INSERT INTO class_students (class_id, student_id, academic_year, roll_number_in_class)
       VALUES (?, ?, '2025-2026', ?)
       ON DUPLICATE KEY UPDATE roll_number_in_class = VALUES(roll_number_in_class)`,
      [classId, newStudentId, roll_number || null]
    );

    const token = jwt.sign(
      { id: newStudentId, role: "student", email, name },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Student registered successfully",
      token,
      student: {
        id: newStudentId,
        name,
        email,
        organization_id: orgId,
        department_id: deptId,
        class_id: classId,
        year,
        roll_number: roll_number || null,
      },
    });
  } catch (err) {
    console.error("Student signup error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// ✅ STUDENT LOGIN
//////////////////////////////////////////////////
exports.studentLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const [rows] = await db.query(
      `SELECT s.*, 
              COALESCE(d.name, 'General') AS department_name,
              c.name AS class_name, c.code AS class_code
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN classes c ON s.class_id = c.id
       WHERE s.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    const student = rows[0];
    const match = await bcrypt.compare(password, student.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid login credentials" });
    }

    const token = jwt.sign(
      { id: student.id, role: "student", email: student.email },
      SECRET,
      { expiresIn: "1d" }
    );

    const { password: _, ...studentData } = student;
    studentData.department = student.department_name;

    res.json({
      message: "Login successful",
      token: token,
      student: studentData,
    });
  } catch (err) {
    console.error("Student login error:", err);
    res.status(500).json({ error: err.message });
  }
};