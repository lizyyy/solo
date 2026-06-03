from __future__ import annotations

import copy
from datetime import datetime
from typing import Optional

from .models import ScoringWeightTable, WeightEntry, ParameterVersion


class VersionManager:
    """
    参数版本管理器。
    评分权重表每次补录或更新，版本号 +1，
    同时保留一份快照，让核算结果可以追溯当时用的是哪一版参数。
    """

    def __init__(self) -> None:
        self._history: list[ParameterVersion] = []

    def register(self, table: ScoringWeightTable, remark: str = "") -> ParameterVersion:
        ver = ParameterVersion(
            version=table.version,
            weight_table_name=table.name,
            entries_snapshot=copy.deepcopy(table.entries),
            is_supplemented=table.is_supplemented,
            created_at=datetime.now().isoformat(),
            remark=remark,
        )
        self._history.append(ver)
        return ver

    def supplement(
        self,
        table: ScoringWeightTable,
        new_entries: list[WeightEntry],
        remark: str = "",
    ) -> ParameterVersion:
        table.entries = new_entries
        table.version += 1
        table.is_supplemented = True
        table.created_at = datetime.now().isoformat()
        return self.register(table, remark=remark or f"补录评分权重表 → v{table.version}")

    def current_version(self) -> Optional[ParameterVersion]:
        if not self._history:
            return None
        return self._history[-1]

    def get_version(self, version: int) -> Optional[ParameterVersion]:
        for v in reversed(self._history):
            if v.version == version:
                return v
        return None

    def list_versions(self) -> list[ParameterVersion]:
        return list(self._history)

    def format_version_page(self) -> str:
        if not self._history:
            return "（暂无版本记录）"

        lines = ["参数版本页", "=" * 50]
        for v in self._history:
            tag = " [补录]" if v.is_supplemented else ""
            lines.append(f"  v{v.version}{tag}  {v.created_at}  {v.remark}")
            for e in v.entries_snapshot:
                lines.append(f"    - {e.dimension}: 权重={e.weight}, 评分={e.score}")
        return "\n".join(lines)
