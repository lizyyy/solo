from __future__ import annotations

import csv
import io
import json
import math
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    ConflictPolicy,
    ImportConflict,
    TuningPhase,
    TuningRecord,
    detect_freq_unit,
    parse_note,
)


COLUMN_ALIASES: Dict[str, List[str]] = {
    "piano_id": ["piano_id", "钢琴编号", "琴号", "钢琴id", "piano", "乐器编号", "琴编号", "乐器id"],
    "note": ["note", "键名", "音名", "琴键", "key", "按键", "音名键", "音符"],
    "measured_freq": ["measured_freq", "实测频率", "频率", "frequency", "freq", "测量频率", "实测", "测量值", "实际频率"],
    "freq_unit": ["freq_unit", "单位", "unit", "频率单位"],
    "deviation_cents": ["deviation_cents", "频偏", "偏差", "deviation", "cents", "偏移量", "音分偏移", "音分"],
    "tuning_date": ["tuning_date", "日期", "调律日期", "date", "记录日期", "测试日期"],
    "tuning_phase": ["tuning_phase", "阶段", "调律阶段", "phase", "前后", "调律前后", "before_after"],
    "room_temp": ["room_temp", "温度", "室温", "temp", "temperature", "室内温度"],
    "room_humidity": ["room_humidity", "湿度", "humidity", "相对湿度", "室内湿度"],
    "customer_note": ["customer_note", "备注", "客户备注", "note_remark", "说明", "客户说明", "备注信息"],
}


def _fuzzy_match_column(header: str) -> Optional[str]:
    h = header.strip().lower().replace(" ", "_").replace("-", "_")
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if h == alias:
                return canonical
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in h or h in alias:
                return canonical
    return None


def _safe_float(val: Any) -> Optional[float]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return None
        return float(val)
    s = str(val).strip()
    s = s.replace("，", "").replace(",", "").replace("℃", "").replace("°C", "").replace("°", "")
    s = s.replace("%", "").replace("％", "")
    s = s.replace("Hz", "").replace("hz", "").replace("HZ", "").replace("赫兹", "")
    s = s.replace("cents", "").replace("cent", "").replace("¢", "").replace("音分", "")
    s = s.replace("kHz", "").replace("千赫", "")
    if not s:
        return None
    try:
        result = float(s)
        if math.isnan(result) or math.isinf(result):
            return None
        return result
    except (ValueError, TypeError):
        return None


def _parse_date(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, (datetime,)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s.lower() in ("nan", "none", "nat", "-"):
        return ""
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y%m%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            dt = datetime.strptime(s, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return s


def _parse_phase(val: Any) -> TuningPhase:
    if val is None:
        return TuningPhase.UNKNOWN
    s = str(val).strip().lower()
    if s in ("before", "前", "调律前", "调前", "pre"):
        return TuningPhase.BEFORE
    if s in ("after", "后", "调律后", "调后", "post"):
        return TuningPhase.AFTER
    return TuningPhase.UNKNOWN


def _fill_merged_cells(rows: List[List[str]]) -> List[List[str]]:
    if not rows:
        return rows
    result = [row[:] for row in rows]
    ncols = max(len(r) for r in result)
    for row in result:
        while len(row) < ncols:
            row.append("")
    for col in range(ncols):
        last_val = ""
        for row in result:
            cell = row[col].strip() if row[col] else ""
            if cell:
                last_val = cell
            else:
                row[col] = last_val
    return result


class ImportResult:
    def __init__(self):
        self.records: List[TuningRecord] = []
        self.skipped: List[TuningRecord] = []
        self.updated: List[Tuple[TuningRecord, TuningRecord]] = []
        self.conflicts: List[ImportConflict] = []
        self.parse_warnings: List[str] = []
        self.ignored_columns: List[str] = []

    def summary(self) -> str:
        lines = [
            f"导入完成:",
            f"  成功导入: {len(self.records)} 条",
            f"  跳过(重复): {len(self.skipped)} 条",
            f"  更新(覆盖): {len(self.updated)} 条",
            f"  冲突: {len(self.conflicts)} 条",
            f"  解析警告: {len(self.parse_warnings)} 条",
        ]
        if self.ignored_columns:
            lines.append(f"  忽略的列: {', '.join(self.ignored_columns)}")
        return "\n".join(lines)


def _row_to_record(
    row: Dict[str, Any],
    col_map: Dict[str, int],
    source_file: str,
    row_index: int,
    default_piano_id: str,
    default_date: str,
    default_phase: TuningPhase,
) -> Tuple[Optional[TuningRecord], List[str]]:
    warnings: List[str] = []

    def get_val(key: str) -> Any:
        if key in col_map:
            v = row.get(list(row.keys())[col_map[key]] if col_map[key] < len(row) else "")
            return v
        return None

    def col_val(key: str) -> Any:
        idx = col_map.get(key)
        if idx is None:
            return None
        keys = list(row.keys())
        if idx >= len(keys):
            return None
        k = keys[idx]
        return row.get(k)

    piano_id = col_val("piano_id")
    if piano_id is None or str(piano_id).strip() == "":
        piano_id = default_piano_id
    piano_id = str(piano_id).strip()

    note_raw = col_val("note")
    if note_raw is None or str(note_raw).strip() == "":
        warnings.append(f"第{row_index+1}行: 缺少键名，跳过")
        return None, warnings
    note_raw = str(note_raw).strip()

    note_parsed = parse_note(note_raw)
    if note_parsed is None:
        warnings.append(f"第{row_index+1}行: 无法解析音名 '{note_raw}'（可能是等音映射错误或格式不规范）")
        return None, warnings

    measured_freq = _safe_float(col_val("measured_freq"))

    freq_unit_raw = col_val("freq_unit")
    freq_unit = detect_freq_unit(str(freq_unit_raw)) if freq_unit_raw else "Hz"

    if freq_unit == "cents" and measured_freq is not None:
        deviation_cents = measured_freq
        measured_freq = None
    elif freq_unit == "kHz" and measured_freq is not None:
        measured_freq = measured_freq * 1000.0
        freq_unit = "Hz"
        deviation_cents = _safe_float(col_val("deviation_cents"))
    else:
        deviation_cents = _safe_float(col_val("deviation_cents"))

    tuning_date = _parse_date(col_val("tuning_date"))
    if not tuning_date:
        tuning_date = default_date

    tuning_phase = _parse_phase(col_val("tuning_phase"))
    if tuning_phase == TuningPhase.UNKNOWN:
        tuning_phase = default_phase

    room_temp = _safe_float(col_val("room_temp"))
    room_humidity = _safe_float(col_val("room_humidity"))
    customer_note = str(col_val("customer_note") or "").strip() if col_val("customer_note") else ""

    record = TuningRecord(
        piano_id=piano_id,
        note_raw=note_raw,
        note_parsed=note_parsed,
        measured_freq=measured_freq,
        freq_unit=freq_unit,
        deviation_cents=deviation_cents,
        tuning_date=tuning_date,
        tuning_phase=tuning_phase,
        room_temp=room_temp,
        room_humidity=room_humidity,
        customer_note=customer_note,
        source_file=source_file,
        row_index=row_index,
    )

    return record, warnings


class DataStore:
    def __init__(self):
        self.records: Dict[str, TuningRecord] = {}

    def load_from_file(
        self,
        filepath: str,
        conflict_policy: ConflictPolicy = ConflictPolicy.ERROR,
        default_piano_id: str = "",
        default_date: str = "",
        default_phase: TuningPhase = TuningPhase.BEFORE,
        fill_merged: bool = True,
    ) -> ImportResult:
        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".csv":
            return self._load_csv(filepath, conflict_policy, default_piano_id, default_date, default_phase, fill_merged)
        elif ext in (".xlsx", ".xls"):
            return self._load_excel(filepath, conflict_policy, default_piano_id, default_date, default_phase, fill_merged)
        elif ext == ".json":
            return self._load_json(filepath, conflict_policy, default_piano_id, default_date, default_phase)
        else:
            result = ImportResult()
            result.parse_warnings.append(f"不支持的文件格式: {ext}")
            return result

    def _load_csv(
        self,
        filepath: str,
        conflict_policy: ConflictPolicy,
        default_piano_id: str,
        default_date: str,
        default_phase: TuningPhase,
        fill_merged: bool,
    ) -> ImportResult:
        result = ImportResult()
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(filepath, "r", encoding="gbk") as f:
                content = f.read()

        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(content[:4096])
        except csv.Error:
            dialect = csv.excel

        reader = csv.reader(io.StringIO(content), dialect)
        rows = list(reader)
        if not rows:
            result.parse_warnings.append("文件为空")
            return result

        if fill_merged:
            str_rows = [[str(c) if c is not None else "" for c in row] for row in rows]
            if len(str_rows) > 1:
                header_row = str_rows[0]
                data_rows = _fill_merged_cells(str_rows[1:])
                str_rows = [header_row] + data_rows
        else:
            str_rows = [[str(c) if c is not None else "" for c in row] for row in rows]

        headers = str_rows[0]
        col_map: Dict[str, int] = {}
        ignored: List[str] = []
        for i, h in enumerate(headers):
            canonical = _fuzzy_match_column(h)
            if canonical:
                if canonical not in col_map:
                    col_map[canonical] = i
            else:
                ignored.append(h.strip())

        result.ignored_columns = ignored

        for row_idx, row_data in enumerate(str_rows[1:], start=1):
            while len(row_data) < len(headers):
                row_data.append("")
            row_dict = {headers[i]: row_data[i] for i in range(min(len(headers), len(row_data)))}
            record, warnings = _row_to_record(
                row_dict, col_map, filepath, row_idx, default_piano_id, default_date, default_phase
            )
            result.parse_warnings.extend(warnings)
            if record is None:
                continue
            self._apply_record(record, conflict_policy, result)

        return result

    def _load_excel(
        self,
        filepath: str,
        conflict_policy: ConflictPolicy,
        default_piano_id: str,
        default_date: str,
        default_phase: TuningPhase,
        fill_merged: bool,
    ) -> ImportResult:
        result = ImportResult()
        try:
            import openpyxl
        except ImportError:
            result.parse_warnings.append("需要 openpyxl 库来读取 Excel 文件，请执行: pip install openpyxl")
            return result

        wb = openpyxl.load_workbook(filepath, data_only=True)
        ws = wb.active

        rows_raw = []
        for row in ws.iter_rows(values_only=True):
            rows_raw.append([str(c) if c is not None else "" for c in row])

        if not rows_raw:
            result.parse_warnings.append("Excel 文件为空")
            return result

        if fill_merged and len(rows_raw) > 1:
            header_row = rows_raw[0]
            data_rows = _fill_merged_cells(rows_raw[1:])
            rows_raw = [header_row] + data_rows

        headers = rows_raw[0]
        col_map: Dict[str, int] = {}
        ignored: List[str] = []
        for i, h in enumerate(headers):
            h = str(h).strip() if h else ""
            if not h:
                continue
            canonical = _fuzzy_match_column(h)
            if canonical:
                if canonical not in col_map:
                    col_map[canonical] = i
            else:
                ignored.append(h)

        result.ignored_columns = ignored

        for row_idx, row_data in enumerate(rows_raw[1:], start=1):
            while len(row_data) < len(headers):
                row_data.append("")
            row_dict = {headers[i]: row_data[i] for i in range(min(len(headers), len(row_data)))}
            record, warnings = _row_to_record(
                row_dict, col_map, filepath, row_idx, default_piano_id, default_date, default_phase
            )
            result.parse_warnings.extend(warnings)
            if record is None:
                continue
            self._apply_record(record, conflict_policy, result)

        return result

    def _load_json(
        self,
        filepath: str,
        conflict_policy: ConflictPolicy,
        default_piano_id: str,
        default_date: str,
        default_phase: TuningPhase,
    ) -> ImportResult:
        result = ImportResult()
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data if isinstance(data, list) else [data]

        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                result.parse_warnings.append(f"第{idx+1}项: 不是对象，跳过")
                continue

            col_map: Dict[str, int] = {}
            for i, key in enumerate(item.keys()):
                canonical = _fuzzy_match_column(key)
                if canonical:
                    if canonical not in col_map:
                        col_map[canonical] = i

            record, warnings = _row_to_record(
                item, col_map, filepath, idx, default_piano_id, default_date, default_phase
            )
            result.parse_warnings.extend(warnings)
            if record is None:
                continue
            self._apply_record(record, conflict_policy, result)

        return result

    def _apply_record(
        self,
        record: TuningRecord,
        conflict_policy: ConflictPolicy,
        result: ImportResult,
    ):
        pk = record.primary_key
        if pk not in self.records:
            self.records[pk] = record
            result.records.append(record)
            return

        existing = self.records[pk]
        diffs = self._diff_records(existing, record)

        if not diffs:
            result.skipped.append(record)
            return

        if conflict_policy == ConflictPolicy.SKIP:
            result.skipped.append(record)
        elif conflict_policy == ConflictPolicy.UPDATE:
            self.records[pk] = record
            result.updated.append((existing, record))
            result.records.append(record)
        elif conflict_policy == ConflictPolicy.ERROR:
            conflict = ImportConflict(
                existing=existing,
                incoming=record,
                field_differences=diffs,
            )
            result.conflicts.append(conflict)

    def _diff_records(
        self, a: TuningRecord, b: TuningRecord
    ) -> List[Tuple[str, str, str]]:
        diffs: List[Tuple[str, str, str]] = []
        fields = [
            ("measured_freq", "实测频率"),
            ("deviation_cents", "频偏(音分)"),
            ("room_temp", "温度"),
            ("room_humidity", "湿度"),
            ("customer_note", "客户备注"),
        ]
        for attr, label in fields:
            va = getattr(a, attr, None)
            vb = getattr(b, attr, None)
            if va != vb:
                diffs.append((label, str(va), str(vb)))
        return diffs

    def get_all_records(self) -> List[TuningRecord]:
        return list(self.records.values())

    def get_records_by_piano(self, piano_id: str) -> List[TuningRecord]:
        return [r for r in self.records.values() if r.piano_id == piano_id]

    def get_records_by_date(self, date: str) -> List[TuningRecord]:
        return [r for r in self.records.values() if r.tuning_date == date]

    def get_records_by_phase(self, phase: TuningPhase) -> List[TuningRecord]:
        return [r for r in self.records.values() if r.tuning_phase == phase]
