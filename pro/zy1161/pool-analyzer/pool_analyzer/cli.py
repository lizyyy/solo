import os
import sys
import click
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .config_loader import ConfigLoader
from .analyzer import PoolAnalyzer
from .exporter import ReportExporter
from .models import RiskLevel

console = Console()


@click.group()
@click.version_option(package_name="pool-analyzer")
def cli():
    """数据库连接池分析工具 - 分析多服务共用Postgres的连接风险"""
    pass


@cli.command()
@click.option('--services', default='services.yaml', help='服务配置文件路径')
@click.option('--pool-configs', default='pool-configs/', help='连接池配置目录')
@click.option('--traffic', default='traffic.csv', help='流量配置文件路径')
@click.option('--db-limits', default='db-limits.yaml', help='数据库限制配置文件')
@click.option('--output', '-o', help='导出报告文件路径 (支持 .json 和 .md)')
@click.option('--format', '-f', 'fmt', type=click.Choice(['json', 'md', 'markdown']), default='md', help='输出格式')
@click.option('--no-simulate', is_flag=True, help='跳过模拟')
@click.option('--sim-duration', type=int, default=30, help='模拟时长（分钟）')
@click.option('--seed', type=int, help='随机种子')
@click.option('--quiet', '-q', is_flag=True, help='静默模式')
def analyze(
    services: str,
    pool_configs: str,
    traffic: str,
    db_limits: str,
    output: Optional[str],
    fmt: str,
    no_simulate: bool,
    sim_duration: int,
    seed: Optional[int],
    quiet: bool
):
    """分析连接池配置并生成报告"""
    
    try:
        if not quiet:
            console.print(Panel.fit(
                "[bold blue]数据库连接池分析器[/bold blue]\n"
                "[dim]分析多服务共用PostgreSQL的连接风险[/dim]",
                title="Pool Analyzer"
            ))
        
        loader = ConfigLoader()
        
        if not quiet:
            console.print(f"\n[cyan]📂 加载配置文件...[/cyan]")
        
        services_list, pool_configs_dict, traffic_profiles, db_limits_obj = loader.load_all(
            services, pool_configs, traffic, db_limits
        )
        
        if not quiet:
            console.print(f"  ✅ 加载了 {len(services_list)} 个服务")
            console.print(f"  ✅ 加载了 {len(pool_configs_dict)} 个连接池配置")
            console.print(f"  ✅ 加载了 {len(traffic_profiles)} 个流量配置")
        
        analyzer = PoolAnalyzer(services_list, pool_configs_dict, traffic_profiles, db_limits_obj)
        
        if not quiet:
            console.print(f"\n[cyan]📊 计算连接预算...[/cyan]")
        
        budgets = analyzer.calculate_connection_budgets()
        
        if not quiet:
            table = Table(title="连接预算")
            table.add_column("服务", style="cyan")
            table.add_column("实例数", justify="right")
            table.add_column("最大可能", justify="right")
            table.add_column("预期峰值", justify="right")
            table.add_column("利用率", justify="right")
            
            for budget in budgets:
                util_color = "green" if budget.utilization_ratio < 0.3 else "yellow" if budget.utilization_ratio < 0.7 else "red"
                table.add_row(
                    budget.service_name,
                    str(budget.instances),
                    str(budget.max_possible_connections),
                    f"{budget.expected_peak_connections:.1f}",
                    f"[{util_color}]{budget.utilization_ratio*100:.1f}%[/{util_color}]"
                )
            console.print(table)
        
        if not quiet:
            console.print(f"\n[cyan]⚠️  评估风险...[/cyan]")
        
        risks = analyzer.assess_risks(budgets)
        
        if not quiet:
            if risks:
                critical = [r for r in risks if r.risk_level == RiskLevel.CRITICAL]
                high = [r for r in risks if r.risk_level == RiskLevel.HIGH]
                medium = [r for r in risks if r.risk_level == RiskLevel.MEDIUM]
                
                console.print(f"  🔴 严重: {len(critical)}")
                console.print(f"  🟠 高: {len(high)}")
                console.print(f"  🟡 中: {len(medium)}")
                
                for risk in risks[:5]:
                    level_color = "red" if risk.risk_level == RiskLevel.CRITICAL else "yellow"
                    console.print(f"    [{level_color}]• {risk.description}[/{level_color}]")
                
                if len(risks) > 5:
                    console.print(f"    ... 还有 {len(risks) - 5} 个风险")
            else:
                console.print(f"  ✅ 未发现风险")
        
        simulation_results = []
        if not no_simulate:
            if not quiet:
                console.print(f"\n[cyan]🎯 运行模拟 ({sim_duration}分钟)...[/cyan]")
            
            simulation_results = analyzer.simulate(
                duration_minutes=sim_duration,
                seed=seed
            )
            
            if not quiet and simulation_results:
                max_conn = max(r.total_connections for r in simulation_results)
                total_timeouts = sum(r.timeout_events for r in simulation_results)
                total_retries = sum(r.retry_events for r in simulation_results)
                
                console.print(f"  峰值连接: {max_conn}")
                console.print(f"  超时事件: {total_timeouts}")
                console.print(f"  重试事件: {total_retries}")
        
        if not quiet:
            console.print(f"\n[cyan]📄 生成报告...[/cyan]")
        
        report = analyzer.generate_report(budgets, risks, simulation_results)
        
        if output:
            if fmt == 'json' or output.endswith('.json'):
                ReportExporter.export_json(report, output)
            else:
                ReportExporter.export_markdown(report, output)
            
            if not quiet:
                console.print(f"  ✅ 报告已导出到: [green]{output}[/green]")
        else:
            if fmt == 'json':
                print(ReportExporter.to_json(report))
            else:
                print(ReportExporter.to_markdown(report))
        
        if not quiet:
            console.print(f"\n[green]✅ 分析完成[/green]")
            console.print(f"\n摘要: {report.summary}")
    
    except Exception as e:
        console.print(f"[red]❌ 错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option('--services', default='services.yaml', help='服务配置文件路径')
@click.option('--pool-configs', default='pool-configs/', help='连接池配置目录')
@click.option('--traffic', default='traffic.csv', help='流量配置文件路径')
@click.option('--db-limits', default='db-limits.yaml', help='数据库限制配置文件')
@click.option('--duration', '-d', type=int, default=60, help='模拟时长（分钟）')
@click.option('--seed', type=int, help='随机种子')
@click.option('--output', '-o', help='导出模拟结果JSON')
def simulate(
    services: str,
    pool_configs: str,
    traffic: str,
    db_limits: str,
    duration: int,
    seed: Optional[int],
    output: Optional[str]
):
    """运行连接池使用模拟"""
    
    try:
        console.print(Panel.fit(
            "[bold green]连接池模拟[/bold green]\n"
            f"[dim]模拟时长: {duration}分钟[/dim]",
            title="Simulation"
        ))
        
        loader = ConfigLoader()
        services_list, pool_configs_dict, traffic_profiles, db_limits_obj = loader.load_all(
            services, pool_configs, traffic, db_limits
        )
        
        analyzer = PoolAnalyzer(services_list, pool_configs_dict, traffic_profiles, db_limits_obj)
        
        console.print(f"\n[cyan]🎯 运行模拟...[/cyan]")
        
        results = analyzer.simulate(
            duration_minutes=duration,
            seed=seed
        )
        
        if results:
            max_conn = max(r.total_connections for r in results)
            min_conn = min(r.total_connections for r in results)
            avg_conn = sum(r.total_connections for r in results) / len(results)
            total_timeouts = sum(r.timeout_events for r in results)
            total_retries = sum(r.retry_events for r in results)
            max_wait = max(r.wait_queue_size for r in results)
            
            table = Table(title="模拟结果统计")
            table.add_column("指标", style="cyan")
            table.add_column("值", justify="right")
            table.add_row("模拟时长", f"{len(results) * 5 // 60} 分钟")
            table.add_row("数据点数量", str(len(results)))
            table.add_row("峰值连接", str(max_conn))
            table.add_row("最低连接", str(min_conn))
            table.add_row("平均连接", f"{avg_conn:.1f}")
            table.add_row("超时事件", str(total_timeouts))
            table.add_row("重试事件", str(total_retries))
            table.add_row("最大等待队列", str(max_wait))
            
            console.print(table)
        
        if output:
            import json
            from dataclasses import asdict
            
            def convert(obj):
                if isinstance(obj, RiskLevel):
                    return obj.value
                return obj
            
            with open(output, 'w', encoding='utf-8') as f:
                json.dump([asdict(r) for r in results], f, default=convert, indent=2, ensure_ascii=False)
            console.print(f"\n[green]✅ 结果已导出到: {output}[/green]")
    
    except Exception as e:
        console.print(f"[red]❌ 错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('report_files', nargs=-1, required=True)
@click.option('--output', '-o', help='导出对比报告')
def compare(report_files, output):
    """对比多个分析报告"""
    
    try:
        import json
        
        console.print(Panel.fit(
            "[bold yellow]报告对比[/bold yellow]",
            title="Compare"
        ))
        
        reports = []
        for filepath in report_files:
            with open(filepath, 'r', encoding='utf-8') as f:
                reports.append(json.load(f))
        
        if len(reports) < 2:
            console.print("[yellow]⚠️ 至少需要2个报告才能对比[/yellow]")
            return
        
        table = Table(title="报告对比")
        table.add_column("指标", style="cyan")
        for i, report in enumerate(reports):
            table.add_column(f"报告 {i+1}", justify="right")
        
        metrics = [
            ("总服务数", "services", len),
            ("可用连接", lambda r: r['database_limits']['max_connections'] - 
                r['database_limits']['reserved_connections'] - 
                r['database_limits']['superuser_reserved_connections']),
            ("理论最大连接", "total_max_possible"),
            ("预期峰值连接", "total_expected_peak"),
            ("利用率(%)", "utilization_percentage"),
            ("风险总数", "risks", len),
        ]
        
        for metric in metrics:
            if isinstance(metric, tuple):
                if len(metric) == 3:
                    name, key, transform = metric
                elif len(metric) == 2:
                    name, key = metric
                    transform = lambda x: x
                elif callable(metric[0]):
                    name = metric[0].__name__ if hasattr(metric[0], '__name__') else "计算值"
                    transform = metric[0]
                    key = None
            else:
                name = metric
                key = metric
                transform = lambda x: x
        
        # 简化处理
        for report in reports:
            db = report['database_limits']
            available = db['max_connections'] - db['reserved_connections'] - db['superuser_reserved_connections']
            report['_available'] = available
        
        comparison_table = Table(title="关键指标对比")
        comparison_table.add_column("指标", style="cyan")
        for i, _ in enumerate(reports):
            comparison_table.add_column(f"报告 {i+1}", justify="right")
        
        comparison_metrics = [
            ("可用连接", "_available"),
            ("理论最大", "total_max_possible"),
            ("预期峰值", "total_expected_peak"),
            ("利用率(%)", "utilization_percentage"),
            ("风险数", "risks", len),
        ]
        
        for metric in comparison_metrics:
            if len(metric) == 3:
                name, key, transform = metric
            else:
                name, key = metric
                transform = lambda x: x
            
            values = []
            for r in reports:
                val = r[key] if key in r else r.get('_available', 0)
                values.append(transform(val))
            
            row = [name]
            for v in values:
                if isinstance(v, float):
                    row.append(f"{v:.1f}")
                else:
                    row.append(str(v))
            comparison_table.add_row(*row)
        
        console.print(comparison_table)
        
        if output:
            comparison_data = {
                "reports_count": len(reports),
                "report_files": report_files,
                "comparison": []
            }
            
            for i, report in enumerate(reports):
                comparison_data["comparison"].append({
                    "report_index": i + 1,
                    "file": report_files[i],
                    "report_id": report.get("report_id"),
                    "available_connections": report["_available"],
                    "total_max_possible": report["total_max_possible"],
                    "total_expected_peak": report["total_expected_peak"],
                    "utilization_percentage": report["utilization_percentage"],
                    "risks_count": len(report["risks"])
                })
            
            with open(output, 'w', encoding='utf-8') as f:
                json.dump(comparison_data, f, indent=2, ensure_ascii=False)
            console.print(f"\n[green]✅ 对比报告已导出到: {output}[/green]")
    
    except Exception as e:
        console.print(f"[red]❌ 错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.argument('report_file')
@click.option('--format', '-f', 'fmt', type=click.Choice(['json', 'md']), default='md')
@click.option('--output', '-o', help='输出文件路径')
def export(report_file, fmt, output):
    """导出报告为指定格式"""
    
    try:
        import json
        from dataclasses import asdict
        from .models import AnalysisReport, DatabaseLimits, Service, PoolConfig, TrafficProfile
        
        with open(report_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if fmt == 'json':
            if output:
                import shutil
                shutil.copy(report_file, output)
                console.print(f"[green]✅ 已复制到: {output}[/green]")
            else:
                with open(report_file, 'r', encoding='utf-8') as f:
                    print(f.read())
        else:
            console.print("[yellow]⚠️ Markdown导出需要完整的报告对象[/yellow]")
            console.print("[dim]提示: 使用 analyze 命令生成 Markdown 报告[/dim]")
    
    except Exception as e:
        console.print(f"[red]❌ 错误: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    cli()
