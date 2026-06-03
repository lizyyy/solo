from __future__ import annotations

from typing import Optional

from mine_support_marker.models import MarkerRecord


class MarkerRepository:
    def __init__(self) -> None:
        self._store: dict[str, MarkerRecord] = {}

    def add(self, record: MarkerRecord) -> None:
        self._store[record.marker_id] = record

    def get(self, marker_id: str) -> Optional[MarkerRecord]:
        return self._store.get(marker_id)

    def remove(self, marker_id: str) -> None:
        self._store.pop(marker_id, None)

    def find_by_photo_number(self, photo_number: str) -> list[MarkerRecord]:
        return [r for r in self._store.values() if r.photo_number == photo_number]

    def find_by_batch_id(self, batch_id: str) -> list[MarkerRecord]:
        return [r for r in self._store.values() if r.import_batch_id == batch_id]

    def find_by_identity(self, photo_number: str, batch_id: str) -> Optional[MarkerRecord]:
        for r in self._store.values():
            if r.photo_number == photo_number and r.import_batch_id == batch_id:
                return r
        return None

    def find_by_cad_layer(self, cad_layer_name: str) -> list[MarkerRecord]:
        return [r for r in self._store.values() if r.cad_layer_name == cad_layer_name]

    def all(self) -> list[MarkerRecord]:
        return list(self._store.values())

    def count(self) -> int:
        return len(self._store)

    def clear(self) -> None:
        self._store.clear()
