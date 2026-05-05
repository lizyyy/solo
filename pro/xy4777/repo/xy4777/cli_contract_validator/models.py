"""数据模型定义"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from datetime import datetime


class ValidationStatus(Enum):
    """验证状态"""
    PASS = "pass"
    FAIL = "fail"
    SKIP = "skip"
    ERROR = "error"


@dataclass
class ParameterRule:
    """参数规则"""
    name: str
    required: bool = False
    type: str = "string"  # string, integer, float, boolean, file
    default: Optional[Any] = None
    choices: Optional[List[Any]] = None
    mutually_exclusive_with: List[str] = field(default_factory=list)
    depends_on: List[str] = field(default_factory=list)
    description: Optional[str] = None


@dataclass
class OutputExpectation:
    """输出期望"""
    stdout_contains: List[str] = field(default_factory=list)
    stdout_not_contains: List[str] = field(default_factory=list)
    stderr_contains: List[str] = field(default_factory=list)
    stderr_not_contains: List[str] = field(default_factory=list)
    exit_code: int = 0
    timeout: int = 30


@dataclass
class TestCase:
    """测试用例"""
    name: str
    command: str
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    input_files: Dict[str, str] = field(default_factory=dict)
    expected: OutputExpectation = field(default_factory=OutputExpectation)
    description: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class Subcommand:
    """子命令定义"""
    name: str
    description: Optional[str] = None
    parameters: List[ParameterRule] = field(default_factory=list)
    test_cases: List[TestCase] = field(default_factory=list)


@dataclass
class Contract:
    """契约定义"""
    name: str
    version: str
    tool_path: str
    description: Optional[str] = None
    subcommands: List[Subcommand] = field(default_factory=list)
    global_env: Dict[str, str] = field(default_factory=dict)


@dataclass
class TestResult:
    """测试结果"""
    contract_name: str
    subcommand_name: str
    test_case_name: str
    status: ValidationStatus
    command: str
    actual_exit_code: int
    actual_stdout: str
    actual_stderr: str
    expected_exit_code: int
    duration_seconds: float
    timestamp: datetime
    failures: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class ValidationMatrix:
    """验证矩阵"""
    contract_name: str
    contract_version: str
    generated_at: datetime
    total_tests: int = 0
    passed_tests: int = 0
    failed_tests: int = 0
    skipped_tests: int = 0
    error_tests: int = 0
    results: List[TestResult] = field(default_factory=list)
