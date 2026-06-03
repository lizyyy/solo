#!/usr/bin/env python3
import os
import sys
import json
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dorm_allocator import DormAllocator, ReviewRole, RecordStatus


def run_full_demo():
    data_dir = "./demo_data/runtime"

    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)

    os.makedirs(data_dir, exist_ok=True)

    allocator = DormAllocator(data_dir=data_dir)

    print("=" * 80)
    print("第一步：旧公式截图第一次导入")
    print("=" * 80)

    with open("./demo_data/old_screenshot_data.json", "r", encoding="utf-8") as f:
        screenshot_data = json.load(f)

    run1_id = allocator.import_from_screenshot_data(
        screenshot_data=screenshot_data,
        operator="张助教",
        operator_role=ReviewRole.TEACHER,
        is_old_formula=True,
    )

    print(f"\n导入完成，运行ID: {run1_id}")
    print("\n导入后课堂演示结果（第一次导入，无批注）:")
    print("-" * 80)
    results = allocator.get_classroom_demo_results(run_id=run1_id)
    for r in results:
        has_issue = "问题" in r.status_explanation
        status_note = "⚠️ " if has_issue else "✅ "
        print(f"{status_note}{r.student_name}: {r.status}")
        print(f"   计算: {r.calculation} = '{r.result_display}'")
        if has_issue:
            print(f"   为何保留: {r.why_kept}")
            print(f"   下一步: {r.next_action}")

    print("\n" + "=" * 80)
    print("第二步：教研负责人吴老师补看老师批注")
    print("=" * 80)

    records = [r for r in allocator.records.values() if r.run_id == run1_id]

    print("\n[场景] 老师批注后来才补到群里，吴老师回看时发现...")
    print("\n--- 为所有记录补充老师批注 ---")
    for record in records:
        if record.student_name == "李华":
            ann_content = "李华同学情况特殊，优先级权重数据缺失，需要联系教务处核实原始数据。截图里确实是空的，不能直接照抄结论。"
        elif record.student_name == "赵伟":
            ann_content = "赵伟是转学生，入学数据还没同步完整。分母为0的情况需要等数据同步后再处理。"
        else:
            ann_content = f"{record.student_name}的数据与教务处记录一致，公式应用正确。"

        ann_id = allocator.add_annotation(
            record_id=record.id,
            content=ann_content,
            author_name="王老师",
            author_role=ReviewRole.TEACHER,
        )
        print(f"  + {record.student_name}: 批注已添加")

    print("\n--- 吴老师审核批注 ---")
    for record in records:
        allocator.review_record(
            record_id=record.id,
            reviewer_name="吴老师",
            reviewer_role=ReviewRole.TEACHING_RESEARCH_HEAD,
            review_note="已回看老师批注，确认教研流程合规。",
            new_status=RecordStatus.VERIFIED if not record.is_denominator_zero_issue else RecordStatus.NEEDS_CORRECTION,
        )
    print("  吴老师完成审核")

    print("\n批注后的课堂演示结果（更新了状态说明）:")
    print("-" * 80)
    results = allocator.get_classroom_demo_results(run_id=run1_id)
    for r in results:
        print(f"\n{r.student_name} → {r.assigned_dorm}")
        print(f"  状态: {r.status} - {r.status_explanation}")
        print(f"  为何保留: {r.why_kept}")
        print(f"  批注: {r.annotations_summary[0] if r.annotations_summary else '无'}")

    print("\n" + "=" * 80)
    print("第三步：数据复核人修正分母为0的问题")
    print("=" * 80)

    print("\n[场景] 数据复核人收到通知，核实后修正数据")
    for record in records:
        if record.is_denominator_zero_issue:
            if record.student_name == "李华":
                new_denom = 90
                note = "联系教务处核实，李华的优先级权重应为90"
            else:
                new_denom = 85
                note = "转学生数据已同步，赵伟的优先级权重为85"

            new_result = allocator.correct_denominator(
                record_id=record.id,
                new_denominator=new_denom,
                corrected_by="数据复核员小刘",
                correction_note=note,
            )
            print(f"  ✓ {record.student_name}: 分母修正为 {new_denom}，新结果 = {new_result:.2f}")

    print("\n" + "=" * 80)
    print("第四步：基于批注重跑（生成完整流程记录）")
    print("=" * 80)

    run2_id = allocator.rerun_with_annotations(
        previous_run_id=run1_id,
        operator="吴老师",
        operator_role=ReviewRole.TEACHING_RESEARCH_HEAD,
    )
    print(f"重跑完成，新运行ID: {run2_id}")

    print("\n" + "=" * 80)
    print("最终课堂演示结果")
    print("=" * 80)

    results = allocator.get_classroom_demo_results(run_id=run2_id)
    for i, r in enumerate(results, 1):
        status_icon = "✅" if r.status == "corrected" or r.status == "verified" else "⏳"
        print(f"\n{status_icon} 【记录 {i}】{r.student_name} → {r.assigned_dorm}")
        print(f"    公式: {r.formula_used}")
        print(f"    计算: {r.calculation} = {r.result_display}")
        print(f"    状态: {r.status} - {r.status_explanation}")
        print(f"    为何保留: {r.why_kept}")
        if r.missing_materials:
            print(f"    缺少材料: {', '.join(r.missing_materials)}")
        print(f"    下一步: {r.next_action}")
        print(f"    联系人: {r.next_contact}")
        if r.annotations_summary:
            print(f"    批注:")
            for ann in r.annotations_summary:
                print(f"      - {ann}")

    print("\n" + "=" * 80)
    print("生成复盘报告...")
    print("=" * 80)

    report = allocator.generate_review_report(run2_id)
    report_file = f"./demo_data/report_{run2_id}.json"
    with open(report_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"\n复盘报告已保存: {report_file}")
    print(f"\n报告摘要:")
    print(f"  总记录数: {report['total_records']}")
    print(f"  分母为0问题: {report['denominator_zero_issues']} (已全部修正)")
    print(f"  有批注记录: {report['records_with_annotations']}")
    print(f"\n  状态分布:")
    for status, count in report['status_summary'].items():
        if count > 0:
            print(f"    - {status}: {count}条")

    print("\n" + "=" * 80)
    print("演示完成！")
    print("=" * 80)
    print(f"\n运行ID供复盘:")
    print(f"  - 第一次导入（旧公式截图）: {run1_id}")
    print(f"  - 带批注重跑（完整流程）: {run2_id}")
    print(f"\n可使用以下命令重新查看:")
    print(f"  python -m dorm_allocator.cli --data-dir {data_dir} demo --run-id {run2_id}")
    print(f"  python -m dorm_allocator.cli --data-dir {data_dir} report {run2_id}")
    print(f"  python -m dorm_allocator.dashboard --data-dir {data_dir} --output demo_dashboard.html")

    return run1_id, run2_id, data_dir


if __name__ == "__main__":
    run_full_demo()
