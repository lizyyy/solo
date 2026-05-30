#!/usr/bin/env python3
import argparse
import json
import sys
import os
from datetime import datetime
from typing import Optional

from models import ReviewStatus, SourceType, EvidenceType
from service import RiskReviewService


def print_table(headers, rows):
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))

    format_str = " | ".join([f"{{:<{w}}}" for w in col_widths])
    print(format_str.format(*headers))
    print("-|-".join(["-" * w for w in col_widths]))
    for row in rows:
        print(format_str.format(*[str(c) for c in row]))


def cmd_import(args):
    service = RiskReviewService()

    screenshot_content = None
    if args.screenshot:
        with open(args.screenshot, 'rb') as f:
            screenshot_content = f.read()

    email_content = None
    if args.email:
        with open(args.email, 'rb') as f:
            email_content = f.read()

    result = service.import_record(
        customer_id=args.customer_id,
        customer_name=args.customer_name,
        questionnaire_id=args.questionnaire_id,
        questionnaire_version=args.questionnaire_version,
        source_type=SourceType(args.source_type),
        source_batch_id=args.batch_id,
        created_by=args.operator,
        assigned_to=args.assigned_to,
        auto_detect_duplicate=not args.no_duplicate_check,
        screenshot_content=screenshot_content,
        screenshot_name=os.path.basename(args.screenshot) if args.screenshot else "",
        email_content=email_content,
        email_name=os.path.basename(args.email) if args.email else "",
    )

    record = result.created_record
    if result.is_duplicate:
        print(f"⚠️  检测到重复记录，原记录ID: {result.existing_record_id}")
        print(f"   匹配类型: {result.match_type}")
        print(f"   匹配详情: {json.dumps(result.match_details, ensure_ascii=False)}")

    print(f"✅ 记录已创建，ID: {record.id}")
    print(f"   客户: {record.customer_name} ({record.customer_id})")
    print(f"   当前状态: {record.current_status.value}")
    print(f"   待处理原因: {record.pending_reason}")


def cmd_add_evidence(args):
    service = RiskReviewService()
    with open(args.file, 'rb') as f:
        content = f.read()

    evidence = service.add_evidence(
        record_id=args.record_id,
        evidence_type=EvidenceType(args.evidence_type),
        file_content=content,
        file_name=os.path.basename(args.file),
        uploaded_by=args.operator,
        description=args.description,
    )
    if evidence:
        record = service.get_record_detail(args.record_id)
        print(f"✅ 证据已添加，ID: {evidence.id}")
        print(f"   记录当前状态: {record['record']['current_status']}")
        print(f"   待处理原因: {record['record']['pending_reason']}")
    else:
        print("❌ 添加证据失败")
        sys.exit(1)


def cmd_withdraw(args):
    service = RiskReviewService()
    record = service.withdraw_record(
        record_id=args.record_id,
        operator=args.operator,
        reason=args.reason,
    )
    if record:
        print(f"✅ 记录已撤回")
        print(f"   当前状态: {record.current_status.value}")
        print(f"   待处理原因: {record.pending_reason}")
    else:
        print("❌ 撤回失败")
        sys.exit(1)


def cmd_correct(args):
    service = RiskReviewService()
    record = service.correct_record(
        record_id=args.record_id,
        operator=args.operator,
        correction_note=args.note,
        reset_to_start=args.reset,
    )
    if record:
        print(f"✅ 记录已标记为需要修正")
        print(f"   当前状态: {record.current_status.value}")
        print(f"   待处理原因: {record.pending_reason}")
        if args.reset:
            print("   已创建新的修正记录，重新开始流程")
    else:
        print("❌ 修正失败")
        sys.exit(1)


def cmd_confirm(args):
    service = RiskReviewService()
    try:
        record = service.manual_confirm(
            record_id=args.record_id,
            operator=args.operator,
            confirm_note=args.note,
        )
        if record:
            print(f"✅ 人工确认完成")
            print(f"   当前状态: {record.current_status.value}")
            print(f"   待处理原因: {record.pending_reason}")
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)


def cmd_review(args):
    service = RiskReviewService()
    try:
        record = service.risk_review(
            record_id=args.record_id,
            operator=args.operator,
            approved=args.approve,
            review_note=args.note,
        )
        if record:
            result = "通过" if args.approve else "驳回"
            print(f"✅ 风控复核{result}")
            print(f"   当前状态: {record.current_status.value}")
            print(f"   待处理原因: {record.pending_reason}")
    except ValueError as e:
        print(f"❌ {e}")
        sys.exit(1)


def cmd_list(args):
    service = RiskReviewService()

    filters = {}
    if args.status:
        filters['status'] = [ReviewStatus(s) for s in args.status]
    if args.source_type:
        filters['source_type'] = SourceType(args.source_type)
    if args.batch_id:
        filters['source_batch_id'] = args.batch_id
    if args.customer_id:
        filters['customer_id'] = args.customer_id
    if args.duplicate_only:
        filters['is_duplicate'] = True
    if args.no_duplicate:
        filters['is_duplicate'] = False

    records, total, total_pages = service.filter_records(
        filters=filters,
        page=args.page,
        page_size=args.page_size
    )

    print(f"共 {total} 条记录，当前第 {args.page} 页，共 {total_pages} 页")
    print()

    headers = [
        "ID", "客户名称", "问卷ID", "来源",
        "状态", "待处理原因", "是否重复", "更新时间"
    ]
    rows = []
    for r in records:
        rows.append([
            r.id,
            r.customer_name,
            r.questionnaire_id,
            r.source_type.value,
            r.current_status.value,
            r.pending_reason[:20] + "..." if len(r.pending_reason) > 20 else r.pending_reason,
            "是" if r.is_duplicate else "否",
            r.updated_at.strftime("%Y-%m-%d %H:%M")
        ])
    print_table(headers, rows)


def cmd_show(args):
    service = RiskReviewService()
    detail = service.get_record_detail(args.record_id)
    if not detail:
        print("❌ 记录不存在")
        sys.exit(1)

    record = detail['record']
    print(f"{'='*60}")
    print(f"记录ID: {record['id']}")
    print(f"{'='*60}")
    print(f"客户: {record['customer_name']} ({record['customer_id']})")
    print(f"问卷: {record['questionnaire_id']} {record['questionnaire_version']}")
    print(f"来源: {record['source_type']} / 批次: {record['source_batch_id']}")
    print(f"状态: {record['current_status']}")
    print(f"待处理原因: {detail['pending_reason_explanation']}")
    print(f"创建人: {record['created_by']} @ {record['created_at']}")
    print(f"处理人: {record['assigned_to']}")
    print(f"更新时间: {record['updated_at']}")
    if record['is_duplicate']:
        print(f"⚠️  重复记录，原记录ID: {record['duplicate_of_id']}")
    if record['correction_note']:
        print(f"📝 修正备注: {record['correction_note']}")

    print()
    print(f"--- 证据链 ---")
    for ev in record['evidences']:
        print(f"  [{ev['id']}] {ev['evidence_type']}: {ev['file_name']}")
        print(f"      上传人: {ev['uploaded_by']} @ {ev['uploaded_at']}")
        print(f"      文件哈希: {ev['file_hash']}")
        if ev['description']:
            print(f"      描述: {ev['description']}")

    print()
    print(f"--- 审计日志 ---")
    for log in record['audit_logs']:
        old = log.get('old_status') or "-"
        new = log.get('new_status') or "-"
        print(f"  [{log['created_at']}] {log['operator']}: {log['action_type']}")
        print(f"      {old} → {new}")
        print(f"      原因: {log['reason']}")

    print()
    print(f"可转换到的状态: {', '.join(detail['can_transition_to'])}")


def cmd_export(args):
    service = RiskReviewService()

    filters = {}
    if args.status:
        filters['status'] = [ReviewStatus(s) for s in args.status]
    if args.source_type:
        filters['source_type'] = SourceType(args.source_type)
    if args.batch_id:
        filters['source_batch_id'] = args.batch_id

    data = service.export_records(
        filters=filters,
        format=args.format,
        include_evidence=not args.no_evidence,
        include_audit=args.with_audit
    )

    if args.output:
        with open(args.output, 'wb') as f:
            f.write(data)
        print(f"✅ 已导出到 {args.output}")
    else:
        sys.stdout.buffer.write(data)


def cmd_stats(args):
    service = RiskReviewService()
    stats = service.get_statistics()

    print(f"{'='*40}")
    print(f"  客户风险问卷补审 - 统计概览")
    print(f"{'='*40}")
    print(f"总记录数: {stats['total']}")
    print(f"重复记录: {stats['duplicates']}")
    print()
    print(f"按状态分布:")
    for status, count in stats['by_status'].items():
        explanation = stats['pending_reason_explanation'].get(status, "")
        bar = "█" * (count * 2)
        print(f"  {status:30s} {count:4d} {bar}")
        if explanation:
            print(f"      {explanation}")


def cmd_batch_import(args):
    service = RiskReviewService()
    with open(args.file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    results = service.batch_import(
        records_data=data,
        source_batch_id=args.batch_id,
        created_by=args.operator,
        source_type=SourceType(args.source_type)
    )

    print(f"批量导入完成，共 {len(results)} 条记录")
    print()

    success_count = 0
    duplicate_count = 0
    for r in results:
        if r.is_duplicate:
            duplicate_count += 1
            print(f"⚠️  #{r.created_record.id} 重复 (原记录#{r.existing_record_id}): {r.created_record.customer_name}")
        else:
            success_count += 1
            print(f"✅ #{r.created_record.id} 新建: {r.created_record.customer_name}")

    print()
    print(f"新建: {success_count}, 重复: {duplicate_count}")


def main():
    parser = argparse.ArgumentParser(
        description="客户风险问卷补审系统",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser_import = subparsers.add_parser("import", help="导入补审记录")
    parser_import.add_argument("--customer-id", required=True, help="客户ID")
    parser_import.add_argument("--customer-name", required=True, help="客户名称")
    parser_import.add_argument("--questionnaire-id", required=True, help="问卷ID")
    parser_import.add_argument("--questionnaire-version", default="v1.0", help="问卷版本")
    parser_import.add_argument("--source-type", default="batch_import",
                              choices=[s.value for s in SourceType], help="来源类型")
    parser_import.add_argument("--batch-id", required=True, help="来源批次ID")
    parser_import.add_argument("--operator", required=True, help="操作人")
    parser_import.add_argument("--assigned-to", default="", help="分配给")
    parser_import.add_argument("--screenshot", help="审批截图文件路径")
    parser_import.add_argument("--email", help="补充邮件文件路径")
    parser_import.add_argument("--no-duplicate-check", action="store_true", help="不进行重复检测")
    parser_import.set_defaults(func=cmd_import)

    parser_batch = subparsers.add_parser("batch-import", help="批量导入JSON文件")
    parser_batch.add_argument("--file", required=True, help="JSON数据文件")
    parser_batch.add_argument("--batch-id", required=True, help="批次ID")
    parser_batch.add_argument("--operator", required=True, help="操作人")
    parser_batch.add_argument("--source-type", default="batch_import",
                             choices=[s.value for s in SourceType], help="来源类型")
    parser_batch.set_defaults(func=cmd_batch_import)

    parser_evidence = subparsers.add_parser("add-evidence", help="添加证据")
    parser_evidence.add_argument("--record-id", type=int, required=True, help="记录ID")
    parser_evidence.add_argument("--evidence-type", required=True,
                                choices=[e.value for e in EvidenceType], help="证据类型")
    parser_evidence.add_argument("--file", required=True, help="证据文件路径")
    parser_evidence.add_argument("--operator", required=True, help="操作人")
    parser_evidence.add_argument("--description", default="", help="描述")
    parser_evidence.set_defaults(func=cmd_add_evidence)

    parser_withdraw = subparsers.add_parser("withdraw", help="撤回记录")
    parser_withdraw.add_argument("--record-id", type=int, required=True, help="记录ID")
    parser_withdraw.add_argument("--operator", required=True, help="操作人")
    parser_withdraw.add_argument("--reason", required=True, help="撤回原因")
    parser_withdraw.set_defaults(func=cmd_withdraw)

    parser_correct = subparsers.add_parser("correct", help="标记需要修正")
    parser_correct.add_argument("--record-id", type=int, required=True, help="记录ID")
    parser_correct.add_argument("--operator", required=True, help="操作人")
    parser_correct.add_argument("--note", required=True, help="修正说明")
    parser_correct.add_argument("--reset", action="store_true", help="创建新记录重新开始")
    parser_correct.set_defaults(func=cmd_correct)

    parser_confirm = subparsers.add_parser("confirm", help="人工确认")
    parser_confirm.add_argument("--record-id", type=int, required=True, help="记录ID")
    parser_confirm.add_argument("--operator", required=True, help="操作人")
    parser_confirm.add_argument("--note", required=True, help="确认说明")
    parser_confirm.set_defaults(func=cmd_confirm)

    parser_review = subparsers.add_parser("review", help="风控复核")
    parser_review.add_argument("--record-id", type=int, required=True, help="记录ID")
    parser_review.add_argument("--operator", required=True, help="操作人")
    parser_review.add_argument("--approve", action="store_true", help="通过")
    parser_review.add_argument("--reject", dest="approve", action="store_false", help="驳回")
    parser_review.add_argument("--note", required=True, help="复核意见")
    parser_review.set_defaults(func=cmd_review)

    parser_list = subparsers.add_parser("list", help="列出记录")
    parser_list.add_argument("--status", action="append",
                            choices=[s.value for s in ReviewStatus], help="按状态筛选")
    parser_list.add_argument("--source-type", choices=[s.value for s in SourceType], help="按来源筛选")
    parser_list.add_argument("--batch-id", help="按批次筛选")
    parser_list.add_argument("--customer-id", help="按客户ID筛选")
    parser_list.add_argument("--duplicate-only", action="store_true", help="只显示重复记录")
    parser_list.add_argument("--no-duplicate", action="store_true", help="排除重复记录")
    parser_list.add_argument("--page", type=int, default=1, help="页码")
    parser_list.add_argument("--page-size", type=int, default=50, help="每页条数")
    parser_list.set_defaults(func=cmd_list)

    parser_show = subparsers.add_parser("show", help="显示记录详情")
    parser_show.add_argument("--record-id", type=int, required=True, help="记录ID")
    parser_show.set_defaults(func=cmd_show)

    parser_export = subparsers.add_parser("export", help="导出记录")
    parser_export.add_argument("--status", action="append",
                              choices=[s.value for s in ReviewStatus], help="按状态筛选")
    parser_export.add_argument("--source-type", choices=[s.value for s in SourceType], help="按来源筛选")
    parser_export.add_argument("--batch-id", help="按批次筛选")
    parser_export.add_argument("--format", default="csv", choices=["csv", "json"], help="导出格式")
    parser_export.add_argument("--output", help="输出文件路径")
    parser_export.add_argument("--no-evidence", action="store_true", help="不包含证据信息")
    parser_export.add_argument("--with-audit", action="store_true", help="包含审计日志")
    parser_export.set_defaults(func=cmd_export)

    parser_stats = subparsers.add_parser("stats", help="统计概览")
    parser_stats.set_defaults(func=cmd_stats)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
