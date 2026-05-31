#!/usr/bin/env python3
"""
机器人足球战术 - 命令行入口

用法：
  # 运行演示场景
  python -m robot_football_tactics.cli demo

  # 比对战报和结算
  python -m robot_football_tactics.cli compare \
    --report report.txt \
    --settlement settlement.txt \
    --unit-table units.csv \
    --terrain terrain.txt

  # 加载多个版本并追踪
  python -m robot_football_tactics.cli load \
    --type unit_table \
    --file units_v2.csv \
    --submitted-by "数值-小王" \
    --comment "平衡性调整" \
    --material-only

  # 查看版本历史
  python -m robot_football_tactics.cli versions

  # 导出复盘报告
  python -m robot_football_tactics.cli export --title "半决赛复盘" --output-dir ./reports
"""

import sys
import argparse
from datetime import datetime
from typing import List

from .main import FootballTactics
from .errors.friendly_errors import FriendlyError


def run_demo(args):
    """运行演示场景"""
    from .tests.test_demo_scenario import run_demo
    return run_demo()


def cmd_load(args):
    """加载文档版本"""
    app = FootballTactics()

    doc_type_map = {
        "unit_table": ("单位表", app.load_unit_table),
        "terrain_rules": ("地形规则", app.load_terrain_rules),
        "battle_report": ("战报", app.load_battle_report),
        "battle_settlement": ("结算数据", app.load_settlement),
    }

    if args.type not in doc_type_map:
        print(f"❌ 不支持的文档类型：{args.type}")
        print(f"   支持的类型：{', '.join(doc_type_map.keys())}")
        return 1

    doc_name, load_func = doc_type_map[args.type]

    submitted_at = None
    if args.submitted_at:
        try:
            submitted_at = datetime.fromisoformat(args.submitted_at)
        except ValueError:
            print(f"❌ 时间格式不正确：{args.submitted_at}")
            print("   请使用 ISO 格式：2024-06-15T14:30:00")
            return 1

    try:
        doc, warnings = load_func(
            filepath=args.file,
            submitted_by=args.submitted_by,
            comment=args.comment,
            version_id=args.version_id,
            submitted_at=submitted_at,
            is_material_only=args.material_only,
            doc_name=args.name or doc_name
        )

        print(f"✅ 已加载 {doc_name} v{doc.version.version_id}")
        if args.material_only:
            print(f"   标记为：补材料（不影响结论）")
        if warnings:
            print(f"⚠️  有 {len(warnings)} 条警告：")
            for w in warnings:
                print(f"   - {w.to_human_string()}")

    except FriendlyError as e:
        print(f"\n❌ 加载失败：")
        print(e.to_human_string())
        return 1

    return 0


def cmd_compare(args):
    """比对战报和结算"""
    app = FootballTactics()

    try:
        if args.unit_table:
            app.load_unit_table(args.unit_table, submitted_by=args.submitted_by)
            print(f"✅ 已加载单位表")

        if args.terrain:
            app.load_terrain_rules(args.terrain, submitted_by=args.submitted_by)
            print(f"✅ 已加载地形规则")

        app.load_battle_report(args.report, submitted_by=args.submitted_by)
        print(f"✅ 已加载战报")

        app.load_settlement(args.settlement, submitted_by=args.submitted_by)
        print(f"✅ 已加载结算数据")
        print()

        result = app.compare()
        print(result.to_human_string())

        if args.export:
            output_dir = args.output_dir or "."
            text_path, json_path = app.export_review_report(
                title=args.title or "比对报告",
                comparison_report=result,
                output_dir=output_dir
            )
            print()
            print(f"📤 报告已导出：")
            print(f"   文本：{text_path}")
            print(f"   JSON：{json_path}")

        if result.has_errors():
            return 1
        return 0

    except FriendlyError as e:
        print(f"\n❌ 比对失败：")
        print(e.to_human_string())
        return 1


def cmd_versions(args):
    """查看版本历史"""
    app = FootballTactics()
    print(app.list_versions())
    return 0


def cmd_export(args):
    """导出复盘报告"""
    app = FootballTactics()

    try:
        text_path, json_path = app.export_review_report(
            title=args.title or "复盘报告",
            output_dir=args.output_dir or "."
        )
        print(f"📤 复盘报告已导出：")
        print(f"   文本：{text_path}")
        print(f"   JSON：{json_path}")
        return 0
    except FriendlyError as e:
        print(f"\n❌ 导出失败：")
        print(e.to_human_string())
        return 1


def cmd_diff(args):
    """比较两个版本的差异"""
    app = FootballTactics()

    try:
        result = app.get_version_changes(
            doc_type=args.type,
            doc_name=args.name,
            old_version_id=args.old_version,
            new_version_id=args.new_version
        )
        print(result)
        return 0
    except FriendlyError as e:
        print(f"\n❌ 比较失败：")
        print(e.to_human_string())
        return 1


def main():
    parser = argparse.ArgumentParser(
        prog="robot-football-tactics",
        description="机器人足球战术 - 战报结算一致性核查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  # 运行完整演示
  %(prog)s demo

  # 简单比对
  %(prog)s compare --report report.txt --settlement settlement.txt

  # 带完整材料比对并导出报告
  %(prog)s compare \
    --report report.txt \
    --settlement settlement.txt \
    --unit-table units.csv \
    --terrain terrain.txt \
    --export --title "半决赛复盘"

  # 加载新版本（标记为补材料）
  %(prog)s load \
    --type terrain_rules \
    --file terrain_v2.txt \
    --submitted-by "策划-小李" \
    --comment "补上地形效果" \
    --material-only

  # 查看所有版本
  %(prog)s versions

  # 导出复盘报告
  %(prog)s export --title "半决赛复盘" --output-dir ./reports
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    demo_parser = subparsers.add_parser("demo", help="运行演示场景")
    demo_parser.set_defaults(func=run_demo)

    load_parser = subparsers.add_parser("load", help="加载文档版本")
    load_parser.add_argument("--type", required=True,
                            choices=["unit_table", "terrain_rules", "battle_report", "battle_settlement"],
                            help="文档类型")
    load_parser.add_argument("--file", required=True, help="文件路径")
    load_parser.add_argument("--name", help="文档名称（用于区分同类型文档）")
    load_parser.add_argument("--submitted-by", default="未知", help="提交人")
    load_parser.add_argument("--comment", default="", help="备注")
    load_parser.add_argument("--version-id", help="版本号（自动递增）")
    load_parser.add_argument("--submitted-at", help="提交时间（ISO格式，默认当前时间）")
    load_parser.add_argument("--material-only", action="store_true",
                            help="标记为补材料（不影响结论）")
    load_parser.set_defaults(func=cmd_load)

    compare_parser = subparsers.add_parser("compare", help="比对战报和结算")
    compare_parser.add_argument("--report", required=True, help="战报文件路径")
    compare_parser.add_argument("--settlement", required=True, help="结算文件路径")
    compare_parser.add_argument("--unit-table", help="单位表文件路径")
    compare_parser.add_argument("--terrain", help="地形规则文件路径")
    compare_parser.add_argument("--submitted-by", default="未知", help="提交人")
    compare_parser.add_argument("--export", action="store_true", help="比对完成后导出报告")
    compare_parser.add_argument("--title", help="报告标题")
    compare_parser.add_argument("--output-dir", default=".", help="输出目录")
    compare_parser.set_defaults(func=cmd_compare)

    versions_parser = subparsers.add_parser("versions", help="查看版本历史")
    versions_parser.set_defaults(func=cmd_versions)

    export_parser = subparsers.add_parser("export", help="导出复盘报告")
    export_parser.add_argument("--title", default="复盘报告", help="报告标题")
    export_parser.add_argument("--output-dir", default=".", help="输出目录")
    export_parser.set_defaults(func=cmd_export)

    diff_parser = subparsers.add_parser("diff", help="比较两个版本的差异")
    diff_parser.add_argument("--type", required=True,
                            choices=["unit_table", "terrain_rules", "battle_report", "battle_settlement"],
                            help="文档类型")
    diff_parser.add_argument("--name", default="", help="文档名称")
    diff_parser.add_argument("--old-version", required=True, help="旧版本号")
    diff_parser.add_argument("--new-version", required=True, help="新版本号")
    diff_parser.set_defaults(func=cmd_diff)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\n\n已取消操作")
        return 130
    except FriendlyError as e:
        print(f"\n❌ 出错了：")
        print(e.to_human_string())
        print()
        print("技术细节：")
        print(e.to_tech_string())
        return 1
    except Exception as e:
        print(f"\n❌ 未知错误：{e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
