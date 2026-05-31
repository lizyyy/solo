import csv
import hashlib
import json
import os
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from .models import LedgerRecord, RecordStatus, DuplicateAction, SourceTrace
from .normalizer import normalize_date, normalize_amount, normalize_operator
from .audit import AuditLog


COLUMN_MAP = {
    "交易日期": "trade_date",
    "trade_date": "trade_date",
    "航线": "route",
    "route": "route",
    "套保类型": "hedge_type",
    "hedge_type": "hedge_type",
    "方向": "direction",
    "direction": "direction",
    "名义金额": "notional_amount",
    "notional_amount": "notional_amount",
    "金额": "notional_amount",
    "amount": "notional_amount",
    "对手方": "counterparty",
    "counterparty": "counterparty",
    "经办人": "operator",
    "operator": "operator",
    "合约期": "contract_period",
    "contract_period": "contract_period",
    "结算日": "settlement_date",
    "settlement_date": "settlement_date",
    "备注": "remark",
    "remark": "remark",
    "口径": "caliber",
    "caliber": "caliber",
}


class ImportResult:
    def __init__(self):
        self.added: List[LedgerRecord] = []
        self.skipped: List[dict] = []
        self.updated: List[Tuple[LedgerRecord, dict]] = []
        self.conflicts: List[dict] = []
        self.errors: List[dict] = []

    def summary(self) -> dict:
        return {
            "added": len(self.added),
            "skipped": len(self.skipped),
            "updated": len(self.updated),
            "conflicts": len(self.conflicts),
            "errors": len(self.errors),
        }


class ImportEngine:
    def __init__(self, audit_log: AuditLog):
        self.audit_log = audit_log

    @staticmethod
    def _fingerprint(record: dict) -> str:
        keys = ["trade_date", "route", "hedge_type", "direction", "notional_amount"]
        parts = []
        for k in keys:
            v = record.get(k, "")
            parts.append(str(v))
        raw = "|".join(parts)
        return hashlib.md5(raw.encode("utf-8")).hexdigest()

    def _map_row(self, row: dict) -> dict:
        mapped = {}
        for col, val in row.items():
            col_clean = col.strip()
            target = COLUMN_MAP.get(col_clean)
            if target:
                mapped[target] = val
        return mapped

    def _row_to_record(self, row: dict, file_name: str, sheet: str,
                       row_num: int, batch_id: str) -> LedgerRecord:
        mapped = self._map_row(row)
        rec = LedgerRecord()
        rec.source = SourceTrace(
            file_name=file_name,
            sheet_name=sheet,
            row_number=row_num,
            import_batch=batch_id,
            import_time=datetime.now().isoformat(),
            original_raw={k: str(v) for k, v in row.items()},
        )

        raw_date = mapped.get("trade_date", "")
        rec.trade_date = normalize_date(raw_date)
        if raw_date and not rec.trade_date:
            rec.add_audit("normalize_failed", f"日期归一化失败，原始值: {raw_date}", before=raw_date)

        raw_settlement = mapped.get("settlement_date", "")
        rec.settlement_date = normalize_date(raw_settlement)

        rec.route = str(mapped.get("route", "")).strip()
        rec.hedge_type = str(mapped.get("hedge_type", "")).strip()
        rec.direction = str(mapped.get("direction", "")).strip()
        rec.contract_period = str(mapped.get("contract_period", "")).strip()

        raw_amount = mapped.get("notional_amount")
        amount, currency = normalize_amount(raw_amount)
        rec.notional_amount = amount
        if currency:
            rec.currency = currency

        raw_operator = str(mapped.get("operator", "")).strip()
        rec.operator_raw = raw_operator
        rec.operator = normalize_operator(raw_operator)

        rec.counterparty = str(mapped.get("counterparty", "")).strip()
        rec.remark = str(mapped.get("remark", "")).strip()
        rec.caliber = str(mapped.get("caliber", "current")).strip()
        if not rec.caliber:
            rec.caliber = "current"

        self._classify_status(rec)

        return rec

    @staticmethod
    def _classify_status(rec: LedgerRecord):
        missing = []
        if not rec.trade_date:
            missing.append("交易日期")
        if not rec.route:
            missing.append("航线")
        if rec.notional_amount is None:
            missing.append("名义金额")
        if not rec.hedge_type:
            missing.append("套保类型")
        if not rec.direction:
            missing.append("方向")
        if not rec.operator:
            missing.append("经办人")

        if not missing:
            rec.status = RecordStatus.CONFIRMED
            rec.add_audit("status_classified", "信息完整，自动确认", after="confirmed")
        elif len(missing) <= 2 and rec.trade_date and rec.route and rec.notional_amount is not None:
            rec.status = RecordStatus.PENDING_MATERIAL
            rec.add_audit("status_classified", f"缺少: {', '.join(missing)}，待补材料", after="pending_material")
        else:
            rec.status = RecordStatus.PENDING_MATERIAL
            rec.add_audit("status_classified", f"关键字段缺失: {', '.join(missing)}，需人工确认", after="pending_material")

    def import_csv(self, file_path: str, existing_records: List[LedgerRecord],
                   on_duplicate: str = "skip") -> ImportResult:
        result = ImportResult()
        batch_id = uuid.uuid4().hex[:8]
        file_name = os.path.basename(file_path)

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    rec = self._row_to_record(row, file_name, None, row_num, batch_id)
                    dup_result = self._check_duplicate(rec, existing_records, on_duplicate)
                    if dup_result == "added":
                        existing_records.append(rec)
                        result.added.append(rec)
                        self.audit_log.append(rec.record_id, "import_added",
                                              f"从 {file_name} 第{row_num}行新增",
                                              extra={"source_file": file_name, "row": row_num})
                    elif dup_result == "skipped":
                        info = {"record_id": rec.record_id, "reason": "重复跳过",
                                "raw": row, "fingerprint": self._fingerprint(rec.to_dict())}
                        result.skipped.append(info)
                        self.audit_log.append(rec.record_id, "import_skipped",
                                              "重复记录已跳过", extra={"source_file": file_name})
                    elif dup_result == "updated":
                        old_rec = self._find_existing(rec, existing_records)
                        if old_rec:
                            old_data = old_rec.to_dict()
                            self._apply_update(old_rec, rec)
                            new_data = old_rec.to_dict()
                            result.updated.append((old_rec, {"before": old_data, "after": new_data}))
                            self.audit_log.append(old_rec.record_id, "import_updated",
                                                  f"从 {file_name} 更新", extra={"source_file": file_name})
                    elif dup_result == "conflict":
                        info = {"record_id": rec.record_id, "existing_id": "",
                                "reason": "重复冲突", "raw": row}
                        existing_dup = self._find_existing(rec, existing_records)
                        if existing_dup:
                            info["existing_id"] = existing_dup.record_id
                        result.conflicts.append(info)
                        rec.duplicate_action = DuplicateAction.CONFLICT
                        rec.status = RecordStatus.CONFLICT
                        rec.add_audit("duplicate_conflict", "重复导入产生冲突，需人工判定",
                                      after="conflict")
                        existing_records.append(rec)
                        self.audit_log.append(rec.record_id, "import_conflict",
                                              "重复记录冲突", extra={"source_file": file_name})
                except Exception as e:
                    result.errors.append({"row": row_num, "error": str(e), "raw": str(row)})
                    self.audit_log.append("ERROR", "import_error",
                                          f"第{row_num}行导入出错: {e}",
                                          extra={"source_file": file_name, "row": row_num})
        return result

    def _check_duplicate(self, new_rec: LedgerRecord,
                         existing: List[LedgerRecord], on_duplicate: str) -> str:
        if not self._find_existing(new_rec, existing):
            return "added"
        if on_duplicate == "skip":
            return "skipped"
        elif on_duplicate == "update":
            return "updated"
        elif on_duplicate == "conflict":
            return "conflict"
        return "skipped"

    def _find_existing(self, new_rec: LedgerRecord,
                       existing: List[LedgerRecord]) -> Optional[LedgerRecord]:
        new_fp = self._fingerprint(new_rec.to_dict())
        for rec in existing:
            existing_fp = self._fingerprint(rec.to_dict())
            if new_fp == existing_fp:
                return rec
        return None

    @staticmethod
    def _apply_update(old_rec: LedgerRecord, new_rec: LedgerRecord):
        updatable = ["trade_date", "route", "hedge_type", "direction",
                     "notional_amount", "currency", "counterparty", "operator",
                     "operator_raw", "contract_period", "settlement_date", "remark", "caliber"]
        for field_name in updatable:
            new_val = getattr(new_rec, field_name)
            old_val = getattr(old_rec, field_name)
            if new_val and new_val != old_val:
                old_rec.add_audit(f"field_update_{field_name}",
                                  f"字段 {field_name} 更新",
                                  before=str(old_val), after=str(new_val))
                setattr(old_rec, field_name, new_val)
        old_rec.duplicate_action = DuplicateAction.UPDATE
        old_rec.add_audit("duplicate_update", "重复导入执行更新", after="updated")
