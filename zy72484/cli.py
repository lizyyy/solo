import argparse
import json
from datetime import datetime
from core import FumeInspectionSystem
from models import ReviewStatus


def main():
    parser = argparse.ArgumentParser(
        description="沿街店铺油烟整治管理系统 - 命令行入口",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
术语解释（给市政巡检员/街道规划员看）：
  - 复核：确认数据是否属实，尤其是小区名字对不对得上
  - 待补材料：缺什么就补什么，别让报告空着
  - 下一步对接：该找谁就找谁，别互相踢皮球
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    demo_parser = subparsers.add_parser("demo", help="运行完整演示流程")

    summary_parser = subparsers.add_parser("summary", help="生成街道会看的摘要")
    summary_parser.add_argument("--output", "-o", help="输出到文件")

    list_parser = subparsers.add_parser("list", help="列出问题记录")
    list_parser.add_argument("--status", choices=[s.value for s in ReviewStatus], help="按状态过滤")

    detail_parser = subparsers.add_parser("detail", help="查看问题详情（可回溯到原始记录）")
    detail_parser.add_argument("issue_id", help="问题记录ID")

    review_parser = subparsers.add_parser("review-alias", help="复核小区同名问题")
    review_parser.add_argument("index", type=int, help="别名记录序号")
    review_parser.add_argument("--valid", action="store_true", help="确认是同一小区")
    review_parser.add_argument("--invalid", action="store_true", help="不是同一小区")
    review_parser.add_argument("--reviewer", default="市政巡检员", help="复核人")
    review_parser.add_argument("--note", help="复核备注")

    add_ramp_parser = subparsers.add_parser("add-ramp", help="导入无障碍坡道记录")
    add_ramp_parser.add_argument("--shop-id", required=True, help="店铺ID")
    add_ramp_parser.add_argument("--community", required=True, help="小区名称")
    add_ramp_parser.add_argument("--has-ramp", type=lambda x: x.lower() == 'true', required=True, help="是否有坡道 (true/false)")
    add_ramp_parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"), help="检查日期")
    add_ramp_parser.add_argument("--inspector", help="检查人")

    add_sample_parser = subparsers.add_parser("add-sample", help="补录夜间采样点")
    add_sample_parser.add_argument("--shop-id", required=True, help="店铺ID")
    add_sample_parser.add_argument("--community", required=True, help="小区名称")
    add_sample_parser.add_argument("--conc", type=float, required=True, help="油烟浓度 mg/m³")
    add_sample_parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"), help="采样日期")
    add_sample_parser.add_argument("--time", default="22:00", help="采样时间")
    add_sample_parser.add_argument("--sampler", help="采样人")

    chart_parser = subparsers.add_parser("chart", help="获取图表数据")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    system = FumeInspectionSystem()

    if args.command == "demo":
        run_demo(system)
        return
    else:
        _load_demo_data(system)

    if args.command == "summary":
        print_summary(system, args.output)
    elif args.command == "list":
        list_issues(system, args.status)
    elif args.command == "detail":
        show_detail(system, args.issue_id)
    elif args.command == "review-alias":
        do_review_alias(system, args)
    elif args.command == "add-ramp":
        rid = system.import_ramp_record(
            shop_id=args.shop_id,
            community_name=args.community,
            has_ramp=args.has_ramp,
            inspection_date=args.date,
            inspector=args.inspector
        )
        print(f"✅ 坡道记录已导入，ID: {rid}")
        print_summary(system)
    elif args.command == "add-sample":
        sid = system.import_sampling_point(
            shop_id=args.shop_id,
            community_name=args.community,
            fume_concentration=args.conc,
            sampling_date=args.date,
            sampling_time=args.time,
            sampler=args.sampler
        )
        print(f"✅ 夜间采样点已补录，ID: {sid}")
        print_summary(system)
    elif args.command == "chart":
        data = system.get_chart_data()
        print(json.dumps(data, ensure_ascii=False, indent=2))


def _load_demo_data(system: FumeInspectionSystem):
    c1 = system.add_community("阳光花园小区", "光明路88号", "江城区")
    c2 = system.add_community("和平家园", "和平路123号", "江城区")

    s1 = system.add_shop("老王川菜馆", c1, "光明路88号-1", "餐饮", has_fume_hood=True)
    s2 = system.add_shop("李记烧烤", c1, "光明路88号-2", "餐饮", has_fume_hood=False)
    s3 = system.add_shop("张姐早餐店", c2, "和平路123号-1", "餐饮", has_fume_hood=True)

    return s1, s2, s3, c1, c2


def run_demo(system: FumeInspectionSystem):
    print("=" * 70)
    print("🏘️ 沿街店铺油烟整治 - 完整流程演示")
    print("=" * 70)

    s1, s2, s3, c1, c2 = _load_demo_data(system)

    print("\n📌 第一步：导入无障碍坡道记录")
    print("-" * 70)
    r1 = system.import_ramp_record(
        shop_id=s1,
        community_name="阳光花园小区",
        has_ramp=False,
        inspection_date="2026-06-01",
        inspector="市政巡检员老陈",
        notes="门口有台阶，无坡道"
    )
    r2 = system.import_ramp_record(
        shop_id=s2,
        community_name="阳光花园",
        has_ramp=True,
        ramp_width=1.2,
        inspection_date="2026-06-01",
        inspector="市政巡检员老陈"
    )
    print(f"  已导入 2 条坡道记录")
    print(f"  ⚠️  注意：'阳光花园小区' 和 '阳光花园' 系统检测为疑似同名小区！")
    print(f"  👉 留给市政巡检员复核，不急着归正常")

    _print_separator()
    print("📊 导入坡道记录后的摘要：")
    print_summary(system)

    print("\n📌 第二步：街道规划员小姜补看夜间采样点")
    print("-" * 70)
    sp1 = system.import_sampling_point(
        shop_id=s1,
        community_name="阳光花园小区",
        sampling_date="2026-06-05",
        sampling_time="22:30",
        fume_concentration=3.5,
        sampler="街道规划员小姜",
        notes="晚高峰后采样"
    )
    sp2 = system.import_sampling_point(
        shop_id=s2,
        community_name="阳光花园",
        sampling_date="2026-06-05",
        sampling_time="23:15",
        fume_concentration=1.8,
        sampler="街道规划员小姜"
    )
    print(f"  已补录 2 条夜间采样数据")
    print(f"  老王川菜馆油烟浓度 3.5 mg/m³，超标（标准≤2.0）")

    _print_separator()
    print("📊 补录采样点后的摘要（自动更新）：")
    print_summary(system)

    print("\n📌 第三步：市政巡检员复核小区同名问题")
    print("-" * 70)
    if system.store.community_aliases:
        print(f"  待复核记录：{system.store.community_aliases[0].old_name} → {system.store.community_aliases[0].new_name}")
        system.review_alias(0, "市政巡检员老陈", is_valid=True, note="确认为同一小区，新名叫阳光花园小区")
        print("  ✅ 已确认是同一小区，别名已记录")

    _print_separator()
    print("📊 复核后的最终摘要：")
    print_summary(system)

    print("\n" + "=" * 70)
    print("🎬 演示结束！")
    print("=" * 70)
    print("\n💡 提示：")
    print("  python cli.py list           # 查看所有问题")
    print("  python cli.py detail <ID>    # 查看详情（可回溯到原始记录）")
    print("  python cli.py summary        # 生成街道会看的摘要")
    print("  python cli.py chart          # 获取图表数据（给小看板用）")


def _print_separator():
    print("\n" + "─" * 70)


def print_summary(system: FumeInspectionSystem, output_file: str = None):
    summary = system.generate_street_summary()

    lines = []
    lines.append("")
    lines.append("📋 沿街店铺油烟整治 - 街道会看摘要")
    lines.append("=" * 70)
    lines.append(f"  统计时间：{summary.generated_at.strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"  沿街店铺总数：{summary.total_shops} 家")
    lines.append(f"  有问题需跟进：{summary.shops_with_issues} 家")
    lines.append(f"  待复核：{summary.pending_review} 条")
    lines.append(f"  小区同名待确认：{summary.alias_issues} 条")
    lines.append(f"  缺坡道记录：{summary.missing_ramp_records} 条")
    lines.append(f"  缺夜间采样：{summary.missing_sampling_points} 条")

    if summary.alias_details:
        lines.append("")
        lines.append("🔍 小区同名问题追溯（可追回原始材料）：")
        lines.append("-" * 70)
        for idx, alias in enumerate(summary.alias_details, 1):
            lines.append(f"  {idx}. [{alias['reviewed']}] 「{alias['old_name']}」 ↔ 「{alias['new_name']}」")
            if alias['触发坡道记录']:
                lines.append(f"     📎 触发的无障碍坡道记录：")
                for r in alias['触发坡道记录']:
                    lines.append(f"        - [{r['id']}] {r['店铺']}（记录里写的小区名：{r['小区名']}），坡道：{r['有无坡道']}，{r['检查人']}，{r['检查日期']}")
            if alias['触发采样记录']:
                lines.append(f"     📎 触发的夜间采样记录：")
                for s in alias['触发采样记录']:
                    lines.append(f"        - [{s['id']}] {s['店铺']}（记录里写的小区名：{s['小区名']}），油烟{s['油烟浓度']}，{s['采样人']}，{s['采样日期']}")
            if alias['reviewed'] == '已复核':
                lines.append(f"     ✅ 复核人：{alias['reviewer']}，备注：{alias['review_note'] or '无'}")
            else:
                lines.append(f"     ⏳ 待市政巡检员复核确认")

    lines.append("")
    lines.append("📝 问题明细：")
    lines.append("-" * 70)

    for idx, issue in enumerate(summary.issues, 1):
        lines.append(f"  {idx}. [{issue['当前状态']}] {issue['店铺']}（{issue['所属小区']}）")
        lines.append(f"     📌 为什么留下：{issue['问题说明']}")
        lines.append(f"     📋 还缺什么：{'、'.join(issue['待补材料']) if issue['待补材料'] else '不缺'}")
        lines.append(f"     👉 下一步找：{issue['下一步对接']}")
        if issue['是否有同名小区问题'] == '是' and issue.get('同名小区说明'):
            lines.append(f"     ⚠️  注意：{issue['同名小区说明']}")
        if issue.get('坡道记录ID'):
            lines.append(f"     🔗 关联坡道记录ID：{issue['坡道记录ID']}")
        if issue.get('采样记录ID'):
            lines.append(f"     🔗 关联采样记录ID：{issue['采样记录ID']}")
        lines.append(f"     🕐 最后更新：{issue['更新时间']}  |  ID: {issue['id']}")
        lines.append("")

    result = "\n".join(lines)
    print(result)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(result)
        print(f"\n💾 摘要已保存到：{output_file}")


def list_issues(system: FumeInspectionSystem, status_filter: str = None):
    summary = system.generate_street_summary()
    print("\n📋 问题记录列表")
    print("-" * 70)
    for issue in summary.issues:
        if status_filter and issue['当前状态'] != status_filter:
            continue
        print(f"  [{issue['当前状态']}] {issue['id']} | {issue['店铺']} | {issue['所属小区']} | {issue['问题说明'][:30]}...")


def show_detail(system: FumeInspectionSystem, issue_id: str):
    issue = system.store.issue_records.get(issue_id)
    if not issue:
        print(f"❌ 找不到问题记录：{issue_id}")
        return

    print("\n🔍 问题详情")
    print("=" * 70)
    print(f"  问题ID：{issue.id}")
    print(f"  店铺：{issue.shop_name}")
    print(f"  所属小区：{issue.community_name}")
    print(f"  当前状态：{issue.status.value}")
    print(f"  问题说明：{issue.reason_kept}")
    print(f"  待补材料：{'、'.join(issue.missing_materials) if issue.missing_materials else '无'}")
    print(f"  下一步对接：{issue.next_role.value}")
    print(f"  小区同名问题：{'是（待市政巡检员复核）' if issue.has_alias_issue else '否'}")
    print(f"  创建时间：{issue.created_at.strftime('%Y-%m-%d %H:%M')}")
    print(f"  更新时间：{issue.updated_at.strftime('%Y-%m-%d %H:%M')}")

    ramp = system.get_ramp_by_issue(issue_id)
    if ramp:
        print("\n📎 关联的无障碍坡道记录（点这里回溯）：")
        print("-" * 70)
        print(f"  记录ID：{ramp.id}")
        print(f"  小区名称（记录里写的）：{ramp.community_name}")
        print(f"  有无坡道：{'有' if ramp.has_ramp else '无'}")
        if ramp.ramp_width:
            print(f"  坡道宽度：{ramp.ramp_width}m")
        if ramp.ramp_slope:
            print(f"  坡道坡度：{ramp.ramp_slope}")
        print(f"  有无扶手：{'有' if ramp.has_handrail else '无'}")
        print(f"  检查人：{ramp.inspector or '未记录'}")
        print(f"  检查日期：{ramp.inspection_date}")
        if ramp.notes:
            print(f"  备注：{ramp.notes}")

    sampling = system.get_sampling_by_issue(issue_id)
    if sampling:
        print("\n📎 关联的夜间采样点（点这里回溯）：")
        print("-" * 70)
        print(f"  记录ID：{sampling.id}")
        print(f"  小区名称（记录里写的）：{sampling.community_name}")
        print(f"  采样日期：{sampling.sampling_date} {sampling.sampling_time}")
        print(f"  油烟浓度：{sampling.fume_concentration} mg/m³")
        print(f"  标准限值：{sampling.standard_limit} mg/m³")
        print(f"  是否达标：{'是' if sampling.is_qualified else '否'}")
        print(f"  采样人：{sampling.sampler or '未记录'}")
        if sampling.notes:
            print(f"  备注：{sampling.notes}")

    print("\n" + "=" * 70)


def do_review_alias(system: FumeInspectionSystem, args):
    if not (args.valid or args.invalid):
        print("❌ 请指定 --valid 或 --invalid")
        return

    if args.index >= len(system.store.community_aliases):
        print(f"❌ 序号超出范围，当前共有 {len(system.store.community_aliases)} 条待复核")
        return

    alias = system.store.community_aliases[args.index]
    system.review_alias(args.index, args.reviewer, is_valid=args.valid, note=args.note)

    status = "✅ 确认为同一小区" if args.valid else "❌ 不是同一小区"
    print(f"{status}：{alias.old_name} ↔ {alias.new_name}")
    print(f"复核人：{args.reviewer}")
    if args.note:
        print(f"备注：{args.note}")


if __name__ == "__main__":
    main()
