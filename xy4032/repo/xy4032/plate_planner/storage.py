"""
存储模块 - 账本存储、样品管理、方案历史、撤销功能
"""

import json
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from copy import deepcopy

from .models import (
    Sample, SampleStatus, PlatePlan, Ledger, LedgerEntry, PlanHistory
)
from .config import (
    get_ledger_path, get_samples_path, get_plans_path,
    get_config_path, is_initialized
)


class StorageError(Exception):
    pass


class StorageManager:
    def __init__(self, work_dir: Optional[Path] = None):
        self.work_dir = work_dir or Path.cwd()
        self._samples: Dict[str, Sample] = {}
        self._ledger: Ledger = Ledger()
        self._plan_history: PlanHistory = PlanHistory()
        self._loaded = False

    def _ensure_loaded(self):
        if not self._loaded:
            self._load_all()

    def _load_all(self):
        self._load_samples()
        self._load_ledger()
        self._load_plan_history()
        self._loaded = True

    def _load_samples(self):
        samples_path = get_samples_path(self.work_dir)
        if samples_path.exists():
            try:
                data = json.loads(samples_path.read_text(encoding="utf-8"))
                self._samples = {
                    s["sample_id"]: Sample(**s)
                    for s in data
                }
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                raise StorageError(f"加载样品数据失败: {e}")
        else:
            self._samples = {}

    def _save_samples(self):
        samples_path = get_samples_path(self.work_dir)
        samples_path.parent.mkdir(parents=True, exist_ok=True)
        data = [s.model_dump() for s in self._samples.values()]
        samples_path.write_text(
            _json_dumps_with_datetime(data),
            encoding="utf-8"
        )

    def _load_ledger(self):
        ledger_path = get_ledger_path(self.work_dir)
        if ledger_path.exists():
            try:
                data = json.loads(ledger_path.read_text(encoding="utf-8"))
                self._ledger = Ledger(**data)
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                raise StorageError(f"加载账本数据失败: {e}")
        else:
            self._ledger = Ledger()

    def _save_ledger(self):
        ledger_path = get_ledger_path(self.work_dir)
        ledger_path.parent.mkdir(parents=True, exist_ok=True)
        data = self._ledger.model_dump()
        ledger_path.write_text(
            _json_dumps_with_datetime(data),
            encoding="utf-8"
        )

    def _load_plan_history(self):
        plans_path = get_plans_path(self.work_dir)
        if plans_path.exists():
            try:
                data = json.loads(plans_path.read_text(encoding="utf-8"))
                self._plan_history = PlanHistory(**data)
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                raise StorageError(f"加载方案历史失败: {e}")
        else:
            self._plan_history = PlanHistory()

    def _save_plan_history(self):
        plans_path = get_plans_path(self.work_dir)
        plans_path.parent.mkdir(parents=True, exist_ok=True)
        data = self._plan_history.model_dump()
        plans_path.write_text(
            _json_dumps_with_datetime(data),
            encoding="utf-8"
        )

    def get_samples(self) -> List[Sample]:
        self._ensure_loaded()
        return list(self._samples.values())

    def get_sample(self, sample_id: str) -> Optional[Sample]:
        self._ensure_loaded()
        return self._samples.get(sample_id)

    def add_samples(self, samples: List[Sample], check_duplicates: bool = True) -> Tuple[List[str], List[str]]:
        self._ensure_loaded()
        added: List[str] = []
        skipped: List[str] = []

        for sample in samples:
            if check_duplicates and sample.sample_id in self._samples:
                skipped.append(sample.sample_id)
                continue
            self._samples[sample.sample_id] = sample
            added.append(sample.sample_id)

        self._save_samples()
        return added, skipped

    def update_sample(self, sample_id: str, **kwargs) -> bool:
        self._ensure_loaded()
        if sample_id not in self._samples:
            return False
        sample = self._samples[sample_id]
        for key, value in kwargs.items():
            if hasattr(sample, key):
                setattr(sample, key, value)
        sample.updated_at = datetime.now()
        self._save_samples()
        return True

    def get_next_plate_number(self) -> int:
        self._ensure_loaded()
        num = self._ledger.get_next_plate_number()
        self._save_ledger()
        return num

    def save_plan(self, plan: PlatePlan):
        self._ensure_loaded()
        self._plan_history.plans.append(plan)
        self._save_plan_history()

    def get_plan(self, plan_id: str) -> Optional[PlatePlan]:
        self._ensure_loaded()
        for plan in self._plan_history.plans:
            if plan.plan_id == plan_id:
                return plan
        return None

    def apply_plan(
        self,
        plan: PlatePlan,
        volume_used_per_sample: Dict[str, float],
        remarks: Optional[str] = None,
    ) -> LedgerEntry:
        self._ensure_loaded()

        sample_changes: List[Dict[str, Any]] = []
        for sample_id, volume_ul in volume_used_per_sample.items():
            sample = self._samples.get(sample_id)
            if sample:
                old_volume = sample.available_volume
                new_volume = old_volume - volume_ul

                sample_changes.append({
                    "sample_id": sample_id,
                    "old_volume_ul": old_volume,
                    "new_volume_ul": new_volume,
                    "volume_used_ul": volume_ul,
                })

                sample.available_volume = new_volume
                if new_volume <= 0:
                    sample.status = SampleStatus.DEPLETED
                else:
                    sample.status = SampleStatus.USED
                sample.updated_at = datetime.now()

        entry = LedgerEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            action="apply",
            plate_number=plan.plate_number,
            plan_id=plan.plan_id,
            sample_changes=sample_changes,
            remarks=remarks,
        )

        self._ledger.entries.append(entry)
        self._save_samples()
        self._save_ledger()

        return entry

    def undo_last_apply(self) -> Tuple[bool, Optional[LedgerEntry]]:
        self._ensure_loaded()

        apply_entries = [
            e for e in self._ledger.entries
            if e.action == "apply"
        ]
        if not apply_entries:
            return False, None

        last_entry = apply_entries[-1]

        for change in last_entry.sample_changes:
            sample_id = change["sample_id"]
            old_volume = change["old_volume_ul"]

            sample = self._samples.get(sample_id)
            if sample:
                sample.available_volume = old_volume
                if old_volume > 0:
                    sample.status = SampleStatus.AVAILABLE
                sample.updated_at = datetime.now()

        undo_entry = LedgerEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            action="undo",
            plate_number=last_entry.plate_number,
            plan_id=last_entry.plan_id,
            sample_changes=[{
                "sample_id": c["sample_id"],
                "old_volume_ul": c["new_volume_ul"],
                "new_volume_ul": c["old_volume_ul"],
                "volume_used_ul": -c["volume_used_ul"],
            } for c in last_entry.sample_changes],
            remarks=f"撤销 apply: {last_entry.entry_id}",
        )
        self._ledger.entries.append(undo_entry)

        self._save_samples()
        self._save_ledger()

        return True, last_entry

    def get_history(
        self,
        batch: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[LedgerEntry]:
        self._ensure_loaded()
        results = []

        for entry in self._ledger.entries:
            if entry.timestamp is None:
                continue

            entry_date = entry.timestamp.date()

            if start_date and entry_date < start_date:
                continue
            if end_date and entry_date > end_date:
                continue

            results.append(entry)

        return results

    def get_all_entries(self) -> List[LedgerEntry]:
        self._ensure_loaded()
        return list(self._ledger.entries)


def _json_dumps_with_datetime(obj: Any) -> str:
    class DateTimeEncoder(json.JSONEncoder):
        def default(self, o):
            if isinstance(o, datetime):
                return o.isoformat()
            if isinstance(o, date):
                return o.isoformat()
            return super().default(o)

    return json.dumps(obj, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
