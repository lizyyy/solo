"""数据持久化模块 - 处理旧备注/截图说明的保留与合并."""

import json
import os
from typing import List, Dict, Optional
from .models import SamplingRecord


STATE_FILENAME = "report_state.json"


def load_previous_state(output_dir: str) -> Dict[str, dict]:
    """加载上次运行的状态数据.

    返回以 record_id 为键的字典，值为包含 notes、screenshot_note、status 等的 dict.
    """
    state_path = os.path.join(output_dir, STATE_FILENAME)
    if not os.path.exists(state_path):
        return {}

    try:
        with open(state_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get("records", {})
    except (json.JSONDecodeError, IOError):
        return {}


def merge_with_previous_state(records: List[SamplingRecord],
                              previous_state: Dict[str, dict]) -> List[SamplingRecord]:
    """将当前记录与旧状态合并，保留旧备注和截图说明.

    合并规则:
    - 旧备注 (notes) 保留，并追加新检测到的问题
    - 旧截图说明 (screenshot_note) 保留
    - 旧状态仅在记录无新问题时保留
    - 新检测到的经纬度问题追加到备注中
    """
    for record in records:
        prev = previous_state.get(record.record_id)
        if not prev:
            continue

        if prev.get("notes"):
            old_notes = prev["notes"]
            new_issues_note = _format_new_issues(record)
            if new_issues_note and new_issues_note not in old_notes:
                record.notes = old_notes + "\n" + new_issues_note if old_notes else new_issues_note
            else:
                record.notes = old_notes

        if prev.get("screenshot_note"):
            record.screenshot_note = prev["screenshot_note"]

        if record.coordinate_issues and not prev.get("notes"):
            record.notes = _format_new_issues(record)

    return records


def _format_new_issues(record: SamplingRecord) -> str:
    """格式化新检测到的问题为备注文本."""
    if not record.coordinate_issues:
        return ""

    lines = []
    for issue in record.coordinate_issues:
        lines.append(f"[{issue.issue_type}] 第{issue.source_line}行: {issue.description}")

    return "\n".join(lines)


def save_state(output_dir: str, records: List[SamplingRecord], metadata: Optional[dict] = None):
    """保存当前状态到输出目录."""
    os.makedirs(output_dir, exist_ok=True)
    state_path = os.path.join(output_dir, STATE_FILENAME)

    records_dict = {}
    for record in records:
        records_dict[record.record_id] = {
            "notes": record.notes,
            "screenshot_note": record.screenshot_note,
            "status": record.status.value if hasattr(record.status, 'value') else record.status,
            "source_file": record.source_file,
            "source_line": record.source_line,
        }

    state = {
        "version": "1.0",
        "records": records_dict,
        "metadata": metadata or {},
    }

    with open(state_path, 'w', encoding='utf-8') as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def export_raw_records(output_dir: str, records: List[SamplingRecord]):
    """导出保留原始来源的完整记录（JSON格式，便于追溯）.

    不修改原始数据，只追加问题标记和状态。
    """
    os.makedirs(output_dir, exist_ok=True)
    raw_path = os.path.join(output_dir, "raw_records_with_issues.json")

    data = []
    for record in records:
        data.append(record.to_dict())

    with open(raw_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
