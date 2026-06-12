import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from models import (
    NightSamplingPoint,
    ServiceRadiusResult,
    ImportBatch,
    PointStatus,
    AbnormalType,
    AuditLog,
)


class DataStore:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.points: Dict[str, NightSamplingPoint] = {}
        self.radius_results: Dict[str, ServiceRadiusResult] = {}
        self.batches: Dict[str, ImportBatch] = {}
        self.point_by_complaint: Dict[str, str] = {}
        self.point_index: Dict[str, List[str]] = defaultdict(list)

    def _build_index(self, point: NightSamplingPoint):
        key = f"{point.name}_{point.address}"
        self.point_index[key].append(point.id)
        if point.complaint_id:
            self.point_by_complaint[point.complaint_id] = point.id

    def add_point(self, point: NightSamplingPoint) -> None:
        self.points[point.id] = point
        self._build_index(point)

    def get_point(self, point_id: str) -> Optional[NightSamplingPoint]:
        return self.points.get(point_id)

    def update_point(self, point_id: str, **kwargs) -> NightSamplingPoint:
        point = self.points[point_id]
        before = point.model_dump()

        audit_operator = kwargs.pop("operator", None)
        audit_action = kwargs.pop("action", None)
        audit_remark = kwargs.pop("remark", None)

        for key, value in kwargs.items():
            if hasattr(point, key):
                setattr(point, key, value)
        point.updated_at = datetime.now()
        if audit_operator and audit_action:
            audit = AuditLog(
                operator=audit_operator,
                action=audit_action,
                before=before,
                after=point.model_dump(),
                remark=audit_remark,
            )
            point.audit_logs.append(audit)
        if point.complaint_id:
            self.point_by_complaint[point.complaint_id] = point.id
        return point

    def get_all_points(self) -> List[NightSamplingPoint]:
        return list(self.points.values())

    def add_radius_result(self, result: ServiceRadiusResult) -> None:
        self.radius_results[result.point_id] = result

    def get_radius_result(self, point_id: str) -> Optional[ServiceRadiusResult]:
        return self.radius_results.get(point_id)

    def get_all_radius_results(self) -> List[ServiceRadiusResult]:
        return list(self.radius_results.values())

    def add_batch(self, batch: ImportBatch) -> None:
        self.batches[batch.batch_id] = batch

    def get_batch(self, batch_id: str) -> Optional[ImportBatch]:
        return self.batches.get(batch_id)

    def get_duplicate_points(self) -> List[List[NightSamplingPoint]]:
        duplicates = []
        for key, point_ids in self.point_index.items():
            if len(point_ids) > 1:
                duplicates.append([self.points[pid] for pid in point_ids])
        return duplicates

    def get_points_by_status(self, status: PointStatus) -> List[NightSamplingPoint]:
        return [p for p in self.points.values() if p.status == status]

    def get_points_by_abnormal_type(
        self, abnormal_type: AbnormalType
    ) -> List[NightSamplingPoint]:
        return [p for p in self.points.values() if abnormal_type in p.abnormal_types]


store = DataStore()
