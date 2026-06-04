"""命令行入口"""
import argparse
import os
import sys
from .processor import (
    import_segments_from_csv,
    load_project,
    supplement_questionnaire_row,
    review_gap,
    generate_report,
)


def cmd_import(args):
    """导入数据"""
    print(f"正在导入 {args.input} ...")
    project = import_segments_from_csv(args.input, args.name)
    output_path = args.output or f"{args.name}.json"
    project.save(output_path)
    print(f"✓ 导入完成，项目已保存至: {output_path}")
    print(f"  - 线段总数: {len(project.segments)}")
    print(f"  - 检测冲突: {len(project.conflicts)}")
    print(f"  - 编号断档: {len(project.gaps)}")
    if args.report:
        report_path = args.report or f"{args.name}_report.txt"
        generate_report(project, report_path)
        print(f"✓ 报告已生成: {report_path}")


def cmd_supplement(args):
    """补录问卷原始行"""
    print(f"正在加载项目 {args.project} ...")
    project = load_project(args.project)
    project = supplement_questionnaire_row(
        project, args.segment_id, args.questionnaire_row
    )
    project.save(args.project)
    print(f"✓ 线段 {args.segment_id} 已补录问卷原始行: {args.questionnaire_row}")
    if args.report:
        report_path = args.report
        generate_report(project, report_path)
        print(f"✓ 更新报告已生成: {report_path}")


def cmd_review(args):
    """教研组复核断档"""
    print(f"正在加载项目 {args.project} ...")
    project = load_project(args.project)
    project = review_gap(
        project,
        args.gap_index,
        args.approved,
        args.note,
    )
    project.save(args.project)
    status = "通过" if args.approved else "驳回"
    print(f"✓ 断档 {args.gap_index} 复核{status}: {args.note}")


def cmd_report(args):
    """生成报告"""
    print(f"正在生成报告 ...")
    project = load_project(args.project)
    generate_report(project, args.output)
    print(f"✓ 报告已生成: {args.output}")


def cmd_status(args):
    """查看项目状态"""
    project = load_project(args.project)
    active = [s for s in project.segments if not s.is_deleted]
    deleted = [s for s in project.segments if s.is_deleted]
    pending_gaps = [g for g in project.gaps if g.status == "pending_supplement"]

    print(f"\n项目: {project.name} (v{project.version})")
    print(f"更新时间: {project.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n线段: {len(active)} 有效 / {len(deleted)} 已删除")
    print(f"冲突: {len(project.conflicts)} 处")
    print(f"断档: {len(pending_gaps)} 处待处理")

    if project.gaps:
        print("\n断档列表:")
        for i, g in enumerate(project.gaps):
            marker = "!" if g.status == "pending_supplement" else " "
            print(f"  [{i}] {marker} 第{g.gap_start}-{g.gap_end}行 ({g.status})")

    needs_qi = [
        p for p in project.parameter_versions
        if p.next_owner == "数据分析师小祁" and p.status == "needs_supplement"
    ]
    needs_review = [
        p for p in project.parameter_versions
        if p.next_owner == "教研组" and p.status in ["pending_review", "ready_for_review"]
    ]

    print(f"\n待处理:")
    print(f"  数据分析师小祁: {len(needs_qi)} 条需补录")
    print(f"  教研组: {len(needs_review)} 条需复核")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="线段相交施工冲突检测系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 第一步：导入手算反例
  python -m segment_conflict.cli import -i samples/hand_calculated.csv -n 试点项目 -r

  # 第二步：数据分析师小祁补录问卷原始行
  python -m segment_conflict.cli supplement -p 试点项目.json -s 2 -q 5 -r

  # 查看状态
  python -m segment_conflict.cli status -p 试点项目.json

  # 第三步：生成完整报告
  python -m segment_conflict.cli report -p 试点项目.json -o 试点项目报告.txt
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="导入线段数据")
    import_parser.add_argument("-i", "--input", required=True, help="CSV输入文件")
    import_parser.add_argument("-n", "--name", required=True, help="项目名称")
    import_parser.add_argument("-o", "--output", help="项目JSON输出路径")
    import_parser.add_argument("-r", "--report", nargs="?", const=True, help="生成报告")

    supplement_parser = subparsers.add_parser("supplement", help="补录问卷原始行")
    supplement_parser.add_argument("-p", "--project", required=True, help="项目JSON文件")
    supplement_parser.add_argument("-s", "--segment-id", type=int, required=True, help="线段ID")
    supplement_parser.add_argument("-q", "--questionnaire-row", type=int, required=True, help="问卷原始行号")
    supplement_parser.add_argument("-r", "--report", help="更新报告路径")

    review_parser = subparsers.add_parser("review", help="教研组复核断档")
    review_parser.add_argument("-p", "--project", required=True, help="项目JSON文件")
    review_parser.add_argument("-g", "--gap-index", type=int, required=True, help="断档索引")
    review_parser.add_argument("--approved", action="store_true", help="通过复核")
    review_parser.add_argument("--note", required=True, help="复核意见")

    report_parser = subparsers.add_parser("report", help="生成报告")
    report_parser.add_argument("-p", "--project", required=True, help="项目JSON文件")
    report_parser.add_argument("-o", "--output", required=True, help="报告输出路径")

    status_parser = subparsers.add_parser("status", help="查看项目状态")
    status_parser.add_argument("-p", "--project", required=True, help="项目JSON文件")

    args = parser.parse_args()

    commands = {
        "import": cmd_import,
        "supplement": cmd_supplement,
        "review": cmd_review,
        "report": cmd_report,
        "status": cmd_status,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
