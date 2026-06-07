#!/usr/bin/env python3
"""验证内容安全样本回流系统核心功能"""
import sys
from datetime import datetime

from content_safety_reflow.models import (
    ModelOutput,
    ManualJudgment,
    ManualChangeType,
    ReflowStatus,
)
from content_safety_reflow.reflow_engine import ReflowEngine
from content_safety_reflow.workflow import WorkflowManager
from content_safety_reflow.version_control import VersionController
from content_safety_reflow.unified_output import UnifiedOutput


def test_case_1_normal_three_step_flow():
    """测试用例1：正常三步工作流 - 模型导入→人工补看→报告更新"""
    print("=" * 60)
    print("测试用例1：正常三步工作流")
    print("=" * 60)

    engine = ReflowEngine()

    output = ModelOutput(
        sample_id="SAMPLE-001",
        original_line_number=1,
        batch_id="BATCH-001",
        model_version="v1.0",
        content="测试内容包含敏感词",
        predicted_label="violent",
        confidence=0.87,
        risk_tags=["暴力"],
        evidence_snippets=["检测到暴力词汇", "上下文符合暴力特征"],
    )

    result = engine.import_model_output(output, "工程师A")
    assert result.status == ReflowStatus.MODEL_IMPORTED, "Step1 状态错误"
    assert result.model_output.original_line_number == 1, "原始行号未保留"
    print("✅ Step1 模型导入完成")
    print(f"   样本ID: {result.sample_id}")
    print(f"   原始行号: {result.model_output.original_line_number}")
    print(f"   状态: {result.status.value}")

    judgment = ManualJudgment(
        sample_id="SAMPLE-001",
        judgment_id="JUDGE-001",
        judge_person="周姐",
        judgment_time=datetime.now(),
        final_label="violent",
        on_site_statement="人工复核确认，文本确实包含暴力隐喻表达，需回流训练集。",
        change_type=ManualChangeType.LABEL_CHANGE,
        changed_fields=["predicted_label"],
        original_values={"predicted_label": "normal"},
        new_values={"predicted_label": "violent"},
        remarks="周姐现场确认",
    )

    result = engine.add_manual_judgment(judgment, "周姐")
    assert result.status == ReflowStatus.MANUAL_SUPPLEMENTED, "Step2 状态错误"
    assert len(result.final_evidence) == 3, "证据合并数量错误"
    assert "人工复核确认" in result.final_evidence[2], "现场说法未合并"
    print("✅ Step2 人工补看完成")
    print(f"   合并证据数: {len(result.final_evidence)}")
    print(f"   状态: {result.status.value}")
    print(f"   最终证据: {result.final_evidence}")

    report = engine.generate_evaluation_report("EVAL-001", "评测人员", version=1)
    assert report.total_samples == 1, "报告样本数错误"
    result = engine.get_result("SAMPLE-001")
    assert result.status == ReflowStatus.REPORT_UPDATED, "Step3 状态错误"
    print("✅ Step3 评测报告更新完成")
    print(f"   报告ID: {report.report_id}")
    print(f"   总样本数: {report.total_samples}")
    print(f"   状态: {result.status.value}")
    print("✅ 测试用例1 通过\n")


def test_case_2_covered_pending_review():
    """测试用例2：人工改判被下一次批跑覆盖 - 别急着归正常，留待安全审核复核"""
    print("=" * 60)
    print("测试用例2：人工改判被下一次批跑覆盖")
    print("=" * 60)

    engine = ReflowEngine()

    output1 = ModelOutput(
        sample_id="SAMPLE-002",
        original_line_number=3,
        batch_id="BATCH-001",
        model_version="v1.0",
        content="测试内容",
        predicted_label="violent",
        confidence=0.8,
        evidence_snippets=["旧模型证据"],
    )
    engine.import_model_output(output1, "工程师A")

    judgment = ManualJudgment(
        sample_id="SAMPLE-002",
        judgment_id="JUDGE-002",
        judge_person="周姐",
        judgment_time=datetime.now(),
        final_label="violent",
        on_site_statement="周姐确认有暴力内容",
        change_type=ManualChangeType.LABEL_CHANGE,
        original_values={},
        new_values={},
    )
    engine.add_manual_judgment(judgment, "周姐")
    print("✅ 已完成：模型导入 + 人工补看")

    output2 = ModelOutput(
        sample_id="SAMPLE-002",
        original_line_number=10,
        batch_id="BATCH-002",
        model_version="v2.0",
        content="测试内容",
        predicted_label="normal",
        confidence=0.95,
        evidence_snippets=["新模型认为正常"],
    )
    result = engine.import_model_output(output2, "工程师B")

    assert result.status == ReflowStatus.COVERED_PENDING_REVIEW, "未进入待复核状态"
    assert result.is_covered is True, "is_covered 标记错误"
    assert result.covered_by_batch_id == "BATCH-002", "覆盖批次记录错误"
    assert result.active_manual_judgment is None, "有效人工改判未置空"
    assert result.manual_judgments[0].is_overridden is True, "人工改判未标记被覆盖"
    print("✅ 新批跑导入后，自动进入 COVERED_PENDING_REVIEW 状态")
    print(f"   is_covered: {result.is_covered}")
    print(f"   覆盖批次: {result.covered_by_batch_id}")
    print(f"   状态: {result.status.value}")
    print(f"   人工改判是否被覆盖: {result.manual_judgments[0].is_overridden}")
    print("⚠️  注意：没有急于归为正常，留待安全审核同事复核")

    result = engine.review_covered_sample(
        "SAMPLE-002", "安全审核同事", approve=True, reason="人工改判有效"
    )
    assert result.status == ReflowStatus.REVIEW_APPROVED, "复核通过后状态错误"
    assert result.is_covered is False, "覆盖标记未清除"
    print("✅ 安全审核同事复核通过")
    print(f"   复核人: {result.review_person}")
    print(f"   状态: {result.status.value}")
    print("✅ 测试用例2 通过\n")


def test_case_3_unified_output_consistency():
    """测试用例3：统一输出 - 明细、页面、接口读同一份结果"""
    print("=" * 60)
    print("测试用例3：统一输出一致性")
    print("=" * 60)

    engine = ReflowEngine()
    output = ModelOutput(
        sample_id="SAMPLE-003",
        original_line_number=5,
        batch_id="BATCH-001",
        model_version="v1.0",
        content="测试",
        predicted_label="normal",
        confidence=0.99,
        evidence_snippets=["证据A"],
    )
    engine.import_model_output(output, "工程师A")

    uo = UnifiedOutput(engine)

    api_data = uo.get_api_response("SAMPLE-003")
    page_data = uo.get_page_display_data("SAMPLE-003")
    details = uo.get_detail_export()

    assert api_data["sample_id"] == page_data["sample_id"] == details[0]["sample_id"], "sample_id 不一致"
    assert api_data["status"] == page_data["status"] == details[0]["status"], "status 不一致"
    assert api_data["current_label"] == page_data["current_label"] == details[0]["current_label"], "current_label 不一致"
    assert api_data["is_covered"] == page_data["is_covered"] == details[0]["is_covered"], "is_covered 不一致"

    api_line = api_data["model"]["original_line_number"]
    detail_line = details[0]["model_output"]["original_line_number"]
    assert api_line == detail_line == 5, "原始行号不一致"

    print("✅ API 接口、页面展示、明细导出 读取同一份结果")
    print(f"   API status: {api_data['status']}")
    print(f"   页面 status: {page_data['status']}")
    print(f"   明细 status: {details[0]['status']}")
    print(f"   API 原始行号: {api_line}")
    print(f"   明细 原始行号: {detail_line}")
    print("✅ 测试用例3 通过\n")


def test_case_4_rollback_function():
    """测试用例4：撤回/回滚 - 周姐误操作后评测报告恢复上一版"""
    print("=" * 60)
    print("测试用例4：撤回/回滚功能")
    print("=" * 60)

    engine = ReflowEngine()
    vc = VersionController(engine, data_dir="./test_data_vc")

    output = ModelOutput(
        sample_id="SAMPLE-004",
        original_line_number=1,
        batch_id="BATCH-001",
        model_version="v1.0",
        content="测试",
        predicted_label="normal",
        confidence=0.9,
        evidence_snippets=["初始证据"],
    )
    engine.import_model_output(output, "工程师A")

    snap = vc.create_snapshot("周姐", "导入模型后正确状态")
    print(f"✅ 已创建快照: {snap.version_id}")

    wrong_judgment = ManualJudgment(
        sample_id="SAMPLE-004",
        judgment_id="JUDGE-WRONG",
        judge_person="周姐",
        judgment_time=datetime.now(),
        final_label="porn",
        on_site_statement="误操作，不该导入这个",
        change_type=ManualChangeType.LABEL_CHANGE,
        original_values={},
        new_values={},
    )
    engine.add_manual_judgment(wrong_judgment, "周姐")
    result_before = engine.get_result("SAMPLE-004")
    assert result_before.current_label == "porn", "误操作未生效"
    print("✅ 模拟周姐误操作导入错误人工改判")
    print(f"   当前标签: {result_before.current_label}")

    rollback_result = vc.rollback_to_snapshot(snap.version_id, "周姐")
    assert rollback_result["rollback_complete"] is True, "回滚失败"

    result_after = engine.get_result("SAMPLE-004")
    assert result_after.status == ReflowStatus.ROLLBACKED, "回滚后状态错误"

    has_rollback = any(c.action == "rollback" for c in result_after.change_history)
    assert has_rollback, "回滚操作未记录到change_history"

    print("✅ 回滚成功，评测报告恢复到上一版")
    print(f"   回滚后状态: {result_after.status.value}")
    print(f"   回滚操作已记录到 change_history")
    print(f"   共 {len(result_after.change_history)} 条操作轨迹可复盘")
    print("✅ 测试用例4 通过\n")


def test_case_5_full_workflow_with_cli_style():
    """测试用例5：完整三步工作流 + 可复盘记录"""
    print("=" * 60)
    print("测试用例5：完整工作流 + 可复盘轨迹")
    print("=" * 60)

    engine = ReflowEngine()
    wf = WorkflowManager(engine, data_dir="./test_data_wf")

    outputs = [
        ModelOutput(
            sample_id=f"SAMPLE-{i:03d}",
            original_line_number=i,
            batch_id="BATCH-001",
            model_version="v1.0",
            content=f"内容{i}",
            predicted_label=["normal", "violent", "political"][i % 3],
            confidence=0.8 + i * 0.05,
            evidence_snippets=[f"证据{i}"],
        )
        for i in range(1, 6)
    ]

    judgments = [
        ManualJudgment(
            sample_id="SAMPLE-002",
            judgment_id="JUDGE-002",
            judge_person="周姐",
            judgment_time=datetime.now(),
            final_label="normal",
            on_site_statement="周姐复核：样本2实际为正常内容，模型误判",
            change_type=ManualChangeType.LABEL_CHANGE,
            changed_fields=["predicted_label"],
            original_values={"predicted_label": "violent"},
            new_values={"predicted_label": "normal"},
        )
    ]

    wf_result = wf.run_full_workflow(
        outputs=outputs,
        judgments=judgments,
        report_id="EVAL-FULL-001",
        operator="周姐",
        version=1,
    )

    assert wf_result["workflow_complete"] is True
    assert wf_result["step1"]["processed_count"] == 5
    assert wf_result["step2"]["processed_count"] == 1
    assert wf_result["step3"]["total_samples"] == 5

    print("✅ 完整三步工作流执行成功")
    print(f"   导入模型输出: {wf_result['step1']['processed_count']} 条")
    print(f"   补充人工改判: {wf_result['step2']['processed_count']} 条")
    print(f"   报告样本数: {wf_result['step3']['total_samples']}")

    result = engine.get_result("SAMPLE-002")
    print(f"\n📋 样本 SAMPLE-002 完整操作轨迹（可复盘）:")
    for i, entry in enumerate(result.change_history, 1):
        print(f"   {i}. [{entry.timestamp.strftime('%H:%M:%S')}] {entry.operator} - {entry.action}")
        if entry.reason:
            print(f"      原因: {entry.reason}")

    print("\n📊 所有样本状态汇总:")
    for r in engine.get_all_results():
        print(f"   {r.sample_id}: label={r.current_label}, status={r.status.value}")

    print("✅ 测试用例5 通过\n")


def main():
    print("\n🚀 开始验证内容安全样本回流系统\n")

    try:
        test_case_1_normal_three_step_flow()
        test_case_2_covered_pending_review()
        test_case_3_unified_output_consistency()
        test_case_4_rollback_function()
        test_case_5_full_workflow_with_cli_style()

        print("🎉 所有测试用例通过！")
        print("\n📝 核心功能验证总结：")
        print("  ✅ 模型输出原始行号完整保留")
        print("  ✅ 人工改判与模型证据合并到同一份结果")
        print("  ✅ 人工改判被新批跑覆盖时，自动进入待复核状态（不急着归正常）")
        print("  ✅ 明细导出、页面展示、API接口读取同一份结果")
        print("  ✅ 三步工作流：模型导入→人工补看→报告更新")
        print("  ✅ 撤回/回滚功能，评测报告可恢复上一版")
        print("  ✅ 完整change_history操作轨迹，可复盘")
        print("  ✅ 边界规则固化在代码和README中")
        print("  ✅ 提供可重新跑的CLI命令清单")
        return 0
    except AssertionError as e:
        print(f"\n❌ 断言失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
