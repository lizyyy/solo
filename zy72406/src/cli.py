#!/usr/bin/env python3
import argparse
import json
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

from .engine import CopyrightCheckEngine, BoundaryRules
from .models import SongStatus, EvidenceType


def pretty_print_record(record_dict: Dict, show_details: bool = False):
    summary = record_dict.get("evidence_summary", record_dict)
    status_color = {
        "imported": "\033[94m",
        "name_conflict": "\033[93m",
        "awaiting_contract": "\033[93m",
        "contract_verified": "\033[94m",
        "teacher_review": "\033[95m",
        "approved": "\033[92m",
        "rejected": "\033[91m",
        "rolled_back": "\033[90m"
    }
    color = status_color.get(summary.get("status", ""), "")
    reset = "\033[0m"

    print(f"  记录ID: {summary['record_id']}")
    print(f"  显示名: {summary['display_name']}")
    if summary.get('live_name'):
        print(f"  现场名: {summary['live_name']}")
    if summary.get('copyright_name'):
        print(f"  版权名: {summary['copyright_name']}")
    print(f"  授权地域: {summary['region']}")
    print(f"  状态: {color}{summary['status']}{reset}")
    print(f"  原始行号: {summary.get('original_row_number', 'N/A')}")
    print(f"  接龙证据: {summary['group_chat_evidence_count']} 份 | 合同证据: {summary['contract_evidence_count']} 份")
    print(f"  人工改动: {summary['manual_change_count']} 次")
    if summary.get('last_updated'):
        print(f"  最后更新: {summary['last_updated']}")

    if show_details and "record" in record_dict:
        full = record_dict["record"]
        print("\n  [证据明细]")
        for idx, ev in enumerate(full.get("evidences", []), 1):
            print(f"    {idx}. [{ev['evidence_type']}] {ev['source']} - {ev['operator']} at {ev['recorded_at']}")
            print(f"       内容: {ev['content'][:80]}{'...' if len(ev['content']) > 80 else ''}")

        print("\n  [人工改动]")
        for idx, ch in enumerate(full.get("manual_changes", []), 1):
            print(f"    {idx}. {ch['field_name']}: '{ch['old_value']}' -> '{ch['new_value']}'")
            print(f"       操作人: {ch['operator']} | 原因: {ch['reason']}")

        print("\n  [状态历史]")
        for idx, (status, ts, op) in enumerate(full.get("status_history", []), 1):
            print(f"    {idx}. {status} @ {ts} by {op}")

        print("\n  [边界规则应用]")
        rules = record_dict.get("boundary_rules_applied", {})
        for k, v in rules.items():
            print(f"    - {k}: {v}")

    print()


def cmd_import(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "system"

    if not os.path.exists(args.file):
        print(f"错误: 文件不存在: {args.file}", file=sys.stderr)
        sys.exit(1)

    with open(args.file, 'r', encoding='utf-8') as f:
        if args.file.endswith('.json'):
            rows = json.load(f)
        else:
            import csv
            reader = csv.DictReader(f)
            rows = list(reader)

    print(f"=== 排练群接龙导入 ===")
    print(f"操作人: {operator}")
    print(f"文件: {args.file}")
    print(f"待导入记录数: {len(rows)}")
    print()

    imported, errors = engine.batch_import_from_group_chat(rows, operator)

    print(f"导入完成: 成功 {len(imported)} 条, 失败 {len(errors)} 条")
    print()

    conflict_count = sum(1 for r in imported if r.has_name_conflict())
    if conflict_count > 0:
        print(f"\033[93m⚠  检测到 {conflict_count} 条同名冲突记录（现场名≠版权名），已标记为 name_conflict，需要音乐老师复核\033[0m")
        print()

    for record in imported:
        summary = record.get_evidence_summary()
        pretty_print_record({"evidence_summary": summary})

    if errors:
        print("=== 导入失败记录 ===")
        for err in errors:
            print(f"  行 {err['row']}: {err['error']}")
            print(f"    数据: {err['data']}")
            print()

    print(f"数据已保存至: {args.data}")


def cmd_add_contract(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "小段"

    print(f"=== 录音师补录合同页截图 ===")
    print(f"操作人: {operator}")
    print(f"记录ID: {args.record_id}")
    print(f"证据来源: {args.source}")
    print()

    content = args.content
    if not content:
        content = input("请输入合同页截图内容摘要: ").strip()

    evidence = engine.add_contract_evidence(args.record_id, args.source, content, operator)

    if not evidence:
        print(f"错误: 未找到记录 {args.record_id}", file=sys.stderr)
        sys.exit(1)

    print("合同证据已添加")
    details = engine.get_record_details(args.record_id)
    pretty_print_record(details, show_details=True)


def cmd_list(args):
    engine = CopyrightCheckEngine(args.data)

    status_filter = None
    if args.status:
        try:
            status_filter = SongStatus(args.status)
        except ValueError:
            print(f"错误: 无效的状态值: {args.status}", file=sys.stderr)
            print(f"可用状态: {', '.join([s.value for s in SongStatus])}", file=sys.stderr)
            sys.exit(1)

    records = engine.list_records(status=status_filter, has_conflict=args.conflict)

    print(f"=== 版权授权地域核对记录列表 ===")
    print(f"共 {len(records)} 条记录")
    if status_filter:
        print(f"状态筛选: {status_filter.value}")
    if args.conflict is not None:
        print(f"同名冲突筛选: {args.conflict}")
    print()

    for record in records:
        summary = record.get_evidence_summary()
        pretty_print_record({"evidence_summary": summary})


def cmd_show(args):
    engine = CopyrightCheckEngine(args.data)
    details = engine.get_record_details(args.record_id)

    if not details:
        print(f"错误: 未找到记录 {args.record_id}", file=sys.stderr)
        sys.exit(1)

    print(f"=== 记录详情 ===")
    pretty_print_record(details, show_details=True)


def cmd_update_name(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "system"

    if args.field not in ["live_name", "copyright_name"]:
        print(f"错误: 字段名必须是 live_name 或 copyright_name", file=sys.stderr)
        sys.exit(1)

    reason = args.reason
    if not reason:
        reason = input("请输入修改原因: ").strip()

    change = engine.update_song_name(args.record_id, args.field, args.value, operator, reason)

    if not change:
        print(f"错误: 未找到记录 {args.record_id}", file=sys.stderr)
        sys.exit(1)

    print("修改已记录")
    details = engine.get_record_details(args.record_id)
    pretty_print_record(details, show_details=True)


def cmd_teacher_approve(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "音乐老师"

    print(f"=== 音乐老师复核通过 ===")
    print(f"操作人: {operator}")
    print(f"记录ID: {args.record_id}")
    print()

    success = engine.teacher_approve(args.record_id, operator, args.note)

    if not success:
        record = engine.get_record(args.record_id)
        if record:
            print(f"错误: 当前状态 {record.status.value} 不允许审批，或缺少合同证据", file=sys.stderr)
        else:
            print(f"错误: 未找到记录 {args.record_id}", file=sys.stderr)
        sys.exit(1)

    print("审批通过")
    details = engine.get_record_details(args.record_id)
    pretty_print_record(details, show_details=True)


def cmd_teacher_reject(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "音乐老师"

    reason = args.reason
    if not reason:
        reason = input("请输入驳回原因: ").strip()

    success = engine.teacher_reject(args.record_id, operator, reason)

    if not success:
        print(f"错误: 未找到记录 {args.record_id}", file=sys.stderr)
        sys.exit(1)

    print("已驳回")
    details = engine.get_record_details(args.record_id)
    pretty_print_record(details, show_details=True)


def cmd_rollback(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "system"

    reason = args.reason
    if not reason:
        reason = input("请输入回滚原因: ").strip()

    success = engine.rollback(args.record_id, operator, reason)

    if not success:
        print(f"错误: 回滚失败（记录不存在或历史不足）", file=sys.stderr)
        sys.exit(1)

    print("已回滚")
    details = engine.get_record_details(args.record_id)
    pretty_print_record(details, show_details=True)


def cmd_report(args):
    engine = CopyrightCheckEngine(args.data)
    report = engine.generate_report()

    print(f"=== 版权授权地域核对周报 ===")
    print(f"报告ID: {report.report_id}")
    print(f"生成时间: {report.generated_at.isoformat()}")
    print()
    print(f"总记录数: {report.total_records}")
    print(f"同名冲突数: {report.conflict_count}")
    print(f"待复核数: {report.awaiting_review_count}")
    print()
    print("状态分布:")
    for status, count in report.status_breakdown.items():
        print(f"  {status}: {count}")
    print()

    if args.output:
        output_path = engine.export_weekly_report(args.output)
        print(f"详细报告已导出至: {output_path}")
        print()

    if not args.summary_only:
        print("=== 记录明细 ===")
        for rec_summary in report.records:
            pretty_print_record({"evidence_summary": rec_summary})


def cmd_workflow(args):
    engine = CopyrightCheckEngine(args.data)
    operator = args.operator or "系统演示"

    print("=" * 60)
    print("版权授权地域核对 - 完整三步流程演示")
    print("=" * 60)
    print()

    sample_rows = [
        {"现场名": "夜曲", "版权名": "夜曲", "授权地域": "中国大陆"},
        {"现场名": "七里香live", "版权名": "七里香", "授权地域": "中国大陆"},
        {"现场名": "稻香", "版权名": "稻香", "授权地域": "全球"},
        {"现场名": "晴天(现场版)", "版权名": "晴天", "授权地域": "中国大陆"},
        {"现场名": "青花瓷", "版权名": "青花瓷", "授权地域": "中国大陆"},
    ]

    print("\033[1m【第一步】排练群接龙第一次导入\033[0m")
    print(f"操作人: {operator}")
    print("-" * 40)

    imported, errors = engine.batch_import_from_group_chat(sample_rows, operator)
    print(f"导入完成: 成功 {len(imported)} 条")

    conflicts = [r for r in imported if r.has_name_conflict()]
    if conflicts:
        print(f"\033[93m⚠  检测到 {len(conflicts)} 条同名冲突，已标记待复核:\033[0m")
        for r in conflicts:
            print(f"  - 行{r.original_row_number}: '{r.live_name}' vs '{r.copyright_name}'")
    print()

    print("\033[1m【第二步】录音师小段补看合同页截图\033[0m")
    print("操作人: 小段")
    print("-" * 40)

    for i, record in enumerate(imported):
        source = f"合同扫描页_{i+1}.png"
        content = f"合同第{i+1}页，授权地域: {record.region}，版权方签章齐全"
        engine.add_contract_evidence(record.record_id, source, content, "小段")
        print(f"✓ 为 '{record.get_display_name()}' 添加合同证据: {source}")

    print()
    print("\033[93m⚠  注意: 同名冲突记录在补录合同后状态变为 teacher_review，不会自动归为正常\033[0m")
    print()

    print("\033[1m【第三步】音乐老师复核 + 店长周报\033[0m")
    print("操作人: 音乐老师")
    print("-" * 40)

    need_review = engine.list_records(status=SongStatus.TEACHER_REVIEW)
    print(f"待音乐老师复核记录: {len(need_review)} 条")

    for i, record in enumerate(need_review):
        if i < len(need_review) - 1:
            engine.teacher_approve(record.record_id, "音乐老师", "版权名正确，现场名是演出时的别称")
            print(f"✓ 审批通过: '{record.get_display_name()}' (现场名 '{record.live_name}' 实为版权名 '{record.copyright_name}' 的现场版)")
        else:
            engine.teacher_reject(record.record_id, "音乐老师", "版权名有误，需重新核对合同")
            print(f"✗ 驳回: '{record.get_display_name()}' - 版权名与合同不符")

    print()

    report = engine.generate_report()
    print("\033[1m【店长周报摘要】\033[0m")
    print(f"总记录数: {report.total_records}")
    print(f"同名冲突: {report.conflict_count} 条")
    print(f"待处理: {report.awaiting_review_count} 条")
    print("状态分布:")
    for s, c in report.status_breakdown.items():
        print(f"  {s}: {c}")

    if args.output:
        out_path = engine.export_weekly_report(args.output)
        print(f"\n完整周报已导出至: {out_path}")

    print()
    print("\033[1m【复盘说明】\033[0m")
    print("所有操作均已记录在审计日志中，可通过以下命令回溯:")
    print("  python -m src.cli list                    # 查看所有记录")
    print("  python -m src.cli show <record_id>        # 查看单条记录的完整证据链")
    print("  python -m src.cli report --output week1.json  # 重新生成周报")
    print()
    print("完整证据链包含: 原始行号、所有人工改动、状态流转历史、每份证据的来源和内容")
    print("同名冲突记录全程保留，不会因为补录合同就自动消失，确保音乐老师能看到完整背景")


def cmd_rules(args):
    print("=" * 60)
    print("版权授权地域核对 - 边界规则")
    print("=" * 60)
    print()

    rules = BoundaryRules.to_dict()
    for name, value in rules.items():
        print(f"{name}: {value}")

    print()
    print("\033[1m规则说明:\033[0m")
    print()
    print("1. NAME_CONFLICT_REQUIRES_TEACHER_REVIEW = True")
    print("   同一首歌有现场名和版权名且不一致时，必须留音乐老师复核")
    print("   录音师补录合同证据后，状态变为 teacher_review，不会自动通过")
    print()
    print("2. CONTRACT_EVIDENCE_OUTWEIGHS_GROUP_CHAT = True")
    print("   合同页截图的证据优先级高于排练群接龙")
    print("   当两者矛盾时，以合同证据为准，但需保留接龙记录作为证据链")
    print()
    print("3. ROLLBACK_PRESERVES_HISTORY = True")
    print("   回滚操作保留完整历史，不删除任何记录")
    print("   回滚后状态标记为 rolled_back，可追溯所有操作")
    print()
    print("4. MIN_EVIDENCE_FOR_APPROVAL = 2")
    print("   审批通过至少需要 2 份证据（接龙+合同各至少一份）")
    print()
    print("\033[1m状态流转图:\033[0m")
    print()
    print("  imported ──> name_conflict ──> teacher_review ──> approved")
    print("     │              │                  │               │")
    print("     │              │                  └──> rejected   │")
    print("     │              │                                  │")
    print("     └──> awaiting_contract ──> contract_verified ─────┘")
    print("                                                            ")
    print("  任何状态都可回滚(rolled_back)，所有历史保留")


def main():
    parser = argparse.ArgumentParser(
        description="版权授权地域核对工具 - 保留完整证据链，支持三步流程",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
完整三步流程示例:
  1. python -m src.cli import --file examples/sample_group_chat.json --operator 小助理
  2. python -m src.cli add-contract --record-id <id> --source 合同页1.png --operator 小段
  3. python -m src.cli teacher-approve --record-id <id> --operator 音乐老师
     python -m src.cli report --output weekly_report.json

一键演示完整流程:
  python -m src.cli workflow --operator 演示用户
        """
    )
    parser.add_argument("--data", default="data/copyright_check.json", help="数据文件路径")
    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="第一步: 导入排练群接龙")
    import_parser.add_argument("--file", required=True, help="接龙文件路径 (JSON或CSV)")
    import_parser.add_argument("--operator", help="操作人")
    import_parser.set_defaults(func=cmd_import)

    add_contract_parser = subparsers.add_parser("add-contract", help="第二步: 补录合同页截图证据")
    add_contract_parser.add_argument("--record-id", required=True, help="记录ID")
    add_contract_parser.add_argument("--source", required=True, help="证据来源（文件名/页码）")
    add_contract_parser.add_argument("--content", help="证据内容摘要")
    add_contract_parser.add_argument("--operator", help="操作人（默认: 小段）")
    add_contract_parser.set_defaults(func=cmd_add_contract)

    list_parser = subparsers.add_parser("list", help="列出所有记录")
    list_parser.add_argument("--status", help="按状态筛选")
    list_parser.add_argument("--conflict", type=lambda x: x.lower() == 'true', help="只显示同名冲突记录 (true/false)")
    list_parser.set_defaults(func=cmd_list)

    show_parser = subparsers.add_parser("show", help="查看单条记录详情（含完整证据链）")
    show_parser.add_argument("record_id", help="记录ID")
    show_parser.set_defaults(func=cmd_show)

    update_parser = subparsers.add_parser("update-name", help="人工修改歌曲名")
    update_parser.add_argument("--record-id", required=True, help="记录ID")
    update_parser.add_argument("--field", required=True, choices=["live_name", "copyright_name"], help="修改字段")
    update_parser.add_argument("--value", required=True, help="新值")
    update_parser.add_argument("--reason", help="修改原因")
    update_parser.add_argument("--operator", help="操作人")
    update_parser.set_defaults(func=cmd_update_name)

    approve_parser = subparsers.add_parser("teacher-approve", help="第三步: 音乐老师审批通过")
    approve_parser.add_argument("--record-id", required=True, help="记录ID")
    approve_parser.add_argument("--note", help="审批备注")
    approve_parser.add_argument("--operator", help="操作人（默认: 音乐老师）")
    approve_parser.set_defaults(func=cmd_teacher_approve)

    reject_parser = subparsers.add_parser("teacher-reject", help="音乐老师驳回")
    reject_parser.add_argument("--record-id", required=True, help="记录ID")
    reject_parser.add_argument("--reason", help="驳回原因")
    reject_parser.add_argument("--operator", help="操作人（默认: 音乐老师）")
    reject_parser.set_defaults(func=cmd_teacher_reject)

    rollback_parser = subparsers.add_parser("rollback", help="回滚操作")
    rollback_parser.add_argument("--record-id", required=True, help="记录ID")
    rollback_parser.add_argument("--reason", help="回滚原因")
    rollback_parser.add_argument("--operator", help="操作人")
    rollback_parser.set_defaults(func=cmd_rollback)

    report_parser = subparsers.add_parser("report", help="生成周报/导出数据")
    report_parser.add_argument("--output", help="导出JSON报告路径")
    report_parser.add_argument("--summary-only", action="store_true", help="只显示摘要，不显示明细")
    report_parser.set_defaults(func=cmd_report)

    workflow_parser = subparsers.add_parser("workflow", help="一键演示完整三步流程")
    workflow_parser.add_argument("--operator", help="操作人")
    workflow_parser.add_argument("--output", help="导出周报路径")
    workflow_parser.set_defaults(func=cmd_workflow)

    rules_parser = subparsers.add_parser("rules", help="查看边界规则")
    rules_parser.set_defaults(func=cmd_rules)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
