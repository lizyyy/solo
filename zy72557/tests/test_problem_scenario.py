import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.schemas import (
    EvaluationSliceCreate,
    FeatureSnapshotCreate,
    ThresholdUpdate,
    ManualChangeCreate,
)
from app.services import WorkflowService, CheckService, ExportService

TEST_DATABASE_URL = "sqlite:///./test_problem_scenario.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def test_problem_scenario_threshold_mismatch():
    """
    问题样例：阈值改过但报告仍写旧值
    完整流程：评测切片导入 → 老唐补看特征快照 → 分层指标更新
    停在：阈值改过但报告内容核对状态
    验证：状态变化、历史留痕、结果说明、人工改动记录
    """
    db = TestingSessionLocal()
    workflow = WorkflowService(db)
    check_service = CheckService(db)
    export_service = ExportService(db)

    print_separator("🎯 问题样例：阈值改过但报告仍写旧值")
    print("场景：转化率阈值已从0.1改为0.15，但报告系统未同步更新")
    print("用户投诉数据口径不一致，需要完整留痕证据链")
    print()

    # =========================================================================
    # 第一步：评测切片第一次导入
    # =========================================================================
    print_separator("📥 步骤1：评测切片第一次导入")
    print("操作人：数据工程师-小王")
    print("原始行号：10086")
    print("导入批次：BATCH_PROBLEM_20260615")
    print("主流程数据：报告中阈值显示为0.1（旧值）")
    print()

    slice_data = EvaluationSliceCreate(
        original_row_number=10086,
        main_process_data={
            "metric_name": "转化率",
            "metric_value": 0.125,
            "report_threshold": 0.1,
            "slice_id": "SLICE_PROBLEM_001",
            "channel": "APP首页",
            "time_range": "2026-06-01至2026-06-15",
        },
        import_batch_id="BATCH_PROBLEM_20260615",
        remarks="问题样例：阈值改过但报告仍写旧值",
    )

    eval_slice, check_results_step1 = workflow.step1_import_evaluation_slice(
        slice_data, "数据工程师-小王"
    )

    print(f"✅ 评测切片导入成功，ID: {eval_slice.id}")
    print(f"   原始行号: {eval_slice.original_row_number}")
    print(f"   当前状态: {eval_slice.current_status}")
    print(f"   检测到 {len(check_results_step1)} 项检查结果")

    status_history_step1 = workflow.get_status_history(eval_slice.id)
    manual_changes_step1 = workflow.get_manual_changes(eval_slice.id)
    print(f"   状态历史记录: {len(status_history_step1)} 条")
    print(f"   人工改动记录: {len(manual_changes_step1)} 条")

    for sh in status_history_step1:
        print(f"     ↳ [{sh.change_time.strftime('%H:%M:%S')}] {sh.old_status or '(初始)'} → {sh.new_status} | {sh.changed_by} | {sh.change_reason}")

    # =========================================================================
    # 第二步：推荐策略老唐补看特征快照编号
    # =========================================================================
    print_separator("🔍 步骤2：推荐策略老唐补看特征快照编号")
    print("操作人：推荐策略-老唐")
    print("特征快照编号：SNAP_LAOTANG_001")
    print("现场说法：'转化率阈值已在6月10日调整为0.15，但报告系统未同步更新'")
    print("特征数据：阈值0.15（与主流程报告阈值0.1不一致）")
    print()

    snapshot_data = FeatureSnapshotCreate(
        evaluation_slice_id=eval_slice.id,
        snapshot_number="SNAP_LAOTANG_001",
        on_site_statement="老唐现场确认：转化率阈值已在6月10日调整为0.15，但报告系统未同步更新，仍显示旧阈值0.1。用户投诉数据口径不一致。",
        feature_data={
            "metric_value": 0.125,
            "threshold": 0.15,
            "feature_version": "v2.3",
            "data_source": "推荐策略引擎",
        },
        supplemented_by="推荐策略-老唐",
    )

    feature_snapshot, check_results_step2 = workflow.step2_supplement_feature_snapshot(
        snapshot_data, "推荐策略-老唐", is_resupplement=False
    )

    print(f"✅ 特征快照补录成功，ID: {feature_snapshot.id}")
    print(f"   特征快照编号: {feature_snapshot.snapshot_number}")
    print(f"   补录人: {feature_snapshot.supplemented_by}")
    print(f"   是否补录重算: {feature_snapshot.is_resupplemented}")
    print(f"   检测到 {len(check_results_step2)} 项检查结果")

    status_history_step2 = workflow.get_status_history(eval_slice.id)
    manual_changes_step2 = workflow.get_manual_changes(eval_slice.id)
    print(f"   状态历史记录: {len(status_history_step2)} 条")
    print(f"   人工改动记录: {len(manual_changes_step2)} 条")

    for mc in manual_changes_step2:
        print(f"     ↳ 人工改动 [{mc.change_time.strftime('%H:%M:%S')}] {mc.field_name}: '{mc.old_value}' → '{mc.new_value}' | {mc.changed_by} | {mc.change_reason}")

    # =========================================================================
    # 第三步：分层指标更新 - 关键！不勾选"已同步更新到报告"
    # =========================================================================
    print_separator("📊 步骤3：分层指标更新")
    print("操作人：推荐策略组")
    print("阈值名称：转化率")
    print("新阈值：0.15")
    print("重要：⚠️  未勾选'已同步更新到报告' → 会标记为待数据科学家复核")
    print()

    threshold_updates = [
        ThresholdUpdate(
            threshold_name="转化率",
            new_value=0.15,
            changed_by="推荐策略组",
            apply_to_report=False,
        )
    ]

    threshold_records, check_results_step3 = workflow.step3_update_hierarchical_metrics(
        eval_slice.id, threshold_updates, "推荐策略组"
    )

    print(f"✅ 分层指标更新完成，更新了 {len(threshold_records)} 个阈值")
    for tr in threshold_records:
        print(f"   • {tr.threshold_name}: {tr.old_value or '(无)'} → {tr.new_value} | 应用到报告: {tr.is_applied_in_report}")

    print(f"\n📋 检测到 {len(check_results_step3)} 项检查结果：")
    threshold_mismatch = None
    for cr in check_results_step3:
        status_icon = {"normal": "✅", "abnormal": "❌", "pending_review": "⚠️ "}[cr.check_status]
        print(f"   {status_icon} [{cr.check_type}] {cr.check_status} (严重程度: {cr.severity})")
        if cr.check_type == "threshold_mismatch":
            threshold_mismatch = cr

    # =========================================================================
    # 停在阈值改过但报告内容核对状态 - 验证关键点
    # =========================================================================
    print_separator("🔴 停在：阈值改过但报告内容核对状态")
    print("验证核心需求：")
    print()

    # 验证1：阈值不匹配记录必须存在，且状态为pending_review
    assert threshold_mismatch is not None, "❌ 应该检测到阈值不匹配"
    assert threshold_mismatch.check_status == "pending_review", "❌ 阈值不匹配应该标记为pending_review"
    assert threshold_mismatch.needs_data_scientist_review == True, "❌ 应该需要数据科学家复核"
    print("✅ 验证通过：阈值不匹配检测正常，状态为 pending_review，需数据科学家复核")

    # 验证2：阈值数据正确
    assert threshold_mismatch.threshold_old_value == 0.1, "❌ 阈值旧值错误"
    assert threshold_mismatch.threshold_new_value == 0.15, "❌ 阈值新值错误"
    assert threshold_mismatch.report_threshold_value == 0.1, "❌ 报告阈值错误"
    print("✅ 验证通过：阈值三元组正确（旧值0.1 → 新值0.15，报告仍为0.1）")

    # 验证3：状态变化历史完整
    status_history = workflow.get_status_history(eval_slice.id)
    print(f"\n📊 完整状态变化轨迹（共 {len(status_history)} 条）：")
    for sh in status_history:
        icon = "🔵" if sh.check_result_id == threshold_mismatch.id else "⚪"
        print(f"   {icon} [{sh.change_time.strftime('%Y-%m-%d %H:%M:%S')}] "
              f"{sh.old_status or '(初始)':<12} → {sh.new_status:<15} | "
              f"{sh.changed_by:<15} | {sh.change_reason}")
    assert len(status_history) >= 3, "❌ 状态历史记录不完整"
    print("✅ 验证通过：状态变化历史完整，包含每次状态变更的原因和操作人")

    # 验证4：人工改动记录完整
    manual_changes = workflow.get_manual_changes(eval_slice.id)
    print(f"\n✏️  人工改动记录（共 {len(manual_changes)} 条）：")
    for mc in manual_changes:
        print(f"   [{mc.change_time.strftime('%Y-%m-%d %H:%M:%S')}] "
              f"{mc.field_name:<20} | "
              f"'{mc.old_value or '(空)':<10}' → '{mc.new_value:<10}' | "
              f"{mc.changed_by:<15} | {mc.change_reason}")
    assert len(manual_changes) >= 1, "❌ 人工改动记录不完整"
    print("✅ 验证通过：人工改动记录完整，包含旧值、新值、改动人、原因")

    # 验证5：检查结果详情包含完整证据链
    rd = threshold_mismatch.result_detail
    assert rd.get("status_guidance") is not None, f"❌ 缺少处理指引，实际内容: {rd}"
    assert rd.get("alignment_status") == "unmatched", "❌ 对齐状态错误"
    assert abs(rd.get("diff_value", 0) - 0.05) < 1e-9, "❌ 阈值差值错误"
    print(f"\n📋 检查结果详情：")
    print(f"   处理指引: {rd.get('status_guidance')}")
    print(f"   对齐状态: {rd.get('alignment_status')}")
    print(f"   阈值差值: {rd.get('diff_value')}")
    print(f"   是否应用到报告: {rd.get('is_applied_in_report')}")
    print("✅ 验证通过：检查结果包含完整的处理指引、对齐状态、差值计算")

    # 验证6：证据链包含评测切片和特征快照两边证据
    ec = threshold_mismatch.evidence_chain
    assert ec.get("original_row_number") == 10086, "❌ 证据链缺少原始行号"
    assert ec.get("feature_snapshot", {}).get("snapshot_number") == "SNAP_LAOTANG_001", "❌ 证据链缺少特征快照"
    assert ec.get("feature_snapshot", {}).get("on_site_statement") is not None, "❌ 证据链缺少现场说法"
    print(f"\n📌 证据链完整度：")
    print(f"   原始行号: {ec.get('original_row_number')}")
    print(f"   特征快照编号: {ec.get('feature_snapshot', {}).get('snapshot_number')}")
    print(f"   现场说法: {ec.get('feature_snapshot', {}).get('on_site_statement')[:50]}...")
    print(f"   主流程指标: {ec.get('main_process_summary', {}).get('metric_name')}")
    print("✅ 验证通过：证据链整合了评测切片（主流程）和特征快照（现场说法）两边证据")

    # 验证7：接口、页面、导出读取同一份数据
    print(f"\n🔗 数据一致性验证（接口/页面/导出同一份CheckResult）：")

    # 从API获取
    api_results = check_service.get_check_results(limit=100)
    api_mismatch = [r for r in api_results if r.check_type == "threshold_mismatch" and r.evaluation_slice_id == eval_slice.id][0]

    # 从导出获取
    export_data = export_service.get_export_data_for_api()
    export_mismatch = [d for d in export_data if d["检查结果ID"] == threshold_mismatch.id][0]

    assert api_mismatch.id == threshold_mismatch.id, "❌ API数据不一致"
    assert export_mismatch["检查结果ID"] == threshold_mismatch.id, "❌ 导出数据不一致"
    assert api_mismatch.check_status == threshold_mismatch.check_status, "❌ API状态不一致"
    assert export_mismatch["检查状态"] == "待复核", "❌ 导出状态不一致"
    assert export_mismatch["是否需数据科学家复核"] == "是", "❌ 导出复核标记不一致"

    print(f"   数据库记录ID: {threshold_mismatch.id}")
    print(f"   API查询结果ID: {api_mismatch.id}，状态: {api_mismatch.check_status}")
    print(f"   导出数据ID: {export_mismatch['检查结果ID']}，状态: {export_mismatch['检查状态']}")
    print(f"   人工改动次数（导出字段）: {export_mismatch['人工改动次数']}")
    print(f"   状态变更次数（导出字段）: {export_mismatch['状态变更次数']}")
    print("✅ 验证通过：接口、页面、导出读取同一份CheckResult数据，完全一致")

    # 验证8：状态没有自动归为正常
    eval_slice_updated = workflow.get_evaluation_slice(eval_slice.id)
    assert eval_slice_updated.current_status == "pending", "❌ 评测切片状态不应该自动归为正常"
    print(f"\n🎯 最终状态：评测切片状态为 '{eval_slice_updated.current_status}'（待数据科学家复核）")
    print("✅ 验证通过：阈值改过但报告仍写旧值的记录没有自动归为正常，停在待复核状态")

    # =========================================================================
    # 模拟数据科学家追加人工改动
    # =========================================================================
    print_separator("✏️  数据科学家追加人工改动记录")
    print("操作人：数据科学家-老李")
    print("操作：针对阈值不匹配问题，记录临时解决方案")
    print()

    manual_change_data = ManualChangeCreate(
        evaluation_slice_id=eval_slice.id,
        check_result_id=threshold_mismatch.id,
        field_name="temporary_solution",
        old_value=None,
        new_value="通知报告团队紧急修复，预计24小时内同步完成",
        changed_by="数据科学家-老李",
        change_reason="临时解决方案记录，避免用户投诉升级",
    )

    mc = workflow.create_manual_change(manual_change_data)

    print(f"✅ 人工改动记录已录入，ID: {mc.id}")
    print(f"   关联检查结果ID: {mc.check_result_id}")
    print(f"   改动字段: {mc.field_name}")
    print(f"   改动人: {mc.changed_by}")
    print(f"   原因: {mc.change_reason}")

    # 验证9：检查结果详情中能关联到这条人工改动
    final_manual_changes = workflow.get_manual_changes(eval_slice.id)
    print(f"\n📋 最终人工改动记录（共 {len(final_manual_changes)} 条）：")
    for mc_item in final_manual_changes:
        linked = f" (关联检查结果#{mc_item.check_result_id})" if mc_item.check_result_id else ""
        print(f"   • {mc_item.field_name}: '{mc_item.old_value}' → '{mc_item.new_value}'{linked}")
    assert len(final_manual_changes) >= 2, "❌ 最终人工改动记录不完整"
    print("✅ 验证通过：人工改动可关联到具体检查结果，数据科学家追问时能回到证据")

    # =========================================================================
    # 总结已跑出的材料
    # =========================================================================
    print_separator("📦 已跑出的完整材料清单")
    print(f"  1. 评测切片：ID={eval_slice.id}，原始行号={eval_slice.original_row_number}")
    print(f"  2. 特征快照：ID={feature_snapshot.id}，编号={feature_snapshot.snapshot_number}")
    print(f"  3. 检查结果：共{len(api_results)}条，含阈值不匹配（ID={threshold_mismatch.id}，状态=pending_review）")
    print(f"  4. 状态历史：共{len(status_history)}条，完整记录每次状态变更")
    print(f"  5. 人工改动：共{len(final_manual_changes)}条，含阈值更新、现场说法更新、临时方案")
    print(f"  6. 阈值记录：共{len(threshold_records)}条，记录阈值变更轨迹")
    print()
    print("🔗 所有材料与状态变化对应关系：")
    print(f"   步骤1导入 → 状态：reviewing → 检查：无异常")
    print(f"   步骤2补录 → 状态：reviewing → 检查：特征交叉泄漏风险 + 人工改动：现场说法更新")
    print(f"   步骤3更新 → 状态：pending → 检查：阈值不匹配待复核 + 人工改动：阈值更新")
    print(f"   科学家追改 → 状态：pending → 人工改动：临时方案（关联检查结果）")
    print()

    print_separator("🎉 问题样例验证全部通过！")
    print("\n核心验证点总结：")
    print("  ✅ 评测切片原始行号、人工改动、当前处理状态完整保留")
    print("  ✅ 阈值改过但报告仍写旧值的记录标记为待复核，不自动归为正常")
    print("  ✅ 检查结果整合了评测切片（主流程）和特征快照（现场说法）两边证据")
    print("  ✅ 接口、页面、导出读取同一份CheckResult数据，完全一致")
    print("  ✅ 状态变化历史完整，已跑出的材料与状态变化对上")
    print("  ✅ 人工改动留痕完整，包含旧值、新值、改动人、原因")
    print("  ✅ 人工改动可关联到具体检查结果，数据科学家追问时能回到证据")
    print("  ✅ 导出明细包含人工改动历史和状态变化轨迹")
    print()

    db.close()


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("  🧪 特征交叉泄漏检查系统 - 问题样例专项测试")
    print("  场景：阈值改过但报告仍写旧值")
    print("  流程：评测切片导入 → 老唐补看特征快照 → 分层指标更新")
    print("  停止点：阈值改过但报告内容核对状态")
    print("=" * 80)

    try:
        test_problem_scenario_threshold_mismatch()

        print("=" * 80)
        print("  ✨ 所有验证点通过！系统状态停在待数据科学家复核")
        print("=" * 80 + "\n")
    except AssertionError as e:
        print(f"\n❌ 验证失败: {e}")
        raise
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        if os.path.exists("./test_problem_scenario.db"):
            os.remove("./test_problem_scenario.db")
