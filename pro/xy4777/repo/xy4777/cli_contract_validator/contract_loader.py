"""契约文件加载器 - 支持 YAML 和 JSON 格式"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List

import yaml

from .models import (
    Contract,
    OutputExpectation,
    ParameterRule,
    Subcommand,
    TestCase,
)


class ContractParseError(Exception):
    """契约解析错误"""
    pass


class ContractLoader:
    """契约加载器"""

    @classmethod
    def load(cls, file_path: str) -> Contract:
        """从文件加载契约

        Args:
            file_path: 契约文件路径，支持 .yaml, .yml, .json

        Returns:
            Contract 对象

        Raises:
            ContractParseError: 文件格式错误或内容无效
        """
        path = Path(file_path)
        if not path.exists():
            raise ContractParseError(f"契约文件不存在: {file_path}")

        suffix = path.suffix.lower()
        if suffix in (".yaml", ".yml"):
            return cls._load_yaml(path)
        elif suffix == ".json":
            return cls._load_json(path)
        else:
            raise ContractParseError(f"不支持的文件格式: {suffix}")

    @classmethod
    def _load_yaml(cls, path: Path) -> Contract:
        """加载 YAML 格式契约"""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
            return cls._parse_contract(data)
        except yaml.YAMLError as e:
            raise ContractParseError(f"YAML 解析错误: {e}") from e
        except Exception as e:
            raise ContractParseError(f"加载契约失败: {e}") from e

    @classmethod
    def _load_json(cls, path: Path) -> Contract:
        """加载 JSON 格式契约"""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return cls._parse_contract(data)
        except json.JSONDecodeError as e:
            raise ContractParseError(f"JSON 解析错误: {e}") from e
        except Exception as e:
            raise ContractParseError(f"加载契约失败: {e}") from e

    @classmethod
    def _parse_contract(cls, data: Dict[str, Any]) -> Contract:
        """解析契约数据"""
        required_fields = ["name", "version", "tool_path"]
        for field in required_fields:
            if field not in data:
                raise ContractParseError(f"契约缺少必填字段: {field}")

        return Contract(
            name=data["name"],
            version=data["version"],
            tool_path=data["tool_path"],
            description=data.get("description"),
            global_env=data.get("global_env", {}),
            subcommands=cls._parse_subcommands(data.get("subcommands", [])),
        )

    @classmethod
    def _parse_subcommands(cls, subcommands_data: List[Dict[str, Any]]) -> List[Subcommand]:
        """解析子命令列表"""
        subcommands = []
        for idx, sub_data in enumerate(subcommands_data):
            if "name" not in sub_data:
                raise ContractParseError(f"子命令 {idx} 缺少必填字段: name")

            subcommands.append(Subcommand(
                name=sub_data["name"],
                description=sub_data.get("description"),
                parameters=cls._parse_parameters(sub_data.get("parameters", [])),
                test_cases=cls._parse_test_cases(sub_data.get("test_cases", [])),
            ))
        return subcommands

    @classmethod
    def _parse_parameters(cls, params_data: List[Dict[str, Any]]) -> List[ParameterRule]:
        """解析参数规则列表"""
        params = []
        for idx, param_data in enumerate(params_data):
            if "name" not in param_data:
                raise ContractParseError(f"参数 {idx} 缺少必填字段: name")

            params.append(ParameterRule(
                name=param_data["name"],
                required=param_data.get("required", False),
                type=param_data.get("type", "string"),
                default=param_data.get("default"),
                choices=param_data.get("choices"),
                mutually_exclusive_with=param_data.get("mutually_exclusive_with", []),
                depends_on=param_data.get("depends_on", []),
                description=param_data.get("description"),
            ))
        return params

    @classmethod
    def _parse_test_cases(cls, test_cases_data: List[Dict[str, Any]]) -> List[TestCase]:
        """解析测试用例列表"""
        test_cases = []
        for idx, tc_data in enumerate(test_cases_data):
            if "name" not in tc_data:
                raise ContractParseError(f"测试用例 {idx} 缺少必填字段: name")
            if "command" not in tc_data:
                raise ContractParseError(f"测试用例 '{tc_data['name']}' 缺少必填字段: command")

            test_cases.append(TestCase(
                name=tc_data["name"],
                command=tc_data["command"],
                args=tc_data.get("args", []),
                env=tc_data.get("env", {}),
                input_files=tc_data.get("input_files", {}),
                expected=cls._parse_output_expectation(tc_data.get("expected", {})),
                description=tc_data.get("description"),
                tags=tc_data.get("tags", []),
            ))
        return test_cases

    @classmethod
    def _parse_output_expectation(cls, data: Dict[str, Any]) -> OutputExpectation:
        """解析输出期望"""
        return OutputExpectation(
            stdout_contains=data.get("stdout_contains", []),
            stdout_not_contains=data.get("stdout_not_contains", []),
            stderr_contains=data.get("stderr_contains", []),
            stderr_not_contains=data.get("stderr_not_contains", []),
            exit_code=data.get("exit_code", 0),
            timeout=data.get("timeout", 30),
        )
