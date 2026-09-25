// ============================================
// EduSmart - Machine Learning Service Bridge
// ============================================
// Interacts with ml-engine/ml_engine.py (Random Forest)
// with automatic high-fidelity in-memory fallback.
// ============================================

const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const SCRIPT_PATH = path.join(__dirname, "../ml-engine/ml_engine.py");

// Detect virtual environment python
function getPythonExecutable() {
  const venvWin = path.resolve(__dirname, "../../../.venv/Scripts/python.exe");
  const venvUnix = path.resolve(__dirname, "../../../.venv/bin/python");
  const localVenvWin = path.resolve(__dirname, "../ml-engine/venv/Scripts/python.exe");

  if (fs.existsSync(venvWin)) return venvWin;
  if (fs.existsSync(venvUnix)) return venvUnix;
  if (fs.existsSync(localVenvWin)) return localVenvWin;

  return process.platform === "win32" ? "python" : "python3";
}

/**
 * Runs the Python ML Engine with the given task and payload
 */
function runPythonEngine(taskPayload) {
  return new Promise((resolve, reject) => {
    const pythonCmd = getPythonExecutable();
    const child = spawn(pythonCmd, [SCRIPT_PATH]);

    let stdoutData = "";
    let stderrData = "";

    child.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    child.on("error", (err) => {
      // Python binary not found or spawn failed -> resolve with fallback
      return resolve(getFallbackPrediction(taskPayload));
    });

    child.on("close", (code) => {
      if (code !== 0 || !stdoutData.trim()) {
        console.warn(`Python ML Engine exited with code ${code}. Using internal fallback. ${stderrData}`);
        return resolve(getFallbackPrediction(taskPayload));
      }

      try {
        const parsed = JSON.parse(stdoutData.trim());
        resolve(parsed);
      } catch (err) {
        console.warn("Failed to parse ML output JSON, using fallback:", stdoutData);
        resolve(getFallbackPrediction(taskPayload));
      }
    });

    // Write input payload as JSON to stdin and close stdin
    child.stdin.write(JSON.stringify(taskPayload));
    child.stdin.end();
  });
}

/**
 * In-memory fallback prediction imitating the Random Forest ensemble
 */
function getFallbackPrediction(payload) {
  const task = payload.task;

  if (task === "attendance_risk") {
    const att = parseFloat(payload.attendance_percentage || 0);
    const streak = parseInt(payload.absent_streak || 0);
    let risk_level = "Safe";
    let risk_score = 15;

    if (att < 65 || streak >= 5) {
      risk_level = "High Risk";
      risk_score = Math.min(98, Math.round(100 - att + streak * 4));
    } else if (att < 75 || streak >= 3) {
      risk_level = "Warning";
      risk_score = Math.round(65 - (att - 65));
    }

    return {
      risk_level,
      risk_score,
      current_attendance: att,
      projected_attendance: Math.max(0, Math.min(100, Math.round(att - streak * 1.5))),
      classes_missed: payload.classes_missed || 0,
      recommendation:
        risk_level === "High Risk"
          ? "Immediate counselor intervention required. Attendance is critically below 75%."
          : risk_level === "Warning"
          ? "Student is on the borderline. Schedule an advisory check-in."
          : "Student maintains good attendance regularity.",
      engine: "FallbackModelEnsemble",
    };
  }

  if (task === "performance") {
    const att = parseFloat(payload.attendance || 0);
    const assign = parseFloat(payload.assignment_score || 0);
    const subm = parseFloat(payload.submission_rate || 80);
    const taskRate = parseFloat(payload.task_rate || 70);

    const score = Math.max(
      0,
      Math.min(100, Math.round(0.25 * att + 0.40 * assign + 0.20 * subm + 0.15 * taskRate))
    );

    let grade = "F";
    if (score >= 90) grade = "A+";
    else if (score >= 80) grade = "A";
    else if (score >= 70) grade = "B";
    else if (score >= 60) grade = "C";
    else if (score >= 50) grade = "D";

    return {
      predicted_score: score,
      predicted_grade: grade,
      metrics_breakdown: {
        attendance_impact: Math.round(att * 0.25),
        assignment_impact: Math.round(assign * 0.40),
        submission_punctuality: Math.round(subm * 0.20),
        task_completion: Math.round(taskRate * 0.15),
      },
      engine: "FallbackModelEnsemble",
    };
  }

  if (task === "class_subject_insights") {
    const students = payload.students || [];
    const TIERS = ["Bad", "Average", "Good", "Better", "Excellent"];
    const counts = { Bad: 0, Average: 0, Good: 0, Better: 0, Excellent: 0 };
    let totalScore = 0;

    const evaluated = students.map((s) => {
      const score = parseFloat(s.assignment_score || 0);
      const att = parseFloat(s.attendance || 80);
      const composite = Math.round(0.60 * score + 0.40 * att);

      let insight = "Good";
      if (composite < 50) insight = "Bad";
      else if (composite < 65) insight = "Average";
      else if (composite < 78) insight = "Good";
      else if (composite < 88) insight = "Better";
      else insight = "Excellent";

      counts[insight]++;
      totalScore += composite;

      return {
        student_id: s.student_id,
        student_name: s.student_name,
        assignment_score: score,
        attendance: att,
        insight,
        composite_score: composite,
      };
    });

    const totalN = evaluated.length || 1;
    const avgScore = Math.round(totalScore / totalN);

    let overall = "Good";
    if (avgScore < 50) overall = "Bad";
    else if (avgScore < 65) overall = "Average";
    else if (avgScore < 78) overall = "Good";
    else if (avgScore < 88) overall = "Better";
    else overall = "Excellent";

    return {
      class_name: payload.class_name || "Class",
      subject_name: payload.subject_name || "Subject",
      total_students: evaluated.length,
      overall_insight: overall,
      average_score: avgScore,
      distribution: counts,
      students: evaluated,
      recommendation: `Analysis completed for ${payload.subject_name || "subject"}. Overall understanding is ${overall}.`,
      engine: "FallbackModelEnsemble",
    };
  }

  return { error: "Unknown task", engine: "FallbackModelEnsemble" };
}

module.exports = {
  predictAttendanceRisk: (data) => runPythonEngine({ task: "attendance_risk", ...data }),
  predictPerformance: (data) => runPythonEngine({ task: "performance", ...data }),
  getClassSubjectInsights: (data) => runPythonEngine({ task: "class_subject_insights", ...data }),
};
