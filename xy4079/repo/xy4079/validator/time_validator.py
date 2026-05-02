# -*- coding: utf-8 -*-
"""
时间校验器 - 检查照片时间与工单是否一致
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict

from models import (
    WorkOrder,
    Photo,
    QualityIssue,
    IssueType,
    IssueSeverity
)
from .base_validator import BaseValidator, ValidationResult


class TimeValidator(BaseValidator):
    """时间校验器"""
    
    validator_name = "时间校验"
    
    # 默认时间窗口：工单日期前后各1天
    DEFAULT_WINDOW_BEFORE_DAYS = 1
    DEFAULT_WINDOW_AFTER_DAYS = 1
    
    def __init__(
        self,
        window_before_days: int = None,
        window_after_days: int = None
    ):
        super().__init__()
        self.window_before_days = window_before_days or self.DEFAULT_WINDOW_BEFORE_DAYS
        self.window_after_days = window_after_days or self.DEFAULT_WINDOW_AFTER_DAYS
    
    def validate(self, work_order: Optional[WorkOrder], photos: List[Photo]) -> ValidationResult:
        """
        校验时间窗口
        
        规则：
        1. 检查每张照片的拍摄时间是否在工单日期的允许时间窗口内
        2. 报告时间异常的照片
        """
        issues: List[QualityIssue] = []
        warnings: List[str] = []
        
        if not work_order:
            # 没有工单信息，无法进行时间校验
            warnings.append("无工单信息，跳过时间校验")
            return self._create_result(
                issues=issues,
                warnings=warnings,
                info={'skipped': 'no_work_order'}
            )
        
        # 计算允许的时间窗口
        window_start, window_end = self._calculate_time_window(work_order.maintenance_date)
        
        # 检查每张照片
        time_out_of_window: List[Photo] = []
        no_capture_time: List[Photo] = []
        
        for photo in photos:
            if photo.capture_time is None:
                no_capture_time.append(photo)
                continue
            
            # 检查是否在时间窗口内
            if not (window_start <= photo.capture_time <= window_end):
                time_out_of_window.append(photo)
        
        # 1. 报告时间超出窗口的照片
        if time_out_of_window:
            photo_names = [p.file_name for p in time_out_of_window]
            issue = self._create_issue(
                issue_type=IssueType.TIME_MISMATCH,
                description=(
                    f"存在{len(time_out_of_window)}张照片拍摄时间不在工单时间窗口内\n"
                    f"工单日期: {work_order.maintenance_date.strftime('%Y-%m-%d')}\n"
                    f"允许窗口: {window_start.strftime('%Y-%m-%d')} 至 {window_end.strftime('%Y-%m-%d')}\n"
                    f"异常照片: {', '.join(photo_names[:5])}{'...' if len(photo_names) > 5 else ''}"
                ),
                severity=IssueSeverity.WARNING,
                related_photo_ids=[p.photo_id for p in time_out_of_window],
                related_work_order_id=work_order.order_id
            )
            issues.append(issue)
        
        # 2. 报告没有拍摄时间的照片
        if no_capture_time:
            issue = self._create_issue(
                issue_type=IssueType.TIME_MISMATCH,
                description=f"存在{len(no_capture_time)}张照片无法确定拍摄时间",
                severity=IssueSeverity.INFO,
                related_photo_ids=[p.photo_id for p in no_capture_time]
            )
            issues.append(issue)
        
        # 收集统计信息
        info = {
            'work_order_date': work_order.maintenance_date,
            'window_start': window_start,
            'window_end': window_end,
            'time_out_of_window_count': len(time_out_of_window),
            'no_capture_time_count': len(no_capture_time)
        }
        
        return self._create_result(
            issues=issues,
            warnings=warnings,
            info=info
        )
    
    def _calculate_time_window(self, maintenance_date: datetime) -> tuple:
        """计算允许的时间窗口"""
        # 确保是datetime对象（可能是date对象）
        if isinstance(maintenance_date, datetime):
            base_date = maintenance_date.date()
        else:
            base_date = maintenance_date
        
        window_start = datetime.combine(
            base_date - timedelta(days=self.window_before_days),
            datetime.min.time()
        )
        window_end = datetime.combine(
            base_date + timedelta(days=self.window_after_days),
            datetime.max.time()
        )
        
        return window_start, window_end
