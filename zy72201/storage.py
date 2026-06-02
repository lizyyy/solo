import json
import os
from typing import List, Optional, Dict
from datetime import datetime
from models import (
    BondRedemptionReminder,
    SupplementaryRecord,
    TailAdjustmentEntry,
    AuditLog,
    InstitutionAlias,
    HolidayConfig,
    RecordStatus,
)


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.reminders_file = os.path.join(data_dir, "reminders.json")
        self.aliases_file = os.path.join(data_dir, "institution_aliases.json")
        self.holidays_file = os.path.join(data_dir, "holidays.json")
        self._ensure_dir()

    def _ensure_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def save_reminders(self, reminders: List[BondRedemptionReminder]):
        data = [self._reminder_to_dict(r) for r in reminders]
        with open(self.reminders_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def load_reminders(self) -> List[BondRedemptionReminder]:
        if not os.path.exists(self.reminders_file):
            return []
        with open(self.reminders_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [self._dict_to_reminder(d) for d in data]

    def save_institution_aliases(self, aliases: List[InstitutionAlias]):
        data = [{"full_name": a.full_name, "aliases": a.aliases, "standard_alias": a.standard_alias} for a in aliases]
        with open(self.aliases_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_institution_aliases(self) -> List[InstitutionAlias]:
        if not os.path.exists(self.aliases_file):
            return []
        with open(self.aliases_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [InstitutionAlias(**d) for d in data]

    def save_holiday_config(self, config: HolidayConfig):
        data = {"holiday_dates": config.holiday_dates, "weekend_days": config.weekend_days}
        with open(self.holidays_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_holiday_config(self) -> HolidayConfig:
        if not os.path.exists(self.holidays_file):
            return HolidayConfig()
        with open(self.holidays_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return HolidayConfig(**data)

    def _reminder_to_dict(self, reminder: BondRedemptionReminder) -> Dict:
        return {
            "id": reminder.id,
            "bond_code": reminder.bond_code,
            "bond_name": reminder.bond_name,
            "institution_full_name": reminder.institution_full_name,
            "institution_alias": reminder.institution_alias,
            "redemption_date": reminder.redemption_date,
            "original_redemption_date": reminder.original_redemption_date,
            "exercise_amount": reminder.exercise_amount,
            "coupon_rate": reminder.coupon_rate,
            "status": reminder.status.value,
            "source": reminder.source,
            "import_batch": reminder.import_batch,
            "has_alias_mismatch": reminder.has_alias_mismatch,
            "alias_mismatch_note": reminder.alias_mismatch_note,
            "detected_alias": reminder.detected_alias,
            "has_holiday_adjustment": reminder.has_holiday_adjustment,
            "holiday_adjustment_note": reminder.holiday_adjustment_note,
            "has_tail_adjustment": reminder.has_tail_adjustment,
            "tail_adjustments": [self._tail_to_dict(t) for t in reminder.tail_adjustments],
            "supplementary_records": [self._supplementary_to_dict(s) for s in reminder.supplementary_records],
            "audit_logs": [self._audit_to_dict(a) for a in reminder.audit_logs],
            "raw_data": reminder.raw_data,
            "created_at": reminder.created_at.isoformat() if isinstance(reminder.created_at, datetime) else reminder.created_at,
            "updated_at": reminder.updated_at.isoformat() if isinstance(reminder.updated_at, datetime) else reminder.updated_at,
            "import_count": reminder.import_count,
            "last_rerun_at": reminder.last_rerun_at.isoformat() if reminder.last_rerun_at and isinstance(reminder.last_rerun_at, datetime) else reminder.last_rerun_at,
        }

    def _dict_to_reminder(self, d: Dict) -> BondRedemptionReminder:
        return BondRedemptionReminder(
            id=d["id"],
            bond_code=d["bond_code"],
            bond_name=d["bond_name"],
            institution_full_name=d["institution_full_name"],
            institution_alias=d["institution_alias"],
            redemption_date=d["redemption_date"],
            original_redemption_date=d["original_redemption_date"],
            exercise_amount=d["exercise_amount"],
            coupon_rate=d["coupon_rate"],
            status=RecordStatus(d["status"]),
            source=d["source"],
            import_batch=d["import_batch"],
            has_alias_mismatch=d.get("has_alias_mismatch", False),
            alias_mismatch_note=d.get("alias_mismatch_note", ""),
            detected_alias=d.get("detected_alias", ""),
            has_holiday_adjustment=d.get("has_holiday_adjustment", False),
            holiday_adjustment_note=d.get("holiday_adjustment_note", ""),
            has_tail_adjustment=d.get("has_tail_adjustment", False),
            tail_adjustments=[self._dict_to_tail(t) for t in d.get("tail_adjustments", [])],
            supplementary_records=[self._dict_to_supplementary(s) for s in d.get("supplementary_records", [])],
            audit_logs=[self._dict_to_audit(a) for a in d.get("audit_logs", [])],
            raw_data=d.get("raw_data", {}),
            created_at=datetime.fromisoformat(d["created_at"]) if d.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(d["updated_at"]) if d.get("updated_at") else datetime.now(),
            import_count=d.get("import_count", 1),
            last_rerun_at=datetime.fromisoformat(d["last_rerun_at"]) if d.get("last_rerun_at") else None,
        )

    def _tail_to_dict(self, tail: TailAdjustmentEntry) -> Dict:
        return {
            "id": tail.id,
            "reminder_id": tail.reminder_id,
            "amount_diff": tail.amount_diff,
            "adjustment_reason": tail.adjustment_reason,
            "remark": tail.remark,
            "created_at": tail.created_at.isoformat() if isinstance(tail.created_at, datetime) else tail.created_at,
            "created_by": tail.created_by,
            "linked_supplementary_id": tail.linked_supplementary_id,
        }

    def _dict_to_tail(self, d: Dict) -> TailAdjustmentEntry:
        return TailAdjustmentEntry(
            id=d["id"],
            reminder_id=d["reminder_id"],
            amount_diff=d["amount_diff"],
            adjustment_reason=d["adjustment_reason"],
            remark=d["remark"],
            created_at=datetime.fromisoformat(d["created_at"]) if d.get("created_at") else datetime.now(),
            created_by=d.get("created_by", "system"),
            linked_supplementary_id=d.get("linked_supplementary_id"),
        )

    def _supplementary_to_dict(self, sup: SupplementaryRecord) -> Dict:
        return {
            "id": sup.id,
            "reminder_id": sup.reminder_id,
            "why_kept": sup.why_kept,
            "missing_materials": sup.missing_materials,
            "next_step": sup.next_step.value,
            "notes": sup.notes,
            "created_at": sup.created_at.isoformat() if isinstance(sup.created_at, datetime) else sup.created_at,
            "updated_at": sup.updated_at.isoformat() if isinstance(sup.updated_at, datetime) else sup.updated_at,
            "created_by": sup.created_by,
            "updated_by": sup.updated_by,
        }

    def _dict_to_supplementary(self, d: Dict) -> SupplementaryRecord:
        from models import NextStep
        return SupplementaryRecord(
            id=d["id"],
            reminder_id=d["reminder_id"],
            why_kept=d["why_kept"],
            missing_materials=d["missing_materials"],
            next_step=NextStep(d["next_step"]),
            notes=d.get("notes", ""),
            created_at=datetime.fromisoformat(d["created_at"]) if d.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(d["updated_at"]) if d.get("updated_at") else datetime.now(),
            created_by=d.get("created_by", "system"),
            updated_by=d.get("updated_by", "system"),
        )

    def _audit_to_dict(self, audit: AuditLog) -> Dict:
        return {
            "id": audit.id,
            "reminder_id": audit.reminder_id,
            "action": audit.action,
            "field_changed": audit.field_changed,
            "old_value": audit.old_value,
            "new_value": audit.new_value,
            "reason": audit.reason,
            "operator": audit.operator,
            "timestamp": audit.timestamp.isoformat() if isinstance(audit.timestamp, datetime) else audit.timestamp,
            "affected_results": audit.affected_results,
        }

    def _dict_to_audit(self, d: Dict) -> AuditLog:
        return AuditLog(
            id=d["id"],
            reminder_id=d["reminder_id"],
            action=d["action"],
            field_changed=d["field_changed"],
            old_value=d["old_value"],
            new_value=d["new_value"],
            reason=d["reason"],
            operator=d["operator"],
            timestamp=datetime.fromisoformat(d["timestamp"]) if d.get("timestamp") else datetime.now(),
            affected_results=d.get("affected_results", ""),
        )
