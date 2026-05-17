from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models
from datetime import datetime, timedelta

models.Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()
    
    try:
        print("开始生成测试数据...")
        
        coach1 = models.Coach(
            name="张教练",
            phone="13800138001",
            specialty="增肌训练"
        )
        coach2 = models.Coach(
            name="李教练",
            phone="13800138002",
            specialty="减脂塑形"
        )
        coach3 = models.Coach(
            name="王教练",
            phone="13800138003",
            specialty="康复训练"
        )
        db.add_all([coach1, coach2, coach3])
        db.commit()
        print("教练数据创建完成")
        
        member1 = models.MemberCard(
            member_name="张三",
            member_phone="13900139001",
            card_number="CARD001",
            total_hours=48,
            used_hours=0,
            frozen_hours=0,
            remaining_hours=48
        )
        member2 = models.MemberCard(
            member_name="李四",
            member_phone="13900139002",
            card_number="CARD002",
            total_hours=24,
            used_hours=0,
            frozen_hours=0,
            remaining_hours=24
        )
        db.add_all([member1, member2])
        db.commit()
        print("会员卡数据创建完成")
        
        package1 = models.CoursePackage(
            member_card_id=1,
            package_name="年卡私教课",
            course_type="增肌课程",
            total_hours=48,
            used_hours=0,
            frozen_hours=0,
            remaining_hours=48,
            coach_id=1
        )
        package2 = models.CoursePackage(
            member_card_id=2,
            package_name="半年卡私教课",
            course_type="减脂课程",
            total_hours=24,
            used_hours=0,
            frozen_hours=0,
            remaining_hours=24,
            coach_id=2
        )
        db.add_all([package1, package2])
        db.commit()
        print("课程包数据创建完成")
        
        base_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        bookings = []
        for i in range(3):
            booking_date = base_date + timedelta(days=i+1)
            bookings.append(models.Booking(
                member_card_id=1,
                course_package_id=1,
                main_coach_id=1,
                booking_date=booking_date,
                start_time=f"{9+i}:00",
                end_time=f"{10+i}:00",
                hours=1,
                status="confirmed",
                created_by="admin"
            ))
        
        for i in range(2):
            booking_date = base_date + timedelta(days=i+1)
            bookings.append(models.Booking(
                member_card_id=2,
                course_package_id=2,
                main_coach_id=2,
                booking_date=booking_date,
                start_time=f"{14+i}:00",
                end_time=f"{15+i}:00",
                hours=1,
                status="pending",
                created_by="admin"
            ))
        
        db.add_all(bookings)
        db.commit()
        print("预约数据创建完成")
        
        print("所有测试数据创建成功！")
        print(f"\n数据统计：")
        print(f"  教练: {db.query(models.Coach).count()} 名")
        print(f"  会员: {db.query(models.MemberCard).count()} 名")
        print(f"  课程包: {db.query(models.CoursePackage).count()} 个")
        print(f"  预约记录: {db.query(models.Booking).count()} 条")
        
    except Exception as e:
        print(f"生成数据出错: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
