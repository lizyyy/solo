from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

from .models import (
    FlightPlan, WeatherData, FluidBatch, SprayRecord,
    ReleaseWindow, Issue, IssueType, IssueSeverity,
    FluidType
)


class DeicingReviewEngine:
    def __init__(self):
        self.issue_counter = 0
        self.issues: List[Issue] = []
        self.release_windows: List[ReleaseWindow] = []
        self.analysis_summary: Dict[str, Any] = {}

    def _generate_issue_id(self) -> str:
        self.issue_counter += 1
        return f"ISS_{self.issue_counter:06d}"

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        flight: Optional[FlightPlan],
        spray: Optional[SprayRecord],
        timestamp: datetime,
        description: str,
        recommendation: str,
        metadata: Dict[str, Any] = None
    ) -> Issue:
        flight_number = flight.flight_number if flight else "UNKNOWN"
        registration = flight.aircraft_registration if flight else (spray.aircraft_registration if spray else "UNKNOWN")
        runway = flight.departure_runway if flight else (spray.runway if spray else "UNKNOWN")
        
        issue = Issue(
            issue_id=self._generate_issue_id(),
            issue_type=issue_type,
            severity=severity,
            flight_number=flight_number,
            aircraft_registration=registration,
            runway=runway,
            timestamp=timestamp,
            description=description,
            recommendation=recommendation,
            metadata=metadata or {}
        )
        self.issues.append(issue)
        return issue

    def analyze(
        self,
        flights: List[FlightPlan],
        weather_records: List[WeatherData],
        fluid_batches: Dict[str, FluidBatch],
        spray_records: List[SprayRecord]
    ) -> Tuple[List[ReleaseWindow], List[Issue]]:
        self.issues = []
        self.release_windows = []
        
        sprays_by_registration = defaultdict(list)
        for spray in spray_records:
            if spray.fluid_batch_id and spray.fluid_batch_id in fluid_batches:
                spray.fluid_batch = fluid_batches[spray.fluid_batch_id]
            sprays_by_registration[spray.aircraft_registration].append(spray)
        
        for flight in flights:
            matching_sprays = self._find_matching_sprays(flight, sprays_by_registration)
            
            if not matching_sprays:
                self._add_issue(
                    issue_type=IssueType.MISSING_BATCH_INFO,
                    severity=IssueSeverity.CRITICAL,
                    flight=flight,
                    spray=None,
                    timestamp=flight.scheduled_departure_time,
                    description=f"航班 {flight.flight_number} 未找到对应的除冰喷洒记录",
                    recommendation="请核查该航班是否已完成除冰作业，或补充喷洒记录",
                    metadata={
                        "flight_number": flight.flight_number,
                        "registration": flight.aircraft_registration,
                        "scheduled_departure": flight.scheduled_departure_time.isoformat()
                    }
                )
                continue
            
            latest_spray = max(matching_sprays, key=lambda x: x.spray_time)
            
            if flight.is_cross_midnight:
                self._add_issue(
                    issue_type=IssueType.CROSS_MIDNIGHT_FLIGHT,
                    severity=IssueSeverity.WARNING,
                    flight=flight,
                    spray=latest_spray,
                    timestamp=flight.scheduled_departure_time,
                    description=f"航班 {flight.flight_number} 为跨午夜航班 (计划时间: {flight.scheduled_departure_time.strftime('%H:%M')})",
                    recommendation="请特别关注跨午夜航班的除冰保持时间有效性，建议提前15分钟复核",
                    metadata={
                        "scheduled_hour": flight.scheduled_departure_time.hour,
                        "is_cross_midnight": True
                    }
                )
            
            weather_at_spray = self._get_weather_at_time(
                weather_records, 
                latest_spray.spray_time,
                flight.departure_runway
            )
            
            release_window = self._calculate_release_window(
                flight, latest_spray, weather_at_spray, fluid_batches
            )
            
            if release_window:
                self.release_windows.append(release_window)
                
                self._validate_release_window(
                    flight, latest_spray, release_window, weather_at_spray, fluid_batches
                )
        
        self._generate_summary(flights, spray_records)
        
        return self.release_windows, self.issues

    def _find_matching_sprays(
        self, 
        flight: FlightPlan, 
        sprays_by_registration: Dict[str, List[SprayRecord]]
    ) -> List[SprayRecord]:
        registration = flight.aircraft_registration
        if not registration:
            return []
        
        candidates = sprays_by_registration.get(registration, [])
        
        dept_time = flight.scheduled_departure_time
        max_time_before = dept_time - timedelta(hours=4)
        min_time_before = dept_time
        
        matching = []
        for spray in candidates:
            if max_time_before <= spray.spray_time <= dept_time:
                matching.append(spray)
        
        return matching

    def _get_weather_at_time(
        self, 
        weather_records: List[WeatherData], 
        target_time: datetime,
        runway: str
    ) -> Optional[WeatherData]:
        runway_records = [
            w for w in weather_records 
            if w.runway == runway or w.runway == "ALL"
        ]
        
        if not runway_records:
            return None
        
        closest = min(
            runway_records,
            key=lambda w: abs((w.timestamp - target_time).total_seconds())
        )
        
        time_diff = abs((closest.timestamp - target_time).total_seconds())
        if time_diff > 3600:
            return None
        
        return closest

    def _calculate_release_window(
        self,
        flight: FlightPlan,
        spray: SprayRecord,
        weather: Optional[WeatherData],
        fluid_batches: Dict[str, FluidBatch]
    ) -> Optional[ReleaseWindow]:
        fluid_type = spray.fluid_type
        fluid_batch = spray.fluid_batch
        
        if fluid_type is None:
            if fluid_batch:
                fluid_type = fluid_batch.fluid_type
            else:
                self._add_issue(
                    issue_type=IssueType.MISSING_FLUID_TYPE,
                    severity=IssueSeverity.WARNING,
                    flight=flight,
                    spray=spray,
                    timestamp=spray.spray_time,
                    description=f"喷洒记录 {spray.record_id} 缺少液型信息，批次ID: {spray.fluid_batch_id}",
                    recommendation="请补充液型信息或核查批次配置，将使用默认保持时间计算",
                    metadata={
                        "spray_record_id": spray.record_id,
                        "batch_id": spray.fluid_batch_id
                    }
                )
                fluid_type = FluidType.UNKNOWN
        
        temperature = weather.temperature if weather else 0.0
        precipitation = weather.precipitation if weather else ""
        
        hold_start = spray.spray_time
        
        if fluid_batch:
            min_ht, max_ht = fluid_batch.get_hold_time_range(temperature)
        else:
            from .readers import FluidBatchReader
            default_ht = FluidBatchReader()._get_default_hold_times(fluid_type)
            temp_key = int(round(temperature))
            if temp_key in default_ht:
                min_ht = max_ht = default_ht[temp_key]
            else:
                sorted_keys = sorted(default_ht.keys())
                closest = min(sorted_keys, key=lambda k: abs(k - temp_key))
                min_ht = max_ht = default_ht[closest]
        
        if weather and weather.has_active_precipitation():
            precipitation_factor = 0.7
            min_ht = int(min_ht * precipitation_factor)
            max_ht = int(max_ht * precipitation_factor)
        
        hold_end_min = hold_start + timedelta(minutes=min_ht)
        hold_end_max = hold_start + timedelta(minutes=max_ht)
        
        return ReleaseWindow(
            flight_number=flight.flight_number,
            aircraft_registration=flight.aircraft_registration,
            runway=flight.departure_runway,
            spray_time=spray.spray_time,
            scheduled_departure=flight.scheduled_departure_time,
            hold_start_time=hold_start,
            hold_end_time_min=hold_end_min,
            hold_end_time_max=hold_end_max,
            fluid_type=fluid_type,
            batch_id=spray.fluid_batch_id,
            temperature_at_spray=temperature,
            precipitation_status=precipitation
        )

    def _validate_release_window(
        self,
        flight: FlightPlan,
        spray: SprayRecord,
        window: ReleaseWindow,
        weather: Optional[WeatherData],
        fluid_batches: Dict[str, FluidBatch]
    ):
        dept_time = flight.scheduled_departure_time
        
        in_window, status = window.is_within_window(dept_time)
        
        if status == "HOLD_TIME_EXPIRED":
            remaining = window.get_remaining_hold_time(dept_time)
            expired_minutes = int((dept_time - window.hold_end_time_max).total_seconds() / 60)
            
            self._add_issue(
                issue_type=IssueType.HOLD_TIME_EXPIRED,
                severity=IssueSeverity.CRITICAL,
                flight=flight,
                spray=spray,
                timestamp=dept_time,
                description=f"航班 {flight.flight_number} 除冰保持时间已过期 {expired_minutes} 分钟。"
                           f"喷洒时间: {spray.spray_time.strftime('%H:%M')}, "
                           f"保持截止: {window.hold_end_time_max.strftime('%H:%M')}, "
                           f"计划起飞: {dept_time.strftime('%H:%M')}",
                recommendation="必须立即重新进行除冰作业，严禁在保持时间过期后起飞",
                metadata={
                    "spray_time": spray.spray_time.isoformat(),
                    "hold_end_max": window.hold_end_time_max.isoformat(),
                    "scheduled_departure": dept_time.isoformat(),
                    "expired_minutes": expired_minutes,
                    "fluid_type": window.fluid_type.value
                }
            )
        
        elif status == "WITHIN_EXTENDED_WINDOW":
            remaining = window.get_remaining_hold_time(dept_time)
            remaining_minutes = int(remaining.total_seconds() / 60)
            
            self._add_issue(
                issue_type=IssueType.INSUFFICIENT_HOLD_TIME,
                severity=IssueSeverity.WARNING,
                flight=flight,
                spray=spray,
                timestamp=dept_time,
                description=f"航班 {flight.flight_number} 处于扩展保持时间窗口内。"
                           f"剩余保持时间: {remaining_minutes} 分钟",
                recommendation="建议立即安排起飞，或考虑补喷以延长保持时间",
                metadata={
                    "remaining_minutes": remaining_minutes,
                    "window_status": "EXTENDED",
                    "fluid_type": window.fluid_type.value
                }
            )
        
        if weather and weather.has_active_precipitation():
            remaining = window.get_remaining_hold_time(dept_time)
            remaining_minutes = int(remaining.total_seconds() / 60)
            
            if remaining_minutes < 30:
                self._add_issue(
                    issue_type=IssueType.PRECIPITATION_RISK,
                    severity=IssueSeverity.WARNING,
                    flight=flight,
                    spray=spray,
                    timestamp=dept_time,
                    description=f"航班 {flight.flight_number} 当前有降水 ({weather.precipitation})，"
                               f"保持时间已缩短。剩余: {remaining_minutes} 分钟",
                    recommendation="降水条件下保持时间会缩短，建议补喷或尽快起飞",
                    metadata={
                        "precipitation": weather.precipitation,
                        "temperature": weather.temperature,
                        "remaining_minutes": remaining_minutes
                    }
                )
        
        if fluid_batch := spray.fluid_batch:
            if not fluid_batch.is_valid(spray.spray_time):
                self._add_issue(
                    issue_type=IssueType.FLUID_CONFLICT,
                    severity=IssueSeverity.CRITICAL,
                    flight=flight,
                    spray=spray,
                    timestamp=spray.spray_time,
                    description=f"除冰液批次 {spray.fluid_batch_id} 在喷洒时已过期或未生效",
                    recommendation="请核查除冰液批次有效期，已过期批次禁止使用",
                    metadata={
                        "batch_id": spray.fluid_batch_id,
                        "production_date": fluid_batch.production_date.isoformat(),
                        "expiry_date": fluid_batch.expiry_date.isoformat(),
                        "spray_date": spray.spray_time.isoformat()
                    }
                )
        
        if spray.fluid_type and spray.fluid_batch:
            if spray.fluid_type != spray.fluid_batch.fluid_type:
                self._add_issue(
                    issue_type=IssueType.FLUID_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    flight=flight,
                    spray=spray,
                    timestamp=spray.spray_time,
                    description=f"喷洒记录液型 ({spray.fluid_type.value}) 与批次配置液型 "
                               f"({spray.fluid_batch.fluid_type.value}) 不一致",
                    recommendation="请核查喷洒记录和批次配置，确保液型一致",
                    metadata={
                        "spray_fluid_type": spray.fluid_type.value,
                        "batch_fluid_type": spray.fluid_batch.fluid_type.value
                    }
                )
        
        if weather:
            if weather.temperature < -25 or weather.temperature > 15:
                self._add_issue(
                    issue_type=IssueType.TEMPERATURE_OUT_OF_RANGE,
                    severity=IssueSeverity.WARNING,
                    flight=flight,
                    spray=spray,
                    timestamp=spray.spray_time,
                    description=f"当前温度 {weather.temperature}°C 超出标准除冰液有效温度范围",
                    recommendation="请确认使用的除冰液适用于当前温度范围，或咨询厂商技术支持",
                    metadata={
                        "temperature": weather.temperature,
                        "runway": weather.runway
                    }
                )

    def _generate_summary(
        self,
        flights: List[FlightPlan],
        spray_records: List[SprayRecord]
    ):
        critical_count = sum(1 for i in self.issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in self.issues if i.severity == IssueSeverity.INFO)
        
        by_type = defaultdict(int)
        for issue in self.issues:
            by_type[issue.issue_type.value] += 1
        
        cross_midnight_count = sum(1 for f in flights if f.is_cross_midnight)
        
        self.analysis_summary = {
            "total_flights": len(flights),
            "total_sprays": len(spray_records),
            "cross_midnight_flights": cross_midnight_count,
            "total_issues": len(self.issues),
            "critical_issues": critical_count,
            "warning_issues": warning_count,
            "info_issues": info_count,
            "issues_by_type": dict(by_type),
            "analysis_time": datetime.now().isoformat()
        }

    def get_summary(self) -> Dict[str, Any]:
        return self.analysis_summary

    def get_respray_recommendations(self) -> List[Dict[str, Any]]:
        recommendations = []
        
        for issue in self.issues:
            if issue.issue_type in [IssueType.HOLD_TIME_EXPIRED, IssueType.INSUFFICIENT_HOLD_TIME]:
                rec = {
                    "flight_number": issue.flight_number,
                    "registration": issue.aircraft_registration,
                    "runway": issue.runway,
                    "urgency": "HIGH" if issue.severity == IssueSeverity.CRITICAL else "MEDIUM",
                    "reason": issue.description,
                    "recommended_action": issue.recommendation,
                    "metadata": issue.metadata
                }
                recommendations.append(rec)
        
        for window in self.release_windows:
            if window not in [w for w in self.release_windows if any(
                i.flight_number == window.flight_number and 
                i.issue_type in [IssueType.HOLD_TIME_EXPIRED, IssueType.INSUFFICIENT_HOLD_TIME]
                for i in self.issues
            )]:
                remaining = window.get_remaining_hold_time(datetime.now())
                remaining_minutes = int(remaining.total_seconds() / 60)
                
                if 15 <= remaining_minutes < 30:
                    rec = {
                        "flight_number": window.flight_number,
                        "registration": window.aircraft_registration,
                        "runway": window.runway,
                        "urgency": "LOW",
                        "reason": f"保持时间剩余 {remaining_minutes} 分钟，建议关注",
                        "recommended_action": "监控起飞进度，必要时准备补喷",
                        "metadata": {
                            "remaining_minutes": remaining_minutes,
                            "hold_end_max": window.hold_end_time_max.isoformat()
                        }
                    }
                    recommendations.append(rec)
        
        return sorted(recommendations, key=lambda x: {
            "HIGH": 0, "MEDIUM": 1, "LOW": 2
        }[x["urgency"]])
