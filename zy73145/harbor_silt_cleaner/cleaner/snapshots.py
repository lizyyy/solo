import uuid
import json
import os
from datetime import datetime
from config import DATA_DIR
from models.records import CleanSnapshot


class SnapshotManager:
    def __init__(self):
        os.makedirs(DATA_DIR, exist_ok=True)
        self._snapshots = []
        self._load_all()

    def _load_all(self):
        path = os.path.join(DATA_DIR, "snapshots.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                self._snapshots = json.load(f)

    def _save_all(self):
        path = os.path.join(DATA_DIR, "snapshots.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._snapshots, f, ensure_ascii=False, indent=2)

    def create_snapshot(self, name, summary, records, filter_criteria):
        snap_id = "snap_" + str(uuid.uuid4())[:8]
        now = datetime.now().isoformat()

        prev = self._snapshots[-1] if self._snapshots else None
        delta = None
        if prev:
            delta = {
                "avg_diff": round(
                    summary["overall_avg_silt_depth"] - prev["summary"]["overall_avg_silt_depth"],
                    3,
                ),
                "valid_count_diff": summary["valid_records"] - prev["summary"]["valid_records"],
                "anomaly_count_diff": summary["anomaly_records"] - prev["summary"]["anomaly_records"],
            }

        snap = CleanSnapshot(
            snapshot_id=snap_id,
            snapshot_name=name,
            created_at=now,
            filter_criteria=filter_criteria,
            summary=summary,
            records=[r.to_dict() if hasattr(r, "to_dict") else r for r in records],
            delta_vs_previous=delta,
        )
        self._snapshots.append(snap.to_dict())
        self._save_all()
        return snap.to_dict()

    def list_snapshots(self, confirmed_only=False):
        result = []
        for s in self._snapshots:
            if confirmed_only and not s.get("confirmed"):
                continue
            result.append({
                "snapshot_id": s["snapshot_id"],
                "snapshot_name": s["snapshot_name"],
                "created_at": s["created_at"],
                "confirmed": s.get("confirmed", False),
                "confirmed_by": s.get("confirmed_by"),
                "confirmed_at": s.get("confirmed_at"),
                "overall_avg_silt_depth": s["summary"]["overall_avg_silt_depth"],
                "valid_records": s["summary"]["valid_records"],
                "anomaly_records": s["summary"]["anomaly_records"],
                "delta_vs_previous": s.get("delta_vs_previous"),
            })
        return result

    def get_snapshot(self, snap_id):
        for s in self._snapshots:
            if s["snapshot_id"] == snap_id:
                return s
        return None

    def confirm_snapshot(self, snap_id, operator="老何"):
        for s in self._snapshots:
            if s["snapshot_id"] == snap_id:
                s["confirmed"] = True
                s["confirmed_by"] = operator
                s["confirmed_at"] = datetime.now().isoformat()
                self._save_all()
                return s
        return None

    def compare_snapshots(self, snap_id1, snap_id2):
        s1 = self.get_snapshot(snap_id1)
        s2 = self.get_snapshot(snap_id2)
        if not s1 or not s2:
            return None

        changed_ids = set()
        record_map_1 = {r["id"]: r for r in s1["records"]}
        record_map_2 = {r["id"]: r for r in s2["records"]}

        all_ids = set(record_map_1.keys()) | set(record_map_2.keys())
        changed = []
        for rid in all_ids:
            r1 = record_map_1.get(rid)
            r2 = record_map_2.get(rid)
            if r1 and r2 and r1.get("silt_depth") != r2.get("silt_depth"):
                changed.append({
                    "id": rid,
                    "station": r2["station"],
                    "measure_time": r2["measure_time"],
                    "before": r1.get("silt_depth"),
                    "after": r2.get("silt_depth"),
                    "diff": round(r2["silt_depth"] - r1["silt_depth"], 3),
                    "source_before": r1.get("source"),
                    "source_after": r2.get("source"),
                    "is_override_after": r2.get("is_override", False),
                    "override_note": r2.get("override_note"),
                })
            elif r1 and not r2:
                changed.append({
                    "id": rid,
                    "station": r1["station"],
                    "measure_time": r1["measure_time"],
                    "before": r1.get("silt_depth"),
                    "after": None,
                    "diff": -r1.get("silt_depth", 0),
                    "change_type": "removed",
                })
            elif not r1 and r2:
                changed.append({
                    "id": rid,
                    "station": r2["station"],
                    "measure_time": r2["measure_time"],
                    "before": None,
                    "after": r2.get("silt_depth"),
                    "diff": r2.get("silt_depth", 0),
                    "change_type": "added",
                })

        return {
            "snapshot_1": snap_id1,
            "snapshot_2": snap_id2,
            "summary_diff": {
                "avg_before": s1["summary"]["overall_avg_silt_depth"],
                "avg_after": s2["summary"]["overall_avg_silt_depth"],
                "avg_change": round(
                    s2["summary"]["overall_avg_silt_depth"] - s1["summary"]["overall_avg_silt_depth"],
                    3,
                ),
                "valid_before": s1["summary"]["valid_records"],
                "valid_after": s2["summary"]["valid_records"],
            },
            "changed_records": sorted(changed, key=lambda x: abs(x["diff"]), reverse=True),
        }


snapshot_manager = SnapshotManager()
