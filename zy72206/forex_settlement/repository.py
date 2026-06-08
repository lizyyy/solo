import json
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
import pandas as pd
from .models import SettlementRecord, AuditLog, ProcessingStep
from .state_machine import StateMachine


class SettlementRepository:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.records_file = self.data_dir / "settlement_records.json"
        self.audit_file = self.data_dir / "audit_logs.json"
        self.state_machine = StateMachine()
        self._load_data()

    def _load_data(self):
        if self.records_file.exists():
            with open(self.records_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.records: Dict[str, SettlementRecord] = {
                    r["id"]: SettlementRecord(**r) for r in data
                }
        else:
            self.records: Dict[str, SettlementRecord] = {}
        if self.audit_file.exists():
            with open(self.audit_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.audit_logs: List[AuditLog] = [AuditLog(**log) for log in data]
                self.state_machine.audit_logs = self.audit_logs
        else:
            self.audit_logs: List[AuditLog] = []

    def _save_data(self):
        records_data = [r.model_dump(mode="json") for r in self.records.values()]
        with open(self.records_file, "w", encoding="utf-8") as f:
            json.dump(records_data, f, ensure_ascii=False, indent=2)
        audit_data = [log.model_dump(mode="json") for log in self.audit_logs]
        with open(self.audit_file, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

    def add_record(self, record: SettlementRecord) -> SettlementRecord:
        self.records[record.id] = record
        self.audit_logs = self.state_machine.audit_logs
        self._save_data()
        return record

    def get_record(self, record_id: str) -> Optional[SettlementRecord]:
        return self.records.get(record_id)

    def get_all_records(self) -> List[SettlementRecord]:
        return list(self.records.values())

    def get_records_by_step(self, step: ProcessingStep) -> List[SettlementRecord]:
        return [r for r in self.records.values() if r.current_step == step]

    def get_records_for_export(self) -> List[Dict[str, Any]]:
        return [self._record_to_dict(r) for r in self.records.values()]

    def _record_to_dict(self, record: SettlementRecord) -> Dict[str, Any]:
        return {
            "record_id": record.id,
            "original_row_number": record.original_row_number,
            "source": str(record.source.value) if hasattr(record.source, 'value') else str(record.source),
            "trade_date": record.trade_date,
            "settlement_date": record.settlement_date,
            "currency_pair": record.currency_pair,
            "amount": record.amount,
            "original_amount": record.original_amount,
            "rate": record.rate,
            "tax_rate": record.tax_rate,
            "tax_rate_remark": record.tax_rate_remark,
            "status": str(record.status.value) if hasattr(record.status, 'value') else str(record.status),
            "current_step": str(record.current_step.value) if hasattr(record.current_step, 'value') else str(record.current_step),
            "remark": record.remark,
            "is_reversed": record.is_reversed,
            "has_zero_amount_with_reversal": record.has_zero_amount_with_reversal,
            "risk_review_required": record.risk_review_required,
            "risk_review_note": record.risk_review_note,
            "ex_date_evidence_id": record.ex_date_evidence_id,
            "created_at": record.created_at.isoformat() if isinstance(record.created_at, datetime) else record.created_at,
            "updated_at": record.updated_at.isoformat() if isinstance(record.updated_at, datetime) else record.updated_at,
            "created_by": record.created_by,
            "updated_by": record.updated_by,
        }

    def get_record_for_api(self, record_id: str) -> Optional[Dict[str, Any]]:
        record = self.get_record(record_id)
        if not record:
            return None
        return self._record_to_dict(record)

    def get_records_for_display(self) -> List[Dict[str, Any]]:
        return self.get_records_for_export()

    def get_audit_logs(self, record_id: Optional[str] = None) -> List[AuditLog]:
        if record_id:
            return [log for log in self.audit_logs if log.record_id == record_id]
        return self.audit_logs

    def import_from_excel(self, file_path: str, operator: str = "system") -> List[SettlementRecord]:
        df = pd.read_excel(file_path)
        records = []
        for idx, row in df.iterrows():
            record = self.state_machine.create_record(
                original_row_number=idx + 2,
                trade_date=str(row.get("trade_date", row.get("交易日", ""))),
                settlement_date=str(row.get("settlement_date", row.get("交割日", ""))),
                currency_pair=str(row.get("currency_pair", row.get("货币对", ""))),
                amount=float(row.get("amount", row.get("金额", 0))),
                rate=float(row.get("rate", row.get("汇率", 0))),
                remark=str(row.get("remark", row.get("备注", ""))),
                operator=operator,
            )
            self.records[record.id] = record
            records.append(record)
        self.audit_logs = self.state_machine.audit_logs
        self._save_data()
        return records

    def export_to_excel(self, output_path: str) -> str:
        data = self.get_records_for_export()
        df = pd.DataFrame(data)
        df.to_excel(output_path, index=False, engine="openpyxl")
        return output_path

    def advance_record_step(self, record_id: str, operator: str) -> Optional[SettlementRecord]:
        record = self.get_record(record_id)
        if not record:
            return None
        record, success = self.state_machine.advance_step(record, operator)
        if success:
            self.records[record.id] = record
            self.audit_logs = self.state_machine.audit_logs
            self._save_data()
        return record

    def update_record_tax_rate(
        self, record_id: str, tax_rate: float, tax_rate_remark: str, operator: str
    ) -> Optional[SettlementRecord]:
        record = self.get_record(record_id)
        if not record:
            return None
        record, success = self.state_machine.update_tax_rate(
            record, tax_rate, tax_rate_remark, operator
        )
        if success:
            self.records[record.id] = record
            self.audit_logs = self.state_machine.audit_logs
            self._save_data()
        return record

    def risk_review_record(
        self, record_id: str, approved: bool, review_note: str, operator: str
    ) -> Optional[SettlementRecord]:
        record = self.get_record(record_id)
        if not record:
            return None
        record, success = self.state_machine.risk_review(
            record, approved, review_note, operator
        )
        if success:
            self.records[record.id] = record
            self.audit_logs = self.state_machine.audit_logs
            self._save_data()
        return record

    def update_record_summary(
        self, record_id: str, summary_remark: str, operator: str
    ) -> Optional[SettlementRecord]:
        record = self.get_record(record_id)
        if not record:
            return None
        record, success = self.state_machine.update_summary(
            record, summary_remark, operator
        )
        if success:
            self.records[record.id] = record
            self.audit_logs = self.state_machine.audit_logs
            self._save_data()
        return record

    def reverse_record(
        self, record_id: str, reason: str, operator: str
    ) -> Optional[SettlementRecord]:
        record = self.get_record(record_id)
        if not record:
            return None
        record, success = self.state_machine.reverse_record(record, reason, operator)
        if success:
            self.records[record.id] = record
            self.audit_logs = self.state_machine.audit_logs
            self._save_data()
        return record

    def rollback_record(
        self, record_id: str, to_step: ProcessingStep, operator: str, reason: str
    ) -> Optional[SettlementRecord]:
        record = self.get_record(record_id)
        if not record:
            return None
        record, success = self.state_machine.rollback_record(
            record, to_step, operator, reason
        )
        if success:
            self.records[record.id] = record
            self.audit_logs = self.state_machine.audit_logs
            self._save_data()
        return record

    def get_blocking_info(self, record_id: str) -> Optional[Dict[str, Any]]:
        record = self.get_record(record_id)
        if not record:
            return None
        return self.state_machine.get_blocking_info(record)
