"""数据存储管理"""
import os
import json
import yaml
import pandas as pd
from typing import List, Optional
from .models import (
    RecallCandidate, ParamsConfig, AuditRecord, AnomalySample,
    generate_id, current_timestamp
)


class DataStore:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.candidates_dir = os.path.join(data_dir, "candidates")
        self.anomalies_dir = os.path.join(data_dir, "anomalies")
        self.audit_dir = os.path.join(data_dir, "audit")
        self.params_path = os.path.join(data_dir, "params.yaml")
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.candidates_dir, self.anomalies_dir, self.audit_dir]:
            os.makedirs(d, exist_ok=True)

    def save_candidates(self, candidates: List[RecallCandidate], source_name: str = "latest"):
        path = os.path.join(self.candidates_dir, f"{source_name}.json")
        data = [c.__dict__ for c in candidates]
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_candidates(self, source_name: str = "latest") -> List[RecallCandidate]:
        path = os.path.join(self.candidates_dir, f"{source_name}.json")
        if not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [RecallCandidate(**item) for item in data]

    def save_params(self, params: ParamsConfig):
        data = {
            "version": params.version,
            "time_window_size_hours": params.time_window_size_hours,
            "min_impression_threshold": params.min_impression_threshold,
            "ctr_significance_threshold": params.ctr_significance_threshold,
            "cost_ceiling": params.cost_ceiling,
            "budget_allocation": params.budget_allocation,
            "anomaly_detection_rules": params.anomaly_detection_rules,
            "owner": params.owner
        }
        with open(self.params_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, default_flow_style=False)

    def load_params(self) -> Optional[ParamsConfig]:
        if not os.path.exists(self.params_path):
            return None
        with open(self.params_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return ParamsConfig(**data)

    def save_anomaly(self, anomaly: AnomalySample):
        path = os.path.join(self.anomalies_dir, f"{anomaly.sample_id}.json")
        data = anomaly.__dict__.copy()
        if data.get("candidate") and hasattr(data["candidate"], "__dict__"):
            data["candidate"] = data["candidate"].__dict__
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_anomalies(self) -> List[AnomalySample]:
        anomalies = []
        for fname in os.listdir(self.anomalies_dir):
            if fname.endswith(".json"):
                path = os.path.join(self.anomalies_dir, fname)
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("candidate"):
                    data["candidate"] = RecallCandidate(**data["candidate"])
                anomalies.append(AnomalySample(**data))
        return anomalies

    def load_anomaly(self, sample_id: str) -> Optional[AnomalySample]:
        path = os.path.join(self.anomalies_dir, f"{sample_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("candidate"):
            data["candidate"] = RecallCandidate(**data["candidate"])
        return AnomalySample(**data)

    def add_audit_record(self, record: AuditRecord):
        path = os.path.join(self.audit_dir, f"{record.record_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(record.__dict__, f, ensure_ascii=False, indent=2)

    def load_audit_records(self) -> List[AuditRecord]:
        records = []
        for fname in sorted(os.listdir(self.audit_dir)):
            if fname.endswith(".json"):
                path = os.path.join(self.audit_dir, fname)
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                records.append(AuditRecord(**data))
        return records

    def import_candidates_from_csv(self, csv_path: str) -> List[RecallCandidate]:
        df = pd.read_csv(csv_path)
        candidates = []
        for _, row in df.iterrows():
            metrics = {}
            for col in df.columns:
                if col not in ["candidate_id", "strategy_name", "arm_id", "impression",
                               "click", "ctr", "cost", "budget_utilization",
                               "time_window_start", "time_window_end"]:
                    metrics[col] = row[col]
            candidate = RecallCandidate(
                candidate_id=str(row.get("candidate_id", generate_id("cand_"))),
                strategy_name=str(row.get("strategy_name", "unknown")),
                arm_id=str(row.get("arm_id", "unknown")),
                impression=int(row.get("impression", 0)),
                click=int(row.get("click", 0)),
                ctr=float(row.get("ctr", 0.0)),
                cost=float(row.get("cost", 0.0)),
                budget_utilization=float(row.get("budget_utilization", 0.0)),
                time_window_start=str(row.get("time_window_start", "")),
                time_window_end=str(row.get("time_window_end", "")),
                metrics=metrics
            )
            candidates.append(candidate)
        return candidates
