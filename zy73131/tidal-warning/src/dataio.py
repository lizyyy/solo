import csv
import os
import shutil
import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Tuple


@dataclass
class LoadResult:
    records: List[dict]
    headers: List[str]
    skipped_rows: List[Tuple[int, str]]
    bad_rows: List[Tuple[int, str]]
    total_raw: int
    source_file: str = ''


@dataclass
class ExportDiff:
    added_rows: List[dict] = field(default_factory=list)
    removed_rows: List[dict] = field(default_factory=list)
    modified_cells: List[Tuple[int, str, str, str]] = field(default_factory=list)
    note: str = ''


def _row_hash(rec: dict) -> str:
    raw = '||'.join(f"{k}={v}" for k, v in sorted(rec.items()) if not k.startswith('_'))
    return hashlib.md5(raw.encode('utf-8')).hexdigest()[:12]


def load_csv(path: str) -> LoadResult:
    records = []
    skipped = []
    bad = []
    headers = []
    total = 0

    with open(path, 'r', encoding='utf-8-sig', newline='') as f:
        reader = csv.reader(f)
        for line_no, row in enumerate(reader, 1):
            total += 1
            if line_no == 1:
                headers = [h.strip() for h in row]
                continue
            if not any(str(c).strip() for c in row):
                skipped.append((line_no, '空白行'))
                continue
            if len(row) < 2:
                bad.append((line_no, f'列数不足({len(row)}列)，疑似截断'))
                continue
            while len(row) < len(headers):
                row.append('')
            rec = {}
            valid = True
            for i, h in enumerate(headers):
                val = str(row[i]).strip() if i < len(row) else ''
                if not h:
                    bad.append((line_no, f'存在无名列头，第{i+1}列'))
                    valid = False
                    break
                rec[h] = val
            if valid:
                rec['_original_line'] = line_no
                records.append(rec)

    return LoadResult(records, headers, skipped, bad, total, source_file=path)


def export_csv(path: str, records: List[dict], headers: List[str]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f)
        w.writerow(headers)
        for rec in records:
            w.writerow([rec.get(h, '') for h in headers])


def backup_file(path: str) -> str:
    if not os.path.exists(path):
        return ''
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    base, ext = os.path.splitext(os.path.basename(path))
    backup_dir = os.path.join(os.path.dirname(path), '..', 'backups')
    os.makedirs(backup_dir, exist_ok=True)
    bp = os.path.join(backup_dir, f"{base}_{ts}{ext}")
    shutil.copy2(path, bp)
    return bp


def diff_exports(old_path: str, new_records: List[dict], headers: List[str]) -> ExportDiff:
    diff = ExportDiff()
    if not os.path.exists(old_path):
        diff.added_rows = list(new_records)
        diff.note = '首次导出，全部记为新增'
        return diff

    old_raw = load_csv(old_path).records
    old = [{k: v for k, v in r.items() if not k.startswith('_')} for r in old_raw]
    new = [{k: v for k, v in r.items() if not k.startswith('_')} for r in new_records]
    old_map = {_row_hash(r): r for r in old}
    new_map = {_row_hash(r): r for r in new}

    for h, r in new_map.items():
        if h not in old_map:
            diff.added_rows.append(r)
    for h, r in old_map.items():
        if h not in new_map:
            diff.removed_rows.append(r)

    old_by_key = {}
    for idx, r in enumerate(old):
        key = f"{r.get('站点名称', '')}__{r.get('采样日期', '')}__{r.get('采样时间', '')}__{r.get('采样瓶编号', '')}__{idx}"
        old_by_key[key] = (idx + 2, r)
    for idx, r in enumerate(new):
        key = f"{r.get('站点名称', '')}__{r.get('采样日期', '')}__{r.get('采样时间', '')}__{r.get('采样瓶编号', '')}__{idx}"
        if key in old_by_key:
            rn, old_r = old_by_key[key]
            for h in headers:
                ov = str(old_r.get(h, ''))
                nv = str(r.get(h, ''))
                if ov != nv:
                    diff.modified_cells.append((
                        rn,
                        h,
                        ov,
                        nv
                    ))
    return diff
