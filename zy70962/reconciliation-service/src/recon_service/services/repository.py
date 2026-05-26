"""批次仓储：基于本地 JSON 文件的简易持久化。"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional
from uuid import UUID

from ..config import DATA_DIR
from ..models import Batch


class BatchRepository:
    """批次读写到本地 JSON 文件。

    采用单文件存储，适合中小规模对账场景。
    """

    def __init__(self, root: Path | None = None) -> None:
        self.root = root or DATA_DIR
        self.root.mkdir(parents=True, exist_ok=True)
        self._index_path = self.root / "batches.json"
        self._cache: dict[UUID, Batch] = {}
        self._load()

    # ---- 内部 ----
    def _load(self) -> None:
        if not self._index_path.exists():
            return
        try:
            raw = json.loads(self._index_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return
        for item in raw:
            try:
                b = Batch.model_validate(item)
                self._cache[b.id] = b
            except Exception:
                continue

    def _persist(self) -> None:
        data = [b.model_dump(mode="json") for b in self._cache.values()]
        self._index_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    # ---- 公共 API ----
    def save(self, batch: Batch) -> Batch:
        self._cache[batch.id] = batch
        self._persist()
        return batch

    def get(self, batch_id: UUID) -> Optional[Batch]:
        return self._cache.get(batch_id)

    def list(self) -> list[Batch]:
        return sorted(self._cache.values(), key=lambda b: b.created_at, reverse=True)

    def delete(self, batch_id: UUID) -> bool:
        if batch_id in self._cache:
            del self._cache[batch_id]
            self._persist()
            return True
        return False
