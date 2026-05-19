from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

class RuleResult(str, Enum):
    BLOCKED = "blocked"
    PASSED = "passed"
    WARNING = "warning"

@dataclass
class RuleCheckResult:
    rule_name: str
    result: RuleResult
    reason: str
    evidence: Dict
    is_blocked: bool

class BaseRule:
    name: str = "base_rule"
    
    def check(self, complaint, gps_records: List, checkin_records: List, all_complaints: List) -> RuleCheckResult:
        raise NotImplementedError

class DuplicateComplaintRule(BaseRule):
    name = "duplicate_complaint_merge"
    
    def __init__(self, time_window_minutes: int = 60):
        self.time_window_minutes = time_window_minutes
    
    def check(self, complaint, gps_records: List, checkin_records: List, all_complaints: List) -> RuleCheckResult:
        duplicates = []
        for other in all_complaints:
            if other.id == complaint.id:
                continue
            if other.status in ["merged", "rejected"]:
                continue
            
            if (other.bus_no == complaint.bus_no and
                other.route_no == complaint.route_no and
                abs((other.scheduled_arrival - complaint.scheduled_arrival).total_seconds()) < self.time_window_minutes * 60):
                duplicates.append({
                    "complaint_no": other.complaint_no,
                    "parent_name": other.parent_name,
                    "student_name": other.student_name,
                    "delay_minutes": other.delay_minutes
                })
        
        if len(duplicates) > 0:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.WARNING,
                reason=f"发现 {len(duplicates)} 条相似申诉，建议合并处理",
                evidence={
                    "duplicate_count": len(duplicates),
                    "duplicates": duplicates,
                    "time_window_minutes": self.time_window_minutes
                },
                is_blocked=False
            )
        
        return RuleCheckResult(
            rule_name=self.name,
            result=RuleResult.PASSED,
            reason="无重复申诉",
            evidence={"duplicate_count": 0},
            is_blocked=False
        )

class GPSGapRule(BaseRule):
    name = "gps_gap_check"
    
    def __init__(self, max_gap_minutes: int = 5, expected_interval_seconds: int = 30):
        self.max_gap_minutes = max_gap_minutes
        self.expected_interval_seconds = expected_interval_seconds
    
    def check(self, complaint, gps_records: List, checkin_records: List, all_complaints: List) -> RuleCheckResult:
        if not gps_records:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.BLOCKED,
                reason="GPS数据完全缺失，无法进行有效判定",
                evidence={
                    "gps_count": 0,
                    "gap_count": 0,
                    "max_gap_minutes": 0,
                    "status": "missing"
                },
                is_blocked=True
            )
        
        sorted_gps = sorted(gps_records, key=lambda x: x.record_time)
        
        gaps = []
        max_gap = 0
        for i in range(1, len(sorted_gps)):
            gap = (sorted_gps[i].record_time - sorted_gps[i-1].record_time).total_seconds()
            if gap > self.expected_interval_seconds * 2:
                gaps.append({
                    "start_time": sorted_gps[i-1].record_time.isoformat(),
                    "end_time": sorted_gps[i].record_time.isoformat(),
                    "gap_seconds": gap
                })
                max_gap = max(max_gap, gap / 60)
        
        total_duration = (sorted_gps[-1].record_time - sorted_gps[0].record_time).total_seconds() / 60 if sorted_gps else 0
        
        if max_gap > self.max_gap_minutes:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.WARNING,
                reason=f"GPS存在 {len(gaps)} 处缺口，最大缺口 {max_gap:.1f} 分钟，可能影响判定准确性",
                evidence={
                    "gps_count": len(gps_records),
                    "gap_count": len(gaps),
                    "max_gap_minutes": round(max_gap, 2),
                    "gaps": gaps[:5],
                    "total_duration_minutes": round(total_duration, 2),
                    "status": "partial"
                },
                is_blocked=False
            )
        
        return RuleCheckResult(
            rule_name=self.name,
            result=RuleResult.PASSED,
            reason="GPS数据完整",
            evidence={
                "gps_count": len(gps_records),
                "gap_count": 0,
                "max_gap_minutes": 0,
                "status": "complete"
            },
            is_blocked=False
        )

class CrossSiteLateRule(BaseRule):
    name = "cross_site_late_check"
    
    def __init__(self, site_delay_threshold_minutes: int = 3):
        self.site_delay_threshold_minutes = site_delay_threshold_minutes
    
    def check(self, complaint, gps_records: List, checkin_records: List, all_complaints: List) -> RuleCheckResult:
        site_checkins = [c for c in checkin_records if c.checkin_type == "site_arrival"]
        
        if len(site_checkins) <= 1:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.PASSED,
                reason="单站点运行，不涉及跨站点累计迟到",
                evidence={
                    "site_count": len(site_checkins),
                    "cross_site": False,
                    "cumulative_delay": 0
                },
                is_blocked=False
            )
        
        cumulative_delay = 0
        delayed_sites = []
        
        for i, checkin in enumerate(site_checkins[1:], 1):
            prev_checkin = site_checkins[i-1]
            time_diff = (checkin.checkin_time - prev_checkin.checkin_time).total_seconds() / 60
            
            if time_diff > self.site_delay_threshold_minutes:
                extra_delay = time_diff - self.site_delay_threshold_minutes
                cumulative_delay += extra_delay
                delayed_sites.append({
                    "site_no": checkin.site_no,
                    "site_name": checkin.site_name,
                    "delay_from_previous_minutes": round(time_diff, 2),
                    "extra_delay_minutes": round(extra_delay, 2)
                })
        
        if cumulative_delay > 0 and delayed_sites:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.WARNING,
                reason=f"跨站点累计额外延误 {cumulative_delay:.1f} 分钟，涉及 {len(delayed_sites)} 个站点",
                evidence={
                    "site_count": len(site_checkins),
                    "cross_site": True,
                    "cumulative_delay_minutes": round(cumulative_delay, 2),
                    "delayed_sites": delayed_sites
                },
                is_blocked=False
            )
        
        return RuleCheckResult(
            rule_name=self.name,
            result=RuleResult.PASSED,
            reason="跨站点运行正常，无累计延误",
            evidence={
                "site_count": len(site_checkins),
                "cross_site": False,
                "cumulative_delay": 0
            },
            is_blocked=False
        )

class CheckinMismatchRule(BaseRule):
    name = "checkin_mismatch_check"
    
    def __init__(self, time_tolerance_minutes: int = 2):
        self.time_tolerance_minutes = time_tolerance_minutes
    
    def check(self, complaint, gps_records: List, checkin_records: List, all_complaints: List) -> RuleCheckResult:
        gps_arrivals = [g for g in gps_records if g.is_arrival]
        checkin_arrivals = [c for c in checkin_records if c.checkin_type == "site_arrival"]
        
        if not gps_arrivals or not checkin_arrivals:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.WARNING,
                reason="GPS或打卡数据缺少站点到达记录",
                evidence={
                    "gps_arrival_count": len(gps_arrivals),
                    "checkin_arrival_count": len(checkin_arrivals),
                    "mismatch_count": 0
                },
                is_blocked=False
            )
        
        mismatches = []
        for gps_arrival in gps_arrivals:
            matched = False
            for checkin in checkin_arrivals:
                time_diff = abs((gps_arrival.record_time - checkin.checkin_time).total_seconds() / 60)
                if time_diff <= self.time_tolerance_minutes:
                    matched = True
                    break
            
            if not matched:
                mismatches.append({
                    "gps_time": gps_arrival.record_time.isoformat(),
                    "gps_site": gps_arrival.site_name,
                    "has_corresponding_checkin": False
                })
        
        if mismatches:
            return RuleCheckResult(
                rule_name=self.name,
                result=RuleResult.WARNING,
                reason=f"GPS与打卡记录存在 {len(mismatches)} 处不匹配",
                evidence={
                    "gps_arrival_count": len(gps_arrivals),
                    "checkin_arrival_count": len(checkin_arrivals),
                    "mismatch_count": len(mismatches),
                    "mismatches": mismatches,
                    "tolerance_minutes": self.time_tolerance_minutes
                },
                is_blocked=False
            )
        
        return RuleCheckResult(
            rule_name=self.name,
            result=RuleResult.PASSED,
            reason="GPS与打卡记录匹配一致",
            evidence={
                "mismatch_count": 0
            },
            is_blocked=False
        )

class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            DuplicateComplaintRule(),
            GPSGapRule(),
            CrossSiteLateRule(),
            CheckinMismatchRule()
        ]
    
    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)
    
    def run_all(self, complaint, gps_records: List, checkin_records: List, all_complaints: List) -> Tuple[List[RuleCheckResult], bool]:
        results = []
        is_blocked = False
        
        for rule in self.rules:
            result = rule.check(complaint, gps_records, checkin_records, all_complaints)
            results.append(result)
            if result.is_blocked:
                is_blocked = True
        
        return results, is_blocked

def determine_responsibility(complaint, gps_records: List, checkin_records: List, rule_results: List[RuleCheckResult]) -> Tuple[str, str]:
    delay = complaint.delay_minutes
    
    gps_gap_result = next((r for r in rule_results if r.rule_name == "gps_gap_check"), None)
    cross_site_result = next((r for r in rule_results if r.rule_name == "cross_site_late_check"), None)
    checkin_result = next((r for r in rule_results if r.rule_name == "checkin_mismatch_check"), None)
    
    if gps_gap_result and gps_gap_result.result == RuleResult.BLOCKED:
        return "unclear", "GPS数据完全缺失，无法判定责任"
    
    cross_site_delay = 0
    if cross_site_result and cross_site_result.evidence.get("cross_site"):
        cross_site_delay = cross_site_result.evidence.get("cumulative_delay_minutes", 0)
    
    has_checkin_mismatch = checkin_result and checkin_result.result == RuleResult.WARNING
    
    if delay <= 5:
        return "traffic", "5分钟以内延误，判定为正常交通波动"
    
    if cross_site_delay >= 10:
        return "driver", f"跨站点累计额外延误 {cross_site_delay:.1f} 分钟，判定为司机责任"
    
    if has_checkin_mismatch and delay >= 15:
        return "driver", "打卡与GPS不匹配且延误较长，判定为司机责任"
    
    if 5 < delay <= 10:
        return "traffic", "5-10分钟延误，判定为交通因素"
    
    if 10 < delay <= 20:
        return "company", "10-20分钟延误，判定为公司调度责任"
    
    return "unclear", "延误情况复杂，需要人工进一步核实"
