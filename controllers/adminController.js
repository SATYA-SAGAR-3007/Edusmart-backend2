const db = require("../database/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mlService = require("../services/mlService");

const SECRET = process.env.JWT_SECRET || "edusmart_super_secret_key_change_in_production";

//////////////////////////////////////////////////
// 1. 🔐 ADMIN LOGIN & SIGNUP
//////////////////////////////////////////////////
exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }

  try {
    const [rows] = await db.query(
      "SELECT * FROM admins WHERE username = ? OR email = ?",
      [username, username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid admin credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, role: "admin", email: admin.email, name: admin.name },
      SECRET,
      { expiresIn: "1d" }
    );

    const { password: _, ...adminData } = admin;

    res.json({
      message: "Admin login successful",
      token,
      admin: adminData,
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.adminSignup = async (req, res) => {
  const {
    name,
    email,
    username,
    password,
    role,
    organization_id,
    organization_name,
    organization_code,
    phone,
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const uname = username || email.split("@")[0];

  try {
    const [existing] = await db.query(
      "SELECT id FROM admins WHERE email = ? OR username = ?",
      [email, uname]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "An administrator with this email or username already exists" });
    }

    let targetOrgId = organization_id;

    // 1️⃣ Option A: Registering a brand new Organization
    if (organization_name && organization_name.trim()) {
      const code =
        organization_code ||
        organization_name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10) ||
        `ORG_${Date.now().toString().slice(-5)}`;

      const [orgResult] = await db.query(
        `INSERT INTO organizations (name, code, email, phone)
         VALUES (?, ?, ?, ?)`,
        [organization_name.trim(), code, email, phone || null]
      );
      targetOrgId = orgResult.insertId;
    }
    // 2️⃣ Option B: Selecting an existing organization (Validate 1-to-1 uniqueness)
    else if (targetOrgId) {
      const [assignedAdmin] = await db.query(
        "SELECT id, name, role FROM admins WHERE organization_id = ?",
        [targetOrgId]
      );

      if (assignedAdmin.length > 0) {
        return res.status(400).json({
          message: `This organization is already managed by ${assignedAdmin[0].name}. Under the strict 1-to-1 institutional policy, please register a new organization or choose an unassigned one.`,
        });
      }
    }
    // 3️⃣ Option C: Auto-create unique organization for this administrator
    else {
      const orgName = `${name}'s Academic Campus`;
      const orgCode = `ORG_${Date.now().toString().slice(-6)}`;
      const [orgResult] = await db.query(
        `INSERT INTO organizations (name, code, email, phone)
         VALUES (?, ?, ?, ?)`,
        [orgName, orgCode, email, phone || null]
      );
      targetOrgId = orgResult.insertId;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // When creating a new institute, the role must automatically be a superior role (super_admin)
    let adminRole;
    if (organization_name && organization_name.trim()) {
      adminRole = "super_admin";
    } else {
      const validRoles = ["super_admin", "admin", "principal", "dean"];
      adminRole = validRoles.includes(role) ? role : "admin";
    }

    const [result] = await db.query(
      `INSERT INTO admins (name, email, username, password, role, organization_id, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, uname, hashedPassword, adminRole, targetOrgId, phone || null]
    );

    const newAdminId = result.insertId;
    const token = jwt.sign(
      { id: newAdminId, role: "admin", email, name },
      SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Administrator registered successfully with 1-to-1 organization link",
      token,
      admin: {
        id: newAdminId,
        name,
        email,
        username: uname,
        role: adminRole,
        organization_id: targetOrgId,
        phone: phone || null,
      },
    });
  } catch (err) {
    console.error("Admin signup error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllOrganizations = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.id, o.name, o.code, o.email, o.phone,
              a.id AS admin_id, a.name AS admin_name, a.role AS admin_role
       FROM organizations o
       LEFT JOIN admins a ON a.organization_id = o.id
       ORDER BY o.id ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 2. 📚 ASSIGN SUBJECT (AND TEACHER) TO CLASS
// ⚡ CASCADE: Automatically enrolls ALL students of this class
// into the assigned subject (Student ↔ Subject relation)
//////////////////////////////////////////////////
exports.assignSubjectTeacher = async (req, res) => {
  const { class_id, subject_id, teacher_id, academic_year, semester } = req.body;

  if (!class_id || !subject_id) {
    return res.status(400).json({ error: "class_id and subject_id are required" });
  }

  const teacherId = teacher_id || 1;
  const year = academic_year || "2025-2026";
  const sem = semester || 1;

  try {
    // 1. Assign subject & teacher to the class
    const [result] = await db.query(
      `INSERT INTO class_subjects (class_id, subject_id, teacher_id, academic_year, semester)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id), semester = VALUES(semester)`,
      [class_id, subject_id, teacherId, year, sem]
    );

    // 2. Link in teacher_subjects junction if teacher provided
    if (teacherId) {
      await db.query(
        `INSERT INTO teacher_subjects (teacher_id, subject_id, academic_year)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE subject_id = VALUES(subject_id)`,
        [teacherId, subject_id, year]
      );
    }

    // 3. ⚡ CASCADE: Find all students currently in this class
    const [students] = await db.query(
      "SELECT id FROM students WHERE class_id = ? AND is_active = TRUE",
      [class_id]
    );

    let enrolledCount = 0;
    // Automatically enroll each student into this newly assigned subject
    for (const st of students) {
      await db.query(
        `INSERT INTO enrollments (student_id, subject_id, teacher_id, academic_year, semester)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id), semester = VALUES(semester)`,
        [st.id, subject_id, teacherId, year, sem]
      );
      enrolledCount++;
    }

    res.json({
      message: "Subject successfully assigned to class",
      class_id,
      subject_id,
      teacher_id: teacherId,
      students_automatically_enrolled: enrolledCount,
    });
  } catch (err) {
    console.error("Assign subject teacher error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.assignSubjectToClass = exports.assignSubjectTeacher;

//////////////////////////////////////////////////
// 3. 🎓 ASSIGN STUDENTS TO CLASS
// ⚡ STRICT RULE: A student can belong to AT MOST ONE active class.
// - If already assigned to another class, they are cleanly transferred:
//   previous class roster status -> 'transferred', previous enrollments migrated,
//   and student is automatically enrolled in all new class subjects!
//////////////////////////////////////////////////
exports.assignStudentsToClass = async (req, res) => {
  const { class_id, student_ids, student_id, academic_year, allow_transfer = true } = req.body;

  if (!class_id) {
    return res.status(400).json({ error: "class_id is required" });
  }

  // Normalize student IDs list
  const ids = student_ids ? (Array.isArray(student_ids) ? student_ids : [student_ids]) : (student_id ? [student_id] : []);

  if (ids.length === 0) {
    return res.status(400).json({ error: "At least one student_id must be provided" });
  }

  try {
    // 1. Fetch destination class info
    const [classRows] = await db.query(
      `SELECT c.id, c.name, c.code, c.academic_year, c.semester, d.name AS department_name
       FROM classes c
       LEFT JOIN departments d ON c.department_id = d.id
       WHERE c.id = ?`,
      [class_id]
    );

    if (classRows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    const targetClass = classRows[0];
    const year = academic_year || targetClass.academic_year || "2025-2026";
    const sem = targetClass.semester || 1;

    // 2. Fetch all subjects currently assigned to the target class
    const [classSubjects] = await db.query(
      "SELECT subject_id, teacher_id FROM class_subjects WHERE class_id = ?",
      [class_id]
    );

    const assignmentResults = [];
    let newlyAssigned = 0;
    let transferred = 0;
    let totalEnrollmentsCreated = 0;

    for (const sid of ids) {
      // Check current student status
      const [studentRows] = await db.query(
        "SELECT id, name, class_id FROM students WHERE id = ?",
        [sid]
      );

      if (studentRows.length === 0) {
        assignmentResults.push({ student_id: sid, error: "Student not found" });
        continue;
      }

      const st = studentRows[0];
      const previousClassId = st.class_id;

      // If student is already in this exact class
      if (previousClassId === parseInt(class_id)) {
        assignmentResults.push({
          student_id: sid,
          name: st.name,
          status: "already_in_class",
          class_id: parseInt(class_id),
          message: "Student is already in this class",
        });
        continue;
      }

      // ⚡ STRICT CONSTRAINT: A student belongs to AT MOST ONE class at any time
      if (previousClassId) {
        if (!allow_transfer) {
          assignmentResults.push({
            student_id: sid,
            name: st.name,
            status: "already_assigned_elsewhere",
            current_class_id: previousClassId,
            message: "Student is already in another class. Set allow_transfer: true to move them.",
          });
          continue;
        }

        // Mark old class roster as transferred
        await db.query(
          "UPDATE class_students SET status = 'transferred' WHERE student_id = ? AND class_id = ?",
          [sid, previousClassId]
        );

        // Remove old class-subject enrollments
        await db.query(
          `DELETE e FROM enrollments e
           JOIN class_subjects cs ON e.subject_id = cs.subject_id AND cs.class_id = ?
           WHERE e.student_id = ?`,
          [previousClassId, sid]
        );

        transferred++;
      } else {
        newlyAssigned++;
      }

      // Set the ONE active class_id for this student
      await db.query("UPDATE students SET class_id = ? WHERE id = ?", [class_id, sid]);

      // Insert or update class_students for target class
      await db.query(
        `INSERT INTO class_students (class_id, student_id, academic_year, status)
         VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
        [class_id, sid, year]
      );

      // ⚡ CASCADE: Automatically enroll student into every subject taught to this class
      for (const cs of classSubjects) {
        await db.query(
          `INSERT INTO enrollments (student_id, subject_id, teacher_id, academic_year, semester)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id), semester = VALUES(semester)`,
          [sid, cs.subject_id, cs.teacher_id || 1, year, sem]
        );
        totalEnrollmentsCreated++;
      }

      assignmentResults.push({
        student_id: sid,
        name: st.name,
        previous_class_id: previousClassId || null,
        new_class_id: parseInt(class_id),
        status: previousClassId ? "transferred" : "assigned",
      });
    }

    res.json({
      message: `Processed ${ids.length} student(s) for Class ${targetClass.name}`,
      class: {
        id: targetClass.id,
        name: targetClass.name,
        code: targetClass.code,
      },
      summary: {
        newly_assigned: newlyAssigned,
        transferred_from_other_classes: transferred,
        subjects_enrolled_per_student: classSubjects.length,
        total_enrollments_created: totalEnrollmentsCreated,
      },
      details: assignmentResults,
    });
  } catch (err) {
    console.error("Assign students to class error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 3b. 📋 GET UNASSIGNED STUDENTS (Students with no class)
//////////////////////////////////////////////////
exports.getUnassignedStudents = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.name, s.email, s.year, s.semester, s.roll_number, s.phone,
              COALESCE(d.name, 'General') AS department_name
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.class_id IS NULL AND s.is_active = TRUE
       ORDER BY s.name ASC`
    );

    res.json({
      count: rows.length,
      students: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 4. 🔄 REPLACE TEACHER FOR A SUBJECT IN CLASS
// ⚡ CASCADE: Updates teacher in class_subjects AND
// in enrollments for all students of this class!
//////////////////////////////////////////////////
exports.replaceSubjectTeacher = async (req, res) => {
  const { class_id, subject_id, new_teacher_id, academic_year } = req.body;

  if (!class_id || !subject_id || !new_teacher_id) {
    return res.status(400).json({ error: "class_id, subject_id, and new_teacher_id are required" });
  }

  const year = academic_year || "2025-2026";

  try {
    // 1. Update teacher in class_subjects
    const [result] = await db.query(
      `UPDATE class_subjects 
       SET teacher_id = ? 
       WHERE class_id = ? AND subject_id = ?`,
      [new_teacher_id, class_id, subject_id]
    );

    if (result.affectedRows === 0) {
      await db.query(
        `INSERT INTO class_subjects (class_id, subject_id, teacher_id, academic_year)
         VALUES (?, ?, ?, ?)`,
        [class_id, subject_id, new_teacher_id, year]
      );
    }

    // 2. Update teacher_subjects qualification link
    await db.query(
      `INSERT INTO teacher_subjects (teacher_id, subject_id, academic_year)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE subject_id = VALUES(subject_id)`,
      [new_teacher_id, subject_id, year]
    );

    // 3. ⚡ CASCADE: Update student enrollments for all students in this class
    const [enrollUpdate] = await db.query(
      `UPDATE enrollments e
       JOIN students s ON e.student_id = s.id
       SET e.teacher_id = ?
       WHERE s.class_id = ? AND e.subject_id = ?`,
      [new_teacher_id, class_id, subject_id]
    );

    res.json({
      message: "Subject teacher replaced successfully",
      class_id,
      subject_id,
      new_teacher_id,
      student_enrollments_updated: enrollUpdate.affectedRows || 0,
    });
  } catch (err) {
    console.error("Replace subject teacher error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 5. ❌ REMOVE STUDENT FROM CLASS
//////////////////////////////////////////////////
exports.removeStudentFromClass = async (req, res) => {
  const { student_id, class_id } = req.body;

  if (!student_id) {
    return res.status(400).json({ error: "student_id is required" });
  }

  try {
    await db.query("UPDATE students SET class_id = NULL WHERE id = ?", [student_id]);

    if (class_id) {
      await db.query(
        "UPDATE class_students SET status = 'transferred' WHERE student_id = ? AND class_id = ?",
        [student_id, class_id]
      );
    }

    res.json({
      message: "Student removed from class successfully",
      student_id,
    });
  } catch (err) {
    console.error("Remove student from class error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 6. ❌ REMOVE SUBJECT FROM CLASS
//////////////////////////////////////////////////
exports.removeSubjectFromClass = async (req, res) => {
  const { class_id, subject_id } = req.body;

  if (!class_id || !subject_id) {
    return res.status(400).json({ error: "class_id and subject_id are required" });
  }

  try {
    await db.query(
      "DELETE FROM class_subjects WHERE class_id = ? AND subject_id = ?",
      [class_id, subject_id]
    );

    // Also remove active enrollments for this class cohort in this subject
    await db.query(
      `DELETE e FROM enrollments e
       JOIN students s ON e.student_id = s.id
       WHERE s.class_id = ? AND e.subject_id = ?`,
      [class_id, subject_id]
    );

    res.json({
      message: "Subject removed from class and student enrollments cleared",
      class_id,
      subject_id,
    });
  } catch (err) {
    console.error("Remove subject from class error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 7. 👔 ASSIGN / CHANGE CLASS TEACHER
//////////////////////////////////////////////////
exports.assignClassTeacher = async (req, res) => {
  const { class_id, class_teacher_id } = req.body;

  if (!class_id || !class_teacher_id) {
    return res.status(400).json({ error: "class_id and class_teacher_id are required" });
  }

  try {
    await db.query(
      "UPDATE classes SET class_teacher_id = ? WHERE id = ?",
      [class_teacher_id, class_id]
    );

    res.json({
      message: "Class Teacher assigned successfully",
      class_id,
      class_teacher_id,
    });
  } catch (err) {
    console.error("Assign class teacher error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 8. 📊 MONITOR ENTIRE CLASS PERFORMANCE ACROSS ALL SUBJECTS
//////////////////////////////////////////////////
exports.getClassFullPerformance = async (req, res) => {
  const classId = req.params.class_id || req.query.class_id;

  if (!classId) {
    return res.status(400).json({ error: "class_id is required" });
  }

  try {
    // 1. Fetch Class Info & Class Teacher
    const [classRows] = await db.query(
      `SELECT c.*, d.name AS department_name, t.name AS class_teacher_name, t.email AS class_teacher_email
       FROM classes c
       LEFT JOIN departments d ON c.department_id = d.id
       LEFT JOIN teachers t ON c.class_teacher_id = t.id
       WHERE c.id = ?`,
      [classId]
    );

    if (classRows.length === 0) {
      return res.status(404).json({ error: "Class not found" });
    }

    const classInfo = classRows[0];

    // 2. Fetch all subjects allocated to this class with assigned teacher
    const [subjects] = await db.query(
      `SELECT cs.subject_id, s.name AS subject_name, s.code AS subject_code, s.credits,
              t.id AS teacher_id, t.name AS teacher_name, t.email AS teacher_email,
              cs.academic_year, cs.semester
       FROM class_subjects cs
       JOIN subjects s ON cs.subject_id = s.id
       LEFT JOIN teachers t ON cs.teacher_id = t.id
       WHERE cs.class_id = ?`,
      [classId]
    );

    // 3. Fetch all active students in this class
    const [students] = await db.query(
      `SELECT s.id, s.name, s.email, s.roll_number
       FROM students s
       WHERE s.class_id = ? AND s.is_active = TRUE`,
      [classId]
    );

    // 4. Compute performance for each subject
    const subjectAnalytics = [];
    let overallScoresTotal = 0;
    let overallScoresCount = 0;

    for (const sub of subjects) {
      // Assignments in this subject
      const [submissions] = await db.query(
        `SELECT sub.student_id, sub.score, a.max_score
         FROM assignment_submissions sub
         JOIN assignments a ON sub.assignment_id = a.id
         JOIN students st ON sub.student_id = st.id
         WHERE a.subject_id = ? AND st.class_id = ? AND sub.score IS NOT NULL`,
        [sub.subject_id, classId]
      );

      let subjectAvg = 0;
      if (submissions.length > 0) {
        const total = submissions.reduce((acc, r) => acc + (r.score / r.max_score) * 100, 0);
        subjectAvg = Math.round(total / submissions.length);
        overallScoresTotal += subjectAvg;
        overallScoresCount++;
      }

      // Subject attendance
      const [attRows] = await db.query(
        `SELECT att.status
         FROM attendance att
         JOIN students st ON att.student_id = st.id
         WHERE att.subject_id = ? AND st.class_id = ?`,
        [sub.subject_id, classId]
      );

      let subjectAttPct = 0;
      if (attRows.length > 0) {
        const present = attRows.filter((r) => r.status === "present").length;
        subjectAttPct = Math.round((present / attRows.length) * 100);
      }

      // Understanding tier
      let understandingTier = "Good";
      if (subjectAvg < 50) understandingTier = "Bad";
      else if (subjectAvg < 65) understandingTier = "Average";
      else if (subjectAvg < 78) understandingTier = "Good";
      else if (subjectAvg < 88) understandingTier = "Better";
      else understandingTier = "Excellent";

      subjectAnalytics.push({
        subject_id: sub.subject_id,
        subject_name: sub.subject_name,
        subject_code: sub.subject_code,
        credits: sub.credits,
        teacher: {
          id: sub.teacher_id,
          name: sub.teacher_name || "Unassigned",
          email: sub.teacher_email || "",
        },
        average_assignment_score: subjectAvg,
        average_attendance: subjectAttPct,
        understanding_tier: understandingTier,
        evaluated_submissions_count: submissions.length,
      });
    }

    const classAverageScore = overallScoresCount > 0 ? Math.round(overallScoresTotal / overallScoresCount) : 0;

    // 5. Overall Class Attendance
    const [classAtt] = await db.query(
      `SELECT att.status
       FROM attendance att
       JOIN students st ON att.student_id = st.id
       WHERE st.class_id = ?`,
      [classId]
    );

    let classAttendancePct = 0;
    if (classAtt.length > 0) {
      const present = classAtt.filter((r) => r.status === "present").length;
      classAttendancePct = Math.round((present / classAtt.length) * 100);
    }

    res.json({
      class: {
        id: classInfo.id,
        name: classInfo.name,
        code: classInfo.code,
        section: classInfo.section,
        academic_year: classInfo.academic_year,
        department: classInfo.department_name,
        class_teacher: classInfo.class_teacher_name || "Unassigned",
        class_teacher_email: classInfo.class_teacher_email || "",
        total_students: students.length,
      },
      class_kpis: {
        class_average_score: classAverageScore,
        class_attendance_percentage: classAttendancePct,
        total_subjects: subjects.length,
      },
      subjects_performance: subjectAnalytics,
    });
  } catch (err) {
    console.error("Get class full performance error:", err);
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 6. 🏫 ACADEMIC MANAGEMENT (Classes, Teachers, Subjects)
//////////////////////////////////////////////////
exports.getAllClasses = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, d.name AS department_name, t.name AS class_teacher_name,
              COUNT(s.id) AS total_students
       FROM classes c
       LEFT JOIN departments d ON c.department_id = d.id
       LEFT JOIN teachers t ON c.class_teacher_id = t.id
       LEFT JOIN students s ON s.class_id = c.id AND s.is_active = TRUE
       GROUP BY c.id
       ORDER BY c.id ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createClass = async (req, res) => {
  const { name, code, department_id, department, class_teacher_id, academic_year, semester, section } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    let deptId = department_id || 1;
    if (department && !department_id) {
      const [deptRows] = await db.query(
        "SELECT id FROM departments WHERE name LIKE ? LIMIT 1",
        [`%${department}%`]
      );
      if (deptRows.length > 0) deptId = deptRows[0].id;
    }

    const classCode = code || name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    const [result] = await db.query(
      `INSERT INTO classes (name, code, department_id, class_teacher_id, academic_year, semester, section)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, classCode, deptId, class_teacher_id || null, academic_year || "2025-2026", semester || 1, section || "A"]
    );

    res.json({
      message: "Class created successfully",
      classId: result.insertId,
    });
  } catch (err) {
    console.error("Create class error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllTeachers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT t.id, t.name, t.email, t.username, t.phone, t.designation,
              d.name AS department_name
       FROM teachers t
       LEFT JOIN departments d ON t.department_id = d.id
       WHERE t.is_active = TRUE
       ORDER BY t.name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllSubjects = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, d.name AS department_name
       FROM subjects s
       LEFT JOIN departments d ON s.department_id = d.id
       WHERE s.is_active = TRUE
       ORDER BY s.name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSubject = async (req, res) => {
  const { name, code, department_id, department, credits } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Subject name is required" });
  }

  try {
    let deptId = department_id || 1;
    if (department && !department_id) {
      const [deptRows] = await db.query(
        "SELECT id FROM departments WHERE name LIKE ? LIMIT 1",
        [`%${department}%`]
      );
      if (deptRows.length > 0) deptId = deptRows[0].id;
    }

    const subjectCode = code || name.slice(0, 3).toUpperCase() + Math.floor(100 + Math.random() * 900);

    const [result] = await db.query(
      `INSERT INTO subjects (name, code, department_id, credits)
       VALUES (?, ?, ?, ?)`,
      [name, subjectCode, deptId, credits || 3]
    );

    res.json({
      message: "Subject created successfully",
      subjectId: result.insertId,
    });
  } catch (err) {
    console.error("Create subject error:", err);
    res.status(500).json({ error: err.message });
  }
};


exports.getAllDepartments = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM departments WHERE is_active = TRUE ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//////////////////////////////////////////////////
// 7. 🌐 INSTITUTION HIGH-LEVEL ANALYTICS
//////////////////////////////////////////////////
exports.getSystemAnalytics = async (req, res) => {
  try {
    const [students] = await db.query("SELECT COUNT(*) AS total FROM students WHERE is_active = TRUE");
    const [teachers] = await db.query("SELECT COUNT(*) AS total FROM teachers WHERE is_active = TRUE");
    const [classes] = await db.query("SELECT COUNT(*) AS total FROM classes WHERE is_active = TRUE");
    const [departments] = await db.query("SELECT COUNT(*) AS total FROM departments WHERE is_active = TRUE");
    const [assignments] = await db.query("SELECT COUNT(*) AS total FROM assignments");

    res.json({
      total_students: students[0].total,
      total_teachers: teachers[0].total,
      total_classes: classes[0].total,
      total_departments: departments[0].total,
      total_assignments: assignments[0].total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
