import json
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from contract_review.models import (
    ContractSample, ExtractedClause, FeedbackTicket,
    DesensitizationRule, VersionComparisonReport, VersionComparisonItem,
    ModelVersionMetrics, AuditLog
)


class ReviewStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.samples: Dict[str, ContractSample] = {}
        self.tickets: Dict[str, FeedbackTicket] = {}
        self.rules: Dict[str, DesensitizationRule] = {}
        self.reports: Dict[str, VersionComparisonReport] = {}
        self.audit_logs: Dict[str, AuditLog] = {}
        self._load_all()

    def _path(self, name: str) -> str:
        return os.path.join(self.data_dir, name)

    def _load_all(self):
        os.makedirs(self.data_dir, exist_ok=True)
        self._load_samples()
        self._load_tickets()
        self._load_rules()
        self._load_reports()
        self._load_audit_logs()

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

    def _load_audit_logs(self):
        path = self._path("audit_logs.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for item in data:
                log = AuditLog(**item)
                self.audit_logs[log.log_id] = log

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

    def save_audit_logs(self):
        path = self._path("audit_logs.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump([l.to_dict() for l in self.audit_logs.values()], f, ensure_ascii=False, indent=2)

    def save_all(self):
        self.save_samples()
        self.save_tickets()
        self.save_rules()
        self.save_reports()
        self.save_audit_logs()

    def add_audit_log(self, log: AuditLog) -> str:
        self.audit_logs[log.log_id] = log
        self.save_audit_logs()
        return log.log_id

    def get_audit_logs_by_sample(self, sample_id: str) -> List[AuditLog]:
        logs = [l for l in self.audit_logs.values() if l.sample_id == sample_id]
        logs.sort(key=lambda x: x.created_at, reverse=True)
        return logs

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

    def get_samples_by_contract_name(self, contract_name: str) -> List[ContractSample]:
        return [s for s in self.samples.values() if s.contract_name == contract_name]

    def update_sample(self, sample_id: str, changed_by: str = "system", change_reason: str = "", **kwargs) -> bool:
        if sample_id not in self.samples:
            return False
        sample = self.samples[sample_id]
        for key, value in kwargs.items():
            if hasattr(sample, key):
                old_value = str(getattr(sample, key))
                new_value = str(value)
                if old_value != new_value:
                    log = AuditLog(
                        sample_id=sample_id,
                        field_name=key,
                        old_value=old_value,
                        new_value=new_value,
                        change_reason=change_reason,
                        changed_by=changed_by
                    )
                    self.add_audit_log(log)
                    setattr(sample, key, value)
        sample.updated_at = datetime.now().isoformat()
        self.save_samples()
        return True

    def add_ticket(self, ticket: FeedbackTicket) -> str:
        self.tickets[ticket.ticket_id] = ticket
        if ticket.sample_id and ticket.sample_id in self.samples:
            sample = self.samples[ticket.sample_id]
            if not sample.ticket_id:
                self.update_sample(
                    ticket.sample_id,
                    changed_by=ticket.reporter,
                    change_reason="关联线上反馈工单",
                    ticket_id=ticket.ticket_id
                )
        self.save_tickets()
        return ticket.ticket_id

    def get_tickets_by_sample(self, sample_id: str) -> List[FeedbackTicket]:
        return [t for t in self.tickets.values() if t.sample_id == sample_id]

    def get_tickets_by_contract_name(self, contract_name: str) -> List[FeedbackTicket]:
        sample_ids = [s.sample_id for s in self.get_samples_by_contract_name(contract_name)]
        return [t for t in self.tickets.values() if t.sample_id in sample_ids]

    def add_rule(self, rule: DesensitizationRule, change_reason: str = "") -> str:
        self.rules[rule.rule_id] = rule
        if rule.sample_id and rule.sample_id in self.samples:
            sample = self.samples[rule.sample_id]
            old_note = sample.desensitization_note
            new_note_entry = f"[{rule.rule_id}] {rule.rule_type}: {rule.note}"
            new_note = (old_note + "\n" if old_note else "") + new_note_entry
            rule.previous_note = old_note
            rule.change_reason = change_reason
            self.update_sample(
                rule.sample_id,
                changed_by=rule.added_by,
                change_reason=change_reason or "补录脱敏规则备注",
                desensitization_note=new_note
            )
        self.save_rules()
        self._update_existing_reports_for_sample(rule.sample_id)
        return rule.rule_id

    def get_rules_by_sample(self, sample_id: str) -> List[DesensitizationRule]:
        return [r for r in self.rules.values() if r.sample_id == sample_id]

    def get_rules_by_contract_name(self, contract_name: str) -> List[DesensitizationRule]:
        sample_ids = [s.sample_id for s in self.get_samples_by_contract_name(contract_name)]
        return [r for r in self.rules.values() if r.sample_id in sample_ids]

    def _update_existing_reports_for_sample(self, sample_id: str):
        sample = self.get_sample(sample_id)
        if not sample:
            return
        contract_name = sample.contract_name
        for report in self.reports.values():
            for item in report.items:
                if item.contract_name == contract_name:
                    from contract_review.core.comparator import determine_next_action
                    tickets = self.get_tickets_by_contract_name(contract_name)
                    rules = self.get_rules_by_contract_name(contract_name)
                    sample_for_determine = sample
                    for ver_sample in self.get_samples_by_contract_name(contract_name):
                        if ver_sample.model_version == report.v2:
                            sample_for_determine = ver_sample
                            break
                    next_action, next_owner, missing, reason_kept = determine_next_action(
                        sample_for_determine, self
                    )
                    item.has_ticket = len(tickets) > 0
                    item.ticket_count = len(tickets)
                    item.has_desensitization_note = len(rules) > 0 or any(
                        bool(s.desensitization_note)
                        for s in self.get_samples_by_contract_name(contract_name)
                    )
                    item.next_action = next_action
                    item.next_owner = next_owner
                    item.missing_materials = missing
                    item.reason_kept = reason_kept
        self.save_reports()
