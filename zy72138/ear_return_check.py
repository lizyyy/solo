#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
耳返通道换场检查 - 核心校验脚本
关联文件、曲目、批注，识别异常，检测冲突，生成交接清单
"""

import csv
import json
import re
import os
import argparse
from datetime import datetime, date
from collections import defaultdict


TODAY = date(2026, 6, 2)
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
STATE_FILE = os.path.join(DATA_DIR, ".check_state.json")
STAGE_TABLE = os.path.join(DATA_DIR, "stage_channel_table.csv")
CHECK_DATA = os.path.join(DATA_DIR, "ear_return_channel_check.csv")
REPORT_FILE = os.path.join(DATA_DIR, "耳返通道换场检查_交接清单.md")


def parse_timecode(tc):
    """解析时码 HH:MM:SS 为秒数"""
    if not tc or tc.strip() == "":
        return None
    try:
        h, m, s = map(int, tc.strip().split(":"))
        return h * 3600 + m * 60 + s
    except (ValueError, AttributeError):
        return None


def format_timecode(seconds):
    """秒数转 HH:MM:SS"""
    if seconds is None:
        return ""
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def parse_authorization(remark):
    """从合同备注中解析授权期限"""
    if not remark:
        return None, None, "未填写合同备注"
    pattern = r"授权期限[:：]\s*(\d{4}-\d{2}-\d{2})\s*[至到\-]\s*(\d{4}-\d{2}-\d{2})"
    match = re.search(pattern, remark)
    if match:
        try:
            start = datetime.strptime(match.group(1), "%Y-%m-%d").date()
            end = datetime.strptime(match.group(2), "%Y-%m-%d").date()
            return start, end, None
        except ValueError:
            return None, None, "授权日期格式错误"
    if "授权待确认" in remark:
        return None, None, "授权待确认"
    return None, None, "未找到授权期限"


def read_stage_table():
    """读取舞台通道表"""
    records = {}
    with open(STAGE_TABLE, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            channel = row["通道编号"].strip()
            if not channel:
                continue
            auth_start, auth_end, auth_note = parse_authorization(row.get("合同备注", ""))
            records[channel] = {
                "channel": channel,
                "track_name": row["曲目名称"].strip(),
                "file_path": row["文件路径"].strip(),
                "master_version": row["母带版本"].strip(),
                "artist": row["艺人"].strip(),
                "tc_in": row["时码入点"].strip(),
                "tc_out": row["时码出点"].strip(),
                "tc_in_sec": parse_timecode(row["时码入点"]),
                "tc_out_sec": parse_timecode(row["时码出点"]),
                "stage_area": row["舞台区域"].strip(),
                "contract_no": row["合同编号"].strip(),
                "contract_remark": row["合同备注"].strip(),
                "auth_start": auth_start,
                "auth_end": auth_end,
                "auth_note": auth_note,
                "owner": row["负责人"].strip(),
                "reg_date": row["登记日期"].strip(),
            }
    return records


def read_check_data():
    """读取耳返通道换场检查数据"""
    records = defaultdict(list)
    with open(CHECK_DATA, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            channel = row["通道编号"].strip()
            if not channel:
                continue
            records[channel].append({
                "batch_no": row["批次号"].strip(),
                "check_date": row["检查日期"].strip(),
                "checker": row["检查人"].strip(),
                "channel": channel,
                "track_name": row["曲目名称"].strip(),
                "file_name": row["文件名"].strip(),
                "duration": row["文件时长"].strip(),
                "duration_sec": parse_timecode(row["文件时长"]),
                "tc_in": row["时码入点"].strip(),
                "tc_out": row["时码出点"].strip(),
                "tc_in_sec": parse_timecode(row["时码入点"]),
                "tc_out_sec": parse_timecode(row["时码出点"]),
                "version_tag": row["版本标记"].strip(),
                "annotation": row["批注"].strip(),
                "import_source": row["导入来源"].strip(),
                "manual_rename": row["人工改名标记"].strip() == "是",
            })
    return records


def load_state():
    """加载处理状态（用于增量处理）"""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "processed_channels": [],
        "resolved_issues": [],
        "notes": {},
        "last_updated": None,
    }


def save_state(state):
    """保存处理状态"""
    state["last_updated"] = TODAY.isoformat()
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def check_authorization(stage_rec):
    """检查授权状态"""
    if stage_rec["auth_note"]:
        return False, stage_rec["auth_note"]
    if stage_rec["auth_end"] and TODAY > stage_rec["auth_end"]:
        return False, f"授权已过期（至 {stage_rec['auth_end'].isoformat()}）"
    if stage_rec["auth_start"] and TODAY < stage_rec["auth_start"]:
        return False, f"授权未生效（自 {stage_rec['auth_start'].isoformat()}）"
    return True, "授权有效"


def check_timecode_alignment(stage_rec, check_rec):
    """检查时码对齐情况"""
    issues = []
    if stage_rec["tc_in_sec"] is not None and check_rec["tc_in_sec"] is not None:
        diff = abs(stage_rec["tc_in_sec"] - check_rec["tc_in_sec"])
        if diff > 0:
            issues.append(f"入点错位 {diff} 秒（舞台表:{stage_rec['tc_in']} / 检查表:{check_rec['tc_in']}）")
    if stage_rec["tc_out_sec"] is not None and check_rec["tc_out_sec"] is not None:
        diff = abs(stage_rec["tc_out_sec"] - check_rec["tc_out_sec"])
        if diff > 0:
            issues.append(f"出点错位 {diff} 秒（舞台表:{stage_rec['tc_out']} / 检查表:{check_rec['tc_out']}）")
    return issues


def check_master_version(stage_rec, check_rec):
    """检查母带版本"""
    if not check_rec["version_tag"]:
        return False, "检查表缺失版本标记"
    if check_rec["version_tag"] != "2025_master":
        return False, f"旧版母带（检查表标记:{check_rec['version_tag']}）"
    if stage_rec["master_version"] and stage_rec["master_version"] != check_rec["version_tag"]:
        return False, f"版本不一致（舞台表:{stage_rec['master_version']} / 检查表:{check_rec['version_tag']}）"
    return True, "母带版本正常"


def check_empty_values(stage_rec, check_rec):
    """检查空值"""
    empty_fields = []
    if not stage_rec["track_name"]:
        empty_fields.append("舞台表-曲目名称")
    if not stage_rec["contract_no"]:
        empty_fields.append("舞台表-合同编号")
    if not check_rec["track_name"]:
        empty_fields.append("检查表-曲目名称")
    return empty_fields


def find_duplicate_tracks(stage_records, check_records):
    """找出重复曲目"""
    track_channels = defaultdict(list)
    for channel, rec in stage_records.items():
        if rec["track_name"]:
            track_channels[rec["track_name"]].append(channel)
    duplicates = {}
    for track, channels in track_channels.items():
        if len(channels) > 1:
            duplicates[track] = channels
    return duplicates


def detect_conflicts(stage_rec, check_rec_list):
    """检测舞台通道表与检查数据的冲突"""
    conflicts = []
    for check_rec in check_rec_list:
        if stage_rec["track_name"] and check_rec["track_name"] and stage_rec["track_name"] != check_rec["track_name"]:
            conflicts.append({
                "field": "曲目名称",
                "stage_value": stage_rec["track_name"],
                "check_value": check_rec["track_name"],
                "evidence": f"舞台表登记为「{stage_rec['track_name']}」，检查表登记为「{check_rec['track_name']}」",
                "suggestion": "请核对曲目实际名称，以文件元数据或纸质合同为准",
            })
        stage_file = os.path.basename(stage_rec["file_path"]) if stage_rec["file_path"] else ""
        if stage_file and check_rec["file_name"] and stage_file != check_rec["file_name"]:
            if not check_rec["manual_rename"]:
                conflicts.append({
                    "field": "文件名",
                    "stage_value": stage_file,
                    "check_value": check_rec["file_name"],
                    "evidence": f"舞台表文件「{stage_file}」，检查表文件「{check_rec['file_name']}」",
                    "suggestion": "请确认是否为同一文件，检查表有「人工改名」标记请忽略",
                })
        tc_issues = check_timecode_alignment(stage_rec, check_rec)
        for issue in tc_issues:
            conflicts.append({
                "field": "时码",
                "stage_value": f"{stage_rec['tc_in']} - {stage_rec['tc_out']}",
                "check_value": f"{check_rec['tc_in']} - {check_rec['tc_out']}",
                "evidence": issue,
                "suggestion": "请核时码序列，避免跳点或重叠",
            })
    return conflicts


def analyze_data():
    """核心分析逻辑"""
    stage_records = read_stage_table()
    check_records = read_check_data()
    state = load_state()

    all_channels = sorted(set(list(stage_records.keys()) + list(check_records.keys())))
    duplicate_tracks = find_duplicate_tracks(stage_records, check_records)

    results = {
        "summary": {
            "total_channels": len(all_channels),
            "checked_date": TODAY.isoformat(),
        },
        "issues_by_category": {
            "expired_auth": [],
            "timecode_misalignment": [],
            "duplicate_tracks": [],
            "old_master": [],
            "missing_auth": [],
            "empty_values": [],
            "manual_rename": [],
            "conflicts": [],
        },
        "channel_details": {},
        "duplicate_tracks": duplicate_tracks,
    }

    for channel in all_channels:
        stage_rec = stage_records.get(channel, {})
        check_rec_list = check_records.get(channel, [])
        channel_issues = []

        if not stage_rec:
            channel_issues.append(("警告", f"通道 {channel} 无舞台表记录"))
        if not check_rec_list:
            channel_issues.append(("警告", f"通道 {channel} 无检查记录"))

        auth_ok, auth_msg = check_authorization(stage_rec) if stage_rec else (False, "无舞台表记录")
        if not auth_ok:
            if "过期" in auth_msg:
                results["issues_by_category"]["expired_auth"].append({
                    "channel": channel,
                    "track": stage_rec.get("track_name", "未知"),
                    "reason": auth_msg,
                    "contract": stage_rec.get("contract_no", ""),
                })
            elif "待确认" in auth_msg or "未找到" in auth_msg:
                results["issues_by_category"]["missing_auth"].append({
                    "channel": channel,
                    "track": stage_rec.get("track_name", "未知"),
                    "reason": auth_msg,
                    "contract": stage_rec.get("contract_no", ""),
                })
            channel_issues.append(("授权", auth_msg))

        for check_rec in check_rec_list:
            ver_ok, ver_msg = check_master_version(stage_rec, check_rec) if stage_rec else (False, "无舞台表记录")
            if not ver_ok:
                results["issues_by_category"]["old_master"].append({
                    "channel": channel,
                    "track": check_rec["track_name"],
                    "file": check_rec["file_name"],
                    "reason": ver_msg,
                    "annotation": check_rec["annotation"],
                })
                channel_issues.append(("母带", ver_msg))

            empty_fields = check_empty_values(stage_rec or {}, check_rec)
            for field in empty_fields:
                results["issues_by_category"]["empty_values"].append({
                    "channel": channel,
                    "field": field,
                    "track": check_rec["track_name"],
                    "reason": f"{field} 为空",
                })
                channel_issues.append(("空值", f"{field} 为空"))

            if check_rec["manual_rename"]:
                results["issues_by_category"]["manual_rename"].append({
                    "channel": channel,
                    "track": check_rec["track_name"],
                    "stage_file": os.path.basename(stage_rec.get("file_path", "")) if stage_rec else "",
                    "check_file": check_rec["file_name"],
                    "annotation": check_rec["annotation"],
                })
                channel_issues.append(("改名", f"人工改名: {check_rec['file_name']}"))

        if stage_rec and check_rec_list:
            conflicts = detect_conflicts(stage_rec, check_rec_list)
            for conflict in conflicts:
                results["issues_by_category"]["conflicts"].append({
                    "channel": channel,
                    "track": stage_rec.get("track_name", "未知"),
                    **conflict,
                })
                channel_issues.append(("冲突", conflict["evidence"]))

            for check_rec in check_rec_list:
                tc_issues = check_timecode_alignment(stage_rec, check_rec)
                for issue in tc_issues:
                    results["issues_by_category"]["timecode_misalignment"].append({
                        "channel": channel,
                        "track": stage_rec.get("track_name", "未知"),
                        "file": check_rec["file_name"],
                        "reason": issue,
                        "stage_tc": f"{stage_rec['tc_in']} - {stage_rec['tc_out']}",
                        "check_tc": f"{check_rec['tc_in']} - {check_rec['tc_out']}",
                    })

        for track, channels in duplicate_tracks.items():
            if channel in channels:
                other_channels = [c for c in channels if c != channel]
                results["issues_by_category"]["duplicate_tracks"].append({
                    "channel": channel,
                    "track": track,
                    "duplicate_with": ", ".join(other_channels),
                    "reason": f"曲目「{track}」在多个通道出现: {', '.join(channels)}",
                })

        results["channel_details"][channel] = {
            "stage": stage_rec,
            "checks": check_rec_list,
            "issues": channel_issues,
            "annotation": " | ".join([c["annotation"] for c in check_rec_list if c["annotation"]]),
            "processed": channel in state["processed_channels"],
            "user_notes": state["notes"].get(channel, ""),
        }

    results["summary"]["expired_auth_count"] = len(results["issues_by_category"]["expired_auth"])
    results["summary"]["timecode_misalignment_count"] = len(results["issues_by_category"]["timecode_misalignment"])
    results["summary"]["duplicate_tracks_count"] = len(set([i["track"] for i in results["issues_by_category"]["duplicate_tracks"]]))
    results["summary"]["old_master_count"] = len(results["issues_by_category"]["old_master"])
    results["summary"]["missing_auth_count"] = len(results["issues_by_category"]["missing_auth"])
    results["summary"]["empty_values_count"] = len(results["issues_by_category"]["empty_values"])
    results["summary"]["manual_rename_count"] = len(results["issues_by_category"]["manual_rename"])
    results["summary"]["conflicts_count"] = len(results["issues_by_category"]["conflicts"])

    return results, state


def generate_report(results, state):
    """生成交接清单报告"""
    lines = []
    lines.append("# 耳返通道换场检查 - 交接清单")
    lines.append("")
    lines.append(f"> 检查日期：{TODAY.isoformat()}")
    lines.append(f"> 交接对象：厂牌运营 小孟")
    lines.append(f"> 总通道数：{results['summary']['total_channels']}")
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
        status = "✅ 正常" if not detail["issues"] else "⚠️ 待处理"
        processed_mark = " (已处理)" if detail["processed"] else ""
        lines.append(f"### 通道 {channel} - {stage.get('track_name', '未知曲目') if stage else '未知曲目'} {status}{processed_mark}")
        lines.append("")

        if stage:
            lines.append("**舞台通道表信息：**")
            lines.append(f"- 曲目：{stage['track_name'] or '(空)'}")
            lines.append(f"- 文件：{stage['file_path'] or '(空)'}")
            lines.append(f"- 母带版本：{stage['master_version'] or '(空)'}")
            lines.append(f"- 艺人：{stage['artist'] or '(空)'}")
            lines.append(f"- 时码：{stage['tc_in']} - {stage['tc_out']}")
            lines.append(f"- 舞台区域：{stage['stage_area'] or '(空)'}")
            lines.append(f"- 合同：{stage['contract_no'] or '(空)'}")
            auth_info = f"{stage['auth_start'].isoformat()} 至 {stage['auth_end'].isoformat()}" if stage['auth_start'] and stage['auth_end'] else stage['auth_note'] or '无'
            lines.append(f"- 授权期限：{auth_info}")
            lines.append(f"- 合同备注：{stage['contract_remark'] or '(空)'}")
            lines.append(f"- 负责人：{stage['owner'] or '(空)'}")
            lines.append("")

        if checks:
            lines.append("**耳返通道检查记录：**")
            for i, check in enumerate(checks, 1):
                lines.append(f"- 记录 {i}：")
                lines.append(f"  - 文件名：{check['file_name']}")
                lines.append(f"  - 曲目：{check['track_name']}")
                lines.append(f"  - 版本标记：{check['version_tag']}")
                lines.append(f"  - 时码：{check['tc_in']} - {check['tc_out']}")
                lines.append(f"  - 文件时长：{check['duration']}")
                lines.append(f"  - 批注：{check['annotation'] or '(无)'}")
                lines.append(f"  - 导入来源：{check['import_source']}")
                if check['manual_rename']:
                    lines.append(f"  - ⚠️ 人工改名标记：是")
            lines.append("")

        if detail["issues"]:
            lines.append("**问题列表：**")
            for level, msg in detail["issues"]:
                lines.append(f"- [{level}] {msg}")
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
    lines.append("")
    lines.append("---")
    lines.append(f"*本清单由脚本自动生成，最后更新：{TODAY.isoformat()}*")

    report = "\n".join(lines)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    return report


def mark_processed(channel, note=""):
    """标记通道为已处理"""
    state = load_state()
    if channel not in state["processed_channels"]:
        state["processed_channels"].append(channel)
    if note:
        state["notes"][channel] = note
    save_state(state)
    print(f"✅ 通道 {channel} 已标记为已处理")
    if note:
        print(f"   备注：{note}")


def print_console_summary(results):
    """控制台输出摘要"""
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
    print("增量处理命令:")
    print("  标记已处理: python ear_return_check.py --mark CH-002 --note \"已续签\"")
    print("  重新运行:   python ear_return_check.py")
    print("")


def main():
    parser = argparse.ArgumentParser(description="耳返通道换场检查")
    parser.add_argument("--mark", help="标记通道为已处理")
    parser.add_argument("--note", help="处理备注", default="")
    args = parser.parse_args()

    if args.mark:
        mark_processed(args.mark, args.note)
        return

    results, state = analyze_data()
    generate_report(results, state)
    print_console_summary(results)


if __name__ == "__main__":
    main()
