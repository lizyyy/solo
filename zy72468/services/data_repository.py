from typing import Dict, List, Optional, TypeVar, Generic
from models import (
    ConstructionNotice,
    RampRecord,
    PointList,
    ConflictRecord,
    AuditLog,
)

T = TypeVar("T")


class DataRepository:
    def __init__(self):
        self._construction_notices: Dict[str, ConstructionNotice] = {}
        self._ramp_records: Dict[str, RampRecord] = {}
        self._point_lists: Dict[str, PointList] = {}
        self._conflict_records: Dict[str, ConflictRecord] = {}
        self._audit_logs: List[AuditLog] = []

    def get_single_source(self):
        return {
            "construction_notices": list(self._construction_notices.values()),
            "ramp_records": list(self._ramp_records.values()),
            "point_lists": list(self._point_lists.values()),
            "conflict_records": list(self._conflict_records.values()),
            "audit_logs": self._audit_logs.copy(),
        }

    def add_construction_notice(self, notice: ConstructionNotice):
        self._construction_notices[notice.id] = notice

    def get_construction_notice(self, notice_id: str) -> Optional[ConstructionNotice]:
        return self._construction_notices.get(notice_id)

    def list_construction_notices(self) -> List[ConstructionNotice]:
        return list(self._construction_notices.values())

    def get_construction_notice_by_no(self, notice_no: str) -> Optional[ConstructionNotice]:
        for notice in self._construction_notices.values():
            if notice.notice_no == notice_no:
                return notice
        return None

    def add_ramp_record(self, ramp: RampRecord):
        self._ramp_records[ramp.id] = ramp

    def get_ramp_record(self, ramp_id: str) -> Optional[RampRecord]:
        return self._ramp_records.get(ramp_id)

    def list_ramp_records(self) -> List[RampRecord]:
        return list(self._ramp_records.values())

    def get_ramps_by_notice_id(self, notice_id: str) -> List[RampRecord]:
        return [r for r in self._ramp_records.values() if r.construction_notice_id == notice_id]

    def add_point_list(self, point_list: PointList):
        self._point_lists[point_list.id] = point_list

    def get_point_list(self, point_list_id: str) -> Optional[PointList]:
        return self._point_lists.get(point_list_id)

    def list_point_lists(self) -> List[PointList]:
        return list(self._point_lists.values())

    def get_latest_point_list(self) -> Optional[PointList]:
        if not self._point_lists:
            return None
        return max(self._point_lists.values(), key=lambda p: p.version)

    def add_conflict_record(self, conflict: ConflictRecord):
        self._conflict_records[conflict.id] = conflict

    def get_conflict_record(self, conflict_id: str) -> Optional[ConflictRecord]:
        return self._conflict_records.get(conflict_id)

    def list_conflict_records(self) -> List[ConflictRecord]:
        return list(self._conflict_records.values())

    def get_conflicts_by_notice_id(self, notice_id: str) -> List[ConflictRecord]:
        return [c for c in self._conflict_records.values() if c.construction_notice_id == notice_id]

    def get_conflicts_by_ramp_id(self, ramp_id: str) -> List[ConflictRecord]:
        return [c for c in self._conflict_records.values() if c.ramp_record_id == ramp_id]

    def add_audit_log(self, log: AuditLog):
        self._audit_logs.append(log)

    def list_audit_logs(self) -> List[AuditLog]:
        return self._audit_logs.copy()

    def get_audit_logs_by_entity(self, entity_type: str, entity_id: str) -> List[AuditLog]:
        return [
            log for log in self._audit_logs
            if log.target_entity_type == entity_type and log.target_entity_id == entity_id
        ]
