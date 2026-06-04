"""非交互式自动演示脚本 - 用于测试和CI"""

import json
import sys

from .models import RecordStatus
from .workflow import CISampleWorkflow
from demo_data.demo_dataset import (
    WEIGHT_TABLE_DATA,
    SAMPLE_RECORDS_DATA,
    OLD_FORMULA_SCREENSHOT_DATA,
)


def run_auto_demo(verbose: bool = True) -> dict:
    """
    非交互式运行完整演示流程
    返回执行结果摘要
    """
    if verbose:
        print("\n" + "=" * 80)
        print("  置信区间样本量试算 - 自动演示（非交互式）")
        print("=" * 80)

    wf = CISampleWorkflow()
    results = {"steps": [], "assertions": []}

    # ===== 第1步：导入评分权重表 =====
    if verbose:
        print("\n[第1步] 导入评分权重表...")
    weight_table = wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    results["steps"].append({"step": 1, "name": "导入评分权重表", "status": "success"})

    assert weight_table is not None, "评分权重表导入失败"
    assert len(weight_table.rules) == 4, f"规则数量应为4，实际{len(weight_table.rules)}"
    assert weight_table.is_active, "权重表未激活"
    results["assertions"].append({"step": 1, "passed": True, "msg": "权重表导入并激活成功"})

    if verbose:
        print(f"  ✅ 导入成功: {weight_table.name}, {len(weight_table.rules)}条规则")

    # ===== 第2步：导入样本记录并试算 =====
    if verbose:
        print("\n[第2步] 导入样本记录并试算...")
    records = wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    results["steps"].append({"step": 2, "name": "导入样本记录并试算", "status": "success"})

    assert len(records) == 3, f"记录数量应为3，实际{len(records)}"
    results["assertions"].append({"step": 2, "passed": True, "msg": "3条记录导入成功"})

    # 检查案例1: 顺利记录
    rec1 = wf.get_record("REC-2024-001")
    assert rec1 is not None, "REC-2024-001不存在"
    assert rec1.status == RecordStatus.NORMAL, f"REC-2024-001状态应为NORMAL，实际{rec1.status}"
    assert rec1.ci_lower > 0.85, f"REC-2024-001 CI下限应>0.85，实际{rec1.ci_lower}"
    assert not rec1.boundary_equal_to_threshold, "REC-2024-001不应标记为边界"
    results["assertions"].append({"step": 2, "passed": True, "msg": "案例1(顺利): NORMAL ✓"})

    # 检查案例2: 边界值记录 - 这是重点！
    rec2 = wf.get_record("REC-2024-002")
    assert rec2 is not None, "REC-2024-002不存在"
    assert rec2.status == RecordStatus.NEED_REVIEW, f"REC-2024-002状态应为NEED_REVIEW，实际{rec2.status}"
    assert rec2.boundary_equal_to_threshold, "REC-2024-002应标记为边界"
    assert abs(rec2.ci_lower - 0.626939526190) < 1e-9, f"CI下限应精确等于阈值"
    results["assertions"].append({"step": 2, "passed": True, "msg": "案例2(边界): NEED_REVIEW ⚠️ 边界值等于阈值，待任课老师复核 ✓"})

    # 检查案例3: 正常记录
    rec3 = wf.get_record("REC-2024-003")
    assert rec3 is not None, "REC-2024-003不存在"
    assert rec3.status == RecordStatus.NORMAL, f"REC-2024-003状态应为NORMAL，实际{rec3.status}"
    results["assertions"].append({"step": 2, "passed": True, "msg": "案例3(旧口径): NORMAL（新口径下正常）✓"})

    boundary_cases = wf.get_boundary_cases()
    assert len(boundary_cases) == 1, f"边界记录应为1，实际{len(boundary_cases)}"
    results["assertions"].append({"step": 2, "passed": True, "msg": "正确识别1条边界值记录"})

    if verbose:
        print(f"  ✅ 试算完成: {len(records)}条记录")
        print(f"  🚨 边界值待复核: {len(boundary_cases)} 条")
        for r in boundary_cases:
            print(f"     - {r.record_id}: {r.course_name}")
            print(f"       CI下限={r.ci_lower:.12f}, 阈值=0.626939526190")
            print(f"       差值={abs(r.ci_lower - 0.626939526190):.20f} (<1e-9 ✓)")

    # ===== 第3步：补录旧公式截图 =====
    if verbose:
        print("\n[第3步] 补录旧公式截图，反例列表自动更新...")

    before_ce_count = len(wf.get_counter_examples())
    assert before_ce_count == 0, f"补录前反例数量应为0，实际{before_ce_count}"

    counter_example, old_record = wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA,
        target_record_id="REC-2024-003",
    )
    results["steps"].append({"step": 3, "name": "补录旧公式截图", "status": "success"})

    after_ce_count = len(wf.get_counter_examples())
    assert after_ce_count == 1, f"补录后反例数量应为1，实际{after_ce_count}"
    results["assertions"].append({"step": 3, "passed": True, "msg": f"反例列表自动更新: {before_ce_count} → {after_ce_count} ✓"})

    assert counter_example is not None, "反例生成失败"
    assert counter_example.issue_type == "old_formula_abnormal", f"反例类型应为old_formula_abnormal"
    assert not counter_example.resolved, "反例初始状态应为未解决"
    results["assertions"].append({"step": 3, "passed": True, "msg": "反例生成成功，类型: old_formula_abnormal ✓"})

    assert old_record is not None, "旧口径记录生成失败"
    assert old_record.record_id == "REC-2024-003-old", "旧口径记录ID不正确"
    assert old_record.data_source.value == "old_formula", "数据来源应为old_formula"
    assert old_record.formula_version == "v1", "公式版本应为v1"
    assert old_record.status == RecordStatus.ABNORMAL, f"旧口径记录状态应为ABNORMAL"
    results["assertions"].append({"step": 3, "passed": True, "msg": "旧口径记录生成成功，状态: ABNORMAL ✓"})

    all_records = wf.get_all_records()
    assert len(all_records) == 4, f"总记录数应为4（3+1旧口径），实际{len(all_records)}"
    results["assertions"].append({"step": 3, "passed": True, "msg": "总记录数增长到4条 ✓"})

    if verbose:
        print(f"  ✅ 补录完成")
        print(f"  🔄 反例列表: {before_ce_count} → {after_ce_count} 条")
        print(f"  📋 新反例: {counter_example.case_id} - {counter_example.issue_type}")
        print(f"  📋 旧口径记录: {old_record.record_id} (状态: {old_record.status.value})")

    # ===== 第4步：人工修正边界案例 =====
    if verbose:
        print("\n[第4步] 人工修正边界案例...")

    # 保存修正前的复核备注，用于后续验证
    boundary_rec_before = wf.get_record("REC-2024-002")
    initial_review_note = boundary_rec_before.review_note

    fixed_rec = wf.manual_fix_record(
        record_id="REC-2024-002",
        operator="任课老师刘主任",
        new_status=RecordStatus.MANUAL_FIXED,
        note="2024期末考班级整体评分呈正态分布，中位数82分，确认教学效果达标",
    )
    results["steps"].append({"step": 4, "name": "人工修正边界案例", "status": "success"})

    assert fixed_rec.status == RecordStatus.MANUAL_FIXED, f"修正后状态应为MANUAL_FIXED"
    assert len(fixed_rec.fix_history) == 1, "修正历史应为1条"
    assert fixed_rec.fix_history[0]["operator"] == "任课老师刘主任"
    results["assertions"].append({"step": 4, "passed": True, "msg": "人工修正成功，状态: MANUAL_FIXED ✓"})

    if verbose:
        print(f"  ✅ 修正完成: REC-2024-002 → {fixed_rec.status.value}")
        print(f"     操作人: {fixed_rec.fix_history[0]['operator']}")

    # ===== 第5步：重跑旧口径记录 =====
    if verbose:
        print("\n[第5步] 重跑旧口径记录...")

    old_record.pass_count = 79
    old_record.pass_rate = 79 / 100

    rerun_rec = wf.rerun_single_record(
        record_id="REC-2024-003-old",
        operator="运营规划阿岚",
        note="修正统计口径错误，补录6名缓考通过学生后重跑",
    )
    results["steps"].append({"step": 5, "name": "重跑旧口径记录", "status": "success"})

    assert rerun_rec is not None, "重跑失败"
    assert rerun_rec.status in [RecordStatus.NORMAL, RecordStatus.RERUN], "重跑后状态不正确"
    results["assertions"].append({"step": 5, "passed": True, "msg": f"重跑成功，状态: {rerun_rec.status.value} ✓"})

    if verbose:
        print(f"  ✅ 重跑完成: REC-2024-003-old → {rerun_rec.status.value}")

    # ===== 最终验证 =====
    if verbose:
        print("\n" + "=" * 80)
        print("  最终结果验证")
        print("=" * 80)

    summary = wf.get_workflow_summary()
    results["summary"] = summary
    results["boundary_case_handled_correctly"] = True
    results["counter_example_updated"] = True
    results["three_different_results"] = True

    # 验证三种不同处理结果
    rec1_final = wf.get_record("REC-2024-001")
    rec2_final = wf.get_record("REC-2024-002")
    rec3_final = wf.get_record("REC-2024-003")
    rec3_old_final = wf.get_record("REC-2024-003-old")

    statuses = [
        rec1_final.status.value,
        rec2_final.status.value,
        rec3_final.status.value,
        rec3_old_final.status.value,
    ]

    # 必须包含三种不同的状态
    unique_statuses = set(statuses)
    assert len(unique_statuses) >= 3, f"三种处理结果应不同，实际状态: {statuses}"
    results["assertions"].append({"step": "final", "passed": True, "msg": f"三种不同处理结果验证通过: {unique_statuses} ✓"})

    # 边界值处理验证 - 核心需求！
    assert rec2_final.boundary_equal_to_threshold, "边界标记应永久保留"
    # 检查修正前的备注包含待复核信息
    assert "待任课老师复核" in initial_review_note, f"边界值初始备注不正确: {initial_review_note}"
    # 检查修正历史中保留了任课老师复核过程（操作人包含任课老师）
    has_review_history = any(
        "任课老师" in h.get("operator", "") or "任课老师" in h.get("note", "")
        for h in rec2_final.fix_history
    )
    assert has_review_history, "修正历史中应包含任课老师复核记录"
    results["assertions"].append({"step": "final", "passed": True, "msg": "边界值处理验证通过 ✓ （不自动归正常，留待任课老师复核，标记永久保留）"})

    if verbose:
        print(f"\n✅ 所有断言通过！共 {len(results['assertions'])} 项验证")
        print(f"\n📊 执行摘要:")
        print(json.dumps(summary, ensure_ascii=False, indent=2))

        print(f"\n📚 三种处理结果对比:")
        print(f"  REC-2024-001 (顺利): {rec1_final.status.value} → 直接通过")
        print(f"  REC-2024-002 (边界): {rec2_final.status.value} → 边界值等于阈值，待任课老师复核 → 人工修正")
        print(f"  REC-2024-003 (新口径): {rec3_final.status.value} → 新口径正常")
        print(f"  REC-2024-003-old (旧口径): {rec3_old_final.status.value} → 补录截图→生成反例→修正重跑")

    results["all_passed"] = all(a["passed"] for a in results["assertions"])
    return results


if __name__ == "__main__":
    try:
        results = run_auto_demo(verbose=True)
        if results["all_passed"]:
            print("\n" + "=" * 80)
            print("  🎉 自动演示成功！所有核心功能验证通过")
            print("=" * 80)
            sys.exit(0)
        else:
            print("\n❌ 部分验证未通过")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ 执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
