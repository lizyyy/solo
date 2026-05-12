import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint

from .config import ConfigManager
from .checker import BidChecker
from .samples import SampleDataGenerator
from .models import CheckStatus, VersionInfo, MaterialItem

console = Console()


@click.group()
@click.version_option(package_name="bid-checker")
def main():
    """投标文件完整性检查CLI工具"""
    pass


@main.command()
@click.option('--name', '-n', default='投标项目', help='项目名称')
@click.option('--path', '-p', default='.', help='项目目录路径')
def init(name: str, path: str):
    """初始化投标项目目录"""
    project_dir = Path(path).absolute()

    if not project_dir.exists():
        project_dir.mkdir(parents=True, exist_ok=True)

    config_manager = ConfigManager(str(project_dir))

    if config_manager.is_initialized():
        console.print(Panel(
            "[yellow]项目已初始化，跳过...[/yellow]",
            title="状态",
            border_style="yellow"
        ))
        return

    config = config_manager.init_project(name)

    console.print(Panel(
        f"[green]项目初始化成功！[/green]\n"
        f"项目名称: {config['project_name']}\n"
        f"项目目录: {project_dir}\n"
        f"已配置 {len(config['requirements'])} 项必需材料检查",
        title="初始化完成",
        border_style="green"
    ))

    config_manager.add_history({
        "id": f"hist_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "timestamp": datetime.now().isoformat(),
        "operator": "system",
        "action": "init",
        "before": None,
        "after": {"initialized": True, "project_name": name},
        "comment": "初始化项目"
    })


@main.command(name='import')
@click.option('--path', '-p', default='.', help='项目目录路径')
@click.option('--operator', '-o', default='anonymous', help='操作者姓名')
@click.argument('import_type', type=click.Choice(['materials', 'versions', 'all']))
@click.argument('file_path', type=click.Path(exists=True))
def import_data(path: str, operator: str, import_type: str, file_path: str):
    """导入材料清单或版本说明"""
    project_dir = Path(path).absolute()
    config_manager = ConfigManager(str(project_dir))

    if not config_manager.is_initialized():
        console.print(Panel(
            "[red]项目未初始化，请先运行 'bid-checker init'[/red]",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)

    state = config_manager.get_state()
    data = json.loads(Path(file_path).read_text())

    before_state = {
        "materials_count": len(state.get("materials", [])),
        "versions_count": len(state.get("versions", []))
    }

    if import_type in ['materials', 'all']:
        if 'materials' in data:
            state['materials'] = data['materials']
            console.print(f"[green]已导入 {len(data['materials'])} 项材料[/green]")

    if import_type in ['versions', 'all']:
        if 'versions' in data:
            state['versions'] = data['versions']
            console.print(f"[green]已导入 {len(data['versions'])} 条版本记录[/green]")

    config_manager.save_state(state)

    after_state = {
        "materials_count": len(state.get("materials", [])),
        "versions_count": len(state.get("versions", []))
    }

    config_manager.add_history({
        "id": f"hist_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "timestamp": datetime.now().isoformat(),
        "operator": operator,
        "action": f"import_{import_type}",
        "before": before_state,
        "after": after_state,
        "comment": f"从 {file_path} 导入数据"
    })

    console.print(Panel(
        f"[green]数据导入成功！[/green]\n"
        f"操作者: {operator}\n"
        f"导入类型: {import_type}",
        title="导入完成",
        border_style="green"
    ))


@main.command()
@click.option('--path', '-p', default='.', help='项目目录路径')
@click.option('--operator', '-o', default='anonymous', help='操作者姓名')
@click.option('--force', '-f', is_flag=True, help='强制重新检查')
def check(path: str, operator: str, force: bool):
    """执行文件完整性检查"""
    project_dir = Path(path).absolute()
    config_manager = ConfigManager(str(project_dir))

    if not config_manager.is_initialized():
        console.print(Panel(
            "[red]项目未初始化，请先运行 'bid-checker init'[/red]",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)

    config = config_manager.get_config()
    state = config_manager.get_state()

    checker = BidChecker(str(project_dir), config)

    console.print(Panel(
        "[blue]正在扫描投标文件目录...[/blue]",
        title="开始检查",
        border_style="blue"
    ))

    materials = checker.discover_materials()
    versions = [VersionInfo(**v) for v in state.get('versions', [])]

    console.print(f"[cyan]发现 {len(materials)} 个文件[/cyan]")

    with console.status("[bold green]正在执行检查...[/bold green]"):
        check_results = checker.run_checks(materials, versions)

    state['materials'] = [m.model_dump() for m in materials]
    state['check_results'] = [r.model_dump() for r in check_results]
    state['last_check'] = datetime.now().isoformat()

    status_priority = [CheckStatus.BLOCKED, CheckStatus.FAILED, CheckStatus.WARNING, CheckStatus.PASSED]
    overall_status = CheckStatus.PASSED
    for status in status_priority:
        if any(r['status'] == status.value for r in state['check_results']):
            overall_status = status
            break
    state['status'] = overall_status.value

    config_manager.save_state(state)

    config_manager.add_history({
        "id": f"hist_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "timestamp": datetime.now().isoformat(),
        "operator": operator,
        "action": "check",
        "before": {"last_check": state.get('last_check')},
        "after": {
            "last_check": state['last_check'],
            "status": state['status'],
            "results_count": len(check_results)
        },
        "comment": "执行完整性检查"
    })

    _display_check_results(check_results)

    return 0 if overall_status in [CheckStatus.PASSED, CheckStatus.WARNING] else 1


@main.command()
@click.option('--path', '-p', default='.', help='项目目录路径')
@click.option('--type', '-t', type=click.Choice(['materials', 'history', 'versions', 'all']), default='all')
def detail(path: str, type: str):
    """查看详细信息"""
    project_dir = Path(path).absolute()
    config_manager = ConfigManager(str(project_dir))

    if not config_manager.is_initialized():
        console.print(Panel(
            "[red]项目未初始化，请先运行 'bid-checker init'[/red]",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)

    state = config_manager.get_state()
    config = config_manager.get_config()

    if type in ['materials', 'all']:
        _display_materials_detail(state, config)

    if type in ['versions', 'all']:
        _display_versions_detail(state)

    if type in ['history', 'all']:
        _display_history_detail(config_manager)


@main.command()
@click.option('--path', '-p', default='.', help='项目目录路径')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--format', '-f', type=click.Choice(['text', 'json']), default='text')
def report(path: str, output: Optional[str], format: str):
    """生成检查报告"""
    project_dir = Path(path).absolute()
    config_manager = ConfigManager(str(project_dir))

    if not config_manager.is_initialized():
        console.print(Panel(
            "[red]项目未初始化，请先运行 'bid-checker init'[/red]",
            title="错误",
            border_style="red"
        ))
        sys.exit(1)

    state = config_manager.get_state()
    config = config_manager.get_config()

    checker = BidChecker(str(project_dir), config)

    materials = [MaterialItem(**m) for m in state.get('materials', [])]
    check_results = [r for r in state.get('check_results', [])]

    report_summary = checker.generate_report(
        [type('R', (), r) for r in check_results],
        materials
    )

    if format == 'json':
        report_data = {
            "project": config.get('project_name', '投标项目'),
            "generated_at": datetime.now().isoformat(),
            "last_check": state.get('last_check'),
            "summary": report_summary.model_dump(),
            "materials": state.get('materials', []),
            "check_results": state.get('check_results', [])
        }
        content = json.dumps(report_data, ensure_ascii=False, indent=2)
    else:
        content = _generate_text_report(config, state, report_summary)

    if output:
        Path(output).write_text(content)
        console.print(Panel(
            f"[green]报告已保存到: {output}[/green]",
            title="报告生成",
            border_style="green"
        ))
    else:
        rprint(content)


@main.command()
@click.option('--output', '-o', default='samples', help='样例输出目录')
def samples(output: str):
    """生成演示样例数据"""
    output_dir = Path(output).absolute()
    generator = SampleDataGenerator(str(output_dir))

    console.print(Panel(
        f"[blue]正在生成样例数据到: {output_dir}[/blue]",
        title="生成样例",
        border_style="blue"
    ))

    paths = generator.create_all_samples()

    table = Table(title="已创建样例")
    table.add_column("场景", style="cyan")
    table.add_column("路径", style="magenta")
    table.add_column("说明", style="white")

    scenarios = {
        "passing": ("通过检查", "所有必需材料齐全，版本正确"),
        "missing": ("缺少材料", "缺少授权书和盖章页"),
        "old_version": ("旧版本文件", "目录中存在旧版报价单"),
        "amount_mismatch": ("金额不一致", "报价单与汇总表金额不同")
    }

    for key, path in paths.items():
        name, desc = scenarios.get(key, (key, "-"))
        table.add_row(name, path, desc)

    console.print(table)

    console.print(Panel(
        f"[green]样例数据生成完成！[/green]\n"
        f"下一步操作:\n"
        f"  1. cd {output_dir}/sample_passing\n"
        f"  2. bid-checker init -n '演示项目'\n"
        f"  3. bid-checker import versions version_info.json\n"
        f"  4. bid-checker check",
        title="下一步",
        border_style="green"
    ))


def _display_check_results(check_results):
    table = Table(title="检查结果", show_lines=True)
    table.add_column("状态", style="cyan", width=10)
    table.add_column("规则", style="magenta", width=20)
    table.add_column("消息", style="white")

    status_styles = {
        CheckStatus.PASSED: "[green]✓ 通过[/green]",
        CheckStatus.WARNING: "[yellow]⚠ 警告[/yellow]",
        CheckStatus.FAILED: "[red]✗ 失败[/red]",
        CheckStatus.BLOCKED: "[bold red]✗ 阻断[/bold red]",
    }

    for result in check_results:
        status_str = status_styles.get(result.status, str(result.status))
        table.add_row(status_str, result.rule_id, result.message)

    console.print(table)

    counts = {
        CheckStatus.PASSED: 0,
        CheckStatus.WARNING: 0,
        CheckStatus.FAILED: 0,
        CheckStatus.BLOCKED: 0
    }
    for r in check_results:
        counts[r.status] += 1

    summary = Table(title="检查统计", show_header=False, show_lines=False)
    summary.add_column("项目", style="cyan")
    summary.add_column("数量", style="magenta")
    summary.add_row("通过", f"[green]{counts[CheckStatus.PASSED]}[/green]")
    summary.add_row("警告", f"[yellow]{counts[CheckStatus.WARNING]}[/yellow]")
    summary.add_row("失败", f"[red]{counts[CheckStatus.FAILED]}[/red]")
    summary.add_row("阻断", f"[bold red]{counts[CheckStatus.BLOCKED]}[/bold red]")
    console.print(summary)

    can_submit = counts[CheckStatus.BLOCKED] == 0 and counts[CheckStatus.FAILED] == 0
    if can_submit:
        console.print(Panel(
            "[green]✅ 投标文件可以提交[/green]",
            title="结论",
            border_style="green"
        ))
    else:
        console.print(Panel(
            "[red]❌ 投标文件存在问题，需要修正[/red]",
            title="结论",
            border_style="red"
        ))


def _display_materials_detail(state, config):
    materials = state.get('materials', [])
    if not materials:
        console.print(Panel("[yellow]暂无材料数据，请先运行 'bid-checker check'[/yellow]"))
        return

    tree = Tree("[bold cyan]材料清单[/bold cyan]")

    type_labels = {
        'quotation': '📄 报价文件',
        'qualification': '📋 资质文件',
        'authorization': '🔑 授权文件',
        'seal_page': '🔏 盖章页',
        'version_doc': '📝 版本说明',
        'other': '📦 其他文件'
    }

    grouped = {}
    for m in materials:
        mat_type = m.get('type', 'other')
        if mat_type not in grouped:
            grouped[mat_type] = []
        grouped[mat_type].append(m)

    for mat_type, items in grouped.items():
        branch = tree.add(f"[bold]{type_labels.get(mat_type, mat_type)}[/bold] ({len(items)})")
        for item in items:
            version = item.get('version', '-')
            is_current = item.get('is_current', True)
            has_seal = item.get('has_seal', False)
            amount = item.get('amount')

            status = []
            if not is_current:
                status.append("[yellow]旧版[/yellow]")
            if has_seal:
                status.append("[green]已盖章[/green]")
            if amount:
                status.append(f"金额: ¥{amount:,.2f}")

            status_str = f" ({', '.join(status)})" if status else ""
            branch.add(f"{item['name']} [dim]v{version}[/dim]{status_str}")

    console.print(tree)


def _display_versions_detail(state):
    versions = state.get('versions', [])
    if not versions:
        console.print(Panel("[yellow]暂无版本记录，请先导入版本说明[/yellow]"))
        return

    table = Table(title="版本历史")
    table.add_column("版本", style="cyan")
    table.add_column("日期", style="magenta")
    table.add_column("作者", style="green")
    table.add_column("变更说明", style="white")

    for v in versions:
        changes = '\n'.join(v.get('changes', []))
        table.add_row(
            v.get('version', '-'),
            v.get('date', '-'),
            v.get('author', '-'),
            changes
        )

    console.print(table)


def _display_history_detail(config_manager):
    history = config_manager.get_history()
    if not history:
        console.print(Panel("[yellow]暂无历史记录[/yellow]"))
        return

    table = Table(title="操作历史")
    table.add_column("时间", style="cyan", width=20)
    table.add_column("操作者", style="magenta")
    table.add_column("动作", style="green")
    table.add_column("说明", style="white")

    for entry in reversed(history[-20:]):
        table.add_row(
            entry.get('timestamp', '-')[:19],
            entry.get('operator', '-'),
            entry.get('action', '-'),
            entry.get('comment', '-')
        )

    console.print(table)


def _generate_text_report(config, state, report_summary):
    lines = []
    lines.append("=" * 60)
    lines.append("投标文件完整性检查报告")
    lines.append("=" * 60)
    lines.append(f"项目名称: {config.get('project_name', '投标项目')}")
    lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"最后检查: {state.get('last_check', '未检查')}")
    lines.append("")

    lines.append("-" * 60)
    lines.append("【检查统计】")
    lines.append("-" * 60)
    lines.append(f"  总检查项: {report_summary.total_checks}")
    lines.append(f"  通过: {report_summary.passed}")
    lines.append(f"  警告: {report_summary.warnings}")
    lines.append(f"  失败: {report_summary.failed}")
    lines.append(f"  阻断: {report_summary.blocked}")
    lines.append("")

    lines.append("-" * 60)
    lines.append("【结论】")
    lines.append("-" * 60)
    if report_summary.can_submit:
        lines.append("  ✅ 投标文件可以提交")
    else:
        lines.append("  ❌ 投标文件存在问题，需要修正")
    lines.append("")

    if report_summary.missing_materials:
        lines.append("-" * 60)
        lines.append("【需补件 - 阻断风险】")
        lines.append("-" * 60)
        for item in report_summary.missing_materials:
            lines.append(f"  ❌ 缺少: {item}")
        lines.append("")

    if report_summary.amount_mismatches:
        lines.append("-" * 60)
        lines.append("【金额不一致 - 失败风险】")
        lines.append("-" * 60)
        for item in report_summary.amount_mismatches:
            lines.append(f"  ❌ {item}")
        lines.append("")

    if report_summary.old_versions:
        lines.append("-" * 60)
        lines.append("【旧版本文件 - 警告】")
        lines.append("-" * 60)
        for item in report_summary.old_versions:
            lines.append(f"  ⚠ {item}")
        lines.append("")

    if report_summary.missing_seals:
        lines.append("-" * 60)
        lines.append("【盖章问题】")
        lines.append("-" * 60)
        for item in report_summary.missing_seals:
            lines.append(f"  ⚠ {item}")
        lines.append("")

    if report_summary.corrections_needed:
        lines.append("-" * 60)
        lines.append("【负责人修正清单】")
        lines.append("-" * 60)
        for i, item in enumerate(report_summary.corrections_needed, 1):
            severity = {
                'blocked': '🔴 阻断',
                'failed': '🟠 失败',
                'warning': '🟡 警告'
            }.get(item.get('severity'), item.get('severity'))
            lines.append(f"  {i}. [{severity}] {item.get('item')}")
            lines.append(f"     行动: {item.get('action')}")
        lines.append("")

    lines.append("=" * 60)
    return '\n'.join(lines)


if __name__ == "__main__":
    main()
