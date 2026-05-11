import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .config_loader import load_default_config, load_tenant_configs
from .diff_engine import DiffEngine
from .drift_manager import DriftManager
from .models import DiffType, RiskLevel
from .reporter import (
    export_html_report,
    export_json_report,
    generate_publish_report,
    generate_tenant_report,
)


console = Console()


def _get_config_paths(base_dir: Optional[Path] = None) -> tuple[Path, Path, Path]:
    base = Path(base_dir) if base_dir else Path.cwd()
    default_dir = base / "configs" / "default"
    tenants_dir = base / "configs" / "tenants"
    allowances_file = base / "configs" / "drift_allowances.json"
    return default_dir, tenants_dir, allowances_file


def _load_components(base_dir: Optional[Path] = None):
    default_dir, tenants_dir, allowances_file = _get_config_paths(base_dir)
    
    if not default_dir.exists():
        console.print(f"[red]错误: 默认配置目录不存在: {default_dir}[/red]")
        console.print(f"[yellow]请确保 configs/default/ 目录存在并包含默认配置文件[/yellow]")
        sys.exit(1)
    
    default_config = load_default_config(default_dir)
    tenant_configs = load_tenant_configs(tenants_dir)
    diff_engine = DiffEngine(default_config)
    drift_manager = DriftManager(allowances_file)
    
    return default_config, tenant_configs, diff_engine, drift_manager


def _print_diff_header(tenant_id: str, tier: str):
    title = Text(f"租户: {tenant_id} ")
    title.append(f"[{tier}]", style="dim")
    console.print(Panel(title, expand=False))


def _print_diffs(diffs, show_allowed: bool = False, drift_manager=None, tenant_id: str = None):
    if not diffs:
        console.print("[green]✓ 配置完全一致，无漂移[/green]")
        return
    
    high_diffs = [d for d in diffs if d.risk_level == RiskLevel.HIGH]
    medium_diffs = [d for d in diffs if d.risk_level == RiskLevel.MEDIUM]
    low_diffs = [d for d in diffs if d.risk_level == RiskLevel.LOW]
    
    for diff_list, color in [(high_diffs, "red"), (medium_diffs, "yellow"), (low_diffs, "cyan")]:
        if diff_list:
            table = Table(title=f"{'🔴 高风险' if color == 'red' else '🟡 中风险' if color == 'yellow' else '🟢 低风险'} ({len(diff_list)}项)", show_header=True, header_style="bold magenta")
            table.add_column("类型", style=color, no_wrap=True)
            table.add_column("配置键", style="bold", overflow="fold")
            table.add_column("默认值", overflow="fold")
            table.add_column("租户值", overflow="fold")
            table.add_column("来源", style="dim")
            table.add_column("状态", style="dim")
            
            for d in diff_list:
                diff_type_name = _diff_type_display(d.diff_type)
                sensitive_tag = " [red][敏感][/red]" if d.is_sensitive else ""
                
                is_allowed = False
                allowance_status = ""
                if drift_manager and tenant_id:
                    allowance = drift_manager.get_allowance(tenant_id, d.key)
                    if allowance:
                        if allowance.check_expired():
                            allowance_status = f" [red][已过期-批准:{allowance.approved_by}][/red]"
                        else:
                            is_allowed = True
                            allowance_status = f" [green][已批准:{allowance.approved_by}-{allowance.expiry_date.strftime('%Y-%m-%d')}][/green]"
                
                if is_allowed and not show_allowed:
                    continue
                
                default_val = str(d.default_value) if d.default_value is not None else "-"
                tenant_val = str(d.tenant_value) if d.tenant_value is not None else "-"
                
                table.add_row(
                    diff_type_name + sensitive_tag,
                    d.key,
                    default_val,
                    tenant_val,
                    d.source_file or "-",
                    allowance_status or "-",
                )
            
            console.print(table)


def _diff_type_display(diff_type: DiffType) -> str:
    mapping = {
        DiffType.ADDED: "新增",
        DiffType.REMOVED: "删除",
        DiffType.TYPE_CHANGED: "类型变化",
        DiffType.VALUE_CHANGED: "值变化",
        DiffType.SENSITIVE_SWITCH: "敏感开关",
        DiffType.EXPIRED_OVERRIDE: "过期覆盖",
    }
    return mapping.get(diff_type, diff_type.value)


def _print_tenant_errors(tenant):
    if not tenant.has_errors:
        return
    
    if tenant.parse_errors:
        console.print(f"[red]⚠️  解析错误 ({len(tenant.parse_errors)}项):[/red]")
        for err in tenant.parse_errors:
            console.print(f"  [red]• {err}[/red]")
    
    if tenant.duplicate_keys:
        console.print(f"[yellow]⚠️  重复配置键 ({len(tenant.duplicate_keys)}项):[/yellow]")
        for dup in tenant.duplicate_keys:
            console.print(f"  [yellow]• {dup}[/yellow]")


def _print_allowances(allowances):
    if not allowances:
        console.print("[dim]无已批准的漂移[/dim]")
        return
    
    table = Table(title="已批准的漂移", show_header=True, header_style="bold blue")
    table.add_column("配置键", style="bold")
    table.add_column("批准人", style="cyan")
    table.add_column("批准日期", style="dim")
    table.add_column("到期日期", style="dim")
    table.add_column("状态")
    table.add_column("原因", overflow="fold")
    
    for a in allowances:
        is_expired = a.check_expired()
        status = "[red]已过期[/red]" if is_expired else "[green]有效[/green]"
        table.add_row(
            a.key,
            a.approved_by,
            a.approval_date.strftime("%Y-%m-%d"),
            a.expiry_date.strftime("%Y-%m-%d"),
            status,
            a.reason,
        )
    
    console.print(table)


@click.group()
@click.option("--base-dir", "-d", type=click.Path(path_type=Path), help="配置目录根路径")
@click.pass_context
def cli(ctx, base_dir):
    """多租户配置漂移检测 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj["base_dir"] = base_dir


@cli.command()
@click.option("--tenant", "-t", help="指定租户ID，不指定则扫描所有租户")
@click.option("--show-allowed", is_flag=True, help="显示已批准的漂移")
@click.pass_context
def scan(ctx, tenant, show_allowed):
    """扫描配置漂移"""
    base_dir = ctx.obj.get("base_dir")
    default_config, tenant_configs, diff_engine, drift_manager = _load_components(base_dir)
    
    if not tenant_configs:
        console.print("[yellow]未找到任何租户配置。请在 configs/tenants/ 下创建租户目录[/yellow]")
        return
    
    if tenant:
        if tenant not in tenant_configs:
            console.print(f"[red]未找到租户: {tenant}[/red]")
            sys.exit(1)
        tenants_to_check = [tenant_configs[tenant]]
    else:
        tenants_to_check = list(tenant_configs.values())
    
    summary_table = Table(title="扫描摘要", show_header=True, header_style="bold magenta")
    summary_table.add_column("租户", style="bold")
    summary_table.add_column("套餐")
    summary_table.add_column("高风险", style="red")
    summary_table.add_column("中风险", style="yellow")
    summary_table.add_column("低风险", style="cyan")
    summary_table.add_column("状态")
    
    critical_tenants = []
    
    for tc in tenants_to_check:
        report = generate_tenant_report(tc, diff_engine, drift_manager)
        
        high = sum(1 for d in report.unresolved_diffs if d.risk_level == RiskLevel.HIGH)
        medium = sum(1 for d in report.unresolved_diffs if d.risk_level == RiskLevel.MEDIUM)
        low = sum(1 for d in report.unresolved_diffs if d.risk_level == RiskLevel.LOW)
        
        status = "[red]需要立即处理[/red]" if tc.has_errors or high > 0 else "[yellow]有警告[/yellow]" if medium > 0 else "[green]正常[/green]"
        if tc.has_errors or high > 0:
            critical_tenants.append(tc.tenant_id)
        
        summary_table.add_row(tc.tenant_id, tc.tier, str(high), str(medium), str(low), status)
    
    console.print(summary_table)
    
    if len(tenants_to_check) > 1 and critical_tenants:
        console.print(f"\n[red]⚠️  以下租户有需要立即处理的问题: {', '.join(critical_tenants)}[/red]")
        console.print(f"[dim]使用 config-drift view -t <租户ID> 查看详细信息[/dim]")


@cli.command()
@click.argument("tenant_id")
@click.option("--show-allowed", is_flag=True, help="显示已批准的漂移")
@click.pass_context
def view(ctx, tenant_id, show_allowed):
    """查看指定租户的配置差异"""
    base_dir = ctx.obj.get("base_dir")
    default_config, tenant_configs, diff_engine, drift_manager = _load_components(base_dir)
    
    if tenant_id not in tenant_configs:
        console.print(f"[red]未找到租户: {tenant_id}[/red]")
        console.print(f"[dim]可用租户: {', '.join(tenant_configs.keys())}[/dim]")
        sys.exit(1)
    
    tenant = tenant_configs[tenant_id]
    report = generate_tenant_report(tenant, diff_engine, drift_manager)
    
    _print_diff_header(tenant.tenant_id, tenant.tier)
    _print_tenant_errors(tenant)
    _print_diffs(report.unresolved_diffs, show_allowed, drift_manager, tenant.tenant_id)
    
    if report.allowances:
        console.print()
        _print_allowances(report.allowances)


@cli.command()
@click.argument("tenant_id")
@click.argument("config_key")
@click.option("--approved-by", "-a", required=True, help="批准人姓名")
@click.option("--reason", "-r", required=True, help="批准原因")
@click.option("--days", "-d", default=30, show_default=True, help="有效天数")
@click.pass_context
def allow(ctx, tenant_id, config_key, approved_by, reason, days):
    """标记允许的配置漂移"""
    base_dir = ctx.obj.get("base_dir")
    default_config, tenant_configs, diff_engine, drift_manager = _load_components(base_dir)
    
    if tenant_id not in tenant_configs:
        console.print(f"[red]未找到租户: {tenant_id}[/red]")
        sys.exit(1)
    
    tenant = tenant_configs[tenant_id]
    diffs = diff_engine.detect_diffs(tenant.config)
    
    has_diff = any(d.key == config_key for d in diffs)
    if not has_diff:
        console.print(f"[yellow]警告: 配置键 '{config_key}' 没有检测到漂移[/yellow]")
        available_keys = [d.key for d in diffs]
        if available_keys:
            console.print(f"[dim]可用的漂移键: {', '.join(available_keys[:10])}{'...' if len(available_keys) > 10 else ''}[/dim]")
    
    existing = drift_manager.get_allowance(tenant_id, config_key)
    if existing:
        if click.confirm(f"该配置已有批准记录（批准人: {existing.approved_by}, 到期: {existing.expiry_date.strftime('%Y-%m-%d')}），是否覆盖？"):
            drift_manager.remove_allowance(tenant_id, config_key)
        else:
            console.print("[dim]操作已取消[/dim]")
            return
    
    allowance = drift_manager.add_allowance(tenant_id, config_key, approved_by, reason, days)
    console.print(f"[green]✓ 已批准漂移[/green]")
    console.print(f"  租户: {tenant_id}")
    console.print(f"  配置键: {config_key}")
    console.print(f"  批准人: {approved_by}")
    console.print(f"  到期日期: {allowance.expiry_date.strftime('%Y-%m-%d')}")


@cli.command("list-allowances")
@click.option("--tenant", "-t", help="指定租户，不指定则显示所有")
@click.option("--show-expired", is_flag=True, help="仅显示已过期的批准")
@click.pass_context
def list_allowances(ctx, tenant, show_expired):
    """列出所有已批准的漂移"""
    base_dir = ctx.obj.get("base_dir")
    _, _, _, drift_manager = _load_components(base_dir)
    
    if tenant:
        allowances = drift_manager.get_tenant_allowances(tenant)
    else:
        allowances = drift_manager.get_all_allowances()
    
    if show_expired:
        allowances = [a for a in allowances if a.check_expired()]
    
    if not allowances:
        console.print("[dim]无已批准的漂移记录[/dim]")
        return
    
    table = Table(title="已批准的漂移记录", show_header=True, header_style="bold blue")
    table.add_column("租户", style="bold")
    table.add_column("配置键", style="cyan")
    table.add_column("批准人")
    table.add_column("批准日期", style="dim")
    table.add_column("到期日期", style="dim")
    table.add_column("状态")
    table.add_column("原因", overflow="fold")
    
    for a in sorted(allowances, key=lambda x: (x.tenant_id, x.expiry_date)):
        is_expired = a.check_expired()
        status = "[red]已过期[/red]" if is_expired else "[green]有效[/green]"
        table.add_row(
            a.tenant_id,
            a.key,
            a.approved_by,
            a.approval_date.strftime("%Y-%m-%d"),
            a.expiry_date.strftime("%Y-%m-%d"),
            status,
            a.reason,
        )
    
    console.print(table)


@cli.command()
@click.option("--output", "-o", default="publish_report.html", show_default=True, help="输出文件路径")
@click.option("--format", "-f", "fmt", type=click.Choice(["html", "json"]), default="html", show_default=True)
@click.pass_context
def export(ctx, output, fmt):
    """导出发布风险报告"""
    base_dir = ctx.obj.get("base_dir")
    default_config, tenant_configs, diff_engine, drift_manager = _load_components(base_dir)
    
    report = generate_publish_report(list(tenant_configs.values()), diff_engine, drift_manager)
    
    output_path = Path(output)
    
    if fmt == "html":
        export_html_report(report, output_path)
    else:
        if not output_path.suffix:
            output_path = output_path.with_suffix(".json")
        export_json_report(report, output_path)
    
    console.print(f"[green]✓ 报告已导出到: {output_path}[/green]")
    
    if report.tenants_with_critical_issues > 0:
        console.print(f"[red]⚠️  警告: 有 {report.tenants_with_critical_issues} 个租户存在需要立即处理的问题[/red]")
        console.print(f"[dim]发布前请确保所有问题已解决[/dim]")
        sys.exit(1)


@cli.command()
@click.pass_context
def check(ctx):
    """快速检查发布就绪状态"""
    base_dir = ctx.obj.get("base_dir")
    default_config, tenant_configs, diff_engine, drift_manager = _load_components(base_dir)
    
    report = generate_publish_report(list(tenant_configs.values()), diff_engine, drift_manager)
    
    console.print(Panel.fit(
        f"[bold]发布前检查结果[/bold]\n\n"
        f"总租户数: [bold]{report.total_tenants}[/bold]\n"
        f"需要立即处理: [red]{report.tenants_with_critical_issues}[/red]\n"
        f"有警告: [yellow]{report.tenants_with_warnings}[/yellow]\n"
        f"无问题: [green]{report.tenants_ok}[/green]",
        title="🚨 配置漂移检查",
        border_style="red" if report.tenants_with_critical_issues > 0 else "green",
    ))
    
    if report.all_critical_issues:
        console.print("\n[bold red]需要立即处理的问题:[/bold red]")
        for issue in report.all_critical_issues[:10]:
            console.print(f"  [red]• {issue}[/red]")
        if len(report.all_critical_issues) > 10:
            console.print(f"  [red]... 还有 {len(report.all_critical_issues) - 10} 个问题[/red]")
        console.print(f"\n[dim]使用 `config-drift export` 导出完整报告[/dim]")
        sys.exit(1)
    
    console.print("\n[green]✓ 所有检查通过，可以安全发布[/green]")


def main():
    cli(obj={})


if __name__ == "__main__":
    main()
