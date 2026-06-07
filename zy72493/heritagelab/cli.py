#!/usr/bin/env python3
"""
文化遗产视廊控制系统 - 命令行入口
"""
import argparse
import os
import sys
import csv
import json
from datetime import datetime

from heritagelab import HeritageCorridorService, ReportGenerator, NextAction, ConflictLevel


def cmd_import(args):
    """导入网格员巡查表"""
    service = HeritageCorridorService()
    if os.path.exists(args.state):
        service.load_state(args.state)

    inspection = service.import_inspection_csv(args.file)
    service.export_state(args.state)

    print(f"✅ 成功导入巡查表: {inspection.id}")
    print(f"   网格员: {inspection.inspector}")
    print(f"   区域: {inspection.location}")
    print(f"   居民意见: {len(inspection.opinions)} 条")

    summary_only = [o for o in inspection.opinions if o.summary and not o.original_text]
    if summary_only:
        print(f"\n⚠️  发现 {len(summary_only)} 条意见只剩汇总无原文，已加入冲突复核表")
        for o in summary_only:
            print(f"   - {o.id}: {o.summary[:30]}...")

    return service


def cmd_notice(args):
    """导入施工告示"""
    service = HeritageCorridorService()
    if os.path.exists(args.state):
        service.load_state(args.state)

    notice = service.import_construction_notice(args.file)
    service.export_state(args.state)

    print(f"✅ 成功导入施工告示: {notice.id}")
    print(f"   项目: {notice.project_name}")
    print(f"   位置: {notice.location}")
    print(f"   关联意见: {len(notice.related_opinion_ids)} 条")
    print(f"   冲突复核表已同步更新")

    return service


def cmd_list(args):
    """列出冲突复核表"""
    service = HeritageCorridorService()
    if os.path.exists(args.state):
        service.load_state(args.state)

    action_filter = None
    if args.action == "secretary":
        action_filter = NextAction.COMMUNITY_SECRETARY
    elif args.action == "ma":
        action_filter = NextAction.TRAFFIC_MA

    conflicts = service.get_pending_conflicts(action_filter)

    print(f"\n📋 冲突复核表（共 {len(conflicts)} 条待处理）")
    print("-" * 80)
    for c in conflicts:
        print(f"\n【{c.id}】[{c.conflict_level.value}] {c.location}")
        print(f"    意见: {c.opinion_summary}")
        print(f"    下一步: {c.next_action.value}")
        print(f"    缺材料: {', '.join(c.missing_materials)}")

    return service


def cmd_review(args):
    """社区书记复核冲突项"""
    service = HeritageCorridorService()
    if os.path.exists(args.state):
        service.load_state(args.state)

    # 先显示来源
    source = service.get_opinion_source(args.opinion_id)
    if source:
        print(f"\n📄 来源追溯: {source['type']}")
        if source['type'] == '网格员巡查表':
            print(f"   巡查表: {source['source_id']}")
            print(f"   网格员: {source['inspector']}")
            op = source['opinion']
            if op.original_text:
                print(f"   原文: {op.original_text}")
            else:
                print(f"   ⚠️  只有汇总，没有原文！")
        else:
            print(f"   项目: {source['project']}")
    else:
        print("⚠️  未找到来源")

    print(f"\n请选择复核决定:")
    print("  1. confirm - 确认通过")
    print("  2. request_more - 要求老马补充")
    print("  3. resolve - 直接结案")
    choice = input("> ").strip()

    decisions = {"1": "confirm", "2": "request_more", "3": "resolve"}
    decision = decisions.get(choice, choice)

    note = input("请输入复核说明: ").strip()
    reviewer = args.reviewer or "社区书记"

    conflict = service.review_conflict(args.conflict_id, reviewer, decision, note)
    service.export_state(args.state)

    print(f"\n✅ 复核完成: {conflict.id}")
    print(f"   状态: {'已结案' if conflict.is_resolved else '处理中'}")
    print(f"   说明: {conflict.resolution_note}")

    return service


def cmd_report(args):
    """生成报告"""
    service = HeritageCorridorService()
    if os.path.exists(args.state):
        service.load_state(args.state)

    generator = ReportGenerator(service.data)

    if args.format == "html":
        output = args.output or "heritage_report.html"
        generator.generate_html_report(output)
        print(f"✅ HTML报告已生成: {os.path.abspath(output)}")
    else:
        print(generator.generate_text_report())

    return service


def cmd_source(args):
    """追溯意见来源"""
    service = HeritageCorridorService()
    if os.path.exists(args.state):
        service.load_state(args.state)

    source = service.get_opinion_source(args.opinion_id)
    if not source:
        print("❌ 未找到该意见的来源")
        return

    print(f"\n🔍 来源追溯: {args.opinion_id}")
    print("-" * 40)
    print(f"类型: {source['type']}")

    if source['type'] == '网格员巡查表':
        print(f"巡查表编号: {source['source_id']}")
        print(f"网格员: {source['inspector']}")
        print(f"巡查时间: {source['date'].strftime('%Y-%m-%d')}")
        op = source['opinion']
        print(f"\n意见内容:")
        print(f"  位置: {op.location}")
        print(f"  汇总: {op.summary}")
        if op.original_text:
            print(f"  原文: {op.original_text}")
        else:
            print(f"  ⚠️  只有汇总，没有原文！")
    else:
        print(f"告示编号: {source['source_id']}")
        print(f"项目: {source['project']}")

    return service


def cmd_demo(args):
    """运行完整演示流程"""
    state_file = args.state or "demo_state.json"
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "samples")

    print("=" * 60)
    print("🏛️ 文化遗产视廊控制 - 完整流程演示")
    print("=" * 60)

    # 步骤1: 导入巡查表
    print("\n📌 第一步：网格员巡查表导入")
    print("-" * 40)
    inspection_file = os.path.join(sample_dir, "inspection_01.csv")
    service = HeritageCorridorService()
    inspection = service.import_inspection_csv(inspection_file)
    print(f"✅ 导入巡查表: {inspection.id}")
    print(f"   居民意见: {len(inspection.opinions)} 条")
    summary_only = [o for o in inspection.opinions if not o.original_text]
    print(f"   ⚠️  只剩汇总无原文: {len(summary_only)} 条")
    for o in summary_only:
        print(f"     - {o.id}: {o.summary}")

    # 步骤2: 显示待复核冲突
    print("\n📌 第二步：社区书记查看冲突复核表")
    print("-" * 40)
    conflicts = service.get_pending_conflicts(NextAction.COMMUNITY_SECRETARY)
    print(f"待社区书记复核: {len(conflicts)} 条")
    for c in conflicts:
        print(f"\n  【{c.id}】")
        print(f"  位置: {c.location}")
        print(f"  意见: {c.opinion_summary}")
        print(f"  原因: {c.conflict_reason}")
        print(f"  缺材料: {', '.join(c.missing_materials)}")
        print(f"  下一步: {c.next_action.value}")

    # 步骤3: 老马补施工告示
    print("\n📌 第三步：交通协管老马补录施工告示")
    print("-" * 40)
    notice_file = os.path.join(sample_dir, "notice_01.json")
    with open(notice_file, 'r', encoding='utf-8') as f:
        notice_data = json.load(f)

    # 关联相关的居民意见（东大街围挡和噪音相关的）
    related_opinions = [o for o in inspection.opinions
                        if "围挡" in o.summary or "噪音" in o.summary]
    notice_data["related_opinion_ids"] = [o.id for o in related_opinions]

    print(f"项目: {notice_data['project_name']}")
    print(f"位置: {notice_data['location']}")
    print(f"遗产影响: {notice_data['impact_on_heritage']}")
    print(f"关联意见: {len(notice_data['related_opinion_ids'])} 条")
    for o in related_opinions:
        print(f"  - {o.id}: {o.summary}")

    # 临时保存带关联的notice文件
    temp_notice_file = os.path.join(os.path.dirname(state_file), "temp_notice.json")
    with open(temp_notice_file, 'w', encoding='utf-8') as f:
        json.dump(notice_data, f, ensure_ascii=False, indent=2)

    notice = service.import_construction_notice(temp_notice_file)
    os.remove(temp_notice_file)
    print(f"\n✅ 施工告示已录入: {notice.id}")
    print(f"   冲突复核表已自动更新")

    # 步骤4: 复核表更新后状态
    print("\n📌 第四步：冲突复核表更新后")
    print("-" * 40)
    for c in service.get_pending_conflicts():
        print(f"\n  【{c.id}】")
        print(f"  风险等级: {c.conflict_level.value}")
        print(f"  原因: {c.conflict_reason}")
        print(f"  缺材料: {', '.join(c.missing_materials)}")
        print(f"  下一步: {c.next_action.value}")

    # 步骤5: 社区书记最终复核
    print("\n📌 第五步：社区书记最终复核")
    print("-" * 40)
    for c in list(service.get_pending_conflicts(NextAction.COMMUNITY_SECRETARY)):
        service.review_conflict(c.id, "社区书记", "confirm", "情况属实，已确认")
        print(f"✅ {c.id} 已复核确认")

    # 保存状态
    service.export_state(state_file)

    # 生成报告
    print("\n📌 第六步：生成报告")
    print("-" * 40)
    generator = ReportGenerator(service.data)
    report_path = "demo_report.html"
    generator.generate_html_report(report_path)
    print(f"✅ HTML报告: {os.path.abspath(report_path)}")
    print(f"✅ 状态文件: {os.path.abspath(state_file)}")

    print("\n" + "=" * 60)
    print("🎉 演示完成！")
    print("=" * 60)
    print("\n后续操作:")
    print(f"  查看报告: 浏览器打开 {report_path}")
    print(f"  继续操作: python -m heritagelab.cli --state {state_file} list")


def main():
    parser = argparse.ArgumentParser(
        description="文化遗产视廊控制系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行完整演示
  python -m heritagelab.cli demo

  # 导入网格员巡查表
  python -m heritagelab.cli import samples/inspection_01.csv

  # 导入施工告示
  python -m heritagelab.cli notice samples/notice_01.json

  # 列出待社区书记复核的冲突
  python -m heritagelab.cli list --action secretary

  # 追溯意见来源
  python -m heritagelab.cli source OP-INS-xxx-001

  # 复核冲突
  python -m heritagelab.cli review CF-OP-INS-xxx-001

  # 生成HTML报告
  python -m heritagelab.cli report --format html
        """
    )
    parser.add_argument("--state", default="heritage_state.json", help="状态文件路径")

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # import 命令
    p_import = subparsers.add_parser("import", help="导入网格员巡查表(CSV)")
    p_import.add_argument("file", help="巡查表CSV文件路径")

    # notice 命令
    p_notice = subparsers.add_parser("notice", help="导入施工告示(JSON)")
    p_notice.add_argument("file", help="施工告示JSON文件路径")

    # list 命令
    p_list = subparsers.add_parser("list", help="列出冲突复核表")
    p_list.add_argument("--action", choices=["all", "secretary", "ma"], default="all",
                        help="按处理人过滤")

    # review 命令
    p_review = subparsers.add_parser("review", help="复核冲突项")
    p_review.add_argument("conflict_id", help="冲突项ID")
    p_review.add_argument("opinion_id", nargs="?", help="关联意见ID（用于追溯）")
    p_review.add_argument("--reviewer", default="社区书记", help="复核人")

    # source 命令
    p_source = subparsers.add_parser("source", help="追溯居民意见来源")
    p_source.add_argument("opinion_id", help="居民意见ID")

    # report 命令
    p_report = subparsers.add_parser("report", help="生成报告")
    p_report.add_argument("--format", choices=["text", "html"], default="text", help="报告格式")
    p_report.add_argument("--output", help="输出文件路径（HTML格式时使用）")

    # demo 命令
    subparsers.add_parser("demo", help="运行完整演示流程")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    commands = {
        "import": cmd_import,
        "notice": cmd_notice,
        "list": cmd_list,
        "review": cmd_review,
        "source": cmd_source,
        "report": cmd_report,
        "demo": cmd_demo,
    }

    cmd_func = commands.get(args.command)
    if cmd_func:
        cmd_func(args)


if __name__ == "__main__":
    main()
