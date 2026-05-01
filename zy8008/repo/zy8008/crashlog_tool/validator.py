"""
清单校验模块

负责验证输入文件的完整性和正确性：
- 日志目录是否存在并包含日志文件
- 脱敏规则 JSON 是否有效
- 构建元信息 YAML 是否有效
"""

import os
import json
import yaml
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class ValidationSeverity(Enum):
    """校验严重程度"""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass
class ValidationIssue:
    """校验问题"""
    severity: ValidationSeverity
    field: str
    message: str
    suggestion: str = ""


@dataclass
class ValidationResult:
    """校验结果"""
    valid: bool
    issues: List[ValidationIssue] = field(default_factory=list)
    build_meta: Dict[str, Any] = field(default_factory=dict)
    sanitize_rules: Dict[str, Any] = field(default_factory=dict)
    log_files: List[str] = field(default_factory=list)

    def add_error(self, field: str, message: str, suggestion: str = ""):
        self.issues.append(ValidationIssue(
            severity=ValidationSeverity.ERROR,
            field=field,
            message=message,
            suggestion=suggestion
        ))
        self.valid = False

    def add_warning(self, field: str, message: str, suggestion: str = ""):
        self.issues.append(ValidationIssue(
            severity=ValidationSeverity.WARNING,
            field=field,
            message=message,
            suggestion=suggestion
        ))

    def add_info(self, field: str, message: str):
        self.issues.append(ValidationIssue(
            severity=ValidationSeverity.INFO,
            field=field,
            message=message
        ))

    def get_errors(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.ERROR]

    def get_warnings(self) -> List[ValidationIssue]:
        return [i for i in self.issues if i.severity == ValidationSeverity.WARNING]


REQUIRED_BUILD_META_FIELDS = [
    "app_name",
    "version_name",
    "version_code",
    "build_type",
]

OPTIONAL_BUILD_META_FIELDS = [
    "build_time",
    "git_commit",
    "git_branch",
    "flavor",
    "platform",
    "sdk_version",
    "min_sdk_version",
    "proguard_mapping",
    "symbols_file",
]

LOG_EXTENSIONS = {'.log', '.txt', '.crash', '.trace', '.json'}


class InputValidator:
    """输入校验器"""

    def __init__(self):
        pass

    def validate_all(
        self,
        log_dir: str,
        sanitize_rules_path: Optional[str] = None,
        build_meta_path: Optional[str] = None
    ) -> ValidationResult:
        """
        校验所有输入

        一站式校验：日志目录、脱敏规则、构建元信息
        """
        result = ValidationResult(valid=True)

        self._validate_log_directory(log_dir, result)

        if sanitize_rules_path:
            self._validate_sanitize_rules(sanitize_rules_path, result)

        if build_meta_path:
            self._validate_build_meta(build_meta_path, result)
        else:
            result.add_warning(
                "build_meta",
                "未提供构建元信息",
                "建议提供 build_meta.yaml 以帮助符号化堆栈"
            )

        return result

    def _validate_log_directory(self, log_dir: str, result: ValidationResult):
        """校验日志目录"""
        if not os.path.exists(log_dir):
            result.add_error(
                "log_dir",
                f"日志目录不存在: {log_dir}",
                "请检查路径是否正确"
            )
            return

        if not os.path.isdir(log_dir):
            result.add_error(
                "log_dir",
                f"路径不是目录: {log_dir}",
                "请提供有效的日志目录路径"
            )
            return

        log_files = self._find_log_files(log_dir)
        result.log_files = log_files

        if not log_files:
            result.add_warning(
                "log_dir",
                "日志目录中未找到日志文件",
                f"支持的扩展名: {', '.join(LOG_EXTENSIONS)}"
            )
        else:
            result.add_info(
                "log_dir",
                f"找到 {len(log_files)} 个日志文件"
            )

    def _find_log_files(self, log_dir: str) -> List[str]:
        """查找日志文件"""
        log_files = []

        for root, _, files in os.walk(log_dir):
            for file_name in files:
                ext = os.path.splitext(file_name)[1].lower()
                if ext in LOG_EXTENSIONS or not ext:
                    log_files.append(os.path.join(root, file_name))

        return log_files

    def _validate_sanitize_rules(self, rules_path: str, result: ValidationResult):
        """校验脱敏规则文件"""
        if not os.path.exists(rules_path):
            result.add_warning(
                "sanitize_rules",
                f"脱敏规则文件不存在: {rules_path}",
                "将使用默认脱敏规则"
            )
            return

        if not os.path.isfile(rules_path):
            result.add_error(
                "sanitize_rules",
                f"路径不是文件: {rules_path}",
                "请提供有效的 JSON 文件路径"
            )
            return

        try:
            with open(rules_path, 'r', encoding='utf-8') as f:
                rules_data = json.load(f)

            result.sanitize_rules = rules_data
            self._validate_rules_structure(rules_data, result)

        except json.JSONDecodeError as e:
            result.add_error(
                "sanitize_rules",
                f"JSON 解析失败: {e}",
                "请检查文件格式是否正确"
            )
        except Exception as e:
            result.add_error(
                "sanitize_rules",
                f"读取文件失败: {e}",
                "请检查文件权限"
            )

    def _validate_rules_structure(self, rules_data: Dict, result: ValidationResult):
        """校验规则结构"""
        if not isinstance(rules_data, dict):
            result.add_error(
                "sanitize_rules",
                "规则文件根节点必须是对象",
                "格式应为: {\"rules\": [...], \"sensitive_json_keys\": [...]}"
            )
            return

        if "rules" in rules_data:
            rules = rules_data["rules"]
            if not isinstance(rules, list):
                result.add_warning(
                    "sanitize_rules.rules",
                    "rules 字段应该是数组",
                    "格式应为: [{\"name\": \"rule1\", ...}, ...]"
                )
            else:
                for i, rule in enumerate(rules):
                    if not isinstance(rule, dict):
                        result.add_warning(
                            f"sanitize_rules.rules[{i}]",
                            f"规则 {i} 应该是对象",
                            "每个规则需要包含 name 和 pattern 字段"
                        )
                    else:
                        if "name" not in rule:
                            result.add_warning(
                                f"sanitize_rules.rules[{i}]",
                                f"规则 {i} 缺少 name 字段",
                                "建议为每个规则指定名称"
                            )
                        if "pattern" not in rule:
                            result.add_warning(
                                f"sanitize_rules.rules[{i}]",
                                f"规则 {i} 缺少 pattern 字段",
                                "规则需要正则表达式模式"
                            )

        if "sensitive_json_keys" in rules_data:
            keys = rules_data["sensitive_json_keys"]
            if not isinstance(keys, list):
                result.add_warning(
                    "sanitize_rules.sensitive_json_keys",
                    "sensitive_json_keys 应该是数组",
                    "格式应为: [\"token\", \"password\", ...]"
                )

        result.add_info(
            "sanitize_rules",
            "脱敏规则文件格式正确"
        )

    def _validate_build_meta(self, meta_path: str, result: ValidationResult):
        """校验构建元信息文件"""
        if not os.path.exists(meta_path):
            result.add_warning(
                "build_meta",
                f"构建元信息文件不存在: {meta_path}",
                "建议提供构建元信息以帮助符号化"
            )
            return

        if not os.path.isfile(meta_path):
            result.add_error(
                "build_meta",
                f"路径不是文件: {meta_path}",
                "请提供有效的 YAML 文件路径"
            )
            return

        try:
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta_data = yaml.safe_load(f)

            if meta_data is None:
                result.add_warning(
                    "build_meta",
                    "构建元信息文件为空",
                    "请添加必要的构建信息"
                )
                return

            if not isinstance(meta_data, dict):
                result.add_error(
                    "build_meta",
                    "构建元信息根节点必须是对象",
                    "请使用 YAML 对象格式"
                )
                return

            result.build_meta = meta_data
            self._validate_meta_fields(meta_data, result)

        except yaml.YAMLError as e:
            result.add_error(
                "build_meta",
                f"YAML 解析失败: {e}",
                "请检查文件格式是否正确"
            )
        except Exception as e:
            result.add_error(
                "build_meta",
                f"读取文件失败: {e}",
                "请检查文件权限"
            )

    def _validate_meta_fields(self, meta_data: Dict, result: ValidationResult):
        """校验元信息字段"""
        for field in REQUIRED_BUILD_META_FIELDS:
            if field not in meta_data or meta_data[field] is None:
                result.add_warning(
                    f"build_meta.{field}",
                    f"缺少建议字段: {field}",
                    f"建议添加 {field} 字段以帮助问题定位"
                )

        for field in OPTIONAL_BUILD_META_FIELDS:
            if field in meta_data and meta_data[field] is not None:
                result.add_info(
                    f"build_meta.{field}",
                    f"包含字段: {field} = {meta_data[field]}"
                )

        if "proguard_mapping" in meta_data:
            mapping_path = meta_data["proguard_mapping"]
            if mapping_path and not os.path.exists(mapping_path):
                result.add_warning(
                    "build_meta.proguard_mapping",
                    f"混淆映射文件不存在: {mapping_path}",
                    "如果使用代码混淆，请确保映射文件路径正确"
                )

        if "symbols_file" in meta_data:
            symbols_path = meta_data["symbols_file"]
            if symbols_path and not os.path.exists(symbols_path):
                result.add_warning(
                    "build_meta.symbols_file",
                    f"符号文件不存在: {symbols_path}",
                    "符号文件有助于符号化原生崩溃堆栈"
                )

        result.add_info(
            "build_meta",
            "构建元信息格式正确"
        )


def validate_inputs(
    log_dir: str,
    sanitize_rules_path: Optional[str] = None,
    build_meta_path: Optional[str] = None
) -> ValidationResult:
    """
    便捷函数：校验所有输入
    """
    validator = InputValidator()
    return validator.validate_all(log_dir, sanitize_rules_path, build_meta_path)
