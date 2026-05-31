#!/usr/bin/env python3
import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import store
import importer
import processor
import exporter
from models import Status, STATUS_LABELS, SOURCE_LABELS, ImportMode


def cmd_init(args):
    db_path = args.db or store.DB_PATH
    store.init_db(db_path)
    print(f"数据库已初始化: {os.path.abspath(db_path)}")


def cmd_import(args):
    db_path = args.db or store.DB_PATH
    store.init_db(db_path)
    mode = args.mode or ImportMode.SKIP.value
    log = importer.import_records(args.file, args.batch, mode=mode, db_path=db_path)
    print(f"\n导入完成 [{log.file_name} -> 批次 {log.batch_id}]")
    print(f"  总记录: {log.total_records}")
    print(f"  新增:   {log.inserted}")
    print(f"  跳过:   {log.skipped}")
    print(f"  更新:   {log.updated}")
    print(f"  冲突:   {log.conflicted}")
    details = json.loads(log.details)
    if details:
        print("\n  逐条明细:")
        for d in details:
            cn = d.get("contract_no", "(空)")
            action = d.get("action", "?")
            reason = d.get("reason", "")
            label = {"inserted": "新增", "skipped": "跳过", "updated": "更新", "conflicted": "冲突"}.get(action, action)
            line = f"    {cn}: {label}"
            if reason:
                line += f" - {reason}"
            print(line)


def cmd_supplement(args):
    db_path = args.db or store.DB_PATH
    store.init_db(db_path)
    log = importer.supplement_records(args.file, args.batch, db_path=db_path)
    print(f"\n补材料完成 [{log.file_name} -> 批次 {log.batch_id}]")
    print(f"  总记录: {log.total_records}")
    print(f"  新增:   {log.inserted}")
    print(f"  更新:   {log.updated}")
    details = json.loads(log.details)
    if details:
        print("\n  逐条明细:")
        for d in details:
            cn = d.get("contract_no", "(空)")
            action = d.get("action", "?")
            reason = d.get("reason", "")
            label = {"inserted": "新增", "skipped": "跳过", "updated": "更新"}.get(action, action)
            line = f"    {cn}: {label}"
            if reason:
                line += f" - {reason}"
            print(line)


def cmd_list(args):
    db_path = args.db or store.DB_PATH
    conn = store.get_conn(db_path)
    records = store.list_records(conn, status=args.status, batch_id=args.batch)
    conn.close()

    if not records:
        print("无记录")
        return

    fmt = f"{{:<4}} {{:<16}} {{:<8}} {{:<12}} {{:<10}} {{:<10}} {{:<10}}"
    print(fmt.format("ID", "合同编号", "客户", "车牌号", "GPS费", "收款额", "状态"))
    print("-" * 76)
    for rec in records:
        d = rec.to_dict()
        print(fmt.format(
            rec.id or "",
            rec.contract_no,
            rec.customer_name,
            (rec.plate_no or "-")[:10],
            f"{rec.gps_fee or '-':>8}",
            f"{rec.payment_amount or '-':>8}",
            d["status_label"],
        ))
    print(f"\n共 {len(records)} 条")


def cmd_show(args):
    db_path = args.db or store.DB_PATH
    detail = processor.get_record_detail(args.contract_no, db_path=db_path)
    if not detail:
        print(f"合同号 {args.contract_no} 不存在")
        return

    label_map = {
        "contract_no": "合同编号", "customer_name": "客户姓名",
        "plate_no": "车牌号", "vehicle_model": "车型",
        "gps_fee": "GPS费用", "payment_ref": "收款流水号",
        "payment_date": "收款日期", "payment_amount": "收款金额",
        "refund_applied": "退款申请", "refund_amount": "退款金额",
        "approval_email": "审批邮件", "remarks": "备注",
        "receipt_info": "银企回单", "status_label": "状态",
        "source_label": "来源", "is_old_format": "旧口径",
        "confirmed_by": "确认人", "confirmed_at": "确认时间",
        "batch_id": "批次号", "created_at": "创建时间",
        "updated_at": "更新时间",
    }
    for key, label in label_map.items():
        val = detail.get(key)
        if val is None or val == "":
            val = "-"
        if key == "refund_applied":
            val = "是" if val else "否"
        if key == "is_old_format":
            val = "是" if val else "否"
        print(f"  {label:　<8}: {val}")

    reasons = detail.get("needs_review_reasons", [])
    if reasons:
        print(f"\n  ⚠ 待确认原因:")
        for r in reasons:
            print(f"    - {r}")

    missing = detail.get("missing_fields", [])
    if missing:
        print(f"\n  ⚠ 缺少字段: {', '.join(missing)}")


def cmd_confirm(args):
    db_path = args.db or store.DB_PATH
    result = processor.confirm_record(
        args.contract_no, args.action, args.by, db_path=db_path,
    )
    if "error" in result:
        print(f"错误: {result['error']}")
    else:
        action_label = "确认通过" if result["action"] == "confirmed" else "驳回"
        print(f"合同号 {result['contract_no']}: 已{action_label} (操作人: {result['by']})")


def cmd_process(args):
    db_path = args.db or store.DB_PATH
    result = processor.process_batch(batch_id=args.batch, db_path=db_path)
    print(f"\n批次处理完成:")
    print(f"  处理记录:  {result['processed']}")
    print(f"  自动完成:  {result['auto_completed']}")
    print(f"  仍待处理:  {result['still_pending']}")
    print(f"  仍需确认:  {result['still_review']}")
    if result["actions"]:
        print("\n  逐条明细:")
        for a in result["actions"]:
            print(f"    {a['contract_no']}: {a['action']} - {a.get('reason', '')}")


def cmd_export(args):
    db_path = args.db or store.DB_PATH
    fmt = args.format or "text"
    output = args.output or f"report.{fmt}"

    if fmt == "csv":
        path = exporter.export_csv(output, status=args.status, batch_id=args.batch, db_path=db_path)
    else:
        path = exporter.export_text(output, status=args.status, batch_id=args.batch, db_path=db_path)

    print(f"报告已导出: {os.path.abspath(path)}")


def cmd_diff(args):
    db_path = args.db or store.DB_PATH
    report = exporter.diff_report(args.batch1, args.batch2, db_path=db_path)
    print(report)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"\n差异报告已保存: {os.path.abspath(args.output)}")


def cmd_stats(args):
    db_path = args.db or store.DB_PATH
    conn = store.get_conn(db_path)
    stats = store.get_stats(conn)
    conn.close()

    print(f"\n汽车金融GPS解押 - 统计概览")
    print(f"{'=' * 40}")
    print(f"  总记录数: {stats['total']}")
    print(f"  批次数:   {stats['batches']}")
    print(f"  需人工确认: {stats['needs_review_count']}")
    print(f"\n  按状态:")
    for status, cnt in stats["by_status"].items():
        label = STATUS_LABELS.get(Status(status), status)
        print(f"    {label}: {cnt}")

    conn = store.get_conn(db_path)
    logs = store.list_import_logs(conn)
    conn.close()
    if logs:
        print(f"\n  导入记录 (最近5条):")
        for log in logs[:5]:
            print(f"    批次 {log.batch_id}: 新增{log.inserted} 跳过{log.skipped} 更新{log.updated} 冲突{log.conflicted} ({log.file_name})")


def cmd_reset(args):
    db_path = args.db or store.DB_PATH
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"数据库已删除: {os.path.abspath(db_path)}")
    else:
        print("数据库文件不存在")


def main():
    parser = argparse.ArgumentParser(
        prog="gps_release",
        description="汽车金融GPS解押 - 批次管理与报告工具",
    )
    parser.add_argument("--db", help="数据库路径 (默认: gps_release.db)")
    sub = parser.add_subparsers(dest="command", help="子命令")

    p_init = sub.add_parser("init", help="初始化数据库")
    p_init.set_defaults(func=cmd_init)

    p_import = sub.add_parser("import", help="导入记录")
    p_import.add_argument("file", help="JSON文件路径")
    p_import.add_argument("batch", help="批次号")
    p_import.add_argument("--mode", choices=["skip", "update", "conflict"],
                          default="skip", help="重复处理模式 (默认: skip)")
    p_import.set_defaults(func=cmd_import)

    p_suppl = sub.add_parser("supplement", help="补材料导入")
    p_suppl.add_argument("file", help="补充材料JSON文件路径")
    p_suppl.add_argument("batch", help="批次号")
    p_suppl.set_defaults(func=cmd_supplement)

    p_list = sub.add_parser("list", help="列出记录")
    p_list.add_argument("--status", choices=[s.value for s in Status], help="按状态筛选")
    p_list.add_argument("--batch", help="按批次筛选")
    p_list.set_defaults(func=cmd_list)

    p_show = sub.add_parser("show", help="查看记录详情")
    p_show.add_argument("contract_no", help="合同编号")
    p_show.set_defaults(func=cmd_show)

    p_confirm = sub.add_parser("confirm", help="人工确认/驳回")
    p_confirm.add_argument("contract_no", help="合同编号")
    p_confirm.add_argument("--action", choices=["confirm", "reject"], required=True, help="确认或驳回")
    p_confirm.add_argument("--by", required=True, help="操作人姓名")
    p_confirm.set_defaults(func=cmd_confirm)

    p_process = sub.add_parser("process", help="批次自动处理")
    p_process.add_argument("--batch", help="指定批次 (默认全部)")
    p_process.set_defaults(func=cmd_process)

    p_export = sub.add_parser("export", help="导出报告")
    p_export.add_argument("--format", choices=["csv", "text"], default="text", help="输出格式")
    p_export.add_argument("--output", help="输出文件路径")
    p_export.add_argument("--status", choices=[s.value for s in Status], help="按状态筛选")
    p_export.add_argument("--batch", help="按批次筛选")
    p_export.set_defaults(func=cmd_export)

    p_diff = sub.add_parser("diff", help="批次差异报告")
    p_diff.add_argument("batch1", help="批次A")
    p_diff.add_argument("batch2", help="批次B")
    p_diff.add_argument("--output", help="保存到文件")
    p_diff.set_defaults(func=cmd_diff)

    p_stats = sub.add_parser("stats", help="统计概览")
    p_stats.set_defaults(func=cmd_stats)

    p_reset = sub.add_parser("reset", help="删除数据库（慎用）")
    p_reset.set_defaults(func=cmd_reset)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        return
    args.func(args)


if __name__ == "__main__":
    main()
