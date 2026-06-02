import argparse
import sys
import json
from pathlib import Path

from etf_review.models import init_db
from etf_review.services import (
    import_from_file,
    supplement_holiday_note,
    confirm_approver_name,
    generate_report,
    get_batch_detail,
    list_batches,
)


def cmd_import(args):
    print(f"正在导入文件: {args.file}")
    result = import_from_file(args.file)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    pinyin_count = sum(1 for c in result["components"] if c["pinyin_flagged"])
    if pinyin_count:
        print(f"\n⚠ 发现 {pinyin_count} 条审批人仅留拼音的记录，已标记待客户经理复核")


def cmd_list(args):
    init_db()
    batches = list_batches()
    if not batches:
        print("暂无批次数据。请先使用 import 命令导入。")
        return
    print(f"{'批次号':<22} {'日期':<14} {'ETF代码':<10} {'ETF名称':<20} {'状态'}")
    print("-" * 80)
    for b in batches:
        print(f"{b['batch_id']:<22} {b['batch_date']:<14} {b['etf_code']:<10} {b.get('etf_name', ''):<20} {b['status']}")


def cmd_detail(args):
    init_db()
    detail = get_batch_detail(args.batch_id)
    if "error" in detail:
        print(f"错误: {detail['error']}")
        return
    comps = detail["components"]
    print(f"批次号: {args.batch_id}")
    print(f"异常成分数: {len([c for c in comps if c['status'] != 'normal'])}")
    print(f"拼音审批人: {len([c for c in comps if c['approver_is_pinyin']])} 条")
    for c in comps:
        flag = "🔴" if c["approver_is_pinyin"] else ("🟡" if c["status"] == "missing_note" else "🟢")
        print(f"  {flag} {c['component_code']} {c['component_name']} | 审批人: {c['approver_name']} | 状态: {c['status']}")


def cmd_report(args):
    init_db()
    report = generate_report(args.batch_id)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"报告已保存至: {args.output}")
    else:
        print(report)


def cmd_note(args):
    init_db()
    result = supplement_holiday_note(args.component_id, args.note)
    if "error" in result:
        print(f"错误: {result['error']}")
    else:
        print(f"已补录节假日顺延说明，成分ID={args.component_id}，状态={result['status']}")
        if result["status"] == "normal":
            print("✅ 余额变化表已联动更新，该成分归正常")


def cmd_confirm(args):
    init_db()
    result = confirm_approver_name(args.component_id, args.name)
    if "error" in result:
        print(f"错误: {result['error']}")
    else:
        print(f"已确认审批人: {args.name}，成分ID={args.component_id}，状态={result['status']}")


def cmd_demo(args):
    sample = Path(__file__).parent.parent / "sample_data.json"
    print("=== 三步走端到端演示 ===\n")
    print("第一步：导入清算批次号")
    print("-" * 40)
    result = import_from_file(str(sample))
    pinyin = [c for c in result["components"] if c["pinyin_flagged"]]
    print(f"导入完成: {len(result['batches'])} 个批次, {len(result['components'])} 条成分")
    print(f"发现 {len(pinyin)} 条拼音审批人:")
    for c in pinyin:
        print(f"  - 成分ID {c['component_id']}: {c['code']}")

    print("\n第二步：投研助理小周补看节假日顺延说明")
    print("-" * 40)
    for c in result["components"]:
        comp = get_batch_detail(result["batches"][0]["batch_id"]) if result["batches"] else None
        if comp and "components" in comp:
            for comp_item in comp["components"]:
                if comp_item["deviation"] != 0 and not comp_item.get("holiday_extension_note"):
                    r = supplement_holiday_note(comp_item["id"], "端午节假期顺延清算")
                    print(f"  补录成分 {comp_item['component_code']}: 状态={r['status']}")

    print("\n第三步：查看余额变化表更新")
    print("-" * 40)
    for b in result["batches"]:
        report = generate_report(b["batch_id"])
        print(report[:500])
        print("  ...（完整报告请使用 report 命令）")

    print("\n⚠ 注意: 拼音审批人的成分不会因补录顺延说明而归正常，需客户经理复核后确认")


def main():
    parser = argparse.ArgumentParser(
        description="ETF 篮子成分异常复盘工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 导入样例数据
  python -m etf_review.cli import sample_data.json

  # 查看批次列表
  python -m etf_review.cli list

  # 查看批次详情
  python -m etf_review.cli detail CL-20260601-001

  # 生成报告
  python -m etf_review.cli report CL-20260601-001 -o report.txt

  # 补录节假日顺延说明
  python -m etf_review.cli note 2 "端午节顺延至6月2日清算"

  # 确认审批人
  python -m etf_review.cli confirm 2 "张伟"

  # 三步走演示
  python -m etf_review.cli demo
        """,
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    p_import = sub.add_parser("import", help="导入清算批次数据")
    p_import.add_argument("file", help="JSON 数据文件路径")

    sub.add_parser("list", help="列出所有批次")

    p_detail = sub.add_parser("detail", help="查看批次详情")
    p_detail.add_argument("batch_id", help="清算批次号")

    p_report = sub.add_parser("report", help="生成复盘报告")
    p_report.add_argument("batch_id", help="清算批次号")
    p_report.add_argument("-o", "--output", help="输出文件路径")

    p_note = sub.add_parser("note", help="补录节假日顺延说明")
    p_note.add_argument("component_id", type=int, help="成分ID")
    p_note.add_argument("note", help="节假日顺延说明内容")

    p_confirm = sub.add_parser("confirm", help="确认审批人中文全名")
    p_confirm.add_argument("component_id", type=int, help="成分ID")
    p_confirm.add_argument("name", help="审批人中文全名")

    sub.add_parser("demo", help="运行三步走端到端演示")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "import": cmd_import,
        "list": cmd_list,
        "detail": cmd_detail,
        "report": cmd_report,
        "note": cmd_note,
        "confirm": cmd_confirm,
        "demo": cmd_demo,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
