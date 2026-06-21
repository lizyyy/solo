#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
耳返通道换场检查 - 核心校验脚本
支持 CSV/Excel 多源导入、列名映射、命名归一、来源行保留
关联文件、曲目、批注，识别异常，检测冲突，生成交接清单
"""

import csv
import json
import re
import os
import sys
import argparse
from datetime import datetime, date
from collections import defaultdict, OrderedDict

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

TODAY = date(2026, 6, 8)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
IMPORT_DIR = os.path.join(DATA_DIR, "imports")
STATE_FILE = os.path.join(DATA_DIR, ".check_state.json")
STAGE_TABLE = os.path.join(DATA_DIR, "stage_channel_table.csv")
CHECK_DATA = os.path.join(DATA_DIR, "ear_return_channel_check.csv")
REPORT_FILE = os.path.join(DATA_DIR, "耳返通道换场检查_交接清单.md")
MAPPING_FILE = os.path.join(DATA_DIR, "column_mapping.json")
SUPPLEMENT_FILE = os.path.join(DATA_DIR, "supplements.json")

STAGE_FIELDS = OrderedDict([
    ("通道编号", "channel"),
    ("曲目名称", "track_name"),
    ("文件路径", "file_path"),
    ("母带版本", "master_version"),
    ("艺人", "artist"),
    ("时码入点", "tc_in"),
    ("时码出点", "tc_out"),
    ("舞台区域", "stage_area"),
    ("合同编号", "contract_no"),
    ("合同备注", "contract_remark"),
    ("负责人", "owner"),
    ("登记日期", "reg_date"),
])

CHECK_FIELDS = OrderedDict([
    ("批次号", "batch_no"),
    ("检查日期", "check_date"),
    ("检查人", "checker"),
    ("通道编号", "channel"),
    ("曲目名称", "track_name"),
    ("文件名", "file_name"),
    ("文件时长", "duration"),
    ("时码入点", "tc_in"),
    ("时码出点", "tc_out"),
    ("版本标记", "version_tag"),
    ("批注", "annotation"),
    ("导入来源", "import_source"),
    ("人工改名标记", "manual_rename"),
])

COLUMN_ALIASES = {
    "通道编号": ["编号", "通道号", "通道", "Channel", "channel", "ch", "CH"],
    "曲目名称": ["歌名", "曲目", "曲名", "Track", "track", "title", "Title"],
    "文件路径": ["音频文件", "文件路径", "文件", "File", "file_path", "path"],
    "母带版本": ["版本", "母带", "Version", "version", "master_version"],
    "艺人": ["歌手", "艺术家", "Artist", "artist", "演唱者"],
    "时码入点": ["起点时间", "入点", "TC In", "tc_in", "Start", "start"],
    "时码出点": ["终点时间", "出点", "TC Out", "tc_out", "End", "end"],
    "舞台区域": ["区域", "舞台", "Stage", "stage_area", "Area"],
    "合同编号": ["合同号", "合同", "Contract", "contract_no"],
    "合同备注": ["合同说明", "备注", "Remark", "remark", "合同信息"],
    "负责人": ["经手人", "负责人", "Owner", "owner", "经办人", "对接人"],
    "登记日期": ["录入日期", "日期", "Date", "date", "登记时间"],
    "批次号": ["批次", "Batch", "batch"],
    "检查日期": ["检查时间", "Check Date"],
    "检查人": ["检查员", "Checker"],
    "文件名": ["音频文件名", "FileName", "filename"],
    "文件时长": ["时长", "Duration", "duration"],
    "版本标记": ["版本号", "版本标识"],
    "批注": ["备注信息", "Note", "note", "说明"],
    "导入来源": ["来源", "Source", "source"],
    "人工改名标记": ["改名标记", "改名", "Rename"],
}

STAGE_FIELD_TO_INTERNAL = {std: internal for std, internal in STAGE_FIELDS.items()}
CHECK_FIELD_TO_INTERNAL = {std: internal for std, internal in CHECK_FIELDS.items()}

INTERNAL_TO_STAGE_FIELD = {internal: std for std, internal in STAGE_FIELDS.items()}
INTERNAL_TO_CHECK_FIELD = {internal: std for std, internal in CHECK_FIELDS.items()}

ALL_STD_TO_INTERNAL = {}
ALL_STD_TO_INTERNAL.update(STAGE_FIELD_TO_INTERNAL)
ALL_STD_TO_INTERNAL.update(CHECK_FIELD_TO_INTERNAL)


def resolve_supplement_field(field_name):
    if field_name in ALL_STD_TO_INTERNAL:
        return ALL_STD_TO_INTERNAL[field_name]
    for std_name, aliases in COLUMN_ALIASES.items():
        if field_name in aliases or field_name.lower() in [a.lower() for a in aliases]:
            if std_name in ALL_STD_TO_INTERNAL:
                return ALL_STD_TO_INTERNAL[std_name]
    return field_name


def ensure_dir(path):
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


def parse_timecode(tc):
    if not tc or str(tc).strip() == "":
        return None
    try:
        parts = str(tc).strip().split(":")
        if len(parts) == 3:
            h, m, s = map(int, parts)
            return h * 3600 + m * 60 + s
        elif len(parts) == 2:
            m, s = map(int, parts)
            return m * 60 + s
    except (ValueError, AttributeError):
        pass
    return None


def format_timecode(seconds):
    if seconds is None:
        return ""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def parse_authorization(remark):
    if not remark:
        return None, None, "未填写合同备注"
    pattern = r"授权期限[:：]\s*(\d{4}-\d{2}-\d{2})\s*[至到\-]\s*(\d{4}-\d{2}-\d{2})"
    match = re.search(pattern, str(remark))
    if match:
        try:
            start = datetime.strptime(match.group(1), "%Y-%m-%d").date()
            end = datetime.strptime(match.group(2), "%Y-%m-%d").date()
            return start, end, None
        except ValueError:
            return None, None, "授权日期格式错误"
    if "授权待确认" in str(remark):
        return None, None, "授权待确认"
    return None, None, "未找到授权期限"


def resolve_column_mapping(headers, target_fields):
    mapping = {}
    used_headers = set()
    unmatched = []

    for header in headers:
        h = header.strip()
        if h in target_fields:
            mapping[h] = h
            used_headers.add(h)
            continue
        for std_name, aliases in COLUMN_ALIASES.items():
            if std_name not in target_fields:
                continue
            if h in aliases or h.lower() in [a.lower() for a in aliases]:
                mapping[h] = std_name
                used_headers.add(h)
                break
        else:
            unmatched.append(h)

    missing = [f for f in target_fields if f not in mapping.values()]
    return mapping, missing, unmatched


def read_csv_file(filepath):
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        for row in reader:
            rows.append({k.strip(): str(v).strip() if v else "" for k, v in row.items()})
    return [h.strip() for h in headers], rows


def read_xlsx_file(filepath):
    if not HAS_OPENPYXL:
        print("❌ 需要 openpyxl 库来读取 Excel 文件，请运行: pip install openpyxl")
        sys.exit(1)
    wb = openpyxl.load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not all_rows:
        return [], []
    headers = [str(h).strip() if h else "" for h in all_rows[0]]
    rows = []
    for row_data in all_rows[1:]:
        row = {}
        for i, h in enumerate(headers):
            row[h] = str(row_data[i]).strip() if i < len(row_data) and row_data[i] is not None else ""
        rows.append(row)
    return headers, rows


def read_source_file(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".xlsx":
        return read_xlsx_file(filepath)
    elif ext == ".csv":
        return read_csv_file(filepath)
    else:
        print(f"❌ 不支持的文件格式: {ext}，仅支持 .csv 和 .xlsx")
        return [], []


def load_column_mappings():
    if os.path.exists(MAPPING_FILE):
        with open(MAPPING_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_column_mappings(mappings):
    with open(MAPPING_FILE, "w", encoding="utf-8") as f:
        json.dump(mappings, f, ensure_ascii=False, indent=2)


def load_supplements():
    if os.path.exists(SUPPLEMENT_FILE):
        with open(SUPPLEMENT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"stage": {}, "check": {}}


def save_supplements(supplements):
    with open(SUPPLEMENT_FILE, "w", encoding="utf-8") as f:
        json.dump(supplements, f, ensure_ascii=False, indent=2)


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            state = json.load(f)
            if "resolved_issues" not in state or not isinstance(state["resolved_issues"], dict):
                state["resolved_issues"] = {}
            return state
    return {
        "processed_channels": [],
        "resolved_issues": {},
        "notes": {},
        "last_updated": None,
    }


def save_state(state):
    state["last_updated"] = TODAY.isoformat()
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def issue_key(issue_type, channel, detail=""):
    """生成问题唯一标识，用于追踪解决状态"""
    key = f"{issue_type}:{channel}"
    if detail:
        key += f":{detail}"
    return key


def parse_note_for_actions(note, channel, stage_records, check_records):
    """
    解析备注中的智能关键词，返回需要自动应用的变更动作
    返回: (supplement_actions, resolve_issue_keys, summary)
    """
    supplement_actions = []  # (data_type, field, value)
    resolve_keys = []
    summary = []

    note_lower = note.lower()
    stage = stage_records.get(channel, {})
    checks = check_records.get(channel, [])

    if "母带为最新版" in note or "母带升级" in note or "2025_master" in note:
        for i, check in enumerate(checks):
            if check.get("version_tag") and check["version_tag"] != "2025_master":
                supplement_actions.append(("check", i, "version_tag", "2025_master"))
                old_ver = check["version_tag"]
                summary.append(f"母带 {old_ver} → 2025_master（检查记录 {i+1}）")
                resolve_keys.append(issue_key("old_master", channel, check["file_name"]))
                resolve_keys.append(issue_key("conflict", channel, f"version:{check['file_name']}"))

    if "时码已对齐" in note or "时码同步" in note:
        for i, check in enumerate(checks):
            if stage and (stage.get("tc_in") or stage.get("tc_out")):
                if check.get("tc_in") != stage.get("tc_in") and stage.get("tc_in"):
                    supplement_actions.append(("check", i, "tc_in", stage["tc_in"]))
                    summary.append(f"入点 {check.get('tc_in','?')} → {stage['tc_in']}（检查记录 {i+1}）")
                    resolve_keys.append(issue_key("timecode", channel, f"in:{check['file_name']}"))
                    resolve_keys.append(issue_key("conflict", channel, f"tc_in:{check['file_name']}"))
                if check.get("tc_out") != stage.get("tc_out") and stage.get("tc_out"):
                    supplement_actions.append(("check", i, "tc_out", stage["tc_out"]))
                    summary.append(f"出点 {check.get('tc_out','?')} → {stage['tc_out']}（检查记录 {i+1}）")
                    resolve_keys.append(issue_key("timecode", channel, f"out:{check['file_name']}"))
                    resolve_keys.append(issue_key("conflict", channel, f"tc_out:{check['file_name']}"))

    if "文件已确认" in note or "文件名一致" in note:
        for i, check in enumerate(checks):
            stage_file = os.path.basename(stage.get("file_path", "")) if stage else ""
            if stage_file and check.get("file_name") and stage_file != check["file_name"]:
                if not check.get("manual_rename"):
                    resolve_keys.append(issue_key("conflict", channel, f"file:{check['file_name']}"))
                    summary.append(f"文件名差异已确认（检查记录 {i+1}）")

    if "授权已续签" in note or "授权已续" in note:
        match = re.search(r"20\d{2}", note)
        new_end_year = match.group() if match else "2027"
        old_remark = stage.get("contract_remark", "")
        pattern = r"授权期限[:：]\s*(\d{4}-\d{2}-\d{2})\s*[至到\-]\s*(\d{4}-\d{2}-\d{2})"
        new_remark = re.sub(pattern, lambda m: f"授权期限:{m.group(1)} 至 {new_end_year}-12-31", old_remark)
        if new_remark != old_remark:
            supplement_actions.append(("stage", None, "contract_remark", new_remark))
            summary.append(f"授权续签到 {new_end_year}-12-31")
            resolve_keys.append(issue_key("auth", channel, "expired"))

    if "授权已确认" in note:
        resolve_keys.append(issue_key("auth", channel, "expired"))
        resolve_keys.append(issue_key("auth", channel, "missing"))
        summary.append("授权状态已确认")

    return supplement_actions, resolve_keys, summary


def apply_supplement_actions(actions, channel):
    """应用补录动作到 supplements.json"""
    supplements = load_supplements()

    for data_type, rec_idx, field, value in actions:
        internal_field = resolve_supplement_field(field)
        bucket = supplements.setdefault(data_type, {})

        if data_type == "stage":
            patches = bucket.setdefault(channel, {})
            patches[internal_field] = value
        else:
            if channel not in bucket:
                bucket[channel] = [{}]
            if not isinstance(bucket[channel], list):
                bucket[channel] = [bucket[channel]]
            while len(bucket[channel]) <= rec_idx:
                bucket[channel].append({})
            bucket[channel][rec_idx][internal_field] = value

    save_supplements(supplements)


def collect_all_issue_keys(channel, stage_records, check_records):
    """收集某通道所有问题的 key，用于标记全部解决"""
    keys = []
    stage = stage_records.get(channel, {})
    checks = check_records.get(channel, [])

    for check in checks:
        ver_ok, _ = check_master_version(stage, check)
        if not ver_ok:
            keys.append(issue_key("old_master", channel, check["file_name"]))
        tc_issues = check_timecode_alignment(stage, check)
        if tc_issues:
            if any("入点" in t for t in tc_issues):
                keys.append(issue_key("timecode", channel, f"in:{check['file_name']}"))
                keys.append(issue_key("conflict", channel, f"tc_in:{check['file_name']}"))
            if any("出点" in t for t in tc_issues):
                keys.append(issue_key("timecode", channel, f"out:{check['file_name']}"))
                keys.append(issue_key("conflict", channel, f"tc_out:{check['file_name']}"))
        stage_file = os.path.basename(stage.get("file_path", "")) if stage else ""
        if stage_file and check.get("file_name") and stage_file != check["file_name"]:
            if not check.get("manual_rename"):
                keys.append(issue_key("conflict", channel, f"file:{check['file_name']}"))

    auth_ok, _ = check_authorization(stage) if stage else (False, "")
    if not auth_ok:
        keys.append(issue_key("auth", channel, "expired"))
        keys.append(issue_key("auth", channel, "missing"))

    for check in checks:
        empty_fields = check_empty_values(stage or {}, check)
        for f in empty_fields:
            keys.append(issue_key("empty", channel, f))

    if not stage:
        keys.append(issue_key("empty", channel, "no_stage"))
    if not checks:
        keys.append(issue_key("empty", channel, "no_check"))

    return keys


def map_issue_types_to_keys(issue_types, channel, stage_records, check_records):
    """将问题类型名称映射到具体问题 key"""
    type_map = {
        "auth": ["auth:"],
        "master": ["old_master:"],
        "timecode": ["timecode:"],
        "file": ["conflict:.*file:"],
        "empty": ["empty:"],
        "conflict": ["conflict:"],
        "dup": ["duplicate:"],
    }
    all_keys = collect_all_issue_keys(channel, stage_records, check_records)
    matched = []
    for itype in issue_types:
        for pattern_prefix in type_map.get(itype.lower(), [f"{itype}:"]):
            for k in all_keys:
                if re.match(pattern_prefix.replace(".*", ".*"), k):
                    matched.append(k)
    return matched


class IssueManager:
    """统一管理问题的生成、key 分配和状态过滤"""

    def __init__(self, channel, resolved_keys, state_notes):
        self.channel = channel
        self.resolved_keys = set(resolved_keys or [])
        self.state_notes = state_notes or ""
        self.open_issues = []
        self.resolved_issues = []
        self.category_items = defaultdict(list)

    def add(self, category, issue_key, item_data, level, msg):
        if issue_key in self.resolved_keys:
            self.resolved_issues.append((level, msg, issue_key))
        else:
            self.open_issues.append((level, msg, issue_key))
            self.category_items[category].append(item_data)

    def add_category_only(self, category, item_data):
        self.category_items[category].append(item_data)

    def add_issue_only(self, level, msg, issue_key=None):
        key = issue_key or f"warn:{self.channel}:{hash(msg) & 0xffff}"
        if key in self.resolved_keys:
            self.resolved_issues.append((level, msg, key))
        else:
            self.open_issues.append((level, msg, key))

    def get_display_issues(self):
        return [(l, m) for l, m, _ in self.open_issues]

    def get_resolved_display(self):
        return [(l, m) for l, m, _ in self.resolved_issues]

    def status_summary(self):
        unique_open_keys = set()
        for _, _, k in self.open_issues:
            unique_open_keys.add(k)
        unique_resolved_from_state = self.resolved_keys
        actual_total = len(unique_open_keys | unique_resolved_from_state)
        actual_resolved = len(unique_resolved_from_state)
        actual_open = len(unique_open_keys)

        if actual_open == 0 and actual_resolved == 0:
            return "✅ 正常", ""
        if actual_open == 0:
            return "✅ 已处理", f"（{actual_resolved} 项问题已解决）"
        if actual_resolved > 0:
            return "⚠️ 处理中", f"（{actual_resolved}/{actual_total} 已解决）"
        return "⚠️ 待处理", ""


def normalize_row(raw_row, mapping, source_file, source_row_no, target_fields):
    normalized = {}
    for raw_col, std_col in mapping.items():
        if std_col in target_fields:
            normalized[std_col] = raw_row.get(raw_col, "").strip()
    for f in target_fields:
        if f not in normalized:
            normalized[f] = ""
    normalized["_source_file"] = os.path.basename(source_file)
    normalized["_source_row"] = source_row_no
    normalized["_raw"] = {k: v for k, v in raw_row.items() if k.strip()}
    return normalized


def do_import(filepath, data_type="stage", mapping_overrides=None):
    ensure_dir(IMPORT_DIR)

    headers, raw_rows = read_source_file(filepath)
    if not headers or not raw_rows:
        print(f"❌ 文件为空或无法读取: {filepath}")
        return None

    print(f"\n📁 读取文件: {os.path.basename(filepath)}")
    print(f"   行数: {len(raw_rows)}")
    print(f"   原始列名: {', '.join(headers)}")

    if data_type == "stage":
        target_fields = list(STAGE_FIELDS.keys())
    else:
        target_fields = list(CHECK_FIELDS.keys())

    saved_mappings = load_column_mappings()
    file_key = os.path.basename(filepath)

    if mapping_overrides:
        mapping = mapping_overrides
    elif file_key in saved_mappings:
        mapping = saved_mappings[file_key]
        print(f"   使用已保存的列名映射")
    else:
        mapping, missing, unmatched = resolve_column_mapping(headers, target_fields)
        if missing:
            print(f"\n⚠️  以下标准列未能自动匹配: {', '.join(missing)}")
        if unmatched:
            print(f"   以下文件列未匹配到标准列: {', '.join(unmatched)}")
        saved_mappings[file_key] = mapping
        save_column_mappings(saved_mappings)

    print(f"\n📋 列名映射结果:")
    print(f"   {'文件列名':<20} → {'标准列名':<15} {'状态'}")
    print(f"   {'-'*20}   {'-'*15} {'-'*8}")
    for raw_col in headers:
        if raw_col in mapping:
            status = "✅" if raw_col == mapping[raw_col] else "🔄 映射"
        else:
            status = "⚠️ 未映射"
        print(f"   {raw_col:<20} → {mapping.get(raw_col, '(无)'):<15} {status}")

    mapped_count = sum(1 for h in headers if h in mapping)
    print(f"\n   映射率: {mapped_count}/{len(headers)} ({mapped_count/len(headers)*100:.0f}%)")

    normalized_rows = []
    for i, raw_row in enumerate(raw_rows, 2):
        nr = normalize_row(raw_row, mapping, filepath, i, target_fields)
        normalized_rows.append(nr)

    return {
        "file": os.path.basename(filepath),
        "file_path": filepath,
        "data_type": data_type,
        "raw_count": len(raw_rows),
        "mapping": mapping,
        "normalized": normalized_rows,
        "headers": headers,
        "target_fields": target_fields,
    }


def confirm_import(import_result):
    if not import_result:
        return False

    rows = import_result["normalized"]
    data_type = import_result["data_type"]
    target_fields = import_result["target_fields"]

    print(f"\n{'='*60}")
    print(f"  导入确认 - {import_result['file']}")
    print(f"{'='*60}")
    print(f"  数据类型: {'舞台通道表' if data_type == 'stage' else '耳返通道检查'}")
    print(f"  导入行数: {import_result['raw_count']}")
    print(f"  映射字段: {len(import_result['mapping'])}/{len(import_result['headers'])}")
    print(f"  来源行保留: 每行记录含 _source_file 和 _source_row")
    print()

    channel_key = "通道编号"
    channels_found = set()
    empty_channels = 0
    field_stats = defaultdict(lambda: {"filled": 0, "empty": 0})

    for row in rows:
        ch = row.get(channel_key, "")
        if ch:
            channels_found.add(ch)
        else:
            empty_channels += 1
        for f in target_fields:
            if f.startswith("_"):
                continue
            if row.get(f, "").strip():
                field_stats[f]["filled"] += 1
            else:
                field_stats[f]["empty"] += 1

    print(f"  有效通道数: {len(channels_found)}")
    if empty_channels:
        print(f"  ⚠️ 通道编号为空的行: {empty_channels}")
    print()

    print(f"  字段填充率:")
    for f in target_fields:
        if f.startswith("_"):
            continue
        filled = field_stats[f]["filled"]
        total = filled + field_stats[f]["empty"]
        pct = filled / total * 100 if total else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"    {f:<12} {bar} {filled}/{total} ({pct:.0f}%)")

    print()
    print(f"  通道列表: {', '.join(sorted(channels_found))}")

    print(f"\n  前 5 行关键值核对:")
    print(f"  {'通道':<8} {'曲目名称':<16} {'文件/文件名':<30} {'来源行'}")
    print(f"  {'-'*8} {'-'*16} {'-'*30} {'-'*8}")
    for row in rows[:5]:
        ch = row.get(channel_key, "(空)")
        track = row.get("曲目名称", "(空)")
        file_val = row.get("文件路径", "") or row.get("文件名", "") or "(空)"
        src_row = row.get("_source_row", "?")
        print(f"  {ch:<8} {track:<16} {file_val:<30} 行{src_row}")

    print()
    return import_result


def _dedup_keys(row):
    """为一行数据生成一组去重 key，任意 key 命中即视为重复。
    优先使用 _source_file+_source_row 的精确来源 key，
    其次使用内容签名 key（作为导入前后跨阶段的兜底匹配）。"""
    keys = []
    src = row.get("_source_file", "") or row.get("source_file", "")
    srow = row.get("_source_row", "") or row.get("source_row", "")
    if src and srow:
        keys.append(f"src:{src}:{srow}")
    sig_parts = []
    for k in ["通道编号", "文件名", "曲目名称", "文件时长", "时码入点", "时码出点"]:
        sig_parts.append(str(row.get(k, "")))
    content_sig = "|".join(sig_parts)
    if content_sig and content_sig != "|||||":
        keys.append(f"sig:{content_sig}")
    return keys


def write_import_to_csv(import_result, output_path):
    rows = import_result["normalized"]
    if not rows:
        return
    data_type = import_result["data_type"]
    target_fields = import_result["target_fields"]

    existing_rows = []
    seen_keys = set()
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ch = row.get("通道编号", "").strip()
                if not ch:
                    continue
                row_keys = _dedup_keys(row)
                if any(k in seen_keys for k in row_keys):
                    continue
                for k in row_keys:
                    seen_keys.add(k)
                existing_rows.append(row)

    for row in rows:
        ch = row.get("通道编号", "").strip()
        if not ch:
            continue
        row_keys = _dedup_keys(row)
        if any(k in seen_keys for k in row_keys):
            continue
        for k in row_keys:
            seen_keys.add(k)
        existing_rows.append(row)

    if data_type == "stage":
        merged = {}
        for row in existing_rows:
            ch = row["通道编号"].strip()
            merged[ch] = {f: row.get(f, "") for f in target_fields}
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=target_fields, extrasaction="ignore")
            writer.writeheader()
            for ch in sorted(merged.keys()):
                writer.writerow(merged[ch])
    else:
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=target_fields, extrasaction="ignore")
            writer.writeheader()
            for r in existing_rows:
                writer.writerow({f: r.get(f, "") for f in target_fields})


def data_type_merge_key(data_type):
    return "stage" if data_type == "stage" else "check"


def apply_supplements(stage_records, check_records):
    supplements = load_supplements()
    stage_supp = supplements.get("stage", {})
    check_supp = supplements.get("check", {})

    for channel, patches in stage_supp.items():
        if channel in stage_records:
            for internal_field, value in patches.items():
                if internal_field in stage_records[channel]:
                    stage_records[channel][internal_field] = value
                    stage_records[channel]["_supplemented"] = True
                    std_name = INTERNAL_TO_STAGE_FIELD.get(internal_field, internal_field)
                    stage_records[channel].setdefault("_supplement_log", []).append(
                        f"{std_name}: → {value}"
                    )
                    if internal_field == "track_name":
                        stage_records[channel]["_supplement_log"][-1] = f"曲目名称: → {value}"
                    elif internal_field == "contract_no":
                        stage_records[channel]["_supplement_log"][-1] = f"合同编号: → {value}"
                    if internal_field == "contract_remark":
                        auth_start, auth_end, auth_note = parse_authorization(value)
                        stage_records[channel]["auth_start"] = auth_start
                        stage_records[channel]["auth_end"] = auth_end
                        stage_records[channel]["auth_note"] = auth_note

    for channel, patches_list in check_supp.items():
        if channel in check_records:
            for patches in (patches_list if isinstance(patches_list, list) else [patches_list]):
                for rec in check_records[channel]:
                    rec_updated = False
                    for internal_field, value in patches.items():
                        if internal_field in rec:
                            if rec.get(internal_field) == value:
                                continue
                            rec[internal_field] = value
                            rec["_supplemented"] = True
                            std_name = INTERNAL_TO_CHECK_FIELD.get(internal_field, internal_field)
                            if "_supplement_log" not in rec:
                                rec["_supplement_log"] = []
                            log_entry = f"{std_name}: → {value}"
                            if log_entry not in rec["_supplement_log"]:
                                rec["_supplement_log"].append(log_entry)
                            rec_updated = True
                    if rec_updated:
                        if "tc_in" in patches and rec.get("tc_in"):
                            rec["tc_in_sec"] = parse_timecode(rec["tc_in"])
                        if "tc_out" in patches and rec.get("tc_out"):
                            rec["tc_out_sec"] = parse_timecode(rec["tc_out"])

    return stage_records, check_records


def read_stage_table(path=None):
    filepath = path or STAGE_TABLE
    records = {}
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            channel = row.get("通道编号", "").strip()
            if not channel:
                continue
            auth_start, auth_end, auth_note = parse_authorization(row.get("合同备注", ""))
            records[channel] = {
                "channel": channel,
                "track_name": row.get("曲目名称", "").strip(),
                "file_path": row.get("文件路径", "").strip(),
                "master_version": row.get("母带版本", "").strip(),
                "artist": row.get("艺人", "").strip(),
                "tc_in": row.get("时码入点", "").strip(),
                "tc_out": row.get("时码出点", "").strip(),
                "tc_in_sec": parse_timecode(row.get("时码入点", "")),
                "tc_out_sec": parse_timecode(row.get("时码出点", "")),
                "stage_area": row.get("舞台区域", "").strip(),
                "contract_no": row.get("合同编号", "").strip(),
                "contract_remark": row.get("合同备注", "").strip(),
                "auth_start": auth_start,
                "auth_end": auth_end,
                "auth_note": auth_note,
                "owner": row.get("负责人", "").strip(),
                "reg_date": row.get("登记日期", "").strip(),
                "_source_file": row.get("_source_file", ""),
                "_source_row": row.get("_source_row", ""),
                "_supplemented": row.get("_supplemented", "") == "True" if isinstance(row.get("_supplemented"), str) else False,
                "_supplement_log": json.loads(row.get("_supplement_log", "[]")) if row.get("_supplement_log") and row.get("_supplement_log").startswith("[") else [],
            }
    return records


def read_check_data(path=None):
    filepath = path or CHECK_DATA
    records = defaultdict(list)
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            channel = row.get("通道编号", "").strip()
            if not channel:
                continue
            records[channel].append({
                "batch_no": row.get("批次号", "").strip(),
                "check_date": row.get("检查日期", "").strip(),
                "checker": row.get("检查人", "").strip(),
                "channel": channel,
                "track_name": row.get("曲目名称", "").strip(),
                "file_name": row.get("文件名", "").strip(),
                "duration": row.get("文件时长", "").strip(),
                "duration_sec": parse_timecode(row.get("文件时长", "")),
                "tc_in": row.get("时码入点", "").strip(),
                "tc_out": row.get("时码出点", "").strip(),
                "tc_in_sec": parse_timecode(row.get("时码入点", "")),
                "tc_out_sec": parse_timecode(row.get("时码出点", "")),
                "version_tag": row.get("版本标记", "").strip(),
                "annotation": row.get("批注", "").strip(),
                "import_source": row.get("导入来源", "").strip(),
                "manual_rename": row.get("人工改名标记", "").strip() == "是",
                "_source_file": row.get("_source_file", ""),
                "_source_row": row.get("_source_row", ""),
                "_supplemented": row.get("_supplemented", "") == "True" if isinstance(row.get("_supplemented"), str) else False,
                "_supplement_log": json.loads(row.get("_supplement_log", "[]")) if row.get("_supplement_log") and row.get("_supplement_log").startswith("[") else [],
            })
    return records


def check_authorization(stage_rec):
    if stage_rec.get("auth_note"):
        return False, stage_rec["auth_note"]
    if stage_rec.get("auth_end") and TODAY > stage_rec["auth_end"]:
        return False, f"授权已过期（至 {stage_rec['auth_end'].isoformat()}）"
    if stage_rec.get("auth_start") and TODAY < stage_rec["auth_start"]:
        return False, f"授权未生效（自 {stage_rec['auth_start'].isoformat()}）"
    return True, "授权有效"


def check_timecode_alignment(stage_rec, check_rec):
    issues = []
    if stage_rec.get("tc_in_sec") is not None and check_rec.get("tc_in_sec") is not None:
        diff = abs(stage_rec["tc_in_sec"] - check_rec["tc_in_sec"])
        if diff > 0:
            issues.append(f"入点错位 {diff} 秒（舞台表:{stage_rec['tc_in']} / 检查表:{check_rec['tc_in']}）")
    if stage_rec.get("tc_out_sec") is not None and check_rec.get("tc_out_sec") is not None:
        diff = abs(stage_rec["tc_out_sec"] - check_rec["tc_out_sec"])
        if diff > 0:
            issues.append(f"出点错位 {diff} 秒（舞台表:{stage_rec['tc_out']} / 检查表:{check_rec['tc_out']}）")
    return issues


def check_master_version(stage_rec, check_rec):
    if not check_rec.get("version_tag"):
        return False, "检查表缺失版本标记"
    if check_rec["version_tag"] != "2025_master":
        return False, f"旧版母带（检查表标记:{check_rec['version_tag']}）"
    if stage_rec.get("master_version") and stage_rec["master_version"] != check_rec["version_tag"]:
        return False, f"版本不一致（舞台表:{stage_rec['master_version']} / 检查表:{check_rec['version_tag']}）"
    return True, "母带版本正常"


def check_empty_values(stage_rec, check_rec):
    empty_fields = []
    if not stage_rec.get("track_name"):
        empty_fields.append("舞台表-曲目名称")
    if not stage_rec.get("contract_no"):
        empty_fields.append("舞台表-合同编号")
    if not check_rec.get("track_name"):
        empty_fields.append("检查表-曲目名称")
    return empty_fields


def find_duplicate_tracks(stage_records, check_records):
    track_channels = defaultdict(list)
    for channel, rec in stage_records.items():
        if rec.get("track_name"):
            track_channels[rec["track_name"]].append(channel)
    duplicates = {}
    for track, channels in track_channels.items():
        if len(channels) > 1:
            duplicates[track] = channels
    return duplicates


def detect_conflicts(stage_rec, check_rec_list):
    conflicts = []
    for check_rec in check_rec_list:
        file_name = check_rec.get("file_name", "")
        if stage_rec.get("track_name") and check_rec.get("track_name") and stage_rec["track_name"] != check_rec["track_name"]:
            conflicts.append({
                "field": "曲目名称",
                "file_name": file_name,
                "stage_value": stage_rec["track_name"],
                "check_value": check_rec["track_name"],
                "evidence": f"舞台表登记为「{stage_rec['track_name']}」，检查表登记为「{check_rec['track_name']}」",
                "suggestion": "请核对曲目实际名称，以文件元数据或纸质合同为准",
            })
        stage_file = os.path.basename(stage_rec.get("file_path", "")) if stage_rec.get("file_path") else ""
        if stage_file and check_rec.get("file_name") and stage_file != check_rec["file_name"]:
            if not check_rec.get("manual_rename"):
                conflicts.append({
                    "field": "文件名",
                    "file_name": file_name,
                    "stage_value": stage_file,
                    "check_value": check_rec["file_name"],
                    "evidence": f"舞台表文件「{stage_file}」，检查表文件「{check_rec['file_name']}」",
                    "suggestion": "请确认是否为同一文件，检查表有「人工改名」标记请忽略",
                })
        tc_issues = check_timecode_alignment(stage_rec, check_rec)
        for issue in tc_issues:
            conflicts.append({
                "field": "时码",
                "file_name": file_name,
                "stage_value": f"{stage_rec.get('tc_in', '')} - {stage_rec.get('tc_out', '')}",
                "check_value": f"{check_rec.get('tc_in', '')} - {check_rec.get('tc_out', '')}",
                "evidence": issue,
                "suggestion": "请核时码序列，避免跳点或重叠",
            })
    return conflicts


def analyze_data(stage_path=None, check_path=None):
    stage_records = read_stage_table(stage_path)
    check_records = read_check_data(check_path)
    state = load_state()

    stage_records, check_records = apply_supplements(stage_records, check_records)

    all_channels = sorted(set(list(stage_records.keys()) + list(check_records.keys())))
    duplicate_tracks = find_duplicate_tracks(stage_records, check_records)

    results = {
        "summary": {
            "total_channels": len(all_channels),
            "checked_date": TODAY.isoformat(),
        },
        "issues_by_category": defaultdict(list),
        "channel_details": {},
        "duplicate_tracks": duplicate_tracks,
    }

    for channel in all_channels:
        stage_rec = stage_records.get(channel, {})
        check_rec_list = check_records.get(channel, [])

        resolved_keys = state.get("resolved_issues", {}).get(channel, [])
        state_notes = state.get("notes", {}).get(channel, "")
        im = IssueManager(channel, resolved_keys, state_notes)

        if not stage_rec:
            im.add_issue_only("警告", f"通道 {channel} 无舞台表记录", issue_key("empty", channel, "no_stage"))
        if not check_rec_list:
            im.add_issue_only("警告", f"通道 {channel} 无检查记录", issue_key("empty", channel, "no_check"))

        auth_ok, auth_msg = check_authorization(stage_rec) if stage_rec else (False, "无舞台表记录")
        if not auth_ok:
            auth_item = {
                "channel": channel,
                "track": stage_rec.get("track_name", "未知"),
                "reason": auth_msg,
                "contract": stage_rec.get("contract_no", ""),
            }
            if "过期" in auth_msg:
                im.add("expired_auth", issue_key("auth", channel, "expired"), auth_item, "授权", auth_msg)
            elif "待确认" in auth_msg or "未找到" in auth_msg:
                im.add("missing_auth", issue_key("auth", channel, "missing"), auth_item, "授权", auth_msg)
            else:
                im.add("expired_auth", issue_key("auth", channel, "expired"), auth_item, "授权", auth_msg)

        for check_rec in check_rec_list:
            file_name = check_rec.get("file_name", "")
            ver_ok, ver_msg = check_master_version(stage_rec, check_rec) if stage_rec else (False, "无舞台表记录")
            if not ver_ok:
                master_item = {
                    "channel": channel,
                    "track": check_rec.get("track_name", ""),
                    "file": file_name,
                    "reason": ver_msg,
                    "annotation": check_rec.get("annotation", ""),
                }
                im.add("old_master", issue_key("old_master", channel, file_name), master_item, "母带", ver_msg)

            empty_fields = check_empty_values(stage_rec or {}, check_rec)
            for field in empty_fields:
                empty_item = {
                    "channel": channel,
                    "field": field,
                    "track": check_rec.get("track_name", ""),
                    "reason": f"{field} 为空",
                }
                im.add("empty_values", issue_key("empty", channel, field), empty_item, "空值", f"{field} 为空")

            if check_rec.get("manual_rename"):
                rename_item = {
                    "channel": channel,
                    "track": check_rec.get("track_name", ""),
                    "stage_file": os.path.basename(stage_rec.get("file_path", "")) if stage_rec else "",
                    "check_file": file_name,
                    "annotation": check_rec.get("annotation", ""),
                }
                im.add_category_only("manual_rename", rename_item)
                im.add_issue_only("改名", f"人工改名: {file_name}")

        if stage_rec and check_rec_list:
            conflicts = detect_conflicts(stage_rec, check_rec_list)
            for conflict in conflicts:
                conflict_field = conflict["field"]
                file_name = conflict.get("file_name", "")
                conflict_item = {
                    "channel": channel,
                    "track": stage_rec.get("track_name", "未知"),
                    **conflict,
                }
                if conflict_field == "时码":
                    tc_detail = "tc_in" if "入点" in conflict["evidence"] else "tc_out"
                    conflict_key = issue_key("conflict", channel, f"{tc_detail}:{file_name}")
                    im.add("conflicts", conflict_key, conflict_item, "冲突", conflict["evidence"])
                elif conflict_field == "文件名":
                    im.add("conflicts", issue_key("conflict", channel, f"file:{file_name}"), conflict_item, "冲突", conflict["evidence"])
                else:
                    im.add("conflicts", issue_key("conflict", channel, f"field:{conflict_field}"), conflict_item, "冲突", conflict["evidence"])

            for check_rec in check_rec_list:
                file_name = check_rec.get("file_name", "")
                tc_issues = check_timecode_alignment(stage_rec, check_rec)
                for issue in tc_issues:
                    tc_item = {
                        "channel": channel,
                        "track": stage_rec.get("track_name", "未知"),
                        "file": file_name,
                        "reason": issue,
                        "stage_tc": f"{stage_rec.get('tc_in', '')} - {stage_rec.get('tc_out', '')}",
                        "check_tc": f"{check_rec.get('tc_in', '')} - {check_rec.get('tc_out', '')}",
                    }
                    tc_detail = f"in:{file_name}" if "入点" in issue else f"out:{file_name}"
                    im.add("timecode_misalignment", issue_key("timecode", channel, tc_detail), tc_item, "时码", issue)

        for track, channels in duplicate_tracks.items():
            if channel in channels:
                other_channels = [c for c in channels if c != channel]
                dup_item = {
                    "channel": channel,
                    "track": track,
                    "duplicate_with": ", ".join(other_channels),
                    "reason": f"曲目「{track}」在多个通道出现: {', '.join(channels)}",
                }
                im.add("duplicate_tracks", issue_key("duplicate", channel, track), dup_item, "重复", dup_item["reason"])

        source_info = ""
        if stage_rec.get("_source_file"):
            source_info = f" (导入自: {stage_rec['_source_file']} 行{stage_rec.get('_source_row', '?')})"

        supplement_log = stage_rec.get("_supplement_log", []) if stage_rec else []
        check_supplement_logs = []
        for cr in check_rec_list:
            check_supplement_logs.extend(cr.get("_supplement_log", []))
        if check_supplement_logs:
            supplement_log = supplement_log + check_supplement_logs

        status_label, status_text = im.status_summary()

        for cat, items in im.category_items.items():
            results["issues_by_category"][cat].extend(items)

        results["channel_details"][channel] = {
            "stage": stage_rec,
            "checks": check_rec_list,
            "issues": im.get_display_issues(),
            "resolved_issues": im.get_resolved_display(),
            "open_count": len(im.open_issues),
            "resolved_count": len(im.resolved_issues),
            "status_label": status_label,
            "status_text": status_text,
            "annotation": " | ".join([c.get("annotation", "") for c in check_rec_list if c.get("annotation")]),
            "processed": channel in state["processed_channels"],
            "user_notes": state.get("notes", {}).get(channel, ""),
            "source_info": source_info,
            "supplement_log": supplement_log,
        }

    results["summary"]["expired_auth_count"] = len(results["issues_by_category"].get("expired_auth", []))
    results["summary"]["timecode_misalignment_count"] = len(results["issues_by_category"].get("timecode_misalignment", []))
    results["summary"]["duplicate_tracks_count"] = len(set([i["track"] for i in results["issues_by_category"].get("duplicate_tracks", [])]))
    results["summary"]["old_master_count"] = len(results["issues_by_category"].get("old_master", []))
    results["summary"]["missing_auth_count"] = len(results["issues_by_category"].get("missing_auth", []))
    results["summary"]["empty_values_count"] = len(results["issues_by_category"].get("empty_values", []))
    results["summary"]["manual_rename_count"] = len(results["issues_by_category"].get("manual_rename", []))
    results["summary"]["conflicts_count"] = len(results["issues_by_category"].get("conflicts", []))

    return results, state


def generate_report(results, state):
    lines = []
    lines.append("# 耳返通道换场检查 - 交接清单")
    lines.append("")
    lines.append(f"> 检查日期：{TODAY.isoformat()}")
    lines.append(f"> 交接对象：厂牌运营 小孟")
    lines.append(f"> 总通道数：{results['summary']['total_channels']}")
    lines.append("")

    import_log = []
    for ch, detail in results["channel_details"].items():
        if detail.get("source_info"):
            import_log.append(f"- {ch}: {detail['source_info']}")
    if import_log:
        lines.append("## 📥 导入来源追溯")
        lines.append("")
        for line in import_log:
            lines.append(line)
        lines.append("")

    supplement_log = []
    for ch, detail in results["channel_details"].items():
        if detail.get("supplement_log"):
            supplement_log.append(f"- {ch}: {'; '.join(detail['supplement_log'])}")
    if supplement_log:
        lines.append("## ✏️ 补录记录")
        lines.append("")
        for line in supplement_log:
            lines.append(line)
        lines.append("")

    lines.append("## 📋 概览")
    lines.append("")
    lines.append("| 类别 | 数量 | 说明 |")
    lines.append("|------|------|------|")
    lines.append(f"| 🔴 授权过期 | {results['summary']['expired_auth_count']} | 需紧急处理 |")
    lines.append(f"| 🟡 时码错位 | {results['summary']['timecode_misalignment_count']} | 需核对 |")
    lines.append(f"| 🟡 重复曲目 | {results['summary']['duplicate_tracks_count']} | 需确认是否故意安排 |")
    lines.append(f"| 🟠 旧版母带 | {results['summary']['old_master_count']} | 建议升级 |")
    lines.append(f"| 🔴 缺授权 | {results['summary']['missing_auth_count']} | 需补合同 |")
    lines.append(f"| ⚪ 空值项 | {results['summary']['empty_values_count']} | 需补录 |")
    lines.append(f"| 🟣 人工改名 | {results['summary']['manual_rename_count']} | 已标记 |")
    lines.append(f"| 🟤 数据冲突 | {results['summary']['conflicts_count']} | 需人工判定 |")
    lines.append("")

    categories = [
        ("expired_auth", "🔴 授权过期（需立即处理）", [
            "通道", "曲目", "合同编号", "异常原因", "建议动作"
        ], lambda x: [
            x["channel"], x["track"], x["contract"], x["reason"],
            "联系厂牌续签授权，或更换曲目"
        ]),
        ("missing_auth", "🔴 缺授权（需补合同）", [
            "通道", "曲目", "合同编号", "异常原因", "建议动作"
        ], lambda x: [
            x["channel"], x["track"], x["contract"] or "(空)", x["reason"],
            "请确认合同状态，补充授权信息"
        ]),
        ("timecode_misalignment", "🟡 时码错位（需核对）", [
            "通道", "曲目", "文件", "舞台表时码", "检查表时码", "异常原因", "建议动作"
        ], lambda x: [
            x["channel"], x["track"], x.get("file", ""), x["stage_tc"], x["check_tc"], x["reason"],
            "请核时轨，确认正确时间点"
        ]),
        ("duplicate_tracks", "🟡 重复曲目（需确认）", [
            "通道", "曲目", "重复通道", "异常原因", "建议动作"
        ], lambda x: [
            x["channel"], x["track"], x["duplicate_with"], x["reason"],
            "如非刻意安排，请移除重复项"
        ]),
        ("old_master", "🟠 旧版母带（建议升级）", [
            "通道", "曲目", "文件", "异常原因", "批注", "建议动作"
        ], lambda x: [
            x["channel"], x["track"], x["file"], x["reason"], x["annotation"],
            "请确认是否有 2025 版母带，建议使用最新版本"
        ]),
        ("empty_values", "⚪ 空值项（需补录）", [
            "通道", "字段", "曲目", "异常原因", "建议动作"
        ], lambda x: [
            x["channel"], x["field"], x["track"], x["reason"],
            "请补充完整信息"
        ]),
        ("manual_rename", "🟣 人工改名（已标记）", [
            "通道", "曲目", "舞台表文件名", "检查表文件名", "批注", "建议动作"
        ], lambda x: [
            x["channel"], x["track"], x["stage_file"], x["check_file"], x["annotation"],
            "已标记为人工改名，如无问题可忽略"
        ]),
    ]

    for key, title, headers, row_fn in categories:
        items = results["issues_by_category"].get(key, [])
        if not items:
            continue
        lines.append(f"## {title}")
        lines.append("")
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(headers)) + " |")
        for item in items:
            lines.append("| " + " | ".join(row_fn(item)) + " |")
        lines.append("")

    lines.append("## 🟤 数据冲突（需人工判定）")
    lines.append("")
    lines.append("> 舞台通道表与检查表数据不一致，请核对原始材料后判定。")
    lines.append("")
    conflicts = results["issues_by_category"].get("conflicts", [])
    if conflicts:
        lines.append("| 通道 | 曲目 | 冲突字段 | 舞台表说法 | 检查表说法 | 证据 | 建议动作 |")
        lines.append("|------|------|----------|------------|------------|------|----------|")
        for c in conflicts:
            lines.append(f"| {c['channel']} | {c['track']} | {c['field']} | {c['stage_value']} | {c['check_value']} | {c['evidence']} | {c['suggestion']} |")
    else:
        lines.append("> ✅ 无数据冲突")
    lines.append("")

    lines.append("## 📚 按通道明细")
    lines.append("")
    for channel in sorted(results["channel_details"].keys()):
        detail = results["channel_details"][channel]
        stage = detail["stage"]
        checks = detail["checks"]
        status_label = detail.get("status_label", "⚠️ 待处理")
        status_text = detail.get("status_text", "")
        lines.append(f"### 通道 {channel} - {stage.get('track_name', '未知曲目') if stage else '未知曲目'} {status_label}{status_text}")
        lines.append("")

        if detail.get("source_info"):
            lines.append(f"**导入来源：** {detail['source_info']}")
            lines.append("")

        if detail.get("supplement_log"):
            lines.append(f"**补录记录：** {'; '.join(detail['supplement_log'])}")
            lines.append("")

        if stage:
            lines.append("**舞台通道表信息：**")
            lines.append(f"- 曲目：{stage.get('track_name', '') or '(空)'}")
            lines.append(f"- 文件：{stage.get('file_path', '') or '(空)'}")
            lines.append(f"- 母带版本：{stage.get('master_version', '') or '(空)'}")
            lines.append(f"- 艺人：{stage.get('artist', '') or '(空)'}")
            lines.append(f"- 时码：{stage.get('tc_in', '')} - {stage.get('tc_out', '')}")
            lines.append(f"- 舞台区域：{stage.get('stage_area', '') or '(空)'}")
            lines.append(f"- 合同：{stage.get('contract_no', '') or '(空)'}")
            auth_info = f"{stage['auth_start'].isoformat()} 至 {stage['auth_end'].isoformat()}" if stage.get('auth_start') and stage.get('auth_end') else stage.get('auth_note', '') or '无'
            lines.append(f"- 授权期限：{auth_info}")
            lines.append(f"- 合同备注：{stage.get('contract_remark', '') or '(空)'}")
            lines.append(f"- 负责人：{stage.get('owner', '') or '(空)'}")
            lines.append("")

        if checks:
            lines.append("**耳返通道检查记录：**")
            for i, check in enumerate(checks, 1):
                lines.append(f"- 记录 {i}：")
                lines.append(f"  - 文件名：{check.get('file_name', '')}")
                lines.append(f"  - 曲目：{check.get('track_name', '')}")
                lines.append(f"  - 版本标记：{check.get('version_tag', '')}")
                if check.get("_supplemented"):
                    lines.append(f"  - 时码：{check.get('tc_in', '')} - {check.get('tc_out', '')}（已同步）")
                else:
                    lines.append(f"  - 时码：{check.get('tc_in', '')} - {check.get('tc_out', '')}")
                lines.append(f"  - 文件时长：{check.get('duration', '')}")
                lines.append(f"  - 批注：{check.get('annotation', '') or '(无)'}")
                lines.append(f"  - 导入来源：{check.get('import_source', '')}")
                if check.get('manual_rename'):
                    lines.append(f"  - ⚠️ 人工改名标记：是")
                if check.get("_source_file"):
                    lines.append(f"  - 来源文件：{check['_source_file']} 行{check.get('_source_row', '')}")
            lines.append("")

        if detail["issues"]:
            lines.append("**待处理问题：**")
            for level, msg in detail["issues"]:
                lines.append(f"- [{level}] {msg}")
            lines.append("")

        if detail.get("resolved_issues"):
            lines.append("**已解决问题：**")
            for level, msg in detail["resolved_issues"]:
                lines.append(f"- ~~[{level}] {msg}~~ ✅")
            lines.append("")

        if detail["annotation"]:
            lines.append(f"**批注摘要：** {detail['annotation']}")
            lines.append("")

        if detail["user_notes"]:
            lines.append(f"**处理备注：** {detail['user_notes']}")
            lines.append("")

        lines.append("---")
        lines.append("")

    lines.append("## 💡 操作说明")
    lines.append("")
    lines.append("1. 本清单关联了**舞台通道表**与**耳返通道检查数据**，每一项都可追溯到原始文件")
    lines.append("2. 授权期限从「合同备注」字段自动解析，如解析有误请核对原始合同")
    lines.append("3. 数据冲突项**不做自动判定**，请核对原始材料后处理")
    lines.append("4. 支持增量处理：补充材料后重新运行脚本，已处理项会保留状态")
    lines.append("5. 可在 `.check_state.json` 中标记已处理通道和添加备注")
    lines.append("6. 多源导入时，列名映射自动保存，后续相同格式文件自动复用")
    lines.append("7. 补录数据通过 `--supplement` 命令写入，会记录补录来源")
    lines.append("")
    lines.append("---")
    lines.append(f"*本清单由脚本自动生成，最后更新：{TODAY.isoformat()}*")

    report = "\n".join(lines)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    return report


def mark_processed(channel, note="", resolve_all=False, issues_to_resolve=None):
    """
    标记通道为已处理，并根据备注智能应用变更
    resolve_all=True 时标记所有问题为已解决
    issues_to_resolve 可以指定具体问题类型列表：["auth", "master", "timecode", "file", "empty"]
    """
    stage_records = read_stage_table()
    check_records = read_check_data()
    stage_records, check_records = apply_supplements(stage_records, check_records)

    state = load_state()

    if channel not in state["processed_channels"]:
        state["processed_channels"].append(channel)

    if note:
        state["notes"][channel] = note

    all_resolve_keys = []
    if note:
        supplement_actions, resolve_keys, summary = parse_note_for_actions(
            note, channel, stage_records, check_records
        )
        if supplement_actions:
            apply_supplement_actions(supplement_actions, channel)
            print("  自动应用变更:")
            for s in summary:
                print(f"    - {s}")
        all_resolve_keys.extend(resolve_keys)

    if resolve_all:
        all_issues = collect_all_issue_keys(channel, stage_records, check_records)
        all_resolve_keys.extend(all_issues)
        print(f"  标记所有问题为已解决 ({len(all_issues)} 项)")

    if issues_to_resolve:
        mapped_keys = map_issue_types_to_keys(
            issues_to_resolve, channel, stage_records, check_records
        )
        all_resolve_keys.extend(mapped_keys)
        print(f"  标记指定问题为已解决: {', '.join(issues_to_resolve)}")

    if channel not in state["resolved_issues"]:
        state["resolved_issues"][channel] = []

    for k in all_resolve_keys:
        if k not in state["resolved_issues"][channel]:
            state["resolved_issues"][channel].append(k)

    save_state(state)

    print(f"\n✅ 通道 {channel} 处理状态已更新")
    if note:
        print(f"   处理备注：{note}")
    if state["resolved_issues"][channel]:
        print(f"   已解决问题：{len(state['resolved_issues'][channel])} 项")


def add_supplement(channel, field, value, data_type="stage"):
    internal_field = resolve_supplement_field(field)
    supplements = load_supplements()
    bucket = supplements.setdefault(data_type, {})
    if data_type == "stage":
        patches = bucket.setdefault(channel, {})
        patches[internal_field] = value
    else:
        if channel not in bucket:
            bucket[channel] = [{}]
        if isinstance(bucket[channel], list) and bucket[channel]:
            bucket[channel][-1][internal_field] = value
        else:
            bucket[channel] = [{internal_field: value}]
    save_supplements(supplements)
    std_name = field
    print(f"✅ 补录已保存: {data_type}/{channel}/{std_name} = {value}")
    print(f"   下次运行校验时自动应用补录")


def print_console_summary(results):
    print("")
    print("=" * 60)
    print("  耳返通道换场检查 - 校验结果摘要")
    print("=" * 60)
    print("")
    print(f"总通道数: {results['summary']['total_channels']}")
    print("")
    print("问题分类统计:")
    for key, items in results["issues_by_category"].items():
        label = {
            "expired_auth": "🔴 授权过期",
            "timecode_misalignment": "🟡 时码错位",
            "duplicate_tracks": "🟡 重复曲目",
            "old_master": "🟠 旧版母带",
            "missing_auth": "🔴 缺授权",
            "empty_values": "⚪ 空值项",
            "manual_rename": "🟣 人工改名",
            "conflicts": "🟤 数据冲突",
        }.get(key, key)
        print(f"  {label}: {len(items)} 项")
    print("")
    print(f"详细报告已生成: {REPORT_FILE}")
    print("")
    print("常用命令:")
    print("  导入台账:   python ear_return_check.py --import data/厂牌运营台账.csv --type stage")
    print("  补录数据:   python ear_return_check.py --supplement CH-007 曲目名称 补录曲目 --type stage")
    print("  标记已处理: python ear_return_check.py --mark CH-002 --note \"授权已确认，母带为最新版\"")
    print("  解决指定问题: python ear_return_check.py --mark CH-002 --resolve auth,master --note \"已处理\"")
    print("  重新校验:   python ear_return_check.py")
    print("")


def cmd_import(args):
    filepath = args.import_file
    if not os.path.isabs(filepath):
        filepath = os.path.join(BASE_DIR, filepath)
    if not os.path.exists(filepath):
        print(f"❌ 文件不存在: {filepath}")
        sys.exit(1)

    data_type = args.type or "stage"
    result = do_import(filepath, data_type)
    if not result:
        sys.exit(1)

    confirmed = confirm_import(result)

    if data_type == "stage":
        output_path = STAGE_TABLE
    else:
        output_path = CHECK_DATA

    if os.path.exists(output_path):
        backup_path = output_path.replace(".csv", f"_backup_{TODAY.isoformat()}.csv")
        import shutil
        shutil.copy2(output_path, backup_path)
        print(f"📦 已备份原文件到: {os.path.basename(backup_path)}")

    write_import_to_csv(confirmed, output_path)
    print(f"\n✅ 导入完成，已写入: {os.path.basename(output_path)}")
    print(f"   导入行数: {confirmed['raw_count']}")
    print(f"   可继续运行校验: python ear_return_check.py")


def cmd_supplement(args):
    add_supplement(args.channel, args.field, args.value, args.type or "stage")


def cmd_mark(args):
    resolve_all = getattr(args, "resolve_all", False)
    resolve = getattr(args, "resolve", None)
    issues_list = resolve.split(",") if resolve else None
    mark_processed(args.mark, args.note, resolve_all=resolve_all, issues_to_resolve=issues_list)


def cmd_check(args):
    results, state = analyze_data()
    generate_report(results, state)
    print_console_summary(results)


def cmd_show_mapping(args):
    mappings = load_column_mappings()
    if not mappings:
        print("暂无已保存的列名映射")
        return
    print("\n已保存的列名映射:")
    print("=" * 50)
    for file_key, mapping in mappings.items():
        print(f"\n📁 {file_key}")
        for raw_col, std_col in mapping.items():
            status = "✅" if raw_col == std_col else "🔄"
            print(f"   {raw_col} → {std_col} {status}")


def main():
    parser = argparse.ArgumentParser(description="耳返通道换场检查", formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 导入厂牌台账（自动列名映射）
  python ear_return_check.py --import data/厂牌运营台账.csv --type stage

  # 导入耳返检查数据
  python ear_return_check.py --import data/检查记录.csv --type check

  # 补录缺失字段
  python ear_return_check.py --supplement CH-007 曲目名称 "补录的曲目名" --type stage

  # 标记已处理（根据备注自动应用变更）
  python ear_return_check.py --mark CH-002 --note "授权已确认，母带为最新版"

  # 标记已处理并解决指定类型的问题
  python ear_return_check.py --mark CH-002 --resolve auth,master,timecode --note "问题已解决"

  # 标记已处理并解决所有问题
  python ear_return_check.py --mark CH-002 --resolve-all --note "全部问题已确认"

  # 运行校验并生成报告
  python ear_return_check.py

  # 查看已保存的列名映射
  python ear_return_check.py --show-mapping

备注关键词自动处理:
  - "母带为最新版" / "2025_master" → 自动将旧版母带升级为 2025_master
  - "时码已对齐" / "时码同步" → 自动同步检查表时码为舞台表时码
  - "文件已确认" / "文件名一致" → 标记文件名冲突为已解决
  - "授权已续签" → 自动将授权期限续签到备注中的年份（默认2027）
  - "授权已确认" → 标记授权状态问题为已解决
""")
    parser.add_argument("--import", dest="import_file", help="导入 CSV/Excel 文件路径")
    parser.add_argument("--type", dest="type", choices=["stage", "check"], help="数据类型: stage(舞台通道表) 或 check(耳返检查)")
    parser.add_argument("--supplement", nargs=3, metavar=("CHANNEL", "FIELD", "VALUE"), help="补录字段值")
    parser.add_argument("--mark", help="标记通道为已处理")
    parser.add_argument("--note", help="处理备注", default="")
    parser.add_argument("--resolve-all", action="store_true", help="标记所有问题为已解决")
    parser.add_argument("--resolve", help="指定解决的问题类型，逗号分隔: auth,master,timecode,file,empty,conflict,dup")
    parser.add_argument("--show-mapping", action="store_true", help="查看已保存的列名映射")

    args = parser.parse_args()

    if args.import_file:
        cmd_import(args)
    elif args.supplement:
        args.channel, args.field, args.value = args.supplement
        cmd_supplement(args)
    elif args.mark:
        cmd_mark(args)
    elif args.show_mapping:
        cmd_show_mapping(args)
    else:
        cmd_check(args)


if __name__ == "__main__":
    main()
