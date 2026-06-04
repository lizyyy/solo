class MonitorError(Exception):
    """协方差漂移监测基础异常"""
    pass


class ConflictDetectedError(MonitorError):
    """检测到公式冲突异常"""

    def __init__(self, record_id: str, conflicts: list, message: str = None):
        self.record_id = record_id
        self.conflicts = conflicts
        self.message = message or f"记录 {record_id} 检测到公式冲突，需教研负责人吴老师确认"
        super().__init__(self.message)


class MixedFormatError(MonitorError):
    """百分数和小数混排异常"""

    def __init__(self, record_id: str, details: list, message: str = None):
        self.record_id = record_id
        self.details = details
        self.message = message or f"记录 {record_id} 存在百分数与小数混排，需活动负责人复核"
        super().__init__(self.message)


class PendingReviewError(MonitorError):
    """待复核状态异常"""

    def __init__(self, record_id: str, status: str, message: str = None):
        self.record_id = record_id
        self.status = status
        self.message = message or f"记录 {record_id} 处于 {status} 状态，需完成复核后继续"
        super().__init__(self.message)


class FormulaNotFoundError(MonitorError):
    """公式未找到异常"""
    pass
