import json
from datetime import datetime
from typing import List
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from .models import (
    OrchestrationReport,
    ValidationError,
    ServiceStatus
)


class Reporter:
    def __init__(self, report: OrchestrationReport):
        self.report = report
        self.console = Console()
    
    def print_validation_errors(self) -> None:
        if not self.report.validation_errors:
            return
        
        table = Table(title="Validation Errors", show_header=True, header_style="bold red")
        table.add_column("Line", style="dim", width=6)
        table.add_column("Field", style="cyan")
        table.add_column("Error Message", style="red")
        table.add_column("Raw Value", style="yellow")
        
        for error in self.report.validation_errors:
            line = str(error.line) if error.line else "N/A"
            field = error.field or "N/A"
            raw = str(error.raw_value) if error.raw_value else "N/A"
            table.add_row(line, field, error.message, raw)
        
        self.console.print(table)
    
    def print_circular_dependencies(self) -> None:
        if not self.report.circular_dependencies:
            return
        
        self.console.print(Panel(
            "\n".join([f"  → {' → '.join(cycle + [cycle[0]])}" for cycle in self.report.circular_dependencies]),
            title="[bold red]Circular Dependencies Detected[/bold red]",
            border_style="red"
        ))
    
    def print_start_order(self) -> None:
        if not self.report.start_order:
            return
        
        levels = {}
        for i, name in enumerate(self.report.start_order):
            levels[name] = i
        
        table = Table(title="Startup Order", show_header=True, header_style="bold blue")
        table.add_column("Order", style="dim", width=6)
        table.add_column("Service Name", style="cyan")
        table.add_column("Status", style="bold")
        
        for i, name in enumerate(self.report.start_order):
            result = self.report.results.get(name)
            status = result.status.value if result else "N/A"
            status_color = "green" if status == "success" else "red" if status == "failed" else "yellow"
            table.add_row(str(i + 1), name, f"[{status_color}]{status}[/{status_color}]")
        
        self.console.print(table)
    
    def print_summary(self) -> None:
        total_time = f"{self.report.total_time:.2f}s" if self.report.total_time else "N/A"
        
        summary = Table(show_header=False, box=None)
        summary.add_column("Metric", style="bold")
        summary.add_column("Value", style="cyan")
        
        summary.add_row("Total Services", str(self.report.total_services))
        summary.add_row("Successful", f"[green]{self.report.successful}[/green]")
        summary.add_row("Failed", f"[red]{self.report.failed}[/red]")
        summary.add_row("Skipped", f"[yellow]{self.report.skipped}[/yellow]")
        summary.add_row("Total Time", total_time)
        
        self.console.print(Panel(summary, title="Orchestration Summary", border_style="blue"))
    
    def print_service_details(self) -> None:
        for name, result in self.report.results.items():
            status_color = "green" if result.status == ServiceStatus.SUCCESS else "red"
            
            details = []
            if result.port_check:
                port_status = "available" if result.port_check.is_available else "IN USE"
                port_color = "green" if result.port_check.is_available else "red"
                details.append(f"  Port {result.port_check.port}: [{port_color}]{port_status}[/{port_color}]")
            
            if result.health_check and result.health_check.success is not None:
                hc_status = "passed" if result.health_check.success else "FAILED"
                hc_color = "green" if result.health_check.success else "red"
                hc_time = f" ({result.health_check.response_time:.2f}s)" if result.health_check.response_time else ""
                details.append(f"  Health Check: [{hc_color}]{hc_status}[/{hc_color}]{hc_time}")
            
            if result.error:
                details.append(f"  [red]Error: {result.error}[/red]")
            
            if result.stderr:
                details.append(f"  Stderr: {result.stderr[:200]}")
            
            panel_content = "\n".join(details) if details else "No details available"
            self.console.print(Panel(
                panel_content,
                title=f"[bold {status_color}]{name} ({result.status.value})[/bold {status_color}]",
                border_style=status_color
            ))
    
    def print_terminal_summary(self) -> None:
        self.console.print("\n")
        self.print_validation_errors()
        self.print_circular_dependencies()
        self.print_summary()
        self.print_start_order()
        self.print_service_details()
        self.console.print("\n")
    
    def to_json(self, pretty: bool = True) -> str:
        data = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_services": self.report.total_services,
                "successful": self.report.successful,
                "failed": self.report.failed,
                "skipped": self.report.skipped,
                "total_time_seconds": self.report.total_time
            },
            "start_order": self.report.start_order,
            "results": {
                name: {
                    "status": result.status.value,
                    "start_order": result.start_order,
                    "error": result.error,
                    "exit_code": result.exit_code,
                    "port_check": {
                        "port": result.port_check.port,
                        "is_available": result.port_check.is_available,
                        "error": result.port_check.error
                    } if result.port_check else None,
                    "health_check": {
                        "success": result.health_check.success,
                        "status_code": result.health_check.status_code,
                        "response_time_seconds": result.health_check.response_time,
                        "error": result.health_check.error,
                        "output": result.health_check.output
                    } if result.health_check else None,
                    "start_time": result.start_time,
                    "end_time": result.end_time,
                    "duration_seconds": (result.end_time - result.start_time) if result.start_time and result.end_time else None
                }
                for name, result in self.report.results.items()
            },
            "validation_errors": [
                {
                    "line": e.line,
                    "field": e.field,
                    "message": e.message,
                    "raw_value": str(e.raw_value) if e.raw_value else None,
                    "error_type": e.error_type
                }
                for e in self.report.validation_errors
            ],
            "circular_dependencies": self.report.circular_dependencies
        }
        
        indent = 2 if pretty else None
        return json.dumps(data, indent=indent, ensure_ascii=False)
    
    def to_markdown(self, title: str = "Service Orchestration Report") -> str:
        lines = []
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**Generated at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        lines.append(f"| Total Services | {self.report.total_services} |")
        lines.append(f"| ✅ Successful | {self.report.successful} |")
        lines.append(f"| ❌ Failed | {self.report.failed} |")
        lines.append(f"| ⚠️ Skipped | {self.report.skipped} |")
        if self.report.total_time:
            lines.append(f"| Total Time | {self.report.total_time:.2f}s |")
        lines.append("")
        
        if self.report.validation_errors:
            lines.append("## ⚠️ Validation Errors")
            lines.append("")
            lines.append("| Line | Field | Message | Raw Value |")
            lines.append("|------|-------|---------|-----------|")
            for e in self.report.validation_errors:
                line = e.line or "N/A"
                field = e.field or "N/A"
                raw = str(e.raw_value) if e.raw_value else "N/A"
                lines.append(f"| {line} | {field} | {e.message} | {raw} |")
            lines.append("")
        
        if self.report.circular_dependencies:
            lines.append("## ❌ Circular Dependencies")
            lines.append("")
            for cycle in self.report.circular_dependencies:
                cycle_str = " → ".join(cycle + [cycle[0]])
                lines.append(f"- `{cycle_str}`")
            lines.append("")
        
        if self.report.start_order:
            lines.append("## Startup Order")
            lines.append("")
            for i, name in enumerate(self.report.start_order):
                result = self.report.results.get(name)
                status = result.status.value if result else "N/A"
                status_icon = "✅" if status == "success" else "❌" if status == "failed" else "⚠️"
                lines.append(f"{i + 1}. {status_icon} **{name}** ({status})")
            lines.append("")
        
        lines.append("## Service Details")
        lines.append("")
        
        for name, result in self.report.results.items():
            status_icon = "✅" if result.status == ServiceStatus.SUCCESS else "❌"
            lines.append(f"### {status_icon} {name}")
            lines.append("")
            lines.append(f"- **Status:** {result.status.value}")
            lines.append(f"- **Startup Order:** {result.start_order}")
            
            if result.start_time and result.end_time:
                duration = result.end_time - result.start_time
                lines.append(f"- **Duration:** {duration:.2f}s")
            
            if result.port_check:
                port_status = "Available" if result.port_check.is_available else "IN USE"
                lines.append(f"- **Port {result.port_check.port}:** {port_status}")
            
            if result.health_check:
                hc_status = "Passed" if result.health_check.success else "FAILED"
                lines.append(f"- **Health Check:** {hc_status}")
                if result.health_check.response_time:
                    lines.append(f"  - Response Time: {result.health_check.response_time:.2f}s")
                if result.health_check.error:
                    lines.append(f"  - Error: {result.health_check.error}")
            
            if result.error:
                lines.append(f"- **Error:** {result.error}")
            
            if result.stderr:
                lines.append("- **Stderr:**")
                lines.append("```")
                lines.append(result.stderr[:500])
                lines.append("```")
            
            lines.append("")
        
        return "\n".join(lines)
    
    def save_json(self, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.to_json())
    
    def save_markdown(self, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.to_markdown())
