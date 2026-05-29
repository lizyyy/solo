from __future__ import annotations

from dataclasses import dataclass

from .models import Reminder


@dataclass
class ReminderResult:
    reminder: Reminder
    is_new: bool


class ReminderManager:
    def add_reminder(
        self,
        reminder: Reminder,
        existing: dict[str, Reminder],
    ) -> ReminderResult:
        rid = reminder.reminder_id
        if rid in existing:
            return ReminderResult(reminder=existing[rid], is_new=False)
        existing[rid] = reminder
        return ReminderResult(reminder=reminder, is_new=True)

    def get_pending(
        self, existing: dict[str, Reminder]
    ) -> list[Reminder]:
        return [r for r in existing.values() if not r.sent]

    def mark_sent(
        self,
        reminder_id: str,
        existing: dict[str, Reminder],
    ) -> Reminder | None:
        if reminder_id in existing:
            existing[reminder_id].sent = True
            return existing[reminder_id]
        return None

    def dedup_by_client_contract(
        self,
        reminders: list[Reminder],
    ) -> list[Reminder]:
        seen: set[str] = set()
        result: list[Reminder] = []
        for r in reminders:
            key = f"{r.client_id}:{r.contract_id}:{r.event_type.value}"
            if key not in seen:
                seen.add(key)
                result.append(r)
        return result
