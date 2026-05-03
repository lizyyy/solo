import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click

from . import __version__
from .config import (
    ProjectConfig,
    load_config,
    save_config,
    create_default_config,
    ensure_data_dirs,
)
from .parser import LogParser, PlanParser
from .storage import DataStorage
from .analyzer import PowerAnalyzer
from .exporter import ReportExporter
from .models import (
    Risk,
    RiskSeverity,
    RiskType,
    ReviewStatus,
)


def get_config_or_exit():
    config = load_config()
    if config is None:
        click.echo(
            "错误: 未找到配置文件，请先运行 'power-checker init' 初始化项目",
            err=True,
        )
        sys.exit(1)
    return config


@click.group()
@click.version_option(__version__)
@click.pass_context
def cli(ctx):
    """临电负载对账员 - 剧场临时电力负载对账工具"""
    ctx.ensure_object(dict)


@cli.command()
@click.option("--name", default="未命名项目", help="项目名称")
@click.pass_context
def init(ctx, name):
    """初始化项目配置"""
    existing_config = load_config()
    
    if existing_config:
        click.echo(f"项目已存在: {existing_config.project_name}")
        if not click.confirm("是否覆盖？", default=False):
            return

    config = create_default_config(name)
    save_config(config)
    ensure_data_dirs(config)
    
    click.echo(f"✅ 项目初始化完成: {name}")
    click.echo(f"📁 配置文件: {get_config_path_display()}")
    click.echo("")
    click.echo("可用回路配置:")
    for c in config.circuits:
        click.echo(f"  - {c.id}: {c.name} (相{C.phase}, 额定{c.rated_current}A)")
    click.echo("")
    click.echo("下一步:")
    click.echo("  1. 修改 .power_checker.json 配置回路信息")
    click.echo("  2. power-checker import-log <log.csv> 导入仪表日志")
    click.echo("  3. power-checker import-plan <plan.csv> 导入设备计划")
    click.echo("  4. power-checker analyze 执行负载分析")


@cli.command("import-log")
@click.argument("csv_file", type=click.Path(exists=True))
@click.pass_context
def import_log(ctx, csv_file):
    """导入配电箱电流日志CSV"""
    config = get_config_or_exit()
    
    click.echo(f"📂 正在解析: {csv_file}")
    
    parser = LogParser(config)
    
    try:
        valid_records, quarantined_records, parse_risks = parser.parse_file(csv_file)
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        sys.exit(1)

    storage = DataStorage(config)
    
    if valid_records:
        saved_path = storage.save_log_records(valid_records, csv_file)
        click.echo(f"✅ 导入有效记录: {len(valid_records)} 条")
        if saved_path:
            click.echo(f"📁 保存至: {saved_path}")
    
    if quarantined_records:
        quar_path = storage.save_quarantined_logs(quarantined_records, csv_file)
        click.echo(f"⚠️ 隔离异常记录: {len(quarantined_records)} 条")
        if quar_path:
            click.echo(f"📁 隔离文件: {quar_path}")
    
    if parse_risks:
        click.echo("")
        click.echo("解析问题汇总:")
        by_type = {}
        for r in parse_risks:
            t = r.risk_type.value
            by_type[t] = by_type.get(t, 0) + 1
        
        for t, count in by_type.items():
            click.echo(f"  - {t}: {count} 条")


@cli.command("import-plan")
@click.argument("csv_file", type=click.Path(exists=True))
@click.pass_context
def import_plan(ctx, csv_file):
    """导入设备上电/下电计划CSV"""
    config = get_config_or_exit()
    
    click.echo(f"📂 正在解析: {csv_file}")
    
    parser = PlanParser(config)
    
    try:
        valid_records, quarantined_records, parse_risks = parser.parse_file(csv_file)
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        sys.exit(1)

    storage = DataStorage(config)
    
    if valid_records:
        saved_path = storage.save_plan_records(valid_records, csv_file)
        click.echo(f"✅ 导入有效记录: {len(valid_records)} 条")
        if saved_path:
            click.echo(f"📁 保存至: {saved_path}")
    
    if quarantined_records:
        quar_path = storage.save_quarantined_plans(quarantined_records, csv_file)
        click.echo(f"⚠️ 隔离异常记录: {len(quarantined_records)} 条")
        if quar_path:
            click.echo(f"📁 隔离文件: {quar_path}")
    
    if parse_risks:
        click.echo("")
        click.echo("解析问题汇总:")
        by_type = {}
        for r in parse_risks:
            t = r.risk_type.value
            by_type[t] = by_type.get(t, 0) + 1
        
        for t, count in by_type.items():
            click.echo(f"  - {t}: {count} 条")


@cli.command()
@click.option("--window", "-w", type=int, help="时间窗口(分钟), 默认为配置值")
@click.pass_context
def analyze(ctx, window):
    """执行负载分析"""
    config = get_config_or_exit()
    storage = DataStorage(config)
    
    log_records = storage.load_log_records()
    plan_records = storage.load_plan_records()
    
    if not log_records:
        click.echo("❌ 没有找到日志记录，请先运行 import-log", err=True)
        sys.exit(1)
    
    click.echo(f"📊 开始分析...")
    click.echo(f"   日志记录: {len(log_records)} 条")
    click.echo(f"   计划记录: {len(plan_records)} 条")
    
    time_window = window or config.time_window_minutes
    click.echo(f"   时间窗口: {time_window} 分钟")
    
    analyzer = PowerAnalyzer(config)
    result = analyzer.analyze(
        log_records=log_records,
        plan_records=plan_records,
        time_window_minutes=time_window,
    )
    
    saved_path = storage.save_analysis_result(result)
    click.echo(f"")
    click.echo(f"✅ 分析完成!")
    click.echo(f"📁 结果保存: {saved_path}")
    
    summary = result.summary
    click.echo("")
    click.echo("风险汇总:")
    click.echo(f"   总计: {summary['total_risks']} 个风险")
    click.echo(f"   严重: {summary['by_severity'].get('critical', 0)}")
    click.echo(f"   高: {summary['by_severity'].get('high', 0)}")
    click.echo(f"   中: {summary['by_severity'].get('medium', 0)}")
    click.echo(f"   低: {summary['by_severity'].get('low', 0)}")
    
    if result.peak_loads:
        click.echo("")
        click.echo("峰值负载:")
        for circuit_id, peak in result.peak_loads.items():
            circuit_config = next(
                (c for c in config.circuits if c.id == circuit_id),
                None,
            )
            if circuit_config:
                pct = (peak / circuit_config.rated_current * 100) if circuit_config.rated_current > 0 else 0
                status = "⚠️" if pct > 100 else "✅"
                click.echo(f"   {status} {circuit_id} ({circuit_config.name}): {peak:.2f}A ({pct:.1f}%)")
    
    click.echo("")
    click.echo("下一步:")
    click.echo("  - power-checker review 进行风险复核")
    click.echo("  - power-checker export 导出分析报告")


@cli.command()
@click.option("--risk-id", "-r", help="指定风险ID进行操作")
@click.option("--confirm", "-c", is_flag=True, help="确认风险")
@click.option("--ignore", "-i", is_flag=True, help="忽略风险")
@click.option("--note", "-n", help="复核备注")
@click.option("--list", "-l", "list_all", is_flag=True, help="列出所有风险")
@click.pass_context
def review(ctx, risk_id, confirm, ignore, note, list_all):
    """复核风险（可确认或忽略）"""
    config = get_config_or_exit()
    storage = DataStorage(config)
    
    result = storage.load_latest_analysis()
    if not result:
        click.echo("❌ 没有找到分析结果，请先运行 analyze", err=True)
        sys.exit(1)
    
    reviewed_risks = storage.load_review_state() or []
    reviewed_map = {r.id: r for r in reviewed_risks}
    
    if list_all:
        _print_risk_list(result.all_risks, reviewed_map)
        return
    
    if not risk_id:
        _print_risk_list(result.all_risks, reviewed_map)
        click.echo("")
        click.echo("使用方式:")
        click.echo("  power-checker review -r <risk_id> -c   # 确认风险")
        click.echo("  power-checker review -r <risk_id> -i   # 忽略风险")
        click.echo("  power-checker review -r <risk_id> -c -n '备注'  # 带备注确认")
        return
    
    target_risk = next((r for r in result.all_risks if r.id == risk_id), None)
    if not target_risk:
        click.echo(f"❌ 未找到风险ID: {risk_id}", err=True)
        sys.exit(1)
    
    if confirm and ignore:
        click.echo("❌ 不能同时使用 --confirm 和 --ignore", err=True)
        sys.exit(1)
    
    if not confirm and not ignore:
        click.echo("当前风险详情:")
        click.echo(f"  ID: {target_risk.id}")
        click.echo(f"  类型: {target_risk.risk_type.value}")
        click.echo(f"  等级: {target_risk.severity.value}")
        click.echo(f"  消息: {target_risk.message}")
        click.echo(f"  时间: {target_risk.timestamp}")
        if target_risk.details:
            click.echo(f"  详情: {target_risk.details}")
        
        reviewed = reviewed_map.get(target_risk.id)
        if reviewed:
            click.echo(f"  复核状态: {reviewed.review_status.value}")
            if reviewed.review_note:
                click.echo(f"  复核备注: {reviewed.review_note}")
        return
    
    existing = reviewed_map.get(target_risk.id, target_risk)
    
    if confirm:
        existing.review_status = ReviewStatus.CONFIRMED
        click.echo(f"✅ 风险已确认: {target_risk.id}")
    elif ignore:
        existing.review_status = ReviewStatus.IGNORED
        click.echo(f"❌ 风险已忽略: {target_risk.id}")
    
    if note:
        existing.review_note = note
        click.echo(f"📝 备注已设置: {note}")
    
    reviewed_map[existing.id] = existing
    storage.save_review_state(list(reviewed_map.values()))
    
    click.echo(f"💾 复核状态已保存")


@cli.command()
@click.option("--output", "-o", default="report", help="输出文件名(不含扩展名)")
@click.option("--format", "-f", "fmt", type=click.Choice(["md", "csv", "both"]), default="both",
              help="输出格式: md(Markdown), csv, 或 both")
@click.pass_context
def export(ctx, output, fmt):
    """导出Markdown复核报告和CSV风险清单"""
    config = get_config_or_exit()
    storage = DataStorage(config)
    
    result = storage.load_latest_analysis()
    if not result:
        click.echo("❌ 没有找到分析结果，请先运行 analyze", err=True)
        sys.exit(1)
    
    reviewed_risks = storage.load_review_state()
    
    exporter = ReportExporter(config)
    
    output_base = Path(output)
    
    if fmt in ["md", "both"]:
        md_path = str(output_base.with_suffix(".md"))
        saved_md = exporter.export_markdown(result, md_path, reviewed_risks)
        click.echo(f"✅ Markdown报告已导出: {saved_md}")
    
    if fmt in ["csv", "both"]:
        csv_path = str(output_base.with_suffix(".csv"))
        saved_csv = exporter.export_risk_csv(result, csv_path, reviewed_risks)
        click.echo(f"✅ CSV风险清单已导出: {saved_csv}")


def _print_risk_list(risks: List[Risk], reviewed_map: dict):
    if not risks:
        click.echo("没有找到风险记录")
        return
    
    severity_order = {
        RiskSeverity.CRITICAL: 0,
        RiskSeverity.HIGH: 1,
        RiskSeverity.MEDIUM: 2,
        RiskSeverity.LOW: 3,
    }
    type_names = {
        RiskType.SUSTAINED_OVERLOAD: "持续超载",
        RiskType.PHASE_IMBALANCE: "三相不平衡",
        RiskType.UNPLANNED_POWER: "计划外上电",
        RiskType.TIME_DEVIATION: "时间偏差",
    }
    
    sorted_risks = sorted(risks, key=lambda r: (severity_order.get(r.severity, 99), r.timestamp))
    
    click.echo("风险列表:")
    click.echo("-" * 100)
    click.echo(f"{'ID':<10} {'等级':<6} {'类型':<10} {'状态':<6} {'消息'}")
    click.echo("-" * 100)
    
    for r in sorted_risks:
        reviewed = reviewed_map.get(r.id)
        status = reviewed.review_status.value if reviewed else "pending"
        status_icon = {
            "pending": "⏳",
            "confirmed": "✅",
            "ignored": "❌",
        }.get(status, "⏳")
        
        click.echo(
            f"{r.id[:8]:<10} "
            f"{r.severity.value:<6} "
            f"{type_names.get(r.risk_type, r.risk_type.value):<10} "
            f"{status_icon:<6} "
            f"{r.message[:50]}{'...' if len(r.message) > 50 else ''}"
        )


def get_config_path_display() -> str:
    from .config import DEFAULT_CONFIG_NAME
    return f"{Path.cwd()}/{DEFAULT_CONFIG_NAME}"


if __name__ == "__main__":
    cli()
