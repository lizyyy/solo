from datetime import datetime, date, timedelta
from database import SessionLocal, engine, Base
from models import (
    Member, Coach, Package, Appointment, Deduction, Commission,
    StatusHistory, IdempotencyLog,
    MemberStatus, CoachStatus, PackageStatus, AppointmentStatus, DeductionReason
)
from services import (
    get_or_create_member, get_or_create_coach, create_package,
    create_appointment, confirm_attendance, request_leave,
    record_no_show, transfer_package, apply_manual_correction
)
import uuid

Base.metadata.create_all(bind=engine)

def req_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def test_full_system():
    print("=" * 70)
    print("健身私教课消课系统 - 完整功能测试")
    print("=" * 70)
    
    db = SessionLocal()
    
    try:
        test_results = []
        
        print("\n[测试1] 创建会员和教练")
        print("-" * 70)
        member1 = get_or_create_member(db, "测试会员A", "15000000001")
        member2 = get_or_create_member(db, "测试会员B", "15000000002")
        coach = get_or_create_coach(db, "测试教练", "15100000001", 0.5)
        db.commit()
        print(f"✓ 会员A: ID={member1.id}")
        print(f"✓ 会员B: ID={member2.id}")
        print(f"✓ 教练: ID={coach.id}, 提成50%")
        test_results.append(("会员教练创建", True))
        
        print("\n[测试2] 购买课包")
        print("-" * 70)
        today = date.today()
        expire = today + timedelta(days=90)
        pkg = create_package(db, member1.id, coach.id, 10, today, expire, 3000.0)
        db.commit()
        print(f"✓ 课包ID={pkg.id}: {pkg.total_sessions}节, 每节¥{pkg.per_session_price}")
        assert pkg.remaining_sessions == 10, f"预期10节，实际{pkg.remaining_sessions}"
        test_results.append(("课包购买", True))
        
        print("\n[测试3] 创建预约 - 正常场景")
        print("-" * 70)
        tomorrow = datetime.now() + timedelta(days=1)
        start = tomorrow.replace(hour=10, minute=0, second=0, microsecond=0)
        end = start + timedelta(hours=1)
        appt1 = create_appointment(
            db, member1.id, coach.id, pkg.id, start, end, req_id("appt1")
        )
        db.commit()
        print(f"✓ 创建预约: {start.strftime('%Y-%m-%d %H:%M')}")
        assert appt1.status == AppointmentStatus.PENDING
        test_results.append(("创建预约", True))
        
        print("\n[测试4] 幂等性测试 - 重复执行同一请求")
        print("-" * 70)
        rid = req_id("idem_test")
        appt_idem1 = create_appointment(
            db, member1.id, coach.id, pkg.id,
            start + timedelta(hours=3), end + timedelta(hours=3), rid
        )
        db.commit()
        appt_idem2 = create_appointment(
            db, member1.id, coach.id, pkg.id,
            start + timedelta(hours=3), end + timedelta(hours=3), rid
        )
        db.commit()
        print(f"✓ 第一次创建预约ID={appt_idem1.id}")
        print(f"✓ 第二次返回同一预约ID={appt_idem2.id}")
        assert appt_idem1.id == appt_idem2.id, "幂等性失败：创建了不同的预约"
        test_results.append(("幂等性保障", True))
        
        print("\n[测试5] 教练时间冲突检测")
        print("-" * 70)
        try:
            create_appointment(
                db, member2.id, coach.id, pkg.id,
                start + timedelta(minutes=30), end + timedelta(minutes=30), req_id("conflict")
            )
            db.commit()
            print("✗ 冲突检测失败：应该抛出异常")
            test_results.append(("教练冲突检测", False))
        except ValueError as e:
            if "教练时间冲突" in str(e):
                print(f"✓ 正确检测到时间冲突: {e}")
                test_results.append(("教练冲突检测", True))
            else:
                print(f"✗ 异常类型错误: {e}")
                test_results.append(("教练冲突检测", False))
        
        print("\n[测试6] 确认上课 - 扣课和提成")
        print("-" * 70)
        confirm_rid = req_id("confirm")
        pkg_before = db.query(Package).filter(Package.id == pkg.id).first()
        print(f"  上课前: 剩余{pkg_before.remaining_sessions}节")
        
        appt1.status = AppointmentStatus.PENDING
        db.commit()
        confirmed = confirm_attendance(db, appt1.id, confirm_rid)
        db.commit()
        
        pkg_after = db.query(Package).filter(Package.id == pkg.id).first()
        print(f"  上课后: 剩余{pkg_after.remaining_sessions}节")
        
        deduction = db.query(Deduction).filter(Deduction.appointment_id == appt1.id).first()
        commission = db.query(Commission).filter(Commission.appointment_id == appt1.id).first()
        
        print(f"✓ 预约状态: {confirmed.status.value}")
        print(f"✓ 扣课记录: 1节, 原因={deduction.reason.value if deduction else 'None'}")
        print(f"✓ 提成记录: ¥{commission.total_amount if commission else 0:.2f}")
        
        assert pkg_after.remaining_sessions == 9, f"预期剩余9节，实际{pkg_after.remaining_sessions}"
        assert deduction is not None, "扣课记录未创建"
        assert commission is not None, "提成记录未创建"
        test_results.append(("上课扣课", True))
        test_results.append(("提成计算", True))
        
        print("\n[测试7] 开课前请假 - 不扣课")
        print("-" * 70)
        start_future = datetime.now() + timedelta(days=3)
        end_future = start_future + timedelta(hours=1)
        appt_leave = create_appointment(
            db, member1.id, coach.id, pkg.id, start_future, end_future, req_id("appt_leave")
        )
        db.commit()
        
        pkg_before_leave = db.query(Package).filter(Package.id == pkg.id).first()
        leave = request_leave(db, appt_leave.id, req_id("leave_req"), "测试请假")
        db.commit()
        pkg_after_leave = db.query(Package).filter(Package.id == pkg.id).first()
        
        print(f"  请假前: 剩余{pkg_before_leave.remaining_sessions}节")
        print(f"  请假后: 剩余{pkg_after_leave.remaining_sessions}节")
        print(f"  is_before_cutoff={leave.is_before_cutoff}")
        print(f"  预约状态={appt_leave.status.value}")
        
        assert leave.is_before_cutoff == True, "应该是开课前请假"
        assert pkg_before_leave.remaining_sessions == pkg_after_leave.remaining_sessions, "提前请假不应该扣课"
        test_results.append(("开课前请假不扣课", True))
        
        print("\n[测试8] 超时取消 - 扣课")
        print("-" * 70)
        past_start = datetime.now() - timedelta(hours=2)
        past_end = past_start + timedelta(hours=1)
        appt_late = Appointment(
            member_id=member1.id, coach_id=coach.id, package_id=pkg.id,
            start_time=past_start, end_time=past_end,
            status=AppointmentStatus.PENDING, deduction_applied=False,
            request_id=req_id("appt_late")
        )
        db.add(appt_late)
        db.commit()
        
        pkg_before_late = db.query(Package).filter(Package.id == pkg.id).first()
        late_leave = request_leave(db, appt_late.id, req_id("late_leave"), "突然有事")
        db.commit()
        pkg_after_late = db.query(Package).filter(Package.id == pkg.id).first()
        
        print(f"  取消前: 剩余{pkg_before_late.remaining_sessions}节")
        print(f"  取消后: 剩余{pkg_after_late.remaining_sessions}节")
        print(f"  is_before_cutoff={late_leave.is_before_cutoff}")
        print(f"  预约状态={appt_late.status.value}")
        
        assert late_leave.is_before_cutoff == False, "应该是超时取消"
        assert pkg_before_late.remaining_sessions - 1 == pkg_after_late.remaining_sessions, "超时取消应该扣课"
        test_results.append(("超时取消扣课", True))
        
        print("\n[测试9] 爽约 - 扣课")
        print("-" * 70)
        noshow_start = datetime.now() - timedelta(hours=3)
        noshow_end = noshow_start + timedelta(hours=1)
        appt_noshow = Appointment(
            member_id=member1.id, coach_id=coach.id, package_id=pkg.id,
            start_time=noshow_start, end_time=noshow_end,
            status=AppointmentStatus.PENDING, deduction_applied=False,
            request_id=req_id("appt_noshow")
        )
        db.add(appt_noshow)
        db.commit()
        
        pkg_before_noshow = db.query(Package).filter(Package.id == pkg.id).first()
        noshow = record_no_show(db, appt_noshow.id, req_id("noshow_req"), "会员未到")
        db.commit()
        pkg_after_noshow = db.query(Package).filter(Package.id == pkg.id).first()
        
        print(f"  记录前: 剩余{pkg_before_noshow.remaining_sessions}节")
        print(f"  记录后: 剩余{pkg_after_noshow.remaining_sessions}节")
        print(f"  预约状态={appt_noshow.status.value}")
        
        assert appt_noshow.status == AppointmentStatus.NO_SHOW
        assert pkg_before_noshow.remaining_sessions - 1 == pkg_after_noshow.remaining_sessions, "爽约应该扣课"
        test_results.append(("爽约扣课", True))
        
        print("\n[测试10] 课包转让")
        print("-" * 70)
        pkg_transfer = create_package(db, member1.id, coach.id, 10, today, expire, 3000.0)
        db.commit()
        
        print(f"  转让前:")
        print(f"    会员A课包剩余: {pkg_transfer.remaining_sessions}节")
        
        transfer = transfer_package(db, member1.id, member2.id, pkg_transfer.id, 3, req_id("transfer_req"))
        db.commit()
        
        pkg_transfer_after = db.query(Package).filter(Package.id == pkg_transfer.id).first()
        new_pkg = db.query(Package).filter(
            Package.member_id == member2.id,
            Package.id != pkg.id
        ).order_by(Package.id.desc()).first()
        
        print(f"  转让后:")
        print(f"    会员A课包剩余: {pkg_transfer_after.remaining_sessions}节 (原10节)")
        print(f"    会员B新课包: {new_pkg.remaining_sessions}节" if new_pkg else "    会员B新课包: 未找到")
        
        assert pkg_transfer_after.remaining_sessions == 7, f"预期7节，实际{pkg_transfer_after.remaining_sessions}"
        assert new_pkg is not None, "应该为转入会员创建新课包"
        assert new_pkg.remaining_sessions == 3, f"新课包应该有3节，实际{new_pkg.remaining_sessions}"
        test_results.append(("课包转让", True))
        
        print("\n[测试11] 状态历史追踪")
        print("-" * 70)
        histories = db.query(StatusHistory).filter(
            StatusHistory.entity_type == "appointment"
        ).all()
        print(f"✓ 共记录 {len(histories)} 条状态变更")
        for h in histories[-3:]:
            print(f"  - {h.action}: {h.from_status} → {h.to_status} | {h.reason}")
        assert len(histories) > 0, "应该有状态历史记录"
        test_results.append(("状态历史追踪", True))
        
        print("\n[测试12] 人工修正记录")
        print("-" * 70)
        correction = apply_manual_correction(
            db, "package", pkg.id,
            {"remaining_sessions": 20},
            "admin", "测试修正", req_id("manual_test")
        )
        db.commit()
        
        pkg_corrected = db.query(Package).filter(Package.id == pkg.id).first()
        print(f"  修正后剩余课时: {pkg_corrected.remaining_sessions}")
        print(f"  修正记录ID: {correction.id}")
        print(f"  操作者: {correction.operator}")
        print(f"  原因: {correction.reason}")
        
        assert pkg_corrected.remaining_sessions == 20
        test_results.append(("人工修正", True))
        
        print("\n" + "=" * 70)
        print("测试结果汇总")
        print("=" * 70)
        
        passed = sum(1 for _, result in test_results if result)
        total = len(test_results)
        
        for name, result in test_results:
            status = "✓ 通过" if result else "✗ 失败"
            print(f"  {name}: {status}")
        
        print("\n" + "=" * 70)
        print(f"总计: {passed}/{total} 测试通过")
        print("=" * 70)
        
        if passed == total:
            print("\n🎉 所有测试通过！系统业务闭环验证成功！")
            print("\n业务闭环验证摘要:")
            print("  1. 课包购买 ✓")
            print("  2. 预约创建 ✓")
            print("  3. 教练冲突检测 ✓")
            print("  4. 正常上课扣课 ✓")
            print("  5. 教练提成计算 ✓")
            print("  6. 提前请假不扣课 ✓")
            print("  7. 超时取消扣课 ✓")
            print("  8. 爽约扣课 ✓")
            print("  9. 课包转让 ✓")
            print("  10. 幂等性保障 ✓")
            print("  11. 状态追踪 ✓")
            print("  12. 人工修正 ✓")
        else:
            print(f"\n⚠️  {total - passed} 项测试失败，请检查代码")
        
        return passed == total
        
    except Exception as e:
        print(f"\n✗ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    import os
    if os.path.exists("fitness_system.db"):
        os.remove("fitness_system.db")
    
    success = test_full_system()
    exit(0 if success else 1)
