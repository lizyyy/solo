from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


@dataclass
class AlignedRecord:
    id: str
    sample: Optional[Dict[str, Any]] = None
    model_output: Optional[Dict[str, Any]] = None
    manual_correction: Optional[Dict[str, Any]] = None
    online_feedback: Optional[Dict[str, Any]] = None
    data_sources_present: List[str] = field(default_factory=list)
    data_sources_missing: List[str] = field(default_factory=list)
    alignment_notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        result = {"id": self.id}
        if self.sample:
            for k, v in self.sample.items():
                if k != "id":
                    result[f"sample_{k}"] = v
        if self.model_output:
            for k, v in self.model_output.items():
                if k != "id":
                    result[f"model_{k}"] = v
        if self.manual_correction:
            for k, v in self.manual_correction.items():
                if k != "id":
                    result[f"manual_{k}"] = v
        if self.online_feedback:
            for k, v in self.online_feedback.items():
                if k != "id":
                    result[f"online_{k}"] = v
        result["data_sources_present"] = self.data_sources_present
        result["data_sources_missing"] = self.data_sources_missing
        result["alignment_notes"] = self.alignment_notes
        return result


@dataclass
class AlignmentResult:
    records: Dict[str, AlignedRecord] = field(default_factory=dict)
    total_ids: int = 0
    fully_aligned: int = 0
    partial_aligned: int = 0
    orphan_sources: Dict[str, List[str]] = field(default_factory=dict)
    conflicts: List[Dict[str, Any]] = field(default_factory=list)

    def summary(self) -> str:
        lines = ["[数据对齐结果]"]
        lines.append(f"  总ID数: {self.total_ids}")
        lines.append(f"  完全对齐(4源齐全): {self.fully_aligned}")
        lines.append(f"  部分对齐: {self.partial_aligned}")
        if self.orphan_sources:
            lines.append(f"  孤立数据源(仅存在于单一源):")
            for src, ids in self.orphan_sources.items():
                lines.append(f"    {src}: {ids}")
        if self.conflicts:
            lines.append(f"  字段冲突数: {len(self.conflicts)}")
            for c in self.conflicts:
                lines.append(f"    ID={c['id']}, 字段={c['field']}, model={c.get('model_value')}, manual={c.get('manual_value')}, 证据={c['evidence']}")
        return "\n".join(lines)


SOURCE_KEYS = ["sample", "model_output", "manual_correction", "online_feedback"]


class DataAligner:
    def __init__(self, id_field: str = "id"):
        self.id_field = id_field

    def align(self, loaded_data: Dict[str, Any]) -> AlignmentResult:
        result = AlignmentResult()
        all_ids = set()

        deduped = {}
        for source_name, data in loaded_data.items():
            deduped[source_name] = {}
            for rec in data.records:
                rid = rec.get(self.id_field)
                if rid is None:
                    continue
                rid_str = str(rid)
                deduped[source_name][rid_str] = rec
                all_ids.add(rid_str)

        result.total_ids = len(all_ids)

        source_map = {
            "sample": "sample",
            "model_output": "model_output",
            "manual_correction": "manual_correction",
            "online_feedback": "online_feedback",
        }

        for rid in sorted(all_ids):
            aligned = AlignedRecord(id=rid)
            present = []
            missing = []
            notes = []

            for src_key, attr_name in source_map.items():
                if src_key in deduped and rid in deduped[src_key]:
                    setattr(aligned, attr_name, deduped[src_key][rid])
                    present.append(src_key)
                else:
                    missing.append(src_key)
                    notes.append(f"ID={rid} 缺少 {src_key} 数据")

            aligned.data_sources_present = present
            aligned.data_sources_missing = missing
            aligned.alignment_notes = notes
            result.records[rid] = aligned

            if len(present) == 4:
                result.fully_aligned += 1
            else:
                result.partial_aligned += 1

        for src_key in source_map:
            src_ids = set(deduped.get(src_key, {}).keys())
            other_ids = all_ids - src_ids
            orphan = [rid for rid in src_ids if rid not in all_ids - (src_ids - set())]
            only_in_src = src_ids - set().union(
                *[set(deduped.get(k, {}).keys()) for k in source_map if k != src_key]
            )
            if only_in_src:
                result.orphan_sources[src_key] = sorted(only_in_src)

        for rid, aligned in result.records.items():
            if aligned.model_output and aligned.manual_correction:
                model_score = aligned.model_output.get("score")
                manual_score = aligned.manual_correction.get("score")
                if model_score is not None and manual_score is not None:
                    try:
                        diff = abs(float(model_score) - float(manual_score))
                        if diff > 0.5:
                            result.conflicts.append({
                                "id": rid,
                                "field": "score",
                                "model_value": model_score,
                                "manual_value": manual_score,
                                "diff": diff,
                                "evidence": f"ID={rid}, model_score={model_score}, manual_score={manual_score}, diff={diff:.3f} > 0.5"
                            })
                            aligned.alignment_notes.append(
                                f"分数差异大: model={model_score} vs manual={manual_score}, diff={diff:.3f}"
                            )
                    except (ValueError, TypeError):
                        pass

        return result

    def to_records_list(self, alignment_result: AlignmentResult) -> List[Dict[str, Any]]:
        return [rec.to_dict() for rec in alignment_result.records.values()]
