#!/usr/bin/env python3
"""
测试数据生成脚本
生成员工、证书类型、课程成绩、补考记录、岗位要求、续期清单等测试数据
"""
import sys
from datetime import date, timedelta
from sqlalchemy.orm import Session

sys.path.insert(0, '.')

from app.database import engine, SessionLocal
from app import models, crud, schemas
from app.models import RenewalStatus


def create_test_data():
    db = SessionLocal()
    
    try:
        print("开始创建测试数据...")
        
        cert_types_data = [
            {"type_code": "SAFETY_001", "name": "安全生产证书", "description": "安全生产培训合格证书", "validity_period_months": 36, "required_score": 60.0},
            {"type_code": "QUALITY_001", "name": "质量管理证书", "description": "质量管理体系内审员证书", "validity_period_months": 24, "required_score": 70.0},
            {"type_code": "TECH_001", "name": "技术等级证书", "description": "专业技术等级认证", "validity_period_months": 60, "required_score": 65.0},
        ]
        
        cert_types = []
        for ct_data in cert_types_data:
            existing = crud.get_certificate_type_by_code(db, ct_data["type_code"])
            if existing:
                cert_types.append(existing)
                print(f"证书类型已存在: {ct_data['name']}")
            else:
                ct = schemas.CertificateTypeCreate(**ct_data)
                db_ct = crud.create_certificate_type(db, ct)
                cert_types.append(db_ct)
                print(f"创建证书类型: {ct_data['name']}")
        
        employees_data = [
            {"employee_id": "EMP001", "name": "张三", "department": "生产部", "position": "高级工程师", "email": "zhangsan@example.com", "phone": "13800138001"},
            {"employee_id": "EMP002", "name": "李四", "department": "质量部", "position": "质量主管", "email": "lisi@example.com", "phone": "13800138002"},
            {"employee_id": "EMP003", "name": "王五", "department": "技术部", "position": "技术员", "email": "wangwu@example.com", "phone": "13800138003"},
            {"employee_id": "EMP004", "name": "赵六", "department": "生产部", "position": "操作员", "email": "zhaoliu@example.com", "phone": "13800138004"},
            {"employee_id": "EMP005", "name": "钱七", "department": "安全部", "position": "安全员", "email": "qianqi@example.com", "phone": "13800138005"},
        ]
        
        employees = []
        for emp_data in employees_data:
            existing = crud.get_employee_by_employee_id(db, emp_data["employee_id"])
            if existing:
                employees.append(existing)
                print(f"员工已存在: {emp_data['name']}")
            else:
                emp = schemas.EmployeeCreate(**emp_data)
                db_emp = crud.create_employee(db, emp)
                employees.append(db_emp)
                print(f"创建员工: {emp_data['name']}")
        
        today = date.today()
        
        certificates_data = [
            {"employee_id": 1, "certificate_type_id": 1, "certificate_number": "SAFE2021001", "issue_date": today - timedelta(days=365*2+30), "expiry_date": today + timedelta(days=365-30), "score": 85.0},
            {"employee_id": 1, "certificate_type_id": 2, "certificate_number": "QUAL2022001", "issue_date": today - timedelta(days=365), "expiry_date": today + timedelta(days=365), "score": 78.0},
            {"employee_id": 2, "certificate_type_id": 2, "certificate_number": "QUAL2020001", "issue_date": today - timedelta(days=365*3+60), "expiry_date": today - timedelta(days=60), "score": 82.0},
            {"employee_id": 3, "certificate_type_id": 3, "certificate_number": "TECH2023001", "issue_date": today - timedelta(days=180), "expiry_date": today + timedelta(days=365*4+180), "score": 71.0},
            {"employee_id": 4, "certificate_type_id": 1, "certificate_number": "SAFE2023002", "issue_date": today - timedelta(days=90), "expiry_date": today + timedelta(days=60), "score": 68.0},
            {"employee_id": 5, "certificate_type_id": 1, "certificate_number": "SAFE2019001", "issue_date": today - timedelta(days=365*4), "expiry_date": today - timedelta(days=365), "score": 75.0},
        ]
        
        for cert_data in certificates_data:
            db_cert = crud.create_employee_certificate(db, schemas.EmployeeCertificateCreate(**cert_data))
            print(f"创建员工证书: {db_cert.certificate_number}")
        
        course_scores_data = [
            {"employee_id": 1, "certificate_type_id": 1, "course_name": "安全生产基础培训", "score": 85.0, "exam_date": today - timedelta(days=365*2+30)},
            {"employee_id": 1, "certificate_type_id": 2, "course_name": "质量管理体系培训", "score": 78.0, "exam_date": today - timedelta(days=365)},
            {"employee_id": 2, "certificate_type_id": 2, "course_name": "质量管理体系培训", "score": 82.0, "exam_date": today - timedelta(days=365*3+60)},
            {"employee_id": 3, "certificate_type_id": 3, "course_name": "专业技术等级考试", "score": 71.0, "exam_date": today - timedelta(days=180)},
            {"employee_id": 4, "certificate_type_id": 1, "course_name": "安全生产基础培训", "score": 55.0, "exam_date": today - timedelta(days=90)},
            {"employee_id": 5, "certificate_type_id": 1, "course_name": "安全生产基础培训", "score": 75.0, "exam_date": today - timedelta(days=365*4)},
            {"employee_id": 5, "certificate_type_id": 3, "course_name": "专业技术等级考试", "score": 58.0, "exam_date": today - timedelta(days=60)},
        ]
        
        for score_data in course_scores_data:
            db_score = crud.create_course_score(db, schemas.CourseScoreCreate(**score_data))
            status = "通过" if db_score.is_passed else "未通过"
            print(f"创建课程成绩: {score_data['course_name']} - {score_data['score']}分 ({status})")
        
        position_requirements_data = [
            {"position_name": "高级工程师", "certificate_type_id": 1, "is_required": True, "description": "安全生产证书为必备"},
            {"position_name": "高级工程师", "certificate_type_id": 3, "is_required": True, "description": "技术等级证书为必备"},
            {"position_name": "质量主管", "certificate_type_id": 2, "is_required": True, "description": "质量管理证书为必备"},
            {"position_name": "技术员", "certificate_type_id": 3, "is_required": True, "description": "技术等级证书为必备"},
            {"position_name": "操作员", "certificate_type_id": 1, "is_required": True, "description": "安全生产证书为必备"},
            {"position_name": "安全员", "certificate_type_id": 1, "is_required": True, "description": "安全生产证书为必备"},
        ]
        
        for req_data in position_requirements_data:
            db_req = crud.create_position_requirement(db, schemas.PositionRequirementCreate(**req_data))
            print(f"创建岗位要求: {req_data['position_name']} - 证书类型{req_data['certificate_type_id']}")
        
        renewal_items_data = [
            {"employee_id": 2, "certificate_type_id": 2, "employee_certificate_id": 3, "priority": 2, "due_date": today + timedelta(days=30), "assigned_to": "人事部", "remarks": "证书已过期，需尽快续期"},
            {"employee_id": 4, "certificate_type_id": 1, "employee_certificate_id": 5, "priority": 1, "due_date": today + timedelta(days=60), "assigned_to": "生产部主管", "remarks": "即将过期"},
            {"employee_id": 5, "certificate_type_id": 1, "employee_certificate_id": 6, "priority": 3, "due_date": today + timedelta(days=7), "assigned_to": "安全部主管", "remarks": "已过期，紧急处理"},
            {"employee_id": 1, "certificate_type_id": 1, "employee_certificate_id": 1, "priority": 1, "due_date": today + timedelta(days=335), "assigned_to": None, "remarks": ""},
        ]
        
        for renewal_data in renewal_items_data:
            db_renewal = crud.create_renewal_item(db, schemas.RenewalItemCreate(**renewal_data))
            print(f"创建续期项: {db_renewal.renewal_code}")
        
        print("\n测试数据创建完成！")
        print(f"\n数据统计:")
        print(f"- 员工数量: {len(employees)}")
        print(f"- 证书类型: {len(cert_types)}")
        print(f"- 员工证书: {len(certificates_data)}")
        print(f"- 课程成绩: {len(course_scores_data)}")
        print(f"- 岗位要求: {len(position_requirements_data)}")
        print(f"- 续期清单: {len(renewal_items_data)}")
        
    except Exception as e:
        print(f"创建测试数据时出错: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_test_data()
