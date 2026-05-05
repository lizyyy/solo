from datetime import datetime
from typing import Optional, Any
from fastapi import status


class AppException(Exception):
    def __init__(
        self,
        error_code: str,
        error_message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Any] = None
    ):
        self.error_code = error_code
        self.error_message = error_message
        self.status_code = status_code
        self.details = details
        self.timestamp = datetime.utcnow()
        super().__init__(self.error_message)


class TaskNotFoundException(AppException):
    def __init__(self, task_id: int):
        super().__init__(
            error_code="TASK_NOT_FOUND",
            error_message=f"任务 {task_id} 不存在",
            status_code=status.HTTP_404_NOT_FOUND
        )


class TaskAlreadyRunningException(AppException):
    def __init__(self, task_id: int):
        super().__init__(
            error_code="TASK_ALREADY_RUNNING",
            error_message=f"任务 {task_id} 已经在运行中",
            status_code=status.HTTP_400_BAD_REQUEST
        )


class TaskNotCompletedException(AppException):
    def __init__(self, task_id: int):
        super().__init__(
            error_code="TASK_NOT_COMPLETED",
            error_message=f"任务 {task_id} 尚未完成，无法执行此操作",
            status_code=status.HTTP_400_BAD_REQUEST
        )


class InvalidInputException(AppException):
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(
            error_code="INVALID_INPUT",
            error_message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details
        )


class SnapshotNotFoundException(AppException):
    def __init__(self, snapshot_id: int):
        super().__init__(
            error_code="SNAPSHOT_NOT_FOUND",
            error_message=f"输入快照 {snapshot_id} 不存在",
            status_code=status.HTTP_404_NOT_FOUND
        )


class ResultNotFoundException(AppException):
    def __init__(self, result_id: int):
        super().__init__(
            error_code="RESULT_NOT_FOUND",
            error_message=f"诊断结果 {result_id} 不存在",
            status_code=status.HTTP_404_NOT_FOUND
        )


class ExportNotFoundException(AppException):
    def __init__(self, export_id: int):
        super().__init__(
            error_code="EXPORT_NOT_FOUND",
            error_message=f"导出记录 {export_id} 不存在",
            status_code=status.HTTP_404_NOT_FOUND
        )


class AnalysisFailedException(AppException):
    def __init__(self, task_id: int, reason: str):
        super().__init__(
            error_code="ANALYSIS_FAILED",
            error_message=f"任务 {task_id} 分析失败: {reason}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class ExportFailedException(AppException):
    def __init__(self, task_id: int, reason: str):
        super().__init__(
            error_code="EXPORT_FAILED",
            error_message=f"任务 {task_id} 导出失败: {reason}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class ComparisonFailedException(AppException):
    def __init__(self, reason: str):
        super().__init__(
            error_code="COMPARISON_FAILED",
            error_message=f"对比失败: {reason}",
            status_code=status.HTTP_400_BAD_REQUEST
        )
