"""命令行入口

一致性保证：所有参数版本相关的统计，
统一调用 processor 中的 get_latest_parameter_versions / count_todo_by_latest_versions
确保与 API / 报告 / Web 面板展示的是同一份最新结果。
"""
import argparse
import os
import sys
from .processor import (
    import_segments_from_csv,
    load_project,
    supplement_questionnaire_row,
    review_gap,
    review_segment_parameter,
    generate_report,
    get_latest_parameter_versions,
    get_parameter_version_history,
    count_todo_by_latest_versions,
    _translate_status,
)


def cmd_import(args):
    """第一步：导入手算反例"""
    print(f"正在导入 {args.input} ...")
    project = import_segments_from_csv(args.input, args.name)
    output_path = args.output or f"{args.name}.json"
    project.save(output_path)

    needs_qi, needs_review = count_todo_by_latest_versions(project)
    print(f"✓ 导入完成，项目已保存至: {output_path}")
    print(f"  项目版本: v{project.version}")
    print(f"  - 线段总数: {len(project.segments)}")
    print(f"  - 检测冲突: {len(project.conflicts)}")
    print(f"  - 编号断档: {len(project.gaps)}")
    print(f"  - 待数据分析师小祁: {needs_qi} 条（基于最新参数版本去重）")
    print(f"  - 待教研组复核: {needs_review} 条（基于最新参数版本去重）")

    if args.report:
        report_path = args.report if isinstance(args.report, str) else f"{args.name}_report.txt"
        generate_report(project, report_path)
        print(f"✓ 报告已生成: {report_path}")


def cmd_supplement(args):
    """第二步：数据分析师小祁补录问卷原始行"""
    print(f"正在加载项目 {args.project} ...")
    project = load_project(args.project)

    # 补录前的状态，用于对比展示
    latest_before = get_latest_parameter_versions(project)
    pv_before = latest_before.get(args.segment_id)
    before_status = pv_before.status if pv_before else "unknown"
    before_missing = pv_before.missing_materials if pv_before else []

    project = supplement_questionnaire_row(
        project, args.segment_id, args.questionnaire_row
    )
    project.save(args.project)

    latest_after = get_latest_parameter_versions(project)
    pv_after = latest_after.get(args.segment_id)
    after_status = pv_after.status if pv_after else "unknown"
    after_missing = pv_after.missing_materials if pv_after else []
    after_kept = pv_after.kept_reason if pv_after else ""
    after_next = pv_after.next_owner if pv_after else ""

    print(f"✓ 线段 {args.segment_id} 已补录问卷原始行: {args.questionnaire_row}")
    print(f"  状态变更: {before_status} → {after_status}")
    print(f"  还缺什么材料（补录前）: {before_missing or '无'}")
    print(f"  还缺什么材料（补录后）: {after_missing or '无'}")
    print(f"  保留原因: {after_kept}")
    print(f"  下一步找谁: {after_next}")
    print(f"  项目新版本: v{project.version}")

    if args.report:
        generate_report(project, args.report)
        print(f"✓ 更新报告已生成: {args.report}")


def cmd_review(args):
    """第三步：教研组复核断档"""
    print(f"正在加载项目 {args.project} ...")
    project = load_project(args.project)

    gap_before_status = project.gaps[args.gap_index].status
    project = review_gap(
        project,
        args.gap_index,
        args.approved,
        args.note,
    )
    project.save(args.project)

    gap_after = project.gaps[args.gap_index]
    status_text = "通过" if args.approved else "驳回"
    print(f"✓ 断档 {args.gap_index} 复核{status_text}: {args.note}")
    print(f"  断档状态: {gap_before_status} → {gap_after.status}")
    print(f"  相邻线段参数版本已同步追加（记录本次复核影响）")
    print(f"  项目新版本: v{project.version}")


def cmd_review_param(args):
    """直接复核单条线段参数版本"""
    print(f"正在加载项目 {args.project} ...")
    project = load_project(args.project)
    project = review_segment_parameter(
        project, args.segment_id, args.approved, args.note
    )
    project.save(args.project)
    print(f"✓ 线段参数版本 {args.segment_id} 复核完毕，新版本 v{project.version}")


def cmd_report(args):
    """生成报告"""
    print(f"正在生成报告 ...")
    project = load_project(args.project)
    generate_report(project, args.output)

    needs_qi, needs_review = count_todo_by_latest_versions(project)
    print(f"✓ 报告已生成: {args.output}")
    print(f"  报告版本: v{project.version}")
    print(f"  待小祁: {needs_qi} 条 / 待教研组: {needs_review} 条（与 CLI status/API/Web 一致）")


def cmd_status(args):
    """查看项目状态（所有计数基于最新参数版本去重，与其他入口一致）"""
    project = load_project(args.project)
    active = [s for s in project.segments if not s.is_deleted]
    deleted = [s for s in project.segments if s.is_deleted]
    pending_gaps = [g for g in project.gaps if g.status == "pending_supplement"]
    needs_qi, needs_review = count_todo_by_latest_versions(project)

    print(f"\n{'=' * 56}")
    print(f"  项目状态摘要（与 API / 报告 / Web 面板一致）")
    print(f"{'=' * 56}")
    print(f"项目: {project.name} (v{project.version})")
    print(f"更新时间: {project.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"\n线段: {len(active)} 有效 / {len(deleted)} 已删除")
    print(f"冲突: {len(project.conflicts)} 处")
    print(f"断档: {len(project.gaps)} 处，其中待补录 {len(pending_gaps)} 处")
    print(f"\n待处理（基于最新参数版本去重）:")
    print(f"  □ 数据分析师小祁: {needs_qi} 条需补录")
    print(f"  □ 教研组: {needs_review} 条需复核")

    if project.gaps:
        print(f"\n断档列表:")
        for i, g in enumerate(project.gaps):
            marker = "!" if g.status == "pending_supplement" else "·"
            progress = (
                f" 补录进度 {len(g.supplemented_rows)}/{g.missing_count}"
                if g.supplemented_rows
                else ""
            )
            reviewer = f" 复核人:{g.reviewed_by}" if g.reviewed_by else ""
            print(
                f"  [{i}] {marker} 第{g.gap_start}-{g.gap_end}行"
                f" <{_translate_status(g.status)}>{progress}{reviewer}"
            )

    # 展示每条线段的最新参数版本（与报告/面板一致）
    latest_pvs = get_latest_parameter_versions(project)
    print(f"\n参数版本页（每条线段仅展示最新版本）:")
    print(f"  {'ID':<4} {'名称':<12} {'v':<3} {'状态':<16} {'下一步找谁'}")
    print(f"  {'-' * 4} {'-' * 12} {'-' * 3} {'-' * 16} {'-' * 16}")
    for sid in sorted(latest_pvs.keys()):
        pv = latest_pvs[sid]
        seg = next((s for s in project.segments if s.id == sid), None)
        name = seg.name if seg else "?"
        owner_short = pv.next_owner.replace("数据分析师小祁", "小祁")
        print(
            f"  {sid:<4} {name:<12} v{pv.version:<2}"
            f" {_translate_status(pv.status):<16} {owner_short}"
        )

    # 变更历史计数
    total_versions = len(project.parameter_versions)
    if total_versions > len(latest_pvs):
        print(
            f"\n注: 共 {total_versions} 条参数版本历史记录，"
            f"已按每条线段取最新版本展示；"
            f"详情请见报告第六部分或参数版本历史命令。"
        )
    if project.review_records:
        print(
            f"人工复核记录: {len(project.review_records)} 条"
            f"（原始说法→改后值→处理原因→下一步找谁）"
        )
    print()


def cmd_history(args):
    """查看单条线段的参数版本完整历史"""
    project = load_project(args.project)
    history = get_parameter_version_history(project, args.segment_id)
    if not history:
        print(f"线段 {args.segment_id} 无参数版本历史")
        return

    seg = next((s for s in project.segments if s.id == args.segment_id), None)
    print(f"\n线段 #{args.segment_id} ({seg.name if seg else '未知'}) 完整变更链:")
    print(f"{'=' * 60}")
    for pv in history:
        print(f"  v{pv.version}  <{_translate_status(pv.status)}>")
        print(f"    操作人: {pv.created_by}  @ {pv.created_at.strftime('%Y-%m-%d %H:%M')}")
        if pv.original_value:
            print(f"    原始说法: {pv.original_value}")
        if pv.new_value:
            print(f"    改后值  : {pv.new_value}")
        if pv.change_reason:
            print(f"    处理原因: {pv.change_reason}")
        print(f"    为什么被留下: {pv.kept_reason}")
        print(
            f"    还缺什么材料: "
            f"{'、'.join(pv.missing_materials) if pv.missing_materials else '无'}"
        )
        print(f"    下一步找谁: {pv.next_owner}")
        if pv.change_log:
            print(f"    变更记录: {' | '.join(pv.change_log)}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description="线段相交施工冲突检测系统（全链路数据一致性）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
三步核心流程（导入→补录→报告，所有入口基于同一份最新结果）：
  ① 导入手算反例
     python -m segment_conflict.cli import -i samples/hand_calculated.csv -n 试点项目 -r

  ② 查看状态（与 API / 报告 / Web 一致）
     python -m segment_conflict.cli status -p 试点项目.json

  ③ 数据分析师小祁补录问卷原始行
     python -m segment_conflict.cli supplement -p 试点项目.json -s 3 -q 3

  ④ 教研组复核断档（不急着归正常，保留记录链）
     python -m segment_conflict.cli review -p 试点项目.json -g 0 --approved --note "数据完整"

  ⑤ 生成报告（全链路串到同一份数据）
     python -m segment_conflict.cli report -p 试点项目.json -o 报告.txt

  ⑥ 查看单条线段完整变更链
     python -m segment_conflict.cli history -p 试点项目.json -s 3
        """,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # import
    p_import = subparsers.add_parser("import", help="① 导入手算反例CSV")
    p_import.add_argument("-i", "--input", required=True, help="CSV输入文件")
    p_import.add_argument("-n", "--name", required=True, help="项目名称")
    p_import.add_argument("-o", "--output", help="项目JSON输出路径")
    p_import.add_argument(
        "-r", "--report", nargs="?", const=True,
        help="同时生成报告（可加路径）"
    )

    # supplement
    p_supp = subparsers.add_parser("supplement", help="② 小祁补录问卷原始行")
    p_supp.add_argument("-p", "--project", required=True, help="项目JSON")
    p_supp.add_argument("-s", "--segment-id", type=int, required=True, help="线段ID")
    p_supp.add_argument(
        "-q", "--questionnaire-row", type=int, required=True, help="问卷原始行号"
    )
    p_supp.add_argument("-r", "--report", help="同步更新报告路径")

    # review gap
    p_rev = subparsers.add_parser("review", help="③ 教研组复核断档")
    p_rev.add_argument("-p", "--project", required=True, help="项目JSON")
    p_rev.add_argument("-g", "--gap-index", type=int, required=True, help="断档索引")
    p_rev.add_argument("--approved", action="store_true", help="通过复核")
    p_rev.add_argument("--note", required=True, help="复核意见")

    # review parameter
    p_rp = subparsers.add_parser("review-param", help="③+ 教研组复核参数版本")
    p_rp.add_argument("-p", "--project", required=True)
    p_rp.add_argument("-s", "--segment-id", type=int, required=True)
    p_rp.add_argument("--approved", action="store_true")
    p_rp.add_argument("--note", required=True)

    # report
    p_rep = subparsers.add_parser("report", help="生成报告")
    p_rep.add_argument("-p", "--project", required=True)
    p_rep.add_argument("-o", "--output", required=True)

    # status
    p_stat = subparsers.add_parser("status", help="查看项目状态（全链路一致）")
    p_stat.add_argument("-p", "--project", required=True)

    # history
    p_hist = subparsers.add_parser("history", help="查看线段完整变更历史")
    p_hist.add_argument("-p", "--project", required=True)
    p_hist.add_argument("-s", "--segment-id", type=int, required=True)

    args = parser.parse_args()

    commands = {
        "import": cmd_import,
        "supplement": cmd_supplement,
        "review": cmd_review,
        "review-param": cmd_review_param,
        "report": cmd_report,
        "status": cmd_status,
        "history": cmd_history,
    }
    commands[args.command](args)


if __name__ == "__main__":
    main()
