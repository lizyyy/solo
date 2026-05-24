import os
import sys
import tempfile
from pathlib import Path
from typing import Optional

import click
from rich.console import Console

from .inventory_parser import InventoryParser
from .cmdb_parser import CMDBParser, LabelNormalizer
from .drift_detector import DriftDetector
from .report_generator import ReportGenerator
from .__version__ import __version__

console = Console()


class ExitCode:
    SUCCESS = 0
    DRIFT_FOUND = 1
    CRITICAL_DRIFT = 2
    INPUT_ERROR = 3
    INTERNAL_ERROR = 4
    SELFTEST_FAILED = 5


def validate_file_path(ctx, param, value):
    if value is None:
        return value
    path = Path(value)
    if not path.exists():
        raise click.BadParameter(f"文件不存在: {value}")
    if not path.is_file() and not path.is_dir():
        raise click.BadParameter(f"不是有效的文件或目录: {value}")
    return value


def validate_output_dir(ctx, param, value):
    path = Path(value)
    try:
        path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise click.BadParameter(f"无法创建输出目录: {e}")
    return value


@click.group()
@click.version_option(__version__, "-v", "--version")
def main():
    """Ansible Inventory 漂移检测 CLI

    检测 Ansible Inventory 与 CMDB 之间的配置差异，包括主机名、角色、环境标签等。
    """
    pass


@main.command()
@click.argument("inventory", type=click.Path(), callback=validate_file_path)
@click.option("--cmdb", "-c", type=click.Path(), callback=validate_file_path, help="CMDB 导出文件路径 (JSON/YAML/CSV)")
@click.option("--output", "-o", type=click.Path(), default="./drift_reports", callback=validate_output_dir, help="报告输出目录")
@click.option("--format", "-f", "cmdb_format", type=click.Choice(["json", "yaml", "csv"]), help="CMDB 文件格式 (自动检测)")
@click.option("--config", type=click.Path(), callback=validate_file_path, help="自定义配置文件路径")
@click.option("--quiet", "-q", is_flag=True, help="安静模式，只输出错误")
@click.option("--no-markdown", is_flag=True, help="不生成 Markdown 报告")
@click.option("--no-json", is_flag=True, help="不生成 JSON 报告")
def detect(inventory, cmdb, output, cmdb_format, config, quiet, no_markdown, no_json):
    """执行漂移检测

    INVENTORY: Ansible Inventory 文件或目录路径
    """
    try:
        custom_mappings = None
        if config:
            import yaml
            with open(config, "r", encoding="utf-8") as f:
                custom_config = yaml.safe_load(f)
            if isinstance(custom_config, dict):
                custom_mappings = custom_config.get("mappings")

        normalizer = LabelNormalizer(custom_mappings)

        if not quiet:
            console.print(f"[cyan]📂 解析 Inventory:[/cyan] {inventory}")
        inventory_parser = InventoryParser()
        parsed_inventory = inventory_parser.parse(inventory)
        if not quiet:
            console.print(f"[green]✓ 解析完成，共 {len(parsed_inventory.hosts)} 台主机[/green]")

        cmdb_hosts = {}
        if cmdb:
            if not quiet:
                console.print(f"[cyan]📂 解析 CMDB:[/cyan] {cmdb}")
            cmdb_parser = CMDBParser(normalizer)
            cmdb_hosts = cmdb_parser.parse(cmdb, cmdb_format)
            if not quiet:
                console.print(f"[green]✓ 解析完成，共 {len(cmdb_hosts)} 台主机[/green]")

        if not quiet:
            console.print("[cyan]🔍 检测漂移...[/cyan]")
        detector = DriftDetector(normalizer)
        report = detector.detect(parsed_inventory, cmdb_hosts, inventory, cmdb)

        generator = ReportGenerator(output_dir=output)

        if not quiet:
            generator.print_console_summary(report)

        base_filename = f"drift_report_{report.generated_at.strftime('%Y%m%d_%H%M%S')}"
        if not no_json:
            generator.write_json(report, f"{base_filename}.json")
        if not no_markdown:
            generator.write_markdown(report, f"{base_filename}.md")

        exit_code = generator.get_exit_code(report)
        sys.exit(exit_code)

    except FileNotFoundError as e:
        console.print(f"[red]✗ 输入错误: {e}[/red]")
        sys.exit(ExitCode.INPUT_ERROR)
    except ValueError as e:
        console.print(f"[red]✗ 数据格式错误: {e}[/red]")
        sys.exit(ExitCode.INPUT_ERROR)
    except Exception as e:
        console.print(f"[red]✗ 内部错误: {e}[/red]")
        import traceback
        if not quiet:
            traceback.print_exc()
        sys.exit(ExitCode.INTERNAL_ERROR)


@main.command()
@click.option("--output", "-o", type=click.Path(), default="./drift_reports", callback=validate_output_dir, help="测试报告输出目录")
def selftest(output):
    """运行自检测试

    生成样例数据并执行完整检测流程，验证工具功能完整性。
    """
    console.print("[bold cyan]🧪 运行自检测试...[/bold cyan]")
    console.print()

    test_passed = 0
    test_total = 0

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir_path = Path(tmpdir)

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试 Inventory 解析...", end=" ")
            test_inventory = _create_test_inventory(tmpdir_path)
            inventory_parser = InventoryParser()
            parsed = inventory_parser.parse(str(test_inventory))
            if len(parsed.hosts) >= 5:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")
                console.print(f"  预期至少 5 台主机，实际 {len(parsed.hosts)} 台")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试别名主机解析...", end=" ")
            web01 = parsed.hosts.get("web01-prod")
            if web01 and "192.168.1.10" in web01.aliases:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试组继承...", end=" ")
            if "web" in web01.groups and "production" in web01.groups:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")
                console.print(f"  组列表: {web01.groups}")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试退役机器检测...", end=" ")
            deprecated = parsed.hosts.get("old-server-deprecated")
            if deprecated and deprecated.is_decommissioned:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试 CMDB 解析...", end=" ")
            test_cmdb = _create_test_cmdb(tmpdir_path)
            cmdb_parser = CMDBParser()
            cmdb_hosts = cmdb_parser.parse(str(test_cmdb))
            if len(cmdb_hosts) >= 4:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试标签归一化...", end=" ")
            normalizer = LabelNormalizer()
            if normalizer.normalize_role("www") == "web" and normalizer.normalize_environment("prod") == "production":
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试漂移检测...", end=" ")
            detector = DriftDetector(normalizer)
            report = detector.detect(parsed, cmdb_hosts, str(test_inventory), str(test_cmdb))
            if len(report.drift_items) > 0:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试风险分级...", end=" ")
            if report.risk_summary:
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试报告生成...", end=" ")
            generator = ReportGenerator(output_dir=output)
            json_path = generator.write_json(report, "selftest_report.json")
            md_path = generator.write_markdown(report, "selftest_report.md")
            if json_path.exists() and md_path.exists():
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

            test_total += 1
            console.print(f"[{test_total}/{test_total}] 测试边界情况 - 别名冲突检测...", end=" ")
            conflict_inventory = _create_conflict_inventory(tmpdir_path)
            conflict_parsed = inventory_parser.parse(str(conflict_inventory))
            conflict_report = detector.detect(conflict_parsed, {}, str(conflict_inventory), None)
            from .models import DriftType
            if any(item.drift_type == DriftType.ALIAS_CONFLICT for item in conflict_report.drift_items):
                console.print("[green]✓ 通过[/green]")
                test_passed += 1
            else:
                console.print("[red]✗ 失败[/red]")

        console.print()
        console.print(f"[bold]测试结果: {test_passed}/{test_total} 通过[/bold]")

        if test_passed == test_total:
            console.print()
            console.print("[bold green]✅ 所有自检测试通过！工具工作正常。[/bold green]")
            console.print()
            console.print("样例文件已生成，可查看报告验证输出格式。")
            sys.exit(ExitCode.SUCCESS)
        else:
            console.print()
            console.print(f"[bold red]❌ {test_total - test_passed} 项测试未通过[/bold red]")
            sys.exit(ExitCode.SELFTEST_FAILED)

    except Exception as e:
        console.print(f"[red]✗ 自检过程出错: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(ExitCode.SELFTEST_FAILED)


@main.command("parse-inv")
@click.argument("inventory", type=click.Path(), callback=validate_file_path)
@click.option("--detail", "-d", is_flag=True, help="显示详细信息")
def parse_inventory(inventory, detail):
    """仅解析并显示 Inventory 内容（用于调试）"""
    try:
        parser = InventoryParser()
        parsed = parser.parse(inventory)

        console.print(f"[cyan]Inventory 解析结果:[/cyan]")
        console.print(f"  主机数量: {len(parsed.hosts)}")
        console.print(f"  组数量: {len(parsed.groups)}")
        console.print()

        for host_name, host in parsed.hosts.items():
            status = "[red](已退役)[/red]" if host.is_decommissioned else ""
            console.print(f"[bold]{host_name}[/bold] {status}")
            if detail:
                console.print(f"  组: {', '.join(host.groups) if host.groups else '无'}")
                console.print(f"  角色: {', '.join(host.roles) if host.roles else '无'}")
                console.print(f"  环境: {host.environment or '未设置'}")
                console.print(f"  别名: {', '.join(host.aliases) if host.aliases else '无'}")
                if host.labels:
                    console.print(f"  标签:")
                    for k, v in list(host.labels.items())[:5]:
                        console.print(f"    {k}: {v}")
            console.print()

    except Exception as e:
        console.print(f"[red]✗ 解析错误: {e}[/red]")
        sys.exit(ExitCode.INPUT_ERROR)


def _create_test_inventory(tmpdir: Path) -> Path:
    content = """[production:children]
web
database

[production:vars]
env=production
region=cn-north-1

[web:vars]
role=web

[web]
web01-prod ansible_host=192.168.1.10
web02-prod ansible_host=192.168.1.11 role=web,nginx

[database:vars]
role=database

[database]
db01-prod ansible_host=192.168.1.20 env=prod

[staging]
app01-stg ansible_host=192.168.2.10 environment=staging role=app

[deprecated]
old-server-deprecated ansible_host=10.0.0.99
"""
    path = tmpdir / "test_inventory.ini"
    path.write_text(content, encoding="utf-8")
    return path


def _create_test_cmdb(tmpdir: Path) -> Path:
    import json
    data = [
        {
            "hostname": "web01-prod",
            "ip": "192.168.1.10",
            "role": "www",
            "environment": "prod",
            "status": "active"
        },
        {
            "hostname": "web02-prod",
            "ip": "192.168.1.11",
            "role": "database",
            "environment": "staging",
            "status": "active"
        },
        {
            "hostname": "db01-prod",
            "ip": "192.168.1.20",
            "role": "db",
            "environment": "production",
            "status": "active"
        },
        {
            "hostname": "new-server-01",
            "ip": "192.168.1.30",
            "role": "cache",
            "environment": "prod",
            "status": "active"
        }
    ]
    path = tmpdir / "test_cmdb.json"
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return path


def _create_conflict_inventory(tmpdir: Path) -> Path:
    content = """[conflict]
host-a ansible_host=192.168.1.100
host-b ansible_host=192.168.1.100
"""
    path = tmpdir / "conflict_inventory.ini"
    path.write_text(content, encoding="utf-8")
    return path


if __name__ == "__main__":
    main()
