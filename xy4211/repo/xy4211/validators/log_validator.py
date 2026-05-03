from typing import List, Optional
from datetime import datetime, timedelta
from collections import defaultdict

from .base_validator import BaseValidator, ValidationContext
from models import ValidationIssue, IssueType, IssueSeverity, DeviceLog, ScreeningResult
from config import LOG_TIME_DRIFT_THRESHOLD_SECONDS


class LogValidator(BaseValidator):
    def __init__(self):
        super().__init__()
    
    def validate(self, context: ValidationContext) -> List[ValidationIssue]:
        self.issues.clear()
        
        if not context.device_logs:
            return self.issues
        
        self._validate_time_drift(context)
        self._validate_log_sequence(context)
        self._validate_error_logs(context)
        
        return self.issues
    
    def _validate_time_drift(self, context: ValidationContext) -> None:
        device_ids = context.get_all_device_ids()
        
        for device_id in device_ids:
            logs = context.get_logs_by_device_id(device_id)
            if not logs:
                continue
            
            if len(logs) >= 2:
                sorted_logs = sorted(logs, key=lambda x: x.log_timestamp)
                
                for i in range(len(sorted_logs) - 1):
                    log1 = sorted_logs[i]
                    log2 = sorted_logs[i + 1]
                    
                    time_diff = (log2.log_timestamp - log1.log_timestamp).total_seconds()
                    
                    if time_diff < 0:
                        self._add_issue(
                            issue_type=IssueType.LOG_TIME_DRIFT,
                            severity=IssueSeverity.HIGH,
                            title=f"设备 {device_id} 日志时间回退",
                            description=f"设备 {device_id} 的日志存在时间回退问题。日志 {log1.log_id} 时间为 {log1.log_timestamp}，下一条日志 {log2.log_id} 时间为 {log2.log_timestamp}，时间回退了 {abs(time_diff)} 秒。这可能表示系统时钟被修改或日志顺序混乱。",
                            device_id=device_id,
                            log_id=log1.log_id,
                            details={
                                "log1_id": log1.log_id,
                                "log1_time": log1.log_timestamp.isoformat(),
                                "log2_id": log2.log_id,
                                "log2_time": log2.log_timestamp.isoformat(),
                                "time_backward_seconds": abs(time_diff)
                            },
                            source_file=log1.source_file
                        )
                    
                    elif time_diff > LOG_TIME_DRIFT_THRESHOLD_SECONDS:
                        minutes = int(time_diff / 60)
                        self._add_issue(
                            issue_type=IssueType.LOG_TIME_DRIFT,
                            severity=IssueSeverity.MEDIUM,
                            title=f"设备 {device_id} 日志时间间隔异常",
                            description=f"设备 {device_id} 的两条相邻日志时间间隔为 {minutes} 分钟（{time_diff:.0f} 秒），超过阈值 {LOG_TIME_DRIFT_THRESHOLD_SECONDS} 秒。这可能表示设备在该时间段内未记录日志或存在时间跳变。",
                            device_id=device_id,
                            log_id=log1.log_id,
                            details={
                                "log1_id": log1.log_id,
                                "log1_time": log1.log_timestamp.isoformat(),
                                "log2_id": log2.log_id,
                                "log2_time": log2.log_timestamp.isoformat(),
                                "gap_seconds": time_diff,
                                "threshold_seconds": LOG_TIME_DRIFT_THRESHOLD_SECONDS
                            },
                            source_file=log1.source_file
                        )
    
    def _validate_log_sequence(self, context: ValidationContext) -> None:
        screening_ids_in_logs = set()
        for log in context.device_logs:
            if log.screening_id:
                screening_ids_in_logs.add(log.screening_id)
        
        for result in context.screening_results:
            if result.screening_id and result.screening_id not in screening_ids_in_logs:
                student = context.get_student_by_id(result.student_id)
                student_name = student.name if student else "未知姓名"
                
                self._add_issue(
                    issue_type=IssueType.LOG_TIME_DRIFT,
                    severity=IssueSeverity.LOW,
                    title=f"筛查 {result.screening_id} 无对应的设备日志",
                    description=f"筛查记录 {result.screening_id}（学生 {student_name}，ID: {result.student_id}）在设备日志中未找到对应的筛查事件记录。可能日志不完整或筛查ID不匹配。",
                    student_id=result.student_id,
                    screening_id=result.screening_id,
                    device_id=result.device_id,
                    details={
                        "student_name": student_name,
                        "screening_date": result.screening_date.isoformat() if result.screening_date else None
                    },
                    source_file=result.source_file
                )
    
    def _validate_error_logs(self, context: ValidationContext) -> None:
        from models import LogLevel
        
        error_logs = [
            log for log in context.device_logs 
            if log.level in [LogLevel.ERROR, LogLevel.CRITICAL]
        ]
        
        for log in error_logs:
            severity = IssueSeverity.HIGH if log.level == LogLevel.CRITICAL else IssueSeverity.MEDIUM
            
            self._add_issue(
                issue_type=IssueType.INVALID_DATA,
                severity=severity,
                title=f"设备 {log.device_id} {log.level.value.upper()} 日志",
                description=f"设备 {log.device_id} 记录了{log.level.value}级别日志：{log.message}。事件类型：{log.event_type.value if log.event_type else '未知'}。请检查设备是否存在故障。",
                device_id=log.device_id,
                log_id=log.log_id,
                details={
                    "log_level": log.level.value,
                    "event_type": log.event_type.value if log.event_type else None,
                    "message": log.message,
                    "log_time": log.log_timestamp.isoformat(),
                    "details": log.details
                },
                source_file=log.source_file
            )


def validate_logs(context: ValidationContext) -> List[ValidationIssue]:
    validator = LogValidator()
    return validator.validate(context)
