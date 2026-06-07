import argparse
import json
import sys
import os
from .processor import ParkSiteSelector


def print_banner():
    print("=" * 50)
    print("  社区口袋公园选址工具")
    print("  交通协管老马专用版")
    print("=" * 50)
    print()


def cmd_summary(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    summary = selector.get_summary()
    print(f"项目名称: {summary['project_name']}")
    print(f"运行次数: {summary['run_count']}")
    if summary['last_ran_at']:
        print(f"最后运行: {summary['last_ran_at'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"选址记录总数: {summary['total_sites']}")
    print(f"夜间采样点: {summary['night_points']}")
    print(f"冲突复核记录: {summary['conflict_review_items']}")
    print()
    print("状态分布:")
    for status, count in summary['by_status'].items():
        print(f"  {status}: {count}")


def cmd_import_sites(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    with open(args.file, 'r', encoding='utf-8') as f:
        sites_data = json.load(f)
    
    imported, flagged = selector.import_sites(sites_data)
    print(f"成功导入 {imported} 条选址记录")
    print(f"其中 {flagged} 条标记为需复核（居民意见只剩汇总无原文）")
    
    if args.state:
        selector.save_state(args.state)
        print(f"状态已保存到: {args.state}")


def cmd_import_night(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    with open(args.file, 'r', encoding='utf-8') as f:
        night_data = json.load(f)
    
    imported, conflicts = selector.import_night_sampling(night_data)
    print(f"成功导入 {imported} 个夜间采样点")
    print(f"发现 {conflicts} 个冲突，已自动加入冲突复核表")
    
    if args.state:
        selector.save_state(args.state)
        print(f"状态已保存到: {args.state}")


def cmd_list_sites(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    sites = selector.state.sites
    if args.need_review:
        sites = selector.get_sites_need_review()
    
    for site in sites:
        print(f"[{site.status.value}] {site.site_name} ({site.id})")
        print(f"  地址: {site.address}")
        print(f"  面积: {site.area_sqm} 平方米")
        print(f"  数据来源: {site.source.value}")
        if site.accessibility_ramp:
            ramp_status = "有无障碍坡道" if site.accessibility_ramp.has_ramp else "无坡道"
            print(f"  坡道: {ramp_status}")
        if site.review_notes:
            print(f"  复核说明: {site.review_notes}")
        if site.conflict_notes:
            print(f"  冲突备注: {site.conflict_notes}")
        if site.opinions:
            print(f"  居民意见 ({len(site.opinions)}条):")
            for op in site.opinions:
                print(f"    - [{op.status.value}] {op.resident_name}: {op.summary}")
        print()


def cmd_conflicts(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    conflicts = selector.get_conflict_review()
    if not conflicts:
        print("暂无冲突复核记录")
        return
    
    for item in conflicts:
        print(f"[{item.status}] {item.id} - {item.conflict_type}")
        print(f"  选址点: {item.site_name} ({item.site_id})")
        print(f"  说明: {item.description}")
        print(f"  变更: {item.source_before} → {item.source_after}")
        if item.handler:
            print(f"  处理人: {item.handler}")
        if item.resolution_notes:
            print(f"  处理意见: {item.resolution_notes}")
        print()


def cmd_rerun(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    summary = selector.rerun()
    print("重跑完成！")
    print(f"总记录数: {summary['total_sites']}")
    print(f"正常: {summary['normal']}")
    print(f"需复核: {summary['needs_review']}")
    print(f"有冲突: {summary['conflicts']}")
    print(f"夜间采样点: {summary['night_points']}")
    print(f"冲突复核条目: {summary['conflict_review_items']}")
    
    if args.state:
        selector.save_state(args.state)
        print(f"状态已保存到: {args.state}")


def cmd_correct(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    correction = {}
    if args.site_name:
        correction["site_name"] = args.site_name
    if args.area:
        correction["area_sqm"] = args.area
    if args.review_notes:
        correction["review_notes"] = args.review_notes
    if args.status:
        correction["status"] = args.status
    
    handler = args.handler if args.handler else "老马"
    
    success = selector.manual_correct(args.site_id, correction, handler)
    if success:
        print(f"人工修正成功！处理人: {handler}")
        if args.state:
            selector.save_state(args.state)
            print(f"状态已保存到: {args.state}")
    else:
        print(f"未找到选址记录: {args.site_id}")
        sys.exit(1)


def cmd_resolve(args):
    selector = ParkSiteSelector()
    if args.state and os.path.exists(args.state):
        selector.load_state(args.state)
    
    handler = args.handler if args.handler else "老马"
    success = selector.resolve_conflict(args.conflict_id, handler, args.notes)
    if success:
        print(f"冲突已处理！处理人: {handler}")
        if args.state:
            selector.save_state(args.state)
            print(f"状态已保存到: {args.state}")
    else:
        print(f"未找到冲突记录: {args.conflict_id}")
        sys.exit(1)


def cmd_demo(args):
    from .demo_data import run_full_demo
    run_full_demo(args.state)


def main():
    parser = argparse.ArgumentParser(description="社区口袋公园选址工具 - 交通协管老马专用版")
    parser.add_argument("--state", default="park_state.json", help="状态文件路径")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    p_summary = subparsers.add_parser("summary", help="查看项目概览")
    p_summary.set_defaults(func=cmd_summary)
    
    p_import = subparsers.add_parser("import-sites", help="导入选址记录")
    p_import.add_argument("file", help="选址数据JSON文件路径")
    p_import.set_defaults(func=cmd_import_sites)
    
    p_night = subparsers.add_parser("import-night", help="导入夜间采样点")
    p_night.add_argument("file", help="夜间采样点JSON文件路径")
    p_night.set_defaults(func=cmd_import_night)
    
    p_list = subparsers.add_parser("list", help="列出选址记录")
    p_list.add_argument("--need-review", action="store_true", help="只显示需复核的记录")
    p_list.set_defaults(func=cmd_list_sites)
    
    p_conflicts = subparsers.add_parser("conflicts", help="查看冲突复核表")
    p_conflicts.set_defaults(func=cmd_conflicts)
    
    p_rerun = subparsers.add_parser("rerun", help="重跑所有检查")
    p_rerun.set_defaults(func=cmd_rerun)
    
    p_correct = subparsers.add_parser("correct", help="人工修正选址记录")
    p_correct.add_argument("site_id", help="选址记录ID")
    p_correct.add_argument("--site-name", help="修正名称")
    p_correct.add_argument("--area", type=float, help="修正面积")
    p_correct.add_argument("--review-notes", help="复核备注")
    p_correct.add_argument("--status", help="修正状态")
    p_correct.add_argument("--handler", default="老马", help="处理人")
    p_correct.set_defaults(func=cmd_correct)
    
    p_resolve = subparsers.add_parser("resolve", help="处理冲突")
    p_resolve.add_argument("conflict_id", help="冲突记录ID")
    p_resolve.add_argument("notes", help="处理意见")
    p_resolve.add_argument("--handler", default="老马", help="处理人")
    p_resolve.set_defaults(func=cmd_resolve)
    
    p_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    p_demo.set_defaults(func=cmd_demo)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        print()
        print_banner()
        print("快速上手:")
        print("  1. 运行演示: python -m park_selector.cli demo")
        print("  2. 查看概览: python -m park_selector.cli summary")
        print("  3. 列出记录: python -m park_selector.cli list")
        print("  4. 查看冲突: python -m park_selector.cli conflicts")
        sys.exit(0)
    
    print_banner()
    args.func(args)


if __name__ == "__main__":
    main()
