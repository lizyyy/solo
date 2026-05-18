from .constants import ValidationType


class AdOverspendError(Exception):
    pass


class ParseError(AdOverspendError):
    def __init__(self, file_path: str, message: str):
        self.file_path = file_path
        self.message = message
        super().__init__(f"解析错误 [{file_path}]: {message}")


class ValidationError(AdOverspendError):
    def __init__(self, validation_type: ValidationType, message: str):
        self.validation_type = validation_type
        self.message = message
        super().__init__(f"校验错误 [{validation_type.value}]: {message}")


class FileProcessingError(AdOverspendError):
    def __init__(self, file_path: str, error_type: str, message: str):
        self.file_path = file_path
        self.error_type = error_type
        self.message = message
        super().__init__(f"文件处理错误 [{file_path}] - {error_type}: {message}")


class TimezoneError(FileProcessingError):
    def __init__(self, file_path: str, timezone: str, message: str):
        super().__init__(file_path, "时区问题", f"时区 {timezone}: {message}")
        self.timezone = timezone


class BudgetChangeError(FileProcessingError):
    def __init__(self, file_path: str, plan_id: str, message: str):
        super().__init__(file_path, "预算改动", f"计划 {plan_id}: {message}")
        self.plan_id = plan_id


class BackfillError(FileProcessingError):
    def __init__(self, file_path: str, date: str, message: str):
        super().__init__(file_path, "回传补写", f"日期 {date}: {message}")
        self.date = date
