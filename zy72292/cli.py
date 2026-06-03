#!/usr/bin/env python3
import argparse
import sys

from processor import SketchProcessor
from report_generator import ReportGenerator
from demo_data import create_demo_playback, create_step_by_step_demo


def cmd_run_demo(args):
    print("🎬 运行大型会展摊位视线图完整演示...")
    print()
    playback = create_demo_playback()
    report = ReportGenerator.generate_playback_report(playback)
    print(report)

    if args.export:
        with open(args.export, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n✓ 报告已导出至: {args.export}")


def cmd_teaching_demo(args):
    print("📚 启动教学演示模式 - 三步流程演示")
    print("=" * 60)

    data = create_step_by_step_demo()
    playback = data["playback"]
    processor = data["processor"]

    print("\n✅ 【第一步完成】楼层剖面草图第一次导入")
    print(f"   草图名称: {playback.sketch.name}")
    print(f"   导入人: {playback.sketch.importer}")
    print(f"   Z轴方向: {playback.sketch.z_axis_direction}")
    if playback.issues:
        print(f"   ⚠️  发现问题: {playback.issues[0].description}")
        print(f"   📌 为什么留下: {playback.issues[0].why_kept}")
        print(f"   🚩 下一步: {playback.issues[0].next_action.value}")

    input("\n按回车进入第二步 >> ")

    print("\n✅ 【第二步进行中】航测内业小魏补看点云抽稀日志")
    processor.add_point_cloud_log(
        playback=playback,
        operator="航测内业-小魏",
        action="补录点云抽稀日志",
        thinning_ratio=0.25,
        parameters={"algorithm": "随机采样"},
        notes="确认Z轴坐标系，内业标准与现场习惯存在差异，需要现场班组复核",
    )
    print("   日志已补录，问题状态已更新")
    print(f"   📌 更新说明: {playback.issues[0].why_kept.splitlines()[-1]}")
    print(f"   🚩 下一步: {playback.issues[0].next_action.value}")

    input("\n按回车进入第三步 >> ")

    print("\n✅ 【第三步完成】路径回放更新")
    report = ReportGenerator.generate_playback_report(playback)
    print(report)

    if args.export:
        with open(args.export, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n✓ 教学演示报告已导出至: {args.export}")


def cmd_import(args):
    print(f"📥 导入楼层剖面草图: {args.file}")
    processor = SketchProcessor()

    playback = processor.create_playback(args.project or "未命名项目")

    result = processor.import_sketch(
        name=args.name or "导入草图",
        importer=args.operator or "未知操作员",
        floor_number=args.floor or 1,
        z_axis_direction=args.z_axis or "up",
        stall_coordinates=[{"x": 0, "y": 0, "z": 0, "stall_id": "T001"}],
    )

    playback.sketch = result["sketch"]
    playback.issues.extend(result["issues"])

    report = ReportGenerator.generate_playback_report(playback)
    print(report)


def cmd_report(args):
    print("📊 生成路径回放报告")
    playback = create_demo_playback()
    print(ReportGenerator.generate_playback_report(playback))


def main():
    parser = argparse.ArgumentParser(
        description="大型会展摊位视线图系统 - 命令行接口",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py demo                  # 运行完整演示
  python cli.py teaching              # 教学三步演示
  python cli.py import sketch.dxf     # 导入草图文件
  python cli.py report                # 生成报告
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    demo_parser = subparsers.add_parser("demo", help="运行完整演示")
    demo_parser.add_argument("--export", "-e", help="导出报告到文件")
    demo_parser.set_defaults(func=cmd_run_demo)

    teach_parser = subparsers.add_parser("teaching", help="教学三步演示")
    teach_parser.add_argument("--export", "-e", help="导出报告到文件")
    teach_parser.set_defaults(func=cmd_teaching_demo)

    import_parser = subparsers.add_parser("import", help="导入楼层剖面草图")
    import_parser.add_argument("file", help="草图文件路径")
    import_parser.add_argument("--name", "-n", help="项目名称")
    import_parser.add_argument("--project", "-p", help="项目名称")
    import_parser.add_argument("--operator", "-o", help="操作员姓名")
    import_parser.add_argument("--floor", "-f", type=int, help="楼层号")
    import_parser.add_argument("--z-axis", help="Z轴方向 (up/down)")
    import_parser.set_defaults(func=cmd_import)

    report_parser = subparsers.add_parser("report", help="生成报告")
    report_parser.set_defaults(func=cmd_report)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
