from datetime import datetime
from enum import IntEnum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from .conflict import Conflict
from .replacement import ReplacementResult
from .version_catalog import VersionCatalog


class ExitCode(IntEnum):
    SUCCESS = 0
    NO_INPUT_FILES = 1
    INPUT_VALIDATION_ERROR = 2
    PARSE_ERROR = 3
    VERSION_CONFLICT = 4
    PLUGIN_CONFLICT = 5
    DEPENDENCY_RESOLUTION_ERROR = 6
    OUTPUT_WRITE_ERROR = 7
    CONFIGURATION_ERROR = 8
    UNKNOWN_ERROR = 99


EXIT_CODE_DESCRIPTIONS = {
    ExitCode.SUCCESS: "执行成功，没有错误或冲突",
    ExitCode.NO_INPUT_FILES: "未找到任何输入文件",
    ExitCode.INPUT_VALIDATION_ERROR: "输入参数校验失败",
    ExitCode.PARSE_ERROR: "Gradle 配置文件解析错误",
    ExitCode.VERSION_CONFLICT: "检测到依赖版本冲突",
    ExitCode.PLUGIN_CONFLICT: "检测到插件版本冲突",
    ExitCode.DEPENDENCY_RESOLUTION_ERROR: "依赖解析失败",
    ExitCode.OUTPUT_WRITE_ERROR: "输出文件写入失败",
    ExitCode.CONFIGURATION_ERROR: "配置错误",
    ExitCode.UNKNOWN_ERROR: "未知错误",
}


class ExitCodeInfo(BaseModel):
    code: ExitCode
    name: str
    description: str

    @classmethod
    def from_code(cls, code: ExitCode) -> "ExitCodeInfo":
        return cls(
            code=code,
            name=code.name,
            description=EXIT_CODE_DESCRIPTIONS.get(code, "未知退出码"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "code": int(self.code),
            "name": self.name,
            "description": self.description,
        }


class ReportMetadata(BaseModel):
    tool_name: str = "gradle-dep-replace"
    tool_version: str = "0.1.0"
    timestamp: datetime = Field(default_factory=datetime.now)
    input_files: List[str] = Field(default_factory=list)
    output_directory: Optional[str] = None
    command_line: Optional[str] = None
    duration_ms: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "tool_version": self.tool_version,
            "timestamp": self.timestamp.isoformat(),
            "input_files": self.input_files,
            "output_directory": self.output_directory,
            "command_line": self.command_line,
            "duration_ms": self.duration_ms,
        }


class ReportStatistics(BaseModel):
    total_dependencies: int = 0
    total_plugins: int = 0
    changed_dependencies: int = 0
    unchanged_dependencies: int = 0
    dynamic_versions: int = 0
    conflicts_found: int = 0
    critical_conflicts: int = 0
    error_conflicts: int = 0
    warning_conflicts: int = 0
    info_conflicts: int = 0
    rules_applied: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_dependencies": self.total_dependencies,
            "total_plugins": self.total_plugins,
            "changed_dependencies": self.changed_dependencies,
            "unchanged_dependencies": self.unchanged_dependencies,
            "dynamic_versions": self.dynamic_versions,
            "conflicts_found": self.conflicts_found,
            "critical_conflicts": self.critical_conflicts,
            "error_conflicts": self.error_conflicts,
            "warning_conflicts": self.warning_conflicts,
            "info_conflicts": self.info_conflicts,
            "rules_applied": self.rules_applied,
        }


class Report(BaseModel):
    metadata: ReportMetadata = Field(default_factory=ReportMetadata)
    statistics: ReportStatistics = Field(default_factory=ReportStatistics)
    exit_code_info: ExitCodeInfo
    replacement_result: Optional[ReplacementResult] = None
    conflicts: List[Conflict] = Field(default_factory=list)
    version_catalogs: List[VersionCatalog] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)
    output_files: List[str] = Field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metadata": self.metadata.to_dict(),
            "statistics": self.statistics.to_dict(),
            "exit_code_info": self.exit_code_info.to_dict(),
            "replacement_result": self.replacement_result.to_dict() if self.replacement_result else None,
            "conflicts": [c.to_dict() for c in self.conflicts],
            "version_catalogs": [vc.to_dict() for vc in self.version_catalogs],
            "notes": self.notes,
            "output_files": self.output_files,
        }
