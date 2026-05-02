"""
保温时间规则
检查保温时间是否足够
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from .base_rule import BaseRule
from ..models import (
    Risk, RiskType, RiskLevel, 
    TemperaturePoint, FiringPlan, FiringSegment, FiringRecord
)


class InsulationTimeRule(BaseRule):
    """保温时间检查规则"""
    
    def __init__(self, 
                 min_hold_temperature: float = 1000.0,  # 最低保温温度阈值
                 time_tolerance_minutes: int = 5,  # 允许的时间偏差
                 temperature_tolerance: float = 20.0):  # 温度偏差允许值
        super().__init__(
            name="保温时间检查",
            description="检查各保温阶段的实际保温时间是否达到计划要求"
        )
        self.min_hold_temperature = min_hold_temperature
        self.time_tolerance_minutes = time_tolerance_minutes
        self.temperature_tolerance = temperature_tolerance
        self.risk_counter = 0
    
    def check(self, firing_record: FiringRecord) -> List[Risk]:
        """
        检查保温时间
        
        Args:
            firing_record: 烧成记录
            
        Returns:
            风险列表
        """
        self.clear()
        risks: List[Risk] = []
        
        if not firing_record.temperature_data:
            self.add_warning("没有温度数据，无法检查保温时间")
            return risks
        
        temperature_points = sorted(firing_record.temperature_data, key=lambda p: p.timestamp)
        
        if len(temperature_points) < 2:
            self.add_warning("温度数据点不足，无法检查保温时间")
            return risks
        
        if firing_record.firing_plan and firing_record.firing_plan.segments:
            risks.extend(self._check_against_plan(temperature_points, firing_record.firing_plan))
        else:
            risks.extend(self._check_without_plan(temperature_points))
        
        return risks
    
    def _check_against_plan(self, 
                             points: List[TemperaturePoint],
                             firing_plan: FiringPlan) -> List[Risk]:
        """根据烧成计划检查保温时间"""
        risks: List[Risk] = []
        
        hold_segments = [s for s in firing_plan.segments if s.hold_time and s.hold_time > timedelta(0)]
        
        if not hold_segments:
            return risks
        
        actual_holds = self._detect_hold_periods(points)
        
        for i, plan_segment in enumerate(hold_segments):
            if i < len(actual_holds):
                actual_hold = actual_holds[i]
                plan_duration = plan_segment.hold_time
                actual_duration = actual_hold['duration']
                
                if actual_duration < (plan_duration - timedelta(minutes=self.time_tolerance_minutes)):
                    shortfall = plan_duration - actual_duration
                    risk = self._create_insulation_risk(
                        segment_name=plan_segment.name,
                        plan_duration=plan_duration,
                        actual_duration=actual_duration,
                        shortfall=shortfall,
                        temperature=actual_hold['avg_temperature'],
                        start_time=actual_hold['start_time'],
                        end_time=actual_hold['end_time']
                    )
                    risks.append(risk)
            else:
                risk = self._create_missing_hold_risk(plan_segment)
                risks.append(risk)
        
        return risks
    
    def _check_without_plan(self, points: List[TemperaturePoint]) -> List[Risk]:
        """没有烧成计划时的检查逻辑"""
        risks: List[Risk] = []
        
        actual_holds = self._detect_hold_periods(points)
        
        for hold in actual_holds:
            if hold['avg_temperature'] >= self.min_hold_temperature:
                min_duration = timedelta(minutes=20)
                if hold['duration'] < min_duration:
                    shortfall = min_duration - hold['duration']
                    risk = self._create_insulation_risk(
                        segment_name=f"高温保温阶段（{hold['avg_temperature']:.0f}°C）",
                        plan_duration=min_duration,
                        actual_duration=hold['duration'],
                        shortfall=shortfall,
                        temperature=hold['avg_temperature'],
                        start_time=hold['start_time'],
                        end_time=hold['end_time']
                    )
                    risks.append(risk)
        
        return risks
    
    def _detect_hold_periods(self, points: List[TemperaturePoint]) -> List[Dict]:
        """
        检测保温时间段
        
        保温阶段的定义：
        1. 温度变化率很低（接近0）
        2. 持续一段时间
        3. 温度相对稳定
        """
        holds: List[Dict] = []
        current_hold: Optional[Dict] = None
        
        hold_rate_threshold = 10.0  # 保温阶段的升温速率阈值 (°C/hour)
        min_hold_duration = timedelta(minutes=10)  # 最短保温时间
        
        for i in range(1, len(points)):
            current = points[i]
            prev = points[i-1]
            
            time_delta = current.timestamp - prev.timestamp
            time_hours = time_delta.total_seconds() / 3600
            
            if time_hours <= 0:
                continue
            
            avg_rate = 0.0
            layer_count = 0
            for layer_name, temp in current.temperatures.items():
                if layer_name in prev.temperatures:
                    temp_delta = temp - prev.temperatures[layer_name]
                    rate = temp_delta / time_hours
                    avg_rate += abs(rate)
                    layer_count += 1
            
            if layer_count > 0:
                avg_rate /= layer_count
            
            is_hold = avg_rate <= hold_rate_threshold
            
            if is_hold:
                if current_hold is None:
                    current_hold = {
                        'start_time': prev.timestamp,
                        'end_time': current.timestamp,
                        'temperatures': [],
                        'layers': set()
                    }
                current_hold['end_time'] = current.timestamp
                current_hold['temperatures'].append(current.avg_temperature)
                current_hold['layers'].update(current.temperatures.keys())
            else:
                if current_hold is not None:
                    duration = current_hold['end_time'] - current_hold['start_time']
                    if duration >= min_hold_duration:
                        holds.append({
                            'start_time': current_hold['start_time'],
                            'end_time': current_hold['end_time'],
                            'duration': duration,
                            'avg_temperature': sum(current_hold['temperatures']) / len(current_hold['temperatures']) if current_hold['temperatures'] else 0,
                            'layers': list(current_hold['layers'])
                        })
                    current_hold = None
        
        if current_hold is not None:
            duration = current_hold['end_time'] - current_hold['start_time']
            if duration >= min_hold_duration:
                holds.append({
                    'start_time': current_hold['start_time'],
                    'end_time': current_hold['end_time'],
                    'duration': duration,
                    'avg_temperature': sum(current_hold['temperatures']) / len(current_hold['temperatures']) if current_hold['temperatures'] else 0,
                    'layers': list(current_hold['layers'])
                })
        
        return holds
    
    def _create_insulation_risk(self,
                                 segment_name: str,
                                 plan_duration: timedelta,
                                 actual_duration: timedelta,
                                 shortfall: timedelta,
                                 temperature: float,
                                 start_time: datetime,
                                 end_time: datetime) -> Risk:
        """创建保温时间不足风险"""
        self.risk_counter += 1
        
        shortfall_minutes = shortfall.total_seconds() / 60
        
        if shortfall_minutes > 30:
            level = RiskLevel.CRITICAL
        elif shortfall_minutes > 15:
            level = RiskLevel.HIGH
        elif shortfall_minutes > 5:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW
        
        return Risk(
            risk_id=f"HOLD-{self.risk_counter:04d}",
            risk_type=RiskType.INSULATION_INSUFFICIENT,
            level=level,
            title=f"保温时间不足 - {segment_name}",
            description=f"保温阶段 '{segment_name}' 实际保温时间不足。\n"
                       f"计划保温时间: {self._format_duration(plan_duration)}\n"
                       f"实际保温时间: {self._format_duration(actual_duration)}\n"
                       f"短缺时间: {self._format_duration(shortfall)}\n"
                       f"保温温度: {temperature:.1f}°C\n"
                       f"时间范围: {start_time.strftime('%Y-%m-%d %H:%M')} 至 {end_time.strftime('%Y-%m-%d %H:%M')}",
            timestamp=start_time,
            related_data={
                "segment_name": segment_name,
                "plan_duration_minutes": plan_duration.total_seconds() / 60,
                "actual_duration_minutes": actual_duration.total_seconds() / 60,
                "shortfall_minutes": shortfall_minutes,
                "temperature": temperature,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        )
    
    def _create_missing_hold_risk(self, plan_segment: FiringSegment) -> Risk:
        """创建缺失保温阶段风险"""
        self.risk_counter += 1
        
        return Risk(
            risk_id=f"HOLD-{self.risk_counter:04d}",
            risk_type=RiskType.INSULATION_INSUFFICIENT,
            level=RiskLevel.HIGH,
            title=f"缺失保温阶段 - {plan_segment.name}",
            description=f"计划中的保温阶段 '{plan_segment.name}' 未在实际数据中检测到。\n"
                       f"计划保温温度: {plan_segment.end_temperature:.1f}°C\n"
                       f"计划保温时间: {self._format_duration(plan_segment.hold_time) if plan_segment.hold_time else '未知'}",
            related_data={
                "segment_name": plan_segment.name,
                "target_temperature": plan_segment.end_temperature,
                "planned_duration_minutes": plan_segment.hold_time.total_seconds() / 60 if plan_segment.hold_time else 0
            }
        )
    
    def _format_duration(self, duration: timedelta) -> str:
        """格式化时间持续时间"""
        total_seconds = duration.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        
        if hours > 0:
            return f"{hours}小时{minutes}分钟"
        else:
            return f"{minutes}分钟"
