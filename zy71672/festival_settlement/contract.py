import json
import os
from datetime import date, datetime as dt
from typing import List
import decimal

from .models import ArtistContract, RecordStatus


def load_contracts(input_dir: str) -> List[ArtistContract]:
    contracts_dir = os.path.join(input_dir, "contracts")
    if not os.path.isdir(contracts_dir):
        return []
    results = []
    for fname in sorted(os.listdir(contracts_dir)):
        fpath = os.path.join(contracts_dir, fname)
        if not (fname.endswith(".json") or fname.endswith(".csv")):
            continue
        if fname.endswith(".json"):
            results.extend(_load_json_contracts(fpath))
        elif fname.endswith(".csv"):
            results.extend(_load_csv_contracts(fpath))
    return results


def _load_json_contracts(fpath: str) -> List[ArtistContract]:
    with open(fpath, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    results = []
    for item in data:
        c = ArtistContract(
            contract_id=item["contract_id"],
            artist_id=item["artist_id"],
            artist_name=item["artist_name"],
            guarantee_amount=decimal.Decimal(str(item["guarantee_amount"])),
            revenue_share_ratio=decimal.Decimal(str(item["revenue_share_ratio"])),
            contract_date=_parse_date(item["contract_date"]),
            stage=item.get("stage", ""),
            notes=item.get("notes", ""),
            status=RecordStatus(item.get("status", "pending")),
            source_file=os.path.basename(fpath),
        )
        results.append(c)
    return results


def _load_csv_contracts(fpath: str) -> List[ArtistContract]:
    import csv
    results = []
    with open(fpath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            c = ArtistContract(
                contract_id=row["contract_id"],
                artist_id=row["artist_id"],
                artist_name=row["artist_name"],
                guarantee_amount=decimal.Decimal(str(row["guarantee_amount"])),
                revenue_share_ratio=decimal.Decimal(str(row["revenue_share_ratio"])),
                contract_date=_parse_date(row["contract_date"]),
                stage=row.get("stage", ""),
                notes=row.get("notes", ""),
                status=RecordStatus(row.get("status", "pending")),
                source_file=os.path.basename(fpath),
            )
            results.append(c)
    return results


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
