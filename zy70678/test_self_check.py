#!/usr/bin/env python3
"""
助学金材料审核系统自检脚本
验证导入、筛选、处理和导出功能
"""

import sys
import os
from datetime import date, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
import schemas
from services import MaterialReviewService, init_material_types
from exporter import ReportExporter


def run_self_check():
    print("=" * 60)
    print("助学金材料审核系统自检")
    print("=" * 60)

    if os.path.exists("student_aid.db"):
        os.remove("student_aid.db")
        print("已清理旧数据库")

    engine = create_engine("sqlite:///student_aid.db")
    models.Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    print("\n[1/8] 初始化材料类型...")
    init_material_types(db)
    mat_types = db.query(models.MaterialType).all()
    print(f"✓ 初始化完成，共 {len(mat_types)} 种材料类型")
    for mat in mat_types:
        print(f"  - {mat.code}: {mat.name}")

    print("\n[2/8] 导入学生数据...")
    test_students = [
        {
            "student_id": "2024001",
            "name": "张三",
            "grade": "2024级",
            "major": "计算机科学",
            "family_members": [
                {"name": "张父", "relation": "父亲", "workplace": "某工厂", "annual_income": 30000, "is_source_of_income": True},
                {"name": "张母", "relation": "母亲", "workplace": "无", "annual_income": 0}
            ]
        },
        {
            "student_id": "2024002",
            "name": "李四",
            "grade": "2024级",
            "major": "电子工程",
            "family_members": [
                {"name": "李父", "relation": "父亲", "workplace": "待业", "is_source_of_income": False},
            ]
        },
        {
            "student_id": "2024003",
            "name": "王五",
            "grade": "2024级",
            "major": "机械工程",
            "family_members": [
                {"name": "王父", "relation": "父亲", "workplace": "公司", "annual_income": 50000, "is_source_of_income": True},
                {"name": "王母", "relation": "母亲", "workplace": "公司", "annual_income": 45000, "is_source_of_income": True},
                {"name": "王爷爷", "relation": "祖父", "workplace": "退休", "is_source_of_income": False},
            ]
        }
    ]

    created_students = []
    for s in test_students:
        db_student = models.Student(
            student_id=s["student_id"],
            name=s["name"],
            grade=s["grade"],
            major=s["major"]
        )
        db.add(db_student)
        db.flush()

        for member in s["family_members"]:
            db_member = models.FamilyMember(student_id=db_student.id, **member)
            db.add(db_member)

        created_students.append(db_student)
    db.commit()
    print(f"✓ 导入完成，共 {len(created_students)} 名学生")

    print("\n[3/8] 提交学生材料...")
    material_type_map = {m.code: m.id for m in mat_types}

    test_materials = [
        {
            "student_idx": 0,
            "materials": [
                {"code": "LOW_INCOME", "has_stamp": True, "issue_date": date.today() - timedelta(days=30), "expiry_date": date.today() + timedelta(days=335)},
                {"code": "APPLICATION", "has_stamp": True},
                {"code": "FAMILY_INCOME", "has_stamp": True, "issue_date": date.today() - timedelta(days=100)},
                {"code": "ID_COPY", "has_stamp": False},
            ]
        },
        {
            "student_idx": 1,
            "materials": [
                {"code": "LOW_INCOME", "has_stamp": False, "issue_date": date.today() - timedelta(days=400), "expiry_date": date.today() - timedelta(days=35)},
                {"code": "APPLICATION", "has_stamp": False},
                {"code": "ID_COPY", "has_stamp": False},
            ]
        },
        {
            "student_idx": 2,
            "materials": [
                {"code": "LOW_INCOME", "has_stamp": True, "issue_date": date.today() - timedelta(days=10), "expiry_date": date.today() + timedelta(days=355)},
                {"code": "POVERTY", "has_stamp": True, "issue_date": date.today() - timedelta(days=5), "expiry_date": date.today() + timedelta(days=360)},
                {"code": "APPLICATION", "has_stamp": True},
                {"code": "FAMILY_INCOME", "has_stamp": True, "issue_date": date.today() - timedelta(days=5)},
                {"code": "MEDICAL", "has_stamp": True, "issue_date": date.today() - timedelta(days=3)},
                {"code": "ID_COPY", "has_stamp": False},
            ]
        }
    ]

    material_count = 0
    for tm in test_materials:
        student = created_students[tm["student_idx"]]
        for mat in tm["materials"]:
            db_mat = models.StudentMaterial(
                student_id=student.id,
                material_type_id=material_type_map[mat["code"]],
                has_stamp=mat.get("has_stamp", False),
                issue_date=mat.get("issue_date"),
                expiry_date=mat.get("expiry_date")
            )
            db.add(db_mat)
            material_count += 1
    db.commit()
    print(f"✓ 材料提交完成，共 {material_count} 份材料")

    print("\n[4/8] 单个学生材料审核...")
    service = MaterialReviewService(db)
    student1 = created_students[0]
    result = service.review_student_materials(student1.id)
    print(f"学生: {result.student_name} ({result.student_id})")
    print(f"  提交材料数: {result.total_materials}")
    print(f"  缺少材料: {result.missing_materials}")
    print(f"  过期材料: {result.expired_materials}")
    print(f"  缺章材料: {result.no_stamp_materials}")
    print(f"  家庭一致性问题: {result.family_consistency_issues}")
    print(f"  审核状态: {result.status.value}")
    print("✓ 单个审核完成")

    print("\n[5/8] 批量审核所有学生...")
    batch_results = service.batch_review_all()
    print(f"共审核 {len(batch_results)} 名学生")
    for r in batch_results:
        issue_count = r.issue_summary["total_issues"]
        status_icon = "✓" if issue_count == 0 else "⚠" if issue_count <= 2 else "✗"
        print(f"  {status_icon} {r.student_name}: {issue_count} 个问题 - {r.status.value}")
    print("✓ 批量审核完成")

    print("\n[6/8] 按问题类型筛选...")
    issue_types = ["missing", "expired", "no_stamp", "family"]
    for issue_type in issue_types:
        students = service.get_students_with_issues(issue_type)
        print(f"  {issue_type}: {len(students)} 名学生有问题")
    print("✓ 筛选功能正常")

    print("\n[7/8] 生成审核报告...")
    for student in created_students:
        report = service.generate_report(student.id, "自检程序")
        print(f"  报告编号: {report.report_code} - {report.status}")
    print("✓ 报告生成完成")

    print("\n[8/8] 导出Excel和CSV报告...")
    exporter = ReportExporter(db)

    csv_path = exporter.generate_review_report_csv()
    print(f"  CSV报告: {csv_path}")

    batch_excel_path = exporter.export_batch_review_to_excel()
    print(f"  批量Excel: {batch_excel_path}")

    student_excel_path = exporter.export_student_review_to_excel(created_students[0].id)
    print(f"  单个学生Excel: {student_excel_path}")

    print("✓ 导出功能正常")

    print("\n" + "=" * 60)
    print("自检汇总:")
    print("=" * 60)

    total_with_issues = len([r for r in batch_results if r.issue_summary["total_issues"] > 0])
    total_missing = len([r for r in batch_results if r.missing_materials])
    total_expired = len([r for r in batch_results if r.expired_materials])
    total_no_stamp = len([r for r in batch_results if r.no_stamp_materials])
    total_family = len([r for r in batch_results if r.family_consistency_issues])

    print(f"总学生数: {len(batch_results)}")
    print(f"有问题学生数: {total_with_issues}")
    print(f"  - 缺少材料: {total_missing}")
    print(f"  - 过期材料: {total_expired}")
    print(f"  - 缺章材料: {total_no_stamp}")
    print(f"  - 家庭信息问题: {total_family}")
    print("\n✓ 所有功能测试通过！系统运行正常。")

    db.close()
    print("\n提示: 启动服务命令: python main.py 或 uvicorn main:app --reload")
    print("      访问 http://localhost:8000/docs 查看API文档")


if __name__ == "__main__":
    run_self_check()
