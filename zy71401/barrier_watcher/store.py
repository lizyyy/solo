from __future__ import annotations

import json
import os
import tempfile
from datetime import date, datetime
from pathlib import Path

from .models import (
    BarrierDirection,
    BarrierJudgment,
    BarrierType,
    Contract,
    HistoryEntry,
    JudgmentStatus,
    ObservationPrice,
    Reminder,
)


class Store:
    def __init__(self, workspace: str | Path) -> None:
        self._workspace = Path(workspace)
        self._contracts_file = self._workspace / "contracts.json"
        self._prices_file = self._workspace / "prices.json"
        self._judgments_file = self._workspace / "judgments.json"
        self._reminders_file = self._workspace / "reminders.json"
        self._history_file = self._workspace / "history.json"

    @property
    def workspace(self) -> Path:
        return self._workspace

    def init_workspace(self) -> None:
        self._workspace.mkdir(parents=True, exist_ok=True)
        for f in [
            self._contracts_file,
            self._prices_file,
            self._judgments_file,
            self._reminders_file,
            self._history_file,
        ]:
            if not f.exists():
                self._atomic_write(f, "[]")

    def load_contracts(self) -> dict[str, Contract]:
        data = self._load_json(self._contracts_file)
        return {c.contract_id: c for c in (Contract.from_dict(d) for d in data)}

    def save_contracts(self, contracts: dict[str, Contract]) -> None:
        data = [c.to_dict() for c in contracts.values()]
        self._atomic_write(self._contracts_file, json.dumps(data, ensure_ascii=False, indent=2))

    def upsert_contracts(self, new_contracts: list[Contract]) -> list[str]:
        existing = self.load_contracts()
        updated_ids: list[str] = []
        for c in new_contracts:
            cid = c.contract_id
            if cid in existing:
                old = existing[cid]
                if c.observation_dates is None:
                    c.observation_dates = old.observation_dates
                if c.barrier_type is None:
                    c.barrier_type = old.barrier_type
                if c.barrier_level is None:
                    c.barrier_level = old.barrier_level
                if c.barrier_direction is None:
                    c.barrier_direction = old.barrier_direction
                existing[cid] = c
                updated_ids.append(cid)
            else:
                existing[cid] = c
                updated_ids.append(cid)
        self.save_contracts(existing)
        return updated_ids

    def update_barrier_conditions(
        self,
        contract_id: str,
        barrier_type: str | None = None,
        barrier_level: float | None = None,
        barrier_direction: str | None = None,
        observation_dates: list[date] | None = None,
    ) -> Contract | None:
        contracts = self.load_contracts()
        if contract_id not in contracts:
            return None
        c = contracts[contract_id]
        if barrier_type is not None:
            c.barrier_type = BarrierType(barrier_type)
        if barrier_level is not None:
            c.barrier_level = barrier_level
        if barrier_direction is not None:
            c.barrier_direction = BarrierDirection(barrier_direction)
        if observation_dates is not None:
            c.observation_dates = observation_dates
        contracts[contract_id] = c
        self.save_contracts(contracts)
        return c

    def load_prices(self) -> dict[str, list[ObservationPrice]]:
        data = self._load_json(self._prices_file)
        result: dict[str, list[ObservationPrice]] = {}
        for d in data:
            p = ObservationPrice.from_dict(d)
            result.setdefault(p.contract_id, []).append(p)
        return result

    def save_prices(self, prices: dict[str, list[ObservationPrice]]) -> None:
        flat: list[dict] = []
        for plist in prices.values():
            flat.extend(p.to_dict() for p in plist)
        self._atomic_write(self._prices_file, json.dumps(flat, ensure_ascii=False, indent=2))

    def add_prices(self, new_prices: list[ObservationPrice]) -> int:
        existing = self.load_prices()
        added = 0
        for p in new_prices:
            pid = p.price_id
            contract_prices = existing.setdefault(p.contract_id, [])
            existing_ids = {ep.price_id for ep in contract_prices}
            if pid not in existing_ids:
                contract_prices.append(p)
                added += 1
        self.save_prices(existing)
        return added

    def load_judgments(self) -> dict[str, BarrierJudgment]:
        data = self._load_json(self._judgments_file)
        return {
            BarrierJudgment.from_dict(d).judgment_id: BarrierJudgment.from_dict(d)
            for d in data
        }

    def save_judgments(self, judgments: dict[str, BarrierJudgment]) -> None:
        data = [j.to_dict() for j in judgments.values()]
        self._atomic_write(self._judgments_file, json.dumps(data, ensure_ascii=False, indent=2))

    def upsert_judgments(self, new_judgments: list[BarrierJudgment]) -> tuple[int, int]:
        existing = self.load_judgments()
        added = 0
        skipped = 0
        for j in new_judgments:
            jid = j.judgment_id
            if jid in existing and existing[jid].manually_overridden:
                skipped += 1
                continue
            if jid in existing and existing[jid].status != JudgmentStatus.PENDING and j.status == JudgmentStatus.PENDING:
                skipped += 1
                continue
            if jid in existing:
                skipped += 1
                continue
            existing[jid] = j
            added += 1
        self.save_judgments(existing)
        return added, skipped

    def override_judgment(
        self,
        contract_id: str,
        observation_date: date,
        new_status: str,
        reason: str,
        changed_by: str = "manual",
    ) -> BarrierJudgment | None:
        from .models import JudgmentStatus
        judgments = self.load_judgments()
        jid = f"{contract_id}:{observation_date.isoformat()}"
        if jid not in judgments:
            return None
        j = judgments[jid]
        old_status = j.status.value
        j.status = JudgmentStatus(new_status)
        j.manually_overridden = True
        j.override_reason = reason
        if new_status == "breached":
            j.breach_type = "manual_override"
        judgments[jid] = j
        self.save_judgments(judgments)
        return j

    def load_reminders(self) -> dict[str, Reminder]:
        data = self._load_json(self._reminders_file)
        result: dict[str, Reminder] = {}
        for d in data:
            r = Reminder.from_dict(d)
            result[r.reminder_id] = r
        return result

    def save_reminders(self, reminders: dict[str, Reminder]) -> None:
        data = [r.to_dict() for r in reminders.values()]
        self._atomic_write(self._reminders_file, json.dumps(data, ensure_ascii=False, indent=2))

    def load_history(self) -> list[HistoryEntry]:
        data = self._load_json(self._history_file)
        return [HistoryEntry.from_dict(d) for d in data]

    def append_history(self, entries: list[HistoryEntry]) -> None:
        existing = self.load_history()
        existing_ids = {e.entry_id for e in existing}
        for e in entries:
            if e.entry_id not in existing_ids:
                existing.append(e)
        self._atomic_write(
            self._history_file,
            json.dumps(
                [e.to_dict() for e in existing],
                ensure_ascii=False,
                indent=2,
            ),
        )

    def export_history_csv(self, output_path: str | Path) -> int:
        import csv
        entries = self.load_history()
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "entry_id", "contract_id", "field_changed",
                "old_value", "new_value", "changed_by",
                "changed_at", "reason",
            ])
            for e in entries:
                writer.writerow([
                    e.entry_id,
                    e.contract_id,
                    e.field_changed,
                    e.old_value,
                    e.new_value,
                    e.changed_by,
                    e.changed_at.isoformat() if e.changed_at else "",
                    e.reason or "",
                ])
        return len(entries)

    def _load_json(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        with open(path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                return []
            return json.loads(content)

    @staticmethod
    def _atomic_write(path: Path, content: str) -> None:
        dir_name = path.parent
        dir_name.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=str(dir_name), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, str(path))
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise
