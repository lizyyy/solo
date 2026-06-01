import csv
import json
import os
from datetime import datetime
from typing import Optional

from .models import RateRecord

FIELD_ALIASES = {
    "from_currency": ["from_currency", "from", "base", "base_currency", "src", "源币种", "起始币种"],
    "to_currency": ["to_currency", "to", "target", "quote", "quote_currency", "dst", "目标币种", "报价币种"],
    "rate": ["rate", "price", "exchange_rate", "fx_rate", "汇率", "兑换率", "报价"],
    "unit": ["unit", "单位", "denomination", "面额"],
    "original_source": ["source", "来源", "original_source", "数据源", "src_file"],
    "original_notes": ["notes", "备注", "remark", "comment", "说明", "原始备注", "note"],
}

REQUIRED_FIELDS = ["from_currency", "to_currency", "rate"]


def _resolve_field(raw_header: str) -> list:
    cleaned = raw_header.strip().lower().replace(" ", "_")
    matches = []
    for canonical, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if cleaned == alias.lower().replace(" ", "_"):
                matches.append(canonical)
                break
    return matches


def _build_header_map(headers: list) -> dict:
    mapping = {}
    used_canonical = set()
    for h in headers:
        candidates = _resolve_field(h)
        for canonical in candidates:
            if canonical not in used_canonical:
                mapping[h] = canonical
                used_canonical.add(canonical)
                break
    return mapping


def _parse_rate(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(",", "").replace("，", "")
    if s == "" or s == "-" or s == "N/A" or s == "n/a" or s == "NULL":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_rates(filepath: str) -> list:
    now = datetime.now().isoformat()
    ext = os.path.splitext(filepath)[1].lower()

    if ext == ".csv":
        return _load_csv(filepath, now)
    elif ext in (".json", ".jsonl"):
        return _load_json(filepath, now)
    else:
        raise ValueError(f"不支持的文件格式: {ext}，仅支持 .csv / .json / .jsonl")


def _load_csv(filepath: str, now: str) -> list:
    records = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        header_map = _build_header_map(reader.fieldnames or [])
        mapped = set(header_map.values())
        for req in REQUIRED_FIELDS:
            if req not in mapped:
                raise ValueError(f"CSV 缺少必要字段: {req}，已识别的列: {list(header_map.values())}")

        for idx, row in enumerate(reader):
            record = _row_to_record(idx, row, header_map, now)
            records.append(record)
    return records


def _load_json(filepath: str, now: str) -> list:
    records = []
    with open(filepath, "r", encoding="utf-8") as f:
        if filepath.endswith(".jsonl"):
            items = [json.loads(line) for line in f if line.strip()]
        else:
            items = json.load(f)
            if isinstance(items, dict):
                items = [items]

    if not items:
        return records

    sample_keys = list(items[0].keys())
    header_map = _build_header_map(sample_keys)
    mapped = set(header_map.values())
    for req in REQUIRED_FIELDS:
        if req not in mapped:
            raise ValueError(f"JSON 缺少必要字段: {req}，已识别的键: {list(header_map.values())}")

    for idx, item in enumerate(items):
        record = _row_to_record(idx, item, header_map, now)
        records.append(record)
    return records


def _row_to_record(idx: int, row: dict, header_map: dict, now: str) -> RateRecord:
    mapped = {}
    for raw_key, canonical in header_map.items():
        val = row.get(raw_key)
        mapped[canonical] = val

    from_cur = str(mapped.get("from_currency", "")).strip().upper()
    to_cur = str(mapped.get("to_currency", "")).strip().upper()
    raw_rate = mapped.get("rate")
    rate = _parse_rate(raw_rate)
    unit = str(mapped.get("unit", "1")).strip()
    source = str(mapped.get("original_source", "")).strip()
    notes = str(mapped.get("original_notes", "")).strip()

    record = RateRecord(
        row_index=idx,
        from_currency=from_cur,
        to_currency=to_cur,
        rate=rate,
        unit=unit,
        original_source=source,
        original_notes=notes,
        raw_row=dict(row),
        loaded_at=now,
    )

    if not from_cur:
        record.mark_uncomputable("源币种为空")
    elif not to_cur:
        record.mark_uncomputable("目标币种为空")
    elif rate is None:
        record.mark_uncomputable(f"汇率无法解析: 原始值='{raw_rate}'")
    elif rate <= 0:
        record.mark_uncomputable(f"汇率非正数: rate={rate}")

    return record
