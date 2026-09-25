#!/usr/bin/env python3
"""
============================================================
EduSmart AI Engine — Random Forest Academic Analytics
============================================================
Tasks:
1. Attendance Risk Prediction (RandomForestClassifier)
2. Performance Score & Grade Prediction (RandomForestRegressor)
3. Class-Subject Understanding Insights (RandomForestClassifier)
   Categorization: ["Bad", "Average", "Good", "Better", "Excellent"]
============================================================
"""

import sys
import json
import math

# Attempt to import scikit-learn & numpy; if not installed, graceful heuristics fallback is used
try:
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


# ============================================================
# SYNTHETIC DATA GENERATION & MODEL INITIALIZATION
# ============================================================

class AttendanceRiskModel:
    """Random Forest Classifier for predicting Attendance Risk"""
    def __init__(self):
        self.model = None
        if SKLEARN_AVAILABLE:
            self._train()

    def _train(self):
        np.random.seed(42)
        n_samples = 1500
        # Features: [attendance_pct, absent_streak, total_classes, classes_missed, days_since_last_absence]
        attendance = np.random.uniform(30.0, 100.0, n_samples)
        streak = np.random.randint(0, 10, n_samples)
        total_classes = np.random.randint(20, 100, n_samples)
        missed = np.round(total_classes * (1.0 - (attendance / 100.0)))
        days_since_absent = np.random.randint(0, 30, n_samples)

        X = np.column_stack([attendance, streak, total_classes, missed, days_since_absent])

        # Target: 0 = Safe, 1 = Warning, 2 = High Risk
        y = []
        for att, strk in zip(attendance, streak):
            if att < 65.0 or strk >= 5:
                y.append(2)  # High Risk
            elif att < 75.0 or strk >= 3:
                y.append(1)  # Warning
            else:
                y.append(0)  # Safe
        y = np.array(y)

        self.model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        self.model.fit(X, y)

    def predict(self, attendance_pct, absent_streak=0, total_classes=30, classes_missed=None, days_since_last_absence=5):
        attendance_pct = float(attendance_pct or 0)
        absent_streak = int(absent_streak or 0)
        total_classes = max(1, int(total_classes or 30))
        if classes_missed is None:
            classes_missed = round(total_classes * (1.0 - (attendance_pct / 100.0)))
        days_since_last_absence = int(days_since_last_absence or 5)

        if SKLEARN_AVAILABLE and self.model:
            features = np.array([[attendance_pct, absent_streak, total_classes, classes_missed, days_since_last_absence]])
            pred_class = int(self.model.predict(features)[0])
            probs = self.model.predict_proba(features)[0]
            labels = ["Safe", "Warning", "High Risk"]
            risk_label = labels[pred_class]
            risk_score = round(float((probs[2] * 100) + (probs[1] * 50)), 1)
        else:
            # Fallback heuristic
            if attendance_pct < 65.0 or absent_streak >= 5:
                risk_label = "High Risk"
                risk_score = min(99.0, round(100.0 - attendance_pct + absent_streak * 4, 1))
            elif attendance_pct < 75.0 or absent_streak >= 3:
                risk_label = "Warning"
                risk_score = round(65.0 - (attendance_pct - 65.0), 1)
            else:
                risk_label = "Safe"
                risk_score = max(5.0, round(100.0 - attendance_pct, 1))

        # Projected final attendance assuming current trend
        projected = max(0.0, min(100.0, round(attendance_pct - (absent_streak * 1.5), 1)))

        recommendations = {
            "High Risk": "Immediate counselor intervention required. Attendance is critically below minimum eligibility threshold (75%).",
            "Warning": "Student is on the borderline. Send attendance alert and schedule an advisory meeting.",
            "Safe": "Student maintains good attendance regularity. Keep it up."
        }

        return {
            "risk_level": risk_label,
            "risk_score": risk_score,
            "current_attendance": attendance_pct,
            "projected_attendance": projected,
            "classes_missed": int(classes_missed),
            "recommendation": recommendations[risk_label],
            "engine": "RandomForestClassifier" if SKLEARN_AVAILABLE else "HeuristicEngine"
        }


class PerformanceModel:
    """Random Forest Regressor for predicting Student Final Score & Grade"""
    def __init__(self):
        self.model = None
        if SKLEARN_AVAILABLE:
            self._train()

    def _train(self):
        np.random.seed(42)
        n_samples = 2000
        # Features: [attendance_pct, avg_assignment_score, submission_rate, completed_tasks_pct, past_exam_avg]
        attendance = np.random.uniform(40.0, 100.0, n_samples)
        assignments = np.random.uniform(30.0, 100.0, n_samples)
        submissions = np.random.uniform(50.0, 100.0, n_samples)
        tasks = np.random.uniform(40.0, 100.0, n_samples)
        past_exams = np.random.uniform(35.0, 100.0, n_samples)

        X = np.column_stack([attendance, assignments, submissions, tasks, past_exams])

        # Target: Realistic composite grade with non-linear interaction
        noise = np.random.normal(0, 3, n_samples)
        y = (0.20 * attendance) + (0.35 * assignments) + (0.15 * submissions) + (0.10 * tasks) + (0.20 * past_exams) + noise
        y = np.clip(y, 0, 100)

        self.model = RandomForestRegressor(n_estimators=100, max_depth=10, random_state=42)
        self.model.fit(X, y)

    def predict(self, attendance=75.0, assignment_score=75.0, submission_rate=80.0, task_rate=70.0, past_exam=75.0):
        att = float(attendance or 0)
        assign = float(assignment_score or 0)
        subm = float(submission_rate or 80)
        task = float(task_rate or 70)
        past = float(past_exam or assign)

        if SKLEARN_AVAILABLE and self.model:
            features = np.array([[att, assign, subm, task, past]])
            score = float(self.model.predict(features)[0])
        else:
            score = (0.25 * att) + (0.40 * assign) + (0.15 * subm) + (0.10 * task) + (0.10 * past)

        score = max(0.0, min(100.0, round(score, 1)))

        if score >= 90:
            grade = "A+"
        elif score >= 80:
            grade = "A"
        elif score >= 70:
            grade = "B"
        elif score >= 60:
            grade = "C"
        elif score >= 50:
            grade = "D"
        else:
            grade = "F"

        return {
            "predicted_score": score,
            "predicted_grade": grade,
            "metrics_breakdown": {
                "attendance_impact": round(att * 0.20, 1),
                "assignment_impact": round(assign * 0.35, 1),
                "submission_punctuality": round(subm * 0.15, 1),
                "task_completion": round(task * 0.10, 1)
            },
            "engine": "RandomForestRegressor" if SKLEARN_AVAILABLE else "HeuristicEngine"
        }


class SubjectUnderstandingModel:
    """
    Random Forest Classifier for Class-Subject Insights:
    Categorizes student understanding as: ["Bad", "Average", "Good", "Better", "Excellent"]
    """
    TIERS = ["Bad", "Average", "Good", "Better", "Excellent"]

    def __init__(self):
        self.model = None
        if SKLEARN_AVAILABLE:
            self._train()

    def _train(self):
        np.random.seed(42)
        n_samples = 2500
        # Features: [subject_assignment_score, subject_attendance, submission_punctuality, quiz_score]
        scores = np.random.uniform(20.0, 100.0, n_samples)
        attendance = np.random.uniform(40.0, 100.0, n_samples)
        punctuality = np.random.uniform(50.0, 100.0, n_samples)
        quiz = np.random.uniform(20.0, 100.0, n_samples)

        X = np.column_stack([scores, attendance, punctuality, quiz])

        # Composite understanding index
        composite = (0.45 * scores) + (0.25 * quiz) + (0.15 * attendance) + (0.15 * punctuality)

        y = []
        for val in composite:
            if val < 50:
                y.append(0)  # Bad
            elif val < 65:
                y.append(1)  # Average
            elif val < 78:
                y.append(2)  # Good
            elif val < 88:
                y.append(3)  # Better
            else:
                y.append(4)  # Excellent
        y = np.array(y)

        self.model = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
        self.model.fit(X, y)

    def classify_student(self, assignment_score, subject_attendance=80.0, punctuality=80.0, quiz_score=None):
        score = float(assignment_score or 0)
        att = float(subject_attendance or 80.0)
        punc = float(punctuality or 80.0)
        quiz = float(quiz_score if quiz_score is not None else score)

        if SKLEARN_AVAILABLE and self.model:
            features = np.array([[score, att, punc, quiz]])
            tier_idx = int(self.model.predict(features)[0])
            probs = self.model.predict_proba(features)[0]
            confidence = round(float(probs[tier_idx]) * 100, 1)
        else:
            comp = (0.50 * score) + (0.25 * quiz) + (0.15 * att) + (0.10 * punc)
            if comp < 50:
                tier_idx = 0
            elif comp < 65:
                tier_idx = 1
            elif comp < 78:
                tier_idx = 2
            elif comp < 88:
                tier_idx = 3
            else:
                tier_idx = 4
            confidence = 88.0

        return {
            "tier": self.TIERS[tier_idx],
            "tier_index": tier_idx,
            "confidence": confidence,
            "composite_score": round((0.50 * score) + (0.25 * quiz) + (0.15 * att) + (0.10 * punc), 1)
        }

    def analyze_class(self, students_data, subject_name="Subject", class_name="Class"):
        """
        Takes an array of student records:
        [{ student_id, student_name, assignment_score, attendance, punctuality, quiz_score }]
        Returns rich class-wide distribution and comprehension insights.
        """
        if not students_data:
            return {
                "class_name": class_name,
                "subject_name": subject_name,
                "total_students": 0,
                "overall_insight": "Average",
                "distribution": {tier: 0 for tier in self.TIERS},
                "distribution_pct": {tier: 0 for tier in self.TIERS},
                "average_score": 0,
                "students": [],
                "weak_students": [],
                "top_performers": [],
                "recommendation": "No student records found to evaluate."
            }

        evaluated = []
        counts = {tier: 0 for tier in self.TIERS}
        total_score = 0.0

        for s in students_data:
            res = self.classify_student(
                s.get("assignment_score", 0),
                s.get("attendance", 80),
                s.get("punctuality", 80),
                s.get("quiz_score", None)
            )
            item = {
                "student_id": s.get("student_id"),
                "student_name": s.get("student_name", f"Student {s.get('student_id')}"),
                "assignment_score": s.get("assignment_score", 0),
                "attendance": s.get("attendance", 80),
                "insight": res["tier"],
                "confidence": res["confidence"],
                "composite_score": res["composite_score"]
            }
            counts[res["tier"]] += 1
            total_score += res["composite_score"]
            evaluated.append(item)

        total_n = len(evaluated)
        avg_score = round(total_score / total_n, 1)

        pcts = {tier: round((count / total_n) * 100, 1) for tier, count in counts.items()}

        # Class overall insight based on average score
        if avg_score >= 88:
            overall_insight = "Excellent"
        elif avg_score >= 78:
            overall_insight = "Better"
        elif avg_score >= 65:
            overall_insight = "Good"
        elif avg_score >= 50:
            overall_insight = "Average"
        else:
            overall_insight = "Bad"

        weak_students = [s for s in evaluated if s["insight"] in ["Bad", "Average"]]
        top_performers = [s for s in evaluated if s["insight"] in ["Better", "Excellent"]]

        # Actionable recommendations
        if overall_insight in ["Bad", "Average"]:
            recom = f"High percentage of students are struggling in {subject_name}. Recommend remedial lectures, doubt-clearing sessions, and review of teaching methodology."
        elif overall_insight == "Good":
            recom = f"Class demonstrates steady understanding of {subject_name}. Focus on practice exercises to elevate 'Average' cohort to 'Better'."
        else:
            recom = f"Outstanding class comprehension in {subject_name}! Introduce advanced problem-solving, capstone assignments, and peer mentoring."

        return {
            "class_name": class_name,
            "subject_name": subject_name,
            "total_students": total_n,
            "overall_insight": overall_insight,
            "average_score": avg_score,
            "distribution": counts,
            "distribution_percentage": pcts,
            "students": evaluated,
            "weak_students_count": len(weak_students),
            "top_performers_count": len(top_performers),
            "recommendation": recom,
            "engine": "RandomForestClassifier" if SKLEARN_AVAILABLE else "HeuristicEngine"
        }


# ============================================================
# CLI DISPATCHER
# ============================================================

def main():
    if len(sys.argv) < 2:
        # Read from standard input if no argument
        try:
            raw_input = sys.stdin.read().strip()
            if not raw_input:
                print(json.dumps({"error": "No input provided"}))
                return
            data = json.loads(raw_input)
        except Exception as e:
            print(json.dumps({"error": f"Invalid JSON stdin: {str(e)}"}))
            return
    else:
        try:
            data = json.loads(sys.argv[1])
        except Exception as e:
            print(json.dumps({"error": f"Invalid JSON arg: {str(e)}"}))
            return

    task = data.get("task")

    if task == "attendance_risk":
        model = AttendanceRiskModel()
        result = model.predict(
            attendance_pct=data.get("attendance_percentage", 75),
            absent_streak=data.get("absent_streak", 0),
            total_classes=data.get("total_classes", 30),
            classes_missed=data.get("classes_missed", None),
            days_since_last_absence=data.get("days_since_last_absence", 5)
        )
        print(json.dumps(result))

    elif task == "performance":
        model = PerformanceModel()
        result = model.predict(
            attendance=data.get("attendance", 75),
            assignment_score=data.get("assignment_score", 75),
            submission_rate=data.get("submission_rate", 80),
            task_rate=data.get("task_rate", 70),
            past_exam=data.get("past_exam", None)
        )
        print(json.dumps(result))

    elif task == "class_subject_insights":
        model = SubjectUnderstandingModel()
        students_data = data.get("students", [])
        class_name = data.get("class_name", "Class")
        subject_name = data.get("subject_name", "Subject")
        result = model.analyze_class(students_data, subject_name=subject_name, class_name=class_name)
        print(json.dumps(result))

    elif task == "student_subject_understanding":
        model = SubjectUnderstandingModel()
        result = model.classify_student(
            assignment_score=data.get("assignment_score", 0),
            subject_attendance=data.get("attendance", 80),
            punctuality=data.get("punctuality", 80),
            quiz_score=data.get("quiz_score", None)
        )
        print(json.dumps(result))

    else:
        print(json.dumps({"error": f"Unknown task: {task}. Supported: attendance_risk, performance, class_subject_insights, student_subject_understanding"}))


if __name__ == "__main__":
    main()
