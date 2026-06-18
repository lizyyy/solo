"""持久化与幂等导入。

核心约束：
1. 重复导入不翻倍：按 fingerprint 判断；
2. 人工备注（ManualNote）受保护，不被覆盖；
3. 人工改口径必须写入 ChangeLog，保留旧值、新判断、原因。
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime
from typing import Any, Iterable, Optional

from .models import (
    AlignedPair,
    BuoyLog,
    ChangeLog,
    DataSource,
    DriftMark,
    ManualNote,
    ProcessStatus,
    WarningLevel,
    WarningRecord,
)


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


class HarborStorage:
    """基于 JSON 文件的简单存储。路径稳定，便于复核人日常脚本。"""

    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        os.makedirs(base_dir, exist_ok=True)
        self._paths = {
            "buoy_logs": os.path.join(base_dir, "buoy_logs.jsonl"),
            "warnings": os.path.join(base_dir, "warnings.jsonl"),
            "drifts": os.path.join(base_dir, "drifts.jsonl"),
            "notes": os.path.join(base_dir, "notes.jsonl"),
            "changes": os.path.join(base_dir, "changes.jsonl"),
            "aligned_pairs": os.path.join(base_dir, "aligned_pairs.jsonl"),
            "fingerprints": os.path.join(base_dir, "fingerprints.idx"),
        }
        self._fingerprints: set[str] = self._load_fingerprints()
        self._indexes: dict[str, dict[str, int]] = {
            "buoy_logs": {},
            "warnings": {},
            "drifts": {},
            "notes": {},
            "changes": {},
            "aligned_pairs": {},
        }
        self._rebuild_indexes()

    # ---------- 基础IO ----------
    def _load_fingerprints(self) -> set[str]:
        p = self._paths["fingerprints"]
        if not os.path.exists(p):
            return set()
        with open(p, "r", encoding="utf-8") as f:
            return {line.strip() for line in f if line.strip()}

    def _save_fingerprints(self) -> None:
        with open(self._paths["fingerprints"], "w", encoding="utf-8") as f:
            for fp in sorted(self._fingerprints):
                f.write(fp + "\n")

    def _append(self, store: str, obj: dict[str, Any]) -> None:
        path = self._paths[store]
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    def _read_all(self, store: str) -> list[dict[str, Any]]:
        path = self._paths[store]
        if not os.path.exists(path):
            return []
        rows: list[dict[str, Any]] = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return rows

    def _rebuild_indexes(self) -> None:
        key_map = {
            "buoy_logs": "log_id",
            "warnings": "warning_id",
            "drifts": "mark_id",
            "notes": "note_id",
            "changes": "change_id",
            "aligned_pairs": "pair_id",
        }
        for store, key in key_map.items():
            self._indexes[store] = {}
            for i, row in enumerate(self._read_all(store)):
                if key in row:
                    self._indexes[store][row[key]] = i

    # ---------- 幂等导入 ----------
    def import_buoy_log(self, log: BuoyLog) -> tuple[bool, str]:
        """导入浮标日志。

        返回 (是否新导入, 消息)。消息文案稳定供脚本解析。
        - 全新: (True,  "IMPORTED_NEW:<log_id>")
        - 重复: (False, "IMPORT_SKIP_DUPLICATE:<log_id>")
        """
        if log.fingerprint in self._fingerprints:
            return False, f"IMPORT_SKIP_DUPLICATE:{log.log_id}"
        self._append("buoy_logs", log.to_dict())
        idx = self._indexes["buoy_logs"]
        idx[log.log_id] = len(self._read_all("buoy_logs")) - 1
        self._fingerprints.add(log.fingerprint)
        self._save_fingerprints()
        return True, f"IMPORTED_NEW:{log.log_id}"

    def import_buoy_logs(self, logs: Iterable[BuoyLog]) -> dict[str, int]:
        """批量导入。返回统计信息：new/skipped/total。"""
        total = 0
        new = 0
        skipped = 0
        for log in logs:
            total += 1
            ok, _ = self.import_buoy_log(log)
            if ok:
                new += 1
            else:
                skipped += 1
        return {"total": total, "new": new, "skipped": skipped}

    # ---------- 查询 ----------
    def list_buoy_logs(
        self,
        source: Optional[DataSource] = None,
        status: Optional[ProcessStatus] = None,
        buoy_id: Optional[str] = None,
    ) -> list[BuoyLog]:
        rows = self._read_all("buoy_logs")
        out: list[BuoyLog] = []
        for r in rows:
            if source and r.get("source") != source.value:
                continue
            if status and r.get("process_status") != status.value:
                continue
            if buoy_id and r.get("buoy_id") != buoy_id:
                continue
            try:
                out.append(
                    BuoyLog(
                        log_id=r["log_id"],
                        timestamp=r["timestamp"],
                        source=DataSource(r["source"]),
                        process_status=ProcessStatus(r.get("process_status", "pending")),
                        water_depth=r.get("water_depth"),
                        sediment_thickness=r.get("sediment_thickness"),
                        flow_velocity=r.get("flow_velocity"),
                        temperature=r.get("temperature"),
                        buoy_id=r.get("buoy_id"),
                        ship_id=r.get("ship_id"),
                        raw_fields=r.get("raw_fields", {}),
                        fingerprint=r.get("fingerprint", ""),
                        imported_at=r.get("imported_at", ""),
                    )
                )
            except (KeyError, ValueError):
                continue
        return out

    def get_buoy_log(self, log_id: str) -> Optional[BuoyLog]:
        for bl in self.list_buoy_logs():
            if bl.log_id == log_id:
                return bl
        return None

    def list_warnings(self, level: Optional[WarningLevel] = None) -> list[WarningRecord]:
        rows = self._read_all("warnings")
        out = []
        for r in rows:
            if level and r.get("warning_level") != level.value:
                continue
            try:
                out.append(
                    WarningRecord(
                        warning_id=r["warning_id"],
                        buoy_log_id=r["buoy_log_id"],
                        buoy_id=r.get("buoy_id"),
                        timestamp=r["timestamp"],
                        warning_level=WarningLevel(r["warning_level"]),
                        source=DataSource(r["source"]),
                        process_status=ProcessStatus(r.get("process_status", "warning_raised")),
                        water_depth=r.get("water_depth"),
                        sediment_thickness=r.get("sediment_thickness"),
                        sediment_rate=r.get("sediment_rate"),
                        threshold_value=r.get("threshold_value", 0.0),
                        actual_value=r.get("actual_value", 0.0),
                        description=r.get("description", ""),
                        created_at=r.get("created_at", ""),
                    )
                )
            except (KeyError, ValueError):
                continue
        return out

    def list_drift_marks(self) -> list[DriftMark]:
        rows = self._read_all("drifts")
        out = []
        for r in rows:
            try:
                out.append(DriftMark(**r))
            except TypeError:
                continue
        return out

    def list_aligned_pairs(self, buoy_id: Optional[str] = None) -> list[AlignedPair]:
        rows = self._read_all("aligned_pairs")
        out = []
        for r in rows:
            if buoy_id and r.get("buoy_id") != buoy_id:
                continue
            try:
                out.append(AlignedPair(**r))
            except TypeError:
                continue
        return out

    # ---------- 写入：预警/漂移/对齐 ----------
    def add_warning(self, w: WarningRecord) -> str:
        self._append("warnings", w.to_dict())
        return w.warning_id

    def add_drift_mark(self, d: DriftMark) -> str:
        self._append("drifts", d.to_dict())
        return d.mark_id

    def add_aligned_pair(self, p: AlignedPair) -> str:
        self._append("aligned_pairs", p.to_dict())
        return p.pair_id

    def update_buoy_log_status(self, log_id: str, status: ProcessStatus) -> bool:
        """原地更新 BuoyLog 的 process_status（重写文件）。"""
        rows = self._read_all("buoy_logs")
        changed = False
        for r in rows:
            if r.get("log_id") == log_id:
                r["process_status"] = status.value
                changed = True
        if changed:
            path = self._paths["buoy_logs"]
            with open(path, "w", encoding="utf-8") as f:
                for r in rows:
                    f.write(json.dumps(r, ensure_ascii=False) + "\n")
            self._rebuild_indexes()
        return changed

    # ---------- 人工备注：保护不覆盖 ----------
    def add_note(
        self,
        target_type: str,
        target_id: str,
        content: str,
        author: str = "",
    ) -> tuple[str, bool]:
        """新增备注。已存在 protected 备注则不覆盖，返回 (note_id, 是否实际写入)。"""
        existing = self.list_notes(target_type=target_type, target_id=target_id)
        if any(n.protected for n in existing):
            return existing[0].note_id, False
        nid = _uid("note")
        note = ManualNote(
            note_id=nid,
            target_type=target_type,
            target_id=target_id,
            content=content,
            author=author,
            protected=True,
        )
        self._append("notes", note.to_dict())
        return nid, True

    def list_notes(
        self,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
    ) -> list[ManualNote]:
        rows = self._read_all("notes")
        out = []
        for r in rows:
            if target_type and r.get("target_type") != target_type:
                continue
            if target_id and r.get("target_id") != target_id:
                continue
            try:
                out.append(ManualNote(**r))
            except TypeError:
                continue
        return out

    # ---------- 变更日志：改口径必记 ----------
    def log_change(
        self,
        target_type: str,
        target_id: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        reason: str,
        operator: str = "",
    ) -> str:
        cid = _uid("chg")
        entry = ChangeLog(
            change_id=cid,
            target_type=target_type,
            target_id=target_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            operator=operator,
        )
        self._append("changes", entry.to_dict())
        return cid

    def list_changes(
        self,
        target_type: Optional[str] = None,
        target_id: Optional[str] = None,
    ) -> list[ChangeLog]:
        rows = self._read_all("changes")
        out = []
        for r in rows:
            if target_type and r.get("target_type") != target_type:
                continue
            if target_id and r.get("target_id") != target_id:
                continue
            try:
                out.append(ChangeLog(**r))
            except TypeError:
                continue
        return out

    # ---------- 预警级别人工改口径 ----------
    def revise_warning_level(
        self,
        warning_id: str,
        new_level: WarningLevel,
        reason: str,
        operator: str = "",
    ) -> tuple[bool, str]:
        """人工改预警级别：记旧值、新判断、原因，并更新状态为 MANUAL_REVISED。"""
        rows = self._read_all("warnings")
        found = False
        old_level_val: Optional[str] = None
        for r in rows:
            if r.get("warning_id") == warning_id:
                old_level_val = r.get("warning_level")
                r["warning_level"] = new_level.value
                r["process_status"] = ProcessStatus.MANUAL_REVISED.value
                found = True
                break
        if not found:
            return False, f"REVISE_NOT_FOUND:{warning_id}"
        path = self._paths["warnings"]
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        self._rebuild_indexes()
        cid = self.log_change(
            target_type="warning",
            target_id=warning_id,
            field_name="warning_level",
            old_value=old_level_val,
            new_value=new_level.value,
            reason=reason,
            operator=operator,
        )
        return True, f"REVISED:{warning_id}->{new_level.value};CHANGE:{cid}"

    def confirm_warning(
        self,
        warning_id: str,
        reason: str = "人工确认",
        operator: str = "",
    ) -> tuple[bool, str]:
        rows = self._read_all("warnings")
        found = False
        old_val = None
        for r in rows:
            if r.get("warning_id") == warning_id:
                old_val = r.get("process_status")
                r["process_status"] = ProcessStatus.MANUAL_CONFIRMED.value
                found = True
                break
        if not found:
            return False, f"CONFIRM_NOT_FOUND:{warning_id}"
        path = self._paths["warnings"]
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        self._rebuild_indexes()
        self.log_change(
            target_type="warning",
            target_id=warning_id,
            field_name="process_status",
            old_value=old_val,
            new_value=ProcessStatus.MANUAL_CONFIRMED.value,
            reason=reason,
            operator=operator,
        )
        return True, f"CONFIRMED:{warning_id}"
