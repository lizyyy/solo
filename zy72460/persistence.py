import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

from models import ReviewSession


DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
EXPORT_DIR = os.path.join(DATA_DIR, "exports")
HISTORY_DIR = os.path.join(DATA_DIR, "history")


def _ensure_dirs():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    os.makedirs(HISTORY_DIR, exist_ok=True)


def save_session(session: ReviewSession) -> str:
    _ensure_dirs()
    file_path = os.path.join(HISTORY_DIR, f"{session.session_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
    return file_path


def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    file_path = os.path.join(HISTORY_DIR, f"{session_id}.json")
    if not os.path.exists(file_path):
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_saved_sessions() -> List[Dict[str, Any]]:
    _ensure_dirs()
    sessions = []
    for fname in sorted(os.listdir(HISTORY_DIR)):
        if not fname.endswith(".json"):
            continue
        file_path = os.path.join(HISTORY_DIR, fname)
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        sessions.append({
            "session_id": data.get("session_id"),
            "task_name": data.get("task_name"),
            "created_at": data.get("created_at"),
            "current_step": data.get("current_step"),
            "record_count": len(data.get("records", [])),
            "conflict_count": len(data.get("conflicts", [])),
            "export_count": len(data.get("export_history", [])),
            "audit_count": len(data.get("audit_log", [])),
        })
    return sessions


def write_map_export_file(
    session: ReviewSession,
    export_data: Dict[str, Any],
    export_id: str,
) -> str:
    _ensure_dirs()
    session_export_dir = os.path.join(EXPORT_DIR, session.session_id)
    os.makedirs(session_export_dir, exist_ok=True)

    json_path = os.path.join(session_export_dir, f"map_export_{export_id}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)

    txt_path = os.path.join(session_export_dir, f"map_export_{export_id}.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(_generate_text_map(session, export_data))

    return json_path


def _generate_text_map(session: ReviewSession, export_data: Dict[str, Any]) -> str:
    lines = []
    lines.append(f"{'=' * 60}")
    lines.append(f"  雨水花园积水复核 - 地图导出")
    lines.append(f"  导出ID: {export_data['export_id']}")
    lines.append(f"  导出时间: {export_data['export_time']}")
    lines.append(f"  导出人: {export_data['exported_by']}")
    lines.append(f"  文件哈希: {export_data['file_hash']}")
    lines.append(f"{'=' * 60}")
    lines.append("")

    lines.append(f"点位总数: {export_data['point_count']}")
    lines.append("")

    lines.append("--- 点位详情 ---")
    for pid, point_data in export_data.get("points_detail", {}).items():
        boundary_tag = " [边界]" if point_data.get("is_boundary") else ""
        lines.append(f"  {pid}: {point_data['name']}{boundary_tag}")
        lines.append(f"    位置: {point_data['street']} ({point_data['lat']}, {point_data['lng']})")
        if point_data.get("adjacent_streets"):
            lines.append(f"    毗邻: {', '.join(point_data['adjacent_streets'])}")
    lines.append("")

    lines.append("--- 边界点位 ---")
    bp = export_data.get("boundary_points", [])
    if bp:
        for p in bp:
            lines.append(f"  {p}")
    else:
        lines.append("  无")
    lines.append("")

    lines.append("--- 待处理冲突点位 ---")
    cp = export_data.get("conflict_points", [])
    if cp:
        for p in cp:
            lines.append(f"  {p}")
    else:
        lines.append("  无")
    lines.append("")

    lines.append("--- 记录快照 ---")
    for rec in export_data.get("records_snapshot", []):
        supp_tag = " [补录]" if rec.get("is_supplementary") else ""
        lines.append(
            f"  {rec['record_id']} | {rec['point_id']} | {rec['source']}{supp_tag} | "
            f"{rec['inspector']} | 积水={rec['has_waterlogging']} 坡道={rec['ramp_accessible']}"
        )
    lines.append("")

    lines.append("--- 冲突快照 ---")
    for conf in export_data.get("conflicts_snapshot", []):
        lines.append(
            f"  {conf['conflict_id']} | {conf['point_id']} | {conf['field_name']} | "
            f"坡道={conf['ramp_record_value']} 夜间={conf['night_sampling_value']} | "
            f"状态={conf['resolution']}"
        )
    lines.append("")

    lines.append("--- 审计日志 ---")
    for audit in export_data.get("audit_snapshot", []):
        lines.append(f"  [{audit['timestamp']}] {audit['action_type']} | {audit['actor']} | {audit['description']}")
        if audit.get("before_state"):
            lines.append(f"    改前: {json.dumps(audit['before_state'], ensure_ascii=False)}")
        if audit.get("after_state"):
            lines.append(f"    改后: {json.dumps(audit['after_state'], ensure_ascii=False)}")
    lines.append("")
    lines.append(f"{'=' * 60}")

    return "\n".join(lines)


def write_handover_report(session: ReviewSession, report: Dict[str, Any]) -> str:
    _ensure_dirs()
    session_export_dir = os.path.join(EXPORT_DIR, session.session_id)
    os.makedirs(session_export_dir, exist_ok=True)

    file_path = os.path.join(session_export_dir, "handover_report.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return file_path


def write_handover_report_text(session: ReviewSession, report: Dict[str, Any]) -> str:
    _ensure_dirs()
    session_export_dir = os.path.join(EXPORT_DIR, session.session_id)
    os.makedirs(session_export_dir, exist_ok=True)

    file_path = os.path.join(session_export_dir, "handover_report.txt")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(_format_handover_text(report))
    return file_path


def _format_handover_text(report: Dict[str, Any]) -> str:
    lines = []
    lines.append(f"{'=' * 60}")
    lines.append(f"  {report['task_name']} - 交接报告")
    lines.append(f"  会话ID: {report['session_id']}")
    lines.append(f"  当前步骤: {report['current_step']}")
    lines.append(f"{'=' * 60}")
    lines.append("")

    s = report.get("summary", {})
    lines.append("--- 摘要 ---")
    lines.append(f"  总点位: {s.get('total_points', 0)}")
    lines.append(f"  总记录: {s.get('total_records', 0)}")
    lines.append(f"  待处理冲突: {s.get('pending_conflicts', 0)}")
    lines.append(f"  边界点位: {s.get('boundary_points', 0)}")
    lines.append(f"  导出次数: {s.get('export_count', 0)}")
    lines.append("")

    ai = report.get("action_items", {})
    lines.append("--- 待处理事项 ---")
    for action in ai.get("inspector_actions", []):
        lines.append(f"  [巡检员] {action}")
    for action in ai.get("manager_actions", []):
        lines.append(f"  [项目经理] {action}")
    lines.append("")

    lines.append("--- 冲突详情 ---")
    for cd in report.get("conflict_details", []):
        lines.append(f"  冲突ID: {cd['conflict_id']}")
        lines.append(f"  点位: {cd['point_info']['name']} ({cd['point_info']['point_id']})")
        lines.append(f"  字段: {cd['conflict_field']}")
        for ev in cd.get("evidence", []):
            lines.append(f"    [{ev['source']}] {ev['inspector']}: {ev['value']}")
            if ev.get("ramp_note"):
                lines.append(f"      备注: {ev['ramp_note']}")
            if ev.get("remarks"):
                lines.append(f"      备注: {ev['remarks']}")
        lines.append(f"  处理状态: {cd['resolution']}")
        lines.append("")

    lines.append("--- 审计追溯 ---")
    for trace in report.get("audit_traces", []):
        lines.append(f"  [{trace['audit_id']}] {trace['action_type']} | {trace['actor']} | {trace['description']}")
        if trace.get("before_state"):
            lines.append(f"    改前: {json.dumps(trace['before_state'], ensure_ascii=False)}")
        if trace.get("after_state"):
            lines.append(f"    改后: {json.dumps(trace['after_state'], ensure_ascii=False)}")
        lines.append("")

    lines.append(f"{'=' * 60}")
    return "\n".join(lines)
