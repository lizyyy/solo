"""命令执行器 - 批量执行测试用例，捕获输出和返回码"""

import os
import shlex
import subprocess
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .models import (
    Contract,
    OutputExpectation,
    Subcommand,
    TestCase,
    TestResult,
    ValidationMatrix,
    ValidationStatus,
)


class ExecutionError(Exception):
    """执行错误"""
    pass


class CommandExecutor:
    """命令执行器"""

    def __init__(self, contract: Contract):
        self.contract = contract
        self.tool_path = Path(contract.tool_path)
        if not self.tool_path.exists():
            raise ExecutionError(f"工具路径不存在: {contract.tool_path}")

    def run_all(self, tags: Optional[List[str]] = None) -> ValidationMatrix:
        """运行所有测试用例

        Args:
            tags: 可选的标签过滤列表

        Returns:
            验证矩阵
        """
        matrix = ValidationMatrix(
            contract_name=self.contract.name,
            contract_version=self.contract.version,
            generated_at=datetime.now(),
        )

        for subcommand in self.contract.subcommands:
            for test_case in subcommand.test_cases:
                if tags and not any(tag in test_case.tags for tag in tags):
                    continue

                result = self.run_test_case(subcommand, test_case)
                matrix.results.append(result)

                matrix.total_tests += 1
                if result.status == ValidationStatus.PASS:
                    matrix.passed_tests += 1
                elif result.status == ValidationStatus.FAIL:
                    matrix.failed_tests += 1
                elif result.status == ValidationStatus.SKIP:
                    matrix.skipped_tests += 1
                elif result.status == ValidationStatus.ERROR:
                    matrix.error_tests += 1

        return matrix

    def run_test_case(self, subcommand: Subcommand, test_case: TestCase) -> TestResult:
        """运行单个测试用例

        Args:
            subcommand: 子命令定义
            test_case: 测试用例

        Returns:
            测试结果
        """
        start_time = time.time()
        failures: List[str] = []

        env = dict(os.environ)
        env.update(self.contract.global_env)
        env.update(test_case.env)

        command_parts = [str(self.tool_path)]
        command_parts.extend(shlex.split(test_case.command))
        command_parts.extend(test_case.args)
        full_command = " ".join(command_parts)

        actual_stdout = ""
        actual_stderr = ""
        actual_exit_code = -1

        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                self._prepare_input_files(test_case.input_files, temp_path)

                cwd = temp_dir if test_case.input_files else None

                process = subprocess.run(
                    command_parts,
                    capture_output=True,
                    text=True,
                    timeout=test_case.expected.timeout,
                    env=env,
                    cwd=cwd,
                )

                actual_stdout = process.stdout
                actual_stderr = process.stderr
                actual_exit_code = process.returncode

        except subprocess.TimeoutExpired:
            return TestResult(
                contract_name=self.contract.name,
                subcommand_name=subcommand.name,
                test_case_name=test_case.name,
                status=ValidationStatus.ERROR,
                command=full_command,
                actual_exit_code=-1,
                actual_stdout="",
                actual_stderr=f"命令执行超时 (timeout={test_case.expected.timeout}秒)",
                expected_exit_code=test_case.expected.exit_code,
                duration_seconds=time.time() - start_time,
                timestamp=datetime.now(),
                failures=[f"执行超时: {test_case.expected.timeout}秒"],
                tags=test_case.tags,
            )

        except FileNotFoundError as e:
            return TestResult(
                contract_name=self.contract.name,
                subcommand_name=subcommand.name,
                test_case_name=test_case.name,
                status=ValidationStatus.ERROR,
                command=full_command,
                actual_exit_code=-1,
                actual_stdout="",
                actual_stderr=f"文件未找到: {e}",
                expected_exit_code=test_case.expected.exit_code,
                duration_seconds=time.time() - start_time,
                timestamp=datetime.now(),
                failures=[f"文件未找到: {e}"],
                tags=test_case.tags,
            )

        except Exception as e:
            return TestResult(
                contract_name=self.contract.name,
                subcommand_name=subcommand.name,
                test_case_name=test_case.name,
                status=ValidationStatus.ERROR,
                command=full_command,
                actual_exit_code=-1,
                actual_stdout="",
                actual_stderr=str(e),
                expected_exit_code=test_case.expected.exit_code,
                duration_seconds=time.time() - start_time,
                timestamp=datetime.now(),
                failures=[f"执行异常: {e}"],
                tags=test_case.tags,
            )

        failures.extend(self._validate_output(
            actual_exit_code,
            actual_stdout,
            actual_stderr,
            test_case.expected,
        ))

        status = ValidationStatus.PASS if not failures else ValidationStatus.FAIL

        return TestResult(
            contract_name=self.contract.name,
            subcommand_name=subcommand.name,
            test_case_name=test_case.name,
            status=status,
            command=full_command,
            actual_exit_code=actual_exit_code,
            actual_stdout=actual_stdout,
            actual_stderr=actual_stderr,
            expected_exit_code=test_case.expected.exit_code,
            duration_seconds=time.time() - start_time,
            timestamp=datetime.now(),
            failures=failures,
            tags=test_case.tags,
        )

    def _prepare_input_files(self, input_files: Dict[str, str], temp_dir: Path) -> None:
        """准备输入文件到临时目录"""
        for filename, content in input_files.items():
            file_path = temp_dir / filename
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")

    def _validate_output(
        self,
        actual_exit_code: int,
        actual_stdout: str,
        actual_stderr: str,
        expected: OutputExpectation,
    ) -> List[str]:
        """验证输出是否符合期望"""
        failures: List[str] = []

        if actual_exit_code != expected.exit_code:
            failures.append(
                f"退出码不匹配: 期望 {expected.exit_code}, 实际 {actual_exit_code}"
            )

        for keyword in expected.stdout_contains:
            if keyword not in actual_stdout:
                failures.append(f"stdout 未包含期望关键字: '{keyword}'")

        for keyword in expected.stdout_not_contains:
            if keyword in actual_stdout:
                failures.append(f"stdout 包含不应出现的关键字: '{keyword}'")

        for keyword in expected.stderr_contains:
            if keyword not in actual_stderr:
                failures.append(f"stderr 未包含期望关键字: '{keyword}'")

        for keyword in expected.stderr_not_contains:
            if keyword in actual_stderr:
                failures.append(f"stderr 包含不应出现的关键字: '{keyword}'")

        return failures
