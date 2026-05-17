import math
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from models import (
    Volunteer, Shift, CheckIn, SubstituteRequest, DurationCertification,
    Location, ServiceRecord, ShiftStatus, SubstituteStatus, CertificationStatus
)


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """计算两点间的距离（米）"""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


class RuleEngine:
    def __init__(self):
        self.volunteers: Dict[str, Volunteer] = {}
        self.shifts: Dict[str, Shift] = {}
        self.checkins: Dict[str, CheckIn] = {}
        self.substitutes: Dict[str, SubstituteRequest] = {}
        self.certifications: Dict[str, DurationCertification] = {}
        self.locations: Dict[str, Location] = {}
        self.warnings: List[Dict] = []
        self.errors: List[Dict] = []

    def load_volunteers(self, volunteers: List[Volunteer]):
        for v in volunteers:
            self.volunteers[v.volunteer_id] = v

    def load_shifts(self, shifts: List[Shift]):
        for s in shifts:
            self.shifts[s.shift_id] = s

    def load_checkins(self, checkins: List[CheckIn]):
        for c in checkins:
            self.checkins[c.checkin_id] = c

    def load_substitutes(self, substitutes: List[SubstituteRequest]):
        for s in substitutes:
            self.substitutes[s.request_id] = s

    def load_certifications(self, certifications: List[DurationCertification]):
        for c in certifications:
            self.certifications[c.certification_id] = c

    def load_locations(self, locations: List[Location]):
        for l in locations:
            self.locations[l.location_id] = l

    def validate_shift_capacity(self) -> List[Dict]:
        """验证班次容量"""
        violations = []
        for shift_id, shift in self.shifts.items():
            assigned_count = len(shift.volunteer_ids)
            approved_substitutes = [
                s for s in self.substitutes.values()
                if s.shift_id == shift_id and s.status == SubstituteStatus.APPROVED
            ]
            total_count = assigned_count + len(approved_substitutes)
            
            if total_count > shift.capacity:
                violations.append({
                    "type": "capacity_violation",
                    "shift_id": shift_id,
                    "activity_name": shift.activity_name,
                    "capacity": shift.capacity,
                    "actual": total_count,
                    "excess": total_count - shift.capacity,
                    "severity": "error"
                })
                self.errors.append(violations[-1])
        return violations

    def validate_location(self) -> List[Dict]:
        """验证签到位置"""
        violations = []
        for checkin_id, checkin in self.checkins.items():
            if checkin.latitude is None or checkin.longitude is None:
                violations.append({
                    "type": "missing_location",
                    "checkin_id": checkin_id,
                    "volunteer_id": checkin.volunteer_id,
                    "shift_id": checkin.shift_id,
                    "severity": "warning"
                })
                self.warnings.append(violations[-1])
                continue
                
            shift = self.shifts.get(checkin.shift_id)
            if not shift:
                continue
                
            location = self.locations.get(shift.location_id)
            if not location:
                continue
                
            distance = calculate_distance(
                checkin.latitude, checkin.longitude,
                location.latitude, location.longitude
            )
            
            location_valid = distance <= location.radius_meters
            checkin.location_valid = location_valid
            
            if not location_valid:
                violations.append({
                    "type": "location_violation",
                    "checkin_id": checkin_id,
                    "volunteer_id": checkin.volunteer_id,
                    "shift_id": checkin.shift_id,
                    "distance_meters": round(distance, 2),
                    "allowed_radius": location.radius_meters,
                    "severity": "warning"
                })
                self.warnings.append(violations[-1])
        return violations

    def validate_substitute_approvals(self) -> List[Dict]:
        """验证替班审批"""
        violations = []
        for request_id, request in self.substitutes.items():
            if request.status == SubstituteStatus.APPROVED:
                if not request.approver_id:
                    violations.append({
                        "type": "missing_approver",
                        "request_id": request_id,
                        "shift_id": request.shift_id,
                        "severity": "error"
                    })
                    self.errors.append(violations[-1])
                if not request.approval_time:
                    violations.append({
                        "type": "missing_approval_time",
                        "request_id": request_id,
                        "shift_id": request.shift_id,
                        "severity": "error"
                    })
                    self.errors.append(violations[-1])
            
            if request.original_volunteer_id not in self.volunteers:
                violations.append({
                    "type": "invalid_original_volunteer",
                    "request_id": request_id,
                    "volunteer_id": request.original_volunteer_id,
                    "severity": "error"
                })
                self.errors.append(violations[-1])
                
            if request.substitute_volunteer_id not in self.volunteers:
                violations.append({
                    "type": "invalid_substitute_volunteer",
                    "request_id": request_id,
                    "volunteer_id": request.substitute_volunteer_id,
                    "severity": "error"
                })
                self.errors.append(violations[-1])
                
            if request.shift_id not in self.shifts:
                violations.append({
                    "type": "invalid_shift",
                    "request_id": request_id,
                    "shift_id": request.shift_id,
                    "severity": "error"
                })
                self.errors.append(violations[-1])
        return violations

    def calculate_actual_duration(self, checkin: CheckIn, shift: Shift) -> int:
        """计算实际服务时长（分钟）"""
        if checkin.checkout_time is None:
            return 0
            
        shift_start = datetime.combine(shift.date, shift.start_time)
        shift_end = datetime.combine(shift.date, shift.end_time)
        
        actual_start = max(checkin.checkin_time, shift_start)
        actual_end = min(checkin.checkout_time, shift_end)
        
        if actual_end <= actual_start:
            return 0
            
        duration = int((actual_end - actual_start).total_seconds() / 60)
        return max(0, duration)

    def recalculate_durations(self) -> List[Dict]:
        """重新计算所有时长"""
        recalculations = []
        for cert_id, cert in self.certifications.items():
            checkin = self.checkins.get(cert.checkin_id)
            if not checkin:
                recalculations.append({
                    "type": "missing_checkin",
                    "certification_id": cert_id,
                    "checkin_id": cert.checkin_id,
                    "severity": "error"
                })
                self.errors.append(recalculations[-1])
                continue
                
            shift = self.shifts.get(cert.shift_id)
            if not shift:
                continue
                
            actual_duration = self.calculate_actual_duration(checkin, shift)
            cert.verified_duration_minutes = actual_duration
            
            if abs(cert.claimed_duration_minutes - actual_duration) > 5:
                recalculations.append({
                    "type": "duration_mismatch",
                    "certification_id": cert_id,
                    "volunteer_id": cert.volunteer_id,
                    "shift_id": cert.shift_id,
                    "claimed": cert.claimed_duration_minutes,
                    "actual": actual_duration,
                    "difference": actual_duration - cert.claimed_duration_minutes,
                    "severity": "warning"
                })
                self.warnings.append(recalculations[-1])
                cert.status = CertificationStatus.REJECTED
            else:
                cert.status = CertificationStatus.VERIFIED
                cert.verified_duration_minutes = actual_duration
                
        return recalculations

    def generate_service_records(self) -> List[ServiceRecord]:
        """生成服务记录"""
        records = []
        volunteer_shift_map = defaultdict(list)
        
        for shift_id, shift in self.shifts.items():
            for vid in shift.volunteer_ids:
                volunteer_shift_map[(vid, shift_id)].append({
                    "is_substitute": False,
                    "original_volunteer_id": None
                })
        
        for sub in self.substitutes.values():
            if sub.status == SubstituteStatus.APPROVED:
                volunteer_shift_map[(sub.substitute_volunteer_id, sub.shift_id)].append({
                    "is_substitute": True,
                    "original_volunteer_id": sub.original_volunteer_id
                })
        
        for checkin in self.checkins.values():
            shift = self.shifts.get(checkin.shift_id)
            if not shift:
                continue
                
            actual_duration = self.calculate_actual_duration(checkin, shift)
            
            cert = next(
                (c for c in self.certifications.values() 
                 if c.checkin_id == checkin.checkin_id),
                None
            )
            
            cert_status = cert.status if cert else CertificationStatus.PENDING
            
            assignments = volunteer_shift_map.get((checkin.volunteer_id, checkin.shift_id), [])
            
            for assignment in assignments:
                record = ServiceRecord(
                    record_id=f"REC_{checkin.checkin_id}_{len(records)}",
                    volunteer_id=checkin.volunteer_id,
                    shift_id=checkin.shift_id,
                    date=shift.date,
                    activity_name=shift.activity_name,
                    actual_duration_minutes=actual_duration,
                    is_substitute=assignment["is_substitute"],
                    original_volunteer_id=assignment["original_volunteer_id"],
                    certification_status=cert_status,
                    location_valid=checkin.location_valid if checkin.location_valid is not None else False
                )
                records.append(record)
        
        return records

    def run_all_validations(self) -> Dict:
        """运行所有验证"""
        self.warnings.clear()
        self.errors.clear()
        
        results = {
            "capacity_violations": self.validate_shift_capacity(),
            "location_violations": self.validate_location(),
            "substitute_violations": self.validate_substitute_approvals(),
            "duration_recalculations": self.recalculate_durations(),
            "summary": {}
        }
        
        results["summary"] = {
            "total_volunteers": len(self.volunteers),
            "total_shifts": len(self.shifts),
            "total_checkins": len(self.checkins),
            "total_substitutes": len(self.substitutes),
            "total_certifications": len(self.certifications),
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "has_issues": len(self.errors) > 0 or len(self.warnings) > 0
        }
        
        return results
