from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Any

import config


@dataclass
class HistoryEntry:
    timestamp: datetime
    action: str
    description: str
    snapshot: Any
    model_id: Optional[str] = None
    user: str = "系统"


class HistoryManager:
    def __init__(self, max_history: int = None):
        self.max_history = max_history or config.MAX_HISTORY_SIZE
        self._history: List[HistoryEntry] = []
        self._current_index = -1

    @property
    def can_undo(self) -> bool:
        return self._current_index > 0

    @property
    def can_redo(self) -> bool:
        return self._current_index < len(self._history) - 1

    @property
    def history_count(self) -> int:
        return len(self._history)

    @property
    def current_position(self) -> int:
        return self._current_index

    def push(
        self,
        action: str,
        description: str,
        snapshot: Any,
        model_id: Optional[str] = None,
        user: str = "系统",
    ) -> None:
        if self._current_index < len(self._history) - 1:
            self._history = self._history[: self._current_index + 1]

        entry = HistoryEntry(
            timestamp=datetime.now(),
            action=action,
            description=description,
            snapshot=snapshot,
            model_id=model_id,
            user=user,
        )

        self._history.append(entry)

        if len(self._history) > self.max_history:
            self._history = self._history[-self.max_history:]
            self._current_index = len(self._history) - 1
        else:
            self._current_index = len(self._history) - 1

    def undo(self) -> Optional[Any]:
        if not self.can_undo:
            return None

        self._current_index -= 1
        entry = self._history[self._current_index]
        return entry.snapshot

    def redo(self) -> Optional[Any]:
        if not self.can_redo:
            return None

        self._current_index += 1
        entry = self._history[self._current_index]
        return entry.snapshot

    def get_current(self) -> Optional[Any]:
        if self._current_index >= 0 and self._current_index < len(self._history):
            return self._history[self._current_index].snapshot
        return None

    def get_history_list(self, limit: int = 20) -> List[dict]:
        start = max(0, self._current_index - limit + 1)
        entries = self._history[start: self._current_index + 1]

        result = []
        for i, entry in enumerate(reversed(entries)):
            is_current = (len(entries) - 1 - i) == (self._current_index - start)
            result.append({
                "index": self._current_index - i,
                "timestamp": entry.timestamp,
                "action": entry.action,
                "description": entry.description,
                "model_id": entry.model_id,
                "user": entry.user,
                "is_current": is_current,
            })

        return result

    def jump_to(self, index: int) -> Optional[Any]:
        if 0 <= index < len(self._history):
            self._current_index = index
            return self._history[index].snapshot
        return None

    def clear(self) -> None:
        self._history = []
        self._current_index = -1

    def create_snapshot_action(self, action: str, description: str, workbench: Any) -> None:
        snapshot = workbench.to_dict() if hasattr(workbench, "to_dict") else workbench
        self.push(action, description, snapshot)

    def get_undo_description(self) -> Optional[str]:
        if self.can_undo:
            return self._history[self._current_index - 1].description
        return None

    def get_redo_description(self) -> Optional[str]:
        if self.can_redo:
            return self._history[self._current_index + 1].description
        return None
