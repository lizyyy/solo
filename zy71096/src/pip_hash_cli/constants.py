from enum import IntEnum


class ExitCode(IntEnum):
    SUCCESS = 0
    INPUT_ERROR = 1
    HASH_MISMATCH = 2
    MISSING_PACKAGE = 3
    CONSTRAINT_CONFLICT = 4
    SOURCE_MISMATCH = 5
    UNKNOWN_ERROR = 10


EXIT_CODE_DESCRIPTIONS = {
    ExitCode.SUCCESS: "所有检查通过，未发现问题",
    ExitCode.INPUT_ERROR: "输入参数错误或文件读取失败",
    ExitCode.HASH_MISMATCH: "发现哈希值不匹配",
    ExitCode.MISSING_PACKAGE: "缺少必需的包或哈希值",
    ExitCode.CONSTRAINT_CONFLICT: "依赖约束存在冲突",
    ExitCode.SOURCE_MISMATCH: "包来源不匹配预期",
    ExitCode.UNKNOWN_ERROR: "发生未知错误",
}


class HashAlgorithm:
    SHA256 = "sha256"
    SHA384 = "sha384"
    SHA512 = "sha512"
    MD5 = "md5"


SUPPORTED_HASH_ALGORITHMS = [
    HashAlgorithm.SHA256,
    HashAlgorithm.SHA384,
    HashAlgorithm.SHA512,
    HashAlgorithm.MD5,
]


class PackageSource:
    PYPI = "pypi"
    WHEELHOUSE = "wheelhouse"
    LOCAL = "local"
    CUSTOM_INDEX = "custom_index"
    REQUIREMENTS = "requirements_file"
    CONSTRAINTS = "constraints_file"
    UNKNOWN = "unknown"


REPORT_TEMPLATES_DIR = "templates"
DEFAULT_OUTPUT_DIR = "pip-hash-reports"
