from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import uuid

from data_models import (
    InspectionRecord, SensorRecord, EmptyingRecord, ComplaintRecord,
    ToiletInfo, RiskItem, RiskType, RiskLevel, ActionType
)


class RiskEngine:
    def __init__(self, toilets: Dict[str, ToiletInfo]):
        self.toilets = toilets
        self.analysis_date: Optional[datetime] = None
    
    def set_analysis_date(self, date: datetime):
        self.analysis_date = date
    
    def analyze_all(
        self,
        inspections: List[InspectionRecord],
        sensors: List[SensorRecord],
        emptyings: List[EmptyingRecord],
        complaints: List[ComplaintRecord]
    ) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        risks.extend(self._check_missing_inspections(inspections))
        risks.extend(self._check_odor_exceed(sensors))
        risks.extend(self._check_peak_flow(sensors))
        risks.extend(self._check_emptying_overdue(emptyings))
        risks.extend(self._check_repeat_complaints(complaints))
        
        return risks
    
    def _get_toilet_name(self, toilet_id: str) -> str:
        toilet = self.toilets.get(toilet_id)
        return toilet.name if toilet else f"公厕 {toilet_id}"
    
    def _get_toilet_info(self, toilet_id: str) -> ToiletInfo:
        toilet = self.toilets.get(toilet_id)
        if not toilet:
            toilet = ToiletInfo(
                toilet_id=toilet_id,
                name=f"公厕 {toilet_id}",
                location="未知",
                total_stalls=10
            )
        return toilet
    
    def _create_risk(
        self,
        toilet_id: str,
        risk_type: RiskType,
        risk_level: RiskLevel,
        description: str,
        timestamp: datetime,
        suggested_action: ActionType,
        raw_data: Dict
    ) -> RiskItem:
        toilet = self._get_toilet_info(toilet_id)
        return RiskItem(
            risk_id=str(uuid.uuid4())[:8],
            toilet_id=toilet_id,
            toilet_name=toilet.name,
            time_slot=toilet.get_time_slot(timestamp),
            risk_type=risk_type,
            risk_level=risk_level,
            description=description,
            timestamp=timestamp,
            suggested_action=suggested_action,
            raw_data=raw_data
        )
    
    def _check_missing_inspections(self, inspections: List[InspectionRecord]) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        inspections_by_toilet = defaultdict(list)
        for insp in inspections:
            inspections_by_toilet[insp.toilet_id].append(insp)
        
        for toilet_id, toilet_inspections in inspections_by_toilet.items():
            toilet = self._get_toilet_info(toilet_id)
            interval = timedelta(minutes=toilet.inspection_interval_minutes)
            
            toilet_inspections.sort(key=lambda x: x.inspect_time)
            
            for i in range(len(toilet_inspections) - 1):
                current = toilet_inspections[i]
                next_insp = toilet_inspections[i + 1]
                gap = next_insp.inspect_time - current.inspect_time
                
                if gap > interval:
                    missing_time = current.inspect_time + interval
                    risks.append(self._create_risk(
                        toilet_id=toilet_id,
                        risk_type=RiskType.MISSING_INSPECTION,
                        risk_level=RiskLevel.MEDIUM,
                        description=f"巡检间隔超时 {int(gap.total_seconds()/60)} 分钟，"
                                   f"预期 {current.inspect_time.strftime('%H:%M')} 至 {missing_time.strftime('%H:%M')} 应有巡检",
                        timestamp=missing_time,
                        suggested_action=ActionType.ADD_STAFF,
                        raw_data={
                            "last_inspection": current.inspect_time.isoformat(),
                            "next_inspection": next_insp.inspect_time.isoformat(),
                            "gap_minutes": int(gap.total_seconds()/60),
                            "inspector": current.inspector
                        }
                    ))
            
            if toilet_inspections:
                first_inspection = toilet_inspections[0]
                expected_start = datetime.combine(
                    first_inspection.inspect_time.date(),
                    datetime.min.time().replace(hour=6)
                )
                if first_inspection.inspect_time > expected_start + interval:
                    risks.append(self._create_risk(
                        toilet_id=toilet_id,
                        risk_type=RiskType.MISSING_INSPECTION,
                        risk_level=RiskLevel.LOW,
                        description=f"早间首检延迟，预期 06:00 开始巡检，实际 {first_inspection.inspect_time.strftime('%H:%M')}",
                        timestamp=expected_start + interval,
                        suggested_action=ActionType.ADD_STAFF,
                        raw_data={
                            "expected_start": expected_start.isoformat(),
                            "actual_start": first_inspection.inspect_time.isoformat()
                        }
                    ))
        
        return risks
    
    def _check_odor_exceed(self, sensors: List[SensorRecord]) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        sensors_by_toilet = defaultdict(list)
        for sensor in sensors:
            sensors_by_toilet[sensor.toilet_id].append(sensor)
        
        for toilet_id, toilet_sensors in sensors_by_toilet.items():
            toilet = self._get_toilet_info(toilet_id)
            threshold = toilet.ammonia_threshold
            
            toilet_sensors.sort(key=lambda x: x.timestamp)
            
            consecutive_high = 0
            max_ammonia = 0.0
            start_time = None
            
            for sensor in toilet_sensors:
                if sensor.ammonia_level >= threshold:
                    if consecutive_high == 0:
                        start_time = sensor.timestamp
                    consecutive_high += 1
                    max_ammonia = max(max_ammonia, sensor.ammonia_level)
                else:
                    if consecutive_high >= 3:
                        risks.append(self._create_risk(
                            toilet_id=toilet_id,
                            risk_type=RiskType.ODOR_EXCEED,
                            risk_level=RiskLevel.HIGH if max_ammonia > threshold * 1.5 else RiskLevel.MEDIUM,
                            description=f"氨气浓度连续超标，最高 {max_ammonia:.1f} ppm（阈值 {threshold} ppm），"
                                       f"持续 {consecutive_high} 个检测周期",
                            timestamp=start_time if start_time else sensor.timestamp,
                            suggested_action=ActionType.SUSPEND if max_ammonia > threshold * 1.5 else ActionType.ADD_STAFF,
                            raw_data={
                                "max_ammonia": max_ammonia,
                                "threshold": threshold,
                                "consecutive_count": consecutive_high,
                                "start_time": start_time.isoformat() if start_time else None
                            }
                        ))
                    consecutive_high = 0
                    max_ammonia = 0.0
                    start_time = None
            
            if consecutive_high >= 3:
                risks.append(self._create_risk(
                    toilet_id=toilet_id,
                    risk_type=RiskType.ODOR_EXCEED,
                    risk_level=RiskLevel.HIGH if max_ammonia > threshold * 1.5 else RiskLevel.MEDIUM,
                    description=f"氨气浓度连续超标，最高 {max_ammonia:.1f} ppm（阈值 {threshold} ppm），"
                               f"持续 {consecutive_high} 个检测周期",
                    timestamp=start_time if start_time else datetime.now(),
                    suggested_action=ActionType.SUSPEND if max_ammonia > threshold * 1.5 else ActionType.ADD_STAFF,
                    raw_data={
                        "max_ammonia": max_ammonia,
                        "threshold": threshold,
                        "consecutive_count": consecutive_high,
                        "start_time": start_time.isoformat() if start_time else None
                    }
                ))
        
        return risks
    
    def _check_peak_flow(self, sensors: List[SensorRecord]) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        sensors_by_toilet = defaultdict(list)
        for sensor in sensors:
            sensors_by_toilet[sensor.toilet_id].append(sensor)
        
        for toilet_id, toilet_sensors in sensors_by_toilet.items():
            toilet = self._get_toilet_info(toilet_id)
            threshold = toilet.peak_flow_threshold
            
            hourly_flow: Dict[Tuple[datetime.date, int], int] = defaultdict(int)
            hourly_sensors: Dict[Tuple[datetime.date, int], List[SensorRecord]] = defaultdict(list)
            
            for sensor in toilet_sensors:
                key = (sensor.timestamp.date(), sensor.timestamp.hour)
                hourly_flow[key] += sensor.passenger_flow
                hourly_sensors[key].append(sensor)
            
            for (date, hour), flow in hourly_flow.items():
                if flow >= threshold:
                    hour_start = datetime.combine(date, datetime.min.time().replace(hour=hour))
                    is_peak_hour = (6 <= hour < 10) or (18 <= hour < 22)
                    
                    risks.append(self._create_risk(
                        toilet_id=toilet_id,
                        risk_type=RiskType.PEAK_FLOW_UNATTENDED,
                        risk_level=RiskLevel.HIGH if is_peak_hour and flow > threshold * 1.5 else RiskLevel.MEDIUM,
                        description=f"客流突增，{hour}:00-{hour+1}:00 时段客流 {flow} 人（阈值 {threshold} 人），"
                                   f"需确认保洁补给是否及时",
                        timestamp=hour_start,
                        suggested_action=ActionType.ADD_STAFF,
                        raw_data={
                            "hourly_flow": flow,
                            "threshold": threshold,
                            "is_peak_hour": is_peak_hour,
                            "hour": hour
                        }
                    ))
        
        return risks
    
    def _check_emptying_overdue(self, emptyings: List[EmptyingRecord]) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        if self.analysis_date is None:
            return risks
        
        emptyings_by_toilet = defaultdict(list)
        for empty in emptyings:
            emptyings_by_toilet[empty.toilet_id].append(empty)
        
        for toilet_id, toilet_emptyings in emptyings_by_toilet.items():
            toilet = self._get_toilet_info(toilet_id)
            cycle_days = toilet.emptying_cycle_days
            
            toilet_emptyings.sort(key=lambda x: x.arrival_time, reverse=True)
            
            if toilet_emptyings:
                last_emptying = toilet_emptyings[0]
                days_since = (self.analysis_date - last_emptying.arrival_time).days
                
                if days_since > cycle_days:
                    overdue_days = days_since - cycle_days
                    risks.append(self._create_risk(
                        toilet_id=toilet_id,
                        risk_type=RiskType.EMPTYING_OVERDUE,
                        risk_level=RiskLevel.HIGH if overdue_days > 7 else RiskLevel.MEDIUM,
                        description=f"化粪池清掏逾期，上次清掏 {last_emptying.arrival_time.strftime('%Y-%m-%d')}，"
                                   f"已逾期 {overdue_days} 天（周期 {cycle_days} 天）",
                        timestamp=last_emptying.arrival_time + timedelta(days=cycle_days),
                        suggested_action=ActionType.ARRANGE_EMPTYING,
                        raw_data={
                            "last_emptying": last_emptying.arrival_time.isoformat(),
                            "cycle_days": cycle_days,
                            "days_since": days_since,
                            "overdue_days": overdue_days,
                            "truck_id": last_emptying.truck_id
                        }
                    ))
            else:
                risks.append(self._create_risk(
                    toilet_id=toilet_id,
                    risk_type=RiskType.EMPTYING_OVERDUE,
                    risk_level=RiskLevel.HIGH,
                    description=f"无清掏记录，需立即安排化粪池清掏",
                    timestamp=self.analysis_date,
                    suggested_action=ActionType.ARRANGE_EMPTYING,
                    raw_data={
                        "message": "无历史清掏记录"
                    }
                ))
        
        return risks
    
    def _check_repeat_complaints(self, complaints: List[ComplaintRecord]) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        complaints_by_toilet = defaultdict(list)
        for comp in complaints:
            complaints_by_toilet[comp.toilet_id].append(comp)
        
        for toilet_id, toilet_complaints in complaints_by_toilet.items():
            toilet_complaints.sort(key=lambda x: x.complaint_time)
            
            for i, comp in enumerate(toilet_complaints):
                if i == 0:
                    continue
                
                prev_complaint = toilet_complaints[i-1]
                time_diff = comp.complaint_time - prev_complaint.complaint_time
                
                if time_diff <= timedelta(hours=2):
                    risks.append(self._create_risk(
                        toilet_id=toilet_id,
                        risk_type=RiskType.REPEAT_COMPLAINT,
                        risk_level=RiskLevel.HIGH if comp.complaint_type == "异味" else RiskLevel.MEDIUM,
                        description=f"重复投诉：{prev_complaint.complaint_time.strftime('%H:%M')} 收到 {prev_complaint.complaint_type} 投诉，"
                                   f"{comp.complaint_time.strftime('%H:%M')} 又收到 {comp.complaint_type} 投诉，"
                                   f"间隔 {int(time_diff.total_seconds()/60)} 分钟",
                        timestamp=comp.complaint_time,
                        suggested_action=ActionType.ADD_STAFF,
                        raw_data={
                            "first_complaint": {
                                "time": prev_complaint.complaint_time.isoformat(),
                                "type": prev_complaint.complaint_type,
                                "description": prev_complaint.description
                            },
                            "second_complaint": {
                                "time": comp.complaint_time.isoformat(),
                                "type": comp.complaint_type,
                                "description": comp.description
                            },
                            "interval_minutes": int(time_diff.total_seconds()/60)
                        }
                    ))
            
            daily_complaints: Dict[datetime.date, List[ComplaintRecord]] = defaultdict(list)
            for comp in toilet_complaints:
                daily_complaints[comp.complaint_time.date()].append(comp)
            
            for date, comps in daily_complaints.items():
                if len(comps) >= 3:
                    risks.append(self._create_risk(
                        toilet_id=toilet_id,
                        risk_type=RiskType.REPEAT_COMPLAINT,
                        risk_level=RiskLevel.HIGH,
                        description=f"单日投诉 {len(comps)} 起，需重点关注",
                        timestamp=datetime.combine(date, datetime.min.time().replace(hour=12)),
                        suggested_action=ActionType.ADD_STAFF,
                        raw_data={
                            "date": date.isoformat(),
                            "complaint_count": len(comps),
                            "complaints": [
                                {
                                    "time": c.complaint_time.isoformat(),
                                    "type": c.complaint_type,
                                    "description": c.description
                                }
                                for c in comps
                            ]
                        }
                    ))
        
        return risks
