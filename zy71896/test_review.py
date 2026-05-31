import uuid
from datetime import datetime, timedelta
import sys

from models import (
    ElevatorAccelerationReview,
    ThresholdTable,
    MaintenanceOrder,
    VibrationCurve,
    VibrationPoint,
    ThresholdLevel,
    ConclusionType,
    DataSource,
    ChangeType,
)
from review_engine import ReviewEngine, calculate_curve_statistics, infer_level_from_acceleration
from report_generator import ReportGenerator


def create_test_points(max_accel: float, count: int = 10) -> list:
    points = []
    for i in range(count):
        t = i * 0.1
        a = max_accel * (0.3 + 0.7 * (i / count))
        points.append(VibrationPoint(timestamp=t, acceleration=a))
    return points


def test_scenario_1_normal_qualified():
    """场景1：正常流程，材料齐全，结论合格"""
    print("\n" + "=" * 70)
    print("🧪 场景1：正常流程，材料齐全，结论合格")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-001",
        created_at=datetime.now(),
    )

    threshold = ThresholdTable(
        id="TH-2024-001",
        elevator_id="EL-001",
        received_at=datetime.now(),
        level=ThresholdLevel.B,
        max_acceleration=1.0,
        min_acceleration=-1.0,
    )
    success, msg = engine.bind_threshold_table(review, threshold, operator="张工")
    print(f"✓ {msg}")

    maintenance = MaintenanceOrder(
        id="MO-2024-001",
        elevator_id="EL-001",
        received_at=datetime.now(),
        actual_max_acceleration=0.8,
        actual_min_acceleration=-0.7,
        operator="李工",
    )
    success, msg = engine.bind_maintenance_order(review, maintenance, operator="张工")
    print(f"✓ {msg}")

    curve = VibrationCurve(
        id="VC-2024-001",
        elevator_id="EL-001",
        measured_at=datetime.now(),
        points=create_test_points(0.8),
    )
    success, msg = engine.update_vibration_curve(review, curve, operator="王工")
    print(f"✓ {msg}")

    conclusion = engine.run_review(review)
    print(f"\n🎯 结论：{conclusion.conclusion_type.value}")
    print(f"📊 峰值加速度：{conclusion.max_acceleration:.3f} m/s²")
    print(f"📋 判断步骤数：{len(conclusion.judgment_steps)}")

    assert conclusion.conclusion_type == ConclusionType.QUALIFIED
    assert conclusion.final_level == ThresholdLevel.B

    report = ReportGenerator.generate_chief_report(review)
    print("\n📋 值班长报告摘要：")
    print(report.split("📌 快速摘要")[1].strip()[:300] + "...")

    print("✅ 场景1测试通过")
    return True


def test_scenario_2_threshold_first_maintenance_late():
    """场景2：阈值表早到，维修单晚补半天"""
    print("\n" + "=" * 70)
    print("🧪 场景2：阈值表早到，维修单晚补半天")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-002",
        created_at=datetime.now() - timedelta(hours=12),
    )

    threshold = ThresholdTable(
        id="TH-2024-002",
        elevator_id="EL-002",
        received_at=datetime.now() - timedelta(hours=12),
        level=ThresholdLevel.B,
        max_acceleration=1.0,
        min_acceleration=-1.0,
    )
    success, msg = engine.bind_threshold_table(review, threshold, operator="张工")
    print(f"✓ {msg}")

    curve = VibrationCurve(
        id="VC-2024-002",
        elevator_id="EL-002",
        measured_at=datetime.now() - timedelta(hours=10),
        points=create_test_points(0.9),
    )
    success, msg = engine.update_vibration_curve(review, curve, operator="王工")
    print(f"✓ {msg}")

    print("⏳ 先跑一次复核（缺维修单）...")
    conclusion1 = engine.run_review(review)
    print(f"   第一次结论：{conclusion1.conclusion_type.value}")
    print(f"   下一步：{conclusion1.next_action}")
    assert conclusion1.conclusion_type == ConclusionType.PENDING

    print("\n⏰ 半天后维修单到达，晚补...")
    maintenance = MaintenanceOrder(
        id="MO-2024-002",
        elevator_id="EL-002",
        received_at=datetime.now(),
        actual_max_acceleration=0.9,
        actual_min_acceleration=-0.8,
        operator="李工",
        is_late_supply=True,
    )
    success, msg = engine.bind_maintenance_order(review, maintenance, operator="张工")
    print(f"✓ {msg}")

    conclusion2 = engine.run_review(review)
    print(f"\n🎯 最终结论：{conclusion2.conclusion_type.value}")
    print(f"📊 峰值加速度：{conclusion2.max_acceleration:.3f} m/s²")

    assert conclusion2.conclusion_type == ConclusionType.QUALIFIED

    late_changes = [c for c in review.change_history if c.change_type == ChangeType.MAINTENANCE_SUPPLIED]
    assert len(late_changes) == 1
    print(f"📜 维修单晚补记录已留存：{late_changes[0].reason}")

    report = ReportGenerator.generate_chief_report(review)
    assert "维修单晚补" in report
    assert "仅补材料" in report

    print("\n📋 值班长报告快速摘要：")
    print(report.split("📌 快速摘要")[1].strip()[:300] + "...")

    print("✅ 场景2测试通过")
    return True


def test_scenario_3_cross_level_maintenance():
    """场景3：阈值跨档 - 维修单实测数据与阈值表档位不一致"""
    print("\n" + "=" * 70)
    print("🧪 场景3：阈值跨档 - 维修单实测与阈值表档位不一致")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-003",
        created_at=datetime.now(),
    )

    threshold = ThresholdTable(
        id="TH-2024-003",
        elevator_id="EL-003",
        received_at=datetime.now(),
        level=ThresholdLevel.B,
        max_acceleration=1.0,
        min_acceleration=-1.0,
    )
    success, msg = engine.bind_threshold_table(review, threshold, operator="张工")
    print(f"✓ {msg}")

    maintenance = MaintenanceOrder(
        id="MO-2024-003",
        elevator_id="EL-003",
        received_at=datetime.now(),
        actual_max_acceleration=1.3,
        actual_min_acceleration=-1.1,
        operator="李工",
    )
    success, msg = engine.bind_maintenance_order(review, maintenance, operator="张工")
    print(f"✓ {msg}")

    curve = VibrationCurve(
        id="VC-2024-003",
        elevator_id="EL-003",
        measured_at=datetime.now(),
        points=create_test_points(1.3),
    )
    success, msg = engine.update_vibration_curve(review, curve, operator="王工")
    print(f"✓ {msg}")

    conclusion = engine.run_review(review)
    print(f"\n🎯 结论：{conclusion.conclusion_type.value}")
    print(f"⚠️ 跨档来源：{conclusion.cross_level_source.value if conclusion.cross_level_source else '未知'}")
    print(f"📊 档位差异：{conclusion.cross_level_from.value if conclusion.cross_level_from else '?'}档 → {conclusion.cross_level_to.value if conclusion.cross_level_to else '?'}档")
    print(f"📝 下一步：{conclusion.next_action}")
    print(f"👤 责任人：{conclusion.next_owner}")

    assert conclusion.conclusion_type == ConclusionType.CROSS_LEVEL
    assert conclusion.cross_level_source == DataSource.MAINTENANCE_ORDER
    assert conclusion.cross_level_from == ThresholdLevel.B
    assert conclusion.cross_level_to == ThresholdLevel.C
    assert "维修班组" in conclusion.next_action
    assert conclusion.next_owner == "设备主管"

    cross_steps = [s for s in conclusion.judgment_steps if "阈值跨档" in s.judgment]
    assert len(cross_steps) > 0
    print(f"📋 跨档判断步骤已留存：{cross_steps[0].reason}")

    report = ReportGenerator.generate_chief_report(review)
    assert "阈值跨档" in report
    assert "设备主管" in report

    print("\n📋 值班长报告快速摘要：")
    print(report.split("📌 快速摘要")[1].strip()[:300] + "...")

    print("✅ 场景3测试通过")
    return True


def test_scenario_4_manual_curve_edit():
    """场景4：设备工程师手动修改振动曲线，历史留存"""
    print("\n" + "=" * 70)
    print("🧪 场景4：设备工程师手动修改振动曲线，历史留存")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-004",
        created_at=datetime.now(),
    )

    threshold = ThresholdTable(
        id="TH-2024-004",
        elevator_id="EL-004",
        received_at=datetime.now(),
        level=ThresholdLevel.A,
        max_acceleration=0.5,
        min_acceleration=-0.5,
    )
    engine.bind_threshold_table(review, threshold, operator="张工")

    maintenance = MaintenanceOrder(
        id="MO-2024-004",
        elevator_id="EL-004",
        received_at=datetime.now(),
        actual_max_acceleration=0.4,
        actual_min_acceleration=-0.3,
        operator="李工",
    )
    engine.bind_maintenance_order(review, maintenance, operator="张工")

    curve1 = VibrationCurve(
        id="VC-2024-004-v1",
        elevator_id="EL-004",
        measured_at=datetime.now() - timedelta(hours=2),
        points=create_test_points(0.7),
    )
    success, msg = engine.update_vibration_curve(review, curve1, operator="王工")
    print(f"✓ 初始曲线：{msg}")

    print("🔄 先跑一次复核...")
    conclusion1 = engine.run_review(review)
    print(f"   第一次结论：{conclusion1.conclusion_type.value}（峰值{conclusion1.max_acceleration:.3f}）")

    print("\n✏️ 设备工程师手动修改曲线，修正异常数据点...")
    curve2 = VibrationCurve(
        id="VC-2024-004-v2",
        elevator_id="EL-004",
        measured_at=datetime.now(),
        points=create_test_points(0.4),
        is_manually_edited=True,
        edited_by="赵工程师",
        edited_at=datetime.now(),
        edit_reason="修正第5个异常数据点，该点为传感器干扰导致",
    )
    success, msg = engine.update_vibration_curve(
        review, curve2,
        operator="赵工程师",
        edit_reason="修正第5个异常数据点，传感器干扰"
    )
    print(f"✓ {msg}")

    conclusion2 = engine.run_review(review)
    print(f"\n🎯 修改后结论：{conclusion2.conclusion_type.value}")
    print(f"📊 修改后峰值：{conclusion2.max_acceleration:.3f} m/s²")

    assert conclusion2.conclusion_type == ConclusionType.QUALIFIED
    assert review.vibration_curve.original_curve_id == curve1.id
    assert review.vibration_curve.is_manually_edited == True

    curve_changes = [c for c in review.change_history if c.change_type == ChangeType.CURVE_EDITED]
    assert len(curve_changes) == 1
    print(f"📜 曲线修改历史已留存：{curve_changes[0].old_value} → {curve_changes[0].new_value}")

    consistency_report = ReportGenerator.generate_inspection_consistency_report(review)
    print("\n🔍 巡检报告与明细一致性核对：")
    print(consistency_report[:400] + "...")
    assert "原始曲线ID" in consistency_report
    assert "人工修改" in consistency_report

    report = ReportGenerator.generate_chief_report(review)
    assert "振动曲线人工修改" in report
    assert "历史已留存" in report

    print("\n📋 值班长报告快速摘要：")
    print(report.split("📌 快速摘要")[1].strip()[:300] + "...")

    print("✅ 场景4测试通过")
    return True


def test_scenario_5_mixed_complex():
    """场景5：混合复杂场景 - 阈值表早到+维修单晚补+手动改曲线+跨档"""
    print("\n" + "=" * 70)
    print("🧪 场景5：混合复杂场景 - 阈值早到+维修晚补+手动改曲线+跨档")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-005",
        created_at=datetime.now() - timedelta(days=1),
    )

    print("[T-24h] 阈值表先到...")
    threshold = ThresholdTable(
        id="TH-2024-005",
        elevator_id="EL-005",
        received_at=datetime.now() - timedelta(hours=24),
        level=ThresholdLevel.B,
        max_acceleration=1.0,
        min_acceleration=-1.0,
    )
    engine.bind_threshold_table(review, threshold, operator="张工")

    print("[T-20h] 振动曲线到达，但数据异常...")
    curve1 = VibrationCurve(
        id="VC-2024-005-v1",
        elevator_id="EL-005",
        measured_at=datetime.now() - timedelta(hours=20),
        points=create_test_points(1.6),
    )
    engine.update_vibration_curve(review, curve1, operator="王工")

    print("[T-18h] 第一次复核（缺维修单+数据异常）...")
    conclusion1 = engine.run_review(review)
    print(f"      结论：{conclusion1.conclusion_type.value}")

    print("\n[T-12h] 设备工程师修正曲线异常数据...")
    curve2 = VibrationCurve(
        id="VC-2024-005-v2",
        elevator_id="EL-005",
        measured_at=datetime.now() - timedelta(hours=12),
        points=create_test_points(1.2),
        is_manually_edited=True,
        edited_by="赵工程师",
        edited_at=datetime.now() - timedelta(hours=12),
        edit_reason="剔除启动瞬间冲击数据",
    )
    engine.update_vibration_curve(
        review, curve2,
        operator="赵工程师",
        edit_reason="剔除启动瞬间冲击数据"
    )

    print("\n[T-0h] 维修单晚补24小时，数据与阈值跨档...")
    maintenance = MaintenanceOrder(
        id="MO-2024-005",
        elevator_id="EL-005",
        received_at=datetime.now(),
        actual_max_acceleration=1.2,
        actual_min_acceleration=-1.0,
        operator="李工",
        is_late_supply=True,
    )
    engine.bind_maintenance_order(review, maintenance, operator="张工")

    print("\n[最终] 执行复核...")
    conclusion_final = engine.run_review(review)

    print(f"\n🎯 最终结论：{conclusion_final.conclusion_type.value}")
    print(f"⚠️ 跨档情况：阈值表{conclusion_final.cross_level_from.value}档 → 实测{conclusion_final.cross_level_to.value}档")
    print(f"📝 下一步：{conclusion_final.next_action}")
    print(f"👤 责任人：{conclusion_final.next_owner}")

    assert conclusion_final.conclusion_type == ConclusionType.CROSS_LEVEL
    assert conclusion_final.cross_level_from == ThresholdLevel.B
    assert conclusion_final.cross_level_to == ThresholdLevel.C

    print(f"\n📜 变更历史共 {len(review.change_history)} 条：")
    material_count = 0
    concl_count = 0
    for change in review.change_history:
        if change.affects_conclusion or change.change_type in (ChangeType.CONCLUSION_CHANGED, ChangeType.CURVE_EDITED):
            concl_count += 1
            print(f"   🔴 {change.change_type.value}: {change.reason}（影响结论）")
        else:
            material_count += 1
            print(f"   📦 {change.change_type.value}: {change.reason}（仅补材料）")

    print(f"\n📊 统计：{material_count}项仅补材料，{concl_count}项影响结论")

    report = ReportGenerator.generate_chief_report(review)
    print("\n" + "=" * 70)
    print("📋 值班长报告（完整）")
    print("=" * 70)
    print(report)

    assert "维修单晚补" in report
    assert "振动曲线人工修改" in report
    assert "阈值跨档" in report
    assert "仅补材料" in report
    assert "影响结论" in report
    assert "设备主管" in report

    print("✅ 场景5测试通过")
    return True


def test_scenario_6_unqualified():
    """场景6：正常不合格（档位一致但实测超阈值表上限）"""
    print("\n" + "=" * 70)
    print("🧪 场景6：正常不合格（档位一致但实测超阈值表上限）")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-006",
        created_at=datetime.now(),
    )

    threshold = ThresholdTable(
        id="TH-2024-006",
        elevator_id="EL-006",
        received_at=datetime.now(),
        level=ThresholdLevel.B,
        max_acceleration=0.85,
        min_acceleration=-0.85,
    )
    engine.bind_threshold_table(review, threshold)

    maintenance = MaintenanceOrder(
        id="MO-2024-006",
        elevator_id="EL-006",
        received_at=datetime.now(),
        actual_max_acceleration=0.9,
        actual_min_acceleration=-0.88,
    )
    engine.bind_maintenance_order(review, maintenance)

    curve = VibrationCurve(
        id="VC-2024-006",
        elevator_id="EL-006",
        measured_at=datetime.now(),
        points=create_test_points(0.9),
    )
    engine.update_vibration_curve(review, curve)

    conclusion = engine.run_review(review)
    print(f"🎯 结论：{conclusion.conclusion_type.value}")
    print(f"📊 峰值：{conclusion.max_acceleration:.3f} m/s²（阈值表上限：{threshold.max_acceleration:.3f}）")
    threshold_level = threshold.level.value
    actual_level = infer_level_from_acceleration(conclusion.max_acceleration).value
    print(f"📊 档位：阈值表{threshold_level}档，实测{actual_level}档（档位{ '一致' if threshold_level == actual_level else '不一致' }）")

    assert conclusion.conclusion_type == ConclusionType.UNQUALIFIED
    assert conclusion.final_level == ThresholdLevel.B
    assert threshold_level == actual_level

    qualified_steps = [s for s in conclusion.judgment_steps if "加速度" in s.description and ("合格" in s.judgment or "不合格" in s.judgment)]
    assert len(qualified_steps) > 0
    print(f"📋 判断理由：{qualified_steps[0].reason}")

    report = ReportGenerator.generate_chief_report(review)
    assert "不合格" in report

    print("\n📋 值班长报告快速摘要：")
    print(report.split("📌 快速摘要")[1].strip()[:300] + "...")

    print("✅ 场景6测试通过")
    return True


def test_judgment_reasons_all_present():
    """验证：每一步判断都有理由留存"""
    print("\n" + "=" * 70)
    print("🧪 验证：每一步判断都有理由留存")
    print("=" * 70)

    engine = ReviewEngine()

    review = ElevatorAccelerationReview(
        id=str(uuid.uuid4()),
        elevator_id="EL-999",
        created_at=datetime.now(),
    )

    threshold = ThresholdTable(
        id="TH-999",
        elevator_id="EL-999",
        received_at=datetime.now(),
        level=ThresholdLevel.B,
        max_acceleration=1.0,
        min_acceleration=-1.0,
    )
    engine.bind_threshold_table(review, threshold)

    maintenance = MaintenanceOrder(
        id="MO-999",
        elevator_id="EL-999",
        received_at=datetime.now(),
        actual_max_acceleration=0.8,
    )
    engine.bind_maintenance_order(review, maintenance)

    curve = VibrationCurve(
        id="VC-999",
        elevator_id="EL-999",
        measured_at=datetime.now(),
        points=create_test_points(0.8),
    )
    engine.update_vibration_curve(review, curve)

    conclusion = engine.run_review(review)

    print(f"📋 共 {len(conclusion.judgment_steps)} 个判断步骤：")
    all_have_reason = True
    for step in conclusion.judgment_steps:
        has_reason = step.reason and len(step.reason) > 0
        has_evidence = step.evidence and len(step.evidence) > 0
        status = "✅" if has_reason and has_evidence else "❌"
        print(f"   {status} 步骤{step.step_order}: {step.description}")
        print(f"        判断：{step.judgment}")
        print(f"        理由：{step.reason[:50]}..." if len(step.reason) > 50 else f"        理由：{step.reason}")
        if not has_reason or not has_evidence:
            all_have_reason = False

    assert all_have_reason, "存在判断步骤缺少理由或证据"
    print("\n✅ 所有判断步骤都有完整的理由和证据留存")
    return True


def main():
    print("🚀 开始电梯加速度复核系统测试\n")

    tests = [
        test_scenario_1_normal_qualified,
        test_scenario_2_threshold_first_maintenance_late,
        test_scenario_3_cross_level_maintenance,
        test_scenario_4_manual_curve_edit,
        test_scenario_5_mixed_complex,
        test_scenario_6_unqualified,
        test_judgment_reasons_all_present,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            failed += 1
            print(f"\n❌ {test.__name__} 测试失败: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 70)
    print(f"📊 测试结果：{passed} 通过，{failed} 失败")
    print("=" * 70)

    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
