"""直接运行测试，绕过 pytest 插件问题"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ci_sample_calc.models import RecordStatus, DataSource
from ci_sample_calc.workflow import CISampleWorkflow
from demo_data.demo_dataset import (
    WEIGHT_TABLE_DATA,
    SAMPLE_RECORDS_DATA,
    OLD_FORMULA_SCREENSHOT_DATA,
)


def run_all_tests():
    """运行所有端到端测试"""
    tests_passed = 0
    tests_failed = 0
    failures = []

    def test(name, condition, msg=""):
        nonlocal tests_passed, tests_failed, failures
        try:
            if condition:
                tests_passed += 1
                print(f"  ✅ {name}")
            else:
                tests_failed += 1
                failures.append((name, msg or "断言失败"))
                print(f"  ❌ {name}: {msg}")
        except Exception as e:
            tests_failed += 1
            failures.append((name, str(e)))
            print(f"  ❌ {name}: 异常 - {e}")

    print("\n" + "=" * 80)
    print("  运行端到端测试")
    print("=" * 80)

    # ===== 第1组测试：三步核心流程 =====
    print("\n【测试组1】三步核心流程")
    wf = CISampleWorkflow()

    # 第1步：导入评分权重表
    weight_table = wf.step1_import_weight_table(WEIGHT_TABLE_DATA)
    test("step1-1: 权重表导入成功", weight_table is not None)
    test("step1-2: 权重表名称正确", weight_table.name == "2024-2025学年第二学期评分权重表")
    test("step1-3: 规则数量正确", len(weight_table.rules) == 4)
    test("step1-4: 权重表已激活", weight_table.is_active is True)
    test("step1-5: 边界阈值精确值正确", abs(weight_table.rules[1].threshold - 0.626939526190) < 1e-12)

    # 第2步：导入样本记录并试算
    records = wf.step2_import_sample_records(SAMPLE_RECORDS_DATA)
    test("step2-1: 记录数量正确", len(records) == 3)

    # 案例1: 顺利记录
    rec1 = wf.get_record("REC-2024-001")
    test("step2-2: 顺利记录存在", rec1 is not None)
    test("step2-3: 顺利记录状态=NORMAL", rec1.status == RecordStatus.NORMAL)
    test("step2-4: 顺利记录CI下限>阈值", rec1.ci_lower > 0.85)
    test("step2-5: 顺利记录无边界标记", rec1.boundary_equal_to_threshold is False)

    # 案例2: 边界值记录 - 核心验证点！
    rec2 = wf.get_record("REC-2024-002")
    test("step2-6: 边界记录存在", rec2 is not None)
    test("step2-7: ⚠️  边界记录状态=NEED_REVIEW", rec2.status == RecordStatus.NEED_REVIEW)
    test("step2-8: ⚠️  边界记录有边界标记", rec2.boundary_equal_to_threshold is True)
    test("step2-9: ⚠️  CI下限精确等于阈值", abs(rec2.ci_lower - 0.626939526190) < 1e-9)
    test("step2-10: ⚠️  含待任课老师复核备注", "待任课老师复核" in rec2.review_note)
    test("step2-11: ⚠️  不自动归为NORMAL", rec2.status != RecordStatus.NORMAL)
    test("step2-12: ⚠️  不自动归为BOUNDARY", rec2.status != RecordStatus.BOUNDARY)

    # 案例3: 正常记录
    rec3 = wf.get_record("REC-2024-003")
    test("step2-13: 旧口径记录存在", rec3 is not None)
    test("step2-14: 旧口径记录状态=NORMAL", rec3.status == RecordStatus.NORMAL)

    # 边界案例列表
    boundary_cases = wf.get_boundary_cases()
    test("step2-15: 边界案例数量=1", len(boundary_cases) == 1)
    test("step2-16: 边界案例ID正确", boundary_cases[0].record_id == "REC-2024-002")

    # 第3步：补录旧公式截图
    before_ce = len(wf.get_counter_examples())
    before_records = len(wf.get_all_records())
    test("step3-1: 补录前反例数量=0", before_ce == 0)

    counter_example, old_record = wf.step3_process_old_formula_screenshot(
        OLD_FORMULA_SCREENSHOT_DATA, target_record_id="REC-2024-003"
    )
    after_ce = len(wf.get_counter_examples())
    after_records = len(wf.get_all_records())

    test("step3-2: 反例列表自动更新", after_ce == 1 and after_ce > before_ce)
    test("step3-3: 反例关联正确记录", counter_example.record_id == "REC-2024-003")
    test("step3-4: 反例类型正确", counter_example.issue_type == "old_formula_abnormal")
    test("step3-5: 反例公式版本=v1", counter_example.formula_version == "v1")
    test("step3-6: 反例状态=未解决", counter_example.resolved is False)
    test("step3-7: 旧口径记录ID正确", old_record.record_id == "REC-2024-003-old")
    test("step3-8: 旧口径数据源=old_formula", old_record.data_source == DataSource.OLD_FORMULA)
    test("step3-9: 旧口径公式版本=v1", old_record.formula_version == "v1")
    test("step3-10: 旧口径状态=ABNORMAL", old_record.status == RecordStatus.ABNORMAL)
    test("step3-11: 总记录数增长", after_records == 4 and after_records > before_records)

    # ===== 第2组测试：三种不同处理结果 =====
    print("\n【测试组2】三种不同处理结果")
    rec1_final = wf.get_record("REC-2024-001")
    rec2_final = wf.get_record("REC-2024-002")
    rec3_final = wf.get_record("REC-2024-003")
    rec3_old_final = wf.get_record("REC-2024-003-old")

    statuses = {
        rec1_final.status,
        rec2_final.status,
        rec3_old_final.status,
    }
    test("diff-1: 至少3种不同状态", len(statuses) >= 3)
    test("diff-2: 顺利记录=NORMAL", rec1_final.status == RecordStatus.NORMAL)
    test("diff-3: 边界记录=NEED_REVIEW", rec2_final.status == RecordStatus.NEED_REVIEW)
    test("diff-4: 旧口径记录=ABNORMAL", rec3_old_final.status == RecordStatus.ABNORMAL)

    # ===== 第3组测试：人工修正和重跑 =====
    print("\n【测试组3】人工修正和重跑流程")

    # 人工修正边界案例
    initial_review_note = rec2_final.review_note
    fixed_rec = wf.manual_fix_record(
        record_id="REC-2024-002",
        operator="任课老师刘主任",
        new_status=RecordStatus.MANUAL_FIXED,
        note="班级整体正态分布，确认教学效果达标",
    )
    test("fix-1: 修正后状态=MANUAL_FIXED", fixed_rec.status == RecordStatus.MANUAL_FIXED)
    test("fix-2: 修正历史数量=1", len(fixed_rec.fix_history) == 1)
    test("fix-3: 修正前状态=need_review", fixed_rec.fix_history[0]["before"] == "need_review")
    test("fix-4: 修正后状态=manual_fixed", fixed_rec.fix_history[0]["after"] == "manual_fixed")
    test("fix-5: 操作人正确", fixed_rec.fix_history[0]["operator"] == "任课老师刘主任")
    test("fix-6: 边界标记永久保留", fixed_rec.boundary_equal_to_threshold is True)
    test("fix-7: 初始备注含待复核", "待任课老师复核" in initial_review_note)

    # 重跑旧口径记录
    old_record_for_rerun = wf.get_record("REC-2024-003-old")
    old_record_for_rerun.pass_count = 79
    old_record_for_rerun.pass_rate = 79 / 100
    rerun_rec = wf.rerun_single_record(
        record_id="REC-2024-003-old",
        operator="运营规划阿岚",
        note="修正统计错误后重跑",
    )
    test("rerun-1: 重跑后状态=RERUN", rerun_rec.status == RecordStatus.RERUN)
    test("rerun-2: 公式版本更新为v2", rerun_rec.formula_version == "v2")
    test("rerun-3: 边界标记清除", rerun_rec.boundary_equal_to_threshold is False)
    test("rerun-4: 有修正历史", len(rerun_rec.fix_history) >= 1)

    # ===== 第4组测试：边界值处理细节 =====
    print("\n【测试组4】边界值处理细节验证")
    wf2 = CISampleWorkflow()
    wf2.step1_import_weight_table(WEIGHT_TABLE_DATA)
    boundary_only = [{
        "record_id": "TEST-BOUNDARY",
        "course_name": "测试边界课程",
        "teacher_name": "测试老师",
        "sample_size": 30,
        "pass_count": 24,
        "score": 80.0,
    }]
    result = wf2.step2_import_sample_records(boundary_only)
    test("boundary-1: 单条边界记录标记正确", result[0].boundary_equal_to_threshold is True)
    test("boundary-2: 状态=NEED_REVIEW", result[0].status == RecordStatus.NEED_REVIEW)
    test("boundary-3: 差值<1e-9", abs(result[0].ci_lower - 0.626939526190) < 1e-9)

    # 测试非边界值正常处理
    wf3 = CISampleWorkflow()
    wf3.step1_import_weight_table(WEIGHT_TABLE_DATA)
    normal_records = [
        {
            "record_id": "TEST-ABOVE",
            "course_name": "明显高于阈值",
            "teacher_name": "张老师",
            "sample_size": 100,
            "pass_count": 95,
            "score": 95.0,
        },
        {
            "record_id": "TEST-BELOW",
            "course_name": "明显低于阈值",
            "teacher_name": "李老师",
            "sample_size": 100,
            "pass_count": 50,
            "score": 65.0,
        },
    ]
    result2 = wf3.step2_import_sample_records(normal_records)
    test("boundary-4: 高于阈值=NORMAL", result2[0].status == RecordStatus.NORMAL)
    test("boundary-5: 高于阈值无边界标记", result2[0].boundary_equal_to_threshold is False)
    test("boundary-6: 低于阈值=ABNORMAL", result2[1].status == RecordStatus.ABNORMAL)
    test("boundary-7: 低于阈值无边界标记", result2[1].boundary_equal_to_threshold is False)

    # ===== 第5组测试：工作流摘要 =====
    print("\n【测试组5】工作流摘要")
    summary = wf.get_workflow_summary()
    test("summary-1: 总记录数=4", summary["total_records"] == 4)
    test("summary-2: 边界案例数=0(已修正)", summary["boundary_cases_count"] == 0)
    test("summary-3: 反例数=1", summary["counter_examples_count"] == 1)
    test("summary-4: 未解决反例=1", summary["unresolved_counter_examples"] == 1)
    test("summary-5: 工作流步骤>=3", summary["workflow_steps"] >= 3)
    test("summary-6: 激活权重表正确", summary["active_weight_table"] is not None)
    test("summary-7: 状态统计含normal", "normal" in summary["status_summary"])
    test("summary-8: 状态统计含manual_fixed", "manual_fixed" in summary["status_summary"])
    test("summary-9: 状态统计含rerun", "rerun" in summary["status_summary"])

    # ===== 总结 =====
    print("\n" + "=" * 80)
    print(f"  测试结果: {tests_passed} 通过, {tests_failed} 失败")
    print("=" * 80)

    if failures:
        print("\n❌ 失败详情:")
        for name, msg in failures:
            print(f"  - {name}: {msg}")
        return False
    else:
        print("\n🎉 所有测试通过！")
        return True


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
