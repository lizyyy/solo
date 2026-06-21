#!/usr/bin/env python3
"""
珊瑚白化数据清洗脚本
参数名和失败提示保持稳定，供日常脚本调用。
"""

import argparse
import csv
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple


ERROR_MESSAGES = {
    "E001": "输入文件不存在: {path}",
    "E002": "CSV 解析失败: {path}, 错误: {detail}",
    "E003": "缺少必需列: {columns}",
    "E004": "经纬度解析失败: 站点={station}, 原始值={value}",
    "E005": "潮位单位无法识别: 站点={station}, 原始值={value}",
    "E006": "输出目录不可写: {path}",
    "E007": "后补备注匹配失败: 行号={line}, 内容={content}",
    "E008": "老何改判批次文件格式错误: {detail}",
}


def fail(code: str, **kwargs) -> None:
    msg = ERROR_MESSAGES.get(code, f"未知错误码: {code}").format(**kwargs)
    print(f"[ERROR] {code} {msg}", file=sys.stderr)
    sys.exit(1)


@dataclass
class ChangeRecord:
    station: str
    date: str
    field: str
    old_value: Any
    new_value: Any
    source: str
    reason: str
    operator: str = ""
    timestamp: str = ""


@dataclass
class AnomalyRecord:
    station: str
    date: str
    field: str
    value: Any
    severity: str
    suggestion: str
    detail: str
    raw_value: str = ""
    detected_unit: str = ""
    normalized_value: str = ""
    action: str = ""


@dataclass
class TideIssue:
    station: str
    date: str
    raw_value: str
    detected_unit: str
    normalized_value: float
    suggestion: str


@dataclass
class CleanContext:
    changes: List[ChangeRecord] = field(default_factory=list)
    anomalies: List[AnomalyRecord] = field(default_factory=list)
    tide_issues: List[TideIssue] = field(default_factory=list)
    he_changes_before: Dict[str, Dict] = field(default_factory=dict)
    he_changes_after: Dict[str, Dict] = field(default_factory=dict)


def normalize_latitude(value: str) -> Optional[float]:
    return _normalize_coord(value, is_lat=True)


def normalize_longitude(value: str) -> Optional[float]:
    return _normalize_coord(value, is_lat=False)


def _normalize_coord(value: str, is_lat: bool) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip().replace('"', '')
    if not s:
        return None

    try:
        return float(s)
    except ValueError:
        pass

    m = re.match(
        r'^\s*(\d+)[°度]\s*(\d+)[\'′分]\s*([\d.]+)["″秒]?\s*([NSEWnsew])?\s*$', s
    )
    if m:
        deg = float(m.group(1))
        minute = float(m.group(2))
        sec = float(m.group(3))
        sign = 1.0
        if m.group(4):
            d = m.group(4).upper()
            if d in ('S', 'W'):
                sign = -1.0
        return round(sign * (deg + minute / 60 + sec / 3600), 6)

    m = re.match(r'^\s*(\d+)[°度]\s*([\d.]+)[\'′分]?\s*([NSEWnsew])?\s*$', s)
    if m:
        deg = float(m.group(1))
        minute = float(m.group(2))
        sign = 1.0
        if m.group(3):
            d = m.group(3).upper()
            if d in ('S', 'W'):
                sign = -1.0
        return round(sign * (deg + minute / 60), 6)

    return None


TIDE_UNIT_SUGGESTIONS = {
    "mixed": (
        "潮位存在多种单位混用。处理建议：(1) 确认每批数据的原始记录单位；"
        "(2) 全部换算为米(m)后再入库；(3) 在备注列标注原始单位；"
        "(4) 如无法确认，请联系采样人员核实，不要假设。"
    ),
    "unknown": (
        "潮位单位无法识别。处理建议：(1) 回溯原始采样记录表；"
        "(2) 若值在0.5-3.0之间通常是米，在50-300之间通常是厘米；"
        "(3) 若仍不确定，标记为待人工复核，不要猜测入库。"
    ),
    "no_unit": (
        "潮位数值缺少单位。处理建议：(1) 根据数值范围推断：<5 为米，50-300 为厘米，>500 为毫米；"
        "(2) 联系值班采样员确认；(3) 补充单位后再入库。"
    ),
}


TIDE_ACTION_MESSAGES = {
    "cm": "已自动换算为米(m)，换算关系：1cm = 0.01m",
    "mm": "已自动换算为米(m)，换算关系：1mm = 0.001m",
    "no_unit_likely_m": "已按数值范围推断为米(m)，待人工复核确认",
    "no_unit_likely_cm": "已按数值范围推断为厘米(cm)并换算为米(m)，待人工复核确认",
    "no_unit_likely_mm": "已按数值范围推断为毫米(mm)并换算为米(m)，待人工复核确认",
    "unknown": "无法自动处理，需人工核实原始记录",
}


def normalize_tide(value: str, station: str, date: str, ctx: CleanContext) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None

    meters = None
    detected_unit = "unknown"

    m = re.match(r'^([\d.]+)\s*(m|米|公尺)$', s, re.IGNORECASE)
    if m:
        meters = float(m.group(1))
        detected_unit = "m"

    m = re.match(r'^([\d.]+)\s*(cm|厘米|公分)$', s, re.IGNORECASE)
    if m:
        meters = float(m.group(1)) / 100.0
        detected_unit = "cm"

    m = re.match(r'^([\d.]+)\s*(mm|毫米)$', s, re.IGNORECASE)
    if m:
        meters = float(m.group(1)) / 1000.0
        detected_unit = "mm"

    if meters is None:
        m = re.match(r'^([\d.]+)$', s)
        if m:
            v = float(m.group(1))
            if v < 5:
                meters = v
                detected_unit = "no_unit_likely_m"
            elif 50 <= v < 500:
                meters = v / 100.0
                detected_unit = "no_unit_likely_cm"
            elif v >= 500:
                meters = v / 1000.0
                detected_unit = "no_unit_likely_mm"

    norm_val_str = f"{round(meters, 4)}m" if meters is not None else ""
    action = TIDE_ACTION_MESSAGES.get(detected_unit, "")

    if meters is None:
        ctx.anomalies.append(AnomalyRecord(
            station=station, date=date, field="潮位", value=s,
            severity="high",
            suggestion=TIDE_UNIT_SUGGESTIONS["unknown"],
            detail=f"原始值 {s} 无法解析为数值或识别单位",
            raw_value=s,
            detected_unit=detected_unit,
            normalized_value="",
            action=action,
        ))
        ctx.tide_issues.append(TideIssue(
            station=station, date=date, raw_value=s,
            detected_unit="unknown", normalized_value=0.0,
            suggestion=TIDE_UNIT_SUGGESTIONS["unknown"],
        ))
        return None

    if detected_unit.startswith("no_unit"):
        ctx.tide_issues.append(TideIssue(
            station=station, date=date, raw_value=s,
            detected_unit=detected_unit, normalized_value=round(meters, 4),
            suggestion=TIDE_UNIT_SUGGESTIONS["no_unit"],
        ))
        ctx.anomalies.append(AnomalyRecord(
            station=station, date=date, field="潮位", value=s,
            severity="medium",
            suggestion=TIDE_UNIT_SUGGESTIONS["no_unit"],
            detail=f"缺少单位，按数值范围推断结果为 {round(meters, 4)}m",
            raw_value=s,
            detected_unit=detected_unit,
            normalized_value=norm_val_str,
            action=action,
        ))
    elif detected_unit != "m":
        ctx.tide_issues.append(TideIssue(
            station=station, date=date, raw_value=s,
            detected_unit=detected_unit, normalized_value=round(meters, 4),
            suggestion=TIDE_UNIT_SUGGESTIONS["mixed"],
        ))
        ctx.anomalies.append(AnomalyRecord(
            station=station, date=date, field="潮位", value=s,
            severity="low",
            suggestion=TIDE_UNIT_SUGGESTIONS["mixed"],
            detail=f"单位为 {detected_unit}，非标准单位，已统一换算为 {norm_val_str}",
            raw_value=s,
            detected_unit=detected_unit,
            normalized_value=norm_val_str,
            action=action,
        ))

    return round(meters, 4)


def read_csv(path: str) -> List[Dict]:
    if not os.path.exists(path):
        fail("E001", path=path)
    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            return list(csv.DictReader(f))
    except Exception as e:
        fail("E002", path=path, detail=str(e))


def ensure_columns(rows: List[Dict], required: List[str]) -> None:
    if not rows:
        return
    missing = [c for c in required if c not in rows[0]]
    if missing:
        fail("E003", columns=",".join(missing))


def apply_correction_notes(rows: List[Dict], notes_path: str, ctx: CleanContext) -> None:
    if not os.path.exists(notes_path):
        return
    notes = read_csv(notes_path)
    for n in notes:
        key = (n["站点编号"], n["监测日期"])
        field = n["字段"]
        for i, row in enumerate(rows):
            if (row["站点编号"], row["监测日期"]) == key and field in row:
                old = row[field]
                row[field] = n["修正值"]
                ctx.changes.append(ChangeRecord(
                    station=key[0], date=key[1], field=field,
                    old_value=old, new_value=n["修正值"],
                    source="后补备注", reason=n["修正原因"],
                    operator=n.get("修正人", ""),
                    timestamp=n.get("修正时间", ""),
                ))
                break


def apply_verbal_notes(rows: List[Dict], verbal_path: str, ctx: CleanContext) -> None:
    if not os.path.exists(verbal_path):
        return
    notes = read_csv(verbal_path)
    for n in notes:
        stations = n["涉及站点"].split()
        for st in stations:
            for row in rows:
                if row["站点编号"] == st:
                    existing = row.get("备注", "")
                    tag = f"[口头备注·{n['口述人']}·{n['记录时间'][:10]}]"
                    addition = f"{tag} {n['内容']}"
                    row["备注"] = (existing + "；" + addition) if existing else addition
                    ctx.changes.append(ChangeRecord(
                        station=st, date=row["监测日期"], field="备注",
                        old_value=existing, new_value=row["备注"],
                        source="口头备注", reason=n["内容"],
                        operator=n.get("记录人", ""),
                        timestamp=n.get("记录时间", ""),
                    ))


def apply_he_changes(rows: List[Dict], he_path: str, ctx: CleanContext) -> None:
    if not os.path.exists(he_path):
        return
    changes = read_csv(he_path)

    extra_fields = set()
    for c in changes:
        field = c["字段"]
        has_field = False
        for row in rows:
            if (row["站点编号"], row["监测日期"]) == (c["站点编号"], c["监测日期"]):
                if field in row:
                    has_field = True
                break
        if not has_field:
            extra_fields.add(field)

    for row in rows:
        for ef in extra_fields:
            if ef not in row:
                row[ef] = ""
        for c in changes:
            if (row["站点编号"], row["监测日期"]) == (c["站点编号"], c["监测日期"]):
                fld = c["字段"]
                if fld in extra_fields:
                    row[fld] = c["改判前"]

    for row in rows:
        key = row["站点编号"] + "_" + row["监测日期"]
        ctx.he_changes_before[key] = dict(row)

    for c in changes:
        key = (c["站点编号"], c["监测日期"])
        field = c["字段"]
        for row in rows:
            if (row["站点编号"], row["监测日期"]) == key:
                old = row.get(field, "")
                row[field] = c["改判后"]
                ctx.changes.append(ChangeRecord(
                    station=key[0], date=key[1], field=field,
                    old_value=c["改判前"] if old == "" else old,
                    new_value=c["改判后"],
                    source="老何改判", reason=c["改判理由"],
                    operator=c.get("改判人", "老何"),
                    timestamp=c.get("改判时间", ""),
                ))
                break

    for row in rows:
        key = row["站点编号"] + "_" + row["监测日期"]
        ctx.he_changes_after[key] = dict(row)


def clean_rows(rows: List[Dict], ctx: CleanContext) -> List[Dict]:
    cleaned = []
    for row in rows:
        r = dict(row)
        st = r.get("站点编号", "")
        dt = r.get("监测日期", "")

        orig_lon = r.get("经度", "")
        orig_lat = r.get("纬度", "")
        new_lon = normalize_longitude(orig_lon)
        new_lat = normalize_latitude(orig_lat)

        if new_lon is None:
            fail("E004", station=st, value=orig_lon)
        if new_lat is None:
            fail("E004", station=st, value=orig_lat)

        if str(orig_lon) != str(new_lon):
            ctx.changes.append(ChangeRecord(
                station=st, date=dt, field="经度",
                old_value=orig_lon, new_value=new_lon,
                source="格式标准化", reason="经纬度统一为十进制度",
            ))
        if str(orig_lat) != str(new_lat):
            ctx.changes.append(ChangeRecord(
                station=st, date=dt, field="纬度",
                old_value=orig_lat, new_value=new_lat,
                source="格式标准化", reason="经纬度统一为十进制度",
            ))

        r["经度"] = new_lon
        r["纬度"] = new_lat

        orig_tide = r.get("潮位", "")
        new_tide = normalize_tide(orig_tide, st, dt, ctx)
        if new_tide is not None and str(orig_tide) != str(new_tide) + "m":
            if str(orig_tide) != str(new_tide):
                ctx.changes.append(ChangeRecord(
                    station=st, date=dt, field="潮位",
                    old_value=orig_tide, new_value=f"{new_tide}m",
                    source="单位标准化", reason="潮位统一为米(m)",
                ))
        r["潮位"] = f"{new_tide}m" if new_tide is not None else ""

        try:
            bleaching = float(r.get("白化率(%)", 0))
            if bleaching > 80:
                ctx.anomalies.append(AnomalyRecord(
                    station=st, date=dt, field="白化率(%)", value=bleaching,
                    severity="high",
                    suggestion="白化率超过80%，建议复核采样照片和实验室结果，确认是否为极端情况。",
                    detail=f"白化率 {bleaching}% 显著高于平均水平",
                ))
            elif bleaching < 0:
                ctx.anomalies.append(AnomalyRecord(
                    station=st, date=dt, field="白化率(%)", value=bleaching,
                    severity="high",
                    suggestion="白化率为负值，检查数据录入是否有误。",
                    detail="白化率不能为负",
                ))
        except (ValueError, TypeError):
            pass

        try:
            temp = float(r.get("水温(℃)", 0))
            if temp > 31:
                ctx.anomalies.append(AnomalyRecord(
                    station=st, date=dt, field="水温(℃)", value=temp,
                    severity="medium",
                    suggestion="水温偏高，结合白化率判断是否为热胁迫导致。",
                    detail=f"水温 {temp}℃ 超过正常监测范围上限",
                ))
        except (ValueError, TypeError):
            pass

        cleaned.append(r)
    return cleaned


def write_csv(rows: List[Dict], path: str) -> None:
    if not rows:
        return
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def build_summary(ctx: CleanContext, raw_count: int, clean_count: int) -> Dict:
    source_counts: Dict[str, int] = {}
    for c in ctx.changes:
        source_counts[c.source] = source_counts.get(c.source, 0) + 1

    tide_units = {}
    for t in ctx.tide_issues:
        tide_units[t.detected_unit] = tide_units.get(t.detected_unit, 0) + 1

    severity_counts = {"high": 0, "medium": 0, "low": 0}
    for a in ctx.anomalies:
        severity_counts[a.severity] = severity_counts.get(a.severity, 0) + 1

    tide_anomaly_count = sum(1 for a in ctx.anomalies if a.field == "潮位")

    return {
        "生成时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "原始记录数": raw_count,
        "清洗后记录数": clean_count,
        "字段修改总次数": len(ctx.changes),
        "修改来源分布": source_counts,
        "异常记录数": len(ctx.anomalies),
        "异常严重程度分布": severity_counts,
        "潮位单位问题数": tide_anomaly_count,
        "潮位单位分布": tide_units,
        "老何改判记录数": sum(1 for c in ctx.changes if c.source == "老何改判"),
    }


def ensure_dir_writable(path: str) -> None:
    try:
        os.makedirs(path, exist_ok=True)
        test = os.path.join(path, ".write_test")
        with open(test, "w") as f:
            f.write("ok")
        os.remove(test)
    except Exception as e:
        fail("E006", path=path)


def main():
    parser = argparse.ArgumentParser(description="珊瑚白化数据清洗")
    parser.add_argument("--input", "-i", required=True, help="实验室结果表CSV路径")
    parser.add_argument("--corrections", "-c", default="data/correction_notes.csv", help="后补备注CSV路径")
    parser.add_argument("--verbal", "-v", default="data/verbal_notes.csv", help="口头备注CSV路径")
    parser.add_argument("--he-changes", "-he", default="data/he_decision_changes.csv", help="老何改判记录CSV路径")
    parser.add_argument("--output", "-o", default="output/cleaned_results.csv", help="清洗后数据输出路径")
    parser.add_argument("--summary", "-s", default="output/summary.json", help="汇总报告输出路径(JSON)")
    parser.add_argument("--changes-log", "-ch", default="output/changes_log.csv", help="修改明细输出路径")
    parser.add_argument("--anomalies", "-a", default="output/anomalies.csv", help="异常明细输出路径")
    parser.add_argument("--he-diff", "-hd", default="output/he_diff.json", help="老何改判前后对比输出路径(JSON)")
    parser.add_argument("--log-dir", "-l", default="logs", help="日志目录")
    args = parser.parse_args()

    for d in set([os.path.dirname(args.output) or ".",
                  os.path.dirname(args.summary) or ".",
                  os.path.dirname(args.changes_log) or ".",
                  os.path.dirname(args.anomalies) or ".",
                  os.path.dirname(args.he_diff) or ".",
                  args.log_dir]):
        ensure_dir_writable(d)

    raw = read_csv(args.input)
    ensure_columns(raw, ["站点编号", "监测日期", "经度", "纬度", "白化率(%)", "潮位"])

    ctx = CleanContext()

    apply_correction_notes(raw, args.corrections, ctx)
    apply_verbal_notes(raw, args.verbal, ctx)
    cleaned = clean_rows(raw, ctx)
    apply_he_changes(cleaned, args.he_changes, ctx)

    write_csv(cleaned, args.output)

    change_rows = []
    for c in ctx.changes:
        change_rows.append({
            "站点编号": c.station,
            "监测日期": c.date,
            "字段": c.field,
            "原值": c.old_value,
            "新值": c.new_value,
            "修改来源": c.source,
            "修改原因": c.reason,
            "操作人": c.operator,
            "修改时间": c.timestamp,
        })
    write_csv(change_rows, args.changes_log)

    anomaly_rows = []
    for a in ctx.anomalies:
        row = {
            "站点编号": a.station,
            "监测日期": a.date,
            "字段": a.field,
            "值": a.value,
            "严重程度": a.severity,
            "处理建议": a.suggestion,
            "详细说明": a.detail,
        }
        if a.field == "潮位":
            row["原始值"] = a.raw_value
            row["识别单位"] = a.detected_unit
            row["换算后标准值"] = a.normalized_value
            row["处理动作"] = a.action
        anomaly_rows.append(row)
    write_csv(anomaly_rows, args.anomalies)

    he_diff = {"before": ctx.he_changes_before, "after": ctx.he_changes_after}
    with open(args.he_diff, "w", encoding="utf-8") as f:
        json.dump(he_diff, f, ensure_ascii=False, indent=2)

    summary = build_summary(ctx, len(raw), len(cleaned))
    with open(args.summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    log_path = os.path.join(args.log_dir, f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump({
            "参数": vars(args),
            "汇总": summary,
            "修改数": len(ctx.changes),
            "异常数": len(ctx.anomalies),
        }, f, ensure_ascii=False, indent=2)

    print("===== 珊瑚白化数据清洗 汇总 =====")
    print(f"  原始记录:     {summary['原始记录数']} 条")
    print(f"  清洗后记录:   {summary['清洗后记录数']} 条")
    print(f"  字段修改:     {summary['字段修改总次数']} 次")
    for src, cnt in summary["修改来源分布"].items():
        print(f"    - {src}: {cnt} 次")
    print(f"  异常记录:     {summary['异常记录数']} 条 (高:{summary['异常严重程度分布']['high']} 中:{summary['异常严重程度分布']['medium']} 低:{summary['异常严重程度分布']['low']})")
    print(f"  潮位单位问题: {summary['潮位单位问题数']} 条")
    print(f"  老何改判:     {summary['老何改判记录数']} 条")
    print("=================================")
    print(f"清洗结果: {os.path.abspath(args.output)}")
    print(f"修改明细: {os.path.abspath(args.changes_log)}")
    print(f"异常明细: {os.path.abspath(args.anomalies)}")
    print(f"汇总报告: {os.path.abspath(args.summary)}")
    print(f"老何改判对比: {os.path.abspath(args.he_diff)}")


if __name__ == "__main__":
    main()
