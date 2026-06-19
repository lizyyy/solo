"""解析“现场材料包”，把三类来源分开读入并标注归属。

包目录约定（见 samples/batch_2026_06/manifest.json）：
  normal_record/records.jsonl   正式记录
  student_draft_old/drafts.jsonl 学生草稿旧版
  verbal_notes/notes.jsonl      口头备注

任意一类缺失不算错：现场收到的包不一定三类齐全。
"""

import json
import os
from typing import Dict, List, Optional, Tuple

from .models import QuestionBundle, RawRecord, SourceType, VerbalNote

MANIFEST = "manifest.json"
NORMAL_DIR = "normal_record"
NORMAL_FILE = "records.jsonl"
DRAFT_DIR = "student_draft_old"
DRAFT_FILE = "drafts.jsonl"
NOTES_DIR = "verbal_notes"
NOTES_FILE = "notes.jsonl"


def _read_jsonl(path: str) -> List[dict]:
    if not os.path.isfile(path):
        return []
    out: List[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for lineno, raw in enumerate(f, 1):
            line = raw.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{lineno} JSON 解析失败: {e}") from e
    return out


def _to_float_pair(point) -> Tuple[float, float]:
    if not isinstance(point, (list, tuple)) or len(point) != 2:
        raise ValueError(f"数据点格式应为 [x, y]，实际: {point!r}")
    return float(point[0]), float(point[1])


def _parse_record(obj: dict, source: SourceType, file_origin: str) -> RawRecord:
    qid = obj.get("question_id")
    if not qid:
        raise ValueError(f"{file_origin} 缺少 question_id: {obj!r}")
    points_raw = obj.get("points", [])
    points = [list(_to_float_pair(p)) for p in points_raw]
    return RawRecord(
        question_id=str(qid),
        title=str(obj.get("title", "")),
        model=str(obj.get("model", "") or ""),
        x_unit=str(obj.get("x_unit", "") or ""),
        y_unit=str(obj.get("y_unit", "") or ""),
        points=points,
        threshold=dict(obj.get("threshold", {}) or {}),
        source=source,
        source_meta=dict(obj.get("source_meta", {}) or {}),
        file_origin=file_origin,
    )


def _parse_note(obj: dict, file_origin: str) -> VerbalNote:
    qid = obj.get("question_id")
    if not qid:
        raise ValueError(f"{file_origin} 缺少 question_id: {obj!r}")
    return VerbalNote(
        question_id=str(qid),
        note=str(obj.get("note", "")),
        source=SourceType.VERBAL_NOTE,
        source_meta=dict(obj.get("source_meta", {}) or {}),
        file_origin=file_origin,
    )


def load_batch(batch_dir: str) -> Tuple[List[RawRecord], List[VerbalNote], dict]:
    """读入整包材料，返回 (拟合记录, 口头备注, manifest)。"""
    if not os.path.isdir(batch_dir):
        raise FileNotFoundError(f"材料包目录不存在: {batch_dir}")

    manifest_path = os.path.join(batch_dir, MANIFEST)
    manifest: dict = {}
    if os.path.isfile(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    records: List[RawRecord] = []

    normal_path = os.path.join(batch_dir, NORMAL_DIR, NORMAL_FILE)
    for obj in _read_jsonl(normal_path):
        records.append(_parse_record(obj, SourceType.NORMAL_RECORD, normal_path))

    draft_path = os.path.join(batch_dir, DRAFT_DIR, DRAFT_FILE)
    for obj in _read_jsonl(draft_path):
        records.append(_parse_record(obj, SourceType.STUDENT_DRAFT_OLD, draft_path))

    notes_path = os.path.join(batch_dir, NOTES_DIR, NOTES_FILE)
    notes: List[VerbalNote] = [_parse_note(obj, notes_path) for obj in _read_jsonl(notes_path)]

    return records, notes, manifest


def group_by_question(
    records: List[RawRecord], notes: List[VerbalNote]
) -> List[QuestionBundle]:
    """按 question_id 聚合，保持正式记录在前。"""
    bundles: Dict[str, QuestionBundle] = {}
    for r in records:
        bundles.setdefault(r.question_id, QuestionBundle(question_id=r.question_id)).records.append(r)
    for n in notes:
        bundles.setdefault(n.question_id, QuestionBundle(question_id=n.question_id)).notes.append(n)
    for b in bundles.values():
        b.records.sort(key=lambda r: -{
            SourceType.NORMAL_RECORD: 3,
            SourceType.STUDENT_DRAFT_OLD: 2,
        }.get(r.source, 0))
    return sorted(bundles.values(), key=lambda b: b.question_id)


def batch_id_from(manifest: dict, batch_dir: str) -> str:
    if manifest.get("batch_id"):
        return str(manifest["batch_id"])
    return os.path.basename(os.path.normpath(batch_dir)) or "batch"


def received_from(manifest: dict) -> str:
    return str(manifest.get("received", ""))
