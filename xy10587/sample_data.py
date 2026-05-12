from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import (
    Member, Coach, Package, Appointment, Deduction, Commission,
    MemberStatus, CoachStatus, PackageStatus, AppointmentStatus, DeductionReason
)
from services import (
    get_or_create_member, get_or_create_coach, create_package,
    create_appointment, confirm_attendance, request_leave,
    record_no_show, transfer_package
)
import uuid

Base.metadata.create_all(bind=engine)

def req_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def setup_sample_data():
    db = SessionLocal()
    try:
        print("=" * 60)
        print("正在创建健身私教课消课系统样例数据...")
        print("=" * 60)
        
        print("\n1. 创建会员...")
        zhang = get_or_create_member(db, "张三", "13800138001")
        li = get_or_create_member(db, "李四", "13800138002")
        wang = get_or_create_member(db, "王五", "13800138003")
        zhao = get_or_create_member(db, "赵六", "13800138004")
        db.commit()
        print(f"   张三(ID={zhang.id}), 李四(ID={li.id}), 王五(ID={wang.id}), 赵六(ID={zhao.id})")
        
        print("\n2. 创建教练...")
        coach_wang = get_or_create_coach(db, "王教练", "13900139001", 0.5)
        coach_liu = get_or_create_coach(db, "刘教练", "13900139002", 0.6)
        db.commit()
        print(f"   王教练(ID={coach_wang.id}, 提成50%), 刘教练(ID={coach_liu.id}, 提成60%)")
        
        print("\n3. 购买课包...")
        today = date.today()
        expire_3m = today + timedelta(days=90)
        expire_6m = today + timedelta(days=180)
        expire_past = today - timedelta(days=1)
        
        pkg1 = create_package(db, zhang.id, coach_wang.id, 10, today, expire_3m, 3000.0)
        pkg2 = create_package(db, li.id, coach_liu.id, 20, today, expire_6m, 5000.0)
        pkg3 = create_package(db, wang.id, coach_wang.id, 5, today, expire_3m, 1500.0)
        pkg4 = create_package(db, zhao.id, coach_liu.id, 15, today, expire_6m, 4500.0)
        db.commit()
        print(f"   张三: 10节私教课(王教练), ¥3000, 每节¥300")
        print(f"   李四: 20节私教课(刘教练), ¥5000, 每节¥250")
        print(f"   王五: 5节私教课(王教练), ¥1500, 每节¥300")
        print(f"   赵六: 15节私教课(刘教练), ¥4500, 每节¥300")
        
        print("\n4. 场景一: 正常上课流程 (张三上第1节课)")
        tomorrow = datetime.now() + timedelta(days=1)
        start1 = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        end1 = start1 + timedelta(hours=1)
        
        appt1 = create_appointment(db, zhang.id, coach_wang.id, pkg1.id, start1, end1, req_id("appt_zhang1"))
        db.commit()
        print(f"   创建预约: {start1.strftime('%Y-%m-%d %H:%M')} - 张三 → 王教练 (pending)")
        
        appt1.status = AppointmentStatus.ATTENDED
        from services import apply_deduction, create_commission
        ded1 = apply_deduction(db, appt1, DeductionReason.ATTENDED)
        comm1 = create_commission(db, ded1, appt1)
        db.commit()
        print(f"   确认上课: 扣课1节, 剩余{pkg1.remaining_sessions}节")
        print(f"   生成提成: 王教练 +¥{comm1.total_amount:.2f} (50% × ¥{pkg1.per_session_price})")
        
        print("\n5. 场景二: 开课前请假 (李四提前请假，不扣课)")
        start2 = tomorrow.replace(hour=14, minute=0, second=0, microsecond=0)
        end2 = start2 + timedelta(hours=1)
        
        appt2 = create_appointment(db, li.id, coach_liu.id, pkg2.id, start2, end2, req_id("appt_li1"))
        db.commit()
        print(f"   创建预约: {start2.strftime('%Y-%m-%d %H:%M')} - 李四 → 刘教练 (pending)")
        
        leave1 = request_leave(db, appt2.id, req_id("leave_li1"), "有事需要请假")
        db.commit()
        print(f"   提前请假: 开课前{24}小时请假，不扣课")
        print(f"   预约状态: {appt2.status.value}, 课包剩余: {pkg2.remaining_sessions}节")
        
        print("\n6. 场景三: 超时取消/爽约 (王五的两种情况)")
        past_start = datetime.now() - timedelta(hours=2)
        past_end = past_start + timedelta(hours=1)
        appt3_past = Appointment(
            member_id=wang.id, coach_id=coach_wang.id, package_id=pkg3.id,
            start_time=past_start, end_time=past_end,
            status=AppointmentStatus.PENDING, deduction_applied=False,
            request_id=req_id("appt_wang_past")
        )
        db.add(appt3_past)
        db.commit()
        
        leave2 = request_leave(db, appt3_past.id, req_id("leave_wang1"), "突然有事")
        db.commit()
        print(f"   情况A: 课程开始后2小时才取消 → 超时取消，扣课1节")
        print(f"   预约状态: {appt3_past.status.value}, 课包剩余: {pkg3.remaining_sessions}节 (原5节)")
        
        start4 = datetime.now() - timedelta(hours=3)
        end4 = start4 + timedelta(hours=1)
        appt4 = Appointment(
            member_id=wang.id, coach_id=coach_wang.id, package_id=pkg3.id,
            start_time=start4, end_time=end4,
            status=AppointmentStatus.PENDING, deduction_applied=False,
            request_id=req_id("appt_wang2")
        )
        db.add(appt4)
        db.commit()
        
        no_show1 = record_no_show(db, appt4.id, req_id("noshow_wang1"), "会员未到")
        db.commit()
        print(f"\n   情况B: 会员未到 → 记录爽约，扣课1节")
        print(f"   预约状态: {appt4.status.value}, 课包剩余: {pkg3.remaining_sessions}节")
        
        print("\n7. 场景四: 课包转让 (赵六转让5节课给李四)")
        print(f"   转让前: 赵六剩余{pkg4.remaining_sessions}节, 李四剩余{pkg2.remaining_sessions}节")
        
        transfer1 = transfer_package(db, zhao.id, li.id, pkg4.id, 5, req_id("transfer_zhao_li"))
        db.commit()
        
        pkg2_reloaded = db.query(Package).filter(Package.id == pkg2.id).first()
        pkg4_reloaded = db.query(Package).filter(Package.id == pkg4.id).first()
        
        new_pkg = db.query(Package).filter(
            Package.member_id == li.id,
            Package.id != pkg2.id
        ).order_by(Package.id.desc()).first()
        
        print(f"   转让5节课后:")
        print(f"   赵六剩余: {pkg4_reloaded.remaining_sessions}节 (原15节)")
        print(f"   李四获得新课包: ID={new_pkg.id}, {new_pkg.remaining_sessions}节")
        print(f"   李四总剩余: {pkg2_reloaded.remaining_sessions + new_pkg.remaining_sessions}节")
        
        print("\n" + "=" * 60)
        print("样例数据创建完成！")
        print("=" * 60)
        
        print("\n【核心数据摘要】")
        print("-" * 60)
        
        all_packages = db.query(Package).all()
        print("\n【会员课包账本】")
        for pkg in all_packages:
            member = db.query(Member).filter(Member.id == pkg.member_id).first()
            coach = db.query(Coach).filter(Coach.id == pkg.coach_id).first()
            print(f"  会员:{member.name} | 教练:{coach.name} | "
                  f"{pkg.used_sessions}/{pkg.total_sessions}节 | "
                  f"剩余{pkg.remaining_sessions}节 | 状态:{pkg.status.value}")
        
        print("\n【扣课记录】")
        all_deductions = db.query(Deduction).all()
        for ded in all_deductions:
            member = db.query(Member).filter(Member.id == ded.member_id).first()
            coach = db.query(Coach).filter(Coach.id == ded.coach_id).first()
            print(f"  {member.name} → {coach.name}: -{ded.sessions}节 | "
                  f"原因:{ded.reason.value} | {ded.created_at.strftime('%H:%M:%S')}")
        
        print("\n【教练提成】")
        all_commissions = db.query(Commission).all()
        coach_totals = {}
        for comm in all_commissions:
            coach = db.query(Coach).filter(Coach.id == comm.coach_id).first()
            if coach.name not in coach_totals:
                coach_totals[coach.name] = {"sessions": 0, "amount": 0}
            coach_totals[coach.name]["sessions"] += comm.sessions
            coach_totals[coach.name]["amount"] += comm.total_amount
        
        for coach_name, data in coach_totals.items():
            print(f"  {coach_name}: {data['sessions']}节课, 提成¥{data['amount']:.2f}")
        
        print("\n【教练课表(未来7天)】")
        future_appts = db.query(Appointment).filter(
            Appointment.start_time > datetime.now()
        ).all()
        for appt in future_appts:
            member = db.query(Member).filter(Member.id == appt.member_id).first()
            coach = db.query(Coach).filter(Coach.id == appt.coach_id).first()
            print(f"  {appt.start_time.strftime('%Y-%m-%d %H:%M')} | "
                  f"{coach.name} ← {member.name} | {appt.status.value}")
        
        print("\n" + "=" * 60)
        print("演示说明:")
        print("  1. 张三上了1节课 → 扣课1节, 王教练获得提成¥150")
        print("  2. 李四提前请假 → 不扣课, 状态leave")
        print("  3. 王五超时取消 → 扣课1节, 状态cancelled")
        print("  4. 王五爽约 → 扣课1节, 状态no_show")
        print("  5. 赵六转让5节给李四 → 赵六剩余10节, 李四获得新课包")
        print("=" * 60)
        
        return {
            "members": {"张三": zhang.id, "李四": li.id, "王五": wang.id, "赵六": zhao.id},
            "coaches": {"王教练": coach_wang.id, "刘教练": coach_liu.id},
            "packages": [pkg1.id, pkg2.id, pkg3.id, pkg4.id]
        }
        
    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    setup_sample_data()
