import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional


HISTORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "history")


def _ensure_dir():
    os.makedirs(HISTORY_DIR, exist_ok=True)


def save_session(
    action: str,
    params: Optional[Dict[str, Any]] = None,
    result: Optional[Dict[str, Any]] = None,
    issues: Optional[List[Dict[str, Any]]] = None,
    corrections: Optional[List[str]] = None,
    notes: str = "",
) -> str:
    _ensure_dir()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{ts}_{action}.json"
    filepath = os.path.join(HISTORY_DIR, filename)

    record = {
        "timestamp": datetime.now().isoformat(),
        "action": action,
        "params": params,
        "result": result,
        "validation_issues": issues,
        "corrections": corrections,
        "notes": notes,
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)

    return filepath


def list_sessions(limit: int = 20) -> List[Dict[str, Any]]:
    _ensure_dir()
    files = sorted(
        [f for f in os.listdir(HISTORY_DIR) if f.endswith(".json")],
        reverse=True,
    )[:limit]

    sessions = []
    for fname in files:
        filepath = os.path.join(HISTORY_DIR, fname)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            data["_file"] = fname
            sessions.append(data)
        except Exception:
            sessions.append({"_file": fname, "error": "读取失败"})

    return sessions


def get_session(filename: str) -> Optional[Dict[str, Any]]:
    filepath = os.path.join(HISTORY_DIR, filename)
    if not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def format_session_summary(sessions: List[Dict[str, Any]]) -> str:
    if not sessions:
        return "暂无历史记录"

    lines = ["历史记录", "=" * 60]
    for s in sessions:
        ts = s.get("timestamp", "?")
        action = s.get("action", "?")
        notes = s.get("notes", "")
        fname = s.get("_file", "?")

        if "error" in s:
            lines.append(f"  {fname} [读取失败]")
            continue

        hit_info = ""
        r = s.get("result")
        if r and "hit" in r:
            hit_info = " ✓命中" if r["hit"] else " ✗未命中"

        corrections_count = len(s.get("corrections") or [])
        issues_count = len(s.get("validation_issues") or [])
        extra = ""
        if issues_count:
            extra += f" [{issues_count}条校验]"
        if corrections_count:
            extra += f" [{corrections_count}条修正]"

        lines.append(f"  {ts} | {action}{hit_info}{extra}")
        if notes:
            lines.append(f"    备注: {notes}")
        lines.append(f"    文件: {fname}")

    lines.append("=" * 60)
    return "\n".join(lines)


def format_session_detail(session: Dict[str, Any]) -> str:
    lines = ["历史记录详情", "=" * 60]
    lines.append(f"  时间   : {session.get('timestamp', '?')}")
    lines.append(f"  操作   : {session.get('action', '?')}")
    lines.append(f"  备注   : {session.get('notes', '')}")

    params = session.get("params")
    if params:
        lines.append("-" * 40)
        lines.append("  输入参数:")
        for k, v in params.items():
            if not k.startswith("_"):
                lines.append(f"    {k}: {v}")

    issues = session.get("validation_issues")
    if issues:
        lines.append("-" * 40)
        lines.append("  校验问题:")
        for issue in issues:
            icon = "✗" if issue.get("severity") == "error" else "⚠"
            lines.append(f"    {icon} {issue.get('field_name')}: {issue.get('explanation')}")

    corrections = session.get("corrections")
    if corrections:
        lines.append("-" * 40)
        lines.append("  修正记录:")
        for c in corrections:
            lines.append(f"    → {c}")

    result = session.get("result")
    if result:
        lines.append("-" * 40)
        lines.append("  计算结果:")
        for k, v in result.items():
            lines.append(f"    {k}: {v}")

    lines.append("=" * 60)
    return "\n".join(lines)
