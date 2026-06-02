from datetime import datetime
from models import Sample, ModelVersion


def create_samples() -> list:
    return [
        Sample(
            sample_id="SMP-001",
            user_id="USER-1001",
            user_profile={
                "level": "intermediate",
                "learning_goal": "data_scientist",
                "available_hours_per_week": 10,
                "background": "统计学本科",
            },
            learning_history=[
                {
                    "course_id": "C001",
                    "course_name": "Python 编程基础",
                    "status": "completed",
                    "score": 92,
                    "completed_at": "2026-02-15",
                    "skills": ["python_basics"],
                },
                {
                    "course_id": "C002",
                    "course_name": "线性代数",
                    "status": "completed",
                    "score": 88,
                    "completed_at": "2026-03-20",
                    "skills": ["linear_algebra"],
                },
                {
                    "course_id": "C003",
                    "course_name": "概率论与数理统计",
                    "status": "completed",
                    "score": 95,
                    "completed_at": "2026-04-10",
                    "skills": ["statistics"],
                },
                {
                    "course_id": "C004",
                    "course_name": "机器学习入门",
                    "status": "in_progress",
                    "progress": 65,
                    "skills": ["machine_learning"],
                },
            ],
            target_path="data_scientist",
            online_feedback={
                "click_rate": 0.35,
                "completion_rate": 0.82,
                "user_rating": 4.5,
                "feedback_time": "2026-05-28",
            },
            created_at="2026-05-20T10:30:00",
        ),
        Sample(
            sample_id="SMP-002",
            user_id="USER-1002",
            user_profile={
                "level": "beginner",
                "learning_goal": "ai_engineer",
                "available_hours_per_week": 3,
                "background": "市场营销转行",
            },
            learning_history=[
                {
                    "course_id": "C001",
                    "course_name": "Python 编程基础",
                    "status": "completed",
                    "score": 62,
                    "completed_at": "2026-03-01",
                    "skills": ["python_basics"],
                },
                {
                    "course_id": "C005",
                    "course_name": "数据结构",
                    "status": "in_progress",
                    "progress": 30,
                    "skills": [],
                },
            ],
            target_path="ai_engineer",
            online_feedback=None,
            created_at="2026-05-20T11:00:00",
        ),
        Sample(
            sample_id="SMP-003",
            user_id="USER-1003",
            user_profile={
                "level": "advanced",
                "learning_goal": "backend_engineer",
                "available_hours_per_week": 8,
                "background": "前端工程师转后端",
            },
            learning_history=[
                {
                    "course_id": "C006",
                    "course_name": "JavaScript 高级",
                    "status": "completed",
                    "score": 90,
                    "completed_at": "2025-11-20",
                    "skills": ["javascript_basics"],
                },
                {
                    "course_id": "C007",
                    "course_name": "SQL 数据库",
                    "status": "completed",
                    "score": 85,
                    "completed_at": "2025-12-15",
                    "skills": ["databases"],
                },
            ],
            target_path="backend_engineer",
            online_feedback={
                "click_rate": 0.15,
                "completion_rate": 0.45,
                "user_rating": 3.0,
                "feedback_time": "2026-05-15",
            },
            created_at="2026-05-20T11:30:00",
        ),
    ]


def create_model_versions() -> list:
    return [
        ModelVersion(
            version="v1.0.0",
            threshold_config={
                "auto_accept_threshold": 0.85,
                "human_review_threshold": 0.6,
                "min_prereq_ratio": 0.7,
                "good_score": 85,
                "pass_score": 60,
                "min_completed_courses": 3,
                "min_hours_per_week": 5,
            },
            deployed_at="2026-01-15T00:00:00",
            description="初始版本，基于规则的学习路径推荐解释模型",
        ),
        ModelVersion(
            version="v1.1.0",
            threshold_config={
                "auto_accept_threshold": 0.80,
                "human_review_threshold": 0.55,
                "min_prereq_ratio": 0.65,
                "good_score": 80,
                "pass_score": 60,
                "min_completed_courses": 2,
                "min_hours_per_week": 4,
            },
            deployed_at="2026-06-01T00:00:00",
            description="根据线上反馈调整阈值，降低自动通过门槛以提高覆盖率",
        ),
    ]


def create_legacy_annotation() -> tuple:
    annotation_id = "ANN-2025-Q4-0156"
    annotation_data = {
        "annotator": "AI产品经理阿宁",
        "annotated_at": "2025-12-10T15:30:00",
        "recommended_path": "backend_engineer",
        "confidence": 0.75,
        "evidence": {
            "user_background": "前端转后端，已有JS基础",
            "career_goal": "全栈工程师",
            "historical_performance": "学习积极性高，完成率80%+",
            "market_demand": "后端工程师缺口大，薪资涨幅20%",
            "risk_assessment": "需补数据结构和网络基础",
        },
        "notes": "根据2025Q4标注口径，用户前端背景转后端成功率较高，建议补充先修课程后推荐后端路径",
        "annotation_version": "2025Q4_v2",
        "original_sample_id": "SMP-003",
    }
    return annotation_id, annotation_data
