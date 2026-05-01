import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from .models import Event, QuarantinedEvent


class QuarantineStore:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.quarantine_file = data_dir / "quarantine.json"
        self._events: Dict[str, QuarantinedEvent] = {}
        self._load()

    def _load(self):
        if not self.quarantine_file.exists():
            return
        try:
            with open(self.quarantine_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    qe = QuarantinedEvent(
                        event=Event(**item["event"]),
                        quarantine_time=datetime.fromisoformat(item["quarantine_time"]),
                        reason=item["reason"],
                        batch_id=item["batch_id"],
                    )
                    self._events[qe.event.event_id] = qe
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"警告: 读取隔离区文件失败: {e}")

    def _save(self):
        self.data_dir.mkdir(parents=True, exist_ok=True)
        data = []
        for qe in self._events.values():
            data.append({
                "event": qe.event.model_dump(mode="json"),
                "quarantine_time": qe.quarantine_time.isoformat(),
                "reason": qe.reason,
                "batch_id": qe.batch_id,
            })
        with open(self.quarantine_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_event(self, event: Event, reason: str, batch_id: str) -> QuarantinedEvent:
        if event.event_id in self._events:
            return self._events[event.event_id]
        qe = QuarantinedEvent(
            event=event,
            quarantine_time=datetime.now(),
            reason=reason,
            batch_id=batch_id,
        )
        self._events[event.event_id] = qe
        self._save()
        return qe

    def get_event(self, event_id: str) -> Optional[QuarantinedEvent]:
        return self._events.get(event_id)

    def get_all_events(self) -> List[QuarantinedEvent]:
        return list(self._events.values())

    def get_events_by_batch(self, batch_id: str) -> List[QuarantinedEvent]:
        return [qe for qe in self._events.values() if qe.batch_id == batch_id]

    def remove_event(self, event_id: str) -> bool:
        if event_id in self._events:
            del self._events[event_id]
            self._save()
            return True
        return False

    def get_stats(self) -> Dict[str, int]:
        batch_counts: Dict[str, int] = {}
        for qe in self._events.values():
            batch_counts[qe.batch_id] = batch_counts.get(qe.batch_id, 0) + 1
        return {
            "total": len(self._events),
            "by_batch": batch_counts,
        }
