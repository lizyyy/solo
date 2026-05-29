import json
import os
from datetime import datetime
from models import Correction


class CorrectionStore:
    def __init__(self, store_path: str):
        self.store_path = store_path
        self._ensure_store()

    def _ensure_store(self):
        if not os.path.exists(self.store_path):
            with open(self.store_path, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False)

    def _load(self) -> list:
        with open(self.store_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save(self, records: list):
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def record_correction(
        self,
        app_id: str,
        field_name: str,
        old_value: str,
        new_value: str,
        reason: str,
        operator: str,
    ) -> Correction:
        correction = Correction(
            app_id=app_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            operator=operator,
            corrected_at=datetime.now(),
        )
        records = self._load()
        records.append(correction.to_dict())
        self._save(records)
        return correction

    def get_history(self, app_id: str = None) -> list:
        records = self._load()
        if app_id:
            records = [r for r in records if r["app_id"] == app_id]
        records.sort(key=lambda r: r["corrected_at"], reverse=True)
        return records

    def format_history(self, app_id: str = None) -> str:
        records = self.get_history(app_id)
        if not records:
            return "无修正记录"

        lines = []
        for r in records:
            lines.append(
                f"申请号: {r['app_id']}\n"
                f"  字段: {r['field_name']}\n"
                f"  旧值: {r['old_value']}\n"
                f"  新值: {r['new_value']}\n"
                f"  理由: {r['reason']}\n"
                f"  操作人: {r['operator']}\n"
                f"  时间: {r['corrected_at']}\n"
                f"{'─' * 40}"
            )
        return "\n".join(lines)
