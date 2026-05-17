from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime, timedelta

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    students_data = [
        {"student_id": "S001", "name": "张三", "email": "zhangsan@example.com", "phone": "13800138001"},
        {"student_id": "S002", "name": "李四", "email": "lisi@example.com", "phone": "13800138002"},
        {"student_id": "S003", "name": "王五", "email": "wangwu@example.com", "phone": "13800138003"},
        {"student_id": "S004", "name": "赵六", "email": "zhaoliu@example.com", "phone": "13800138004"},
        {"student_id": "S005", "name": "钱七", "email": "qianqi@example.com", "phone": "13800138005"},
    ]
    
    for s in students_data:
        existing = db.query(models.Student).filter(models.Student.student_id == s["student_id"]).first()
        if not existing:
            db.add(models.Student(**s))
    
    sessions_data = [
        {"session_code": "CLASS001", "course_name": "Python基础班", "session_date": datetime.now() - timedelta(days=4), "total_hours": 4.0},
        {"session_code": "CLASS002", "course_name": "Python基础班", "session_date": datetime.now() - timedelta(days=3), "total_hours": 4.0},
        {"session_code": "CLASS003", "course_name": "Python基础班", "session_date": datetime.now() - timedelta(days=2), "total_hours": 4.0},
        {"session_code": "CLASS004", "course_name": "Python基础班", "session_date": datetime.now() - timedelta(days=1), "total_hours": 4.0},
        {"session_code": "CLASS005", "course_name": "Python基础班", "session_date": datetime.now(), "total_hours": 4.0},
    ]
    
    for s in sessions_data:
        existing = db.query(models.CourseSession).filter(models.CourseSession.session_code == s["session_code"]).first()
        if not existing:
            db.add(models.CourseSession(**s))
    
    db.commit()
    
    students = db.query(models.Student).all()
    sessions = db.query(models.CourseSession).all()
    
    attendance_data = [
        (students[0].id, sessions[0].id, "present", "machine"),
        (students[0].id, sessions[1].id, "present", "machine"),
        (students[0].id, sessions[2].id, "absent", "machine"),
        (students[0].id, sessions[3].id, "present", "machine"),
        (students[1].id, sessions[0].id, "present", "machine"),
        (students[1].id, sessions[1].id, "absent", "machine"),
        (students[1].id, sessions[2].id, "late", "machine"),
        (students[2].id, sessions[0].id, "present", "machine"),
        (students[2].id, sessions[1].id, "present", "machine"),
        (students[2].id, sessions[2].id, "present", "machine"),
        (students[2].id, sessions[3].id, "present", "machine"),
        (students[3].id, sessions[0].id, "absent", "machine"),
        (students[3].id, sessions[1].id, "absent", "machine"),
        (students[4].id, sessions[0].id, "present", "machine"),
    ]
    
    for student_id, session_id, status, source in attendance_data:
        existing = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.student_id == student_id,
            models.AttendanceRecord.session_id == session_id
        ).first()
        if not existing:
            db.add(models.AttendanceRecord(
                student_id=student_id,
                session_id=session_id,
                sign_in_time=datetime.now(),
                sign_out_time=datetime.now() + timedelta(hours=4),
                status=status,
                source=source
            ))
    
    db.commit()
    
    makeup_data = [
        (students[0].id, sessions[2].id, "T001", "王老师", "学员当天生病请假", "pending"),
        (students[1].id, sessions[1].id, "T001", "王老师", "学员迟到后补签", "pending"),
        (students[3].id, sessions[0].id, "T002", "李老师", "学员设备故障无法签到", "pending"),
        (students[3].id, sessions[1].id, "T002", "李老师", "学员家中有事", "approved"),
    ]
    
    for student_id, session_id, teacher_id, teacher_name, reason, status in makeup_data:
        existing = db.query(models.MakeUpSign).filter(
            models.MakeUpSign.student_id == student_id,
            models.MakeUpSign.session_id == session_id
        ).first()
        if not existing:
            db.add(models.MakeUpSign(
                student_id=student_id,
                session_id=session_id,
                teacher_id=teacher_id,
                teacher_name=teacher_name,
                reason=reason,
                sign_date=datetime.now(),
                status=status
            ))
    
    db.commit()
    
    print("测试数据创建成功！")
    print(f"学生数量: {len(students)}")
    print(f"课程场次: {len(sessions)}")
    print(f"签到记录: {db.query(models.AttendanceRecord).count()}")
    print(f"补签记录: {db.query(models.MakeUpSign).count()}")
    
    conflicts = db.query(models.ConflictRecord).all()
    print(f"自动生成的冲突: {len(conflicts)}")
    for c in conflicts:
        print(f"  - {c.conflict_type}: {c.conflict_reason}")

except Exception as e:
    print(f"创建测试数据时出错: {e}")
    db.rollback()
finally:
    db.close()
