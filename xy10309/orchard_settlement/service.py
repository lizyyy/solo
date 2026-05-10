"""核心业务逻辑"""

import csv
import hashlib
import json
import os
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .models import (
    Deduction,
    PickRecord,
    RecordStatus,
    SettlementStatus,
    SettlementSummary,
    TeamSettlement,
    WorkerSettlement,
)


DEFAULT_RATE = 2.5
DATA_DIR = ".settlement_data"
RECORDS_FILE = "records.json"
SETTLEMENTS_FILE = "settlements.json"


def ensure_data_dir() -> str:
    data_path = os.path.join(os.getcwd(), DATA_DIR)
    os.makedirs(data_path, exist_ok=True)
    return data_path


def load_records() -> Dict[str, PickRecord]:
    data_path = ensure_data_dir()
    records_file = os.path.join(data_path, RECORDS_FILE)
    if not os.path.exists(records_file):
        return {}
    with open(records_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    result = {}
    for rid, record_data in data.items():
        record_data["status"] = RecordStatus(record_data["status"])
        result[rid] = PickRecord(**record_data)
    return result


def save_records(records: Dict[str, PickRecord]) -> None:
    data_path = ensure_data_dir()
    records_file = os.path.join(data_path, RECORDS_FILE)
    serializable = {}
    for rid, record in records.items():
        d = record.__dict__.copy()
        d["status"] = record.status.value
        serializable[rid] = d
    with open(records_file, "w", encoding="utf-8") as f:
        json.dump(serializable, f, ensure_ascii=False, indent=2)


def load_settlements() -> Dict[str, dict]:
    data_path = ensure_data_dir()
    settlements_file = os.path.join(data_path, SETTLEMENTS_FILE)
    if not os.path.exists(settlements_file):
        return {}
    with open(settlements_file, "r", encoding="utf-8") as f:
        return json.load(f)


def save_settlement(batch_id: str, summary: dict) -> None:
    data_path = ensure_data_dir()
    settlements_file = os.path.join(data_path, SETTLEMENTS_FILE)
    settlements = load_settlements()
    settlements[batch_id] = summary
    with open(settlements_file, "w", encoding="utf-8") as f:
        json.dump(settlements, f, ensure_ascii=False, indent=2)


def generate_record_key(record: dict) -> str:
    key_parts = [
        str(record.get("worker_id", "")),
        str(record.get("pick_date", "")),
        str(record.get("baskets", "")),
        str(record.get("total_weight", "")),
    ]
    key_str = "|".join(key_parts)
    return hashlib.md5(key_str.encode("utf-8")).hexdigest()


def parse_csv_file(file_path: str) -> List[dict]:
    records = []
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(row)
    return records


def parse_record(row: dict) -> PickRecord:
    record_id = generate_record_key(row)
    return PickRecord(
        record_id=record_id,
        worker_id=str(row.get("worker_id", "").strip()),
        worker_name=str(row.get("worker_name", "").strip()),
        team_id=str(row.get("team_id", "").strip()),
        team_name=str(row.get("team_name", "").strip()),
        pick_date=str(row.get("pick_date", "").strip()),
        baskets=int(float(row.get("baskets", 0) or 0)),
        total_weight=float(row.get("total_weight", 0) or 0),
        bad_weight=float(row.get("bad_weight", 0) or 0),
        reviewed=str(row.get("reviewed", "")).lower() in ["true", "1", "yes", "是"],
        reviewer=str(row.get("reviewer", "") or "").strip() or None,
        review_time=str(row.get("review_time", "") or "").strip() or None,
        advance_payment=float(row.get("advance_payment", 0) or 0),
        status=RecordStatus.PENDING,
        imported_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    )


def validate_record(
    record: PickRecord, existing_records: Dict[str, PickRecord]
) -> Tuple[bool, List[str]]:
    errors = []

    if record.record_id in existing_records:
        record.status = RecordStatus.DUPLICATE
        errors.append("重复上报：该记录已存在于系统中")
        return False, errors

    if not record.worker_id:
        errors.append("缺少工人编号")
    if not record.worker_name:
        errors.append("缺少工人姓名")
    if not record.team_id:
        errors.append("缺少班组编号")
    if not record.pick_date:
        errors.append("缺少采摘日期")

    if record.baskets <= 0:
        errors.append(f"筐数必须大于0（当前：{record.baskets}）")

    if record.total_weight < 0:
        errors.append(f"总重量不能为负（当前：{record.total_weight}）")
    if record.bad_weight < 0:
        errors.append(f"坏果重量不能为负（当前：{record.bad_weight}）")
    if record.bad_weight > record.total_weight:
        errors.append(
            f"坏果扣重({record.bad_weight}kg)大于总重量({record.total_weight}kg)"
        )

    if record.advance_payment < 0:
        errors.append(f"预支工资不能为负（当前：{record.advance_payment}）")

    if errors:
        record.status = RecordStatus.INVALID
        return False, errors

    if not record.reviewed:
        errors.append("记录未经过班组长复核")
        record.status = RecordStatus.PENDING
    else:
        record.status = RecordStatus.REVIEWED

    return True, errors


def import_records(file_path: str) -> dict:
    existing_records = load_records()
    raw_records = parse_csv_file(file_path)

    results = {
        "total": len(raw_records),
        "imported": 0,
        "duplicates": 0,
        "invalid": 0,
        "unreviewed": 0,
        "details": [],
    }

    for idx, row in enumerate(raw_records, 1):
        try:
            record = parse_record(row)
            is_valid, errors = validate_record(record, existing_records)

            detail = {
                "row": idx,
                "record_id": record.record_id,
                "worker": f"{record.worker_name}({record.worker_id})",
                "pick_date": record.pick_date,
                "baskets": record.baskets,
                "weight": record.total_weight,
                "bad_weight": record.bad_weight,
                "status": record.status.value,
                "errors": errors,
            }
            results["details"].append(detail)

            if record.status == RecordStatus.DUPLICATE:
                results["duplicates"] += 1
            elif record.status == RecordStatus.INVALID:
                results["invalid"] += 1
            elif record.status == RecordStatus.PENDING:
                results["unreviewed"] += 1
                existing_records[record.record_id] = record
                results["imported"] += 1
            else:
                existing_records[record.record_id] = record
                results["imported"] += 1

        except Exception as e:
            results["invalid"] += 1
            results["details"].append(
                {
                    "row": idx,
                    "record_id": "ERROR",
                    "worker": row.get("worker_name", "未知"),
                    "pick_date": row.get("pick_date", ""),
                    "baskets": row.get("baskets", ""),
                    "weight": row.get("total_weight", ""),
                    "bad_weight": row.get("bad_weight", ""),
                    "status": "解析错误",
                    "errors": [str(e)],
                }
            )

    save_records(existing_records)
    return results


def calculate_settlement(
    batch_id: str,
) -> Tuple[SettlementSummary, Dict[str, PickRecord]]:
    all_records = load_records()
    settlements = load_settlements()

    already_settled = set()
    for sid, settlement in settlements.items():
        if settlement["status"] in [
            SettlementStatus.CONFIRMED.value,
            SettlementStatus.PAID.value,
        ]:
            for rid in settlement.get("settled_records", []):
                already_settled.add(rid)

    eligible_records: Dict[str, PickRecord] = {}
    deducted_records: Dict[str, PickRecord] = {}
    deductions: List[Deduction] = []
    warnings: List[str] = []

    for rid, record in all_records.items():
        if rid in already_settled:
            continue

        if record.status == RecordStatus.DUPLICATE:
            warnings.append(
                f"记录 {rid[:8]}({record.worker_name}) 被标记为重复，已跳过"
            )
            continue

        if not record.is_valid:
            warnings.append(
                f"记录 {rid[:8]}({record.worker_name}) 数据无效（坏果扣重{record.bad_weight}kg > 总重{record.total_weight}kg），已跳过"
            )
            continue

        if not record.reviewed:
            warnings.append(
                f"记录 {rid[:8]}({record.worker_name}) 未经过班组长复核，已跳过"
            )
            continue

        eligible_records[rid] = record

    worker_settlements: Dict[str, WorkerSettlement] = {}

    for rid, record in eligible_records.items():
        worker_key = f"{record.worker_id}"
        if worker_key not in worker_settlements:
            worker_settlements[worker_key] = WorkerSettlement(
                worker_id=record.worker_id,
                worker_name=record.worker_name,
                team_id=record.team_id,
                team_name=record.team_name,
            )

        ws = worker_settlements[worker_key]

        gross_before = ws.total_gross_weight
        ws.total_gross_weight += record.total_weight

        bad_before = ws.total_bad_weight
        ws.total_bad_weight += record.bad_weight
        if record.bad_weight > 0:
            deductions.append(
                Deduction(
                    record_id=rid,
                    worker_id=record.worker_id,
                    worker_name=record.worker_name,
                    category="坏果扣重",
                    description=f"{record.pick_date} 坏果扣重 {record.bad_weight}kg",
                    amount=round(record.bad_weight * DEFAULT_RATE, 2),
                    before_value=gross_before,
                    after_value=gross_before - bad_before + (record.total_weight - record.bad_weight),
                )
            )

        net_weight = record.net_weight
        ws.total_net_weight += net_weight
        ws.total_baskets += record.baskets
        ws.valid_records += 1

        record_gross = round(net_weight * DEFAULT_RATE, 2)
        ws.gross_amount += record_gross

        if record.advance_payment > 0:
            ws.advance_payment += record.advance_payment
            deductions.append(
                Deduction(
                    record_id=rid,
                    worker_id=record.worker_id,
                    worker_name=record.worker_name,
                    category="预支工资",
                    description=f"{record.pick_date} 预支工资",
                    amount=record.advance_payment,
                    before_value=ws.gross_amount,
                    after_value=round(
                        ws.gross_amount - ws.advance_payment - ws.total_deductions, 2
                    ),
                )
            )

    for worker_key, ws in worker_settlements.items():
        ws.total_deductions = sum(
            d.amount
            for d in deductions
            if d.worker_id == ws.worker_id and d.category == "坏果扣重"
        )
        potential_net = round(
            ws.gross_amount - ws.total_deductions - ws.advance_payment, 2
        )

        if potential_net < 0:
            warnings.append(
                f"警告：工人 {ws.worker_name}({ws.worker_id}) 预支工资({ws.advance_payment}元) + 坏果扣重({ws.total_deductions}元) 超过应发金额({round(ws.gross_amount, 2)}元)"
            )
            ws.deductions = [
                d for d in deductions if d.worker_id == ws.worker_id
            ]
            ws.net_amount = max(0.0, potential_net)
        else:
            ws.deductions = [
                d for d in deductions if d.worker_id == ws.worker_id
            ]
            ws.net_amount = potential_net

    team_settlements: Dict[str, TeamSettlement] = {}
    for ws in worker_settlements.values():
        if ws.team_id not in team_settlements:
            team_settlements[ws.team_id] = TeamSettlement(
                team_id=ws.team_id, team_name=ws.team_name
            )
        ts = team_settlements[ws.team_id]
        ts.workers.append(ws)
        ts.total_baskets += ws.total_baskets
        ts.total_gross_weight += ws.total_gross_weight
        ts.total_bad_weight += ws.total_bad_weight
        ts.total_net_weight += ws.total_net_weight
        ts.gross_amount += ws.gross_amount
        ts.total_deductions += ws.total_deductions
        ts.total_advance += ws.advance_payment
        ts.net_amount += ws.net_amount

    summary = SettlementSummary(
        batch_id=batch_id,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        status=SettlementStatus.TRIAL,
        total_records=len(eligible_records) + len(deducted_records),
        valid_records=len(eligible_records),
        invalid_records=sum(
            1
            for r in all_records.values()
            if r.status == RecordStatus.INVALID
        ),
        duplicate_records=sum(
            1
            for r in all_records.values()
            if r.status == RecordStatus.DUPLICATE
        ),
        unreviewed_records=sum(
            1
            for r in all_records.values()
            if r.status == RecordStatus.PENDING
        ),
        deductions=deductions,
        warnings=warnings,
        team_settlements=list(team_settlements.values()),
    )

    summary.total_baskets = sum(
        ts.total_baskets for ts in summary.team_settlements
    )
    summary.total_gross_weight = sum(
        ts.total_gross_weight for ts in summary.team_settlements
    )
    summary.total_bad_weight = sum(
        ts.total_bad_weight for ts in summary.team_settlements
    )
    summary.total_net_weight = sum(
        ts.total_net_weight for ts in summary.team_settlements
    )
    summary.gross_amount = sum(ts.gross_amount for ts in summary.team_settlements)
    summary.total_deductions = sum(
        ts.total_deductions for ts in summary.team_settlements
    )
    summary.total_advance = sum(ts.total_advance for ts in summary.team_settlements)
    summary.net_amount = sum(ts.net_amount for ts in summary.team_settlements)

    return summary, eligible_records


def confirm_settlement(batch_id: str) -> Tuple[bool, dict]:
    summary, eligible_records = calculate_settlement(batch_id)

    all_records = load_records()
    for rid, record in eligible_records.items():
        all_records[rid].settlement_batch = batch_id
    save_records(all_records)

    summary.status = SettlementStatus.CONFIRMED

    summary_dict = summary.__dict__.copy()
    summary_dict["status"] = summary.status.value
    summary_dict["settled_records"] = list(eligible_records.keys())
    summary_dict["team_settlements"] = [
        {
            "team_id": ts.team_id,
            "team_name": ts.team_name,
            "total_baskets": ts.total_baskets,
            "total_gross_weight": ts.total_gross_weight,
            "total_bad_weight": ts.total_bad_weight,
            "total_net_weight": ts.total_net_weight,
            "gross_amount": ts.gross_amount,
            "total_deductions": ts.total_deductions,
            "total_advance": ts.total_advance,
            "net_amount": ts.net_amount,
            "workers": [
                {
                    "worker_id": w.worker_id,
                    "worker_name": w.worker_name,
                    "total_baskets": w.total_baskets,
                    "total_gross_weight": w.total_gross_weight,
                    "total_bad_weight": w.total_bad_weight,
                    "total_net_weight": w.total_net_weight,
                    "gross_amount": w.gross_amount,
                    "total_deductions": w.total_deductions,
                    "advance_payment": w.advance_payment,
                    "net_amount": w.net_amount,
                    "deductions": [d.__dict__ for d in w.deductions],
                }
                for w in ts.workers
            ],
        }
        for ts in summary.team_settlements
    ]
    summary_dict["deductions"] = [d.__dict__ for d in summary.deductions]

    save_settlement(batch_id, summary_dict)
    return True, summary_dict


def get_settlement(batch_id: str) -> Optional[dict]:
    settlements = load_settlements()
    return settlements.get(batch_id)


def list_settlements() -> List[dict]:
    settlements = load_settlements()
    return sorted(
        [
            {
                "batch_id": k,
                "created_at": v["created_at"],
                "status": v["status"],
                "net_amount": v["net_amount"],
                "valid_records": v["valid_records"],
            }
            for k, v in settlements.items()
        ],
        key=lambda x: x["created_at"],
        reverse=True,
    )


def export_settlement_to_csv(batch_id: str, output_path: str) -> str:
    settlement = get_settlement(batch_id)
    if not settlement:
        raise ValueError(f"结算批次不存在: {batch_id}")

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["果园采摘工计件结算表"])
        writer.writerow(["批次号", batch_id])
        writer.writerow(["结算日期", settlement["created_at"]])
        writer.writerow(["状态", settlement["status"]])
        writer.writerow([])

        writer.writerow(["=== 汇总 ==="])
        writer.writerow(["有效记录数", settlement["valid_records"]])
        writer.writerow(["总筐数", settlement["total_baskets"]])
        writer.writerow(["总重量(kg)", round(settlement["total_gross_weight"], 2)])
        writer.writerow(["坏果扣重(kg)", round(settlement["total_bad_weight"], 2)])
        writer.writerow(["净重量(kg)", round(settlement["total_net_weight"], 2)])
        writer.writerow(["应发金额(元)", round(settlement["gross_amount"], 2)])
        writer.writerow(["坏果扣款(元)", round(settlement["total_deductions"], 2)])
        writer.writerow(["预支工资(元)", round(settlement["total_advance"], 2)])
        writer.writerow(["实发金额(元)", round(settlement["net_amount"], 2)])
        writer.writerow([])

        writer.writerow(["=== 班组汇总 ==="])
        writer.writerow(
            [
                "班组",
                "工人人数",
                "筐数",
                "总重量(kg)",
                "坏果扣重(kg)",
                "净重量(kg)",
                "应发(元)",
                "扣款(元)",
                "预支(元)",
                "实发(元)",
            ]
        )
        for ts in settlement["team_settlements"]:
            writer.writerow(
                [
                    f"{ts['team_name']}({ts['team_id']})",
                    len(ts["workers"]),
                    ts["total_baskets"],
                    round(ts["total_gross_weight"], 2),
                    round(ts["total_bad_weight"], 2),
                    round(ts["total_net_weight"], 2),
                    round(ts["gross_amount"], 2),
                    round(ts["total_deductions"], 2),
                    round(ts["total_advance"], 2),
                    round(ts["net_amount"], 2),
                ]
            )
        writer.writerow([])

        writer.writerow(["=== 工人明细 ==="])
        writer.writerow(
            [
                "班组",
                "工人",
                "筐数",
                "总重量(kg)",
                "坏果扣重(kg)",
                "净重量(kg)",
                "应发(元)",
                "扣款(元)",
                "预支(元)",
                "实发(元)",
            ]
        )
        for ts in settlement["team_settlements"]:
            for w in ts["workers"]:
                writer.writerow(
                    [
                        f"{ts['team_name']}({ts['team_id']})",
                        f"{w['worker_name']}({w['worker_id']})",
                        w["total_baskets"],
                        round(w["total_gross_weight"], 2),
                        round(w["total_bad_weight"], 2),
                        round(w["total_net_weight"], 2),
                        round(w["gross_amount"], 2),
                        round(w["total_deductions"], 2),
                        round(w["advance_payment"], 2),
                        round(w["net_amount"], 2),
                    ]
                )
        writer.writerow([])

        writer.writerow(["=== 扣减明细 ==="])
        writer.writerow(
            ["工人", "类别", "描述", "金额(元)", "处理前", "处理后"]
        )
        for d in settlement["deductions"]:
            writer.writerow(
                [
                    f"{d['worker_name']}({d['worker_id']})",
                    d["category"],
                    d["description"],
                    round(d["amount"], 2),
                    round(d["before_value"], 2),
                    round(d["after_value"], 2),
                ]
            )
        writer.writerow([])

        if settlement.get("warnings"):
            writer.writerow(["=== 异常警告 ==="])
            for w in settlement["warnings"]:
                writer.writerow([w])

    return output_path


def generate_batch_id() -> str:
    return datetime.now().strftime("%Y%m%d") + uuid.uuid4().hex[:6].upper()
