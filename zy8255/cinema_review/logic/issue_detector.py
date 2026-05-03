"""
问题检测器 - 负责检测排片和设备状态中的各种问题
"""

from datetime import datetime, timedelta, date, time
from typing import Dict, List, Optional, Any
from collections import defaultdict

from cinema_review.models import (
    Screening,
    ProjectorLog,
    LampHours,
    HallRules,
    ScreeningTimeline,
    Issue,
    IssueType
)


class IssueDetector:
    """问题检测器类"""
    
    def __init__(
        self,
        screenings: List[Screening],
        timelines: Dict[str, ScreeningTimeline],
        lamp_hours: Dict[str, LampHours],
        hall_rules: Dict[str, HallRules],
        projector_logs: List[ProjectorLog]
    ):
        """
        初始化问题检测器
        
        Args:
            screenings: 排片列表
            timelines: 时间线映射
            lamp_hours: 灯泡小时数映射
            hall_rules: 影厅规则映射
            projector_logs: 放映机日志列表
        """
        self.screenings = screenings
        self.timelines = timelines
        self.lamp_hours = lamp_hours
        self.hall_rules = hall_rules
        self.projector_logs = projector_logs
        
        # 按影厅分组
        self.screenings_by_hall: Dict[str, List[Screening]] = defaultdict(list)
        for s in screenings:
            self.screenings_by_hall[s.hall_id].append(s)
        
        # 按时间排序每个影厅的排片
        for hall_id in self.screenings_by_hall:
            self.screenings_by_hall[hall_id].sort(key=lambda s: s.start_time)
    
    def detect_all_issues(self) -> List[Issue]:
        """
        检测所有问题
        
        Returns:
            问题列表
        """
        issues: List[Issue] = []
        
        # 检测排片重叠
        issues.extend(self._detect_overlaps())
        
        # 检测预热不足
        issues.extend(self._detect_warmup_insufficient())
        
        # 检测灯泡小时数超限
        issues.extend(self._detect_lamp_hours_exceeded())
        
        # 检测跨午夜场次归属错误
        issues.extend(self._detect_midnight_assignment_errors())
        
        # 按严重程度和时间排序
        severity_order = {"high": 0, "medium": 1, "low": 2}
        issues.sort(key=lambda i: (severity_order.get(i.severity, 2), i.created_at))
        
        return issues
    
    def _detect_overlaps(self) -> List[Issue]:
        """
        检测同一影厅的排片重叠问题
        
        Returns:
            重叠问题列表
        """
        issues: List[Issue] = []
        
        for hall_id, hall_screenings in self.screenings_by_hall.items():
            if len(hall_screenings) < 2:
                continue
            
            hall_name = hall_screenings[0].hall_name
            hall_rule = self.hall_rules.get(hall_id)
            
            # 计算需要的间隔时间
            required_gap = timedelta(minutes=0)
            if hall_rule:
                # 需要冷却时间 + 清场时间 + 下一场预热时间
                required_gap = timedelta(
                    minutes=hall_rule.cooldown_minutes + 
                           hall_rule.cleanup_minutes + 
                           hall_rule.warmup_minutes
                )
            
            for i in range(len(hall_screenings) - 1):
                current = hall_screenings[i]
                next_scr = hall_screenings[i + 1]
                
                # 计算时间差（下一场开始时间 - 当前场结束时间）
                time_diff = next_scr.start_time - current.end_time
                
                # 检查是否重叠（时间差为负）
                if time_diff < timedelta(0):
                    overlap_minutes = abs(time_diff.total_seconds() / 60)
                    
                    issue = Issue(
                        issue_type=IssueType.OVERLAP,
                        hall_id=hall_id,
                        hall_name=hall_name,
                        screening_id=current.id,
                        film_name=f"{current.film_name} 与 {next_scr.film_name}",
                        description=(
                            f"排片重叠！{current.film_name} ({current.start_time.strftime('%H:%M')}-{current.end_time.strftime('%H:%M')}) "
                            f"与 {next_scr.film_name} ({next_scr.start_time.strftime('%H:%M')}-{next_scr.end_time.strftime('%H:%M')}) "
                            f"重叠约 {overlap_minutes:.1f} 分钟"
                        ),
                        severity="high",
                        related_screening_ids=[current.id, next_scr.id],
                        details={
                            "overlap_minutes": round(overlap_minutes, 1),
                            "current_screening": current.to_dict(),
                            "next_screening": next_scr.to_dict(),
                            "required_gap_minutes": required_gap.total_seconds() / 60
                        }
                    )
                    issues.append(issue)
                
                # 检查间隔是否不足（即使没有完全重叠，但间隔小于要求）
                elif time_diff < required_gap:
                    gap_minutes = time_diff.total_seconds() / 60
                    required_minutes = required_gap.total_seconds() / 60
                    
                    issue = Issue(
                        issue_type=IssueType.OVERLAP,
                        hall_id=hall_id,
                        hall_name=hall_name,
                        screening_id=current.id,
                        film_name=f"{current.film_name} 与 {next_scr.film_name}",
                        description=(
                            f"排片间隔不足！{current.film_name} 结束与 {next_scr.film_name} 开始间隔 "
                            f"{gap_minutes:.1f} 分钟，需要 {required_minutes:.0f} 分钟"
                        ),
                        severity="medium",
                        related_screening_ids=[current.id, next_scr.id],
                        details={
                            "actual_gap_minutes": round(gap_minutes, 1),
                            "required_gap_minutes": round(required_minutes, 1),
                            "current_screening": current.to_dict(),
                            "next_screening": next_scr.to_dict()
                        }
                    )
                    issues.append(issue)
        
        return issues
    
    def _detect_warmup_insufficient(self) -> List[Issue]:
        """
        检测放映机预热不足问题
        
        Returns:
            预热不足问题列表
        """
        issues: List[Issue] = []
        
        for screening in self.screenings:
            timeline = self.timelines.get(screening.id)
            if not timeline:
                continue
            
            hall_rule = self.hall_rules.get(screening.hall_id)
            if not hall_rule:
                continue
            
            # 如果有实际开机时间，检查是否预热足够
            if timeline.projector_on_time and timeline.actual_start:
                # 实际预热时间 = 放映开始时间 - 开机时间
                actual_warmup = timeline.actual_start - timeline.projector_on_time
                required_warmup = timedelta(minutes=hall_rule.warmup_minutes)
                
                if actual_warmup < required_warmup:
                    actual_minutes = actual_warmup.total_seconds() / 60
                    
                    issue = Issue(
                        issue_type=IssueType.WARMUP_INSUFFICIENT,
                        hall_id=screening.hall_id,
                        hall_name=screening.hall_name,
                        screening_id=screening.id,
                        film_name=screening.film_name,
                        description=(
                            f"预热不足！放映机 {timeline.projector_on_time.strftime('%H:%M')} 开机，"
                            f"放映 {timeline.actual_start.strftime('%H:%M')} 开始，"
                            f"实际预热 {actual_minutes:.1f} 分钟，需要 {hall_rule.warmup_minutes} 分钟"
                        ),
                        severity="high" if actual_minutes < hall_rule.warmup_minutes / 2 else "medium",
                        details={
                            "actual_warmup_minutes": round(actual_minutes, 1),
                            "required_warmup_minutes": hall_rule.warmup_minutes,
                            "projector_on_time": timeline.projector_on_time.isoformat() if timeline.projector_on_time else None,
                            "screening_start_time": timeline.actual_start.isoformat() if timeline.actual_start else None
                        }
                    )
                    issues.append(issue)
            
            # 如果没有实际开机时间，检查理论时间点是否被标记为午夜场等问题
            elif not timeline.projector_on_time:
                # 检查是否有日志表明放映机在应该预热的时间是关闭的
                pass
        
        return issues
    
    def _detect_lamp_hours_exceeded(self) -> List[Issue]:
        """
        检测灯泡小时数超限问题
        
        Returns:
            灯泡超时问题列表
        """
        issues: List[Issue] = []
        
        for hall_id, lamp_record in self.lamp_hours.items():
            hall_rule = self.hall_rules.get(hall_id)
            
            # 确定最大小时数限制
            max_hours = hall_rule.max_lamp_hours if hall_rule else 2000.0
            warning_threshold = hall_rule.lamp_warning_threshold if hall_rule else 1800.0
            
            # 使用 lamp_record 中的 max_lamp_hours（如果有）
            if lamp_record.max_lamp_hours:
                max_hours = lamp_record.max_lamp_hours
            
            # 检查结束小时数
            current_hours = lamp_record.end_hours
            
            if current_hours >= max_hours:
                # 严重：已超过最大限制
                hall_screenings = self.screenings_by_hall.get(hall_id, [])
                hall_name = hall_screenings[0].hall_name if hall_screenings else hall_id
                
                issue = Issue(
                    issue_type=IssueType.LAMP_HOURS_EXCEEDED,
                    hall_id=hall_id,
                    hall_name=hall_name,
                    film_name=f"灯泡小时数: {current_hours:.1f}h",
                    description=(
                        f"灯泡小时数已超限！当前 {current_hours:.1f} 小时，"
                        f"最大限制 {max_hours:.0f} 小时，超出 {(current_hours - max_hours):.1f} 小时"
                    ),
                    severity="high",
                    details={
                        "current_hours": current_hours,
                        "max_hours": max_hours,
                        "warning_threshold": warning_threshold,
                        "used_today": lamp_record.used_hours,
                        "start_hours": lamp_record.start_hours
                    }
                )
                issues.append(issue)
            
            elif current_hours >= warning_threshold:
                # 警告：接近最大限制
                hall_screenings = self.screenings_by_hall.get(hall_id, [])
                hall_name = hall_screenings[0].hall_name if hall_screenings else hall_id
                
                issue = Issue(
                    issue_type=IssueType.LAMP_HOURS_EXCEEDED,
                    hall_id=hall_id,
                    hall_name=hall_name,
                    film_name=f"灯泡小时数: {current_hours:.1f}h",
                    description=(
                        f"灯泡小时数即将超限！当前 {current_hours:.1f} 小时，"
                        f"警告阈值 {warning_threshold:.0f} 小时，最大限制 {max_hours:.0f} 小时"
                    ),
                    severity="medium",
                    details={
                        "current_hours": current_hours,
                        "max_hours": max_hours,
                        "warning_threshold": warning_threshold,
                        "remaining_hours": max_hours - current_hours,
                        "used_today": lamp_record.used_hours
                    }
                )
                issues.append(issue)
        
        return issues
    
    def _detect_midnight_assignment_errors(self) -> List[Issue]:
        """
        检测跨午夜场次归属错误
        
        判断逻辑：
        1. 如果排片结束时间跨过午夜（即结束时间日期 > 开始时间日期）
        2. 检查 is_midnight 标志是否正确设置
        3. 检查排片日期是否正确归属
        
        Returns:
            跨午夜归属错误问题列表
        """
        issues: List[Issue] = []
        
        for screening in self.screenings:
            # 检查是否跨午夜
            starts_before_midnight = screening.start_time.time() >= time(22, 0)  # 22:00之后开始
            ends_after_midnight = screening.end_time.date() > screening.start_time.date()
            
            # 情况1：实际上跨午夜，但 is_midnight 未标记
            if ends_after_midnight and not screening.is_midnight:
                issue = Issue(
                    issue_type=IssueType.MIDNIGHT_ASSIGNMENT_ERROR,
                    hall_id=screening.hall_id,
                    hall_name=screening.hall_name,
                    screening_id=screening.id,
                    film_name=screening.film_name,
                    description=(
                        f"跨午夜场次未正确标记！{screening.film_name} "
                        f"{screening.start_time.strftime('%Y-%m-%d %H:%M')} 开始，"
                        f"{screening.end_time.strftime('%Y-%m-%d %H:%M')} 结束，"
                        f"跨越午夜但未标记为午夜场"
                    ),
                    severity="medium",
                    details={
                        "start_time": screening.start_time.isoformat(),
                        "end_time": screening.end_time.isoformat(),
                        "screening_date": screening.date.isoformat(),
                        "is_midnight_flag": screening.is_midnight,
                        "actual_crosses_midnight": ends_after_midnight
                    }
                )
                issues.append(issue)
            
            # 情况2：错误标记为午夜场（实际上不跨午夜）
            if screening.is_midnight and not ends_after_midnight:
                # 检查开始时间是否真的是"午夜场"（通常指凌晨）
                # 如果开始时间在 00:00-06:00 之间，可能是前一天的午夜场
                is_actually_midnight = screening.start_time.time() < time(6, 0)
                
                if not is_actually_midnight:
                    issue = Issue(
                        issue_type=IssueType.MIDNIGHT_ASSIGNMENT_ERROR,
                        hall_id=screening.hall_id,
                        hall_name=screening.hall_name,
                        screening_id=screening.id,
                        film_name=screening.film_name,
                        description=(
                            f"场次错误标记为午夜场！{screening.film_name} "
                            f"{screening.start_time.strftime('%Y-%m-%d %H:%M')} - "
                            f"{screening.end_time.strftime('%Y-%m-%d %H:%M')}，"
                            f"实际上不跨越午夜"
                        ),
                        severity="low",
                        details={
                            "start_time": screening.start_time.isoformat(),
                            "end_time": screening.end_time.isoformat(),
                            "screening_date": screening.date.isoformat(),
                            "is_midnight_flag": screening.is_midnight,
                            "actual_crosses_midnight": ends_after_midnight
                        }
                    )
                    issues.append(issue)
            
            # 情况3：检查日期归属是否正确
            # 如果场次在凌晨开始（00:00-06:00），应该归属于前一天
            if screening.start_time.time() < time(6, 0):
                # 理论上应该归属的日期
                expected_date = screening.start_time.date() - timedelta(days=1)
                
                if screening.date != expected_date:
                    issue = Issue(
                        issue_type=IssueType.MIDNIGHT_ASSIGNMENT_ERROR,
                        hall_id=screening.hall_id,
                        hall_name=screening.hall_name,
                        screening_id=screening.id,
                        film_name=screening.film_name,
                        description=(
                            f"场次日期归属可能错误！{screening.film_name} "
                            f"{screening.start_time.strftime('%Y-%m-%d %H:%M')} 开始，"
                            f"当前归属于 {screening.date.isoformat()}，"
                            f"建议归属于前一天 {expected_date.isoformat()}"
                        ),
                        severity="medium",
                        details={
                            "start_time": screening.start_time.isoformat(),
                            "current_assigned_date": screening.date.isoformat(),
                            "suggested_date": expected_date.isoformat(),
                            "is_midnight_flag": screening.is_midnight
                        }
                    )
                    issues.append(issue)
        
        return issues
    
    def get_issues_summary(self, issues: List[Issue]) -> Dict[str, Any]:
        """
        获取问题摘要统计
        
        Args:
            issues: 问题列表
            
        Returns:
            统计信息字典
        """
        by_type: Dict[str, int] = defaultdict(int)
        by_severity: Dict[str, int] = defaultdict(int)
        by_hall: Dict[str, int] = defaultdict(int)
        
        for issue in issues:
            by_type[issue.issue_type.value] += 1
            by_severity[issue.severity] += 1
            by_hall[issue.hall_name] += 1
        
        return {
            "total_count": len(issues),
            "by_type": dict(by_type),
            "by_severity": dict(by_severity),
            "by_hall": dict(by_hall),
            "high_count": by_severity.get("high", 0),
            "medium_count": by_severity.get("medium", 0),
            "low_count": by_severity.get("low", 0)
        }
