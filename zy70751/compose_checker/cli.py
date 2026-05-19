import json
import os
from typing import List, Optional
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
from rich.tree import Tree

from .models import CheckResult, ConflictType, ConflictSeverity, ServiceInfo
from .parser import ComposeParser
from .env_expander import EnvExpander
from .conflict_detector import ConflictDetector


console = Console()


def create_human_readable_report(result: CheckResult):
    console.print(Panel.fit(
        "[bold blue]Docker Compose 冲突预检报告[/bold blue]",
        border_style="blue"
    ))

    if result.errors:
        console.print("\n[bold red]错误:[/bold red]")
        for error in result.errors:
            console.print(f"  ❌ {error}")

    if result.warnings:
        console.print("\n[bold yellow]警告:[/bold yellow]")
        for warning in result.warnings:
            console.print(f"  ⚠️  {warning}")

    console.print(f"\n[bold]扫描到 {len(result.services)} 个服务[/bold]")

    if not result.conflicts:
        console.print("\n[bold green]✅ 未发现冲突[/bold green]")
        return

    console.print(f"\n[bold red]发现 {len(result.conflicts)} 个冲突:[/bold red]")

    for i, conflict in enumerate(result.conflicts, 1):
        severity_color = {
            ConflictSeverity.CRITICAL: "red",
            ConflictSeverity.HIGH: "dark_orange",
            ConflictSeverity.MEDIUM: "yellow",
            ConflictSeverity.LOW: "blue"
        }.get(conflict.severity, "white")

        type_icon = {
            ConflictType.PORT: "🔌",
            ConflictType.SERVICE_NAME: "🏷️",
            ConflictType.ENV_VAR: "🔧"
        }.get(conflict.conflict_type, "❓")

        console.print(f"\n[bold {severity_color}]{i}. {type_icon} {conflict.message}[/bold {severity_color}]")

        console.print("  冲突来源:")
        for source in conflict.sources:
            console.print(f"    • [cyan]{source.service_name}[/cyan] ({source.compose_file})")
            console.print(f"      {source.details}")

        if conflict.suggestion:
            console.print(f"  [green]建议:[/green] {conflict.suggestion}")

    console.print("\n" + "=" * 60)


def create_machine_readable_output(result: CheckResult) -> str:
    output = {
        "summary": {
            "total_services": len(result.services),
            "total_conflicts": len(result.conflicts),
            "total_errors": len(result.errors),
            "total_warnings": len(result.warnings),
            "has_conflicts": result.has_conflicts(),
            "exit_code": result.get_exit_code()
        },
        "errors": result.errors,
        "warnings": result.warnings,
        "services": [],
        "conflicts": []
    }

    for service in result.services:
        service_data = {
            "name": service.name,
            "compose_file": service.compose_file,
            "ports": [
                {
                    "host_ip": p.host_ip,
                    "host_port": p.host_port,
                    "container_port": p.container_port,
                    "protocol": p.protocol
                }
                for p in service.ports
            ],
            "environment": service.environment
        }
        output["services"].append(service_data)

    for conflict in result.conflicts:
        conflict_data = {
            "type": conflict.conflict_type.value,
            "severity": conflict.severity.value,
            "message": conflict.message,
            "priority": conflict.priority,
            "suggestion": conflict.suggestion,
            "sources": [
                {
                    "service_name": s.service_name,
                    "compose_file": s.compose_file,
                    "details": s.details
                }
                for s in conflict.sources
            ]
        }
        output["conflicts"].append(conflict_data)

    return json.dumps(output, ensure_ascii=False, indent=2)


def run_check(file_paths: List[str], extra_env: Optional[dict] = None) -> CheckResult:
    result = CheckResult()

    parser = ComposeParser()
    services, errors, warnings = parser.parse_multiple_files(file_paths)

    result.errors.extend(errors)
    result.warnings.extend(warnings)

    if not services:
        return result

    expander = EnvExpander()
    expanded_services, expand_warnings = expander.expand_all_services(services, extra_env)
    result.warnings.extend(expand_warnings)

    result.services = expanded_services

    detector = ConflictDetector()
    conflicts = detector.detect_all(expanded_services)
    result.conflicts = conflicts

    return result


@click.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--json', '-j', 'output_json', is_flag=True, help='输出JSON格式（机器可读）')
@click.option('--env', '-e', multiple=True, help='额外的环境变量，格式: KEY=VALUE')
@click.option('--no-exit-code', is_flag=True, help='不根据冲突设置退出码')
def main(files, output_json, env, no_exit_code):
    if not files:
        click.echo("请指定至少一个Compose文件路径")
        ctx = click.get_current_context()
        ctx.exit(1)

    extra_env = {}
    for e in env:
        if '=' in e:
            key, value = e.split('=', 1)
            extra_env[key] = value

    result = run_check(list(files), extra_env)

    if output_json:
        click.echo(create_machine_readable_output(result))
    else:
        create_human_readable_report(result)

    if not no_exit_code:
        exit(result.get_exit_code())


if __name__ == '__main__':
    main()
