"""文件解析器模块。

解析 pipelines.yaml、events.jsonl 和 Python 代码片段。
"""

import ast
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import yaml

from .models import Event, Pipeline, PipelineRisk, Severity


class ParseError(Exception):
    """解析错误异常。"""

    def __init__(self, message: str, file_path: Optional[str] = None, line: Optional[int] = None):
        self.message = message
        self.file_path = file_path
        self.line = line
        super().__init__(self.format_message())

    def format_message(self) -> str:
        parts = ["解析错误"]
        if self.file_path:
            parts.append(f"文件: {self.file_path}")
        if self.line is not None:
            parts.append(f"行号: {self.line}")
        parts.append(f"详情: {self.message}")
        return " - ".join(parts)


class YAMLParser:
    """YAML 文件解析器。"""

    @staticmethod
    def parse(file_path: Union[str, Path]) -> Dict[str, Any]:
        """解析 YAML 文件。"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise ParseError(f"文件不存在: {file_path}", str(file_path))

        if not file_path.is_file():
            raise ParseError(f"不是文件: {file_path}", str(file_path))

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            if hasattr(e, "problem_mark"):
                mark = e.problem_mark
                raise ParseError(
                    f"YAML 语法错误: {e.problem}",
                    str(file_path),
                    mark.line + 1 if mark else None,
                ) from e
            raise ParseError(f"YAML 解析失败: {e}", str(file_path)) from e
        except UnicodeDecodeError as e:
            raise ParseError(f"文件编码错误，请确保是 UTF-8 编码: {e}", str(file_path)) from e


class JSONLParser:
    """JSON Lines 文件解析器。"""

    @staticmethod
    def parse(file_path: Union[str, Path]) -> List[Dict[str, Any]]:
        """解析 JSONL 文件。"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise ParseError(f"文件不存在: {file_path}", str(file_path))

        if not file_path.is_file():
            raise ParseError(f"不是文件: {file_path}", str(file_path))

        results = []
        line_num = 0

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line_num += 1
                    line = line.strip()
                    if not line:
                        continue

                    try:
                        results.append(json.loads(line))
                    except json.JSONDecodeError as e:
                        raise ParseError(
                            f"JSON 语法错误: {e.msg} (位置: {e.pos})",
                            str(file_path),
                            line_num,
                        ) from e
        except UnicodeDecodeError as e:
            raise ParseError(f"文件编码错误，请确保是 UTF-8 编码: {e}", str(file_path)) from e

        return results


class PythonParser:
    """Python 代码解析器。"""

    def __init__(self):
        self._patterns: Dict[str, re.Pattern] = self._compile_patterns()

    @staticmethod
    def _compile_patterns() -> Dict[str, re.Pattern]:
        """编译正则表达式模式。"""
        return {
            "iter_def": re.compile(r"def\s+__iter__\s*\("),
            "next_def": re.compile(r"def\s+__next__\s*\("),
            "iter_return_self": re.compile(r"return\s+self"),
            "iter_return_new": re.compile(r"return\s+\w+\s*\("),
            "yield": re.compile(r"\byield\b(?!\s+from)"),
            "yield_from": re.compile(r"\byield\s+from\b"),
            "raise_stopiteration": re.compile(r"raise\s+StopIteration"),
            "send": re.compile(r"\.send\s*\("),
            "throw": re.compile(r"\.throw\s*\("),
            "close": re.compile(r"\.close\s*\("),
            "itertools_tee": re.compile(r"itertools\.tee|from\s+itertools\s+import.*tee"),
            "generator_expr": re.compile(r"\([^)]+\s+for\s+[^)]+\s+in\s+[^)]+\)"),
            "list_for_in": re.compile(r"\[[^\]]+\s+for\s+[^\]]+\s+in\s+[^\]]+\]"),
            "next_call": re.compile(r"\bnext\s*\("),
            "except_stopiteration": re.compile(r"except\s+StopIteration"),
            "except_generator_exit": re.compile(r"except\s+GeneratorExit"),
        }

    def parse_file(self, file_path: Union[str, Path]) -> Dict[str, Any]:
        """解析 Python 文件。"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise ParseError(f"文件不存在: {file_path}", str(file_path))

        if not file_path.is_file():
            raise ParseError(f"不是文件: {file_path}", str(file_path))

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError as e:
            raise ParseError(f"文件编码错误，请确保是 UTF-8 编码: {e}", str(file_path)) from e

        return self.parse_content(content, str(file_path))

    def parse_content(self, content: str, file_path: Optional[str] = None) -> Dict[str, Any]:
        """解析 Python 代码内容。"""
        result = {
            "file_path": file_path,
            "content": content,
            "has_iter_protocol": False,
            "has_next_method": False,
            "iter_returns_self": None,
            "has_yield": False,
            "has_yield_from": False,
            "has_raise_stopiteration": False,
            "has_send": False,
            "has_throw": False,
            "has_close": False,
            "uses_tee": False,
            "has_generator_expr": False,
            "has_list_comp": False,
            "lines": content.splitlines(),
            "line_matches": {},
            "ast_error": None,
        }

        for line_num, line in enumerate(content.splitlines(), 1):
            line_matches = []
            for pattern_name, pattern in self._patterns.items():
                if pattern.search(line):
                    line_matches.append(pattern_name)
                    if pattern_name == "iter_def":
                        result["has_iter_protocol"] = True
                    elif pattern_name == "next_def":
                        result["has_next_method"] = True
                    elif pattern_name == "yield":
                        result["has_yield"] = True
                    elif pattern_name == "yield_from":
                        result["has_yield_from"] = True
                    elif pattern_name == "raise_stopiteration":
                        result["has_raise_stopiteration"] = True
                    elif pattern_name in ["send", "throw", "close"]:
                        result[f"has_{pattern_name}"] = True
                    elif pattern_name == "itertools_tee":
                        result["uses_tee"] = True
                    elif pattern_name == "generator_expr":
                        result["has_generator_expr"] = True
                    elif pattern_name == "list_for_in":
                        result["has_list_comp"] = True

            if line_matches:
                result["line_matches"][line_num] = line_matches

        try:
            tree = ast.parse(content)
            result["ast"] = tree
            result["is_valid_python"] = True

            iter_methods = [
                node for node in ast.walk(tree)
                if isinstance(node, ast.FunctionDef) and node.name == "__iter__"
            ]

            for method in iter_methods:
                returns_self = self._check_iter_returns_self(method)
                if returns_self is not None:
                    result["iter_returns_self"] = returns_self
                    break

        except SyntaxError as e:
            result["is_valid_python"] = False
            result["ast_error"] = {
                "message": str(e),
                "line": e.lineno if hasattr(e, "lineno") else None,
                "offset": e.offset if hasattr(e, "offset") else None,
            }

        return result

    @staticmethod
    def _check_iter_returns_self(method: ast.FunctionDef) -> Optional[bool]:
        """检查 __iter__ 方法是否返回 self。"""
        for node in ast.walk(method):
            if isinstance(node, ast.Return):
                if isinstance(node.value, ast.Name) and node.value.id == "self":
                    return True
                if isinstance(node.value, ast.Call):
                    return False
        return None


class PipelineParser:
    """流水线配置解析器。"""

    def __init__(self):
        self.yaml_parser = YAMLParser()

    def parse(self, file_path: Union[str, Path]) -> List[Pipeline]:
        """解析 pipelines.yaml 文件。"""
        data = self.yaml_parser.parse(file_path)

        pipelines = []
        pipeline_data_list = data.get("pipelines", [])

        if not isinstance(pipeline_data_list, list):
            raise ParseError(
                "pipelines 必须是数组类型",
                str(file_path),
            )

        for idx, pipeline_data in enumerate(pipeline_data_list):
            if not isinstance(pipeline_data, dict):
                raise ParseError(
                    f"第 {idx + 1} 个 pipeline 必须是对象类型",
                    str(file_path),
                )

            pipeline = self._parse_pipeline(pipeline_data, idx, str(file_path))
            pipelines.append(pipeline)

        return pipelines

    def _parse_pipeline(self, data: Dict, index: int, file_path: str) -> Pipeline:
        """解析单个流水线。"""
        name = data.get("name", f"pipeline_{index + 1}")
        description = data.get("description", "")

        if not isinstance(name, str):
            raise ParseError(
                f"pipeline[{index}].name 必须是字符串",
                file_path,
            )

        stages = data.get("stages", [])
        if not isinstance(stages, list):
            stages = []

        risks_data = data.get("risks", [])
        risks = []

        if isinstance(risks_data, list):
            for risk_idx, risk_data in enumerate(risks_data):
                if isinstance(risk_data, dict):
                    risk_type = risk_data.get("type", "unknown")
                    stage = risk_data.get("stage", "")
                    description = risk_data.get("description", "")
                    severity_str = risk_data.get("severity", "medium").lower()

                    try:
                        severity = Severity(severity_str)
                    except ValueError:
                        severity = Severity.MEDIUM

                    risks.append(PipelineRisk(
                        risk_type=risk_type,
                        stage=stage,
                        description=description,
                        severity=severity,
                    ))

        return Pipeline(
            name=name,
            description=description,
            stages=stages,
            risks=risks,
        )


class EventParser:
    """事件日志解析器。"""

    def __init__(self):
        self.jsonl_parser = JSONLParser()

    def parse(self, file_path: Union[str, Path]) -> List[Event]:
        """解析 events.jsonl 文件。"""
        entries = self.jsonl_parser.parse(file_path)

        events = []
        for idx, entry in enumerate(entries):
            if not isinstance(entry, dict):
                raise ParseError(
                    f"第 {idx + 1} 行不是有效的 JSON 对象",
                    str(file_path),
                    idx + 1,
                )

            event = self._parse_event(entry, idx, str(file_path))
            events.append(event)

        return events

    def _parse_event(self, data: Dict, index: int, file_path: str) -> Event:
        """解析单个事件。"""
        timestamp_str = data.get("timestamp")
        if timestamp_str:
            try:
                if isinstance(timestamp_str, str):
                    timestamp = datetime.fromisoformat(timestamp_str)
                else:
                    timestamp = datetime.now()
            except (ValueError, TypeError):
                timestamp = datetime.now()
        else:
            timestamp = datetime.now()

        event_type = data.get("type", "unknown")
        level = data.get("level", "info")
        message = data.get("message", "")
        context = data.get("context", {})

        if not isinstance(context, dict):
            context = {}

        return Event(
            timestamp=timestamp,
            event_type=event_type,
            level=level,
            message=message,
            context=context,
        )
