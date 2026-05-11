import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from .models import DriftAllowance


class DriftManager:
    def __init__(self, allowances_file: Path):
        self.allowances_file = allowances_file
        self._allowances: Dict[str, Dict[str, DriftAllowance]] = {}
        self._load()

    def _load(self):
        self._allowances = {}
        if not self.allowances_file.exists():
            return

        with open(self.allowances_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        for tenant_id, keys in data.items():
            self._allowances[tenant_id] = {}
            for key, item in keys.items():
                allowance = DriftAllowance(
                    tenant_id=tenant_id,
                    key=key,
                    approved_by=item["approved_by"],
                    approval_date=datetime.fromisoformat(item["approval_date"]),
                    expiry_date=datetime.fromisoformat(item["expiry_date"]),
                    reason=item["reason"],
                )
                allowance.check_expired()
                self._allowances[tenant_id][key] = allowance

    def _save(self):
        data = {}
        for tenant_id, keys in self._allowances.items():
            data[tenant_id] = {}
            for key, allowance in keys.items():
                data[tenant_id][key] = {
                    "approved_by": allowance.approved_by,
                    "approval_date": allowance.approval_date.isoformat(),
                    "expiry_date": allowance.expiry_date.isoformat(),
                    "reason": allowance.reason,
                }

        self.allowances_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.allowances_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_allowance(
        self,
        tenant_id: str,
        key: str,
        approved_by: str,
        reason: str,
        days: int = 30,
    ) -> DriftAllowance:
        now = datetime.now()
        allowance = DriftAllowance(
            tenant_id=tenant_id,
            key=key,
            approved_by=approved_by,
            approval_date=now,
            expiry_date=now + timedelta(days=days),
            reason=reason,
        )

        if tenant_id not in self._allowances:
            self._allowances[tenant_id] = {}
        self._allowances[tenant_id][key] = allowance
        self._save()
        return allowance

    def remove_allowance(self, tenant_id: str, key: str) -> bool:
        if tenant_id in self._allowances and key in self._allowances[tenant_id]:
            del self._allowances[tenant_id][key]
            if not self._allowances[tenant_id]:
                del self._allowances[tenant_id]
            self._save()
            return True
        return False

    def get_allowance(self, tenant_id: str, key: str) -> Optional[DriftAllowance]:
        if tenant_id not in self._allowances:
            return None
        return self._allowances[tenant_id].get(key)

    def get_tenant_allowances(self, tenant_id: str) -> List[DriftAllowance]:
        if tenant_id not in self._allowances:
            return []
        return list(self._allowances[tenant_id].values())

    def get_all_allowances(self) -> List[DriftAllowance]:
        all_items = []
        for tenant_keys in self._allowances.values():
            all_items.extend(tenant_keys.values())
        return all_items

    def is_allowed(self, tenant_id: str, key: str) -> bool:
        allowance = self.get_allowance(tenant_id, key)
        if allowance is None:
            return False
        allowance.check_expired()
        return not allowance.is_expired

    def get_expired_allowances(self) -> List[DriftAllowance]:
        expired = []
        for allowance in self.get_all_allowances():
            if allowance.check_expired():
                expired.append(allowance)
        return expired

    def refresh_expiry_status(self):
        for allowance in self.get_all_allowances():
            allowance.check_expired()
