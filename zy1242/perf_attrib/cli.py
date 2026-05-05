"""
性能归因 CLI 工具 - 主入口
"""

import os
import sys
from datetime import datetime
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from perf_attrib import __version__
from perf_attrib.errors import format_error, suggest_solution
from perf_attrib.database import get_session, init_db, Analysis

console = Console()


@click.group()
@click.version_option(__version__)
@click.option("--db-path", type=str, default=None, 
              help="数据库文件路径 (默认为 ~/.perf_attrib.db)")
@click.pass_context
def main(ctx, db_path):
    """
    Python 性能优化归因 CLI 工具
    
    用于分析 Python 代码性能问题，支持多种性能数据格式的分析、对比和报告生成。
    
    示例:
        perf-attrib init                    # 生成样例文件
        perf-attrib analyze cprofile.prof  # 分析 cProfile 数据
        perf-attrib compare 1 2            # 对比两次分析
        perf-attrib export 1 -f markdown # 导出报告
    """
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path
    
    if db_path:
        init_db(db_path)
    else:
        init_db()


@main.command()
@click.pass_context
@click.option("--output-dir", "-o", type=str, default="./perf_examples",
              help="样例文件输出目录")
@click.option("--force", "-f", is_flag=True, default=False,
              help="强制覆盖已存在的文件")
def init(ctx, output_dir, force):
    """
    生成样例文件，帮助快速上手
    
    创建包含示例:
        - 一个慢 Python 脚本样例
        - cProfile 输出样例
        - py-spy 采样样例
        - pytest-benchmark 结果样例
    """
    from perf_attrib.init import generate_examples
    
    try:
        result = generate_examples(output_dir, force)
        
        if result["success"]:
            console.print(Panel.fit(
                f"[green]✅ 样例文件已生成到: {output_dir}[/green]",
                title="初始化成功"
            ))
            console.print("\n样例文件列表:")
            for f in result["files"]:
                console.print(f"  • {f}")
            console.print("\n使用示例:")
            console.print(f"  perf-attrib analyze {output_dir}/cprofile_example.prof")
            console.print(f"  perf-attrib analyze {output_dir}/pystats_example.json --type pystats")
            console.print(f"  perf-attrib analyze {output_dir}/benchmark_example.json --type benchmark")
        else:
            console.print(f"[yellow]⚠️  {result['message']}[/yellow]")
            
    except Exception as e:
        console.print(format_error(e))
        suggestion = suggest_solution(e)
        if suggestion:
            console.print(f"\n[cyan]💡 建议:[/cyan] {suggestion}")
        sys.exit(1)


@main.command()
@click.pass_context
@click.argument("input_file", type=str)
@click.option("--type", "-t", "data_type", type=str, default=None,
              help="数据类型: cprofile, pystats, benchmark, timeit")
@click.option("--name", "-n", type=str, default=None,
              help="分析名称")
@click.option("--notes", type=str, default=None,
              help="分析备注")
@click.option("--source-path", "-s", type=str, default=None,
              help="源码路径，用于读取关键源码片段")
@click.option("--baseline", "-b", type=int, default=None,
              help="基线分析 ID，用于回归检测")
@click.option("--save/--no-save", default=True,
              help="是否保存到数据库")
@click.option("--show-details/--no-show-details", default=True,
              help="是否显示详细分析结果")
def analyze(ctx, input_file, data_type, name, notes, source_path, baseline, save, show_details):
    """
    分析性能数据文件
    
    支持的数据格式:
        - cProfile/pstats 二进制文件
        - py-spy JSON 输出
        - pytest-benchmark JSON 结果
        - timeit 输出
    
    示例:
        perf-attrib analyze profile.prof
        perf-attrib analyze pystats.json --type pystats
        perf-attrib analyze benchmark.json --type benchmark
    """
    from perf_attrib.analyzer import analyze_file, detect_data_type
    
    try:
        if not os.path.exists(input_file):
            raise FileNotFoundError(f"文件不存在: {input_file}")
        
        if data_type is None:
            data_type = detect_data_type(input_file)
            console.print(f"[cyan]🔍 检测到数据类型: {data_type}[/cyan]")
        
        if name is None:
            name = f"分析_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        console.print(f"[cyan]📊 正在分析: {input_file}[/cyan]")
        
        result = analyze_file(
            input_file=input_file,
            data_type=data_type,
            name=name,
            notes=notes,
            source_path=source_path,
            baseline_id=baseline,
            save_to_db=save,
            db_path=ctx.obj.get("db_path")
        )
        
        if show_details:
            _display_analysis_result(result)
        
        if result.get("analysis_id"):
            console.print(f"\n[green]✅ 分析已保存，ID: {result['analysis_id']}[/green]")
        
        return result
        
    except Exception as e:
        console.print(format_error(e))
        suggestion = suggest_solution(e)
        if suggestion:
            console.print(f"\n[cyan]💡 建议:[/cyan] {suggestion}")
        sys.exit(1)


@main.command()
@click.pass_context
@click.argument("analysis_id_1", type=int)
@click.argument("analysis_id_2", type=int)
@click.option("--name", "-n", type=str, default=None,
              help="对比名称")
@click.option("--notes", type=str, default=None,
              help="对比备注")
@click.option("--show-details/--no-show-details", default=True,
              help="是否显示详细对比结果")
def compare(ctx, analysis_id_1, analysis_id_2, name, notes, show_details):
    """
    对比两次分析结果，识别回归和改进
    
    示例:
        perf-attrib compare 1 2
        perf-attrib compare 1 2 --name "优化前后对比"
    """
    from perf_attrib.comparison import compare_analyses
    
    try:
        console.print(f"[cyan]🔄 正在对比分析 {analysis_id_1} vs {analysis_id_2}[/cyan]")
        
        result = compare_analyses(
            analysis_id_1=analysis_id_1,
            analysis_id_2=analysis_id_2,
            name=name,
            notes=notes,
            db_path=ctx.obj.get("db_path")
        )
        
        if show_details:
            _display_comparison_result(result)
        
        return result
        
    except Exception as e:
        console.print(format_error(e))
        suggestion = suggest_solution(e)
        if suggestion:
            console.print(f"\n[cyan]💡 建议:[/cyan] {suggestion}")
        sys.exit(1)


@main.command()
@click.pass_context
@click.argument("analysis_id", type=int)
@click.option("--format", "-f", "export_format", type=str, default="markdown",
              help="导出格式: markdown, json")
@click.option("--output", "-o", type=str, default=None,
              help="输出文件路径")
@click.option("--include-code/--no-include-code", default=True,
              help="是否包含源码片段")
@click.option("--include-suggestions/--no-include-suggestions", default=True,
              help="是否包含优化建议")
def export(ctx, analysis_id, export_format, output, include_code, include_suggestions):
    """
    导出分析报告
    
    示例:
        perf-attrib export 1
        perf-attrib export 1 -f json -o report.json
        perf-attrib export 1 -f markdown -o report.md
    """
    from perf_attrib.exporter import export_analysis
    
    try:
        console.print(f"[cyan]📤 正在导出分析 {analysis_id} 为 {export_format} 格式[/cyan]")
        
        result = export_analysis(
            analysis_id=analysis_id,
            export_format=export_format,
            output_path=output,
            include_code=include_code,
            include_suggestions=include_suggestions,
            db_path=ctx.obj.get("db_path")
        )
        
        if result["output_path"]:
            console.print(f"[green]✅ 报告已导出到: {result['output_path']}[/green]")
        else:
            console.print(result["content"])
        
        return result
        
    except Exception as e:
        console.print(format_error(e))
        suggestion = suggest_solution(e)
        if suggestion:
            console.print(f"\n[cyan]💡 建议:[/cyan] {suggestion}")
        sys.exit(1)


@main.command()
@click.pass_context
@click.option("--limit", "-n", type=int, default=10,
              help="显示最近的 N 条记录")
@click.option("--all", "-a", is_flag=True, default=False,
              help="显示所有记录")
def list(ctx, limit, all):
    """
    列出所有保存的分析记录
    
    示例:
        perf-attrib list
        perf-attrib list -n 20
        perf-attrib list --all
    """
    try:
        session = get_session(db_path=ctx.obj.get("db_path"))
        
        query = session.query(Analysis).order_by(Analysis.timestamp.desc())
        
        if not all:
            query = query.limit(limit)
        
        analyses = query.all()
        
        if not analyses:
            console.print("[yellow]⚠️ 没有找到分析记录[/yellow]")
            console.print("使用 `perf-attrib init` 生成样例并开始分析")
            return
        
        table = Table(title="分析记录")
        table.add_column("ID", style="cyan", no_wrap=True)
        table.add_column("名称", style="magenta")
        table.add_column("时间", style="green")
        table.add_column("版本", style="yellow")
        table.add_column("备注", style="dim")
        
        for analysis in analyses:
            table.add_row(
                str(analysis.id),
                analysis.name or "未命名",
                analysis.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                analysis.version or "-",
                analysis.notes or "-"
            )
        
        console.print(table)
        
        session.close()
        
    except Exception as e:
        console.print(format_error(e))
        sys.exit(1)


@main.command()
@click.pass_context
@click.argument("analysis_id", type=int)
def show(ctx, analysis_id):
    """
    显示单个分析的详细信息
    
    示例:
        perf-attrib show 1
    """
    try:
        from perf_attrib.analyzer import get_analysis_details
        
        console.print(f"[cyan]📋 正在获取分析 {analysis_id} 的详细信息[/cyan]")
        
        result = get_analysis_details(
            analysis_id=analysis_id,
            db_path=ctx.obj.get("db_path")
        )
        
        _display_analysis_result(result)
        
    except Exception as e:
        console.print(format_error(e))
        sys.exit(1)


def _display_analysis_result(result):
    """
    显示分析结果
    """
    console.print("\n" + "=" * 60)
    console.print(f"[bold cyan]分析报告: {result.get('name', '未命名')}[/bold cyan]")
    console.print("=" * 60)
    
    summary = result.get("summary", {})
    
    if summary.get("total_functions"):
        console.print(f"\n[bold]📊 函数统计:[/bold]")
        console.print(f"  总函数数: {summary['total_functions']}")
        console.print(f"  总调用次数: {summary.get('total_calls', '-')}")
        console.print(f"  总耗时: {summary.get('total_time', '-')} 秒")
    
    if result.get("hotspots"):
        console.print(f"\n[bold yellow]🔥 热点函数 (Top 5):[/bold yellow]")
        table = Table()
        table.add_column("函数", style="cyan")
        table.add_column("类型", style="magenta")
        table.add_column("评分", style="yellow")
        table.add_column("严重程度", style="red")
        
        for hotspot in result["hotspots"][:5]:
            table.add_row(
                hotspot.get("function", "-"),
                hotspot.get("type", "-"),
                f"{hotspot.get('score', 0):.2f}",
                hotspot.get("severity", "medium")
            )
        
        console.print(table)
    
    if result.get("suggestions"):
        console.print(f"\n[bold green]💡 优化建议:[/bold green]")
        for i, suggestion in enumerate(result["suggestions"][:3], 1):
            console.print(f"\n{i}. [{suggestion.get('priority', 'medium')} - {suggestion.get('title', '-')}")
            console.print(f"   {suggestion.get('description', '-')}")
    
    if result.get("regressions"):
        console.print(f"\n[bold red]⚠️  回归检测:[/bold red]")
        for reg in result["regressions"]:
            console.print(f"  • {reg.get('function')}: {reg.get('change', '+0')}%")


def _display_comparison_result(result):
    """
    显示对比结果
    """
    console.print("\n" + "=" * 60)
    console.print(f"[bold cyan]对比报告: {result.get('name', '对比分析')}[/bold cyan]")
    console.print("=" * 60)
    
    summary = result.get("summary", {})
    
    console.print(f"\n[bold]📊 总体变化:[/bold]")
    console.print(f"  总耗时变化: {summary.get('total_time_change', '-')}%")
    console.print(f"  函数调用变化: {summary.get('calls_change', '-')}%")
    
    improvements = result.get("improvements", [])
    if improvements:
        console.print(f"\n[bold green]✅ 改进 ({len(improvements)} 项):[/bold green]")
        for imp in improvements[:5]:
            console.print(f"  • {imp.get('function', '-')}: {imp.get('improvement', '-')}%")
    
    regressions = result.get("regressions", [])
    if regressions:
        console.print(f"\n[bold red]⚠️  回归 ({len(regressions)} 项):[/bold red]")
        for reg in regressions[:5]:
            console.print(f"  • {reg.get('function', '-')}: {reg.get('regression', '-')}%")


if __name__ == "__main__":
    main()
