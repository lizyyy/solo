import pandas as pd
import json
from datetime import datetime
from typing import List, Tuple, Optional
from .models import NegativeSample, RecallCandidate, DriftRecord, BucketDiff, Status, NextOwner


class DataImporter:
    @staticmethod
    def load_negative_samples_from_csv(file_path: str) -> List[dict]:
        df = pd.read_csv(file_path)
        required_cols = ["sample_id", "offline_score", "online_score"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"CSV缺少必填列: {missing}")

        samples_data = []
        for _, row in df.iterrows():
            features_cols = [c for c in df.columns if c not in required_cols + ["source"]]
            features = {c: row[c] for c in features_cols if pd.notna(row[c])}
            samples_data.append(
                {
                    "sample_id": str(row["sample_id"]),
                    "offline_score": float(row["offline_score"]),
                    "online_score": float(row["online_score"]),
                    "features": features,
                    "source": str(row.get("source", "")),
                }
            )
        return samples_data

    @staticmethod
    def load_negative_samples_from_json(file_path: str) -> List[dict]:
        with open(file_path, "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        return data.get("samples", [])

    @staticmethod
    def load_recall_candidates_from_csv(file_path: str) -> List[RecallCandidate]:
        df = pd.read_csv(file_path)
        required_cols = ["sample_id", "candidate_id", "rank", "score"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"CSV缺少必填列: {missing}")

        candidates = []
        for _, row in df.iterrows():
            candidates.append(
                RecallCandidate(
                    sample_id=str(row["sample_id"]),
                    candidate_id=str(row["candidate_id"]),
                    rank=int(row["rank"]),
                    score=float(row["score"]),
                    is_related=bool(row.get("is_related", False)),
                    reason=str(row.get("reason", "")),
                    supplemented_by=str(row.get("supplemented_by", "小乔")),
                    supplemented_at=datetime.now(),
                )
            )
        return candidates

    @staticmethod
    def supplement_recall_candidates(
        drift_records: List[DriftRecord],
        candidates: List[RecallCandidate],
    ) -> List[DriftRecord]:
        record_map = {r.sample_id: r for r in drift_records}

        for candidate in candidates:
            if candidate.sample_id in record_map:
                record = record_map[candidate.sample_id]
                record.recall_candidates.append(candidate)
                record.updated_at = datetime.now()

                if record.status == Status.PENDING_REVIEW:
                    record.status = Status.SUPPLEMENTED_BY_ALGO

                record.missing_materials = [
                    m for m in record.missing_materials if "召回候选" not in m
                ]
                if not record.missing_materials:
                    record.missing_materials = ["复核意见待评测运营填写"]
                record.next_owner = NextOwner.OPERATION

        return drift_records
