import json
import os
from typing import Dict, List, Optional, Any
from collections import defaultdict
from datetime import datetime

from models import (
    FundMatchRecord,
    Invoice,
    HolidayExtension,
    TailAdjustment,
    DiscrepancyItem,
    AuditLog,
    ConflictEvidence,
    ConflictResolution,
    SelfCheckResult,
    MatchStatus,
    RecordType,
    DiscrepancyStatus,
    entity_to_dict,
    dict_to_entity,
)


class MatchRepository:
    _instances: Dict[Optional[str], "MatchRepository"] = {}

    def __new__(cls, data_dir: Optional[str] = None):
        if data_dir not in cls._instances:
            instance = super().__new__(cls)
            instance._initialize(data_dir)
            cls._instances[data_dir] = instance
        return cls._instances[data_dir]

    def _initialize(self, data_dir: Optional[str] = None):
        self._data_dir = data_dir
        self._match_records: Dict[str, FundMatchRecord] = {}
        self._invoices: Dict[str, Invoice] = {}
        self._holiday_extensions: Dict[str, HolidayExtension] = {}
        self._tail_adjustments: Dict[str, TailAdjustment] = {}
        self._discrepancies: Dict[str, DiscrepancyItem] = {}
        self._audit_logs: List[AuditLog] = []
        self._conflict_evidences: Dict[str, ConflictEvidence] = {}
        self._conflict_resolutions: Dict[str, ConflictResolution] = {}
        self._self_check_results: List[SelfCheckResult] = []
        self._import_batches: Dict[str, List[str]] = defaultdict(list)
        self._business_no_to_records: Dict[str, List[str]] = defaultdict(list)
        if data_dir:
            os.makedirs(data_dir, exist_ok=True)
            self._load_from_disk()

    def _load_from_disk(self):
        if not self._data_dir:
            return
        try:
            self._invoices = {i.invoice_id: i for i in self._load_list("invoices.json", "Invoice")}
            self._match_records = {r.record_id: r for r in self._load_list("match_records.json", "FundMatchRecord")}
            self._holiday_extensions = {e.extension_id: e for e in self._load_list("holiday_extensions.json", "HolidayExtension")}
            self._tail_adjustments = {a.adjustment_id: a for a in self._load_list("tail_adjustments.json", "TailAdjustment")}
            self._discrepancies = {d.discrepancy_id: d for d in self._load_list("discrepancies.json", "DiscrepancyItem")}
            self._audit_logs = self._load_list("audit_logs.json", "AuditLog")
            ce_list = self._load_list("conflict_evidences.json", "ConflictEvidence")
            self._conflict_evidences = {c.business_no: c for c in ce_list}
            cr_list = self._load_list("conflict_resolutions.json", "ConflictResolution")
            self._conflict_resolutions = {c.business_no: c for c in cr_list}
            self._self_check_results = self._load_list("self_check_results.json", "SelfCheckResult")
            for record in self._match_records.values():
                self._business_no_to_records[record.business_no].append(record.record_id)
        except (FileNotFoundError, json.JSONDecodeError):
            pass

    def _load_list(self, filename: str, class_name: str) -> list:
        if not self._data_dir:
            return []
        filepath = os.path.join(self._data_dir, filename)
        if not os.path.exists(filepath):
            return []
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [dict_to_entity(class_name, item) for item in data]

    def save_to_disk(self):
        if not self._data_dir:
            return
        os.makedirs(self._data_dir, exist_ok=True)
        self._save_list("invoices.json", list(self._invoices.values()), "Invoice")
        self._save_list("match_records.json", list(self._match_records.values()), "FundMatchRecord")
        self._save_list("holiday_extensions.json", list(self._holiday_extensions.values()), "HolidayExtension")
        self._save_list("tail_adjustments.json", list(self._tail_adjustments.values()), "TailAdjustment")
        self._save_list("discrepancies.json", list(self._discrepancies.values()), "DiscrepancyItem")
        self._save_list("audit_logs.json", self._audit_logs, "AuditLog")
        self._save_list("conflict_evidences.json", list(self._conflict_evidences.values()), "ConflictEvidence")
        self._save_list("conflict_resolutions.json", list(self._conflict_resolutions.values()), "ConflictResolution")
        self._save_list("self_check_results.json", self._self_check_results, "SelfCheckResult")

    def _save_list(self, filename: str, items: list, class_name: str):
        if not self._data_dir:
            return
        filepath = os.path.join(self._data_dir, filename)
        data = [entity_to_dict(item) for item in items]
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def add_match_record(self, record: FundMatchRecord) -> None:
        self._match_records[record.record_id] = record
        self._business_no_to_records[record.business_no].append(record.record_id)
        record.updated_at = datetime.now()
        self.save_to_disk()

    def get_match_record(self, record_id: str) -> Optional[FundMatchRecord]:
        return self._match_records.get(record_id)

    def get_records_by_business_no(self, business_no: str) -> List[FundMatchRecord]:
        record_ids = self._business_no_to_records.get(business_no, [])
        return [self._match_records[rid] for rid in record_ids if rid in self._match_records]

    def get_all_match_records(self) -> List[FundMatchRecord]:
        return list(self._match_records.values())

    def get_match_records_for_export(self) -> List[Dict[str, Any]]:
        return self._format_records_for_output(self.get_all_match_records())

    def get_match_records_for_display(self) -> List[Dict[str, Any]]:
        return self._format_records_for_output(self.get_all_match_records())

    def get_match_records_for_api(self) -> List[Dict[str, Any]]:
        return self._format_records_for_output(self.get_all_match_records())

    def _format_records_for_output(self, records: List[FundMatchRecord]) -> List[Dict[str, Any]]:
        result = []
        for record in records:
            record_dict = {
                "record_id": record.record_id,
                "business_no": record.business_no,
                "record_type": record.record_type.value,
                "expected_amount": record.expected_amount,
                "matched_amount": record.matched_amount,
                "match_date": record.match_date.isoformat() if record.match_date else None,
                "status": record.status.value,
                "related_record_id": record.related_record_id,
                "invoice_ids": record.invoice_ids,
                "is_split_record": record.is_split_record(),
                "holiday_extension_applied": record.holiday_extension_applied,
                "tail_adjustment_applied": record.tail_adjustment_applied,
            }
            if record.is_split_record():
                related = self._match_records.get(record.related_record_id)
                if related:
                    record_dict["counterpart_type"] = related.record_type.value
                    record_dict["counterpart_amount"] = related.expected_amount
                    record_dict["combined_amount"] = record.expected_amount + related.expected_amount
            result.append(record_dict)
        return result

    def add_invoice(self, invoice: Invoice) -> None:
        self._invoices[invoice.invoice_id] = invoice
        if invoice.import_batch:
            self._import_batches[invoice.import_batch].append(invoice.invoice_id)
        self.save_to_disk()

    def get_invoice(self, invoice_id: str) -> Optional[Invoice]:
        return self._invoices.get(invoice_id)

    def get_all_invoices(self) -> List[Invoice]:
        return list(self._invoices.values())

    def get_invoices_by_batch(self, batch: str) -> List[Invoice]:
        invoice_ids = self._import_batches.get(batch, [])
        return [self._invoices[iid] for iid in invoice_ids if iid in self._invoices]

    def add_holiday_extension(self, extension: HolidayExtension) -> None:
        self._holiday_extensions[extension.extension_id] = extension
        if extension.import_batch:
            self._import_batches[extension.import_batch].append(f"holiday_{extension.extension_id}")
        self.save_to_disk()

    def get_holiday_extension(self, extension_id: str) -> Optional[HolidayExtension]:
        return self._holiday_extensions.get(extension_id)

    def get_holiday_extension_by_business_no(self, business_no: str) -> Optional[HolidayExtension]:
        for ext in self._holiday_extensions.values():
            if ext.business_no == business_no and ext.is_active:
                return ext
        return None

    def get_all_holiday_extensions(self) -> List[HolidayExtension]:
        return list(self._holiday_extensions.values())

    def add_tail_adjustment(self, adjustment: TailAdjustment) -> None:
        self._tail_adjustments[adjustment.adjustment_id] = adjustment
        if adjustment.import_batch:
            self._import_batches[adjustment.import_batch].append(f"tail_{adjustment.adjustment_id}")
        self.save_to_disk()

    def get_tail_adjustment(self, adjustment_id: str) -> Optional[TailAdjustment]:
        return self._tail_adjustments.get(adjustment_id)

    def get_tail_adjustment_by_business_no(self, business_no: str) -> Optional[TailAdjustment]:
        for adj in self._tail_adjustments.values():
            if adj.business_no == business_no and adj.is_active:
                return adj
        return None

    def get_all_tail_adjustments(self) -> List[TailAdjustment]:
        return list(self._tail_adjustments.values())

    def add_discrepancy(self, discrepancy: DiscrepancyItem) -> None:
        self._discrepancies[discrepancy.discrepancy_id] = discrepancy
        self.save_to_disk()

    def get_discrepancy(self, discrepancy_id: str) -> Optional[DiscrepancyItem]:
        return self._discrepancies.get(discrepancy_id)

    def get_all_discrepancies(self) -> List[DiscrepancyItem]:
        return list(self._discrepancies.values())

    def get_discrepancies_by_business_no(self, business_no: str) -> List[DiscrepancyItem]:
        return [d for d in self._discrepancies.values() if d.business_no == business_no]

    def update_discrepancy_status(
        self,
        discrepancy_id: str,
        status: DiscrepancyStatus,
        operator: str,
        notes: str,
    ) -> Optional[DiscrepancyItem]:
        discrepancy = self._discrepancies.get(discrepancy_id)
        if discrepancy:
            discrepancy.status = status
            discrepancy.resolved_at = datetime.now()
            discrepancy.resolved_by = operator
            discrepancy.resolution_notes = notes
            self.save_to_disk()
            return discrepancy
        return None

    def add_audit_log(self, log: AuditLog) -> None:
        self._audit_logs.append(log)
        self.save_to_disk()

    def get_audit_logs_by_business_no(self, business_no: str) -> List[AuditLog]:
        return [log for log in self._audit_logs if log.business_no == business_no]

    def get_all_audit_logs(self) -> List[AuditLog]:
        return list(self._audit_logs)

    def add_conflict_evidence(self, evidence: ConflictEvidence) -> None:
        self._conflict_evidences[evidence.business_no] = evidence
        self.save_to_disk()

    def get_conflict_evidence(self, business_no: str) -> Optional[ConflictEvidence]:
        return self._conflict_evidences.get(business_no)

    def get_all_conflict_evidences(self) -> List[ConflictEvidence]:
        return list(self._conflict_evidences.values())

    def add_conflict_resolution(self, resolution: ConflictResolution) -> None:
        self._conflict_resolutions[resolution.business_no] = resolution
        evidence = self._conflict_evidences.get(resolution.business_no)
        if evidence:
            self.add_audit_log(
                AuditLog(
                    business_no=resolution.business_no,
                    operator=resolution.operator,
                    action="冲突解决",
                    field_changed="resolution",
                    old_value="未解决",
                    new_value=resolution.resolution.value,
                    reason=resolution.reason,
                    affected_record_ids=self._business_no_to_records.get(resolution.business_no, []),
                    affected_calculation_fields=["matched_amount", "status"],
                )
            )

    def get_conflict_resolution(self, business_no: str) -> Optional[ConflictResolution]:
        return self._conflict_resolutions.get(business_no)

    def add_self_check_result(self, result: SelfCheckResult) -> None:
        self._self_check_results.append(result)
        self.save_to_disk()

    def get_self_check_results(self) -> List[SelfCheckResult]:
        return list(self._self_check_results)

    def clear_all(self) -> None:
        self._match_records.clear()
        self._invoices.clear()
        self._holiday_extensions.clear()
        self._tail_adjustments.clear()
        self._discrepancies.clear()
        self._audit_logs.clear()
        self._conflict_evidences.clear()
        self._conflict_resolutions.clear()
        self._self_check_results.clear()
        self._import_batches.clear()
        self._business_no_to_records.clear()
        self.save_to_disk()

    @classmethod
    def reset_instances(cls):
        cls._instances.clear()
