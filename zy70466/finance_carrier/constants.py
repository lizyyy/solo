from enum import IntEnum


class ExitCode(IntEnum):
    SUCCESS = 0
    GENERAL_ERROR = 1
    FILE_NOT_FOUND = 2
    BATCH_CONFLICT = 3
    VALIDATION_ERROR = 4
    EMPTY_CANDIDATES = 5
    PROCESSOR_NOT_FOUND = 6


class ProcessingStatus:
    SUCCESS = "success"
    FAILED = "failed"
    PENDING = "pending"
    CONFLICT = "conflict"
    ROLLBACK = "rollback"


class ErrorMessages:
    FILE_NOT_FOUND = "文件不存在: {file_path}"
    BATCH_CONFLICT = "批次号冲突: batch_no={batch_no}, 已存在于 {existing_source}"
    VALIDATION_ERROR = "数据验证失败: {field} - {message}"
    EMPTY_CANDIDATES = "候选清单为空，没有需要处理的记录"
    PROCESSOR_NOT_FOUND = "未找到处理人: {processor}"
    INVALID_DATA_FORMAT = "数据格式无效: {detail}"
