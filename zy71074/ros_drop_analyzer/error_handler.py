import os
import json
import logging
from datetime import datetime
from typing import List, Dict, Any

from rich.console import Console
from rich.table import Table

from .types import ExitCode


class ErrorRecord:
    def __init__(
        self,
        error_type: str,
        message: str,
        line_number: int = None,
        file_path: str = None,
        raw_content: str = None,
        timestamp: float = None,
    ):
        self.error_type = error_type
        self.message = message
        self.line_number = line_number
        self.file_path = file_path
        self.raw_content = raw_content
        self.timestamp = timestamp
        self.created_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.error_type,
            "message": self.message,
            "line_number": self.line_number,
            "file_path": self.file_path,
            "raw_content": self.raw_content,
            "timestamp": self.timestamp,
            "created_at": self.created_at.isoformat(),
        }


class ErrorHandler:
    def __init__(self, output_dir: str, verbose: bool = False):
        self.output_dir = output_dir
        self.verbose = verbose
        self.errors: List[ErrorRecord] = []
        self.warnings: List[ErrorRecord] = []
        self.console = Console()
        self._setup_logger()

    def _setup_logger(self):
        os.makedirs(self.output_dir, exist_ok=True)
        log_file = os.path.join(self.output_dir, "analysis_errors.log")

        logging.basicConfig(
            level=logging.DEBUG if self.verbose else logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
            ],
        )
        self.logger = logging.getLogger("ros_drop_analyzer")

    def add_error(
        self,
        error_type: str,
        message: str,
        line_number: int = None,
        file_path: str = None,
        raw_content: str = None,
        timestamp: float = None,
    ):
        error = ErrorRecord(
            error_type=error_type,
            message=message,
            line_number=line_number,
            file_path=file_path,
            raw_content=raw_content,
            timestamp=timestamp,
        )
        self.errors.append(error)
        self.logger.error(f"{error_type}: {message}")

        if self.verbose:
            line_info = f" (第 {line_number} 行)" if line_number else ""
            self.console.print(f"[red]✗ 错误{line_info}: {message}[/red]")

    def add_warning(
        self,
        warning_type: str,
        message: str,
        line_number: int = None,
        file_path: str = None,
        raw_content: str = None,
        timestamp: float = None,
    ):
        warning = ErrorRecord(
            error_type=warning_type,
            message=message,
            line_number=line_number,
            file_path=file_path,
            raw_content=raw_content,
            timestamp=timestamp,
        )
        self.warnings.append(warning)
        self.logger.warning(f"{warning_type}: {message}")

    def export_error_report(self) -> str:
        if not self.errors and not self.warnings:
            return ""

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"error_report_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)

        report = {
            "export_time": datetime.now().isoformat(),
            "total_errors": len(self.errors),
            "total_warnings": len(self.warnings),
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        return filepath

    def print_summary(self):
        if not self.errors and not self.warnings:
            return

        if self.errors:
            title = f"❌ 发现 {len(self.errors)} 个错误"
            table = Table(title=title, show_lines=True, style="red")
            table.add_column("#", style="dim", justify="right")
            table.add_column("类型", style="magenta")
            table.add_column("行号", justify="right")
            table.add_column("消息", style="white")

            for i, error in enumerate(self.errors[:10], 1):
                table.add_row(
                    str(i),
                    error.error_type,
                    str(error.line_number or "-"),
                    error.message[:60] + "..." if len(error.message) > 60 else error.message,
                )

            if len(self.errors) > 10:
                table.add_row("...", "...", "...", f"... 还有 {len(self.errors) - 10} 个错误")

            self.console.print(table)

        if self.warnings:
            title = f"⚠️  发现 {len(self.warnings)} 个警告"
            table = Table(title=title, show_lines=True, style="yellow")
            table.add_column("#", style="dim", justify="right")
            table.add_column("类型", style="magenta")
            table.add_column("行号", justify="right")
            table.add_column("消息", style="white")

            for i, warning in enumerate(self.warnings[:10], 1):
                table.add_row(
                    str(i),
                    warning.error_type,
                    str(warning.line_number or "-"),
                    warning.message[:60] + "..." if len(warning.message) > 60 else warning.message,
                )

            if len(self.warnings) > 10:
                table.add_row("...", "...", "...", f"... 还有 {len(self.warnings) - 10} 个警告")

            self.console.print(table)

    def get_exit_code(self) -> ExitCode:
        if self.errors:
            error_types = set(e.error_type for e in self.errors)
            if "BAG_READ_ERROR" in error_types:
                return ExitCode.BAG_READ_ERROR
            if "ANALYSIS_ERROR" in error_types:
                return ExitCode.ANALYSIS_ERROR
            if "EXPORT_ERROR" in error_types:
                return ExitCode.EXPORT_ERROR
            return ExitCode.INVALID_INPUT
        return ExitCode.SUCCESS

    def has_errors(self) -> bool:
        return len(self.errors) > 0

    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
