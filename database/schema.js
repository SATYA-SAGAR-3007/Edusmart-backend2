// ============================================
// EduSmart - Database Schema (MySQL2)
// ============================================
// Normalized relational tables with comprehensive
// relationships for Organizations, Departments,
// Classes, Teachers, Students, Subjects, Assignments,
// Attendance, Tasks, and Announcements.
// ============================================

const tableSchemas = [

  // ========================================
  // 1. ORGANIZATIONS
  // ========================================
  {
    name: "organizations",
    sql: `
      CREATE TABLE IF NOT EXISTS organizations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        address TEXT,
        phone VARCHAR(20),
        email VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 2. ADMINS (Administration / Principal / Dean)
  // ========================================
  {
    name: "admins",
    sql: `
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role ENUM('super_admin', 'admin', 'principal', 'dean') DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_admin_org (organization_id),

        INDEX idx_admin_org (organization_id),

        CONSTRAINT fk_admin_organization
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 3. DEPARTMENTS
  // ========================================
  {
    name: "departments",
    sql: `
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_dept_org_code (organization_id, code),

        INDEX idx_dept_org (organization_id),

        CONSTRAINT fk_dept_organization
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 3. SUBJECTS
  // ========================================
  {
    name: "subjects",
    sql: `
      CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        department_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        description TEXT,
        credits INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_subj_dept_code (department_id, code),

        INDEX idx_subject_dept (department_id),

        CONSTRAINT fk_subj_department
          FOREIGN KEY (department_id) REFERENCES departments(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 4. TEACHERS
  // ========================================
  {
    name: "teachers",
    sql: `
      CREATE TABLE IF NOT EXISTS teachers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NULL DEFAULT 1,
        department_id INT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        designation ENUM('professor', 'associate_professor', 'assistant_professor', 'lecturer') DEFAULT 'lecturer',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_teacher_org (organization_id),
        INDEX idx_teacher_dept (department_id),

        CONSTRAINT fk_teacher_organization
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_teacher_department
          FOREIGN KEY (department_id) REFERENCES departments(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 5. CLASSES (Class / Section in Department)
  // Relationships:
  // - Class ↔ Department (N:1)
  // - Class ↔ Organization (N:1)
  // - Class ↔ Teacher (N:1 for Class Teacher / Mentor)
  // ========================================
  {
    name: "classes",
    sql: `
      CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NULL DEFAULT 1,
        department_id INT NOT NULL,
        class_teacher_id INT NULL,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        semester INT DEFAULT 1,
        section VARCHAR(10) DEFAULT 'A',
        room_number VARCHAR(50),
        capacity INT DEFAULT 60,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_class_dept_code_year (department_id, code, academic_year),

        INDEX idx_class_org (organization_id),
        INDEX idx_class_dept (department_id),
        INDEX idx_class_teacher (class_teacher_id),

        CONSTRAINT fk_class_organization
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_class_department
          FOREIGN KEY (department_id) REFERENCES departments(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_class_teacher
          FOREIGN KEY (class_teacher_id) REFERENCES teachers(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 6. STUDENTS
  // Relationships:
  // - Student ↔ Department (N:1)
  // - Student ↔ Organization (N:1)
  // - Student ↔ Class (N:1 primary active class)
  // ========================================
  {
    name: "students",
    sql: `
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        organization_id INT NULL DEFAULT 1,
        department_id INT NULL DEFAULT 1,
        class_id INT NULL DEFAULT 1,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        roll_number VARCHAR(50) UNIQUE,
        year INT NOT NULL,
        semester INT DEFAULT 1,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_student_org (organization_id),
        INDEX idx_student_dept (department_id),
        INDEX idx_student_class (class_id),
        INDEX idx_student_year (year),

        CONSTRAINT fk_student_organization
          FOREIGN KEY (organization_id) REFERENCES organizations(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_student_department
          FOREIGN KEY (department_id) REFERENCES departments(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_student_class
          FOREIGN KEY (class_id) REFERENCES classes(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 7. CLASS_STUDENTS (Class ↔ Student M:N)
  // Tracks student memberships across classes and academic years
  // ========================================
  {
    name: "class_students",
    sql: `
      CREATE TABLE IF NOT EXISTS class_students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        class_id INT NOT NULL,
        student_id INT NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        roll_number_in_class VARCHAR(50),
        status ENUM('active', 'transferred', 'graduated', 'dropped') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY uq_class_student (class_id, student_id, academic_year),

        INDEX idx_cs_class (class_id),
        INDEX idx_cs_student (student_id),

        CONSTRAINT fk_cs_class
          FOREIGN KEY (class_id) REFERENCES classes(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_cs_student
          FOREIGN KEY (student_id) REFERENCES students(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 8. CLASS_SUBJECTS (Class ↔ Subject ↔ Teacher M:N)
  // Assigns subjects to classes along with the allocated teacher
  // ========================================
  {
    name: "class_subjects",
    sql: `
      CREATE TABLE IF NOT EXISTS class_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        class_id INT NOT NULL,
        subject_id INT NOT NULL,
        teacher_id INT NULL,
        academic_year VARCHAR(20) NOT NULL,
        semester INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY uq_class_subject_year (class_id, subject_id, academic_year),

        INDEX idx_clsub_class (class_id),
        INDEX idx_clsub_subject (subject_id),
        INDEX idx_clsub_teacher (teacher_id),

        CONSTRAINT fk_clsub_class
          FOREIGN KEY (class_id) REFERENCES classes(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_clsub_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_clsub_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 9. TEACHER_SUBJECTS (Teacher ↔ Subject M:N)
  // ========================================
  {
    name: "teacher_subjects",
    sql: `
      CREATE TABLE IF NOT EXISTS teacher_subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        subject_id INT NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY uq_teacher_subject_year (teacher_id, subject_id, academic_year),

        INDEX idx_ts_teacher (teacher_id),
        INDEX idx_ts_subject (subject_id),

        CONSTRAINT fk_ts_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_ts_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 10. ENROLLMENTS (Student ↔ Subject ↔ Teacher M:N)
  // ========================================
  {
    name: "enrollments",
    sql: `
      CREATE TABLE IF NOT EXISTS enrollments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        subject_id INT NOT NULL,
        teacher_id INT NOT NULL,
        academic_year VARCHAR(20) NOT NULL,
        semester INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY uq_enrollment (student_id, subject_id, academic_year),

        INDEX idx_enroll_student (student_id),
        INDEX idx_enroll_subject (subject_id),
        INDEX idx_enroll_teacher (teacher_id),

        CONSTRAINT fk_enroll_student
          FOREIGN KEY (student_id) REFERENCES students(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_enroll_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_enroll_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 11. ASSIGNMENTS
  // Optional link to class_id for assigning per-class
  // ========================================
  {
    name: "assignments",
    sql: `
      CREATE TABLE IF NOT EXISTS assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NULL DEFAULT 1,
        subject_id INT NULL DEFAULT 1,
        class_id INT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        max_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_assign_teacher (teacher_id),
        INDEX idx_assign_subject (subject_id),
        INDEX idx_assign_class (class_id),

        CONSTRAINT fk_assign_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_assign_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_assign_class
          FOREIGN KEY (class_id) REFERENCES classes(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 12. ASSIGNMENT_SUBMISSIONS (Student scores)
  // ========================================
  {
    name: "assignment_submissions",
    sql: `
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assignment_id INT NOT NULL,
        student_id INT NOT NULL,
        score DECIMAL(5,2),
        submitted_at TIMESTAMP NULL,
        graded_at TIMESTAMP NULL,
        status ENUM('pending', 'submitted', 'graded', 'late') DEFAULT 'pending',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        UNIQUE KEY uq_submission (assignment_id, student_id),

        INDEX idx_sub_assignment (assignment_id),
        INDEX idx_sub_student (student_id),
        INDEX idx_sub_status (status),

        CONSTRAINT fk_sub_assignment
          FOREIGN KEY (assignment_id) REFERENCES assignments(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_sub_student
          FOREIGN KEY (student_id) REFERENCES students(id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 13. ATTENDANCE
  // Optional link to class_id for batch attendance per class
  // ========================================
  {
    name: "attendance",
    sql: `
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        subject_id INT NULL DEFAULT 1,
        teacher_id INT NULL DEFAULT 1,
        class_id INT NULL DEFAULT 1,
        date DATE NOT NULL,
        status ENUM('present', 'absent', 'late', 'excused') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE KEY uq_attendance (student_id, date),

        INDEX idx_att_student (student_id),
        INDEX idx_att_subject (subject_id),
        INDEX idx_att_teacher (teacher_id),
        INDEX idx_att_class (class_id),
        INDEX idx_att_date (date),

        CONSTRAINT fk_att_student
          FOREIGN KEY (student_id) REFERENCES students(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_att_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_att_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_att_class
          FOREIGN KEY (class_id) REFERENCES classes(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 14. TASKS
  // ========================================
  {
    name: "tasks",
    sql: `
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NULL DEFAULT 1,
        student_id INT NOT NULL,
        subject_id INT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        deadline DATETIME,
        priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
        status ENUM('pending', 'in_progress', 'completed', 'overdue') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_task_teacher (teacher_id),
        INDEX idx_task_student (student_id),
        INDEX idx_task_status (status),
        INDEX idx_task_deadline (deadline),

        CONSTRAINT fk_task_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_task_student
          FOREIGN KEY (student_id) REFERENCES students(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_task_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },

  // ========================================
  // 15. ANNOUNCEMENTS
  // Can be targeted to a class or subject
  // ========================================
  {
    name: "announcements",
    sql: `
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        teacher_id INT NOT NULL,
        subject_id INT NULL,
        class_id INT NULL DEFAULT 1,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        INDEX idx_ann_teacher (teacher_id),
        INDEX idx_ann_subject (subject_id),
        INDEX idx_ann_class (class_id),

        CONSTRAINT fk_ann_teacher
          FOREIGN KEY (teacher_id) REFERENCES teachers(id)
          ON DELETE CASCADE ON UPDATE CASCADE,

        CONSTRAINT fk_ann_subject
          FOREIGN KEY (subject_id) REFERENCES subjects(id)
          ON DELETE SET NULL ON UPDATE CASCADE,

        CONSTRAINT fk_ann_class
          FOREIGN KEY (class_id) REFERENCES classes(id)
          ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `,
  },
];

module.exports = tableSchemas;
