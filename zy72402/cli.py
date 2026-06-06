#!/usr/bin/env python3
import argparse
import sys
import os
from core import WorkflowEngine
from report import generate_text_report, generate_dashboard_html


def cmd_import(args):
    engine = WorkflowEngine(data_dir=args.data_dir)
    if os.path.exists(os.path.join(args.data_dir, "workflow_state.json")):
        engine.load_state()

    total, rework = engine.step1_import_tickets(args.ticket_csv)
    engine.save_state()

    print(f"✅ 第一步完成：票务导出表导入成功")
    print(f"   共导入 {total} 条轨道，其中 {rework} 条包含返工原因标记")
    if rework > 0:
        print(f"   ⚠️  含返工原因的轨道将保留待版权运营复核，不会自动归为正常")


def cmd_amei_review(args):
    engine = WorkflowEngine(data_dir=args.data_dir)
    if not engine.load_state():
        print("❌ 未找到工作流状态，请先运行 import 命令")
        sys.exit(1)

    try:
        total, updated = engine.step2_amei_review(args.audio_csv, reviewer="阿梅")
        engine.save_state()
        print(f"✅ 第二步完成：阿梅补看音频文件备注")
        print(f"   共处理 {total} 个音频文件，关联更新 {updated} 条排练记录")
    except RuntimeError as e:
        print(f"❌ {e}")
        sys.exit(1)


def cmd_update_rehearsal(args):
    engine = WorkflowEngine(data_dir=args.data_dir)
    if not engine.load_state():
        print("❌ 未找到工作流状态，请先完成前两步")
        sys.exit(1)

    try:
        total, pending = engine.step3_update_rehearsal()
        engine.save_state()
        print(f"✅ 第三步完成：排练变更记录已更新")
        print(f"   共 {total} 条记录，其中 {pending} 条待版权运营复核")
        if pending > 0:
            print(f"   ⏳ 请版权运营同事使用 review 命令进行复核")
    except RuntimeError as e:
        print(f"❌ {e}")
        sys.exit(1)


def cmd_review(args):
    engine = WorkflowEngine(data_dir=args.data_dir)
    if not engine.load_state():
        print("❌ 未找到工作流状态")
        sys.exit(1)

    pending = engine.get_pending_copyright_review()
    if not pending:
        print("✅ 没有待版权运营复核的记录")
        return

    print(f"⏳ 待版权运营复核的记录共 {len(pending)} 条：")
    for i, c in enumerate(pending, 1):
        print(f"  {i}. 轨道 {c.track_id}: {c.track_name}")
        print(f"     留下原因: {c.kept_why}")
        print(f"     变更原因: {c.change_reason}")
        print()

    if args.track_id:
        try:
            engine.mark_copyright_reviewed(
                args.track_id,
                approved=args.approve,
                reviewer_note=args.note or ""
            )
            engine.save_state()
            status = "通过" if args.approve else "需返工"
            print(f"✅ 轨道 {args.track_id} 已标记为{status}")
        except ValueError as e:
            print(f"❌ {e}")
            sys.exit(1)


def cmd_report(args):
    engine = WorkflowEngine(data_dir=args.data_dir)
    if not engine.load_state():
        print("❌ 未找到工作流状态，请先运行导入命令")
        sys.exit(1)

    if args.format == "text":
        output_path = args.output or os.path.join(args.data_dir, "reports", "report.txt")
        report = generate_text_report(engine, output_path)
        print(report)
        print(f"\n📄 报告已保存至: {output_path}")
    elif args.format == "html":
        output_path = args.output or os.path.join(args.data_dir, "reports", "dashboard.html")
        generate_dashboard_html(engine, output_path)
        print(f"🎨 看板已生成: {output_path}")
        print(f"   用浏览器打开即可查看，点击备注可回溯原始票务/音频备注")


def cmd_status(args):
    engine = WorkflowEngine(data_dir=args.data_dir)
    if not engine.load_state():
        print("📋 工作流状态：未开始")
        print("   请先运行: python cli.py import --ticket-csv samples/ticket_export.csv")
        return

    print(f"📋 工作流当前步骤: 第 {engine.state.step} 步")
    print(f"   1. 票务导出表导入: {'✅' if engine.state.ticket_imported else '⏳'}")
    print(f"   2. 阿梅补看音频备注: {'✅' if engine.state.amei_review_done else '⏳'}")
    print(f"   3. 排练变更记录更新: {'✅' if engine.state.rehearsal_updated else '⏳'}")
    print(f"   4. 版权运营复核: {'✅' if engine.state.copyright_review_done else '⏳'}")
    print()

    if engine.tickets:
        rework = sum(1 for t in engine.tickets.values() if t.has_rework_reason)
        print(f"   已导入轨道: {len(engine.tickets)} 条")
        print(f"   含返工原因: {rework} 条")

    if engine.rehearsal_changes:
        pending = sum(
            1 for c in engine.rehearsal_changes.values()
            if c.status.value == "pending_copyright_review"
        )
        print(f"   排练变更记录: {len(engine.rehearsal_changes)} 条")
        print(f"   待版权复核: {pending} 条")


def cmd_demo(args):
    print("🎬 运行完整演示流程...")
    print()

    data_dir = args.data_dir
    ticket_csv = args.ticket_csv or "samples/ticket_export.csv"
    audio_csv = args.audio_csv or "samples/audio_files.csv"

    if not os.path.exists(ticket_csv):
        print(f"❌ 找不到样例文件: {ticket_csv}")
        print("   请确保 samples 目录存在")
        sys.exit(1)

    engine = WorkflowEngine(data_dir=data_dir)

    print("=" * 50)
    print("第一步：导入票务导出表")
    print("=" * 50)
    total, rework = engine.step1_import_tickets(ticket_csv)
    print(f"✅ 导入 {total} 条轨道，{rework} 条含返工原因")
    for t in engine.get_tracks_with_rework():
        print(f"   ⚠️  {t.track_id} {t.track_name}: {t.track_remark}")
    print()

    print("=" * 50)
    print("第二步：巡演统筹阿梅补看音频文件备注")
    print("=" * 50)
    if os.path.exists(audio_csv):
        total, updated = engine.step2_amei_review(audio_csv)
        print(f"✅ 处理 {total} 个音频文件，更新 {updated} 条关联记录")
    else:
        print(f"ℹ️  跳过（无音频文件: {audio_csv}）")
    print()

    print("=" * 50)
    print("第三步：排练变更记录更新")
    print("=" * 50)
    total, pending = engine.step3_update_rehearsal()
    print(f"✅ 生成 {total} 条排练变更记录")
    print(f"   ⏳ {pending} 条待版权运营复核（含返工原因，不会自动归为正常）")
    print()

    engine.save_state()

    print("=" * 50)
    print("生成报告")
    print("=" * 50)
    report_path = os.path.join(data_dir, "reports", "demo_report.txt")
    generate_text_report(engine, report_path)
    print(f"📄 文本报告: {report_path}")

    dashboard_path = os.path.join(data_dir, "reports", "demo_dashboard.html")
    generate_dashboard_html(engine, dashboard_path)
    print(f"🎨 看板页面: {dashboard_path}")
    print()

    print("=" * 50)
    print("🎬 演示完成！")
    print("=" * 50)
    print()
    print("💡 下一步：")
    print("   1. 查看报告了解详情")
    print("   2. 运行 'python cli.py review' 进行版权运营复核")
    print("   3. 打开看板页面点击备注可回溯原始数据")


def main():
    parser = argparse.ArgumentParser(
        description="录音棚工时尾差核对工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
三步工作流：
  1. import  - 导入票务导出表，自动标记含返工原因的轨道
  2. amei    - 巡演统筹阿梅补看音频文件备注
  3. update  - 生成/更新排练变更记录
  4. review  - 版权运营复核（含返工原因的不会自动归为正常）

查看结果：
  status    - 查看当前工作流状态
  report    - 生成文本报告或HTML看板
  demo      - 一键运行完整演示流程
        """
    )
    parser.add_argument("--data-dir", default="data", help="数据目录 (默认: data)")

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    p_import = subparsers.add_parser("import", help="第一步：导入票务导出表")
    p_import.add_argument("--ticket-csv", required=True, help="票务导出表CSV路径")

    p_amei = subparsers.add_parser("amei", help="第二步：阿梅补看音频备注")
    p_amei.add_argument("--audio-csv", required=True, help="音频文件CSV路径")

    subparsers.add_parser("update", help="第三步：更新排练变更记录")

    p_review = subparsers.add_parser("review", help="版权运营复核")
    p_review.add_argument("--track-id", help="轨道编号")
    p_review.add_argument("--approve", action="store_true", help="标记为通过")
    p_review.add_argument("--note", help="复核意见")

    p_report = subparsers.add_parser("report", help="生成报告")
    p_report.add_argument("--format", choices=["text", "html"], default="text", help="报告格式")
    p_report.add_argument("--output", help="输出文件路径")

    subparsers.add_parser("status", help="查看工作流状态")

    p_demo = subparsers.add_parser("demo", help="运行完整演示")
    p_demo.add_argument("--ticket-csv", help="票务导出表CSV (默认: samples/ticket_export.csv)")
    p_demo.add_argument("--audio-csv", help="音频文件CSV (默认: samples/audio_files.csv)")

    args = parser.parse_args()

    if args.command == "import":
        cmd_import(args)
    elif args.command == "amei":
        cmd_amei_review(args)
    elif args.command == "update":
        cmd_update_rehearsal(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "demo":
        cmd_demo(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
