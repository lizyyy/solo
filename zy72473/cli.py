#!/usr/bin/env python3
import argparse
import sys
import os
from models import DataStore
from service import MarketLoadingService


def cmd_import(args):
    svc = MarketLoadingService(DataStore(args.db))
    c, note = svc.import_complaint(
        complaint_no=args.no,
        community_name=args.community,
        content=args.content,
        raw_conclusion=args.raw_conclusion,
        operator=args.operator or "system"
    )
    print(f"✅ 已导入投诉：{c.complaint_no} (ID: {c.id})")
    print(f"   小区：{c.community_name}")
    print(f"   状态：{c.status}")
    if note:
        print(f"\n{note}")
    return c.id


def cmd_add_photo(args):
    svc = MarketLoadingService(DataStore(args.db))
    p = svc.add_road_photo(
        complaint_id=args.cid,
        file_name=args.file,
        uploaded_by=args.operator or "周姐"
    )
    print(f"📸 已补录路口照片：{p.file_name}")
    print(f"   关联投诉：{p.complaint_id}")
    print(f"   上传人：{p.uploaded_by}")


def cmd_summary(args):
    svc = MarketLoadingService(DataStore(args.db))
    if args.auto:
        s = svc.rerun_summary(args.cid)
        print(f"📝 已自动重跑摘要 v{s.version}")
    else:
        s = svc.generate_summary(
            complaint_id=args.cid,
            why_kept=args.why_kept or "需进一步核实",
            missing_materials=args.missing or [],
            next_step=args.next_step or "待推进",
            next_contact=args.contact or "社区书记周姐"
        )
        print(f"📝 已生成摘要 v{s.version}")
    print("\n" + svc.get_street_summary_text(args.cid))


def cmd_show(args):
    svc = MarketLoadingService(DataStore(args.db))
    detail = svc.get_complaint_detail(args.cid)
    if not detail.get("complaint"):
        print(f"❌ 未找到投诉 {args.cid}")
        return
    c = detail["complaint"]
    print(f"\n{'='*60}")
    print(f"投诉编号：{c['complaint_no']}")
    print(f"小区名称：{c['community_name']}")
    print(f"当前状态：{c['status']}")
    print(f"有无照片：{'✅ 已补' if c['has_photo'] else '❌ 未补'}")
    if c["need_review"]:
        print(f"复核标记：⚠️  {c['review_note']}")
    print(f"投诉内容：{c['content']}")
    print(f"原始结论：{c['raw_conclusion']}")
    print(f"{'='*60}")

    if detail["summaries"]:
        print(f"\n📋 历史摘要（共 {len(detail['summaries'])} 版）：")
        for s in detail["summaries"]:
            print(f"\n  --- v{s['version']} ---")
            print(f"  留下原因：{s['why_kept']}")
            print(f"  缺材料：{', '.join(s['missing_materials']) or '无'}")
            print(f"  下一步：{s['next_step']}")
            print(f"  对接人：{s['next_contact']}")

    if detail["audit_log"]:
        print(f"\n📜 操作日志：")
        for a in detail["audit_log"]:
            print(f"  [{a['timestamp'][:19]}] {a['operator']} - {a['detail']}")


def cmd_alias(args):
    svc = MarketLoadingService(DataStore(args.db))
    if args.confirm:
        svc.confirm_alias(args.old, args.new, args.operator or "市政巡检员")
        print(f"✅ 已确认别名：{args.old} = {args.new}")
    else:
        svc.register_community_alias(args.old, args.new)
        print(f"🔗 已注册小区别名：旧名'{args.old}' → 新名'{args.new}'")
        print("   导入含该小区名的投诉时，将自动标记待复核")


def cmd_demo(args):
    script_path = os.path.join(os.path.dirname(__file__), "demo.py")
    os.system(f"python3 {script_path}")


def cmd_replay(args):
    svc = MarketLoadingService(DataStore(args.db))
    detail = svc.get_complaint_detail(args.cid)
    if not detail.get("audit_log"):
        print("无操作记录可复盘")
        return
    print(f"\n🔄 投诉 {args.cid} 复盘记录（可重新执行）：")
    print("-" * 60)
    for a in detail["audit_log"]:
        print(f"\n[{a['timestamp'][:19]}] {a['action'].upper()}")
        print(f"    操作人：{a['operator']}")
        print(f"    详情：{a['detail']}")
    print("-" * 60)
    db_path = args.db
    print(f"\n💡 重跑命令：")
    print(f"  python3 cli.py --db {db_path} summary --cid {args.cid} --auto")


def cmd_list(args):
    svc = MarketLoadingService(DataStore(args.db))
    complaints = svc.store.get_all_complaints()
    if not complaints:
        print("暂无投诉记录")
        return
    print(f"\n共 {len(complaints)} 条投诉：")
    for c in complaints:
        flag = "⚠️ " if c["need_review"] else "  "
        photo = "📸" if c["has_photo"] else "  "
        print(f"  {flag}{photo} {c['complaint_no']:12s} {c['community_name']:15s} 状态：{c['status']}")


def main():
    parser = argparse.ArgumentParser(
        description="农贸市场装卸时窗 - 居民投诉处理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例流程：
  1. 注册小区别名： python cli.py alias --old 阳光花园 --new 阳光佳苑
  2. 导入投诉：     python cli.py import --no TS2026001 --community 阳光花园 --content "..." --raw-conclusion "..."
  3. 补录照片：     python cli.py add-photo --cid <投诉ID> --file 路口照片_20260607.jpg
  4. 生成摘要：     python cli.py summary --cid <投诉ID> --auto
  5. 查看详情：     python cli.py show --cid <投诉ID>
  6. 运行演示：     python cli.py demo
        """
    )
    parser.add_argument("--db", default="data/store.json", help="数据存储路径")

    sub = parser.add_subparsers(dest="cmd", required=True)

    p_import = sub.add_parser("import", help="导入居民投诉")
    p_import.add_argument("--no", required=True, help="投诉编号")
    p_import.add_argument("--community", required=True, help="小区名称")
    p_import.add_argument("--content", required=True, help="投诉内容")
    p_import.add_argument("--raw-conclusion", required=True, help="系统原始结论")
    p_import.add_argument("--operator", help="操作人")

    p_photo = sub.add_parser("add-photo", help="补录路口照片")
    p_photo.add_argument("--cid", required=True, help="投诉ID或编号")
    p_photo.add_argument("--file", required=True, help="照片文件名")
    p_photo.add_argument("--operator", help="上传人")

    p_sum = sub.add_parser("summary", help="生成/重跑街道摘要")
    p_sum.add_argument("--cid", required=True, help="投诉ID或编号")
    p_sum.add_argument("--auto", action="store_true", help="自动重跑摘要")
    p_sum.add_argument("--why-kept", help="为什么留下这条")
    p_sum.add_argument("--missing", nargs="*", help="缺失材料列表")
    p_sum.add_argument("--next-step", help="下一步动作")
    p_sum.add_argument("--contact", help="对接人")

    p_show = sub.add_parser("show", help="查看投诉详情")
    p_show.add_argument("--cid", required=True, help="投诉ID或编号")

    p_alias = sub.add_parser("alias", help="注册/确认小区新旧名称")
    p_alias.add_argument("--old", required=True, help="旧名称")
    p_alias.add_argument("--new", required=True, help="新名称")
    p_alias.add_argument("--confirm", action="store_true", help="确认别名")
    p_alias.add_argument("--operator", help="操作人")

    sub.add_parser("demo", help="运行完整演示流程")

    p_replay = sub.add_parser("replay", help="复盘记录和重跑命令")
    p_replay.add_argument("--cid", required=True, help="投诉ID或编号")

    sub.add_parser("list", help="列出所有投诉")

    args = parser.parse_args()

    if args.cmd == "import":
        cmd_import(args)
    elif args.cmd == "add-photo":
        cmd_add_photo(args)
    elif args.cmd == "summary":
        cmd_summary(args)
    elif args.cmd == "show":
        cmd_show(args)
    elif args.cmd == "alias":
        cmd_alias(args)
    elif args.cmd == "demo":
        cmd_demo(args)
    elif args.cmd == "replay":
        cmd_replay(args)
    elif args.cmd == "list":
        cmd_list(args)


if __name__ == "__main__":
    main()
