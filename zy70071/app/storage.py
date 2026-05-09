from typing import Dict, Optional, List
from app.models import VisitorResponse, Permission, ParkingSpot, AnomalyRecord, AuditLog


class InMemoryStorage:
    def __init__(self):
        self.visitors: Dict[str, VisitorResponse] = {}
        self.permissions: Dict[str, Permission] = {}
        self.parkings: Dict[str, ParkingSpot] = {}
        self.anomalies: Dict[str, AnomalyRecord] = {}
        self.audit_logs: List[AuditLog] = []
        self._visitor_history: Dict[str, List[VisitorResponse]] = {}

    def save_visitor(self, visitor: VisitorResponse) -> VisitorResponse:
        if visitor.id not in self._visitor_history:
            self._visitor_history[visitor.id] = []
            self._visitor_history[visitor.id].append(visitor.model_copy())
        else:
            last = self._visitor_history[visitor.id][-1]
            important_fields = [
                'status', 'scheduled_start_time', 'scheduled_end_time',
                'access_areas', 'needs_parking', 'car_plate',
                'visitor_name', 'visitor_phone', 'visitor_company',
                'host_name', 'host_department', 'purpose',
                'actual_checkin_time', 'actual_checkout_time'
            ]
            has_important_change = False
            for field in important_fields:
                old_val = getattr(last, field)
                new_val = getattr(visitor, field)
                if isinstance(old_val, list) and isinstance(new_val, list):
                    if set(old_val) != set(new_val):
                        has_important_change = True
                        break
                elif old_val != new_val:
                    has_important_change = True
                    break
            if has_important_change:
                self._visitor_history[visitor.id].append(visitor.model_copy())
        
        self.visitors[visitor.id] = visitor
        return visitor

    def get_visitor(self, visitor_id: str) -> Optional[VisitorResponse]:
        return self.visitors.get(visitor_id)

    def get_visitor_history(self, visitor_id: str) -> List[VisitorResponse]:
        return self._visitor_history.get(visitor_id, [])

    def save_permission(self, permission: Permission) -> Permission:
        self.permissions[permission.id] = permission
        return permission

    def get_permission(self, permission_id: str) -> Optional[Permission]:
        return self.permissions.get(permission_id)

    def get_permission_by_visitor(self, visitor_id: str) -> Optional[Permission]:
        visitor = self.get_visitor(visitor_id)
        if visitor and visitor.permission_id:
            return self.permissions.get(visitor.permission_id)
        all_permissions = [p for p in self.permissions.values() if p.visitor_id == visitor_id]
        if not all_permissions:
            return None
        all_permissions.sort(key=lambda p: p.issued_at or p.revoked_at, reverse=True)
        return all_permissions[0]

    def save_parking(self, parking: ParkingSpot) -> ParkingSpot:
        self.parkings[parking.id] = parking
        return parking

    def get_parking(self, parking_id: str) -> Optional[ParkingSpot]:
        return self.parkings.get(parking_id)

    def get_parking_by_visitor(self, visitor_id: str) -> Optional[ParkingSpot]:
        visitor = self.get_visitor(visitor_id)
        if visitor and visitor.parking_id:
            return self.parkings.get(visitor.parking_id)
        all_parkings = [p for p in self.parkings.values() if p.visitor_id == visitor_id]
        if not all_parkings:
            return None
        all_parkings.sort(key=lambda p: p.assigned_at or p.released_at, reverse=True)
        return all_parkings[0]

    def save_anomaly(self, anomaly: AnomalyRecord) -> AnomalyRecord:
        self.anomalies[anomaly.id] = anomaly
        return anomaly

    def get_anomaly(self, anomaly_id: str) -> Optional[AnomalyRecord]:
        return self.anomalies.get(anomaly_id)

    def get_anomalies_by_visitor(self, visitor_id: str) -> List[AnomalyRecord]:
        return [a for a in self.anomalies.values() if a.visitor_id == visitor_id]

    def get_unresolved_anomalies(self) -> List[AnomalyRecord]:
        return [a for a in self.anomalies.values() if not a.resolved]

    def add_audit_log(self, log: AuditLog) -> AuditLog:
        self.audit_logs.append(log)
        return log

    def get_audit_logs_by_visitor(self, visitor_id: str) -> List[AuditLog]:
        return [log for log in self.audit_logs if log.visitor_id == visitor_id]


storage = InMemoryStorage()
