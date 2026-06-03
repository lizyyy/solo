import argparse
import json
import sys
from pathlib import Path

from .core import DormAllocator
from .models import ReviewRole, RecordStatus


def cmd_import(args):
    allocator = DormAllocator(data_dir=args.data_dir)

    with open(args.input_file, "r", encoding="utf-8") as f:
        screenshot_data = json.load(f)

    run_id = allocator.import_from_screenshot_data(
        screenshot_data=screenshot_data,
        operator=args.operator,
        operator_role=ReviewRole(args.role),
        is_old_formula=not args.corrected,
    )
    print(f"导入完成，运行ID: {run_id}")

    run_log = allocator.get_run_log(run_id)
    if run_log and run_log.issues_found:
        print(f"\n发现 {len(run_log.issues_found)} 个问题:")
        for issue in run_log.issues_found:
            print(f"  - {issue}")


def cmd_add_annotation(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    ann_id = allocator.add_annotation(
        record_id=args.record_id,
        content=args.content,
        author_name=args.author,
        author_role=ReviewRole(args.role),
    )
    if ann_id:
        print(f"批注已添加，批注ID: {ann_id}")
    else:
        print(f"未找到记录: {args.record_id}")


def cmd_review(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    new_status = RecordStatus(args.status) if args.status else None
    success = allocator.review_record(
        record_id=args.record_id,
        reviewer_name=args.reviewer,
        reviewer_role=ReviewRole(args.role),
        review_note=args.note,
        new_status=new_status,
    )
    if success:
        print("复核完成")
    else:
        print(f"未找到记录: {args.record_id}")


def cmd_correct(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    result = allocator.correct_denominator(
        record_id=args.record_id,
        new_denominator=args.new_denominator,
        corrected_by=args.operator,
        correction_note=args.note,
    )
    if result is not None:
        print(f"修正完成，新结果: {result:.2f}")
    else:
        print(f"未找到记录: {args.record_id}")


def cmd_rerun(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    new_run_id = allocator.rerun_with_annotations(
        previous_run_id=args.prev_run_id,
        operator=args.operator,
        operator_role=ReviewRole(args.role),
    )
    print(f"重跑完成，新运行ID: {new_run_id}")


def cmd_demo(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    results = allocator.get_classroom_demo_results(run_id=args.run_id)

    print("\n" + "=" * 80)
    print("约束满足宿舍分配 - 课堂演示结果")
    print("=" * 80)

    for i, result in enumerate(results, 1):
        print(f"\n【记录 {i}】{result.student_name} → {result.assigned_dorm}")
        print("-" * 60)
        print(f"  公式: {result.formula_used}")
        print(f"  计算: {result.calculation} = {result.result_display}")
        print(f"  状态: {result.status} - {result.status_explanation}")
        print(f"  为何保留: {result.why_kept}")
        if result.missing_materials:
            print(f"  缺少材料: {', '.join(result.missing_materials)}")
        print(f"  下一步: {result.next_action}")
        print(f"  联系人: {result.next_contact}")
        if result.annotations_summary:
            print("  批注:")
            for ann in result.annotations_summary:
                print(f"    - {ann}")

    print("\n" + "=" * 80)


def cmd_report(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    report = allocator.generate_review_report(args.run_id)

    output_file = args.output or f"report_{args.run_id}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False, default=str)

    print(f"复盘报告已生成: {output_file}")
    print(f"\n摘要:")
    print(f"  总记录数: {report['total_records']}")
    print(f"  分母为0问题: {report['denominator_zero_issues']}")
    print(f"  已有批注记录: {report['records_with_annotations']}")


def cmd_list_runs(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    run_ids = allocator.list_run_ids()

    print("可用的运行ID:")
    for run_id in run_ids:
        log = allocator.get_run_log(run_id)
        if log:
            print(f"  - {run_id}: {log.run_type} ({log.operator}, {log.record_count}条记录)")


def cmd_show_record(args):
    allocator = DormAllocator(data_dir=args.data_dir)
    record = allocator.get_record(args.record_id)

    if record:
        print(json.dumps(record.model_dump(), indent=2, ensure_ascii=False, default=str))
    else:
        print(f"未找到记录: {args.record_id}")


def main():
    parser = argparse.ArgumentParser(description="约束满足宿舍分配系统")
    parser.add_argument("--data-dir", default="./data", help="数据目录")

    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="从截图数据导入")
    import_parser.add_argument("input_file", help="截图数据JSON文件")
    import_parser.add_argument("--operator", required=True, help="操作人")
    import_parser.add_argument("--role", required=True, choices=[r.value for r in ReviewRole], help="角色")
    import_parser.add_argument("--corrected", action="store_true", help="是否为修正后公式")

    ann_parser = subparsers.add_parser("annotate", help="添加批注")
    ann_parser.add_argument("record_id", help="记录ID")
    ann_parser.add_argument("content", help="批注内容")
    ann_parser.add_argument("--author", required=True, help="批注人")
    ann_parser.add_argument("--role", required=True, choices=[r.value for r in ReviewRole], help="角色")

    review_parser = subparsers.add_parser("review", help="复核记录")
    review_parser.add_argument("record_id", help="记录ID")
    review_parser.add_argument("note", help="复核意见")
    review_parser.add_argument("--reviewer", required=True, help="复核人")
    review_parser.add_argument("--role", required=True, choices=[r.value for r in ReviewRole], help="角色")
    review_parser.add_argument("--status", choices=[s.value for s in RecordStatus], help="新状态")

    correct_parser = subparsers.add_parser("correct", help="修正分母")
    correct_parser.add_argument("record_id", help="记录ID")
    correct_parser.add_argument("new_denominator", type=float, help="新分母值")
    correct_parser.add_argument("--operator", required=True, help="操作人")
    correct_parser.add_argument("--note", default="", help="修正说明")

    rerun_parser = subparsers.add_parser("rerun", help="带批注重跑")
    rerun_parser.add_argument("prev_run_id", help="上一次运行ID")
    rerun_parser.add_argument("--operator", required=True, help="操作人")
    rerun_parser.add_argument("--role", required=True, choices=[r.value for r in ReviewRole], help="角色")

    demo_parser = subparsers.add_parser("demo", help="展示课堂演示结果")
    demo_parser.add_argument("--run-id", help="指定运行ID")

    report_parser = subparsers.add_parser("report", help="生成复盘报告")
    report_parser.add_argument("run_id", help="运行ID")
    report_parser.add_argument("--output", help="输出文件")

    subparsers.add_parser("list-runs", help="列出所有运行")

    show_parser = subparsers.add_parser("show", help="查看记录详情")
    show_parser.add_argument("record_id", help="记录ID")

    args = parser.parse_args()

    if args.command == "import":
        cmd_import(args)
    elif args.command == "annotate":
        cmd_add_annotation(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "correct":
        cmd_correct(args)
    elif args.command == "rerun":
        cmd_rerun(args)
    elif args.command == "demo":
        cmd_demo(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "list-runs":
        cmd_list_runs(args)
    elif args.command == "show":
        cmd_show_record(args)


if __name__ == "__main__":
    main()
