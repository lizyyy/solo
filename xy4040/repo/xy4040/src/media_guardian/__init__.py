"""素材回卡守门员 - 纪录片外拍素材拷贝管理工具

一个用于安全、可靠地管理纪录片外拍素材从存储卡到归档存储的命令行工具。

主要功能：
- scan: 扫描存储卡目录，识别媒体文件并生成 manifest
- plan: 生成拷贝计划，执行多种校验规则
- copy: 执行可续传的拷贝，带哈希校验
- verify: 验证目标目录与 manifest 是否一致
- report: 生成 Markdown 交接报告和 CSV 问题清单
"""

__version__ = "0.1.0"
__author__ = "Media Guardian Team"

from .config import ConfigManager, get_config_manager, DEFAULT_CONFIG
from .manifest import Manifest, ManifestManager, load_manifest, save_manifest
from .scanner import FileInfo, ScanResult, CardScanResult, FileScanner, scan_cards
from .validator import (
    ValidationIssue,
    Severity,
    CopyPlan,
    generate_copy_plan,
    validate_manifest,
)
from .copier import CopyResult, execute_copy
from .reporter import ReportData, generate_report, export_markdown, export_csv_files

__all__ = [
    "ConfigManager",
    "get_config_manager",
    "DEFAULT_CONFIG",
    "Manifest",
    "ManifestManager",
    "load_manifest",
    "save_manifest",
    "FileInfo",
    "ScanResult",
    "CardScanResult",
    "FileScanner",
    "scan_cards",
    "ValidationIssue",
    "Severity",
    "CopyPlan",
    "generate_copy_plan",
    "validate_manifest",
    "CopyResult",
    "execute_copy",
    "ReportData",
    "generate_report",
    "export_markdown",
    "export_csv_files",
]
