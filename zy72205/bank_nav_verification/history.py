from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import ChangeRecord, ChangeType, FieldChange, TaxRateRemark


def _format_val(val: Any) -> str:
    if val is None:
        return ""
    if hasattr(val, "value"):
        return val.value
    return str(val)


@dataclass
class DiffEntry:
    change_record_id: str
    timestamp: str
    operator: str
    change_type: str
    field_name: str
    old_value: str
    new_value: str
    diff_description: str

    def to_dict(self) -> dict:
        return {
            "change_record_id": self.change_record_id,
            "timestamp": self.timestamp,
            "operator": self.operator,
            "change_type": self.change_type,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "diff_description": self.diff_description,
        }


class HistoryService:
    def get_full_diff(self, remark: TaxRateRemark) -> list[DiffEntry]:
        entries: list[DiffEntry] = []
        for record in remark.history:
            for fc in record.field_changes:
                old_fmt = _format_val(fc.old_value)
                new_fmt = _format_val(fc.new_value)
                entries.append(
                    DiffEntry(
                        change_record_id=record.id,
                        timestamp=record.timestamp,
                        operator=record.operator,
                        change_type=record.change_type.value,
                        field_name=fc.field_name,
                        old_value=old_fmt,
                        new_value=new_fmt,
                        diff_description=f"{fc.field_name}: {old_fmt} → {new_fmt}",
                    )
                )
        return entries

    def get_changes_for_field(
        self, remark: TaxRateRemark, field_name: str
    ) -> list[DiffEntry]:
        return [e for e in self.get_full_diff(remark) if e.field_name == field_name]

    def get_settlement_changes(self, remark: TaxRateRemark) -> list[DiffEntry]:
        return self.get_changes_for_field(remark, "settlement_type")

    def get_before_after(
        self, remark: TaxRateRemark, change_record_id: str
    ) -> dict | None:
        for record in remark.history:
            if record.id == change_record_id:
                return {
                    "change_id": record.id,
                    "change_type": record.change_type.value,
                    "operator": record.operator,
                    "timestamp": record.timestamp,
                    "reason": record.reason,
                    "settlement_override": record.settlement_override,
                    "field_changes": [fc.to_dict() for fc in record.field_changes],
                }
        return None

    def get_audit_trail(self, remark: TaxRateRemark) -> dict:
        return {
            "remark_id": remark.id,
            "original_line_number": remark.original_line_number,
            "product_code": remark.product_code,
            "product_name": remark.product_name,
            "original_settlement_type": remark.original_settlement_type.value,
            "current_settlement_type": remark.settlement_type.value,
            "current_status": remark.status.value,
            "flagged_for_manager": remark.flagged_for_manager,
            "flag_reason": remark.flag_reason,
            "total_changes": len(remark.history),
            "settlement_override_count": sum(
                1 for r in remark.history if r.settlement_override
            ),
            "history": remark.get_change_history(),
        }

    def find_evidence(self, remark: TaxRateRemark, keyword: str = "") -> list[dict]:
        results = []
        for record in remark.history:
            match = not keyword
            if keyword:
                match = any(
                    keyword in _format_val(fc.old_value) or keyword in _format_val(fc.new_value)
                    for fc in record.field_changes
                )
                match = match or keyword in record.reason
            if match:
                results.append(
                    {
                        "change_id": record.id,
                        "change_type": record.change_type.value,
                        "operator": record.operator,
                        "timestamp": record.timestamp,
                        "reason": record.reason,
                        "settlement_override": record.settlement_override,
                        "field_changes": [fc.to_dict() for fc in record.field_changes],
                    }
                )
        return results
