// ============================================
// EduSmart - Database Initialization Script
// ============================================
// Run this once to create the database and
// all 12 tables from scratch with core foundation.
//
// Usage: node database/initDb.js
// ============================================

const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

// Explicitly load .env from the backend root directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const tableSchemas = require("./schema");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT) || 3306;
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "";
const DB_NAME = process.env.DB_NAME || "edusmart_db";

async function initDatabase() {
  let connection;

  try {
    // ========================================
    // STEP 1: Connect WITHOUT database
    // ========================================
    console.log("\n🔌 Connecting to MySQL server...");
    console.log(`   Host: ${DB_HOST}:${DB_PORT}`);
    console.log(`   User: ${DB_USER}`);
    console.log(`   Password set: ${DB_PASSWORD ? "YES (from .env)" : "NO"}`);

    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    console.log("✅ Connected to MySQL server\n");

    // ========================================
    // STEP 2: Drop existing database (fresh start)
    // ========================================
    console.log(`🗑️  Dropping existing database '${DB_NAME}' if it exists...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    console.log("✅ Old database dropped\n");

    // ========================================
    // STEP 3: Create fresh database
    // ========================================
    console.log(`📦 Creating database '${DB_NAME}'...`);
    await connection.query(
      `CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log("✅ Database created\n");

    // ========================================
    // STEP 4: Switch to the new database
    // ========================================
    await connection.query(`USE \`${DB_NAME}\``);

    // ========================================
    // STEP 5: Create all 12 tables (in order)
    // ========================================
    console.log("📋 Creating tables...\n");

    for (const table of tableSchemas) {
      try {
        await connection.query(table.sql);
        console.log(`   ✅ ${table.name}`);
      } catch (err) {
        console.error(`   ❌ ${table.name} — ${err.message}`);
        throw err;
      }
    }

    // ========================================
    // STEP 6: Seed Foundation Bootstrap Data
    // ========================================
    console.log("\n🌱 Seeding foundation bootstrap data...");

    // 1. Default Organization
    await connection.query(`
      INSERT INTO organizations (id, name, code, address, email)
      VALUES (1, 'EduSmart Academy', 'EDUSMART_HQ', 'Main Campus', 'admin@edusmart.edu')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // 2. Default Administrator (Admin Role)
    const defaultAdminPassword = await bcrypt.hash("admin123", 10);
    await connection.query(`
      INSERT INTO admins (id, organization_id, name, email, username, password, role)
      VALUES (1, 1, 'System Administrator', 'admin@edusmart.edu', 'admin', ?, 'super_admin')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `, [defaultAdminPassword]);

    // 3. Default Department
    await connection.query(`
      INSERT INTO departments (id, organization_id, name, code, description)
      VALUES (1, 1, 'Computer Science & Engineering', 'CSE', 'Department of Computer Science')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // 4. Default Subject
    await connection.query(`
      INSERT INTO subjects (id, department_id, name, code, credits)
      VALUES (1, 1, 'Core Curriculum', 'CORE101', 4)
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // 5. Default Faculty (for orphan FK references)
    const defaultTeacherPassword = await bcrypt.hash("faculty123", 10);
    await connection.query(`
      INSERT INTO teachers (id, organization_id, department_id, name, email, username, password, designation)
      VALUES (1, 1, 1, 'Main Faculty', 'faculty@edusmart.edu', 'faculty', ?, 'professor')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `, [defaultTeacherPassword]);

    // 6. Default Class (CSE - 1st Year Section A)
    await connection.query(`
      INSERT INTO classes (id, organization_id, department_id, class_teacher_id, name, code, academic_year, semester, section)
      VALUES (1, 1, 1, 1, 'CSE - 1st Year Section A', 'CSE-1A', '2025-2026', 1, 'A')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `);

    // 7. Default Class-Subject Allocation
    await connection.query(`
      INSERT INTO class_subjects (id, class_id, subject_id, teacher_id, academic_year, semester)
      VALUES (1, 1, 1, 1, '2025-2026', 1)
      ON DUPLICATE KEY UPDATE teacher_id=VALUES(teacher_id)
    `);

    // 8. Default Student (Sample Student in Class 1)
    const defaultStudentPassword = await bcrypt.hash("student123", 10);
    await connection.query(`
      INSERT INTO students (id, organization_id, department_id, class_id, name, email, password, year, roll_number)
      VALUES (1, 1, 1, 1, 'Sample Student', 'student@edusmart.edu', ?, 1, 'CS2026-001')
      ON DUPLICATE KEY UPDATE name=VALUES(name)
    `, [defaultStudentPassword]);

    // 9. Class Roster & Student-Subject Enrollment
    await connection.query(`
      INSERT INTO class_students (class_id, student_id, academic_year, roll_number_in_class)
      VALUES (1, 1, '2025-2026', 'CS2026-001')
      ON DUPLICATE KEY UPDATE status='active'
    `);

    await connection.query(`
      INSERT INTO enrollments (student_id, subject_id, teacher_id, academic_year, semester)
      VALUES (1, 1, 1, '2025-2026', 1)
      ON DUPLICATE KEY UPDATE teacher_id=VALUES(teacher_id)
    `);

    console.log("✅ Foundation records seeded (Org 1, Admin 1, Dept 1, Subject 1, Faculty 1, Class 1, Student 1)\n");

    // ========================================
    // STEP 7: Verify all tables
    // ========================================
    console.log("🔍 Verifying tables...\n");

    const [tables] = await connection.query("SHOW TABLES");
    const tableKey = `Tables_in_${DB_NAME.toLowerCase()}`;

    console.log("   Created tables:");
    tables.forEach((row) => {
      console.log(`   📄 ${row[tableKey] || Object.values(row)[0]}`);
    });

    console.log(`\n✅ Total: ${tables.length} tables verified`);

    // ========================================
    // STEP 8: Show table relationships (FK info)
    // ========================================
    console.log("\n🔗 Foreign Key Relationships:\n");

    const [fks] = await connection.query(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME
    `, [DB_NAME]);

    fks.forEach((fk) => {
      console.log(
        `   ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`
      );
    });

    console.log(`\n   Total: ${fks.length} foreign keys active\n`);

    // ========================================
    // DONE
    // ========================================
    console.log("═══════════════════════════════════════════");
    console.log("  🎓 EduSmart MySQL database initialized!");
    console.log("  📊 16 tables | Admins & Classes integrated");
    console.log("  🚀 Ready to run with backend and frontend");
    console.log("═══════════════════════════════════════════\n");

  } catch (err) {
    console.error("\n❌ Database initialization failed:", err.message);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Is MySQL server running in XAMPP / MySQL Service?");
    console.error("   2. Check .env credentials (DB_HOST, DB_USER, DB_PASSWORD, DB_PORT)");
    console.error("   3. Does the MySQL user have CREATE DATABASE privileges?\n");
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Connection closed\n");
    }
  }
}

// Run it
initDatabase();
