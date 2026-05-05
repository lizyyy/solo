#!/usr/bin/env python
"""DNS 切换演练模拟工具 - CLI 入口"""

import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from collections import defaultdict

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import print as rprint

from .models import (
    SwitchPlan, DNSRecord, VendorExport, ProbeLog,
    CheckResultType, ReviewStatus, Region
)
from .parsers import ParserFactory
from .simulation import SimulationEngine
from .exporters import MarkdownExporter, JSONAuditExporter
from .review import ReviewManager

app = typer.Typer(
    name="dns-switch-sim",
    help="DNS 切换演练模拟工具 - 大促前 CDN 切换演练与检查",
    add_completion=False,
)

console = Console()


def get_result_style(result_type: CheckResultType) -> str:
    styles = {
        CheckResultType.PASS: "green",
        CheckResultType.WARNING: "yellow",
        CheckResultType.FAIL: "red",
        CheckResultType.INFO: "blue",
    }
    return styles.get(result_type, "white")


def get_result_icon(result_type: CheckResultType) -> str:
    icons = {
        CheckResultType.PASS: "✅",
        CheckResultType.WARNING: "⚠️",
        CheckResultType.FAIL: "❌",
        CheckResultType.INFO: "ℹ️",
    }
    return icons.get(result_type, "")


@app.command()
def simulate(
    plan: Path = typer.Option(
        ..., "--plan", "-p",
        help="切换计划 JSON 文件路径",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    dns_records: Optional[Path] = typer.Option(
        None, "--dns", "-d",
        help="域名记录文件 (JSON/CSV)",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    vendor_export: Optional[Path] = typer.Option(
        None, "--vendor", "-v",
        help="供应商导出文件 (JSON/CSV)",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    probe_log: Optional[Path] = typer.Option(
        None, "--probe", "-l",
        help="探测日志文件 (JSON/CSV)",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    simulated_time: Optional[str] = typer.Option(
        None, "--time", "-t",
        help="模拟时间 (格式: YYYY-MM-DD HH:MM:SS)",
    ),
    output_md: Optional[Path] = typer.Option(
        None, "--output-md", "-o",
        help="输出 Markdown 报告路径",
    ),
    output_json: Optional[Path] = typer.Option(
        None, "--output-json", "-j",
        help="输出 JSON 审计包路径",
    ),
):
    """
    执行 DNS 切换模拟演练
    
    导入切换计划、域名记录、供应商导出和探测日志，
    模拟分区域生效时间，执行各项检查并生成报告。
    """
    
    console.print(Panel.fit(
        "[bold blue]DNS 切换演练模拟工具[/bold blue]\n"
        "[dim]版本 0.1.0[/dim]",
        border_style="blue",
    ))
    
    try:
        switch_plan = ParserFactory.parse(plan, "switch_plan")
        console.print(f"✅ 加载切换计划: [bold]{switch_plan.name}[/bold] ({switch_plan.plan_id})")
    except Exception as e:
        console.print(f"[red]❌ 加载切换计划失败: {e}[/red]")
        raise typer.Exit(1)
    
    records: List[DNSRecord] = []
    if dns_records:
        try:
            records = ParserFactory.parse(dns_records, "dns_records")
            console.print(f"✅ 加载 {len(records)} 条域名记录")
        except Exception as e:
            console.print(f"[yellow]⚠️  加载域名记录失败: {e}[/yellow]")
    
    vendor_exports: List[VendorExport] = []
    if vendor_export:
        try:
            vendor_exports = ParserFactory.parse(vendor_export, "vendor_export")
            console.print(f"✅ 加载 {len(vendor_exports)} 条供应商导出记录")
        except Exception as e:
            console.print(f"[yellow]⚠️  加载供应商导出失败: {e}[/yellow]")
    
    probe_logs: List[ProbeLog] = []
    if probe_log:
        try:
            probe_logs = ParserFactory.parse(probe_log, "probe_log")
            console.print(f"✅ 加载 {len(probe_logs)} 条探测日志")
        except Exception as e:
            console.print(f"[yellow]⚠️  加载探测日志失败: {e}[/yellow]")
    
    sim_time: datetime
    if simulated_time:
        try:
            sim_time = datetime.strptime(simulated_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                sim_time = datetime.strptime(simulated_time, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                console.print(f"[red]❌ 无效的时间格式，请使用 YYYY-MM-DD HH:MM:SS[/red]")
                raise typer.Exit(1)
    else:
        sim_time = datetime.now()
    
    console.print(f"\n🕐 模拟时间: [bold]{sim_time.strftime('%Y-%m-%d %H:%M:%S')}[/bold]")
    
    engine = SimulationEngine(switch_plan, records, vendor_exports, probe_logs)
    result = engine.simulate(sim_time)
    
    console.print("\n" + Panel.fit(
        "[bold]模拟结果概览[/bold]",
        border_style="cyan",
    ))
    
    current_phase = engine.get_current_phase(sim_time)
    phase_names = {
        "ttl_lower": "降低 TTL",
        "traffic_shift": "流量切换",
        "stabilization": "稳定期",
        "rollback": "回滚",
        "complete": "完成",
    }
    phase_display = phase_names.get(current_phase.value, current_phase.value) if current_phase else "未知"
    console.print(f"📍 当前阶段: [bold]{phase_display}[/bold]")
    console.print(f"🔄 回滚可用: [bold]{'✅ 是' if result.rollback_available else '❌ 否'}[/bold]")
    if result.rollback_window_minutes is not None:
        console.print(f"⏱️  剩余回滚窗口: [bold]{result.rollback_window_minutes} 分钟[/bold]")
    
    console.print("\n🌍 区域生效状态:")
    region_names = {
        "cn_main": "中国大陆",
        "cn_hk": "香港",
        "cn_tw": "台湾",
        "apac": "亚太",
        "na": "北美",
        "eu": "欧洲",
        "sa": "南美",
        "af": "非洲",
        "global": "全球",
    }
    for region, is_effective in result.effective_regions.items():
        status = "✅ 已生效" if is_effective else "⏳ 传播中"
        region_name = region_names.get(region.value, region.value)
        console.print(f"  - {region_name}: {status}")
    
    stats = defaultdict(int)
    for check in result.check_results:
        stats[check.result] += 1
    
    console.print("\n" + Panel.fit(
        "[bold]检查结果汇总[/bold]",
        border_style="green",
    ))
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("状态", style="dim", width=8)
    table.add_column("数量", justify="right")
    
    for result_type, count in stats.items():
        icon = get_result_icon(result_type)
        style = get_result_style(result_type)
        table.add_row(
            f"[{style}]{icon} {result_type.value}[/{style}]",
            str(count),
        )
    
    console.print(table)
    
    if result.check_results:
        console.print("\n" + Panel.fit(
            "[bold]详细检查结果[/bold]",
            border_style="yellow",
        ))
        
        detail_table = Table(show_header=True, header_style="bold blue")
        detail_table.add_column("状态", style="dim", width=6)
        detail_table.add_column("检查类型", width=18)
        detail_table.add_column("区域", width=12)
        detail_table.add_column("描述", width=50)
        
        for check in result.check_results:
            icon = get_result_icon(check.result)
            style = get_result_style(check.result)
            region_name = region_names.get(check.region.value, check.region.value) if check.region else "-"
            
            if check.result in [CheckResultType.FAIL, CheckResultType.WARNING]:
                detail_table.add_row(
                    f"[{style}]{icon}[/{style}]",
                    check.check_type,
                    region_name,
                    Text(check.message, style=style),
                )
        
        for check in result.check_results:
            if check.result not in [CheckResultType.FAIL, CheckResultType.WARNING]:
                icon = get_result_icon(check.result)
                style = get_result_style(check.result)
                region_name = region_names.get(check.region.value, check.region.value) if check.region else "-"
                detail_table.add_row(
                    f"[{style}]{icon}[/{style}]",
                    check.check_type,
                    region_name,
                    check.message,
                )
        
        console.print(detail_table)
    
    if output_md:
        try:
            MarkdownExporter.export(result, switch_plan, output_md)
            console.print(f"\n✅ Markdown 报告已保存: [bold]{output_md}[/bold]")
        except Exception as e:
            console.print(f"[red]❌ 保存 Markdown 报告失败: {e}[/red]")
    
    if output_json:
        try:
            JSONAuditExporter.export(result, switch_plan, output_json)
            console.print(f"✅ JSON 审计包已保存: [bold]{output_json}[/bold]")
        except Exception as e:
            console.print(f"[red]❌ 保存 JSON 审计包失败: {e}[/red]")
    
    if stats.get(CheckResultType.FAIL, 0) > 0:
        console.print("\n[red]⚠️  存在失败项，请检查并处理后再继续[/red]")
        raise typer.Exit(1)
    elif stats.get(CheckResultType.WARNING, 0) > 0:
        console.print("\n[yellow]⚠️  存在警告项，建议人工复核[/yellow]")
    else:
        console.print("\n[green]✅ 所有检查项通过，可以继续执行切换计划[/green]")


@app.command()
def review(
    review_file: Path = typer.Option(
        ..., "--file", "-f",
        help="复核数据文件路径",
        exists=True,
        file_okay=True,
        dir_okay=False,
    ),
    list_items: bool = typer.Option(
        False, "--list", "-l",
        help="列出所有待复核项",
    ),
    item_id: Optional[str] = typer.Option(
        None, "--item", "-i",
        help="指定复核项 ID",
    ),
    reviewer: Optional[str] = typer.Option(
        None, "--reviewer", "-r",
        help="复核人名称",
    ),
    action: Optional[str] = typer.Option(
        None, "--action", "-a",
        help="操作类型: approve (批准) 或 reject (拒绝)",
    ),
    comment: Optional[str] = typer.Option(
        None, "--comment", "-c",
        help="复核备注",
    ),
):
    """
    管理人工复核项
    
    可以列出待复核项、批准或拒绝特定复核项。
    """
    
    manager = ReviewManager()
    try:
        manager.load_from_file(review_file)
    except Exception as e:
        console.print(f"[red]❌ 加载复核文件失败: {e}[/red]")
        raise typer.Exit(1)
    
    stats = manager.get_statistics()
    console.print(f"📊 复核统计: 总计 {stats['total']} 项, 需要关注 {stats['needs_attention']} 项")
    
    if list_items:
        pending = manager.get_pending_items()
        
        if not pending:
            console.print("\n✅ 没有待复核项")
            return
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("复核项 ID", style="dim")
        table.add_column("关联检查", style="dim")
        table.add_column("状态")
        table.add_column("处理人")
        
        for item in pending:
            status_style = "yellow" if item.status == ReviewStatus.NEEDS_REVIEW else "dim"
            status_display = "⚠️ 需要复核" if item.status == ReviewStatus.NEEDS_REVIEW else "⏳ 待处理"
            reviewer_display = item.reviewer or "-"
            
            table.add_row(
                item.item_id,
                item.check_result_id,
                f"[{status_style}]{status_display}[/{status_style}]",
                reviewer_display,
            )
        
        console.print("\n" + Panel.fit(
            "[bold]待复核项列表[/bold]",
            border_style="yellow",
        ))
        console.print(table)
        return
    
    if item_id and action:
        if not reviewer:
            console.print("[red]❌ 请指定复核人 (--reviewer)[/red]")
            raise typer.Exit(1)
        
        item = manager.get_item(item_id)
        if not item:
            console.print(f"[red]❌ 找不到复核项: {item_id}[/red]")
            raise typer.Exit(1)
        
        if action == "approve":
            manager.approve(item_id, reviewer, comment)
            console.print(f"✅ 已批准复核项: {item_id}")
        elif action == "reject":
            manager.reject(item_id, reviewer, comment)
            console.print(f"❌ 已拒绝复核项: {item_id}")
        else:
            console.print(f"[red]❌ 无效的操作类型: {action} (使用 approve 或 reject)[/red]")
            raise typer.Exit(1)
        
        try:
            manager.save_to_file(review_file)
            console.print(f"💾 已更新复核文件: {review_file}")
        except Exception as e:
            console.print(f"[red]❌ 保存复核文件失败: {e}[/red]")
            raise typer.Exit(1)
        
        return
    
    console.print("\n[dim]使用 --list 查看待复核项，或使用 --item --action --reviewer 进行复核[/dim]")


@app.command()
def template(
    output_dir: Path = typer.Option(
        Path("./templates"), "--output", "-o",
        help="输出目录",
        file_okay=False,
        dir_okay=True,
    ),
):
    """
    生成示例数据模板
    
    创建域名记录、供应商导出、探测日志和切换计划的示例 JSON 文件。
    """
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    now = datetime.now()
    start_time = now.replace(hour=14, minute=0, second=0, microsecond=0)
    
    switch_plan_template = {
        "plan_id": "switch_2024_001",
        "name": "双 11 大促 CDN 切换计划",
        "domain": "cdn.example.com",
        "original_vendor": "cdn_a",
        "target_vendor": "cdn_b",
        "rollback_vendor": "cdn_a",
        "created_at": now.isoformat(),
        "planned_start_time": start_time.isoformat(),
        "steps": [
            {
                "step_id": "step_001",
                "phase": "ttl_lower",
                "description": "降低 TTL 至 60 秒",
                "target_vendor": "cdn_a",
                "region": "global",
                "start_time": start_time.isoformat(),
                "duration_minutes": 30,
                "traffic_percent": 100,
            },
            {
                "step_id": "step_002",
                "phase": "traffic_shift",
                "description": "中国大陆区域切流至 CDN B",
                "target_vendor": "cdn_b",
                "region": "cn_main",
                "start_time": (start_time.timestamp() + 30 * 60).__str__() + "Z",
                "duration_minutes": 15,
                "traffic_percent": 100,
            },
            {
                "step_id": "step_003",
                "phase": "stabilization",
                "description": "稳定期观察",
                "target_vendor": "cdn_b",
                "region": "global",
                "start_time": (start_time.timestamp() + 45 * 60).__str__() + "Z",
                "duration_minutes": 60,
                "traffic_percent": 100,
            },
            {
                "step_id": "step_004",
                "phase": "rollback",
                "description": "回滚至 CDN A",
                "target_vendor": "cdn_a",
                "region": "global",
                "start_time": (start_time.timestamp() + 120 * 60).__str__() + "Z",
                "duration_minutes": 15,
                "traffic_percent": 100,
            },
        ],
    }
    
    for step in switch_plan_template["steps"]:
        if "Z" in step["start_time"]:
            ts = float(step["start_time"].replace("Z", ""))
            step["start_time"] = datetime.fromtimestamp(ts).isoformat()
    
    dns_records_template = [
        {
            "domain": "cdn.example.com",
            "type": "CNAME",
            "value": "cdn-a.example.com",
            "ttl": 300,
            "region": "cn_main",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        {
            "domain": "cdn.example.com",
            "type": "CNAME",
            "value": "cdn-a.example.com",
            "ttl": 300,
            "region": "na",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
    ]
    
    vendor_export_template = [
        {
            "vendor": "cdn_a",
            "region": "cn_main",
            "domain": "cdn.example.com",
            "cname_target": "cdn-a.example.com",
            "health_status": "healthy",
            "last_check": now.isoformat(),
            "bandwidth_mbps": 1250.5,
            "error_rate": 0.001,
        },
        {
            "vendor": "cdn_b",
            "region": "cn_main",
            "domain": "cdn.example.com",
            "cname_target": "cdn-b.example.com",
            "health_status": "healthy",
            "last_check": now.isoformat(),
            "bandwidth_mbps": 890.2,
            "error_rate": 0.002,
        },
        {
            "vendor": "origin",
            "region": "cn_main",
            "domain": "cdn.example.com",
            "cname_target": "origin.example.com",
            "health_status": "degraded",
            "last_check": now.isoformat(),
            "bandwidth_mbps": 50.0,
            "error_rate": 0.05,
        },
    ]
    
    probe_log_template = [
        {
            "timestamp": now.isoformat(),
            "region": "cn_main",
            "domain": "cdn.example.com",
            "resolver_ip": "114.114.114.114",
            "resolved_ips": ["1.2.3.4", "1.2.3.5"],
            "resolved_cname": "cdn-a.example.com",
            "http_status": 200,
            "response_time_ms": 45,
            "success": True,
        },
        {
            "timestamp": (now - timedelta(seconds=60)).isoformat(),
            "region": "cn_main",
            "domain": "cdn.example.com",
            "resolver_ip": "8.8.8.8",
            "resolved_ips": ["5.6.7.8"],
            "resolved_cname": "cdn-a.example.com",
            "http_status": 200,
            "response_time_ms": 120,
            "success": True,
        },
    ]
    
    import json
    
    plan_path = output_dir / "switch_plan.json"
    dns_path = output_dir / "dns_records.json"
    vendor_path = output_dir / "vendor_export.json"
    probe_path = output_dir / "probe_log.json"
    
    with open(plan_path, "w", encoding="utf-8") as f:
        json.dump(switch_plan_template, f, ensure_ascii=False, indent=2)
    
    with open(dns_path, "w", encoding="utf-8") as f:
        json.dump(dns_records_template, f, ensure_ascii=False, indent=2)
    
    with open(vendor_path, "w", encoding="utf-8") as f:
        json.dump(vendor_export_template, f, ensure_ascii=False, indent=2)
    
    with open(probe_path, "w", encoding="utf-8") as f:
        json.dump(probe_log_template, f, ensure_ascii=False, indent=2)
    
    console.print(f"✅ 模板文件已生成至: [bold]{output_dir}[/bold]")
    console.print(f"\n📄 生成的文件:")
    console.print(f"  - {plan_path}")
    console.print(f"  - {dns_path}")
    console.print(f"  - {vendor_path}")
    console.print(f"  - {probe_path}")
    console.print("\n💡 使用示例:")
    console.print(f"  dns-switch-sim simulate \\\n    --plan {plan_path} \\\n    --dns {dns_path} \\\n    --vendor {vendor_path} \\\n    --probe {probe_path}")


def _patch_probe_template():
    pass


if __name__ == "__main__":
    app()
