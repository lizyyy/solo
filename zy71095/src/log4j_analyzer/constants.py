from enum import IntEnum


class ExitCode(IntEnum):
    SUCCESS = 0
    INVALID_ARGS = 1
    CONFIG_NOT_FOUND = 2
    PARSE_ERROR = 3
    INCLUDE_ERROR = 4
    ENV_ERROR = 5
    VALIDATION_ERROR = 6
    UNKNOWN_ERROR = 99


EXIT_CODE_DESCRIPTIONS = {
    ExitCode.SUCCESS: "执行成功",
    ExitCode.INVALID_ARGS: "命令行参数无效",
    ExitCode.CONFIG_NOT_FOUND: "配置文件未找到",
    ExitCode.PARSE_ERROR: "配置文件解析错误",
    ExitCode.INCLUDE_ERROR: "Include 文件处理错误",
    ExitCode.ENV_ERROR: "环境变量处理错误",
    ExitCode.VALIDATION_ERROR: "输入数据校验失败",
    ExitCode.UNKNOWN_ERROR: "未知错误",
}


LOG_LEVELS = ["ALL", "TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL", "OFF"]


LOG_LEVEL_PRIORITY = {
    "ALL": 0,
    "TRACE": 1,
    "DEBUG": 2,
    "INFO": 3,
    "WARN": 4,
    "ERROR": 5,
    "FATAL": 6,
    "OFF": 7,
}


CONFIG_SOURCE_PRIORITY = {
    "default": 0,
    "file": 10,
    "included_file": 15,
    "env_file": 20,
    "env_var": 30,
    "cli_override": 40,
}
