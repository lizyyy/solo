import click
from pathlib import Path
from typing import Optional

from . import __version__
from .models import DiveAnalysis
from .parser import CSVParser
from .buhlmann import BuhlmannModel
from .validator import DiveValidator
from .storage import DiveStorage
from .report import ReportGenerator


@click.group()
@click.version_option(version=__version__, prog_name="deco-reviewer")
def cli():
    """减压曲线复核员 - 潜水科学计算CLI工具"""
    pass


@cli.command()
@click.argument("csv_file", type=click.Path(exists=True, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), help="输出目录")
@click.option("--save/--no-save", default=True, help="保存到档案库")
@click.option("--gf-low", type=float, default=0.30, help="低梯度因子 (默认: 0.30)")
@click.option("--gf-high", type=float, default=0.85, help="高梯度因子 (默认: 0.85)")
def analyze(
    csv_file: Path,
    output: Optional[Path],
    save: bool,
    gf_low: float,
    gf_high: float,
):
    """分析潜水日志并生成报告
    
    CSV_FILE: 深度-时间CSV文件路径
    """
    click.echo(f"🔍 正在解析潜水日志: {csv_file}")
    
    parser = CSVParser()
    try:
        dive_log = parser.parse(csv_file)
    except Exception as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        raise click.Abort()
    
    click.echo(f"📊 正在计算组织压力 (Bühlmann ZH-L16C, GF={gf_low:.2f}/{gf_high:.2f})")
    
    model = BuhlmannModel(gradient_factor_low=gf_low, gradient_factor_high=gf_high)
    try:
        calc_result = model.calculate(dive_log)
    except Exception as e:
        click.echo(f"❌ 计算失败: {e}", err=True)
        raise click.Abort()
    
    click.echo(f"✅ 正在校验规则...")
    
    validator = DiveValidator()
    violations = validator.validate(dive_log, calc_result)
    
    analysis = DiveAnalysis(
        dive_log=dive_log,
        calculation_result=calc_result,
        violations=violations,
        summary={},
    )
    
    reporter = ReportGenerator()
    reporter.print_terminal_summary(analysis)
    
    if output:
        click.echo(f"📄 正在导出报告到: {output}")
        try:
            paths = reporter.export_all(analysis, output)
            click.echo(f"   ✅ Markdown: {paths['markdown']}")
            click.echo(f"   ✅ JSON: {paths['json']}")
        except Exception as e:
            click.echo(f"⚠️ 导出失败: {e}")
    
    if save:
        click.echo(f"💾 正在保存到档案库...")
        storage = DiveStorage()
        try:
            dive_path = storage.save_dive(dive_log)
            analysis_path = storage.save_analysis(analysis)
            click.echo(f"   ✅ 潜水日志: {dive_path}")
            click.echo(f"   ✅ 分析结果: {analysis_path}")
        except Exception as e:
            click.echo(f"⚠️ 保存失败: {e}")
    
    critical_count = sum(1 for v in violations if v.severity == "critical")
    if critical_count > 0:
        click.echo()
        click.echo(f"⚠️  发现 {critical_count} 个严重违规！请仔细检查报告。")
        raise click.Abort()
    
    click.echo()
    click.echo("✅ 分析完成！")


@cli.command()
def list():
    """列出所有潜水档案"""
    storage = DiveStorage()
    dives = storage.list_dives()
    
    if not dives:
        click.echo("📭 档案库为空")
        return
    
    from rich.console import Console
    from rich.table import Table
    
    console = Console()
    table = Table(title="潜水档案列表", show_header=True, header_style="bold cyan")
    
    table.add_column("#", style="dim")
    table.add_column("潜水ID")
    table.add_column("潜水员")
    table.add_column("日期")
    table.add_column("深度")
    table.add_column("时间")
    table.add_column("违规")
    
    for i, dive in enumerate(dives, 1):
        violation_style = "red" if dive["critical_count"] > 0 else "yellow" if dive["violation_count"] > 0 else "green"
        violation_text = f"{dive['violation_count']} (严重: {dive['critical_count']})" if dive["violation_count"] > 0 else "0"
        
        table.add_row(
            str(i),
            dive["dive_id"],
            dive["diver_name"],
            dive["dive_date"] or "未知",
            f"{dive['max_depth']}m" if dive["max_depth"] else "-",
            f"{dive['total_time']}min" if dive["total_time"] else "-",
            f"[{violation_style}]{violation_text}[/{violation_style}]",
        )
    
    console.print(table)
    console.print()
    console.print(f"共 {len(dives)} 条记录")


@cli.command()
@click.argument("dive_id")
@click.option("--output", "-o", type=click.Path(path_type=Path), help="重新导出报告的目录")
def show(dive_id: str, output: Optional[Path]):
    """显示指定潜水的详情
    
    DIVE_ID: 潜水ID
    """
    storage = DiveStorage()
    analysis = storage.load_analysis(dive_id)
    
    if not analysis:
        click.echo(f"❌ 未找到潜水记录: {dive_id}", err=True)
        raise click.Abort()
    
    reporter = ReportGenerator()
    reporter.print_terminal_summary(analysis)
    
    if output:
        click.echo(f"📄 正在重新导出报告到: {output}")
        try:
            paths = reporter.export_all(analysis, output)
            click.echo(f"   ✅ Markdown: {paths['markdown']}")
            click.echo(f"   ✅ JSON: {paths['json']}")
        except Exception as e:
            click.echo(f"⚠️ 导出失败: {e}")


@cli.command()
@click.argument("dive_id")
@click.confirmation_option(prompt="确定要删除这条潜水记录吗？")
def delete(dive_id: str):
    """删除潜水记录
    
    DIVE_ID: 潜水ID
    """
    storage = DiveStorage()
    
    if not storage.load_analysis(dive_id):
        click.echo(f"❌ 未找到潜水记录: {dive_id}", err=True)
        raise click.Abort()
    
    deleted = storage.delete_dive(dive_id)
    
    if deleted:
        click.echo(f"✅ 已删除潜水记录: {dive_id}")
    else:
        click.echo(f"⚠️ 删除失败")
        raise click.Abort()


@cli.command()
@click.option("--output", "-o", type=click.Path(path_type=Path), help="输出目录")
def demo(output: Optional[Path]):
    """生成演示数据并分析
    
    创建一个安全潜水和一个违规潜水的示例，用于测试工具功能。
    """
    import csv
    from datetime import datetime
    import tempfile
    
    click.echo("🎬 正在生成演示数据...")
    click.echo()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        
        safe_csv = tmpdir_path / "safe_dive.csv"
        unsafe_csv = tmpdir_path / "unsafe_dive.csv"
        
        _create_safe_dive_csv(safe_csv)
        _create_unsafe_dive_csv(unsafe_csv)
        
        click.echo("=" * 60)
        click.echo("📊 演示1: 安全潜水")
        click.echo("=" * 60)
        
        from .main import analyze_dive
        
        analysis1 = analyze_dive(
            safe_csv,
            gf_low=0.30,
            gf_high=0.85,
            save_to_storage=False,
        )
        
        reporter = ReportGenerator()
        reporter.print_terminal_summary(analysis1)
        
        click.echo()
        click.echo("=" * 60)
        click.echo("⚠️  演示2: 违规潜水 (故意包含多种违规)")
        click.echo("=" * 60)
        
        analysis2 = analyze_dive(
            unsafe_csv,
            gf_low=0.30,
            gf_high=0.85,
            save_to_storage=False,
        )
        
        reporter.print_terminal_summary(analysis2)
        
        if output:
            click.echo()
            click.echo(f"📄 正在导出演示报告到: {output}")
            output = Path(output)
            output.mkdir(parents=True, exist_ok=True)
            
            try:
                paths1 = reporter.export_all(analysis1, output)
                paths2 = reporter.export_all(analysis2, output)
                click.echo(f"   ✅ 安全潜水:")
                click.echo(f"      - Markdown: {paths1['markdown']}")
                click.echo(f"      - JSON: {paths1['json']}")
                click.echo(f"   ✅ 违规潜水:")
                click.echo(f"      - Markdown: {paths2['markdown']}")
                click.echo(f"      - JSON: {paths2['json']}")
            except Exception as e:
                click.echo(f"⚠️ 导出失败: {e}")
        
        click.echo()
        click.echo("✅ 演示完成！")
        click.echo()
        click.echo("💡 使用提示:")
        click.echo("   - 准备你自己的CSV文件，参考演示数据格式")
        click.echo("   - 使用 'deco-reviewer analyze your.csv' 分析潜水")
        click.echo("   - 使用 'deco-reviewer list' 查看档案库")


def _create_safe_dive_csv(filepath: Path):
    """创建安全潜水的演示CSV"""
    rows = [
        {"dive_id": "DEMO_SAFE_001", "diver_name": "张教练", "dive_date": "2026-05-01"},
        {"gas_type": "air", "o2_percent": "21", "n2_percent": "79", "he_percent": "0"},
        {"safety_stop_depth": "5", "safety_stop_duration": "3"},
        {"time": "", "depth": "", "temperature": ""},
        {"time": "0", "depth": "0", "temperature": "25"},
        {"time": "1", "depth": "5", "temperature": "24"},
        {"time": "2", "depth": "10", "temperature": "23"},
        {"time": "3", "depth": "15", "temperature": "22"},
        {"time": "4", "depth": "18", "temperature": "22"},
        {"time": "5", "depth": "20", "temperature": "21"},
        {"time": "10", "depth": "20", "temperature": "21"},
        {"time": "15", "depth": "20", "temperature": "21"},
        {"time": "20", "depth": "20", "temperature": "21"},
        {"time": "25", "depth": "20", "temperature": "21"},
        {"time": "26", "depth": "18", "temperature": "21"},
        {"time": "27", "depth": "15", "temperature": "22"},
        {"time": "28", "depth": "12", "temperature": "22"},
        {"time": "29", "depth": "9", "temperature": "23"},
        {"time": "30", "depth": "5", "temperature": "24"},
        {"time": "33", "depth": "5", "temperature": "24"},
        {"time": "34", "depth": "3", "temperature": "24"},
        {"time": "35", "depth": "0", "temperature": "25"},
    ]
    
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["dive_id", "diver_name", "dive_date", "gas_type", "o2_percent", "n2_percent", "he_percent", "safety_stop_depth", "safety_stop_duration", "time", "depth", "temperature"])
        writer.writeheader()
        writer.writerows(rows)


def _create_unsafe_dive_csv(filepath: Path):
    """创建违规潜水的演示CSV（故意包含多种违规）"""
    rows = [
        {"dive_id": "DEMO_UNSAFE_001", "diver_name": "李学员", "dive_date": "2026-05-01"},
        {"gas_type": "nitrox", "o2_percent": "32", "n2_percent": "68", "he_percent": "0"},
        {"surface_interval_minutes": "30"},
        {"time": "", "depth": "", "temperature": ""},
        {"time": "0", "depth": "0", "temperature": "25"},
        {"time": "1", "depth": "10", "temperature": "24"},
        {"time": "2", "depth": "20", "temperature": "23"},
        {"time": "3", "depth": "30", "temperature": "22"},
        {"time": "4", "depth": "35", "temperature": "21"},
        {"time": "10", "depth": "35", "temperature": "21"},
        {"time": "15", "depth": "35", "temperature": "21"},
        {"time": "20", "depth": "35", "temperature": "21"},
        {"time": "25", "depth": "35", "temperature": "21"},
        {"time": "30", "depth": "35", "temperature": "21"},
        {"time": "35", "depth": "35", "temperature": "21"},
        {"time": "40", "depth": "35", "temperature": "21"},
        {"time": "41", "depth": "25", "temperature": "22"},
        {"time": "42", "depth": "15", "temperature": "23"},
        {"time": "43", "depth": "5", "temperature": "24"},
        {"time": "44", "depth": "0", "temperature": "25"},
    ]
    
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["dive_id", "diver_name", "dive_date", "gas_type", "o2_percent", "n2_percent", "he_percent", "safety_stop_depth", "safety_stop_duration", "surface_interval_minutes", "time", "depth", "temperature"])
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    cli()
