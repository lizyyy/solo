#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
电梯故障阈值预警 - 整包处理脚本
一条命令跑完：python run_warning.py
"""
import csv
import os
import re
import sys
from datetime import datetime, timedelta
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
REPORT_PATH = os.path.join(OUTPUT_DIR, "复核报告.md")
TRACE_PATH = os.path.join(OUTPUT_DIR, "数据追溯清单.csv")
GAP_PATH = os.path.join(OUTPUT_DIR, "采样断档明细.csv")

os.makedirs(OUTPUT_DIR, exist_ok=True)

THRESHOLDS = {
    "fault_count_weekly": 3,
    "door_issue_level": 2,
    "rope_wear_level": 2,
    "vibration_level": 2,
    "temp_level": 2,
    "run_hour_daily_min": 8,
}

COLUMN_ALIASES = {
    "device_id": ["设备编号", "设备号", "设备编码"],
    "check_date": ["巡检日期", "日期", "检查日期"],
    "run_hours": ["运行时长(h)", "运行", "累计运行(h)"],
    "fault_count": ["故障次数", "故障", "本月故障"],
    "door_issue": ["门机异响", "门机", "门机状况"],
    "rope_wear": ["钢丝绳磨损", "钢丝绳", "钢缆磨损"],
    "vibration": ["轿厢振动", "振动", "抖动情况"],
    "temp": ["温度异常", "温度", "机房温度"],
    "inspector": ["巡检员", "巡检人", "负责人"],
    "remark": ["备注", "原始记录"],
}

LEVEL_MAP = {
    "door": {"无": 0, "正常": 0, "偶发": 1, "频发": 2, "频繁异响": 2},
    "rope": {"正常": 0, "轻微": 1, "轻度": 1, "中度": 2, "严重": 2, "重度更换": 2},
    "vibration": {"正常": 0, "无": 0, "轻微": 1, "明显": 2, "剧烈": 2},
    "temp": {"正常": 0, "偏高": 1, "高温": 2, "高温告警": 2},
}


def normalize_device_id(raw_id: str) -> str:
    raw = raw_id.strip()
    m = re.search(r"(\d+)", raw)
    if not m:
        return raw
    num = int(m.group(1))
    return f"EL-{num:03d}"


def pick_col(row: dict, field: str):
    for alias in COLUMN_ALIASES[field]:
        if alias in row and row[alias].strip() != "":
            return row[alias].strip()
    return None


def safe_float(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def safe_int(v):
    f = safe_float(v)
    return int(f) if f is not None else None


def levelize(category: str, raw_val):
    if raw_val is None:
        return None
    return LEVEL_MAP[category].get(raw_val.strip(), None)


records = []
trace_lines = []
gap_lines = []
source_meta = []

csv_files = sorted([f for f in os.listdir(DATA_DIR) if f.endswith(".csv")])
print("=" * 60)
print("电梯故障阈值预警 - 开始处理")
print("=" * 60)

for fname in csv_files:
    fpath = os.path.join(DATA_DIR, fname)
    with open(fpath, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        source_meta.append((fname, reader.fieldnames))
        for lineno, row in enumerate(reader, start=2):
            raw_device = pick_col(row, "device_id")
            raw_date = pick_col(row, "check_date")
            if not raw_device or not raw_date:
                continue
            norm_device = normalize_device_id(raw_device)
            run_hours = safe_float(pick_col(row, "run_hours"))
            fault_count = safe_int(pick_col(row, "fault_count"))
            door_raw = pick_col(row, "door_issue")
            rope_raw = pick_col(row, "rope_wear")
            vib_raw = pick_col(row, "vibration")
            temp_raw = pick_col(row, "temp")
            inspector = pick_col(row, "inspector")
            remark = pick_col(row, "remark")

            door_lv = levelize("door", door_raw)
            rope_lv = levelize("rope", rope_raw)
            vib_lv = levelize("vibration", vib_raw)
            temp_lv = levelize("temp", temp_raw)

            field_gaps = []
            if run_hours is None:
                field_gaps.append(("运行时长", "未抄表/空白", fname, lineno))
            if fault_count is None:
                field_gaps.append(("故障次数", "空白", fname, lineno))
            if door_lv is None and door_raw is not None:
                field_gaps.append(("门机状况", f"原始写法\"{door_raw}\"未在映射表", fname, lineno))
            if rope_lv is None and rope_raw is not None:
                field_gaps.append(("钢丝绳磨损", f"原始写法\"{rope_raw}\"未在映射表", fname, lineno))
            if vib_lv is None and vib_raw is not None:
                field_gaps.append(("轿厢振动", f"原始写法\"{vib_raw}\"未在映射表", fname, lineno))
            if temp_lv is None and temp_raw is not None:
                field_gaps.append(("机房温度", f"原始写法\"{temp_raw}\"未在映射表", fname, lineno))

            for f_name, f_reason, f_src, f_line in field_gaps:
                gap_lines.append({
                    "断档类型": "字段缺失/无法解析",
                    "归一设备号": norm_device,
                    "巡检日期": raw_date,
                    "缺失字段": f_name,
                    "原始表来源": f_src,
                    "原始表行号": f_line,
                    "巡检表原始说法": remark if remark else "(备注无)"
                })

            rec = {
                "norm_device": norm_device,
                "raw_device": raw_device,
                "check_date": raw_date,
                "run_hours": run_hours,
                "fault_count": fault_count,
                "door_raw": door_raw, "door_lv": door_lv,
                "rope_raw": rope_raw, "rope_lv": rope_lv,
                "vib_raw": vib_raw, "vib_lv": vib_lv,
                "temp_raw": temp_raw, "temp_lv": temp_lv,
                "inspector": inspector,
                "remark": remark,
                "source_file": fname,
                "source_line": lineno,
            }
            records.append(rec)
            trace_lines.append({
                "归一设备号": norm_device,
                "巡检日期": raw_date,
                "原始设备号写法": raw_device,
                "来源文件": fname,
                "来源行号": lineno,
                "原始备注": remark if remark else "",
                "原始巡检员写法": inspector if inspector else "",
            })

all_dates = sorted(set(r["check_date"] for r in records))
if all_dates:
    d_start = datetime.strptime(all_dates[0], "%Y-%m-%d").date()
    d_end = datetime.strptime(all_dates[-1], "%Y-%m-%d").date()
    expected_dates = []
    cur = d_start
    while cur <= d_end:
        expected_dates.append(cur.strftime("%Y-%m-%d"))
        cur += timedelta(days=1)
else:
    expected_dates = []

device_set = sorted(set(r["norm_device"] for r in records))
date_gaps = []
for dev in device_set:
    dev_dates = set(r["check_date"] for r in records if r["norm_device"] == dev)
    for dt in expected_dates:
        if dt not in dev_dates:
            date_gaps.append((dev, dt))

for dev, dt in date_gaps:
    src_around = [r for r in records if r["norm_device"] == dev]
    before = [r for r in src_around if r["check_date"] < dt]
    after = [r for r in src_around if r["check_date"] > dt]
    nearest_src = before[-1]["source_file"] if before else (after[0]["source_file"] if after else "(未知)")
    nearest_remark = before[-1]["remark"] if before else (after[0]["remark"] if after else "")
    gap_lines.append({
        "断档类型": "日期级整行缺失",
        "归一设备号": dev,
        "巡检日期": dt,
        "缺失字段": "(整条无记录)",
        "原始表来源": f"推断：附近记录来自 {nearest_src}",
        "原始表行号": "-",
        "巡检表原始说法": nearest_remark if nearest_remark else "(附近记录无备注说明)"
    })

with open(TRACE_PATH, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(trace_lines[0].keys()))
    w.writeheader()
    w.writerows(trace_lines)

with open(GAP_PATH, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["断档类型", "归一设备号", "巡检日期", "缺失字段", "原始表来源", "原始表行号", "巡检表原始说法"])
    w.writeheader()
    w.writerows(gap_lines)

weekly_summary = defaultdict(lambda: defaultdict(int))
daily_by_dev = defaultdict(dict)
for r in records:
    d = r["check_date"]
    wk = datetime.strptime(d, "%Y-%m-%d").date().isocalendar()[1]
    dev = r["norm_device"]
    weekly_summary[wk][dev] += (r["fault_count"] or 0)
    daily_by_dev[dev][d] = r

flagged_devices = {}
for wk, dev_map in weekly_summary.items():
    for dev, fc in dev_map.items():
        reasons = []
        if fc >= THRESHOLDS["fault_count_weekly"]:
            reasons.append(f"周故障累计 {fc} 次 ≥ 阈值 {THRESHOLDS['fault_count_weekly']}")
        latest_dates = sorted(daily_by_dev[dev].keys())[-3:]
        for d in latest_dates:
            lr = daily_by_dev[dev][d]
            if (lr["door_lv"] or 0) >= THRESHOLDS["door_issue_level"]:
                reasons.append(f"[{d}]门机={lr['door_raw']}（级别≥阈值）")
            if (lr["rope_lv"] or 0) >= THRESHOLDS["rope_wear_level"]:
                reasons.append(f"[{d}]钢丝绳={lr['rope_raw']}（级别≥阈值）")
            if (lr["vib_lv"] or 0) >= THRESHOLDS["vibration_level"]:
                reasons.append(f"[{d}]振动={lr['vib_raw']}（级别≥阈值）")
            if (lr["temp_lv"] or 0) >= THRESHOLDS["temp_level"]:
                reasons.append(f"[{d}]温度={lr['temp_raw']}（级别≥阈值）")
        if reasons and dev not in flagged_devices:
            flagged_devices[dev] = reasons

field_gap_count = sum(1 for g in gap_lines if g["断档类型"] == "字段缺失/无法解析")
date_gap_count = sum(1 for g in gap_lines if g["断档类型"] == "日期级整行缺失")
total_records = len(records)
total_flagged = len(flagged_devices)

status = {
    "处理完成": {
        "巡检表加载": f"{len(csv_files)} 份原始CSV → {total_records} 条巡检记录",
        "设备号归一": f"识别 {len(device_set)} 台设备，统一为 EL-NNN 格式（原始写法保留在追溯清单）",
        "字段映射": f"合并 {len(COLUMN_ALIASES)} 类列名，共 {sum(len(v) for v in COLUMN_ALIASES.values())} 种别名写法",
        "阈值预警": f"{total_flagged} 台触发预警阈值",
        "追溯清单": f"已写入 {os.path.basename(TRACE_PATH)}（每条都能追到原始表行号和原始写法）",
    },
    "缺材料/待补采": {
        "字段级断档": f"{field_gap_count} 处（运行时长空白、描述写法无法映射等，详见断档明细）",
        "日期级断档": f"{date_gap_count} 处（某台某日期整行缺失，详见断档明细）",
    },
}

report_lines = []
report_lines.append("# 电梯故障阈值预警 · 复核报告")
report_lines.append("")
report_lines.append(f"**生成时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
report_lines.append(f"**数据范围**：{all_dates[0]} ~ {all_dates[-1]}（共 {len(expected_dates)} 个自然日）")
report_lines.append("")

report_lines.append("## 一、复核口径一览（异常明细 = 汇总）")
report_lines.append("")
report_lines.append("| 指标 | 数值 | 说明 |")
report_lines.append("|---|---|---|")
report_lines.append(f"| 巡检表份数 | {len(csv_files)} | data/ 目录下 CSV 全部加载 |")
report_lines.append(f"| 巡检记录条数 | {total_records} | 原始行数，已剔除表头 |")
report_lines.append(f"| 归一化设备数 | {len(device_set)} | 设备编号统一写法（原始写法保留在追溯清单） |")
report_lines.append(f"| 触发预警设备数 | {total_flagged} | 至少命中 1 条阈值规则 |")
report_lines.append(f"| 字段级断档数 | {field_gap_count} | 单字段空白或写法未入映射表 |")
report_lines.append(f"| 日期级断档数 | {date_gap_count} | 某设备某日期整行缺失 |")
report_lines.append("")

report_lines.append("## 二、触发阈值预警的设备（明细接上汇总）")
report_lines.append("")
if flagged_devices:
    report_lines.append("共 **{}** 台，明细如下：".format(total_flagged))
    report_lines.append("")
    for dev, reasons in sorted(flagged_devices.items()):
        report_lines.append(f"### {dev}")
        report_lines.append("")
        dev_recs = [r for r in records if r["norm_device"] == dev]
        dev_raw_ids = sorted(set(r["raw_device"] for r in dev_recs))
        report_lines.append(f"- 巡检表中出现过的原始设备号写法：{'、'.join(dev_raw_ids)}")
        report_lines.append(f"- 涉及巡检表来源：{sorted(set(r['source_file'] for r in dev_recs))}")
        report_lines.append(f"- 触发原因：")
        for rs in reasons:
            report_lines.append(f"  - {rs}")
        report_lines.append(f"- 原始巡检备注（按日期）：")
        for dr in sorted(dev_recs, key=lambda x: x["check_date"]):
            if dr["remark"]:
                report_lines.append(f"  - [{dr['check_date']}] {dr['inspector'] or '未知巡检员'}（{dr['source_file']} 第{dr['source_line']}行）：{dr['remark']}")
        report_lines.append("")
else:
    report_lines.append("_无设备触发阈值预警_")
    report_lines.append("")

report_lines.append("## 三、处理完成项")
report_lines.append("")
for k, v in status["处理完成"].items():
    report_lines.append(f"- **{k}**：{v}")
report_lines.append("")

report_lines.append("## 四、缺材料 / 待补采项")
report_lines.append("")
for k, v in status["缺材料/待补采"].items():
    report_lines.append(f"- **{k}**：{v}")
report_lines.append("")

report_lines.append("### 采样断档 TOP（能追到巡检表原始说法，完整见 采样断档明细.csv）")
report_lines.append("")
report_lines.append("| 断档类型 | 设备号 | 日期 | 缺失字段 | 巡检表来源 | 原始说法 |")
report_lines.append("|---|---|---|---|---|---|")
for g in gap_lines[:15]:
    report_lines.append("| {断档类型} | {归一设备号} | {巡检日期} | {缺失字段} | {原始表来源}#{原始表行号} | {巡检表原始说法} |".format(**g))
if len(gap_lines) > 15:
    report_lines.append(f"| ……（共 {len(gap_lines)} 条，余见 CSV） | | | | | |")
report_lines.append("")

report_lines.append("## 五、附件清单")
report_lines.append("")
report_lines.append(f"- `output/复核报告.md`：本文件")
report_lines.append(f"- `output/数据追溯清单.csv`：每条归一记录 → 原始表 + 行号 + 原始设备写法 + 原始备注")
report_lines.append(f"- `output/采样断档明细.csv`：全部字段级/日期级断档，带巡检表原始说法")

with open(REPORT_PATH, "w", encoding="utf-8") as f:
    f.write("\n".join(report_lines))

print(f"[OK] 加载巡检表 {len(csv_files)} 份 → {total_records} 条记录")
print(f"[OK] 设备编号归一：{len(device_set)} 台，保留原始写法于追溯清单")
print(f"[!!] 触发预警阈值：{total_flagged} 台")
print(f"[!!] 采样断档：字段级 {field_gap_count} 处 + 日期级 {date_gap_count} 处")
print(f"[OK] 报告已生成：{REPORT_PATH}")
print("")
print("=" * 60)
print("【退出提示 - 采样断档卡住的位置】")
print("=" * 60)
if gap_lines:
    print("")
    print("不是一句含糊警告，以下每一处都能追到具体巡检表：")
    print("")
    for g in gap_lines[:10]:
        print(f"  · [{g['断档类型']}] {g['归一设备号']} @ {g['巡检日期']} "
              f"缺「{g['缺失字段']}」 ← 来自 {g['原始表来源']} "
              f"原始说法：{g['巡检表原始说法']}")
    if len(gap_lines) > 10:
        print(f"  · ……剩余 {len(gap_lines) - 10} 处详见 output/采样断档明细.csv")
else:
    print("  本次数据未发现采样断档。")
print("")
print("下一步：打开 output/复核报告.md 看汇总 + 异常明细（口径一致可互查）")
print("      需要补采时，对照 output/采样断档明细.csv 定位到巡检表行号补填")
print("")
