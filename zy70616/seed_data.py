from database import SessionLocal
from models import Employee, CertificateType, EmployeeCertificate, CourseScore
from datetime import date, timedelta
import json

db = SessionLocal()

try:
    print("开始生成测试数据...")
    
    employees_data = [
        {"employee_id": "E001", "name": "张三", "department": "技术部", "position": "高级工程师"},
        {"employee_id": "E002", "name": "李四", "department": "技术部", "position": "工程师"},
        {"employee_id": "E003", "name": "王五", "department": "市场部", "position": "市场经理"},
        {"employee_id": "E004", "name": "赵六", "department": "人事部", "position": "人事专员"},
        {"employee_id": "E005", "name": "钱七", "department": "财务部", "position": "财务主管"},
    ]
    
    for emp_data in employees_data:
        emp = Employee(**emp_data, status="active")
        db.add(emp)
    db.commit()
    print(f"已创建 {len(employees_data)} 名员工")
    
    cert_types_data = [
        {"code": "CERT001", "name": "软件工程师资格证", "validity_period_months": 36},
        {"code": "CERT002", "name": "项目管理专业资格证", "validity_period_months": 36},
        {"code": "CERT003", "name": "人力资源管理师", "validity_period_months": 24},
        {"code": "CERT004", "name": "会计从业资格证", "validity_period_months": 24},
    ]
    
    for ct_data in cert_types_data:
        ct = CertificateType(**ct_data)
        db.add(ct)
    db.commit()
    print(f"已创建 {len(cert_types_data)} 种证书类型")
    
    employees = db.query(Employee).all()
    cert_types = db.query(CertificateType).all()
    
    today = date.today()
    certs_data = [
        (employees[0], cert_types[0], today - timedelta(days=700), today + timedelta(days=20)),
        (employees[0], cert_types[1], today - timedelta(days=365), today + timedelta(days=730)),
        (employees[1], cert_types[0], today - timedelta(days=365), today - timedelta(days=10)),
        (employees[2], cert_types[1], today - timedelta(days=500), today + timedelta(days=60)),
        (employees[3], cert_types[2], today - timedelta(days=400), today + timedelta(days=320)),
        (employees[4], cert_types[3], today - timedelta(days=600), today - timedelta(days=5)),
    ]
    
    for i, (emp, ct, issue_date, expiry_date) in enumerate(certs_data):
        cert = EmployeeCertificate(
            employee_id=emp.id,
            certificate_type_id=ct.id,
            certificate_number=f"CERT{2024}{i+1:04d}",
            issue_date=issue_date,
            expiry_date=expiry_date
        )
        db.add(cert)
    db.commit()
    print(f"已创建 {len(certs_data)} 条员工证书记录")
    
    courses_data = [
        (employees[0], "CS001", "Python高级编程", 85.5, today - timedelta(days=30)),
        (employees[0], "CS002", "项目管理实战", 78.0, today - timedelta(days=20)),
        (employees[1], "CS001", "Python高级编程", 55.0, today - timedelta(days=30)),
        (employees[1], "CS003", "数据库设计", 45.0, today - timedelta(days=15)),
        (employees[2], "CS002", "项目管理实战", 92.0, today - timedelta(days=25)),
        (employees[3], "CS004", "人力资源管理", 88.0, today - timedelta(days=40)),
        (employees[4], "CS005", "财务分析", 75.0, today - timedelta(days=35)),
    ]
    
    for emp, course_code, course_name, score, exam_date in courses_data:
        cs = CourseScore(
            employee_id=emp.id,
            course_code=course_code,
            course_name=course_name,
            score=score,
            exam_date=exam_date
        )
        db.add(cs)
    db.commit()
    print(f"已创建 {len(courses_data)} 条课程成绩记录 (不及格自动生成补考记录)")
    
    from services import QualificationService
    import schemas
    
    position_reqs = [
        (employees[0], "高级工程师", ["CERT001", "CERT002"], ["CS001", "CS002"]),
        (employees[1], "工程师", ["CERT001"], ["CS001", "CS003"]),
        (employees[2], "市场经理", ["CERT002"], ["CS002"]),
    ]
    
    for emp, pos_name, certs, courses in position_reqs:
        req = schemas.PositionRequirementCreate(
            employee_id=emp.id,
            position_name=pos_name,
            required_certificate_types=json.dumps(certs),
            required_courses=json.dumps(courses)
        )
        QualificationService.create_position_requirement(db, req)
    print(f"已创建 {len(position_reqs)} 条岗位资格记录")
    
    print("\n测试数据生成完成!")
    print("\n数据概览:")
    print(f"- 员工: {db.query(Employee).count()} 人")
    print(f"- 证书类型: {db.query(CertificateType).count()} 种")
    print(f"- 员工证书: {db.query(EmployeeCertificate).count()} 条")
    print(f"- 课程成绩: {db.query(CourseScore).count()} 条")
    
    print("\n即将过期/已过期证书:")
    from services import CertificateService
    expiring = CertificateService.get_expiring_certificates(db, days=90)
    for cert in expiring:
        emp = db.query(Employee).filter(Employee.id == cert.employee_id).first()
        print(f"  - {emp.name}: {cert.certificate_type.name} (有效期至: {cert.expiry_date}, 状态: {cert.status})")
    
finally:
    db.close()
