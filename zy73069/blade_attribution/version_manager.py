"""版本管理：同样的材料重跑时区分旧处理、后补备注和最新导出"""
import hashlib
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from copy import deepcopy

from .models import AttributionRecord, RecordStatus, VersionMeta


def material_hash(measurement_dict: Dict) -> str:
    """根据原始测量材料生成哈希，判断是否为同一份材料重跑"""
    raw = json.dumps(measurement_dict, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]


class VersionManager:
    def __init__(self):
        self._history: Dict[str, List[AttributionRecord]] = {}

    def new_run_id(self) -> str:
        return "RUN-" + datetime.now().strftime("%Y%m%d%H%M%S")

    def register_run(self, record: AttributionRecord, run_id: Optional[str] = None,
                     is_rerun: bool = False, appended_note: Optional[str] = None) -> AttributionRecord:
        """注册一次运行，给记录打上版本状态标签"""
        rid = run_id or self.new_run_id()
        rec = deepcopy(record)
        m_dict = {
            "turbine": rec.measurement.turbine_id,
            "blade": rec.measurement.blade_no,
            "timestamp": rec.measurement.timestamp,
            "vibration": rec.measurement.vibration_velocity,
            "temperature": rec.measurement.temperature,
            "pitch": rec.measurement.pitch_angle
        }
        mh = material_hash(m_dict)

        if mh not in self._history:
            self._history[mh] = []

        prev = self._history[mh]
        status = RecordStatus.NEW
        prev_run = None

        if prev:
            last = prev[-1]
            prev_run = last.version.run_id
            if is_rerun and appended_note:
                status = RecordStatus.APPENDED
                last.version.status = RecordStatus.PROCESSED
            elif is_rerun:
                status = RecordStatus.EXPORTED
                last.version.status = RecordStatus.PROCESSED
            else:
                status = RecordStatus.PROCESSED
        else:
            status = RecordStatus.NEW

        rec.version = VersionMeta(
            record_id=rec.record_id,
            run_id=rid,
            status=status,
            previous_run_id=prev_run,
            appended_note=appended_note,
            exported=(status == RecordStatus.EXPORTED)
        )
        self._history[mh].append(rec)
        return rec

    def mark_exported(self, record: AttributionRecord) -> AttributionRecord:
        """标记为最新导出"""
        rec = deepcopy(record)
        mh = material_hash({
            "turbine": rec.measurement.turbine_id,
            "blade": rec.measurement.blade_no,
            "timestamp": rec.measurement.timestamp,
            "vibration": rec.measurement.vibration_velocity,
            "temperature": rec.measurement.temperature,
            "pitch": rec.measurement.pitch_angle
        })
        if mh in self._history:
            for r in self._history[mh]:
                if r.version.run_id == rec.version.run_id:
                    r.version.status = RecordStatus.EXPORTED
                    r.version.exported = True
        rec.version.status = RecordStatus.EXPORTED
        rec.version.exported = True
        return rec

    def get_material_versions(self, record: AttributionRecord) -> List[Dict]:
        """取同一份材料的全部处理版本，区分旧处理、后补备注、最新导出"""
        mh = material_hash({
            "turbine": record.measurement.turbine_id,
            "blade": record.measurement.blade_no,
            "timestamp": record.measurement.timestamp,
            "vibration": record.measurement.vibration_velocity,
            "temperature": record.measurement.temperature,
            "pitch": record.measurement.pitch_angle
        })
        history = self._history.get(mh, [])
        versions = []
        for idx, h in enumerate(history):
            versions.append({
                "order": idx + 1,
                "run_id": h.version.run_id,
                "status": h.version.status.value,
                "is_latest_export": (h.version.status == RecordStatus.EXPORTED and
                                     idx == len(history) - 1),
                "is_old_processed": h.version.status == RecordStatus.PROCESSED,
                "is_appended": h.version.status == RecordStatus.APPENDED,
                "appended_note": h.version.appended_note or "",
                "created_at": h.version.created_at,
                "previous_run": h.version.previous_run_id or ""
            })
        return versions

    def classify_batch(self, records: List[AttributionRecord]) -> Dict[str, List[AttributionRecord]]:
        """把一批记录按版本状态分组"""
        groups = {s.value: [] for s in RecordStatus}
        for r in records:
            groups[r.version.status.value].append(r)
        return groups

    def version_summary(self, records: List[AttributionRecord]) -> Dict[str, Any]:
        """整批版本统计摘要"""
        groups = self.classify_batch(records)
        return {
            "total": len(records),
            "new_collected": len(groups[RecordStatus.NEW.value]),
            "old_processed": len(groups[RecordStatus.PROCESSED.value]),
            "appended_notes": len(groups[RecordStatus.APPENDED.value]),
            "latest_exported": len(groups[RecordStatus.EXPORTED.value]),
            "unique_materials": len(self._history),
            "distribution": {k: len(v) for k, v in groups.items()}
        }
