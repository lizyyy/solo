#!/usr/bin/env python3
"""初始化数据库，创建默认规则和测试数据"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime

from app.database import SessionLocal, Base, engine
from app.models import (
    Student, AcademicRecord, Discipline, Thesis,
    GraduationRule, RuleCategory, DisciplineLevel, ThesisStatus
)


def create_default_rules(db):
    """创建默认毕业规则"""
    rules = [
        {
            "name": "总学分要求",
            "category": RuleCategory.CREDITS.value,
            "is_active": True,
            "priority": 100,
            "conditions_json": {"total_credits_min": 140.0},
            "description": "学生需修满至少140学分",
            "created_by": "system"
        },
        {
            "name": "必修学分要求",
            "category": RuleCategory.CREDITS.value,
            "is_active": True,
            "priority": 90,
            "conditions_json": {"required_credits_min": 100.0},
            "description": "必修课程需修满至少100学分",
            "created_by": "system"
        },
        {
            "name": "选修学分要求",
            "category": RuleCategory.CREDITS.value,
            "is_active": True,
            "priority": 80,
            "conditions_json": {"elective_credits_min": 20.0},
            "description": "选修课程需修满至少20学分",
            "created_by": "system"
        },
        {
            "name": "GPA要求",
            "category": RuleCategory.CREDITS.value,
            "is_active": True,
            "priority": 70,
            "conditions_json": {"gpa_min": 2.0},
            "description": "平均学分绩点需达到2.0以上",
            "created_by": "system"
        },
        {
            "name": "不及格课程限制",
            "category": RuleCategory.CREDITS.value,
            "is_active": True,
            "priority": 60,
            "conditions_json": {"failed_courses_max": 3},
            "description": "不及格课程不得超过3门",
            "created_by": "system"
        },
        {
            "name": "严重处分限制",
            "category": RuleCategory.DISCIPLINE.value,
            "is_active": True,
            "priority": 100,
            "conditions_json": {
                "disallow_levels": [
                    DisciplineLevel.DEMERIT.value,
                    DisciplineLevel.PROBATION.value,
                    DisciplineLevel.EXPULSION.value
                ]
            },
            "description": "不得有未撤销的记过及以上处分",
            "created_by": "system"
        },
        {
            "name": "论文通过要求",
            "category": RuleCategory.THESIS.value,
            "is_active": True,
            "priority": 100,
            "conditions_json": {"require_score": True, "min_score": 60.0},
            "description": "毕业论文需通过答辩且分数不低于60分",
            "created_by": "system"
        }
    ]
    
    existing_count = db.query(GraduationRule).count()
    if existing_count > 0:
        print(f"数据库中已存在 {existing_count} 条规则，跳过创建")
        return
    
    for rule_data in rules:
        rule = GraduationRule(**rule_data)
        db.add(rule)
    
    db.commit()
    print(f"已创建 {len(rules)} 条默认规则")


def create_test_students(db):
    """创建测试学生数据"""
    test_students = [
        {
            "student_id": "2020001",
            "name": "张三",
            "department": "计算机学院",
            "major": "软件工程",
            "grade": 2020,
            "academic": {
                "total_credits": 145.5,
                "required_credits_earned": 105.0,
                "elective_credits_earned": 25.5,
                "gpa": 3.2,
                "failed_courses_count": 1
            },
            "disciplines": [],
            "thesis": {"title": "基于深度学习的图像识别系统", "status": ThesisStatus.PASSED.value, "score": 85.0}
        },
        {
            "student_id": "2020002",
            "name": "李四",
            "department": "计算机学院",
            "major": "计算机科学与技术",
            "grade": 2020,
            "academic": {
                "total_credits": 130.0,
                "required_credits_earned": 95.0,
                "elective_credits_earned": 20.0,
                "gpa": 2.5,
                "failed_courses_count": 2
            },
            "disciplines": [],
            "thesis": {"title": "分布式系统一致性算法研究", "status": ThesisStatus.PASSED.value, "score": 78.0}
        },
        {
            "student_id": "2020003",
            "name": "王五",
            "department": "电子工程学院",
            "major": "电子信息工程",
            "grade": 2020,
            "academic": {
                "total_credits": 142.0,
                "required_credits_earned": 102.0,
                "elective_credits_earned": 22.0,
                "gpa": 2.8,
                "failed_courses_count": 0
            },
            "disciplines": [
                {
                    "level": DisciplineLevel.DEMERIT.value,
                    "description": "考试作弊，给予记过处分",
                    "is_cleared": False
                }
            ],
            "thesis": {"title": "5G通信协议优化研究", "status": ThesisStatus.PASSED.value, "score": 82.0}
        },
        {
            "student_id": "2020004",
            "name": "赵六",
            "department": "数学与统计学院",
            "major": "应用数学",
            "grade": 2020,
            "academic": {
                "total_credits": 138.0,
                "required_credits_earned": 98.0,
                "elective_credits_earned": 25.0,
                "gpa": 2.2,
                "failed_courses_count": 1
            },
            "disciplines": [],
            "thesis": {"title": "机器学习在金融预测中的应用", "status": ThesisStatus.NEEDS_REVISION.value}
        },
        {
            "student_id": "2020005",
            "name": "孙七",
            "department": "经济管理学院",
            "major": "工商管理",
            "grade": 2020,
            "academic": {
                "total_credits": 140.0,
                "required_credits_earned": 100.0,
                "elective_credits_earned": 20.0,
                "gpa": 3.0,
                "failed_courses_count": 0
            },
            "disciplines": [
                {
                    "level": DisciplineLevel.WARNING.value,
                    "description": "上课违纪，给予警告处分",
                    "is_cleared": True
                }
            ],
            "thesis": {"title": "企业数字化转型策略研究", "status": ThesisStatus.PASSED.value, "score": 75.0}
        },
        {
            "student_id": "2020006",
            "name": "周八",
            "department": "外语学院",
            "major": "英语",
            "grade": 2020,
            "academic": {
                "total_credits": 125.0,
                "required_credits_earned": 90.0,
                "elective_credits_earned": 15.0,
                "gpa": 1.8,
                "failed_courses_count": 5
            },
            "disciplines": [],
            "thesis": {}
        }
    ]
    
    existing_count = db.query(Student).count()
    if existing_count > 0:
        print(f"数据库中已存在 {existing_count} 个学生，跳过创建")
        return
    
    for student_data in test_students:
        academic = student_data.pop("academic")
        disciplines = student_data.pop("disciplines", [])
        thesis = student_data.pop("thesis", {})
        
        student = Student(**student_data)
        db.add(student)
        db.flush()
        
        academic_record = AcademicRecord(
            student_id=student.id,
            **academic
        )
        db.add(academic_record)
        
        for disc_data in disciplines:
            discipline = Discipline(
                student_id=student.id,
                **disc_data
            )
            db.add(discipline)
        
        if thesis:
            thesis_record = Thesis(
                student_id=student.id,
                **thesis
            )
            if thesis.get("status") in [ThesisStatus.SUBMITTED.value, ThesisStatus.UNDER_REVIEW.value, 
                                         ThesisStatus.PASSED.value, ThesisStatus.FAILED.value, 
                                         ThesisStatus.NEEDS_REVISION.value]:
                thesis_record.submitted_at = datetime.utcnow()
            if thesis.get("status") in [ThesisStatus.PASSED.value, ThesisStatus.FAILED.value]:
                thesis_record.reviewed_at = datetime.utcnow()
            db.add(thesis_record)
    
    db.commit()
    print(f"已创建 {len(test_students)} 个测试学生")


def main():
    print("初始化数据库...")
    
    Base.metadata.create_all(bind=engine)
    print("数据库表创建完成")
    
    db = SessionLocal()
    try:
        create_default_rules(db)
        create_test_students(db)
        print("\n数据库初始化完成！")
    finally:
        db.close()


if __name__ == "__main__":
    main()
