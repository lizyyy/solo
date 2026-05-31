import csv
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
import pandas as pd

from .normalizer import normalize_record, NormalizedRecord
from .models import Attachment, ReviewDecision, BudgetOccupancy
from .engine import ReviewEngine
from .db import Database
from .reporter import print_summary, print_record_detail, export_finance_detail


def _load_records_csv(path: str) -> list:
    expected_cols = [
        "记录编号", "交易日期", "金额", "经办人", "部门",
        "供应商", "用途", "预算科目", "审批单号", "备注",
    ]
    n_cols = len(expected_cols)
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        for i, raw_row in enumerate(reader):
            if i == 0:
                continue
            if len(raw_row) > n_cols:
                extra = len(raw_row) - n_cols
                merged = raw_row[:2] + [",".join(raw_row[2:3 + extra])] + raw_row[3 + extra:]
                raw_row = merged
            if len(raw_row) != n_cols:
                padded = raw_row + [""] * (n_cols - len(raw_row))
                raw_row = padded[:n_cols]
            row = dict(zip(expected_cols, raw_row))
            rows.append(row)
    return rows


def _load_records_excel(path: str) -> list:
    df = pd.read_excel(path, dtype=str).fillna("")
    rows = df.to_dict("records")
    return rows


def _load_records(path: str) -> list:
    ext = Path(path).suffix.lower()
    if ext in (".xlsx", ".xls"):
        return _load_records_excel(path)
    return _load_records_csv(path)


def _load_attachments_csv(path: str) -> list:
    df = pd.read_csv(path, dtype=str).fillna("")
    rows = df.to_dict("records")
    return rows


def _parse_attachments(rows: list) -> list:
    result = []
    for row in rows:
        result.append(Attachment(
            record_id=str(row.get("记录编号", "")).strip(),
            attachment_type=str(row.get("附件类型", "")).strip(),
            file_name=str(row.get("文件名", "")).strip(),
            received_date=str(row.get("收到日期", "")).strip(),
            source=str(row.get("来源", "")).strip(),
        ))
    return result


def _group_attachments(atts: list) -> dict:
    result = {}
    for a in atts:
        result.setdefault(a.record_id, []).append(a)
    return result


@click.group()
@click.option("--db", "db_path", default="pcard_review.db", help="SQLite数据库路径")
@click.pass_context
def cli(ctx, db_path):
    """企业采购卡预算占用 · 风控复核工具

    吃 CSV/Excel 和附件索引，跑复核，给终端摘要，留财务明细。
    挂起的记录不会混进已确认金额，补材料后可以接着处理。
    """
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path


@cli.command()
@click.option("--input", "input_path", required=True, help="预算记录 CSV/Excel 文件路径")
@click.option("--attachments", "att_path", default=None, help="附件索引 CSV 文件路径")
@click.option("--reviewer", default="林姐", help="复核人姓名")
@click.option("--batch-id", default=None, help="批次号（不填自动生成）")
@click.pass_context
def review(ctx, input_path, att_path, reviewer, batch_id):
    """跑企业采购卡预算占用复核"""
    db = Database(ctx.obj["db_path"])
    try:
        raw_rows = _load_records(input_path)
        records = [normalize_record(r) for r in raw_rows]
        atts = []
        if att_path:
            att_rows = _load_attachments_csv(att_path)
            atts = _parse_attachments(att_rows)
        att_map = _group_attachments(atts)

        existing_occ = db.get_budget_occupancy()
        engine = ReviewEngine(reviewer=reviewer)
        decisions, occupancy = engine.review_batch(records, att_map, existing_occ)

        bid = batch_id or f"PCARD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"
        db.save_records(records, bid)
        if atts:
            db.save_attachments(atts, bid)
        db.save_decisions(decisions, bid)
        db.save_budget_occupancy(occupancy)
        db.save_batch_log(bid, "review", len(records), f"复核{len(records)}条记录")

        print_summary(decisions, occupancy, bid)

        click.echo(f"\n📁 财务明细已存入数据库: {ctx.obj['db_path']}")
        click.echo(f"   用 pcard-review export --output finance_detail.csv 导出")
    finally:
        db.close()


@cli.command()
@click.option("--record-id", default=None, help="查指定记录")
@click.option("--status", default=None, help="按状态筛选: confirmed / suspended / manual_review")
@click.pass_context
def query(ctx, record_id, status):
    """查询复核结果和历史"""
    db = Database(ctx.obj["db_path"])
    try:
        if record_id:
            rec = db.get_record(record_id)
            dec = db.get_decision(record_id)
            atts = db.get_attachments_for_record(record_id)
            hist = db.get_decision_history(record_id)
            if not rec and not dec:
                click.echo(f"没找到 {record_id} 的记录，可能是还没跑过复核。")
                return
            print_record_detail(rec or {}, dec or {}, atts, hist)
        else:
            decisions = db.get_all_decisions(status)
            if not decisions:
                click.echo("没有找到匹配的记录。")
                return
            records = db.get_all_records()
            rec_map = {r["record_id"]: r for r in records}
            occ = db.get_budget_occupancy()
            dec_objects = []
            for d in decisions:
                missing = []
                if d.get("missing_docs"):
                    try:
                        missing = json.loads(d["missing_docs"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                dec_objects.append(ReviewDecision(
                    record_id=d["record_id"],
                    status=d["status"],
                    reason=d["reason"],
                    confirmed_amount=d.get("confirmed_amount"),
                    missing_docs=missing,
                    review_notes=d.get("review_notes", ""),
                    reviewer=d.get("reviewer", ""),
                    decision_time=datetime.fromisoformat(d["decision_time"]) if d.get("decision_time") else datetime.now(),
                    budget_occupancy_note=d.get("budget_occupancy_note", ""),
                ))
            print_summary(dec_objects, occ, "查询结果")
    finally:
        db.close()


@cli.command()
@click.option("--record-id", required=True, help="补充附件的记录编号")
@click.option("--attachment-type", required=True, help="附件类型: 发票/审批单/合同/银行回单/邮件补件")
@click.option("--file-name", required=True, help="附件文件名")
@click.option("--source", default="审批邮件补充", help="附件来源")
@click.option("--received-date", default=None, help="收到日期（不填用今天）")
@click.option("--reviewer", default="林姐", help="复核人")
@click.pass_context
def supplement(ctx, record_id, attachment_type, file_name, source, received_date, reviewer):
    """给挂起的记录补附件，补完自动重新跑复核"""
    db = Database(ctx.obj["db_path"])
    try:
        rec = db.get_record(record_id)
        dec = db.get_decision(record_id)
        if not rec:
            click.echo(f"没找到 {record_id} 的记录。")
            return
        if not dec:
            click.echo(f"{record_id} 还没跑过复核，先用 review 命令跑一遍。")
            return

        att = Attachment(
            record_id=record_id,
            attachment_type=attachment_type,
            file_name=file_name,
            received_date=received_date or datetime.now().strftime("%Y-%m-%d"),
            source=source,
        )
        bid = f"SUPP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"
        db.add_attachment(record_id, att, bid)

        records = db.load_records_for_review([record_id])
        att_map = db.load_attachments_map()
        existing_occ = db.get_budget_occupancy()

        engine = ReviewEngine(reviewer=reviewer)
        decisions, occupancy = engine.review_batch(records, att_map, existing_occ)

        db.save_decisions(decisions, bid)
        db.save_budget_occupancy(occupancy)
        db.save_batch_log(bid, "supplement", 1, f"为{record_id}补充{attachment_type}")

        old_status = ReviewDecision.STATUS_LABELS.get(dec["status"], dec["status"])
        new_status = ReviewDecision.STATUS_LABELS.get(decisions[0].status, decisions[0].status)

        click.echo(f"\n📎 已为 {record_id} 补上 {attachment_type}: {file_name}")
        click.echo(f"   旧状态: {old_status} → 新状态: {new_status}")
        click.echo(f"   原因: {decisions[0].reason}")
        click.echo(f"   复核备注: {decisions[0].review_notes}")

        if decisions[0].status == ReviewDecision.STATUS_CONFIRMED:
            click.echo(f"   ✅ 企业采购卡预算占用复核通过，金额 CNY {decisions[0].confirmed_amount:,.2f} 已计入确认")
        elif decisions[0].status == ReviewDecision.STATUS_MANUAL_REVIEW:
            click.echo(f"   ⚠️  还需要人工确认，企业采购卡预算占用检测仍有问题")
        else:
            click.echo(f"   ⏸ 仍然挂起，还缺: {', '.join(decisions[0].missing_docs)}")

    finally:
        db.close()


@cli.command()
@click.option("--output", "output_path", default="finance_detail.csv", help="导出文件路径")
@click.option("--status", default=None, help="按状态筛选导出")
@click.pass_context
def export(ctx, output_path, status):
    """导出财务明细 CSV"""
    db = Database(ctx.obj["db_path"])
    try:
        decisions = db.get_all_decisions(status)
        records = db.get_all_records()
        occupancy = db.get_budget_occupancy()
        if not decisions:
            click.echo("没有可导出的记录。")
            return
        export_finance_detail(decisions, records, occupancy, output_path)
        click.echo(f"✅ 已导出 {len(decisions)} 条记录到 {output_path}")
    finally:
        db.close()


@cli.command()
@click.option("--record-id", required=True, help="记录编号")
@click.pass_context
def history(ctx, record_id):
    """查看一条记录的完整历史变动"""
    db = Database(ctx.obj["db_path"])
    try:
        hist = db.get_decision_history(record_id)
        if not hist:
            click.echo(f"{record_id} 没有历史变动记录。")
            return
        click.echo(f"\n📋 {record_id} 的历史变动:")
        click.echo("-" * 60)
        for i, h in enumerate(hist, 1):
            old_label = ReviewDecision.STATUS_LABELS.get(h.get("old_status", ""), h.get("old_status", ""))
            new_label = ReviewDecision.STATUS_LABELS.get(h.get("new_status", ""), h.get("new_status", ""))
            click.echo(f"  第{i}次变动")
            click.echo(f"    时间:   {h.get('changed_at', '')[:19]}")
            click.echo(f"    状态:   {old_label} → {new_label}")
            click.echo(f"    原因:   {h.get('change_reason', '')}")
            click.echo(f"    操作人: {h.get('changed_by', '')}")
            if h.get("old_confirmed_amount") != h.get("new_confirmed_amount"):
                click.echo(f"    金额:   {h.get('old_confirmed_amount', '-')} → {h.get('new_confirmed_amount', '-')}")
            click.echo()
    finally:
        db.close()
