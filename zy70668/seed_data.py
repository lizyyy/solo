from sqlalchemy.orm import Session
from database import SessionLocal
import models
from datetime import datetime


def seed_database():
    db = SessionLocal()
    
    try:
        db.query(models.ActivityType).delete()
        db.query(models.Student).delete()
        db.query(models.CreditApplication).delete()
        db.query(models.RejectionReason).delete()
        db.query(models.CreditReport).delete()
        db.query(models.ReportDetail).delete()
        db.query(models.AuditLog).delete()
        db.commit()
        
        activity_types = [
            {"code": "lecture", "name": "讲座", "max_credit": 2.0, "description": "各类学术讲座、报告会"},
            {"code": "competition", "name": "竞赛", "max_credit": 3.0, "description": "学科竞赛、创新创业竞赛"},
            {"code": "volunteer", "name": "志愿服务", "max_credit": 2.0, "description": "志愿服务、社会实践"},
        ]
        
        for at in activity_types:
            db_activity_type = models.ActivityType(**at)
            db.add(db_activity_type)
        
        students = [
            {"student_id": "2024001", "name": "张三", "grade": "2024级", "major": "计算机科学与技术"},
            {"student_id": "2024002", "name": "李四", "grade": "2024级", "major": "软件工程"},
            {"student_id": "2024003", "name": "王五", "grade": "2024级", "major": "数据科学"},
        ]
        
        for s in students:
            db_student = models.Student(**s)
            db.add(db_student)
        
        db.commit()
        
        print("活动类型已创建")
        print("学生数据已创建")
        
        student1 = db.query(models.Student).filter(models.Student.student_id == "2024001").first()
        lecture_type = db.query(models.ActivityType).filter(models.ActivityType.code == "lecture").first()
        competition_type = db.query(models.ActivityType).filter(models.ActivityType.code == "competition").first()
        volunteer_type = db.query(models.ActivityType).filter(models.ActivityType.code == "volunteer").first()
        
        applications = [
            {
                "student_id": student1.id,
                "activity_type_id": lecture_type.id,
                "activity_name": "人工智能前沿讲座",
                "activity_date": datetime(2024, 9, 15),
                "credit": 0.5,
                "proof_material": "https://example.com/proof1.pdf",
                "status": "approved"
            },
            {
                "student_id": student1.id,
                "activity_type_id": lecture_type.id,
                "activity_name": "大数据技术讲座",
                "activity_date": datetime(2024, 10, 20),
                "credit": 0.5,
                "proof_material": "https://example.com/proof2.pdf",
                "status": "approved"
            },
            {
                "student_id": student1.id,
                "activity_type_id": competition_type.id,
                "activity_name": "数学建模竞赛",
                "activity_date": datetime(2024, 11, 10),
                "credit": 1.5,
                "proof_material": "https://example.com/proof3.pdf",
                "status": "approved"
            },
            {
                "student_id": student1.id,
                "activity_type_id": volunteer_type.id,
                "activity_name": "社区敬老志愿服务",
                "activity_date": datetime(2024, 10, 1),
                "credit": 1.0,
                "proof_material": "https://example.com/proof4.pdf",
                "status": "pending"
            },
            {
                "student_id": student1.id,
                "activity_type_id": lecture_type.id,
                "activity_name": "区块链技术讲座",
                "activity_date": datetime(2024, 11, 5),
                "credit": 0.5,
                "proof_material": "https://example.com/proof5.pdf",
                "status": "pending"
            },
        ]
        
        for app in applications:
            db_app = models.CreditApplication(**app)
            db.add(db_app)
        
        db.commit()
        
        pending_app = db.query(models.CreditApplication).filter(
            models.CreditApplication.activity_name == "区块链技术讲座"
        ).first()
        
        rejection = models.RejectionReason(
            application_id=pending_app.id,
            reason="证明材料不清晰，需重新上传",
            handler="admin",
            conclusion="审核不通过，驳回申请"
        )
        db.add(rejection)
        
        pending_app.status = "rejected"
        db.commit()
        
        print("学分申请已创建")
        print("测试数据填充完成！")
        
    except Exception as e:
        db.rollback()
        print(f"填充数据时出错: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
