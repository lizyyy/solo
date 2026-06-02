from datetime import datetime, timedelta
from storage import Storage
from models import InstitutionAlias, HolidayConfig, RecordStatus
from core import ReminderManager


def setup_demo_data():
    storage = Storage()
    manager = ReminderManager(storage)

    print("正在设置演示数据...")

    aliases = [
        InstitutionAlias(
            full_name="中国工商银行股份有限公司",
            aliases=["工行", "工商银行", "ICBC"],
            standard_alias="工商银行",
        ),
        InstitutionAlias(
            full_name="中国建设银行股份有限公司",
            aliases=["建行", "建设银行", "CCB"],
            standard_alias="建设银行",
        ),
        InstitutionAlias(
            full_name="中国银行股份有限公司",
            aliases=["中行", "中国银行", "BOC"],
            standard_alias="中国银行",
        ),
        InstitutionAlias(
            full_name="中国农业银行股份有限公司",
            aliases=["农行", "农业银行", "ABC"],
            standard_alias="农业银行",
        ),
        InstitutionAlias(
            full_name="招商银行股份有限公司",
            aliases=["招行", "招商银行", "CMB"],
            standard_alias="招商银行",
        ),
    ]
    storage.save_institution_aliases(aliases)
    print(f"✓ 已配置 {len(aliases)} 个机构简称映射")

    holidays = HolidayConfig(
        holiday_dates=[
            "2026-01-01",
            "2026-01-28",
            "2026-01-29",
            "2026-01-30",
            "2026-02-02",
            "2026-04-06",
            "2026-05-01",
            "2026-06-19",
            "2026-10-01",
            "2026-10-02",
            "2026-10-05",
            "2026-10-06",
            "2026-10-07",
        ],
        weekend_days=[5, 6],
    )
    storage.save_holiday_config(holidays)
    print(f"✓ 已配置 {len(holidays.holiday_dates)} 个节假日")

    manager.reload_configs()

    print("\n正在创建演示记录...")

    reminder1 = manager.import_reminder(
        bond_code="127123",
        bond_name="21国开01",
        institution_full_name="中国工商银行股份有限公司",
        institution_alias="工行",
        redemption_date="2026-06-19",
        exercise_amount=10000000.00,
        coupon_rate=3.25,
        source="柜台系统",
        import_batch="BATCH-2026-001",
        raw_data={
            "original_remark": "尾差0.58元，因四舍五入导致，已与对手方确认，详见20260615尾差调整说明.docx",
            "contact_person": "张经理",
            "contact_phone": "13800138000",
        },
        operator="财务复核人小王",
    )
    print(f"✓ 记录1 (ID: {reminder1.id}) - 节假日顺延场景，机构简称不一致")
    print(f"  - 原回售日: {reminder1.original_redemption_date} (端午节)")
    print(f"  - 顺延至: {reminder1.redemption_date}")
    print(f"  - 机构简称: '工行' vs 标准'工商银行'")
    print(f"  - 状态: {reminder1.status.value}")

    reminder2 = manager.import_reminder(
        bond_code="127456",
        bond_name="21国开05",
        institution_full_name="中国建设银行股份有限公司",
        institution_alias="建设银行",
        redemption_date="2026-07-15",
        exercise_amount=5000000.00,
        coupon_rate=3.45,
        source="柜台系统",
        import_batch="BATCH-2026-001",
        operator="财务复核人小王",
    )
    print(f"✓ 记录2 (ID: {reminder2.id}) - 正常记录，无异常")
    print(f"  - 回售日: {reminder2.redemption_date}")
    print(f"  - 状态: {reminder2.status.value}")

    reminder3 = manager.import_reminder(
        bond_code="127789",
        bond_name="20农发03",
        institution_full_name="中国银行股份有限公司",
        institution_alias="BOC",
        redemption_date="2026-08-20",
        exercise_amount=8000000.00,
        coupon_rate=3.15,
        source="网银系统",
        import_batch="BATCH-2026-001",
        operator="财务复核人小王",
    )
    print(f"✓ 记录3 (ID: {reminder3.id}) - 机构简称不一致场景")
    print(f"  - 机构简称: 'BOC' vs 标准'中国银行'")
    print(f"  - 状态: {reminder3.status.value}")

    print("\n--- 步骤1：节假日顺延说明第一次导入完成 ---")
    print(f"记录1的节假日顺延说明: {reminder1.holiday_adjustment_note}")

    print("\n--- 步骤2：财务复核人复核机构简称 ---")
    print(f"待财务复核记录数: {len(manager.get_pending_review_reminders())}")

    manager.resolve_alias_mismatch(
        reminder_id=reminder1.id,
        use_standard=True,
        confirmed_alias=None,
        reason="经核对工商登记信息，标准简称为'工商银行'，'工行'为非正式简称",
        operator="财务复核人小王",
    )
    print(f"✓ 记录1机构简称已复核，确认使用标准简称'工商银行'")

    manager.resolve_alias_mismatch(
        reminder_id=reminder3.id,
        use_standard=False,
        confirmed_alias="BOC",
        reason="对手方坚持使用BOC作为简称，已在合同中明确约定，保留使用BOC",
        operator="财务复核人小王",
    )
    print(f"✓ 记录3机构简称已复核，确认保留使用'BOC'")

    print(f"\n待财务复核记录数: {len(manager.get_pending_review_reminders())}")

    print("\n--- 步骤3：基金会计林姐补看尾差调整条 ---")
    print(f"记录1原始数据中的尾差备注: {reminder1.raw_data.get('original_remark', '无')}")

    tail1 = manager.add_tail_adjustment(
        reminder_id=reminder1.id,
        amount_diff=0.58,
        adjustment_reason="四舍五入尾差调整",
        remark="尾差0.58元，因四舍五入导致，已与对手方确认，详见20260615尾差调整说明.docx。此笔尾差不影响整体损益，属于正常计算差异。",
        operator="基金会计林姐",
    )
    print(f"✓ 记录1已补录尾差调整条 (ID: {tail1.id})")
    print(f"  - 差额: {tail1.amount_diff}元")
    print(f"  - 原因: {tail1.adjustment_reason}")
    print(f"  - 备注: {tail1.remark}")

    print("\n--- 步骤4：补录记录自动更新 ---")
    updated_reminder1 = manager.get_reminder_by_id(reminder1.id)
    if updated_reminder1 and updated_reminder1.supplementary_records:
        sup = updated_reminder1.supplementary_records[-1]
        print(f"【为什么留下】已更新为:")
        print(sup.why_kept)
        print(f"\n【还缺什么材料】已更新为:")
        print(sup.missing_materials)
        print(f"\n【下一步】已更新为: {sup.next_step.value}")
        print(f"\n【处理日志】:")
        print(sup.notes)

    print("\n--- 步骤5：人工修正演示 ---")
    manager.manual_correction(
        reminder_id=reminder2.id,
        field_name="coupon_rate",
        old_value=3.45,
        new_value=3.55,
        reason="发现票面利率录入错误，债券募集说明书显示为3.55%",
        operator="基金会计林姐",
        affected_results="票面利率由3.45%修正为3.55%，影响应计利息计算，需重新核对利息金额",
    )
    print(f"✓ 记录2已人工修正票面利率 3.45% → 3.55%")

    print("\n--- 步骤6：重跑演示 ---")
    manager.rerun_reminder(
        reminder_id=reminder1.id,
        reason="尾差调整后重新计算应计利息，确认数据一致性",
        operator="基金会计林姐",
    )
    print(f"✓ 记录1已人工重跑")

    print("\n--- 步骤7：转交林姐最终确认 ---")
    manager.send_to_linjie(
        reminder_id=reminder1.id,
        message="机构简称已复核，尾差调整条已补录，请林姐最终确认",
        operator="财务复核人小王",
    )
    print(f"✓ 记录1已转交林姐确认")

    manager.linjie_confirm(
        reminder_id=reminder1.id,
        confirmation="尾差调整合理，机构简称确认无误，数据核对完成，可以记账",
        operator="基金会计林姐",
    )
    print(f"✓ 记录1已由林姐确认完成")

    print("\n" + "=" * 60)
    print("演示数据设置完成！")
    print("=" * 60)

    reminders = manager.get_all_reminders()
    print(f"\n总记录数: {len(reminders)}")
    for r in reminders:
        print(f"\n  ID: {r.id} | {r.bond_code} {r.bond_name}")
        print(f"    机构: {r.institution_alias} | 状态: {r.status.value}")
        print(f"    尾差调整: {len(r.tail_adjustments)}条 | 补录记录: {len(r.supplementary_records)}条")
        print(f"    审计日志: {len(r.audit_logs)}条 | 导入次数: {r.import_count}")

    print("\n" + "=" * 60)
    print("典型场景覆盖:")
    print("=" * 60)
    print("  ✓ 节假日顺延（记录1: 2026-06-19端午节顺延）")
    print("  ✓ 机构简称不一致（记录1: 工行→工商银行）")
    print("  ✓ 机构简称保留特殊值（记录3: BOC）")
    print("  ✓ 尾差调整条补录及备注保留（记录1: 0.58元四舍五入）")
    print("  ✓ 补录记录联动更新（为什么留下、缺什么材料、下一步）")
    print("  ✓ 人工修正（记录2: 票面利率修正）")
    print("  ✓ 重跑（记录1: 尾差调整后重跑）")
    print("  ✓ 财务复核人→林姐流转（记录1完整流程）")
    print("  ✓ 完整审计追踪（所有操作均有日志）")
    print("  ✓ 人工判断空间（机构简称不自动修正，等待复核）")

    print("\n" + "=" * 60)
    print("现在可以运行:")
    print("  python cli.py report  # 查看完整核对报告")
    print("  python cli.py list    # 查看所有记录列表")
    print("  python app.py         # 启动Web小看板 (http://localhost:8000)")
    print("=" * 60)


if __name__ == "__main__":
    setup_demo_data()
