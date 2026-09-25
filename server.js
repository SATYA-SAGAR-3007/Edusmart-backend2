// ============================================
// EduSmart - Server Entry Point
// ============================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");

// ✅ Initialize database connection pool
require("./database/db");

// ✅ Import routes
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const taskRoutes = require("./routes/taskRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/adminRoutes");
const mlRoutes = require("./routes/mlRoutes");
const performanceRoutes = require("./routes/performanceRoutes");

const app = express();

// ✅ Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ Routes
app.use("/auth", authRoutes);
app.use("/students", studentRoutes);
app.use("/attendance", attendanceRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/tasks", taskRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/admin", adminRoutes);
app.use("/ml", mlRoutes);
app.use("/performance", performanceRoutes);

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 EduSmart server running on port ${PORT}`);
});
