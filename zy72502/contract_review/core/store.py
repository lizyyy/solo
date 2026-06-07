import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from contract_review.models import (
    ContractSample, ExtractedClause, FeedbackTicket,
    DesensitizationRule, VersionComparisonReport, VersionComparisonItem,
    ModelVersionMetrics
)


class ReviewStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.samples: Dict[str, ContractSample] = {}
        self.tickets: Dict[str, FeedbackTicket] = {}
        self.rules: Dict[str, DesensitizationRule] = {}
        self.reports: Dict[str, VersionComparisonReport] = {}
        self._load_all()

    def _path(self, name: str) -> str:
        return os.path.join(self.data_dir, name)

    def _load_all(self):
        os.makedirs(self.data_dir, exist_ok=True)
        self._load_samples()
        self._load_tickets()
        self._load_rules()
        self._load_reports()

    def _load_samples(self):
        path = self._path("samples.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                clauses_data = item.pop("extracted_clauses", [])
                item.pop("is_masked_by_avg", None)
                item.pop("low_confidence_count", None)
                item.pop("clause_count", None)
                clauses = [ExtractedClause(**c) for c in clauses_data]
                sample = ContractSample(**item)
                sample.extracted_clauses = clauses
                self.samples[sample.sample_id] = sample

    def _load_tickets(self):
        path = self._path("tickets.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                ticket = FeedbackTicket(**item)
                self.tickets[ticket.ticket_id] = ticket

    def _load_rules(self):
        path = self._path("rules.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                rule = DesensitizationRule(**item)
                self.rules[rule.rule_id] = rule

    def _load_reports(self):
        path = self._path("reports.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                items_data = item.pop("items", [])
                v1_metrics_data = item.pop("v1_metrics", None)
                v2_metrics_data = item.pop("v2_metrics", None)
                report = VersionComparisonReport(**item)
                report.items = [VersionComparisonItem(**i) for i in items_data]
                if v1_metrics_data:
                    report.v1_metrics = ModelVersionMetrics(**v1_metrics_data)
                if v2_metrics_data:
                    report.v2_metrics = ModelVersionMetrics(**v2_metrics_data)
                self.reports[report.report_id] = report

    def save_samples(self):
        path = self._path("samples.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump([s.to_dict() for s in self.samples.values()], f, ensure_ascii=False, indent=2)

    def save_tickets(self):
        path = self._path("tickets.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump([t.to_dict() for t in self.tickets.values()], f, ensure_ascii=False, indent=2)

    def save_rules(self):
        path = self._path("rules.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self.rules.values()], f, ensure_ascii=False, indent=2)

    def save_reports(self):
        path = self._path("reports.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self.reports.values()], f, ensure_ascii=False, indent=2)

    def save_all(self):
        self.save_samples()
        self.save_tickets()
        self.save_rules()
        self.save_reports()

    def add_sample(self, sample: ContractSample) -> str:
        self.samples[sample.sample_id] = sample
        self.save_samples()
        return sample.sample_id

    def get_sample(self, sample_id: str) -> Optional[ContractSample]:
        return self.samples.get(sample_id)

    def get_samples_by_version(self, version: str) -> List[ContractSample]:
        return [s for s in self.samples.values() if s.model_version == version]

    def get_masked_samples(self) -> List[ContractSample]:
        return [s for s in self.samples.values() if s.is_masked_by_avg]

    def update_sample(self, sample_id: str, **kwargs) -> bool:
        if sample_id not in self.samples:
            return False
        sample = self.samples[sample_id]
        for key, value in kwargs.items():
            if hasattr(sample, key):
                setattr(sample, key, value)
        sample.updated_at = datetime.now().isoformat()
        self.save_samples()
        return True

    def add_ticket(self, ticket: FeedbackTicket) -> str:
        self.tickets[ticket.ticket_id] = ticket
        self.save_tickets()
        return ticket.ticket_id

    def get_tickets_by_sample(self, sample_id: str) -> List[FeedbackTicket]:
        return [t for t in self.tickets.values() if t.sample_id == sample_id]

    def add_rule(self, rule: DesensitizationRule) -> str:
        self.rules[rule.rule_id] = rule
        if rule.sample_id and rule.sample_id in self.samples:
            sample = self.samples[rule.sample_id]
            sample.desensitization_note = (sample.desensitization_note + "\n" if sample.desensitization_note else "") + f"[{rule.rule_id}] {rule.rule_type}: {rule.note}"
            sample.updated_at = datetime.now().isoformat()
        self.save_rules()
        self.save_samples()
        return rule.rule_id

    def get_rules_by_sample(self, sample_id: str) -> List[DesensitizationRule]:
        return [r for r in self.rules.values() if r.sample_id == sample_id]
