#!/usr/bin/env python3
"""
有效期计算修复验证测试
专门验证：签发3天、有效期90天的材料不应被判为过期
"""

from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
import schemas
from services import MaterialReviewService, init_material_types
import os

if os.path.exists("test_validity.db"):
    os.remove("test_validity.db")

engine = create_engine("sqlite:///test_validity.db")
models.Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

init_material_types(db)

print("=" * 60)
print("有效期计算修复验证测试")
print("=" * 60)

student = models.Student(
    student_id="TEST_VALIDITY",
    name="测试学生",
    grade="2024级",
    major="测试专业"
)
db.add(student)
db.flush()

family = models.FamilyMember(
    student_id=student.id,
    name="测试家长",
    relation="父亲",
    is_source_of_income=True
)
db.add(family)
db.commit()

material_type_90 = db.query(models.MaterialType).filter(models.MaterialType.code == "MEDICAL").first()
print(f"\n测试材料类型: {material_type_90.name}")
print(f"配置有效天数: {material_type_90.validity_days} 天")

test_cases = [
    {
        "name": "签发3天，有效期90天（应该有效）",
        "issue_date": date.today() - timedelta(days=3),
        "expiry_date": None,
        "has_stamp": True,
        "expect_expired": False
    },
    {
        "name": "签发95天，有效期90天（应该过期）",
        "issue_date": date.today() - timedelta(days=95),
        "expiry_date": None,
        "has_stamp": True,
        "expect_expired": True
    },
    {
        "name": "显式过期日期已过3天（应该过期）",
        "issue_date": date.today() - timedelta(days=100),
        "expiry_date": date.today() - timedelta(days=3),
        "has_stamp": True,
        "expect_expired": True
    },
    {
        "name": "显式过期日期还有3天（应该有效）",
        "issue_date": date.today() - timedelta(days=100),
        "expiry_date": date.today() + timedelta(days=3),
        "has_stamp": True,
        "expect_expired": False
    },
    {
        "name": "有公章（应该无缺章问题）",
        "issue_date": date.today(),
        "expiry_date": None,
        "has_stamp": True,
        "expect_no_stamp": False
    },
    {
        "name": "无公章（应该有缺章问题）",
        "issue_date": date.today(),
        "expiry_date": None,
        "has_stamp": False,
        "expect_no_stamp": True
    },
]

print("\n测试用例执行:")
print("-" * 60)

for i, case in enumerate(test_cases, 1):
    db.query(models.StudentMaterial).filter(models.StudentMaterial.student_id == student.id).delete()
    
    material = models.StudentMaterial(
        student_id=student.id,
        material_type_id=material_type_90.id,
        issue_date=case["issue_date"],
        expiry_date=case["expiry_date"],
        has_stamp=case["has_stamp"]
    )
    db.add(material)
    db.commit()
    
    service = MaterialReviewService(db)
    result = service.review_student_materials(student.id)
    
    is_expired = len(result.expired_materials) > 0
    has_no_stamp = len(result.no_stamp_materials) > 0
    
    status_ok = True
    if "expect_expired" in case:
        if is_expired != case["expect_expired"]:
            status_ok = False
    if "expect_no_stamp" in case:
        if has_no_stamp != case["expect_no_stamp"]:
            status_ok = False
    
    status_icon = "✓" if status_ok else "✗"
    print(f"{status_icon} 测试 {i}: {case['name']}")
    print(f"   实际结果: 过期={is_expired}, 缺章={has_no_stamp}, 总问题数={result.issue_summary['total_issues']}")
    if result.expired_materials:
        print(f"   过期材料: {result.expired_materials}")
    if result.no_stamp_materials:
        print(f"   缺章材料: {result.no_stamp_materials}")

print("-" * 60)

print("\n问题统计完整性验证:")
db.query(models.StudentMaterial).filter(models.StudentMaterial.student_id == student.id).delete()

mat_180 = db.query(models.MaterialType).filter(models.MaterialType.code == "FAMILY_INCOME").first()

material1 = models.StudentMaterial(
    student_id=student.id,
    material_type_id=material_type_90.id,
    issue_date=date.today() - timedelta(days=100),
    expiry_date=None,
    has_stamp=False
)
material2 = models.StudentMaterial(
    student_id=student.id,
    material_type_id=mat_180.id,
    issue_date=date.today() - timedelta(days=200),
    expiry_date=None,
    has_stamp=True
)
db.add(material1)
db.add(material2)
db.commit()

result = service.review_student_materials(student.id)
print(f"  提交2份有问题的材料:")
print(f"    - 医疗证明: 签发100天(>90天) + 缺章")
print(f"    - 家庭收入证明: 签发200天(>180天) + 有章")
print(f"  缺少材料数: {result.issue_summary['missing_count']}")
print(f"  过期材料数: {result.issue_summary['expired_count']}")
print(f"  缺章材料数: {result.issue_summary['no_stamp_count']}")
print(f"  家庭问题数: {result.issue_summary['family_issue_count']}")
print(f"  总问题数: {result.issue_summary['total_issues']}")

expected_total = (result.issue_summary['missing_count'] + 
                  result.issue_summary['expired_count'] + 
                  result.issue_summary['no_stamp_count'] + 
                  result.issue_summary['family_issue_count'])

if result.issue_summary['total_issues'] >= expected_total:
    print("  ✓ 问题统计正确，所有类型问题均被计入总问题数")
else:
    print("  ✗ 问题统计不完整")

db.close()
os.remove("test_validity.db")
print("\n" + "=" * 60)
print("所有测试完成！")
print("=" * 60)
