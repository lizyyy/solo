import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import (
    QualificationRule, ApplicationRecord, FamilyMember,
    ApplicationStatus, ProcessingHistory
)
from app.services.verification_service import VerificationService
import app.services.lottery_service as lottery_module
LotteryService = lottery_module.LotteryService

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def test_full_flow():
    db = SessionLocal()

    print("=" * 60)
    print("测试 1: 创建资格规则")
    print("=" * 60)

    rule = QualificationRule(
        rule_name="2026年度公租房资格标准",
        rule_type="standard",
        description="人均月收入≤3000元，社保≥24个月，人均住房面积≤15㎡",
        min_income_threshold=0,
        max_income_threshold=3000,
        min_social_insurance_months=24,
        max_housing_area_per_person=15,
        max_family_housing_area=60,
        is_active=True
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    print(f"✓ 资格规则已创建: {rule.id} - {rule.rule_name}")

    print("\n" + "=" * 60)
    print("测试 2: 创建申请（合格情况）")
    print("=" * 60)

    app1 = ApplicationRecord(
        application_number="PRH20260001",
        applicant_name="张三",
        applicant_id_card="110101199001011234",
        contact_phone="13800138001",
        household_address="北京市朝阳区某某街道",
        applied_rule_id=rule.id
    )
    db.add(app1)
    db.flush()

    db.add(FamilyMember(
        application_record_id=app1.id,
        name="张三",
        id_card="110101199001011234",
        relation="本人",
        is_main_applicant=True,
        monthly_income=2500,
        social_insurance_months=36,
        housing_area_contribution=0
    ))
    db.add(FamilyMember(
        application_record_id=app1.id,
        name="李四",
        id_card="110101199202024321",
        relation="配偶",
        is_main_applicant=False,
        monthly_income=2000,
        social_insurance_months=24,
        housing_area_contribution=0
    ))
    db.commit()
    db.refresh(app1)
    print(f"✓ 申请已创建: {app1.application_number}")
    print(f"  家庭收入: 张三2500 + 李四2000 = 4500，人均 2250")
    print(f"  社保: 张三36个月，李四24个月")
    print(f"  住房: 0㎡")

    print("\n" + "=" * 60)
    print("测试 3: 核验申请（应通过）")
    print("=" * 60)

    passed, results = VerificationService.run_full_verification(db, app1, operator="test_user")
    print(f"核验结果: {'通过' if passed else '未通过'}")
    for r in results:
        print(f"  - {r['checkpoint']}: {'✓ 通过' if r['passed'] else '✗ 未通过'} - {r['message']}")

    db.refresh(app1)
    print(f"当前状态: {app1.current_status}")
    assert passed == True
    assert app1.current_status == ApplicationStatus.VERIFIED.value

    print("\n" + "=" * 60)
    print("测试 4: 创建申请（不合格情况 - 收入超标的）")
    print("=" * 60)

    app2 = ApplicationRecord(
        application_number="PRH20260002",
        applicant_name="王五",
        applicant_id_card="110101198505055678",
        contact_phone="13900139002",
        household_address="北京市海淀区某某街道",
        applied_rule_id=rule.id
    )
    db.add(app2)
    db.flush()

    db.add(FamilyMember(
        application_record_id=app2.id,
        name="王五",
        id_card="110101198505055678",
        relation="本人",
        is_main_applicant=True,
        monthly_income=5000,
        social_insurance_months=60,
        housing_area_contribution=0
    ))
    db.commit()
    db.refresh(app2)
    print(f"✓ 申请已创建: {app2.application_number}")
    print(f"  家庭收入: 王五5000，人均 5000（超过上限3000）")

    print("\n" + "=" * 60)
    print("测试 5: 核验申请（应拒绝，收入超标）")
    print("=" * 60)

    passed, results = VerificationService.run_full_verification(db, app2, operator="test_user")
    print(f"核验结果: {'通过' if passed else '未通过'}")
    for r in results:
        print(f"  - {r['checkpoint']}: {'✓ 通过' if r['passed'] else '✗ 未通过'} - {r['message']}")

    db.refresh(app2)
    print(f"当前状态: {app2.current_status}")
    print(f"当前卡点: {app2.current_checkpoint}")
    print(f"拒绝原因: {app2.rejection_reason}")
    assert passed == False
    assert app2.current_status == ApplicationStatus.REJECTED.value
    assert app2.current_checkpoint == "income_verification"

    print("\n" + "=" * 60)
    print("测试 6: 查看申请状态详情")
    print("=" * 60)

    detail = LotteryService.get_application_status_detail(db, app2.id)
    print(f"申请编号: {detail['application_number']}")
    print(f"当前状态: {detail['current_status']}")
    print(f"当前卡点: {detail['current_checkpoint']}")
    print(f"拒绝原因: {detail['rejection_reason']}")
    print(f"是否可重试: {detail['can_retry']}")
    print(f"重试建议: {detail['retry_suggestion']}")

    print("\n" + "=" * 60)
    print("测试 7: 查看处理历史")
    print("=" * 60)

    history = LotteryService.get_processing_history(db, app2.id)
    for h in history:
        print(f"  [{h.created_at.strftime('%H:%M:%S')}] {h.action}: {h.previous_status or '-'} → {h.new_status}")

    print("\n" + "=" * 60)
    print("测试 8: 修改收入后重试核验")
    print("=" * 60)

    member = db.query(FamilyMember).filter(
        FamilyMember.application_record_id == app2.id,
        FamilyMember.is_main_applicant == True
    ).first()
    member.monthly_income = 2800
    db.commit()
    print(f"已修改王五月收入从 5000 为 2800")

    passed, message = VerificationService.retry_verification(db, app2, operator="test_user")
    print(f"重试结果: {'通过' if passed else '未通过'} - {message}")

    db.refresh(app2)
    print(f"当前状态: {app2.current_status}")
    assert passed == True
    assert app2.current_status == ApplicationStatus.VERIFIED.value

    print("\n" + "=" * 60)
    print("测试 9: 创建摇号池")
    print("=" * 60)

    pool = LotteryService.create_lottery_pool(
        db,
        pool_id="POOL202601",
        pool_name="2026年第1批公租房摇号",
        lottery_year=2026,
        lottery_batch=1,
        total_quota=100
    )
    print(f"✓ 摇号池已创建: {pool.pool_id} - {pool.pool_name}")

    print("\n" + "=" * 60)
    print("测试 10: 锁定申请到摇号池")
    print("=" * 60)

    success, message = LotteryService.lock_for_lottery(db, app1, "POOL202601", operator="test_user")
    print(f"锁定申请1结果: {'成功' if success else '失败'} - {message}")
    db.refresh(app1)

    success, message = LotteryService.lock_for_lottery(db, app2, "POOL202601", operator="test_user")
    print(f"锁定申请2结果: {'成功' if success else '失败'} - {message}")
    db.refresh(app2)

    print(f"申请1状态: {app1.current_status}")
    print(f"申请2状态: {app2.current_status}")
    assert app1.current_status == ApplicationStatus.LOTTERY_LOCKED.value
    assert app2.current_status == ApplicationStatus.LOTTERY_LOCKED.value

    print("\n" + "=" * 60)
    print("测试 11: 开始公示期")
    print("=" * 60)

    success, message = LotteryService.start_public_announcement(db, "POOL202601", operator="test_user")
    print(f"公示开始: {'成功' if success else '失败'} - {message}")
    db.refresh(app1)
    db.refresh(app2)
    print(f"申请1状态: {app1.current_status}")
    print(f"申请2状态: {app2.current_status}")
    assert app1.current_status == ApplicationStatus.PUBLIC_ANNOUNCEMENT.value
    assert app2.current_status == ApplicationStatus.PUBLIC_ANNOUNCEMENT.value

    print("\n" + "=" * 60)
    print("测试 12: 提交公示异议")
    print("=" * 60)

    success, message, objection = LotteryService.submit_objection(
        db, app2.id,
        objector_name="赵六",
        objector_contact="13700137003",
        objection_content="申请人王五的收入证明材料涉嫌造假"
    )
    print(f"提交异议: {'成功' if success else '失败'} - {message}")
    db.refresh(app2)
    print(f"申请2状态: {app2.current_status}")
    assert app2.current_status == ApplicationStatus.OBJECTION_RAISED.value

    print("\n" + "=" * 60)
    print("测试 13: 处理异议（异议不成立）")
    print("=" * 60)

    success, message = LotteryService.handle_objection(
        db, objection.id,
        handling_remark="经核查，收入证明材料真实有效，异议不成立",
        handling_result="objection_dismissed",
        operator="audit_staff"
    )
    print(f"处理异议: {'成功' if success else '失败'} - {message}")
    db.refresh(app2)
    print(f"申请2状态: {app2.current_status}")
    assert app2.current_status == ApplicationStatus.OBJECTION_RESOLVED.value

    print("\n" + "=" * 60)
    print("测试 14: 确认最终结果")
    print("=" * 60)

    success, message, result = LotteryService.finalize_result(db, "POOL202601", operator="admin")
    print(f"确认结果: {'成功' if success else '失败'} - {message}")
    print(f"结果统计: {result}")
    db.refresh(app1)
    db.refresh(app2)
    print(f"申请1状态: {app1.current_status}, 最终结果: {app1.final_result}")
    print(f"申请2状态: {app2.current_status}, 最终结果: {app2.final_result}")
    assert app1.current_status == ApplicationStatus.FINAL_RESULT.value
    assert app2.current_status == ApplicationStatus.FINAL_RESULT.value

    print("\n" + "=" * 60)
    print("测试 15: 查看完整处理历史")
    print("=" * 60)

    history = LotteryService.get_processing_history(db, app2.id)
    print(f"\n申请 PRH20260002 完整处理历史:")
    for h in history:
        print(f"  [{h.created_at.strftime('%Y-%m-%d %H:%M:%S')}]")
        print(f"    操作: {h.action}")
        print(f"    状态变化: {h.previous_status or '-'} → {h.new_status}")
        print(f"    卡点: {h.checkpoint or '-'}")
        if h.remark:
            print(f"    备注: {h.remark}")

    print("\n" + "=" * 60)
    print("所有测试通过!")
    print("=" * 60)

    db.close()


if __name__ == "__main__":
    test_full_flow()
