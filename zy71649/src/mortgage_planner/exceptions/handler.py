"""异常处理器和格式化工具"""

from typing import List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .base import MortgageException, ErrorCategory, ErrorSeverity


console = Console()


def format_error_message(exc: MortgageException) -> str:
    """格式化异常消息为控制台友好格式"""
    severity_icon = exc.severity_icon
    category_label = exc.category.label
    message = exc.message

    ctx = exc.context
    parts = [f"{severity_icon} [{exc.category.color}]{category_label}[/{exc.category.color}]: {message}"]

    if ctx.field:
        parts.append(f"   📍 字段: {ctx.field}")
    if ctx.value is not None:
        parts.append(f"   📝 当前值: {ctx.value}")
    if ctx.expected:
        parts.append(f"   ✅ 期望: {ctx.expected}")
    if ctx.source:
        parts.append(f"   📂 来源: {ctx.source}")
    if ctx.contract_no:
        parts.append(f"   📄 合同: {ctx.contract_no}")
    if ctx.customer_id:
        parts.append(f"   👤 客户: {ctx.customer_id}")

    if ctx.suggestions:
        parts.append("   💡 建议:")
        for i, suggestion in enumerate(ctx.suggestions, 1):
            parts.append(f"      {i}. {suggestion}")

    parts.append(f"   🔍 错误编号: {ctx.id}")

    return "\n".join(parts)


class ExceptionHandler:
    """异常处理器"""
    def __init__(self, raise_on_error: bool = False):
        self.raise_on_error = raise_on_error
        self.errors: List[MortgageException] = []
        self.warnings: List[MortgageException] = []
        self.infos: List[MortgageException] = []

    def handle(self, exc: MortgageException) -> None:
        """处理异常"""
        if exc.severity in [ErrorSeverity.ERROR, ErrorSeverity.CRITICAL]:
            self.errors.append(exc)
            if self.raise_on_error:
                raise exc
        elif exc.severity == ErrorSeverity.WARNING:
            self.warnings.append(exc)
        else:
            self.infos.append(exc)

    def handle_exception(self, exc: Exception) -> MortgageException:
        """处理通用异常，包装为MortgageException"""
        if isinstance(exc, MortgageException):
            self.handle(exc)
            return exc

        wrapped = MortgageException(
            message=str(exc),
            category=ErrorCategory.SYSTEM_ERROR,
            severity=ErrorSeverity.ERROR,
        )
        self.handle(wrapped)
        return wrapped

    def print_summary(self) -> None:
        """打印异常摘要"""
        if not self.has_issues:
            console.print("[green]✅ 无异常[/green]")
            return

        table = Table(title="异常汇总", show_header=True, header_style="bold")
        table.add_column("类型", style="cyan")
        table.add_column("数量", justify="right")
        table.add_column("状态", style="magenta")

        if self.errors:
            table.add_row(
                "❌ 错误",
                str(len(self.errors)),
                "[red]需修复[/red]",
            )
        if self.warnings:
            table.add_row(
                "⚠️ 警告",
                str(len(self.warnings)),
                "[yellow]建议处理[/yellow]",
            )
        if self.infos:
            table.add_row(
                "ℹ️ 提示",
                str(len(self.infos)),
                "[blue]可忽略[/blue]",
            )

        console.print(table)

        if self.errors:
            console.print("\n[red]❌ 错误详情:[/red]")
            for i, exc in enumerate(self.errors[:5], 1):
                console.print(f"\n{i}. {format_error_message(exc)}")
            if len(self.errors) > 5:
                console.print(f"\n... 还有 {len(self.errors) - 5} 个错误未显示")

        if self.warnings:
            console.print("\n[yellow]⚠️ 警告详情:[/yellow]")
            for i, exc in enumerate(self.warnings[:3], 1):
                console.print(f"\n{i}. {format_error_message(exc)}")
            if len(self.warnings) > 3:
                console.print(f"\n... 还有 {len(self.warnings) - 3} 个警告未显示")

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    @property
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0

    @property
    def has_issues(self) -> bool:
        return self.has_errors or self.has_warnings or len(self.infos) > 0

    @property
    def issue_count(self) -> int:
        return len(self.errors) + len(self.warnings) + len(self.infos)

    def get_errors_by_category(self, category: ErrorCategory) -> List[MortgageException]:
        """按分类获取异常"""
        all_issues = self.errors + self.warnings + self.infos
        return [e for e in all_issues if e.category == category]

    def print_by_category(self) -> None:
        """按分类打印异常"""
        if not self.has_issues:
            return

        console.print("\n📊 [bold]按问题类型分类:[/bold]")

        for category in ErrorCategory:
            issues = self.get_errors_by_category(category)
            if issues:
                console.print(f"\n{category.label} ({len(issues)}个):")
                console.print(f"   {category.description}")
                for exc in issues[:3]:
                    console.print(f"   • {exc.severity_icon} {exc.message}")
                if len(issues) > 3:
                    console.print(f"   ... 还有 {len(issues) - 3} 个")

    def clear(self) -> None:
        """清空所有异常记录"""
        self.errors.clear()
        self.warnings.clear()
        self.infos.clear()
