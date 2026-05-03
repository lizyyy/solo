import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from enum import Enum

from .data_parser import DataParser, KilnBatch, TemperaturePoint, RecipeRule


class RiskType(Enum):
    HEATING_RATE_EXCEED = "heating_rate_exceed"
    INSUFFICIENT_HOLDING = "insufficient_holding"
    PROBE_DISCONNECTION = "probe_disconnection"
    MIDNIGHT_ALIGNMENT_ERROR = "midnight_alignment_error"


@dataclass
class Issue:
    issue_id: str
    batch_id: str
    risk_type: RiskType
    timestamp: datetime
    severity: str
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    is_false_positive: bool = False
    notes: str = ""


class RuleEngine:
    def __init__(self, data_parser: DataParser):
        self.data_parser = data_parser
        self.issues: Dict[str, List[Issue]] = {}
        self._issue_counter = 0

    def _generate_issue_id(self) -> str:
        self._issue_counter += 1
        return f"ISS_{datetime.now().strftime('%Y%m%d')}_{self._issue_counter:04d}"

    def check_heating_rate(self, batch: KilnBatch, temp_points: List[TemperaturePoint]) -> List[Issue]:
        issues = []
        if not temp_points or len(temp_points) < 2:
            return issues

        recipe = self.data_parser.recipes.get(batch.recipe_name)
        max_rate = recipe.max_heating_rate if recipe else 150.0

        valid_points = [p for p in temp_points if p.is_valid]
        if len(valid_points) < 2:
            return issues

        for i in range(1, len(valid_points)):
            prev = valid_points[i-1]
            curr = valid_points[i]
            
            time_diff_min = (curr.timestamp - prev.timestamp).total_seconds() / 60
            if time_diff_min <= 0:
                continue
            
            temp_diff = curr.temperature - prev.temperature
            
            if temp_diff > 0:
                rate_per_hour = (temp_diff / time_diff_min) * 60
                
                if rate_per_hour > max_rate * 1.1:
                    issue = Issue(
                        issue_id=self._generate_issue_id(),
                        batch_id=batch.batch_id,
                        risk_type=RiskType.HEATING_RATE_EXCEED,
                        timestamp=curr.timestamp,
                        severity="high" if rate_per_hour > max_rate * 1.5 else "medium",
                        description=f"升温速率超限: {rate_per_hour:.1f}°C/h (上限: {max_rate}°C/h)",
                        details={
                            "actual_rate": rate_per_hour,
                            "max_allowed": max_rate,
                            "time_window_min": time_diff_min,
                            "temp_increase": temp_diff,
                            "start_temp": prev.temperature,
                            "end_temp": curr.temperature,
                            "start_time": prev.timestamp.isoformat(),
                            "end_time": curr.timestamp.isoformat()
                        }
                    )
                    issues.append(issue)
        
        return issues

    def check_holding_time(self, batch: KilnBatch, temp_points: List[TemperaturePoint]) -> List[Issue]:
        issues = []
        if not temp_points:
            return issues

        recipe = self.data_parser.recipes.get(batch.recipe_name)
        min_holding = recipe.min_holding_time if recipe else 30.0
        target_temp = batch.target_temp

        valid_points = [p for p in temp_points if p.is_valid]
        if not valid_points:
            return issues

        temp_tolerance = 50.0
        holding_periods = []
        current_holding_start = None
        current_holding_temp = None

        for point in valid_points:
            if abs(point.temperature - target_temp) <= temp_tolerance:
                if current_holding_start is None:
                    current_holding_start = point.timestamp
                    current_holding_temp = point.temperature
            else:
                if current_holding_start is not None:
                    holding_min = (point.timestamp - current_holding_start).total_seconds() / 60
                    holding_periods.append({
                        "start": current_holding_start,
                        "end": point.timestamp,
                        "duration_min": holding_min,
                        "avg_temp": current_holding_temp
                    })
                    current_holding_start = None
                    current_holding_temp = None

        if current_holding_start is not None:
            last_point = valid_points[-1]
            holding_min = (last_point.timestamp - current_holding_start).total_seconds() / 60
            holding_periods.append({
                "start": current_holding_start,
                "end": last_point.timestamp,
                "duration_min": holding_min,
                "avg_temp": current_holding_temp
            })

        for period in holding_periods:
            if period["duration_min"] < min_holding:
                issue = Issue(
                    issue_id=self._generate_issue_id(),
                    batch_id=batch.batch_id,
                    risk_type=RiskType.INSUFFICIENT_HOLDING,
                    timestamp=period["start"],
                    severity="high" if period["duration_min"] < min_holding * 0.5 else "medium",
                    description=f"保温时间不足: {period['duration_min']:.1f}分钟 (要求: {min_holding}分钟)",
                    details={
                        "actual_duration_min": period["duration_min"],
                        "required_duration_min": min_holding,
                        "holding_temp": period["avg_temp"],
                        "target_temp": target_temp,
                        "start_time": period["start"].isoformat(),
                        "end_time": period["end"].isoformat()
                    }
                )
                issues.append(issue)

        if not holding_periods and target_temp > 0:
            max_temp = max(p.temperature for p in valid_points)
            if max_temp < target_temp - temp_tolerance:
                issue = Issue(
                    issue_id=self._generate_issue_id(),
                    batch_id=batch.batch_id,
                    risk_type=RiskType.INSUFFICIENT_HOLDING,
                    timestamp=valid_points[-1].timestamp,
                    severity="high",
                    description=f"未达到目标保温温度: 最高{max_temp:.1f}°C (目标: {target_temp}°C)",
                    details={
                        "max_temp": max_temp,
                        "target_temp": target_temp,
                        "never_reached_target": True
                    }
                )
                issues.append(issue)

        return issues

    def check_probe_connection(self, batch: KilnBatch, temp_points: List[TemperaturePoint]) -> List[Issue]:
        issues = []
        if not temp_points:
            return issues

        expected_interval_min = 5.0
        
        for i in range(1, len(temp_points)):
            prev = temp_points[i-1]
            curr = temp_points[i]
            
            time_diff_min = (curr.timestamp - prev.timestamp).total_seconds() / 60
            
            if time_diff_min > expected_interval_min * 3:
                issue = Issue(
                    issue_id=self._generate_issue_id(),
                    batch_id=batch.batch_id,
                    risk_type=RiskType.PROBE_DISCONNECTION,
                    timestamp=prev.timestamp,
                    severity="high",
                    description=f"探头数据中断: 间隔{time_diff_min:.1f}分钟 (正常间隔: ~{expected_interval_min}分钟)",
                    details={
                        "gap_duration_min": time_diff_min,
                        "expected_interval_min": expected_interval_min,
                        "last_valid_time": prev.timestamp.isoformat(),
                        "next_valid_time": curr.timestamp.isoformat()
                    }
                )
                issues.append(issue)

        invalid_count = sum(1 for p in temp_points if not p.is_valid)
        if invalid_count > 0:
            invalid_ratio = invalid_count / len(temp_points)
            if invalid_ratio > 0.1:
                issue = Issue(
                    issue_id=self._generate_issue_id(),
                    batch_id=batch.batch_id,
                    risk_type=RiskType.PROBE_DISCONNECTION,
                    timestamp=temp_points[-1].timestamp,
                    severity="medium" if invalid_ratio < 0.3 else "high",
                    description=f"无效数据点过多: {invalid_count}/{len(temp_points)} ({invalid_ratio*100:.1f}%)",
                    details={
                        "invalid_count": invalid_count,
                        "total_count": len(temp_points),
                        "invalid_ratio": invalid_ratio
                    }
                )
                issues.append(issue)

        return issues

    def check_midnight_alignment(self, batch: KilnBatch, temp_points: List[TemperaturePoint]) -> List[Issue]:
        issues = []
        if not batch.end_time:
            return issues

        start_date = batch.start_time.date()
        end_date = batch.end_time.date()
        
        if start_date != end_date:
            midnight = datetime.combine(end_date, datetime.min.time())
            
            if batch.start_time < midnight < batch.end_time:
                total_duration = (batch.end_time - batch.start_time).total_seconds() / 3600
                
                if total_duration < 24:
                    midnight_duration = (batch.end_time - midnight).total_seconds() / 3600
                    pre_midnight_duration = (midnight - batch.start_time).total_seconds() / 3600
                    
                    if midnight_duration > pre_midnight_duration * 2:
                        issue = Issue(
                            issue_id=self._generate_issue_id(),
                            batch_id=batch.batch_id,
                            risk_type=RiskType.MIDNIGHT_ALIGNMENT_ERROR,
                            timestamp=midnight,
                            severity="medium",
                            description=f"跨午夜批次归属可能错位: 次日占比{midnight_duration/total_duration*100:.1f}%",
                            details={
                                "start_time": batch.start_time.isoformat(),
                                "end_time": batch.end_time.isoformat(),
                                "total_duration_hours": total_duration,
                                "pre_midnight_hours": pre_midnight_duration,
                                "post_midnight_hours": midnight_duration,
                                "suggested_review": "请确认此批次是否应归属到次日"
                            }
                        )
                        issues.append(issue)

        return issues

    def analyze_batch(self, batch_id: str) -> List[Issue]:
        if batch_id not in self.data_parser.batches:
            return []
        
        batch = self.data_parser.batches[batch_id]
        temp_points = self.data_parser.get_batch_temperature_data(batch_id)
        
        all_issues = []
        
        all_issues.extend(self.check_heating_rate(batch, temp_points))
        all_issues.extend(self.check_holding_time(batch, temp_points))
        all_issues.extend(self.check_probe_connection(batch, temp_points))
        all_issues.extend(self.check_midnight_alignment(batch, temp_points))
        
        self.issues[batch_id] = all_issues
        
        return all_issues

    def analyze_all_batches(self) -> Dict[str, List[Issue]]:
        for batch_id in self.data_parser.batches:
            self.analyze_batch(batch_id)
        return self.issues

    def get_batch_issues(self, batch_id: str) -> List[Issue]:
        return self.issues.get(batch_id, [])

    def get_all_issues(self) -> List[Issue]:
        all_issues = []
        for issues in self.issues.values():
            all_issues.extend(issues)
        return all_issues

    def confirm_issue(self, issue_id: str, confirmed_by: str = "", 
                       is_false_positive: bool = False, notes: str = "") -> bool:
        for batch_issues in self.issues.values():
            for issue in batch_issues:
                if issue.issue_id == issue_id:
                    issue.confirmed_by = confirmed_by
                    issue.confirmed_at = datetime.now()
                    issue.is_false_positive = is_false_positive
                    issue.notes = notes
                    return True
        return False
