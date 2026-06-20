"""版本管理：版本历史持久化到本地 history.json，
可从样例数据确定性复现同一批材料的 旧处理→后补备注→最新导出 演进，
不再只放在进程内存里。"""
import hashlib
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any

from .models import AttributionRecord, RecordStatus, VersionMeta, Measurement


VERSIONS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output", "versions")
HISTORY_PATH = os.path.join(VERSIONS_DIR, "history.json")


def material_hash(measurement: Measurement) -> str:
    """根据原始测量材料生成稳定哈希(SHA256)，判断是否为同一份材料重跑。
    输入字段全部来自样例材料，跨进程/重启稳定。"""
    m_dict = {
        "turbine": measurement.turbine_id,
        "blade": measurement.blade_no,
        "timestamp": measurement.timestamp,
        "vibration": measurement.vibration_velocity,
        "temperature": measurement.temperature,
        "pitch": measurement.pitch_angle,
    }
    raw = json.dumps(m_dict, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _record_id_of(m: Measurement) -> str:
    ts = m.timestamp.replace("-", "").replace(" ", "").replace(":", "")
    return f"BA-{m.turbine_id}-B{m.blade_no}-{ts}"


def _material_snapshot(m: Measurement) -> Dict[str, Any]:
    return {
        "turbine": m.turbine_id,
        "blade": m.blade_no,
        "timestamp": m.timestamp,
        "vibration": m.vibration_velocity,
        "temperature": m.temperature,
        "pitch": m.pitch_angle,
    }


class VersionManager:
    """版本历史持久化在 output/versions/history.json。
    首次访问时从样例数据确定性播种三阶段演进(旧处理→后补备注→最新导出)，
    之后每次启动都从文件复现同一批材料的版本状态，不依赖进程内存。"""

    def __init__(self, history_path: Optional[str] = None):
        self.history_path = history_path or HISTORY_PATH
        self._history: Dict[str, List[Dict]] = self._load()

    def _ensure_dir(self):
        os.makedirs(VERSIONS_DIR, exist_ok=True)

    def _load(self) -> Dict[str, List[Dict]]:
        self._ensure_dir()
        if os.path.exists(self.history_path):
            try:
                with open(self.history_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    return data
            except (json.JSONDecodeError, OSError):
                pass
        seeded = self._seed()
        self._save(seeded)
        return seeded

    def _save(self, history: Optional[Dict] = None):
        self._ensure_dir()
        data = history if history is not None else self._history
        with open(self.history_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _seed(self) -> Dict[str, List[Dict]]:
        """从样例数据确定性播种三阶段版本演进，保证可复现"""
        from .sample_data import sample_measurements, sample_handover_notes
        notes_map = sample_handover_notes()
        history: Dict[str, List[Dict]] = {}
        for m in sample_measurements():
            mh = material_hash(m)
            key = f"{m.turbine_id}-B{m.blade_no}"
            base_date = m.timestamp[:10]
            rid = _record_id_of(m)
            note = notes_map.get(key, "现场复核后补：补充振动频谱与温度趋势图，确认非偶发")
            v1_time = f"{base_date} 08:00:00"
            v2_time = f"{base_date} 16:30:00"
            v3_time = "2026-06-10 09:00:00"
            history[mh] = [
                {
                    "run_id": f"SEED-OLD-{mh[:8]}",
                    "record_id": rid,
                    "status": RecordStatus.PROCESSED.value,
                    "previous_run_id": None,
                    "appended_note": None,
                    "created_at": v1_time,
                    "exported": False,
                    "material": _material_snapshot(m),
                    "note_kind": "初次采集处理(旧)",
                },
                {
                    "run_id": f"SEED-APPEND-{mh[:8]}",
                    "record_id": rid,
                    "status": RecordStatus.APPENDED.value,
                    "previous_run_id": f"SEED-OLD-{mh[:8]}",
                    "appended_note": f"{note} [{v2_time}]",
                    "created_at": v2_time,
                    "exported": False,
                    "material": _material_snapshot(m),
                    "note_kind": "后补备注",
                },
                {
                    "run_id": f"SEED-EXPORT-{mh[:8]}",
                    "record_id": rid,
                    "status": RecordStatus.EXPORTED.value,
                    "previous_run_id": f"SEED-APPEND-{mh[:8]}",
                    "appended_note": None,
                    "created_at": v3_time,
                    "exported": True,
                    "material": _material_snapshot(m),
                    "note_kind": "最新导出",
                },
            ]
        return history

    def new_run_id(self) -> str:
        return "RUN-" + datetime.now().strftime("%Y%m%d%H%M%S")

    def attach_latest(self, record: AttributionRecord) -> AttributionRecord:
        """把该材料最新的版本状态挂到记录上(只读，不修改历史)，用于队列展示。
        幂等且确定性：同一份 history.json → 同一状态。"""
        mh = material_hash(record.measurement)
        entries = self._history.get(mh, [])
        if not entries:
            return record
        latest = entries[-1]
        status = RecordStatus(latest["status"])
        record.version = VersionMeta(
            record_id=record.record_id,
            run_id=latest["run_id"],
            status=status,
            previous_run_id=latest.get("previous_run_id"),
            appended_note=latest.get("appended_note"),
            exported=latest.get("exported", False),
            created_at=latest["created_at"],
        )
        return record

    def append_run(self, record: AttributionRecord, status: RecordStatus,
                   appended_note: Optional[str] = None,
                   run_id: Optional[str] = None) -> Dict[str, Any]:
        """真实追加一条版本到持久化历史(用于 --with-rerun 演示真实累积)。
        追加 已导出(最新) 时，会把之前的 已导出(最新) 降级为 已处理(旧)，
        保证只有最新一条是 已导出(最新)。"""
        mh = material_hash(record.measurement)
        entries = self._history.setdefault(mh, [])
        prev_run = entries[-1]["run_id"] if entries else None
        if status == RecordStatus.EXPORTED:
            for e in entries:
                if e["status"] == RecordStatus.EXPORTED.value:
                    e["status"] = RecordStatus.PROCESSED.value
                    e["exported"] = False
                    e["note_kind"] = e.get("note_kind", "") + "(已归档)"
        entry = {
            "run_id": run_id or self.new_run_id(),
            "record_id": record.record_id,
            "status": status.value,
            "previous_run_id": prev_run,
            "appended_note": appended_note,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "exported": status == RecordStatus.EXPORTED,
            "material": _material_snapshot(record.measurement),
            "note_kind": status.value,
        }
        entries.append(entry)
        self._save()
        return entry

    def get_material_versions(self, record: AttributionRecord) -> List[Dict[str, Any]]:
        """取同一份材料的全部处理版本，区分旧处理/后补备注/最新导出(读自持久化文件)"""
        mh = material_hash(record.measurement)
        entries = self._history.get(mh, [])
        n = len(entries)
        versions = []
        for idx, e in enumerate(entries):
            status = RecordStatus(e["status"])
            versions.append({
                "order": idx + 1,
                "run_id": e["run_id"],
                "status": e["status"],
                "is_latest_export": (status == RecordStatus.EXPORTED and idx == n - 1),
                "is_old_processed": status == RecordStatus.PROCESSED,
                "is_appended": status == RecordStatus.APPENDED,
                "appended_note": e.get("appended_note") or "",
                "created_at": e["created_at"],
                "previous_run": e.get("previous_run_id") or "",
                "note_kind": e.get("note_kind", ""),
            })
        return versions

    def classify_batch(self, records: List[AttributionRecord]) -> Dict[str, List[AttributionRecord]]:
        groups = {s.value: [] for s in RecordStatus}
        for r in records:
            groups.setdefault(r.version.status.value, []).append(r)
        return groups

    def version_summary(self, records: List[AttributionRecord]) -> Dict[str, Any]:
        groups = {s.value: 0 for s in RecordStatus}
        for r in records:
            groups[r.version.status.value] = groups.get(r.version.status.value, 0) + 1
        return {
            "total": len(records),
            "distribution": groups,
            "unique_materials": len(self._history),
            "total_version_entries": sum(len(v) for v in self._history.values()),
        }

    def reset(self):
        """重置为样例播种状态(清掉真实追加的版本)"""
        self._history = self._seed()
        self._save()

    @property
    def history_path_resolved(self) -> str:
        return self.history_path
