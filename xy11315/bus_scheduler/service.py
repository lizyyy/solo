import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from .models import (
    ParentAppeal, GpsTrack, DriverCheckin, MatchedCase,
    RulingDecision, ReviewDecision, AppealStatus, RulingResult,
    Role, BatchOperationResult, GPSPoint
)
from .storage import IdempotentStore
from .rules import RuleEngine


class BusSchedulerService:
    def __init__(self, store: Optional[IdempotentStore] = None):
        self.store = store or IdempotentStore()
        self.rule_engine = RuleEngine()
    
    def receive_appeal(
        self,
        parent_id: str,
        parent_name: str,
        student_name: str,
        bus_id: str,
        route_id: str,
        stop_name: str,
        scheduled_time: datetime,
        appeal_time: datetime,
        description: str,
        actual_arrival_time: Optional[datetime] = None,
        operator: str = "system",
        operator_role: Role = Role.DISPATCHER
    ) -> Tuple[bool, str]:
        appeal_id = f"appeal_{uuid.uuid4().hex[:8]}"
        
        appeal = ParentAppeal(
            appeal_id=appeal_id,
            parent_id=parent_id,
            parent_name=parent_name,
            student_name=student_name,
            bus_id=bus_id,
            route_id=route_id,
            stop_name=stop_name,
            scheduled_time=scheduled_time,
            actual_arrival_time=actual_arrival_time,
            appeal_time=appeal_time,
            description=description,
            created_by=operator,
            created_by_role=operator_role
        )
        
        success = self.store.add_appeal(appeal, operator, operator_role)
        if success:
            return True, appeal_id
        return False, "申诉已存在或重复提交"
    
    def receive_gps_track(
        self,
        bus_id: str,
        route_id: str,
        date: str,
        points: List[Dict[str, Any]],
        operator: str = "system",
        operator_role: Role = Role.DISPATCHER
    ) -> Tuple[bool, str]:
        track_id = f"gps_{uuid.uuid4().hex[:8]}"
        
        gps_points = []
        for p in points:
            gps_points.append(GPSPoint(
                timestamp=p["timestamp"],
                latitude=p["latitude"],
                longitude=p["longitude"],
                accuracy=p.get("accuracy")
            ))
        
        track = GpsTrack(
            track_id=track_id,
            bus_id=bus_id,
            route_id=route_id,
            date=date,
            points=gps_points,
            created_by=operator,
            created_by_role=operator_role
        )
        
        success = self.store.add_gps_track(track, operator, operator_role)
        if success:
            return True, track_id
        return False, "GPS轨迹已存在或重复提交"
    
    def receive_driver_checkin(
        self,
        driver_id: str,
        driver_name: str,
        bus_id: str,
        route_id: str,
        checkin_time: datetime,
        location: Optional[str] = None,
        operator: str = "system",
        operator_role: Role = Role.DRIVER
    ) -> Tuple[bool, str]:
        checkin_id = f"checkin_{uuid.uuid4().hex[:8]}"
        
        checkin = DriverCheckin(
            checkin_id=checkin_id,
            driver_id=driver_id,
            driver_name=driver_name,
            bus_id=bus_id,
            route_id=route_id,
            checkin_time=checkin_time,
            location=location,
            created_by=operator,
            created_by_role=operator_role
        )
        
        success = self.store.add_checkin(checkin, operator, operator_role)
        if success:
            return True, checkin_id
        return False, "打卡记录已存在或重复提交"
    
    def match_appeal(
        self,
        appeal_id: str,
        operator: str,
        operator_role: Role
    ) -> Tuple[bool, str]:
        appeal = self.store.get_appeal(appeal_id)
        if not appeal:
            return False, "申诉不存在"
        
        existing_case = self.store.get_matched_case_by_appeal(appeal_id)
        if existing_case:
            return False, f"申诉已匹配，案例ID: {existing_case.case_id}"
        
        appeal_date = appeal.scheduled_time.date().isoformat()
        
        gps_tracks = self.store.get_gps_tracks_by_bus_date(appeal.bus_id, appeal_date)
        gps_track_id = gps_tracks[0].track_id if gps_tracks else None
        
        checkins = self.store.get_checkins_by_bus_route(appeal.bus_id, appeal.route_id, appeal_date)
        checkin_id = checkins[0].checkin_id if checkins else None
        
        issues = []
        if not gps_track_id:
            issues.append("未找到匹配的GPS轨迹")
        if not checkin_id:
            issues.append("未找到匹配的司机打卡记录")
        
        case_id = f"case_{uuid.uuid4().hex[:8]}"
        matched_case = MatchedCase(
            case_id=case_id,
            appeal_id=appeal_id,
            gps_track_id=gps_track_id,
            driver_checkin_id=checkin_id,
            bus_id=appeal.bus_id,
            route_id=appeal.route_id,
            stop_name=appeal.stop_name,
            matched_by=operator,
            matched_by_role=operator_role,
            issues=issues
        )
        
        success = self.store.add_matched_case(matched_case, operator, operator_role)
        if success:
            self.store.update_appeal_status(appeal_id, AppealStatus.MATCHED, operator, operator_role)
            return True, case_id
        return False, "匹配失败"
    
    def match_all_pending_appeals(
        self,
        operator: str,
        operator_role: Role
    ) -> BatchOperationResult:
        pending_appeals = [
            a for a in self.store.get_all_appeals()
            if a.status == AppealStatus.PENDING
        ]
        
        result = BatchOperationResult(
            operation="match_all",
            total_count=len(pending_appeals),
            success_count=0,
            failure_count=0,
            operator=operator
        )
        
        for appeal in pending_appeals:
            success, message = self.match_appeal(appeal.appeal_id, operator, operator_role)
            if success:
                result.success_count += 1
                result.successful_ids.append(appeal.appeal_id)
            else:
                result.failure_count += 1
                result.failed_ids.append(appeal.appeal_id)
                result.errors[appeal.appeal_id] = message
        
        return result
    
    def rule_on_case(
        self,
        case_id: str,
        operator: str,
        operator_role: Role
    ) -> Tuple[bool, str]:
        matched_case = self.store.get_matched_case(case_id)
        if not matched_case:
            return False, "案例不存在"
        
        existing_rulings = self.store.get_rulings_by_case(case_id)
        if existing_rulings:
            return False, f"案例已裁定，裁定ID: {existing_rulings[0].ruling_id}"
        
        appeal = self.store.get_appeal(matched_case.appeal_id)
        if not appeal:
            return False, "关联申诉不存在"
        
        track = None
        if matched_case.gps_track_id:
            track = self.store.get_gps_track(matched_case.gps_track_id)
        
        checkin = None
        if matched_case.driver_checkin_id:
            checkin = self.store.get_checkin(matched_case.driver_checkin_id)
        
        all_appeals = self.store.get_all_appeals()
        
        ruling_result, reasons, details = self.rule_engine.analyze_case(
            appeal, track, checkin, all_appeals
        )
        
        ruling_id = f"ruling_{uuid.uuid4().hex[:8]}"
        ruling = RulingDecision(
            ruling_id=ruling_id,
            case_id=case_id,
            appeal_id=appeal.appeal_id,
            result=ruling_result,
            reason="; ".join(reasons),
            details=details,
            ruled_by=operator,
            ruled_by_role=operator_role
        )
        
        success = self.store.add_ruling(ruling)
        if success:
            self.store.update_appeal_status(appeal.appeal_id, AppealStatus.RULED, operator, operator_role)
            return True, ruling_id
        return False, "裁定失败"
    
    def rule_all_matched_cases(
        self,
        operator: str,
        operator_role: Role
    ) -> BatchOperationResult:
        matched_cases = self.store.get_all_matched_cases()
        
        unruled_cases = []
        for case in matched_cases:
            if not self.store.get_rulings_by_case(case.case_id):
                unruled_cases.append(case)
        
        result = BatchOperationResult(
            operation="rule_all",
            total_count=len(unruled_cases),
            success_count=0,
            failure_count=0,
            operator=operator
        )
        
        for case in unruled_cases:
            success, message = self.rule_on_case(case.case_id, operator, operator_role)
            if success:
                result.success_count += 1
                result.successful_ids.append(case.case_id)
            else:
                result.failure_count += 1
                result.failed_ids.append(case.case_id)
                result.errors[case.case_id] = message
        
        return result
    
    def review_ruling(
        self,
        case_id: str,
        uphold: bool,
        reason: str,
        new_result: Optional[RulingResult] = None,
        operator: str = "admin",
        operator_role: Role = Role.ADMIN
    ) -> Tuple[bool, str]:
        matched_case = self.store.get_matched_case(case_id)
        if not matched_case:
            return False, "案例不存在"
        
        existing_rulings = self.store.get_rulings_by_case(case_id)
        if not existing_rulings:
            return False, "案例尚未裁定"
        
        original_ruling = existing_rulings[0]
        
        review_id = f"review_{uuid.uuid4().hex[:8]}"
        review = ReviewDecision(
            review_id=review_id,
            case_id=case_id,
            appeal_id=matched_case.appeal_id,
            original_ruling_id=original_ruling.ruling_id,
            uphold=uphold,
            new_result=new_result,
            reason=reason,
            reviewed_by=operator,
            reviewed_by_role=operator_role
        )
        
        success = self.store.add_review(review)
        if success:
            appeal = self.store.get_appeal(matched_case.appeal_id)
            if appeal:
                self.store.update_appeal_status(appeal.appeal_id, AppealStatus.REVIEWED, operator, operator_role)
            return True, review_id
        return False, "复核失败"
    
    def merge_duplicate_appeals(self) -> Dict[str, List[ParentAppeal]]:
        all_appeals = self.store.get_all_appeals()
        return self.rule_engine.merge_duplicate_appeals(all_appeals)
    
    def get_appeal_audit_log(self, appeal_id: str) -> List:
        return self.store.get_audit_logs("appeal", appeal_id)
    
    def get_case_details(self, case_id: str) -> Dict[str, Any]:
        case = self.store.get_matched_case(case_id)
        if not case:
            return {}
        
        appeal = self.store.get_appeal(case.appeal_id)
        track = self.store.get_gps_track(case.gps_track_id) if case.gps_track_id else None
        checkin = self.store.get_checkin(case.driver_checkin_id) if case.driver_checkin_id else None
        rulings = self.store.get_rulings_by_case(case_id)
        reviews = self.store.get_reviews_by_case(case_id)
        audit_logs = self.get_appeal_audit_log(case.appeal_id)
        
        return {
            "case": case,
            "appeal": appeal,
            "gps_track": track,
            "driver_checkin": checkin,
            "rulings": rulings,
            "reviews": reviews,
            "audit_logs": audit_logs
        }
