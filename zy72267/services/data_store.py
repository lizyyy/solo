from typing import Dict, List, Optional, Any
from dataclasses import asdict
import json
import os
from datetime import datetime

from models import (
    PointCloudLog,
    CoordinateTable,
    PhotoPoint,
    SafetyRadiusTable,
    ReviewRecord,
    OcclusionList,
    AuditLog,
    ReviewStatus,
    ReviewIssue,
)
from utils import make_json_serializable


class DataStore:
    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._point_cloud_logs: Dict[str, PointCloudLog] = {}
        self._coordinate_tables: Dict[str, CoordinateTable] = {}
        self._photo_points: Dict[str, Dict[str, PhotoPoint]] = {}
        self._safety_radius_tables: Dict[str, SafetyRadiusTable] = {}
        self._review_records: Dict[str, Dict[str, ReviewRecord]] = {}
        self._occlusion_lists: Dict[str, OcclusionList] = {}
        self._audit_logs: List[AuditLog] = []
        self._data_file = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "data",
            "skyline_review_data.json"
        )

    def save_point_cloud_log(self, log: PointCloudLog) -> None:
        self._point_cloud_logs[log.batch_id] = log
        self._persist()

    def get_point_cloud_log(self, batch_id: str) -> Optional[PointCloudLog]:
        return self._point_cloud_logs.get(batch_id)

    def get_all_point_cloud_logs(self) -> List[PointCloudLog]:
        return list(self._point_cloud_logs.values())

    def save_coordinate_table(self, table: CoordinateTable) -> None:
        self._coordinate_tables[table.batch_id] = table
        self._persist()

    def get_coordinate_table(self, batch_id: str) -> Optional[CoordinateTable]:
        return self._coordinate_tables.get(batch_id)

    def save_photo_point(self, batch_id: str, photo_point: PhotoPoint) -> None:
        if batch_id not in self._photo_points:
            self._photo_points[batch_id] = {}
        self._photo_points[batch_id][photo_point.point_id] = photo_point
        self._persist()

    def get_photo_point(self, batch_id: str, point_id: str) -> Optional[PhotoPoint]:
        batch_points = self._photo_points.get(batch_id, {})
        return batch_points.get(point_id)

    def get_all_photo_points(self, batch_id: str) -> List[PhotoPoint]:
        batch_points = self._photo_points.get(batch_id, {})
        return list(batch_points.values())

    def save_safety_radius_table(self, table: SafetyRadiusTable) -> None:
        self._safety_radius_tables[table.batch_id] = table
        self._persist()

    def get_safety_radius_table(self, batch_id: str) -> Optional[SafetyRadiusTable]:
        return self._safety_radius_tables.get(batch_id)

    def save_review_record(self, record: ReviewRecord) -> None:
        if record.batch_id not in self._review_records:
            self._review_records[record.batch_id] = {}
        self._review_records[record.batch_id][record.point_id] = record
        self._persist()

    def get_review_record(self, batch_id: str, point_id: str) -> Optional[ReviewRecord]:
        batch_records = self._review_records.get(batch_id, {})
        return batch_records.get(point_id)

    def get_all_review_records(self, batch_id: str) -> List[ReviewRecord]:
        batch_records = self._review_records.get(batch_id, {})
        return list(batch_records.values())

    def save_occlusion_list(self, occlusion_list: OcclusionList) -> None:
        self._occlusion_lists[occlusion_list.batch_id] = occlusion_list
        self._persist()

    def get_occlusion_list(self, batch_id: str) -> Optional[OcclusionList]:
        return self._occlusion_lists.get(batch_id)

    def add_audit_log(self, log: AuditLog) -> None:
        self._audit_logs.append(log)
        self._persist()

    def get_audit_logs(self, batch_id: Optional[str] = None,
                       point_id: Optional[str] = None) -> List[AuditLog]:
        logs = self._audit_logs
        if batch_id:
            logs = [l for l in logs if l.batch_id == batch_id]
        if point_id:
            logs = [l for l in logs if l.point_id == point_id]
        return logs

    def get_point_detail(self, batch_id: str, point_id: str) -> Dict[str, Any]:
        result = {
            "batch_id": batch_id,
            "point_id": point_id,
            "point_cloud_log": None,
            "coordinate": None,
            "photo_point": None,
            "safety_radius": None,
            "review": None,
            "occlusion": None,
            "audit_logs": []
        }

        pc_log = self.get_point_cloud_log(batch_id)
        if pc_log:
            pc_record = next((r for r in pc_log.records if r.point_id == point_id), None)
            if pc_record:
                result["point_cloud_log"] = {
                    "original_line_number": pc_record.original_line_number,
                    "x": pc_record.x,
                    "y": pc_record.y,
                    "z": pc_record.z,
                    "raw_data": pc_record.raw_data,
                    "is_manually_modified": pc_record.is_manually_modified,
                    "original_x": pc_record.original_x,
                    "original_y": pc_record.original_y,
                    "original_z": pc_record.original_z,
                }

        coord_table = self.get_coordinate_table(batch_id)
        if coord_table:
            coord_record = next((r for r in coord_table.records if r.point_id == point_id), None)
            if coord_record:
                result["coordinate"] = {
                    "original_line_number": coord_record.original_line_number,
                    "x": coord_record.x,
                    "y": coord_record.y,
                    "z": coord_record.z,
                    "is_supplemented": coord_record.is_supplemented,
                    "supplemented_by": coord_record.supplemented_by,
                    "supplemented_at": coord_record.supplemented_at.isoformat() if coord_record.supplemented_at else None,
                }

        result["photo_point"] = self.get_photo_point(batch_id, point_id)

        safety_table = self.get_safety_radius_table(batch_id)
        if safety_table:
            safety_record = next((r for r in safety_table.records if r.point_id == point_id), None)
            if safety_record:
                result["safety_radius"] = {
                    "building_name": safety_record.building_name,
                    "safety_radius": safety_record.safety_radius,
                    "measured_distance": safety_record.measured_distance,
                    "is_within_safety": safety_record.is_within_safety,
                }

        result["review"] = self.get_review_record(batch_id, point_id)

        occlusion_list = self.get_occlusion_list(batch_id)
        if occlusion_list:
            occlusion_record = next((r for r in occlusion_list.records if r.point_id == point_id), None)
            if occlusion_record:
                result["occlusion"] = {
                    "occlusion_type": occlusion_record.occlusion_type.value,
                    "description": occlusion_record.description,
                    "is_confirmed": occlusion_record.is_confirmed,
                }

        result["audit_logs"] = self.get_audit_logs(batch_id, point_id)

        return result

    def get_batch_summary(self, batch_id: str) -> Dict[str, Any]:
        review_records = self.get_all_review_records(batch_id)
        pc_log = self.get_point_cloud_log(batch_id)
        coord_table = self.get_coordinate_table(batch_id)

        status_counts: Dict[str, int] = {}
        issue_counts: Dict[str, int] = {}
        for record in review_records:
            status = record.status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            for issue in record.issues:
                issue_name = issue.value
                issue_counts[issue_name] = issue_counts.get(issue_name, 0) + 1

        return {
            "batch_id": batch_id,
            "total_points": len(review_records),
            "point_cloud_count": len(pc_log.records) if pc_log else 0,
            "coordinate_count": len(coord_table.records) if coord_table else 0,
            "status_summary": status_counts,
            "issue_summary": issue_counts,
            "has_duplicate": pc_log.is_duplicate if pc_log else False,
            "imported_at": pc_log.imported_at.isoformat() if pc_log else None,
            "imported_by": pc_log.imported_by if pc_log else "",
        }

    def _persist(self) -> None:
        data = {
            "point_cloud_logs": {k: self._serialize_pc_log(v) for k, v in self._point_cloud_logs.items()},
            "coordinate_tables": {k: asdict(v) for k, v in self._coordinate_tables.items()},
            "photo_points": {k: {pk: asdict(pv) for pk, pv in v.items()} for k, v in self._photo_points.items()},
            "safety_radius_tables": {k: asdict(v) for k, v in self._safety_radius_tables.items()},
            "review_records": {k: {pk: pv.to_dict() for pk, pv in v.items()} for k, v in self._review_records.items()},
            "occlusion_lists": {k: asdict(v) for k, v in self._occlusion_lists.items()},
            "audit_logs": [l.to_dict() for l in self._audit_logs],
        }
        serializable_data = make_json_serializable(data)
        os.makedirs(os.path.dirname(self._data_file), exist_ok=True)
        with open(self._data_file, "w", encoding="utf-8") as f:
            json.dump(serializable_data, f, ensure_ascii=False, indent=2)

    def _serialize_pc_log(self, log: PointCloudLog) -> Dict[str, Any]:
        d = asdict(log)
        d["imported_at"] = log.imported_at.isoformat()
        d["records"] = []
        for r in log.records:
            rd = asdict(r)
            rd["created_at"] = r.created_at.isoformat()
            rd["updated_at"] = r.updated_at.isoformat()
            d["records"].append(rd)
        return d
