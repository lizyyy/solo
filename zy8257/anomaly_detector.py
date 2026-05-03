from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict
import uuid

from models import (
    Deceased, ColdChamberLog, HandoverRecord, Rule,
    TimelineEvent, ChamberStatus, Issue, IssueType, Severity
)
from data_loader import DataLoader
from timeline_builder import TimelineBuilder


class AnomalyDetector:
    def __init__(self, data_loader: DataLoader, timeline_builder: TimelineBuilder):
        self.data_loader = data_loader
        self.timeline_builder = timeline_builder
        self.all_issues: List[Issue] = []
        self.issues_by_deceased: Dict[str, List[Issue]] = defaultdict(list)
        self.issues_by_chamber: Dict[str, List[Issue]] = defaultdict(list)

    def generate_issue_id(self) -> str:
        return f"ISS_{uuid.uuid4().hex[:12]}"

    def detect_all(self) -> List[Issue]:
        all_issues = []
        
        load_issues = self.data_loader.load_issues
        all_issues.extend(load_issues)
        
        temp_issues = self._detect_temperature_out_of_range()
        all_issues.extend(temp_issues)
        
        overlap_issues = self._detect_chamber_overlap()
        all_issues.extend(overlap_issues)
        
        midnight_issues = self._detect_midnight_misalignment()
        all_issues.extend(midnight_issues)
        
        self.all_issues = all_issues
        self._organize_issues()
        
        return all_issues

    def _organize_issues(self):
        for issue in self.all_issues:
            if issue.deceased_id:
                self.issues_by_deceased[issue.deceased_id].append(issue)
            if issue.chamber_id:
                self.issues_by_chamber[issue.chamber_id].append(issue)

    def _detect_temperature_out_of_range(self) -> List[Issue]:
        issues = []
        temp_rule = self.data_loader.get_temperature_rule()
        
        if temp_rule is None:
            return issues
        
        min_temp = temp_rule.min_value if temp_rule.min_value is not None else -25.0
        max_temp = temp_rule.max_value if temp_rule.max_value is not None else -15.0
        
        chamber_statuses = self.timeline_builder.chamber_statuses
        
        for chamber_id, status in chamber_statuses.items():
            out_of_range_periods = []
            current_period: Optional[Dict[str, Any]] = None
            
            for temp_record in status.temperature_history:
                temp = temp_record["temperature"]
                timestamp = temp_record["timestamp"]
                
                if temp < min_temp or temp > max_temp:
                    if current_period is None:
                        current_period = {
                            "start_time": timestamp,
                            "end_time": timestamp,
                            "min_temp": temp,
                            "max_temp": temp,
                            "readings": [{"time": timestamp, "temp": temp}]
                        }
                    else:
                        current_period["end_time"] = timestamp
                        current_period["min_temp"] = min(current_period["min_temp"], temp)
                        current_period["max_temp"] = max(current_period["max_temp"], temp)
                        current_period["readings"].append({"time": timestamp, "temp": temp})
                else:
                    if current_period is not None:
                        out_of_range_periods.append(current_period)
                        current_period = None
            
            if current_period is not None:
                out_of_range_periods.append(current_period)
            
            for period in out_of_range_periods:
                reading_count = len(period["readings"])
                temp_range = f"{period['min_temp']}°C ~ {period['max_temp']}°C"
                expected_range = f"{min_temp}°C ~ {max_temp}°C"
                
                severity = Severity.HIGH
                if reading_count > 5:
                    severity = Severity.CRITICAL
                
                issue = Issue(
                    issue_id=self.generate_issue_id(),
                    issue_type=IssueType.TEMPERATURE_OUT_OF_RANGE,
                    severity=severity,
                    chamber_id=chamber_id,
                    start_time=period["start_time"],
                    end_time=period["end_time"],
                    description=f"冷藏柜[{chamber_id}]温度超窗 {period['start_time'].strftime('%Y-%m-%d %H:%M')} ~ {period['end_time'].strftime('%Y-%m-%d %H:%M')}。"
                              f"实测: {temp_range}, 标准: {expected_range}, 共{reading_count}个读数异常",
                    related_records=[{
                        "record_type": "温度异常",
                        "chamber_id": chamber_id,
                        "start_time": period["start_time"].isoformat(),
                        "end_time": period["end_time"].isoformat(),
                        "readings": [
                            {"time": r["time"].isoformat(), "temp": r["temp"]}
                            for r in period["readings"]
                        ],
                        "min_temp": period["min_temp"],
                        "max_temp": period["max_temp"]
                    }]
                )
                issues.append(issue)
        
        return issues

    def _detect_chamber_overlap(self) -> List[Issue]:
        issues = []
        chamber_statuses = self.timeline_builder.chamber_statuses
        
        for chamber_id, status in chamber_statuses.items():
            occupancies = status.occupancy_history
            
            if len(occupancies) < 2:
                continue
            
            for i, occ1 in enumerate(occupancies):
                for j, occ2 in enumerate(occupancies[i+1:], i+1):
                    if occ1.get("is_active") or occ2.get("is_active"):
                        continue
                    
                    occ1_end = occ1["end_time"]
                    occ2_start = occ2["start_time"]
                    
                    if occ1_end is None or occ2_start is None:
                        continue
                    
                    if occ2_start < occ1_end:
                        overlap_duration = (occ1_end - occ2_start).total_seconds() / 60
                        
                        deceased1 = occ1["deceased_id"]
                        deceased2 = occ2["deceased_id"]
                        
                        issue = Issue(
                            issue_id=self.generate_issue_id(),
                            issue_type=IssueType.CHAMBER_OVERLAP,
                            severity=Severity.CRITICAL,
                            chamber_id=chamber_id,
                            deceased_id=f"{deceased1}/{deceased2}",
                            start_time=occ2_start,
                            end_time=occ1_end,
                            description=f"冷藏柜[{chamber_id}]存在重叠占用。"
                                      f"逝者[{deceased1}]占用至 {occ1_end.strftime('%Y-%m-%d %H:%M')}，"
                                      f"逝者[{deceased2}]已在 {occ2_start.strftime('%Y-%m-%d %H:%M')} 入柜。"
                                      f"重叠时间: {overlap_duration:.0f}分钟",
                            related_records=[{
                                "record_type": "占用记录1",
                                "deceased_id": deceased1,
                                "chamber_id": chamber_id,
                                "start_time": occ1["start_time"].isoformat(),
                                "end_time": occ1["end_time"].isoformat() if occ1["end_time"] else None
                            }, {
                                "record_type": "占用记录2",
                                "deceased_id": deceased2,
                                "chamber_id": chamber_id,
                                "start_time": occ2["start_time"].isoformat(),
                                "end_time": occ2["end_time"].isoformat() if occ2["end_time"] else None
                            }]
                        )
                        issues.append(issue)
        
        return issues

    def _detect_midnight_misalignment(self) -> List[Issue]:
        issues = []
        chamber_statuses = self.timeline_builder.chamber_statuses
        
        for chamber_id, status in chamber_statuses.items():
            for occ in status.occupancy_history:
                start_time = occ["start_time"]
                end_time = occ.get("end_time")
                
                if start_time is None:
                    continue
                
                if end_time is None:
                    end_time = datetime.now()
                
                if start_time.day != end_time.day:
                    midnight = datetime(
                        end_time.year, end_time.month, end_time.day, 0, 0, 0
                    )
                    
                    if start_time < midnight <= end_time:
                        deceased_id = occ["deceased_id"]
                        
                        issue = Issue(
                            issue_id=self.generate_issue_id(),
                            issue_type=IssueType.MIDNIGHT_MISALIGNMENT,
                            severity=Severity.MEDIUM,
                            chamber_id=chamber_id,
                            deceased_id=deceased_id,
                            start_time=start_time,
                            end_time=end_time,
                            description=f"逝者[{deceased_id}]在冷藏柜[{chamber_id}]的占用跨午夜。"
                                      f"入柜: {start_time.strftime('%Y-%m-%d %H:%M')}，"
                                      f"出柜: {end_time.strftime('%Y-%m-%d %H:%M') if occ.get('end_time') else '仍在柜中'}。"
                                      f"请确认值班归属日期。",
                            related_records=[{
                                "record_type": "跨午夜占用",
                                "deceased_id": deceased_id,
                                "chamber_id": chamber_id,
                                "start_time": start_time.isoformat(),
                                "end_time": end_time.isoformat() if occ.get("end_time") else None,
                                "midnight_crossing": midnight.isoformat(),
                                "is_active": occ.get("is_active", False)
                            }]
                        )
                        issues.append(issue)
        
        return issues

    def get_issues_by_deceased(self, deceased_id: str) -> List[Issue]:
        return self.issues_by_deceased.get(deceased_id, [])

    def get_issues_by_chamber(self, chamber_id: str) -> List[Issue]:
        return self.issues_by_chamber.get(chamber_id, [])

    def get_unresolved_issues(self) -> List[Issue]:
        return [issue for issue in self.all_issues if not issue.is_resolved]

    def get_issues_by_type(self, issue_type: str) -> List[Issue]:
        return [issue for issue in self.all_issues if issue.issue_type == issue_type]

    def filter_issues(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        chamber_id: Optional[str] = None,
        issue_type: Optional[str] = None,
        severity: Optional[str] = None,
        is_resolved: Optional[bool] = None
    ) -> List[Issue]:
        filtered = self.all_issues
        
        if is_resolved is not None:
            filtered = [i for i in filtered if i.is_resolved == is_resolved]
        
        if chamber_id:
            filtered = [i for i in filtered if i.chamber_id == chamber_id]
        
        if issue_type:
            filtered = [i for i in filtered if i.issue_type == issue_type]
        
        if severity:
            filtered = [i for i in filtered if i.severity == severity]
        
        if start_date:
            start_dt = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
            filtered = [
                i for i in filtered 
                if (i.start_time and i.start_time >= start_dt) or 
                   (i.end_time and i.end_time >= start_dt)
            ]
        
        if end_date:
            end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
            filtered = [
                i for i in filtered 
                if (i.start_time and i.start_time <= end_dt) or 
                   (i.end_time and i.end_time <= end_dt)
            ]
        
        return filtered

    def mark_resolved(
        self, 
        issue_id: str, 
        resolved_by: str, 
        resolve_notes: str = ""
    ) -> bool:
        for issue in self.all_issues:
            if issue.issue_id == issue_id:
                issue.is_resolved = True
                issue.resolved_by = resolved_by
                issue.resolved_at = datetime.now()
                issue.resolve_notes = resolve_notes
                return True
        return False
