// ============================================
// EduSmart - MySQL2 Connection Pool
// ============================================

const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "edusmart_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// ✅ Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Connected to MySQL database:", process.env.DB_NAME || "edusmart_db");
    connection.release();
  } catch (err) {
    console.error("⚠️ MySQL pool connection check:", err.message);
    console.error("💡 Tip: Make sure MySQL is running and you have initialized the DB using: npm run db:init");
  }
}

testConnection();

module.exports = pool;