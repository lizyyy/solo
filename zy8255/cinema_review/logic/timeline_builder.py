"""
时间线构建器 - 负责重建每场放映的设备时间线
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

from cinema_review.models import (
    Screening,
    ProjectorLog,
    LampHours,
    HallRules,
    TimelineEvent,
    ScreeningTimeline,
    EventType
)


class TimelineBuilder:
    """时间线构建器类"""
    
    def __init__(
        self,
        screenings: List[Screening],
        projector_logs: List[ProjectorLog],
        lamp_hours: Dict[str, LampHours],
        hall_rules: Dict[str, HallRules]
    ):
        """
        初始化时间线构建器
        
        Args:
            screenings: 排片列表
            projector_logs: 放映机日志列表
            lamp_hours: 灯泡小时数映射
            hall_rules: 影厅规则映射
        """
        self.screenings = screenings
        self.projector_logs = projector_logs
        self.lamp_hours = lamp_hours
        self.hall_rules = hall_rules
        
        # 按影厅分组
        self.screenings_by_hall: Dict[str, List[Screening]] = defaultdict(list)
        for s in screenings:
            self.screenings_by_hall[s.hall_id].append(s)
        
        self.logs_by_hall: Dict[str, List[ProjectorLog]] = defaultdict(list)
        for log in projector_logs:
            self.logs_by_hall[log.hall_id].append(log)
    
    def build_all_timelines(self) -> Dict[str, ScreeningTimeline]:
        """
        构建所有排片的时间线
        
        Returns:
            排片ID到时间线的映射
        """
        timelines: Dict[str, ScreeningTimeline] = {}
        
        for screening in self.screenings:
            timeline = self.build_single_timeline(screening)
            timelines[screening.id] = timeline
        
        return timelines
    
    def build_single_timeline(self, screening: Screening) -> ScreeningTimeline:
        """
        构建单个排片的时间线
        
        Args:
            screening: 排片信息
            
        Returns:
            ScreeningTimeline对象
        """
        timeline = ScreeningTimeline(screening=screening)
        
        # 获取影厅规则
        hall_rule = self.hall_rules.get(screening.hall_id)
        if hall_rule is None:
            # 使用默认规则
            hall_rule = HallRules(
                hall_id=screening.hall_id,
                hall_name=screening.hall_name
            )
        
        # 计算理论时间点
        self._calculate_theoretical_timeline(timeline, hall_rule)
        
        # 查找实际日志记录
        self._find_actual_events(timeline, hall_rule)
        
        # 生成时间线事件列表
        self._generate_timeline_events(timeline, hall_rule)
        
        return timeline
    
    def _calculate_theoretical_timeline(
        self,
        timeline: ScreeningTimeline,
        hall_rule: HallRules
    ) -> None:
        """
        计算理论时间线（基于排片时间和规则）
        
        Args:
            timeline: 时间线对象
            hall_rule: 影厅规则
        """
        screening = timeline.screening
        
        # 理论预热开始时间 = 排片开始时间 - 预热时间
        timeline.warmup_start = screening.start_time - timedelta(
            minutes=hall_rule.warmup_minutes
        )
        
        # 理论冷却结束时间 = 排片结束时间 + 冷却时间
        timeline.cooldown_end = screening.end_time + timedelta(
            minutes=hall_rule.cooldown_minutes
        )
        
        # 理论放映时间
        timeline.actual_start = screening.start_time
        timeline.actual_end = screening.end_time
    
    def _find_actual_events(
        self,
        timeline: ScreeningTimeline,
        hall_rule: HallRules
    ) -> None:
        """
        从日志中查找实际事件
        
        Args:
            timeline: 时间线对象
            hall_rule: 影厅规则
        """
        screening = timeline.screening
        hall_id = screening.hall_id
        logs = self.logs_by_hall.get(hall_id, [])
        
        # 定义搜索窗口：预热开始前30分钟 到 冷却结束后30分钟
        search_start = timeline.warmup_start - timedelta(minutes=30) if timeline.warmup_start else screening.start_time - timedelta(hours=1)
        search_end = timeline.cooldown_end + timedelta(minutes=30) if timeline.cooldown_end else screening.end_time + timedelta(hours=1)
        
        # 筛选窗口内的日志
        window_logs = [
            log for log in logs
            if search_start <= log.event_time <= search_end
        ]
        
        # 按时间排序
        window_logs.sort(key=lambda l: l.event_time)
        
        # 查找放映机开机事件：选择排片开始时间之前最近的开机事件
        # 如果没有，则选择理论预热开始后最近的开机事件
        power_on_logs = [
            log for log in window_logs
            if log.event_type.lower() in ["power_on", "开机", "startup", "启动"]
        ]
        
        # 优先选择在排片开始前的开机事件
        before_start = [log for log in power_on_logs if log.event_time <= screening.start_time]
        if before_start:
            # 选择最接近开始时间的（最晚的）
            timeline.projector_on_time = max(before_start, key=lambda l: l.event_time).event_time
        elif power_on_logs:
            # 如果没有在开始前的，选择最早的开机事件
            timeline.projector_on_time = min(power_on_logs, key=lambda l: l.event_time).event_time
        
        # 查找放映机关机事件：选择排片结束时间之后最近的关机事件
        power_off_logs = [
            log for log in window_logs
            if log.event_type.lower() in ["power_off", "关机", "shutdown", "停止"]
        ]
        
        # 优先选择在排片结束后的关机事件
        after_end = [log for log in power_off_logs if log.event_time >= screening.end_time]
        if after_end:
            # 选择最接近结束时间的（最早的）
            timeline.projector_off_time = min(after_end, key=lambda l: l.event_time).event_time
        elif power_off_logs:
            # 如果没有在结束后的，选择最晚的关机事件
            timeline.projector_off_time = max(power_off_logs, key=lambda l: l.event_time).event_time
        
        # 查找实际放映开始：选择与排片开始时间最接近的播放开始事件
        # 优先选择在理论开始时间前后5分钟内的事件
        play_start_logs = [
            log for log in window_logs
            if log.event_type.lower() in ["play_start", "播放开始", "start_play"]
        ]
        
        if play_start_logs:
            # 找到与排片开始时间差最小的事件
            closest = min(
                play_start_logs,
                key=lambda l: abs((l.event_time - screening.start_time).total_seconds())
            )
            # 只在时间差合理的情况下使用（2小时内）
            if abs((closest.event_time - screening.start_time).total_seconds()) < 7200:
                timeline.actual_start = closest.event_time
        
        # 查找实际放映结束：选择与排片结束时间最接近的播放结束事件
        play_end_logs = [
            log for log in window_logs
            if log.event_type.lower() in ["play_end", "播放结束", "stop_play", "end_play"]
        ]
        
        if play_end_logs:
            # 找到与排片结束时间差最小的事件
            closest = min(
                play_end_logs,
                key=lambda l: abs((l.event_time - screening.end_time).total_seconds())
            )
            # 只在时间差合理的情况下使用（2小时内）
            if abs((closest.event_time - screening.end_time).total_seconds()) < 7200:
                timeline.actual_end = closest.event_time
    
    def _generate_timeline_events(
        self,
        timeline: ScreeningTimeline,
        hall_rule: HallRules
    ) -> None:
        """
        生成时间线事件列表
        
        Args:
            timeline: 时间线对象
            hall_rule: 影厅规则
        """
        screening = timeline.screening
        events: List[TimelineEvent] = []
        
        # 添加理论预热开始事件
        if timeline.warmup_start:
            events.append(TimelineEvent(
                event_type=EventType.WARMUP_START,
                time=timeline.warmup_start,
                hall_id=screening.hall_id,
                screening_id=screening.id,
                description=f"理论预热开始（{hall_rule.warmup_minutes}分钟）",
                details={"type": "theoretical", "duration_minutes": hall_rule.warmup_minutes}
            ))
        
        # 添加实际开机事件
        if timeline.projector_on_time:
            events.append(TimelineEvent(
                event_type=EventType.PROJECTOR_ON,
                time=timeline.projector_on_time,
                hall_id=screening.hall_id,
                screening_id=screening.id,
                description="放映机实际开机",
                details={"type": "actual"}
            ))
        
        # 添加放映开始事件
        if timeline.actual_start:
            events.append(TimelineEvent(
                event_type=EventType.SCREENING_START,
                time=timeline.actual_start,
                hall_id=screening.hall_id,
                screening_id=screening.id,
                description=f"放映开始 - {screening.film_name}",
                details={
                    "film_name": screening.film_name,
                    "duration_minutes": screening.duration_minutes,
                    "type": "actual" if timeline.actual_start != screening.start_time else "theoretical"
                }
            ))
        
        # 添加放映结束事件
        if timeline.actual_end:
            events.append(TimelineEvent(
                event_type=EventType.SCREENING_END,
                time=timeline.actual_end,
                hall_id=screening.hall_id,
                screening_id=screening.id,
                description=f"放映结束 - {screening.film_name}",
                details={
                    "film_name": screening.film_name,
                    "type": "actual" if timeline.actual_end != screening.end_time else "theoretical"
                }
            ))
        
        # 添加实际关机事件
        if timeline.projector_off_time:
            events.append(TimelineEvent(
                event_type=EventType.PROJECTOR_OFF,
                time=timeline.projector_off_time,
                hall_id=screening.hall_id,
                screening_id=screening.id,
                description="放映机实际关机",
                details={"type": "actual"}
            ))
        
        # 添加理论冷却结束事件
        if timeline.cooldown_end:
            events.append(TimelineEvent(
                event_type=EventType.COOLDOWN_END,
                time=timeline.cooldown_end,
                hall_id=screening.hall_id,
                screening_id=screening.id,
                description=f"理论冷却结束（{hall_rule.cooldown_minutes}分钟）",
                details={"type": "theoretical", "duration_minutes": hall_rule.cooldown_minutes}
            ))
        
        # 按时间排序
        events.sort(key=lambda e: e.time)
        timeline.events = events
    
    def get_hall_timeline_summary(self, hall_id: str) -> Dict[str, Any]:
        """
        获取指定影厅的时间线摘要
        
        Args:
            hall_id: 影厅ID
            
        Returns:
            摘要信息字典
        """
        hall_screenings = self.screenings_by_hall.get(hall_id, [])
        
        if not hall_screenings:
            return {
                "hall_id": hall_id,
                "screening_count": 0,
                "first_screening": None,
                "last_screening": None,
                "total_duration_minutes": 0,
                "gaps": [],
                "has_overlap": False
            }
        
        # 按开始时间排序
        sorted_screenings = sorted(hall_screenings, key=lambda s: s.start_time)
        
        # 计算间隔和检查重叠
        gaps: List[Dict[str, Any]] = []
        has_overlap = False
        
        for i in range(len(sorted_screenings) - 1):
            current = sorted_screenings[i]
            next_scr = sorted_screenings[i + 1]
            
            gap_seconds = (next_scr.start_time - current.end_time).total_seconds()
            
            if gap_seconds < 0:
                has_overlap = True
            elif gap_seconds > 0:
                gaps.append({
                    "after_screening": current.id,
                    "before_screening": next_scr.id,
                    "gap_minutes": round(gap_seconds / 60, 1),
                    "after_film": current.film_name,
                    "before_film": next_scr.film_name
                })
        
        total_duration = sum(s.duration_minutes for s in sorted_screenings)
        
        return {
            "hall_id": hall_id,
            "hall_name": sorted_screenings[0].hall_name if sorted_screenings else hall_id,
            "screening_count": len(sorted_screenings),
            "first_screening": {
                "id": sorted_screenings[0].id,
                "film_name": sorted_screenings[0].film_name,
                "start_time": sorted_screenings[0].start_time
            },
            "last_screening": {
                "id": sorted_screenings[-1].id,
                "film_name": sorted_screenings[-1].film_name,
                "end_time": sorted_screenings[-1].end_time
            },
            "total_duration_minutes": total_duration,
            "gaps": gaps,
            "has_overlap": has_overlap
        }
