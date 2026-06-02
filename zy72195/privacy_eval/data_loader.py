import json
import csv
import yaml
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Set

from .models import (
    ModelOutput, Annotation, ThresholdConfig, ConflictCase,
    Evidence, SensitiveType, DesensitizationLevel, ErrorType
)


class DataLoader:
    def __init__(self, base_dir: str = "samples"):
        self.base_dir = Path(base_dir)

    def load_model_outputs(self, model_version: str, dedup: bool = True) -> Tuple[List[ModelOutput], Dict[str, int]]:
        model_dir = self.base_dir / "model_logs" / model_version
        if not model_dir.exists():
            raise FileNotFoundError(f"模型版本目录不存在: {model_dir}")

        outputs: List[ModelOutput] = []
        seen_ids: Set[str] = set()
        dup_count: Dict[str, int] = {}

        for jsonl_file in sorted(model_dir.glob("*.jsonl")):
            with open(jsonl_file, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        record_id = data.get("record_id", "")

                        if dedup and record_id in seen_ids:
                            dup_count[record_id] = dup_count.get(record_id, 1) + 1
                            continue

                        if record_id:
                            seen_ids.add(record_id)

                        ts = data.get("timestamp")
                        timestamp = datetime.fromisoformat(ts) if ts else None

                        detected = []
                        for ent in data.get("detected_entities", []):
                            ent_type = ent.get("type", "other")
                            try:
                                ent["type"] = SensitiveType(ent_type)
                            except ValueError:
                                ent["type"] = SensitiveType.OTHER
                            ent["level"] = DesensitizationLevel(ent.get("level", "not_masked"))
                            detected.append(ent)

                        output = ModelOutput(
                            record_id=record_id,
                            model_version=model_version,
                            original_text=data.get("original_text", ""),
                            masked_text=data.get("masked_text", ""),
                            detected_entities=detected,
                            timestamp=timestamp,
                            raw_log=f"{jsonl_file.name}#L{line_num}"
                        )
                        outputs.append(output)
                    except json.JSONDecodeError as e:
                        print(f"警告: 解析JSON失败 {jsonl_file}#L{line_num}: {e}")
                    except Exception as e:
                        print(f"警告: 加载记录失败 {jsonl_file}#L{line_num}: {e}")

        return outputs, dup_count

    def load_annotations(self, filename: str = "ground_truth.csv") -> List[Annotation]:
        ann_file = self.base_dir / "annotations" / filename
        if not ann_file.exists():
            raise FileNotFoundError(f"标注文件不存在: {ann_file}")

        annotations: List[Annotation] = []
        with open(ann_file, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, 2):
                try:
                    if not row.get("record_id") or not row.get("sensitive_type"):
                        print(f"警告: 标注数据不完整，跳过 {ann_file}#L{row_num}")
                        continue

                    ann = Annotation(
                        record_id=row["record_id"].strip(),
                        sensitive_type=SensitiveType(row["sensitive_type"].strip()),
                        start_pos=int(row.get("start_pos", 0)),
                        end_pos=int(row.get("end_pos", 0)),
                        original_value=row.get("original_value", ""),
                        expected_level=DesensitizationLevel(row.get("expected_level", "not_masked")),
                        comment=row.get("comment"),
                        source=row.get("source")
                    )
                    annotations.append(ann)
                except ValueError as e:
                    print(f"警告: 解析标注失败 {ann_file}#L{row_num}: {e}")

        return annotations

    def load_thresholds(self, filename: str = "default.yaml") -> Dict[SensitiveType, ThresholdConfig]:
        th_file = self.base_dir / "thresholds" / filename
        if not th_file.exists():
            raise FileNotFoundError(f"阈值文件不存在: {th_file}")

        with open(th_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        thresholds: Dict[SensitiveType, ThresholdConfig] = {}
        for item in data.get("thresholds", []):
            try:
                st = SensitiveType(item["sensitive_type"])
                thresholds[st] = ThresholdConfig(
                    sensitive_type=st,
                    precision_threshold=float(item.get("precision_threshold", 0.8)),
                    recall_threshold=float(item.get("recall_threshold", 0.8)),
                    f1_threshold=float(item.get("f1_threshold", 0.8)),
                    description=item.get("description")
                )
            except ValueError as e:
                print(f"警告: 解析阈值失败: {e}")

        return thresholds

    def load_conflicts(self, filename: str = "known_conflicts.json") -> List[ConflictCase]:
        cf_file = self.base_dir / "conflicts" / filename
        if not cf_file.exists():
            return []

        with open(cf_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        conflicts: List[ConflictCase] = []
        for item in data:
            try:
                evidences = []
                for ev in item.get("evidences", []):
                    evidences.append(Evidence(
                        source_type=ev["source_type"],
                        source_id=ev["source_id"],
                        field=ev["field"],
                        value=ev["value"],
                        link=ev.get("link")
                    ))

                conflict = ConflictCase(
                    record_id=item["record_id"],
                    conflict_type=ErrorType(item.get("conflict_type", "conflict")),
                    description=item.get("description", ""),
                    evidences=evidences,
                    resolved=item.get("resolved", False),
                    resolution_note=item.get("resolution_note")
                )
                conflicts.append(conflict)
            except ValueError as e:
                print(f"警告: 解析冲突案例失败: {e}")

        return conflicts

    def load_notes(self, filename: str = "additional_notes.json") -> Dict[str, List[Dict]]:
        notes_file = self.base_dir / "notes" / filename
        if not notes_file.exists():
            return {}

        with open(notes_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        notes_by_id: Dict[str, List[Dict]] = {}
        for item in data:
            rid = item.get("record_id")
            if rid:
                notes_by_id.setdefault(rid, []).append(item)

        return notes_by_id

    def save_conflicts(self, conflicts: List[ConflictCase], filename: str = "known_conflicts.json"):
        cf_file = self.base_dir / "conflicts" / filename
        cf_file.parent.mkdir(parents=True, exist_ok=True)

        data = []
        for cf in conflicts:
            evidences = []
            for ev in cf.evidences:
                evidences.append({
                    "source_type": ev.source_type,
                    "source_id": ev.source_id,
                    "field": ev.field,
                    "value": ev.value,
                    "link": ev.link
                })
            data.append({
                "record_id": cf.record_id,
                "conflict_type": cf.conflict_type.value,
                "description": cf.description,
                "evidences": evidences,
                "resolved": cf.resolved,
                "resolution_note": cf.resolution_note
            })

        with open(cf_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_note(self, record_id: str, note: str, added_by: str = "unknown",
                  filename: str = "additional_notes.json"):
        notes_file = self.base_dir / "notes" / filename
        notes_file.parent.mkdir(parents=True, exist_ok=True)

        existing = []
        if notes_file.exists():
            with open(notes_file, "r", encoding="utf-8") as f:
                existing = json.load(f)

        existing.append({
            "record_id": record_id,
            "note": note,
            "added_by": added_by,
            "timestamp": datetime.now().isoformat()
        })

        with open(notes_file, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
