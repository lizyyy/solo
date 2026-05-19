from datetime import datetime, timedelta
from typing import List, Tuple, Optional, Dict, Any
from .models import ParentAppeal, GpsTrack, DriverCheckin, GPSPoint, RulingResult


class RuleEngine:
    def __init__(self):
        self.late_threshold_minutes = 5
        self.gps_gap_threshold_minutes = 10
        self.cross_stop_late_threshold = 15
    
    def detect_gps_gaps(self, track: GpsTrack) -> List[Dict[str, Any]]:
        gaps = []
        if len(track.points) < 2:
            return gaps
        
        sorted_points = sorted(track.points, key=lambda p: p.timestamp)
        
        for i in range(1, len(sorted_points)):
            prev_point = sorted_points[i - 1]
            curr_point = sorted_points[i]
            
            time_diff = curr_point.timestamp - prev_point.timestamp
            if time_diff > timedelta(minutes=self.gps_gap_threshold_minutes):
                gaps.append({
                    "start_time": prev_point.timestamp,
                    "end_time": curr_point.timestamp,
                    "duration_minutes": time_diff.total_seconds() / 60,
                    "start_location": (prev_point.latitude, prev_point.longitude),
                    "end_location": (curr_point.latitude, curr_point.longitude)
                })
        
        return gaps
    
    def calculate_late_minutes(self, scheduled_time: datetime, actual_time: Optional[datetime]) -> Optional[float]:
        if actual_time is None:
            return None
        
        late_delta = actual_time - scheduled_time
        if late_delta.total_seconds() > 0:
            return late_delta.total_seconds() / 60
        return 0
    
    def is_cross_stop_late(self, appeal: ParentAppeal, all_appeals: List[ParentAppeal]) -> Tuple[bool, List[str]]:
        is_cross_late = False
        reasons = []
        
        same_route_appeals = [
            a for a in all_appeals
            if a.bus_id == appeal.bus_id
            and a.route_id == appeal.route_id
            and a.scheduled_time.date() == appeal.scheduled_time.date()
            and a.appeal_id != appeal.appeal_id
        ]
        
        late_stops = []
        for a in same_route_appeals:
            if a.actual_arrival_time:
                late_mins = self.calculate_late_minutes(a.scheduled_time, a.actual_arrival_time)
                if late_mins and late_mins >= self.late_threshold_minutes:
                    late_stops.append(a.stop_name)
        
        if len(late_stops) >= 2:
            is_cross_late = True
            reasons.append(f"同线路多站点迟到: {', '.join(late_stops)}")
        
        return is_cross_late, reasons
    
    def has_significant_gps_gap(self, track: GpsTrack, appeal_time: datetime) -> Tuple[bool, List[str]]:
        gaps = self.detect_gps_gaps(track)
        has_gap = False
        reasons = []
        
        appeal_window_start = appeal_time - timedelta(hours=1)
        appeal_window_end = appeal_time + timedelta(hours=1)
        
        for gap in gaps:
            gap_start = gap["start_time"]
            gap_end = gap["end_time"]
            
            if (gap_start <= appeal_window_end and gap_end >= appeal_window_start):
                has_gap = True
                reasons.append(
                    f"GPS数据缺口: {gap_start.strftime('%H:%M')} - {gap_end.strftime('%H:%M')}, "
                    f"持续{gap['duration_minutes']:.1f}分钟"
                )
        
        return has_gap, reasons
    
    def merge_duplicate_appeals(self, appeals: List[ParentAppeal]) -> Dict[str, List[ParentAppeal]]:
        groups: Dict[str, List[ParentAppeal]] = {}
        
        for appeal in appeals:
            key = f"{appeal.bus_id}:{appeal.route_id}:{appeal.stop_name}:{appeal.scheduled_time.date()}"
            
            if key not in groups:
                groups[key] = []
            groups[key].append(appeal)
        
        return groups
    
    def check_driver_checkin_discrepancy(
        self, 
        checkin: Optional[DriverCheckin], 
        appeal: ParentAppeal
    ) -> Tuple[bool, List[str]]:
        has_discrepancy = False
        reasons = []
        
        if checkin is None:
            has_discrepancy = True
            reasons.append("缺少司机打卡记录")
            return has_discrepancy, reasons
        
        checkin_to_scheduled = appeal.scheduled_time - checkin.checkin_time
        
        if checkin_to_scheduled < timedelta(minutes=15):
            has_discrepancy = True
            reasons.append(
                f"司机打卡时间({checkin.checkin_time.strftime('%H:%M')}) "
                f"距离发车时间过短(不足15分钟)"
            )
        
        return has_discrepancy, reasons
    
    def analyze_case(
        self,
        appeal: ParentAppeal,
        track: Optional[GpsTrack],
        checkin: Optional[DriverCheckin],
        all_appeals: List[ParentAppeal]
    ) -> Tuple[RulingResult, List[str], Dict[str, Any]]:
        all_reasons: List[str] = []
        details: Dict[str, Any] = {}
        
        late_mins = self.calculate_late_minutes(appeal.scheduled_time, appeal.actual_arrival_time)
        if late_mins is not None:
            details["late_minutes"] = late_mins
            if late_mins < self.late_threshold_minutes:
                all_reasons.append(f"迟到{late_mins:.1f}分钟，在允许误差范围内")
                return RulingResult.NO_FAULT, all_reasons, details
        
        cross_late, cross_reasons = self.is_cross_stop_late(appeal, all_appeals)
        if cross_late:
            all_reasons.extend(cross_reasons)
            details["cross_stop_late"] = True
        
        gps_has_gap = False
        if track:
            gps_has_gap, gps_reasons = self.has_significant_gps_gap(track, appeal.appeal_time)
            if gps_has_gap:
                all_reasons.extend(gps_reasons)
                details["gps_gaps"] = gps_reasons
        
        checkin_issue, checkin_reasons = self.check_driver_checkin_discrepancy(checkin, appeal)
        if checkin_issue:
            all_reasons.extend(checkin_reasons)
            details["checkin_issues"] = checkin_reasons
        
        if cross_late and not gps_has_gap:
            result = RulingResult.DRIVER_FAULT
            all_reasons.append("判定: 跨站点迟到且无GPS缺口，司机责任")
        elif gps_has_gap and not cross_late:
            result = RulingResult.GPS_ERROR
            all_reasons.append("判定: GPS数据存在缺口，可能是GPS设备问题")
        elif cross_late and gps_has_gap:
            result = RulingResult.TRAFFIC_DELAY
            all_reasons.append("判定: 跨站点迟到且GPS有缺口，可能是交通延误")
        elif checkin_issue:
            result = RulingResult.DRIVER_FAULT
            all_reasons.append("判定: 司机打卡存在异常")
        else:
            result = RulingResult.NO_FAULT
            all_reasons.append("判定: 未发现明确责任方")
        
        details["final_result"] = result
        return result, all_reasons, details
