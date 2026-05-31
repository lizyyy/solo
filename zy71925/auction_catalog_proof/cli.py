"""
命令行接口
==========

提供简单易用的命令行操作界面
"""

import os
import sys
import argparse
from datetime import datetime
from typing import Optional

from .models import CatalogProofSession
from .data_import import (
    import_works_list,
    import_wall_layout,
    write_sample_data,
    ImportError,
)
from .proof_engine import (
    run_proof,
    confirm_record,
    resolve_difference,
    resolve_lighting_conflict,
    mark_needs_info,
    get_statistics,
    get_lot_history,
    format_history_for_display,
)
from .report_generator import (
    generate_html_report,
    export_exhibition_list_csv,
    export_session_json,
)
from .exporter import (
    export_corrected_works_list,
    export_wall_layout_with_proof,
    export_proof_summary,
    print_summary,
)


def cmd_init(args):
    output_dir = args.output_dir or "data"
    write_sample_data(output_dir)
    print(f"\n✅ 示例数据已生成到 {os.path.abspath(output_dir)} 目录")
    print("\n接下来可以运行：")
    print(f"  python -m auction_catalog_proof proof {output_dir}/sample_works_list.csv {output_dir}/sample_wall_layout.csv")


def cmd_proof(args):
    session_name = args.name or f"校对会话_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    session = CatalogProofSession(
        session_name=session_name,
        works_list_source=args.works_list,
        wall_layout_source=args.wall_layout,
    )

    try:
        print("📥 正在导入作品清单...")
        import_works_list(args.works_list, session)
        print(f"   ✓ 导入了 {len(session.artworks)} 件作品")

        print("📥 正在导入展墙图...")
        import_wall_layout(args.wall_layout, session)
        print(f"   ✓ 导入了 {len(session.wall_layouts)} 条展墙记录")

        print("🔍 正在执行校对...")
        differences, lighting_conflicts = run_proof(session)
        print(f"   ✓ 发现 {len(differences)} 处差异，{len(lighting_conflicts)} 个灯光冲突")

    except ImportError as e:
        print(f"\n❌ 导入失败：{e.user_message}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 出错了：{e}")
        sys.exit(1)

    print_summary(session)

    output_dir = args.output_dir or "output"
    os.makedirs(output_dir, exist_ok=True)

    session_file = os.path.join(output_dir, f"{session_name}.json")
    export_session_json(session, session_file)
    print(f"💾 会话已保存：{session_file}")

    html_file = os.path.join(output_dir, f"{session_name}_报告.html")
    generate_html_report(session, html_file, title=f"{session_name} - 拍卖图录校对报告")
    print(f"📄 HTML报告已生成：{html_file}")

    csv_file = os.path.join(output_dir, f"{session_name}_布展清单.csv")
    export_exhibition_list_csv(session, csv_file)
    print(f"📊 布展清单已导出：{csv_file}")

    summary_file = os.path.join(output_dir, f"{session_name}_校对摘要.json")
    export_proof_summary(session, summary_file)
    print(f"📋 校对摘要已导出：{summary_file}")

    print(f"\n🎉 校对完成！所有文件都在 {os.path.abspath(output_dir)} 目录里")
    print(f"\n要打开报告，请在浏览器中打开：{os.path.abspath(html_file)}")

    return session


def cmd_resume(args):
    if not os.path.exists(args.session_file):
        print(f"❌ 找不到会话文件：{args.session_file}")
        sys.exit(1)

    session = CatalogProofSession.load(args.session_file)
    print(f"✅ 已加载会话：{session.session_name}")
    print(f"   创建时间：{session.created_at}")

    stats = get_statistics(session)
    print(f"   当前进度：{stats['confirmed'] + stats['manual_edited']}/{stats['total_lots']} 件已处理")

    return session


def cmd_resolve(args):
    session = cmd_resume(args)

    diff_key = args.difference_key
    if diff_key not in session.differences:
        print(f"❌ 找不到差异记录：{diff_key}")
        print("可用的差异记录：")
        for key, diff in session.differences.items():
            if diff.status == "pending":
                print(f"  {key}: {diff.lot_number} - {diff.field_label}")
        sys.exit(1)

    diff = session.differences[diff_key]
    print(f"\n当前差异：{diff.lot_number} - {diff.field_label}")
    print(f"  作品清单：{diff.works_list_value}")
    print(f"  展墙图：{diff.wall_layout_value}")

    if args.custom:
        resolve_difference(
            session,
            diff_key,
            custom_value=args.custom,
            operator=args.operator or "user",
            notes=args.notes,
        )
        print(f"✅ 已使用自定义值：{args.custom}")
    elif args.use_works_list:
        resolve_difference(
            session,
            diff_key,
            use_works_list=True,
            operator=args.operator or "user",
            notes=args.notes,
        )
        print(f"✅ 已采用作品清单的值：{diff.works_list_value}")
    elif args.use_wall_layout:
        resolve_difference(
            session,
            diff_key,
            use_works_list=False,
            operator=args.operator or "user",
            notes=args.notes,
        )
        print(f"✅ 已采用展墙图的值：{diff.wall_layout_value}")
    else:
        print("\n请指定使用哪个值：")
        print(f"  --use-works-list : 使用作品清单的值")
        print(f"  --use-wall-layout: 使用展墙图的值")
        print(f"  --custom \"值\"   : 使用自定义的值")
        sys.exit(1)

    session.save(args.session_file)
    print(f"💾 会话已保存")


def cmd_resolve_lighting(args):
    session = cmd_resume(args)

    lot = args.lot_number
    if lot not in session.lighting_conflicts:
        print(f"❌ 找不到拍品 {lot} 的灯光冲突记录")
        print("可用的灯光冲突：")
        for key, conflict in session.lighting_conflicts.items():
            if conflict.status == "pending":
                print(f"  {key}")
        sys.exit(1)

    conflict = session.lighting_conflicts[lot]
    print(f"\n当前灯光冲突：{lot}")
    print(f"  作品清单要求：{conflict.works_list_lighting}")
    print(f"  展墙图使用：{conflict.wall_layout_lighting}")

    if args.custom:
        resolve_lighting_conflict(
            session,
            lot,
            custom_value=args.custom,
            operator=args.operator or "user",
            notes=args.notes,
        )
        print(f"✅ 已使用自定义灯光方案：{args.custom}")
    elif args.use_works_list:
        resolve_lighting_conflict(
            session,
            lot,
            use_works_list=True,
            operator=args.operator or "user",
            notes=args.notes,
        )
        print(f"✅ 已采用作品清单的灯光方案：{conflict.works_list_lighting}")
    elif args.use_wall_layout:
        resolve_lighting_conflict(
            session,
            lot,
            use_works_list=False,
            operator=args.operator or "user",
            notes=args.notes,
        )
        print(f"✅ 已采用展墙图的灯光方案：{conflict.wall_layout_lighting}")
    else:
        print("\n请指定使用哪个灯光方案：")
        print(f"  --use-works-list : 使用作品清单的方案")
        print(f"  --use-wall-layout: 使用展墙图的方案")
        print(f"  --custom \"方案\"   : 使用自定义的方案")
        sys.exit(1)

    session.save(args.session_file)
    print(f"💾 会话已保存")


def cmd_confirm(args):
    session = cmd_resume(args)

    if args.all:
        for lot in list(session.proof_records.keys()):
            confirm_record(session, lot, operator=args.operator or "user")
        print(f"✅ 已确认所有记录")
    else:
        for lot in args.lot_numbers:
            if lot not in session.proof_records:
                print(f"⚠️  找不到拍品 {lot}，跳过")
                continue
            confirm_record(session, lot, operator=args.operator or "user", notes=args.notes)
            print(f"✅ 已确认 {lot}")

    session.save(args.session_file)
    print(f"💾 会话已保存")


def cmd_needs_info(args):
    session = cmd_resume(args)

    mark_needs_info(
        session,
        args.lot_number,
        notes=args.notes,
        operator=args.operator or "user",
    )
    print(f"✅ 已将 {args.lot_number} 标记为待补充")
    print(f"   备注：{args.notes}")

    session.save(args.session_file)
    print(f"💾 会话已保存")


def cmd_export(args):
    session = cmd_resume(args)

    output_dir = args.output_dir or "output"
    os.makedirs(output_dir, exist_ok=True)

    base_name = session.session_name

    if args.type in ["all", "html"]:
        html_file = os.path.join(output_dir, f"{base_name}_报告.html")
        generate_html_report(session, html_file, title=f"{session.session_name} - 拍卖图录校对报告")
        print(f"📄 HTML报告：{html_file}")

    if args.type in ["all", "exhibition"]:
        csv_file = os.path.join(output_dir, f"{base_name}_布展清单.csv")
        export_exhibition_list_csv(session, csv_file)
        print(f"📊 布展清单：{csv_file}")

    if args.type in ["all", "works_list"]:
        wl_file = os.path.join(output_dir, f"{base_name}_校对后_作品清单.csv")
        export_corrected_works_list(session, wl_file)
        print(f"📋 校对后作品清单：{wl_file}")

    if args.type in ["all", "wall_layout"]:
        wl_file = os.path.join(output_dir, f"{base_name}_校对后_展墙图.csv")
        export_wall_layout_with_proof(session, wl_file)
        print(f"🖼️  校对后展墙图：{wl_file}")

    if args.type in ["all", "summary"]:
        summary_file = os.path.join(output_dir, f"{base_name}_校对摘要.json")
        export_proof_summary(session, summary_file)
        print(f"📝 校对摘要：{summary_file}")

    print(f"\n🎉 导出完成！所有文件都在 {os.path.abspath(output_dir)} 目录里")


def cmd_history(args):
    session = cmd_resume(args)

    if args.lot_number:
        entries = get_lot_history(session, args.lot_number)
        print(f"\n📜 {args.lot_number} 的操作历史：")
    else:
        entries = sorted(session.history, key=lambda h: h.timestamp, reverse=True)
        print(f"\n📜 全部操作历史（最近50条）：")
        entries = entries[:50]

    display = format_history_for_display(entries)
    for i, entry in enumerate(display):
        marker = "🆕" if i == 0 else "  "
        print(f"\n{marker} {entry['timestamp']}")
        print(f"   操作：{entry['action']}")
        if entry['operator']:
            print(f"   操作人：{entry['operator']}")
        if entry['notes']:
            print(f"   备注：{entry['notes']}")


def cmd_status(args):
    session = cmd_resume(args)
    print_summary(session)


def main():
    parser = argparse.ArgumentParser(
        prog="auction_catalog_proof",
        description="拍卖图录校对系统 - 解决作品清单和展墙图对不上的问题",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    init_parser = subparsers.add_parser("init", help="生成示例数据，快速上手")
    init_parser.add_argument("--output-dir", help="输出目录，默认 data")
    init_parser.set_defaults(func=cmd_init)

    proof_parser = subparsers.add_parser("proof", help="执行校对，导入数据并比对")
    proof_parser.add_argument("works_list", help="作品清单文件路径（CSV/Excel）")
    proof_parser.add_argument("wall_layout", help="展墙图文件路径（CSV/Excel）")
    proof_parser.add_argument("--name", help="会话名称")
    proof_parser.add_argument("--output-dir", help="输出目录，默认 output")
    proof_parser.set_defaults(func=cmd_proof)

    resolve_parser = subparsers.add_parser("resolve", help="解决一处差异")
    resolve_parser.add_argument("session_file", help="会话文件路径")
    resolve_parser.add_argument("difference_key", help="差异记录ID")
    resolve_parser.add_argument("--use-works-list", action="store_true", help="采用作品清单的值")
    resolve_parser.add_argument("--use-wall-layout", action="store_true", help="采用展墙图的值")
    resolve_parser.add_argument("--custom", help="使用自定义值")
    resolve_parser.add_argument("--operator", help="操作人姓名")
    resolve_parser.add_argument("--notes", help="处理备注")
    resolve_parser.set_defaults(func=cmd_resolve)

    resolve_lighting_parser = subparsers.add_parser("resolve-lighting", help="解决灯光方案冲突")
    resolve_lighting_parser.add_argument("session_file", help="会话文件路径")
    resolve_lighting_parser.add_argument("lot_number", help="拍品编号")
    resolve_lighting_parser.add_argument("--use-works-list", action="store_true", help="采用作品清单的方案")
    resolve_lighting_parser.add_argument("--use-wall-layout", action="store_true", help="采用展墙图的方案")
    resolve_lighting_parser.add_argument("--custom", help="使用自定义方案")
    resolve_lighting_parser.add_argument("--operator", help="操作人姓名")
    resolve_lighting_parser.add_argument("--notes", help="处理备注")
    resolve_lighting_parser.set_defaults(func=cmd_resolve_lighting)

    confirm_parser = subparsers.add_parser("confirm", help="确认记录无误")
    confirm_parser.add_argument("session_file", help="会话文件路径")
    confirm_parser.add_argument("lot_numbers", nargs="*", help="拍品编号，可多个")
    confirm_parser.add_argument("--all", action="store_true", help="确认所有记录")
    confirm_parser.add_argument("--operator", help="操作人姓名")
    confirm_parser.add_argument("--notes", help="确认备注")
    confirm_parser.set_defaults(func=cmd_confirm)

    needs_info_parser = subparsers.add_parser("needs-info", help="标记为待补充信息")
    needs_info_parser.add_argument("session_file", help="会话文件路径")
    needs_info_parser.add_argument("lot_number", help="拍品编号")
    needs_info_parser.add_argument("notes", help="需要补充的信息说明")
    needs_info_parser.add_argument("--operator", help="操作人姓名")
    needs_info_parser.set_defaults(func=cmd_needs_info)

    export_parser = subparsers.add_parser("export", help="导出校对结果")
    export_parser.add_argument("session_file", help="会话文件路径")
    export_parser.add_argument(
        "--type",
        choices=["all", "html", "exhibition", "works_list", "wall_layout", "summary"],
        default="all",
        help="导出类型，默认 all",
    )
    export_parser.add_argument("--output-dir", help="输出目录，默认 output")
    export_parser.set_defaults(func=cmd_export)

    history_parser = subparsers.add_parser("history", help="查看操作历史")
    history_parser.add_argument("session_file", help="会话文件路径")
    history_parser.add_argument("--lot-number", help="指定拍品编号，不指定则显示全部")
    history_parser.set_defaults(func=cmd_history)

    status_parser = subparsers.add_parser("status", help="查看当前校对进度")
    status_parser.add_argument("session_file", help="会话文件路径")
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        print("\n💡 快速上手：")
        print("  1. 先生成示例数据：python -m auction_catalog_proof init")
        print("  2. 然后执行校对：python -m auction_catalog_proof proof data/sample_works_list.csv data/sample_wall_layout.csv")
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()
