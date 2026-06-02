import json
import csv
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
from .models import (
    Sample,
    ModelOutput,
    HumanCorrection,
    FeedbackRecord,
    MergedRecord,
    Entity,
    EntityType,
    MergeDecision,
    SourceInfo,
)


class DataLoader:
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir else Path.cwd() / "data"
        self.samples: Dict[str, Sample] = {}
        self.model_outputs: Dict[str, ModelOutput] = {}
        self.human_corrections: Dict[str, HumanCorrection] = {}
        self.feedback: Dict[str, List[FeedbackRecord]] = {}

    def _parse_datetime(self, value: Optional[str]) -> datetime:
        if not value:
            return datetime.now()
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return datetime.now()

    def _parse_enum(self, enum_cls, value: Optional[str], default=None):
        if not value:
            return default
        try:
            return enum_cls(value)
        except (ValueError, TypeError):
            return default

    def _parse_entity(self, data: Dict, prefix: str = "") -> Entity:
        entity_type = self._parse_enum(
            EntityType, data.get(f"{prefix}entity_type"), EntityType.UNKNOWN
        )
        return Entity(
            entity_id=data.get(f"{prefix}entity_id", ""),
            entity_type=entity_type,
            entity_value=data.get(f"{prefix}entity_value", ""),
            attributes=data.get(f"{prefix}attributes", {}) or {},
        )

    def load_samples(self, file_path: Optional[str] = None) -> Dict[str, Sample]:
        file_path = file_path or self.data_dir / "samples.json"
        if not Path(file_path).exists():
            return {}

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for item in data:
            sample = Sample(
                sample_id=item["sample_id"],
                entity_a=self._parse_entity(item, "entity_a_"),
                entity_b=self._parse_entity(item, "entity_b_"),
                ground_truth=self._parse_enum(
                    MergeDecision, item.get("ground_truth")
                ),
                created_at=self._parse_datetime(item.get("created_at")),
                tags=item.get("tags", []),
                is_boundary=item.get("is_boundary", False),
            )
            if item.get("source"):
                sample.source = SourceInfo(**item["source"])
            self.samples[sample.sample_id] = sample

        return self.samples

    def load_model_outputs(
        self, file_path: Optional[str] = None
    ) -> Dict[str, ModelOutput]:
        file_path = file_path or self.data_dir / "model_outputs.json"
        if not Path(file_path).exists():
            return {}

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for item in data:
            output = ModelOutput(
                sample_id=item["sample_id"],
                decision=self._parse_enum(MergeDecision, item["decision"]),
                confidence=item.get("confidence", 0.0),
                model_version=item.get("model_version", "unknown"),
                merge_reason=item.get("merge_reason"),
                predicted_cluster_id=item.get("predicted_cluster_id"),
                processed_at=self._parse_datetime(item.get("processed_at")),
                execution_time_ms=item.get("execution_time_ms"),
            )
            self.model_outputs[output.sample_id] = output

        return self.model_outputs

    def load_human_corrections(
        self, file_path: Optional[str] = None
    ) -> Dict[str, HumanCorrection]:
        file_path = file_path or self.data_dir / "human_corrections.json"
        if not Path(file_path).exists():
            return {}

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for item in data:
            correction = HumanCorrection(
                sample_id=item["sample_id"],
                original_decision=self._parse_enum(
                    MergeDecision, item["original_decision"]
                ),
                corrected_decision=self._parse_enum(
                    MergeDecision, item["corrected_decision"]
                ),
                correction_reason=item.get("correction_reason", ""),
                corrected_by=item.get("corrected_by", "unknown"),
                corrected_at=self._parse_datetime(item.get("corrected_at")),
                is_overridden=item.get("is_overridden", False),
                override_note=item.get("override_note"),
            )
            self.human_corrections[correction.sample_id] = correction

        return self.human_corrections

    def load_feedback(
        self, file_path: Optional[str] = None
    ) -> Dict[str, List[FeedbackRecord]]:
        file_path = file_path or self.data_dir / "feedback.json"
        if not Path(file_path).exists():
            return {}

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        for item in data:
            record = FeedbackRecord(
                sample_id=item["sample_id"],
                feedback_type=item.get("feedback_type", ""),
                feedback_content=item.get("feedback_content", ""),
                feedback_channel=item.get("feedback_channel", ""),
                feedback_by=item.get("feedback_by"),
                feedback_at=self._parse_datetime(item.get("feedback_at")),
                resolved=item.get("resolved", False),
                resolved_by=item.get("resolved_by"),
                resolved_at=self._parse_datetime(item.get("resolved_at")),
                resolution_note=item.get("resolution_note"),
            )
            if record.sample_id not in self.feedback:
                self.feedback[record.sample_id] = []
            self.feedback[record.sample_id].append(record)

        return self.feedback

    def load_all(
        self,
        samples_file: Optional[str] = None,
        model_file: Optional[str] = None,
        corrections_file: Optional[str] = None,
        feedback_file: Optional[str] = None,
    ) -> Dict[str, MergedRecord]:
        self.load_samples(samples_file)
        self.load_model_outputs(model_file)
        self.load_human_corrections(corrections_file)
        self.load_feedback(feedback_file)

        merged_records: Dict[str, MergedRecord] = {}
        for sample_id, sample in self.samples.items():
            record = MergedRecord(
                sample=sample,
                model_output=self.model_outputs.get(sample_id),
                human_correction=self.human_corrections.get(sample_id),
                feedback=self.feedback.get(sample_id, []),
            )
            if record.human_correction:
                record.final_decision = record.human_correction.corrected_decision
            elif record.model_output:
                record.final_decision = record.model_output.decision
            merged_records[sample_id] = record

        return merged_records

    def save_samples(self, samples: List[Sample], file_path: Optional[str] = None):
        file_path = file_path or self.data_dir / "samples.json"
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump([s.to_dict() for s in samples], f, indent=2, ensure_ascii=False)

    def save_model_outputs(
        self, outputs: List[ModelOutput], file_path: Optional[str] = None
    ):
        file_path = file_path or self.data_dir / "model_outputs.json"
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump([o.to_dict() for o in outputs], f, indent=2, ensure_ascii=False)

    def save_human_corrections(
        self, corrections: List[HumanCorrection], file_path: Optional[str] = None
    ):
        file_path = file_path or self.data_dir / "human_corrections.json"
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(
                [c.to_dict() for c in corrections], f, indent=2, ensure_ascii=False
            )

    def save_feedback(
        self, records: List[FeedbackRecord], file_path: Optional[str] = None
    ):
        file_path = file_path or self.data_dir / "feedback.json"
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(
                [r.to_dict() for r in records], f, indent=2, ensure_ascii=False
            )
