"""
靠离泊计划生成模块 - 结合船舶、泊位、潮窗生成可行计划
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta, time
from typing import List, Optional, Dict, Any

from ..models import Ship, Berth, Tug, TidalRecord, TimeSlot
from .tide_interpolation import TideInterpolator


@dataclass
class BerthOperation:
    """靠离泊作业"""
    ship: Ship
    berth: Berth
    operation_type: str  # 'berth' (靠泊) 或 'departure' (离泊)
    start_time: datetime
    end_time: datetime
    tidal_window: dict  # 相关的潮窗信息
    assigned_tugs: List[Tug] = field(default_factory=list)
    issues: List[str] = field(default_factory=list)  # 问题/冲突描述


@dataclass
class CandidateSchedule:
    """候选靠离泊计划"""
    ship: Ship
    berth: Berth
    arrival_time: datetime  # 预计到达时间（开始靠泊）
    departure_time: datetime  # 预计离开时间（结束离泊）
    berthing_tidal_window: dict  # 靠泊潮窗
    departure_tidal_window: dict  # 离泊潮窗
    assigned_tugs: List[Tug] = field(default_factory=list)
    conflicts: List[Dict[str, Any]] = field(default_factory=list)  # 冲突信息
    is_feasible: bool = True  # 是否可行
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式"""
        return {
            'ship_name': self.ship.name,
            'ship_draft': self.ship.draft,
            'berth_name': self.berth.name,
            'berth_max_draft': self.berth.max_draft,
            'arrival_time': self.arrival_time.strftime('%Y-%m-%d %H:%M') if self.arrival_time else None,
            'departure_time': self.departure_time.strftime('%Y-%m-%d %H:%M') if self.departure_time else None,
            'berthing_window': {
                'start': self.berthing_tidal_window.get('start_time', '').strftime('%Y-%m-%d %H:%M') if self.berthing_tidal_window.get('start_time') else None,
                'end': self.berthing_tidal_window.get('end_time', '').strftime('%Y-%m-%d %H:%M') if self.berthing_tidal_window.get('end_time') else None,
                'min_height': self.berthing_tidal_window.get('min_height'),
                'max_height': self.berthing_tidal_window.get('max_height'),
                'required_depth': self.berthing_tidal_window.get('required_depth')
            } if self.berthing_tidal_window else None,
            'departure_window': {
                'start': self.departure_tidal_window.get('start_time', '').strftime('%Y-%m-%d %H:%M') if self.departure_tidal_window.get('start_time') else None,
                'end': self.departure_tidal_window.get('end_time', '').strftime('%Y-%m-%d %H:%M') if self.departure_tidal_window.get('end_time') else None,
                'min_height': self.departure_tidal_window.get('min_height'),
                'max_height': self.departure_tidal_window.get('max_height'),
                'required_depth': self.departure_tidal_window.get('required_depth')
            } if self.departure_tidal_window else None,
            'assigned_tugs': [tug.name for tug in self.assigned_tugs],
            'conflicts': self.conflicts,
            'is_feasible': self.is_feasible
        }


class ScheduleGenerator:
    """靠离泊计划生成器"""
    
    def __init__(
        self, 
        ships: List[Ship], 
        berths: List[Berth], 
        tugs: List[Tug],
        tide_interpolator: TideInterpolator,
        safety_margin: float = 0.3
    ):
        """
        初始化计划生成器
        
        Args:
            ships: 船舶列表
            berths: 泊位列表
            tugs: 拖轮列表
            tide_interpolator: 潮汐插值器
            safety_margin: 安全余量（米）
        """
        self.ships = ships
        self.berths = berths
        self.tugs = tugs
        self.tide_interpolator = tide_interpolator
        self.safety_margin = safety_margin
    
    def find_compatible_berths(self, ship: Ship) -> List[Berth]:
        """
        查找与船舶兼容的泊位
        
        兼容条件：
        1. 泊位类型匹配船舶需求
        2. 泊位最大吃水 >= 船舶吃水
        3. 泊位最大长度 >= 船舶长度
        4. 泊位最大宽度 >= 船舶宽度
        
        Args:
            ship: 船舶
            
        Returns:
            兼容的泊位列表
        """
        compatible = []
        
        for berth in self.berths:
            # 检查泊位类型
            if ship.required_berth_types and berth.type not in ship.required_berth_types:
                continue
            
            # 检查吃水限制
            if berth.max_draft < ship.draft:
                continue
            
            # 检查长度限制
            if berth.max_length < ship.length:
                continue
            
            # 检查宽度限制
            if berth.max_width < ship.width:
                continue
            
            compatible.append(berth)
        
        return compatible
    
    def generate_candidate_schedules(
        self, 
        start_date: datetime, 
        end_date: datetime
    ) -> List[CandidateSchedule]:
        """
        为所有船舶生成候选靠离泊计划
        
        Args:
            start_date: 计划开始日期
            end_date: 计划结束日期
            
        Returns:
            候选计划列表
        """
        all_schedules = []
        
        for ship in self.ships:
            ship_schedules = self._generate_for_ship(ship, start_date, end_date)
            all_schedules.extend(ship_schedules)
        
        # 按到达时间排序
        all_schedules.sort(key=lambda s: s.arrival_time if s.arrival_time else datetime.max)
        
        return all_schedules
    
    def _generate_for_ship(
        self, 
        ship: Ship, 
        start_date: datetime, 
        end_date: datetime
    ) -> List[CandidateSchedule]:
        """
        为单艘船舶生成候选计划
        
        Args:
            ship: 船舶
            start_date: 开始日期
            end_date: 结束日期
            
        Returns:
            候选计划列表
        """
        schedules = []
        
        # 查找兼容的泊位
        compatible_berths = self.find_compatible_berths(ship)
        
        if not compatible_berths:
            # 没有兼容的泊位，创建一个不可行的计划
            schedule = CandidateSchedule(
                ship=ship,
                berth=Berth(id='NONE', name='无可用泊位', type='none', max_draft=0, max_length=0, max_width=0),
                arrival_time=start_date,
                departure_time=start_date,
                berthing_tidal_window={},
                departure_tidal_window={},
                is_feasible=False,
                conflicts=[{
                    'type': 'berth_incompatible',
                    'description': f'没有找到兼容的泊位。船舶吃水 {ship.draft}m，长度 {ship.length}m，宽度 {ship.width}m',
                    'severity': 'critical'
                }]
            )
            schedules.append(schedule)
            return schedules
        
        # 对每个兼容的泊位，查找可行的潮窗
        for berth in compatible_berths:
            # 计算所需最小水深（考虑安全余量）
            required_depth = ship.draft + self.safety_margin
            
            # 查找安全潮窗
            safe_windows = self.tide_interpolator.find_safe_windows(
                required_depth=required_depth,
                start_time=start_date,
                end_time=end_date,
                safety_margin=0  # 这里已经包含了安全余量
            )
            
            if not safe_windows:
                # 没有可行的潮窗
                schedule = CandidateSchedule(
                    ship=ship,
                    berth=berth,
                    arrival_time=start_date,
                    departure_time=start_date,
                    berthing_tidal_window={},
                    departure_tidal_window={},
                    is_feasible=False,
                    conflicts=[{
                        'type': 'tidal_window_unavailable',
                        'description': f'在 {start_date.strftime("%Y-%m-%d")} 至 {end_date.strftime("%Y-%m-%d")} 期间没有找到满足吃水要求 {required_depth:.2f}m 的潮窗',
                        'severity': 'critical'
                    }]
                )
                schedules.append(schedule)
                continue
            
            # 为每个潮窗创建候选计划
            for window in safe_windows:
                # 计算靠泊和离泊时间
                # 假设靠泊在潮窗开始时进行，离泊在潮窗结束前进行
                berthing_time = window['start_time']
                
                # 离泊时间 = 靠泊时间 + 作业时长
                # 但需要确保离泊时仍然在潮窗内
                operation_end = berthing_time + ship.operation_duration
                
                # 检查作业结束时间是否在潮窗内
                if operation_end > window['end_time']:
                    # 尝试调整靠泊时间，使作业结束在潮窗内
                    max_berthing_time = window['end_time'] - ship.operation_duration
                    if max_berthing_time < window['start_time']:
                        # 作业时长超过潮窗时长，创建冲突
                        schedule = CandidateSchedule(
                            ship=ship,
                            berth=berth,
                            arrival_time=window['start_time'],
                            departure_time=window['end_time'],
                            berthing_tidal_window=window,
                            departure_tidal_window=window,
                            is_feasible=False,
                            conflicts=[{
                                'type': 'operation_duration_exceeds_window',
                                'description': f'作业时长 {ship.operation_duration.total_seconds()/60:.0f} 分钟超过潮窗时长 {(window["end_time"] - window["start_time"]).total_seconds()/60:.0f} 分钟',
                                'severity': 'high'
                            }]
                        )
                        schedules.append(schedule)
                        continue
                    berthing_time = max_berthing_time
                
                departure_time = berthing_time + ship.operation_duration
                
                # 创建候选计划
                schedule = CandidateSchedule(
                    ship=ship,
                    berth=berth,
                    arrival_time=berthing_time,
                    departure_time=departure_time,
                    berthing_tidal_window=window,
                    departure_tidal_window=window,
                    is_feasible=True,
                    conflicts=[]
                )
                
                # 检查拖轮可用性
                tug_conflicts = self._check_tug_availability(ship, berthing_time, departure_time)
                if tug_conflicts:
                    schedule.conflicts.extend(tug_conflicts)
                    schedule.is_feasible = False
                
                schedules.append(schedule)
        
        return schedules
    
    def _check_tug_availability(
        self, 
        ship: Ship, 
        start_time: datetime, 
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        检查拖轮可用性
        
        Args:
            ship: 船舶
            start_time: 作业开始时间
            end_time: 作业结束时间
            
        Returns:
            冲突列表
        """
        conflicts = []
        
        if ship.required_tug_count <= 0:
            return conflicts
        
        # 统计可用拖轮数量
        available_tugs = []
        for tug in self.tugs:
            # 检查拖轮在指定时间段是否可用
            # 这里简化处理，只检查时间
            if tug.is_available(start_time.time(), end_time.time()):
                available_tugs.append(tug)
        
        if len(available_tugs) < ship.required_tug_count:
            conflicts.append({
                'type': 'tug_unavailable',
                'description': f'需要 {ship.required_tug_count} 艘拖轮，但在 {start_time.strftime("%H:%M")} - {end_time.strftime("%H:%M")} 期间只有 {len(available_tugs)} 艘可用',
                'severity': 'high'
            })
        
        return conflicts
