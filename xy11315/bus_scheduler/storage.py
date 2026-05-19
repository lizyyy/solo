import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, TypeVar, Type
from .models import (
    ParentAppeal, GpsTrack, DriverCheckin, MatchedCase,
    RulingDecision, ReviewDecision, AuditLog, AppealStatus
)


T = TypeVar('T')


class IdempotentStore:
    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        
        self._appeals: Dict[str, ParentAppeal] = {}
        self._gps_tracks: Dict[str, GpsTrack] = {}
        self._checkins: Dict[str, DriverCheckin] = {}
        self._matched_cases: Dict[str, MatchedCase] = {}
        self._rulings: Dict[str, RulingDecision] = {}
        self._reviews: Dict[str, ReviewDecision] = {}
        self._audit_logs: List[AuditLog] = []
        self._idempotency_keys: Dict[str, str] = {}
        
        self._load_from_disk()
    
    def _get_store_path(self, name: str) -> Path:
        return self.base_path / f"{name}.json"
    
    def _save_to_disk(self):
        def serialize_dict(d: Dict[str, Any]) -> Dict:
            return {k: v.model_dump() if hasattr(v, 'model_dump') else v for k, v in d.items()}
        
        def serialize_list(l: List[Any]) -> List:
            return [v.model_dump() if hasattr(v, 'model_dump') else v for v in l]
        
        data = {
            "appeals": serialize_dict(self._appeals),
            "gps_tracks": serialize_dict(self._gps_tracks),
            "checkins": serialize_dict(self._checkins),
            "matched_cases": serialize_dict(self._matched_cases),
            "rulings": serialize_dict(self._rulings),
            "reviews": serialize_dict(self._reviews),
            "audit_logs": serialize_list(self._audit_logs),
            "idempotency_keys": self._idempotency_keys
        }
        
        with open(self._get_store_path("database"), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    
    def _load_from_disk(self):
        store_path = self._get_store_path("database")
        if not store_path.exists():
            return
        
        with open(store_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        for k, v in data.get("appeals", {}).items():
            self._appeals[k] = ParentAppeal(**v)
        for k, v in data.get("gps_tracks", {}).items():
            self._gps_tracks[k] = GpsTrack(**v)
        for k, v in data.get("checkins", {}).items():
            self._checkins[k] = DriverCheckin(**v)
        for k, v in data.get("matched_cases", {}).items():
            self._matched_cases[k] = MatchedCase(**v)
        for k, v in data.get("rulings", {}).items():
            self._rulings[k] = RulingDecision(**v)
        for k, v in data.get("reviews", {}).items():
            self._reviews[k] = ReviewDecision(**v)
        for v in data.get("audit_logs", []):
            self._audit_logs.append(AuditLog(**v))
        self._idempotency_keys = data.get("idempotency_keys", {})
    
    def _datetime_converter(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")
    
    def _generate_idempotency_key(self, data: Dict, operation: str) -> str:
        sorted_data = json.dumps(data, sort_keys=True, default=self._datetime_converter)
        key_content = f"{operation}:{sorted_data}"
        return hashlib.sha256(key_content.encode()).hexdigest()
    
    def check_idempotency(self, data: Dict, operation: str) -> Optional[str]:
        key = self._generate_idempotency_key(data, operation)
        return self._idempotency_keys.get(key)
    
    def mark_idempotent(self, data: Dict, operation: str, result_id: str):
        key = self._generate_idempotency_key(data, operation)
        self._idempotency_keys[key] = result_id
        self._save_to_disk()
    
    def add_audit_log(self, log: AuditLog):
        self._audit_logs.append(log)
        self._save_to_disk()
    
    def get_appeal(self, appeal_id: str) -> Optional[ParentAppeal]:
        return self._appeals.get(appeal_id)
    
    def add_appeal(self, appeal: ParentAppeal, operator: str, operator_role: str) -> bool:
        if appeal.appeal_id in self._appeals:
            return False
        
        idempotency_data = {
            "parent_id": appeal.parent_id,
            "student_name": appeal.student_name,
            "bus_id": appeal.bus_id,
            "route_id": appeal.route_id,
            "stop_name": appeal.stop_name,
            "scheduled_time": appeal.scheduled_time,
            "description": appeal.description
        }
        existing_id = self.check_idempotency(idempotency_data, "add_appeal")
        if existing_id:
            return False
        
        self._appeals[appeal.appeal_id] = appeal
        self.mark_idempotent(idempotency_data, "add_appeal", appeal.appeal_id)
        
        self.add_audit_log(AuditLog(
            id=f"audit_{datetime.now().timestamp()}",
            entity_type="appeal",
            entity_id=appeal.appeal_id,
            action="create",
            operator=operator,
            operator_role=operator_role,
            details={"action": "add_appeal"}
        ))
        return True
    
    def update_appeal_status(self, appeal_id: str, status: AppealStatus, operator: str, operator_role: str):
        if appeal_id in self._appeals:
            self._appeals[appeal_id].status = status
            self._save_to_disk()
            self.add_audit_log(AuditLog(
                id=f"audit_{datetime.now().timestamp()}",
                entity_type="appeal",
                entity_id=appeal_id,
                action="update_status",
                operator=operator,
                operator_role=operator_role,
                details={"new_status": status}
            ))
    
    def get_all_appeals(self) -> List[ParentAppeal]:
        return list(self._appeals.values())
    
    def get_gps_track(self, track_id: str) -> Optional[GpsTrack]:
        return self._gps_tracks.get(track_id)
    
    def add_gps_track(self, track: GpsTrack, operator: str, operator_role: str) -> bool:
        if track.track_id in self._gps_tracks:
            return False
        
        idempotency_data = {
            "bus_id": track.bus_id,
            "route_id": track.route_id,
            "date": track.date,
            "points_count": len(track.points)
        }
        existing_id = self.check_idempotency(idempotency_data, "add_gps_track")
        if existing_id:
            return False
        
        self._gps_tracks[track.track_id] = track
        self.mark_idempotent(idempotency_data, "add_gps_track", track.track_id)
        
        self.add_audit_log(AuditLog(
            id=f"audit_{datetime.now().timestamp()}",
            entity_type="gps_track",
            entity_id=track.track_id,
            action="create",
            operator=operator,
            operator_role=operator_role
        ))
        return True
    
    def get_gps_tracks_by_bus_date(self, bus_id: str, date: str) -> List[GpsTrack]:
        return [t for t in self._gps_tracks.values() if t.bus_id == bus_id and t.date == date]
    
    def get_checkin(self, checkin_id: str) -> Optional[DriverCheckin]:
        return self._checkins.get(checkin_id)
    
    def add_checkin(self, checkin: DriverCheckin, operator: str, operator_role: str) -> bool:
        if checkin.checkin_id in self._checkins:
            return False
        
        idempotency_data = {
            "driver_id": checkin.driver_id,
            "bus_id": checkin.bus_id,
            "route_id": checkin.route_id,
            "checkin_time": checkin.checkin_time
        }
        existing_id = self.check_idempotency(idempotency_data, "add_checkin")
        if existing_id:
            return False
        
        self._checkins[checkin.checkin_id] = checkin
        self.mark_idempotent(idempotency_data, "add_checkin", checkin.checkin_id)
        
        self.add_audit_log(AuditLog(
            id=f"audit_{datetime.now().timestamp()}",
            entity_type="checkin",
            entity_id=checkin.checkin_id,
            action="create",
            operator=operator,
            operator_role=operator_role
        ))
        return True
    
    def get_checkins_by_bus_route(self, bus_id: str, route_id: str, date: str) -> List[DriverCheckin]:
        return [c for c in self._checkins.values() 
                if c.bus_id == bus_id and c.route_id == route_id 
                and c.checkin_time.date().isoformat() == date]
    
    def get_matched_case(self, case_id: str) -> Optional[MatchedCase]:
        return self._matched_cases.get(case_id)
    
    def add_matched_case(self, case: MatchedCase, operator: str, operator_role: str) -> bool:
        if case.case_id in self._matched_cases:
            return False
        
        self._matched_cases[case.case_id] = case
        self._save_to_disk()
        
        self.add_audit_log(AuditLog(
            id=f"audit_{datetime.now().timestamp()}",
            entity_type="matched_case",
            entity_id=case.case_id,
            action="create",
            operator=operator,
            operator_role=operator_role
        ))
        return True
    
    def get_matched_case_by_appeal(self, appeal_id: str) -> Optional[MatchedCase]:
        for case in self._matched_cases.values():
            if case.appeal_id == appeal_id:
                return case
        return None
    
    def get_all_matched_cases(self) -> List[MatchedCase]:
        return list(self._matched_cases.values())
    
    def get_ruling(self, ruling_id: str) -> Optional[RulingDecision]:
        return self._rulings.get(ruling_id)
    
    def add_ruling(self, ruling: RulingDecision) -> bool:
        if ruling.ruling_id in self._rulings:
            return False
        
        self._rulings[ruling.ruling_id] = ruling
        self._save_to_disk()
        
        self.add_audit_log(AuditLog(
            id=f"audit_{datetime.now().timestamp()}",
            entity_type="ruling",
            entity_id=ruling.ruling_id,
            action="create",
            operator=ruling.ruled_by,
            operator_role=ruling.ruled_by_role,
            details={"result": ruling.result, "case_id": ruling.case_id}
        ))
        return True
    
    def get_rulings_by_case(self, case_id: str) -> List[RulingDecision]:
        return [r for r in self._rulings.values() if r.case_id == case_id]
    
    def get_all_rulings(self) -> List[RulingDecision]:
        return list(self._rulings.values())
    
    def get_review(self, review_id: str) -> Optional[ReviewDecision]:
        return self._reviews.get(review_id)
    
    def add_review(self, review: ReviewDecision) -> bool:
        if review.review_id in self._reviews:
            return False
        
        self._reviews[review.review_id] = review
        self._save_to_disk()
        
        self.add_audit_log(AuditLog(
            id=f"audit_{datetime.now().timestamp()}",
            entity_type="review",
            entity_id=review.review_id,
            action="create",
            operator=review.reviewed_by,
            operator_role=review.reviewed_by_role,
            details={"uphold": review.uphold, "case_id": review.case_id}
        ))
        return True
    
    def get_reviews_by_case(self, case_id: str) -> List[ReviewDecision]:
        return [r for r in self._reviews.values() if r.case_id == case_id]
    
    def get_all_reviews(self) -> List[ReviewDecision]:
        return list(self._reviews.values())
    
    def get_audit_logs(self, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[AuditLog]:
        logs = self._audit_logs
        if entity_type:
            logs = [l for l in logs if l.entity_type == entity_type]
        if entity_id:
            logs = [l for l in logs if l.entity_id == entity_id]
        return sorted(logs, key=lambda x: x.timestamp, reverse=True)
