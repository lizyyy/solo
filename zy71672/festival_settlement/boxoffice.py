import json
import os
from datetime import date, datetime as dt
from typing import List, Dict
from collections import defaultdict
import decimal

from .models import BoxOfficeTransaction, PerformanceSchedule, RecordStatus


def load_boxoffice(input_dir: str) -> List[BoxOfficeTransaction]:
    bo_dir = os.path.join(input_dir, "boxoffice")
    if not os.path.isdir(bo_dir):
        return []
    results = []
    for fname in sorted(os.listdir(bo_dir)):
        fpath = os.path.join(bo_dir, fname)
        if not fname.endswith(".json"):
            continue
        results.extend(_load_json_boxoffice(fpath))
    return results


def _load_json_boxoffice(fpath: str) -> List[BoxOfficeTransaction]:
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    results = []
    for item in data:
        t = BoxOfficeTransaction(
            txn_id=item["txn_id"],
            txn_date=_parse_date(item["txn_date"]),
            stage=item["stage"],
            ticket_type=item["ticket_type"],
            quantity=int(item["quantity"]),
            unit_price=decimal.Decimal(str(item["unit_price"])),
            total_amount=decimal.Decimal(str(item["total_amount"])),
            notes=item.get("notes", ""),
            status=RecordStatus(item.get("status", "pending")),
            source_file=os.path.basename(fpath),
        )
        results.append(t)
    return results


def load_schedules(input_dir: str) -> List[PerformanceSchedule]:
    sched_dir = os.path.join(input_dir, "schedules")
    if not os.path.isdir(sched_dir):
        return []
    results = []
    for fname in sorted(os.listdir(sched_dir)):
        fpath = os.path.join(sched_dir, fname)
        if not fname.endswith(".json"):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = [data]
        for item in data:
            s = PerformanceSchedule(
                schedule_id=item["schedule_id"],
                artist_id=item["artist_id"],
                artist_name=item["artist_name"],
                stage=item["stage"],
                performance_date=_parse_date(item["performance_date"]),
                start_time=item["start_time"],
                end_time=item["end_time"],
                notes=item.get("notes", ""),
                status=RecordStatus(item.get("status", "pending")),
                source_file=os.path.basename(fpath),
            )
            results.append(s)
    return results


def aggregate_by_artist(
    transactions: List[BoxOfficeTransaction],
    schedules: List[PerformanceSchedule],
) -> Dict[str, decimal.Decimal]:
    stage_to_artists: Dict[str, List[PerformanceSchedule]] = defaultdict(list)
    for sched in schedules:
        key = f"{sched.performance_date.isoformat()}|{sched.stage}"
        stage_to_artists[key].append(sched)

    stage_revenue: Dict[str, decimal.Decimal] = defaultdict(decimal.Decimal)
    for txn in transactions:
        key = f"{txn.txn_date.isoformat()}|{txn.stage}"
        stage_revenue[key] += txn.total_amount

    artist_boxoffice: Dict[str, decimal.Decimal] = defaultdict(decimal.Decimal)
    for key, rev in stage_revenue.items():
        artists_on_stage = stage_to_artists.get(key, [])
        if not artists_on_stage:
            continue
        per_artist = rev / len(artists_on_stage)
        for sched in artists_on_stage:
            artist_boxoffice[sched.artist_id] += per_artist

    return dict(artist_boxoffice)


def _parse_date(val) -> date:
    if isinstance(val, date):
        return val
    s = str(val).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return dt.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {val}")
