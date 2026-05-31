import json
import os
from typing import List, Optional

from .models import LedgerRecord, RecordStatus, DuplicateAction
from .audit import AuditLog
from .importer import ImportEngine
from .exporter import Exporter


class HedgeLedger:
    def __init__(self, work_dir: str):
        self.work_dir = work_dir
        self.data_dir = os.path.join(work_dir, "ledger_data")
        self.output_dir = os.path.join(work_dir, "output")
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

        self.records: List[LedgerRecord] = []
        self.audit_log = AuditLog(self.data_dir)
        self.importer = ImportEngine(self.audit_log)
        self.exporter = Exporter(self.output_dir, self.audit_log)

        self._state_path = os.path.join(self.data_dir, "ledger_state.json")
        self._load_state()

    def _load_state(self):
        if os.path.exists(self._state_path):
            with open(self._state_path, "r", encoding="utf-8") as f:
                state = json.load(f)
            for item in state.get("records", []):
                rec = LedgerRecord()
                rec.record_id = item.get("record_id", rec.record_id)
                from .normalizer import normalize_date
                td = item.get("trade_date", "")
                rec.trade_date = normalize_date(td) if td else None
                rec.route = item.get("route", "")
                rec.hedge_type = item.get("hedge_type", "")
                rec.direction = item.get("direction", "")
                amt = item.get("notional_amount")
                rec.notional_amount = float(amt) if amt not in (None, "") else None
                rec.currency = item.get("currency", "USD")
                rec.counterparty = item.get("counterparty", "")
                rec.operator = item.get("operator", "")
                rec.operator_raw = item.get("operator_raw", "")
                rec.contract_period = item.get("contract_period", "")
                sd = item.get("settlement_date", "")
                rec.settlement_date = normalize_date(sd) if sd else None
                rec.status = RecordStatus(item.get("status", "pending_material"))
                da = item.get("duplicate_action", "")
                rec.duplicate_action = DuplicateAction(da) if da else None
                rec.remark = item.get("remark", "")
                rec.caliber = item.get("caliber", "current")

                src_data = item.get("source", {})
                if src_data:
                    from .models import SourceTrace
                    rec.source = SourceTrace(**src_data)

                rec.audit_trail = item.get("audit_trail", [])
                self.records.append(rec)

    def _save_state(self):
        state = {"records": [r.to_dict() for r in self.records]}
        with open(self._state_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def import_file(self, file_path: str, on_duplicate: str = "skip") -> dict:
        result = self.importer.import_csv(file_path, self.records, on_duplicate=on_duplicate)
        self._save_state()
        return result.summary()

    def override_status(self, record_id: str, new_status: str, reason: str) -> bool:
        for rec in self.records:
            if rec.record_id == record_id:
                old_status = rec.status.value
                rec.status = RecordStatus(new_status)
                if rec.duplicate_action == DuplicateAction.CONFLICT and new_status == "manual_override":
                    rec.duplicate_action = DuplicateAction.UPDATE
                rec.add_audit("manual_override",
                              f"人工改判: {reason}",
                              before=old_status, after=new_status)
                self.audit_log.append(record_id, "manual_override",
                                      f"人工改判: {reason}",
                                      before=old_status, after=new_status)
                self._save_state()
                return True
        return False

    def summary(self) -> str:
        return self.exporter.terminal_summary(self.records)

    def export_detail(self, filename: str = "finance_detail.json") -> str:
        return self.exporter.export_finance_detail(self.records, filename)

    def export_csv(self, prefix: str = "finance") -> List[str]:
        return self.exporter.export_csv_sections(self.records, prefix)

    def get_record(self, record_id: str) -> Optional[LedgerRecord]:
        for rec in self.records:
            if rec.record_id == record_id:
                return rec
        return None

    def list_records(self) -> List[dict]:
        return [r.to_dict() for r in self.records]
