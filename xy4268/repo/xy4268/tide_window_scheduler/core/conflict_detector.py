"""
冲突检测模块 - 检测泊位冲突、拖轮冲突等
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from .schedule_generator import CandidateSchedule


@dataclass
class Conflict:
    """冲突信息"""
    conflict_type: str  # 'berth_conflict', 'tug_conflict', 'tidal_conflict'
    severity: str  # 'critical', 'high', 'medium', 'low'
    description: str
    involved_schedules: List[str] = field(default_factory=list)  # 涉及的计划标识
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'conflict_type': self.conflict_type,
            'severity': self.severity,
            'description': self.description,
            'involved_schedules': self.involved_schedules,
            'details': self.details
        }


class ConflictDetector:
    """冲突检测器"""
    
    def __init__(self):
        """初始化冲突检测器"""
        pass
    
    def detect_all_conflicts(
        self, 
        schedules: List[CandidateSchedule]
    ) -> List[Conflict]:
        """
        检测所有冲突
        
        Args:
            schedules: 候选计划列表
            
        Returns:
            冲突列表
        """
        conflicts = []
        
        # 检测泊位冲突
        berth_conflicts = self._detect_berth_conflicts(schedules)
        conflicts.extend(berth_conflicts)
        
        # 检测拖轮冲突（如果有分配拖轮的话）
        tug_conflicts = self._detect_tug_conflicts(schedules)
        conflicts.extend(tug_conflicts)
        
        # 检测时间重叠冲突（同一船舶多个计划）
        time_conflicts = self._detect_time_overlap_conflicts(schedules)
        conflicts.extend(time_conflicts)
        
        return conflicts
    
    def _detect_berth_conflicts(
        self, 
        schedules: List[CandidateSchedule]
    ) -> List[Conflict]:
        """
        检测泊位冲突
        
        冲突条件：
        - 两艘或多艘船舶在同一时间段使用同一泊位
        
        Args:
            schedules: 候选计划列表
            
        Returns:
            泊位冲突列表
        """
        conflicts = []
        
        # 按泊位分组
        berth_schedules: Dict[str, List[CandidateSchedule]] = {}
        
        for schedule in schedules:
            if not schedule.is_feasible:
                continue
                
            berth_id = schedule.berth.id
            if berth_id not in berth_schedules:
                berth_schedules[berth_id] = []
            berth_schedules[berth_id].append(schedule)
        
        # 检查每个泊位的时间重叠
        for berth_id, berth_scheds in berth_schedules.items():
            if len(berth_scheds) < 2:
                continue
            
            # 按到达时间排序
            berth_scheds.sort(key=lambda s: s.arrival_time if s.arrival_time else datetime.max)
            
            # 检查相邻计划的时间重叠
            for i in range(len(berth_scheds) - 1):
                sched1 = berth_scheds[i]
                sched2 = berth_scheds[i + 1]
                
                if self._check_time_overlap(sched1, sched2):
                    # 发现冲突
                    conflict = Conflict(
                        conflict_type='berth_conflict',
                        severity='critical',
                        description=f'泊位 {sched1.berth.name} 存在时间冲突：{sched1.ship.name} ({sched1.arrival_time.strftime("%H:%M")}-{sched1.departure_time.strftime("%H:%M")}) 与 {sched2.ship.name} ({sched2.arrival_time.strftime("%H:%M")}-{sched2.departure_time.strftime("%H:%M")}) 时间重叠',
                        involved_schedules=[f'{sched1.ship.name}_{sched1.berth.id}', f'{sched2.ship.name}_{sched2.berth.id}'],
                        details={
                            'berth_id': berth_id,
                            'berth_name': sched1.berth.name,
                            'ship1_name': sched1.ship.name,
                            'ship1_arrival': sched1.arrival_time.strftime('%Y-%m-%d %H:%M') if sched1.arrival_time else None,
                            'ship1_departure': sched1.departure_time.strftime('%Y-%m-%d %H:%M') if sched1.departure_time else None,
                            'ship2_name': sched2.ship.name,
                            'ship2_arrival': sched2.arrival_time.strftime('%Y-%m-%d %H:%M') if sched2.arrival_time else None,
                            'ship2_departure': sched2.departure_time.strftime('%Y-%m-%d %H:%M') if sched2.departure_time else None
                        }
                    )
                    conflicts.append(conflict)
        
        return conflicts
    
    def _detect_tug_conflicts(
        self, 
        schedules: List[CandidateSchedule]
    ) -> List[Conflict]:
        """
        检测拖轮冲突
        
        冲突条件：
        - 两艘或多艘船舶在同一时间段需要拖轮数量超过可用拖轮数量
        
        Args:
            schedules: 候选计划列表
            
        Returns:
            拖轮冲突列表
        """
        conflicts = []
        
        # 这里简化处理，检查每个时间段内需要的拖轮总数
        # 实际应用中可能需要更复杂的拖轮分配和冲突检测
        
        # 收集所有可行计划的时间区间
        time_intervals = []
        for schedule in schedules:
            if not schedule.is_feasible:
                continue
            if schedule.ship.required_tug_count > 0:
                time_intervals.append({
                    'schedule': schedule,
                    'start': schedule.arrival_time,
                    'end': schedule.departure_time,
                    'tug_count': schedule.ship.required_tug_count
                })
        
        # 检查每个时间点的拖轮需求
        # 这里使用简化的方法：检查每对计划的时间重叠和拖轮需求总和
        
        for i in range(len(time_intervals) - 1):
            for j in range(i + 1, len(time_intervals)):
                interval1 = time_intervals[i]
                interval2 = time_intervals[j]
                
                if self._check_interval_overlap(interval1, interval2):
                    # 时间重叠，检查拖轮需求
                    # 这里简化处理，假设只有当两个计划都需要拖轮时标记为潜在冲突
                    
                    conflict = Conflict(
                        conflict_type='tug_conflict',
                        severity='high',
                        description=f'拖轮潜在冲突：{interval1["schedule"].ship.name} 和 {interval2["schedule"].ship.name} 在时间段 {interval1["start"].strftime("%H:%M")}-{interval1["end"].strftime("%H:%M")} 与 {interval2["start"].strftime("%H:%M")}-{interval2["end"].strftime("%H:%M")} 时间重叠，共需要 {interval1["tug_count"] + interval2["tug_count"]} 艘拖轮',
                        involved_schedules=[
                            f'{interval1["schedule"].ship.name}_{interval1["schedule"].berth.id}',
                            f'{interval2["schedule"].ship.name}_{interval2["schedule"].berth.id}'
                        ],
                        details={
                            'ship1_name': interval1["schedule"].ship.name,
                            'ship1_tug_count': interval1["tug_count"],
                            'ship2_name': interval2["schedule"].ship.name,
                            'ship2_tug_count': interval2["tug_count"],
                            'total_tug_needed': interval1["tug_count"] + interval2["tug_count"],
                            'overlap_start': max(interval1["start"], interval2["start"]).strftime('%Y-%m-%d %H:%M'),
                            'overlap_end': min(interval1["end"], interval2["end"]).strftime('%Y-%m-%d %H:%M')
                        }
                    )
                    conflicts.append(conflict)
        
        return conflicts
    
    def _detect_time_overlap_conflicts(
        self, 
        schedules: List[CandidateSchedule]
    ) -> List[Conflict]:
        """
        检测同一船舶的多个计划时间重叠冲突
        
        Args:
            schedules: 候选计划列表
            
        Returns:
            时间重叠冲突列表
        """
        conflicts = []
        
        # 按船舶分组
        ship_schedules: Dict[str, List[CandidateSchedule]] = {}
        
        for schedule in schedules:
            ship_name = schedule.ship.name
            if ship_name not in ship_schedules:
                ship_schedules[ship_name] = []
            ship_schedules[ship_name].append(schedule)
        
        # 检查每个船舶的计划时间重叠
        for ship_name, ship_scheds in ship_schedules.items():
            if len(ship_scheds) < 2:
                continue
            
            # 按到达时间排序
            ship_scheds.sort(key=lambda s: s.arrival_time if s.arrival_time else datetime.max)
            
            # 检查相邻计划的时间重叠
            for i in range(len(ship_scheds) - 1):
                sched1 = ship_scheds[i]
                sched2 = ship_scheds[i + 1]
                
                if self._check_time_overlap(sched1, sched2):
                    # 发现冲突
                    conflict = Conflict(
                        conflict_type='ship_time_conflict',
                        severity='high',
                        description=f'船舶 {ship_name} 存在多个计划时间冲突：泊位 {sched1.berth.name} ({sched1.arrival_time.strftime("%H:%M")}-{sched1.departure_time.strftime("%H:%M")}) 与泊位 {sched2.berth.name} ({sched2.arrival_time.strftime("%H:%M")}-{sched2.departure_time.strftime("%H:%M")}) 时间重叠',
                        involved_schedules=[f'{ship_name}_{sched1.berth.id}', f'{ship_name}_{sched2.berth.id}'],
                        details={
                            'ship_name': ship_name,
                            'berth1_name': sched1.berth.name,
                            'berth1_arrival': sched1.arrival_time.strftime('%Y-%m-%d %H:%M') if sched1.arrival_time else None,
                            'berth1_departure': sched1.departure_time.strftime('%Y-%m-%d %H:%M') if sched1.departure_time else None,
                            'berth2_name': sched2.berth.name,
                            'berth2_arrival': sched2.arrival_time.strftime('%Y-%m-%d %H:%M') if sched2.arrival_time else None,
                            'berth2_departure': sched2.departure_time.strftime('%Y-%m-%d %H:%M') if sched2.departure_time else None
                        }
                    )
                    conflicts.append(conflict)
        
        return conflicts
    
    def _check_time_overlap(
        self, 
        schedule1: CandidateSchedule, 
        schedule2: CandidateSchedule
    ) -> bool:
        """
        检查两个计划的时间是否重叠
        
        Args:
            schedule1: 第一个计划
            schedule2: 第二个计划
            
        Returns:
            是否重叠
        """
        if not schedule1.arrival_time or not schedule1.departure_time:
            return False
        if not schedule2.arrival_time or not schedule2.departure_time:
            return False
        
        # 检查时间区间是否重叠
        # 区间1: [a1, a2], 区间2: [b1, b2]
        # 重叠条件: a1 < b2 且 b1 < a2
        return schedule1.arrival_time < schedule2.departure_time and schedule2.arrival_time < schedule1.departure_time
    
    def _check_interval_overlap(
        self, 
        interval1: Dict, 
        interval2: Dict
    ) -> bool:
        """
        检查两个时间区间是否重叠
        
        Args:
            interval1: 第一个区间 {'start': datetime, 'end': datetime}
            interval2: 第二个区间 {'start': datetime, 'end': datetime}
            
        Returns:
            是否重叠
        """
        return interval1['start'] < interval2['end'] and interval2['start'] < interval1['end']
