from enum import IntEnum, unique


@unique
class ExitCode(IntEnum):
    SUCCESS = 0
    PARTIAL_SUCCESS = 1
    NO_FILES_PROCESSED = 2
    INPUT_ERROR = 3
    PERMISSION_ERROR = 4
    PDF_ENCRYPTED = 5
    PDF_CORRUPT = 6
    OUTPUT_ERROR = 7
    CONFIG_ERROR = 8
    INCREMENTAL_UPDATE_DETECTED = 9
    UNKNOWN_ERROR = 10


EXIT_CODE_DESCRIPTIONS = {
    ExitCode.SUCCESS: "所有文件处理成功，所有敏感数据已清理",
    ExitCode.PARTIAL_SUCCESS: "部分文件处理成功，部分文件存在问题",
    ExitCode.NO_FILES_PROCESSED: "未找到可处理的PDF文件",
    ExitCode.INPUT_ERROR: "输入参数错误或文件不存在",
    ExitCode.PERMISSION_ERROR: "文件权限不足，无法读取或写入",
    ExitCode.PDF_ENCRYPTED: "PDF文件已加密，需要密码才能处理",
    ExitCode.PDF_CORRUPT: "PDF文件损坏或格式无效",
    ExitCode.OUTPUT_ERROR: "输出目录无法创建或写入",
    ExitCode.CONFIG_ERROR: "脱敏规则配置错误",
    ExitCode.INCREMENTAL_UPDATE_DETECTED: "检测到增量更新残留，需要手动处理",
    ExitCode.UNKNOWN_ERROR: "发生未知错误",
}


class SanitizerError(Exception):
    def __init__(self, message: str, exit_code: ExitCode = ExitCode.UNKNOWN_ERROR):
        super().__init__(message)
        self.exit_code = exit_code


class PDFEncryptedError(SanitizerError):
    def __init__(self, message: str = "PDF文件已加密"):
        super().__init__(message, ExitCode.PDF_ENCRYPTED)


class PDFCorruptError(SanitizerError):
    def __init__(self, message: str = "PDF文件损坏或格式无效"):
        super().__init__(message, ExitCode.PDF_CORRUPT)


class IncrementalUpdateError(SanitizerError):
    def __init__(self, message: str = "检测到增量更新残留"):
        super().__init__(message, ExitCode.INCREMENTAL_UPDATE_DETECTED)
