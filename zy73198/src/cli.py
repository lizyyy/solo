"""命令行工具 - 教研编辑阿宁看README能知道先跑哪条命令"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint

from .parameter_manager import ParameterManager
from .chart_explainer import ChartExplainer
from .data_lineage import DataLineageTracker
from .material_packer import MaterialPacker

app = typer.Typer(help="优化调参图表解释系统")
console = Console()

DEFAULT_DATA_FILE = "data/parameters.json"


def _load_or_create_manager(data_file: str) -> ParameterManager:
    """加载或创建参数管理器"""
    path = Path(data_file)
    if path.exists():
        return ParameterManager.load(str(path))
    return ParameterManager()


def _save_manager(manager: ParameterManager, data_file: str) -> None:
    """保存参数管理器"""
    path = Path(data_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    manager.save(str(path))


def _get_version_by_name(manager: ParameterManager, version_name: str) -> Optional[str]:
    """通过版本名称获取版本ID"""
    for v in manager.list_versions():
        if v.version_name == version_name:
            return v.version_id
    return None


@app.command()
def import_params(
    params: str = typer.Option(..., help="参数字典，如 '{\"分子\": 10, \"分母\": 5}'"),
    source_type: str = typer.Option(..., help="来源类型，如 excel、manual、api"),
    source_id: str = typer.Option(..., help="来源ID，如文件名或表名"),
    source_name: str = typer.Option(..., help="来源名称，用于显示"),
    raw_data: str = typer.Option(..., help="原始数据JSON，保留原始痕迹"),
    created_by: str = typer.Option(..., help="创建人姓名"),
    version_name: Optional[str] = typer.Option(None, help="版本名称，如 v1"),
    change_description: str = typer.Option("", help="变更描述"),
    change_reason: str = typer.Option("", help="调参原因"),
    notes: str = typer.Option("", help="备注"),
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """导入参数，创建新版本 - 保留原始来源，避免脏数据被修得看不出痕迹"""
    manager = _load_or_create_manager(data_file)
    
    try:
        params_dict = json.loads(params)
        raw_data_dict = json.loads(raw_data)
    except json.JSONDecodeError as e:
        console.print(f"[red]JSON解析错误: {e}[/red]")
        raise typer.Exit(code=1)
    
    version = manager.import_parameters(
        parameters=params_dict,
        source_type=source_type,
        source_id=source_id,
        source_name=source_name,
        raw_data=raw_data_dict,
        created_by=created_by,
        version_name=version_name,
        change_description=change_description,
        change_reason=change_reason,
        notes=notes,
    )
    
    _save_manager(manager, data_file)
    
    console.print(Panel.fit(
        f"[green]✓ 参数导入成功[/green]\n\n"
        f"版本名称: {version.version_name}\n"
        f"版本ID: {version.version_id}\n"
        f"来源: {version.source.source_name}\n"
        f"创建人: {version.created_by}\n"
        f"参数数量: {len(version.parameters)}",
        title="导入成功",
        border_style="green",
    ))


@app.command()
def timeline(
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """查看版本时间线 - 先看这份历史时间线，了解哪一步让结果变化"""
    manager = _load_or_create_manager(data_file)
    timeline_data = manager.get_version_timeline()
    
    if not timeline_data:
        console.print("[yellow]暂无版本记录，请先导入参数[/yellow]")
        return
    
    table = Table(title="📊 版本时间线", show_lines=True)
    table.add_column("步", style="cyan", no_wrap=True)
    table.add_column("版本", style="bold blue")
    table.add_column("创建时间", style="dim")
    table.add_column("创建人", style="magenta")
    table.add_column("来源", style="green")
    table.add_column("变更描述", style="yellow")
    table.add_column("状态", style="bold")
    
    for item in timeline_data:
        status = "[blue]◉ 当前[/blue]" if item["is_active"] else "○"
        table.add_row(
            str(item["step"]),
            item["version_name"],
            item["created_at"],
            item["created_by"],
            item["source"],
            item["change_description"] or "-",
            status,
        )
    
    console.print(table)
    
    if len(timeline_data) > 0:
        console.print("\n[dim]💡 提示: 运行 'python -m src.cli explain --version <版本名>' 查看详细解释[/dim]")


@app.command()
def explain(
    version: str = typer.Option(..., help="版本名称，如 v1"),
    title: str = typer.Option("优化调参图表解释", help="解释标题"),
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """生成图表解释 - 社区公示前要能讲给不看代码的人听"""
    manager = _load_or_create_manager(data_file)
    version_id = _get_version_by_name(manager, version)
    
    if version_id is None:
        console.print(f"[red]版本 '{version}' 不存在[/red]")
        raise typer.Exit(code=1)
    
    explainer = ChartExplainer(manager)
    explanation = explainer.explain(version_id=version_id, title=title)
    
    console.print(Panel.fit(
        f"[bold]{explanation.title}[/bold]\n\n"
        f"[dim]版本: {explanation.version_name} | 生成时间: {explanation.generated_at.strftime('%Y-%m-%d %H:%M:%S')}[/dim]",
        border_style="blue",
    ))
    
    console.print(Panel(
        explanation.plain_language_summary,
        title="📝 通俗易懂的解释",
        border_style="cyan",
    ))
    
    if explanation.key_findings:
        table = Table(title="🎯 关键结论", show_header=False)
        for finding in explanation.key_findings:
            table.add_row(f"• {finding}")
        console.print(table)
    
    if explanation.boundary_issues:
        console.print("\n[bold red]⚠️  边界问题:[/bold red]")
        for issue in explanation.boundary_issues:
            color = "red" if issue.severity == "high" else "yellow"
            console.print(Panel(
                f"[{color}]{issue.message}[/{color}]\n\n"
                f"[bold]处理建议:[/bold]\n{issue.suggestion}",
                title=f"{issue.issue_type} ({issue.severity})",
                border_style=color,
            ))
    
    if explanation.calculation_steps:
        console.print("\n[bold]🔢 计算过程:[/bold]")
        for step in explanation.calculation_steps:
            console.print(Panel(
                f"[bold]{step.step_name}[/bold]\n"
                f"{step.description}\n\n"
                f"[dim]公式: {step.formula}[/dim]\n"
                f"输入: {step.inputs}\n"
                f"[green]结果: {step.output}[/green]",
                border_style="dim",
            ))


@app.command()
def trace(
    param: str = typer.Option(..., help="参数名称，如 分母"),
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """追溯坏数据来源 - 接手的人能顺着提示回到参数表的原始对象"""
    manager = _load_or_create_manager(data_file)
    explainer = ChartExplainer(manager)
    tracker = DataLineageTracker(manager)
    
    result = explainer.trace_bad_data(param)
    
    if not result["found"]:
        console.print(f"[red]{result['message']}[/red]")
        raise typer.Exit(code=1)
    
    console.print(Panel.fit(
        f"[bold]参数: {param}[/bold]\n"
        f"当前值: [yellow]{result['current_value']}[/yellow]",
        title="📌 参数溯源",
        border_style="magenta",
    ))
    
    table = Table(title="📜 历史变更记录", show_lines=True)
    table.add_column("版本", style="cyan")
    table.add_column("值", style="yellow")
    table.add_column("来源", style="green")
    table.add_column("时间", style="dim")
    table.add_column("录入人", style="magenta")
    
    for entry in result["history"]:
        table.add_row(
            entry["version_name"],
            str(entry["value"]),
            entry["source_name"],
            entry["created_at"],
            entry["created_by"],
        )
    
    console.print(table)
    
    first = result["first_occurrence"]
    console.print(Panel(
        f"[bold]首次出现信息:[/bold]\n"
        f"版本: {first['version_name']}\n"
        f"来源: {first['source_name']} (ID: {first['source_id']})\n"
        f"录入时间: {first['created_at']}\n"
        f"录入人: {first['created_by']}\n\n"
        f"[bold]原始数据:[/bold]\n"
        f"{json.dumps(first['raw_data'], ensure_ascii=False, indent=2)}",
        title="🔍 首次出现",
        border_style="yellow",
    ))
    
    console.print(Panel(
        result["suggestion"],
        title="💡 处理建议",
        border_style="green",
    ))
    
    graph = tracker.get_lineage_graph(param)
    tree = Tree(f"[bold]{param}[/bold] 溯源图 (共 {graph['total_versions']} 个版本)")
    for node in graph["nodes"]:
        node_tree = tree.add(
            f"[{node['version']}] {node['label']} "
            f"([dim]{node['created_at']}[/dim] by [magenta]{node['created_by']}[/magenta])"
        )
        node_tree.add(f"来源: {node['source']}")
    
    console.print("\n[bold]🌳 溯源关系图:[/bold]")
    console.print(tree)


@app.command()
def compare(
    version1: str = typer.Option(..., help="第一个版本名称"),
    version2: str = typer.Option(..., help="第二个版本名称"),
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """比较两个版本 - 排班同事要能看出哪一步让结果变化"""
    manager = _load_or_create_manager(data_file)
    
    vid1 = _get_version_by_name(manager, version1)
    vid2 = _get_version_by_name(manager, version2)
    
    if vid1 is None or vid2 is None:
        console.print("[red]版本不存在[/red]")
        raise typer.Exit(code=1)
    
    explainer = ChartExplainer(manager)
    exp1 = explainer.explain(version_id=vid1)
    exp2 = explainer.explain(version_id=vid2)
    
    comparison = explainer.compare_explanations(exp1.explanation_id, exp2.explanation_id)
    
    console.print(Panel.fit(
        f"[bold]比较结果[/bold]\n"
        f"{comparison['version1']} → {comparison['version2']}",
        title="🔄 版本对比",
        border_style="blue",
    ))
    
    for diff in comparison["key_differences"]:
        rprint(f"  {diff}")
    
    param_changes = manager.compare_versions(vid1, vid2)
    if param_changes:
        table = Table(title="📝 参数变更详情", show_lines=True)
        table.add_column("变更类型", style="bold")
        table.add_column("参数", style="cyan")
        table.add_column("原值", style="red")
        table.add_column("新值", style="green")
        table.add_column("说明", style="dim")
        
        for change in param_changes:
            type_style = {
                "新增": "green",
                "删除": "red",
                "修改": "yellow",
            }.get(change.change_type, "white")
            
            table.add_row(
                f"[{type_style}]{change.change_type}[/{type_style}]",
                change.param_name,
                str(change.old_value) if change.old_value is not None else "-",
                str(change.new_value) if change.new_value is not None else "-",
                change.description,
            )
        
        console.print(table)


@app.command()
def package(
    name: str = typer.Option(..., help="材料包名称，如 6月调参结果公示"),
    output: str = typer.Option("./output", help="输出目录"),
    version: Optional[str] = typer.Option(None, help="指定版本，默认当前版本"),
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """打包现场材料包 - 带一包像现场会收到的材料就行"""
    manager = _load_or_create_manager(data_file)
    explainer = ChartExplainer(manager)
    tracker = DataLineageTracker(manager)
    packer = MaterialPacker(manager, explainer, tracker)
    
    version_id = None
    if version:
        version_id = _get_version_by_name(manager, version)
        if version_id is None:
            console.print(f"[red]版本 '{version}' 不存在[/red]")
            raise typer.Exit(code=1)
    
    package = packer.package(package_name=name, output_dir=output, version_id=version_id)
    
    console.print(Panel.fit(
        f"[green]✓ 材料包打包成功[/green]\n\n"
        f"路径: {package.output_dir}\n"
        f"材料数量: {len(package.materials)} 份",
        title="📦 打包完成",
        border_style="green",
    ))
    
    table = Table(title="📋 材料清单", show_header=False)
    for mat in package.materials:
        table.add_row(f"  • {mat['name']}: [cyan]{mat['file']}[/cyan]")
    console.print(table)
    
    console.print(
        f"\n[dim]💡 先打开 [/dim][bold cyan]{package.output_dir}/00_材料包说明.md[/bold cyan][dim] 查看使用指南[/dim]"
    )


@app.command()
def demo(
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """生成演示数据 - 快速体验系统功能"""
    manager = ParameterManager()
    
    raw_data1 = {"分子": 25, "分母": 100, "备注": "原始录入数据，来自Excel表格"}
    manager.import_parameters(
        parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
        source_type="excel",
        source_id="data_20240601.xlsx",
        source_name="6月1日数据表格",
        raw_data=raw_data1,
        created_by="阿宁",
        version_name="v1",
        change_description="初始参数导入",
        change_reason="首次录入",
        notes="教研编辑阿宁提供的原始数据",
    )
    
    raw_data2 = {"分子": 30, "分母": 100, "备注": "修正后的数据"}
    manager.import_parameters(
        parameters={"分子": 30, "分母": 100, "总数": 550, "样本量": 50},
        source_type="excel",
        source_id="data_20240601.xlsx",
        source_name="6月1日数据表格",
        raw_data=raw_data2,
        created_by="阿宁",
        version_name="v2",
        change_description="修正分子和总数",
        change_reason="发现原始数据录入错误，分子应为30",
    )
    
    raw_data3 = {"分子": 30, "分母": 0, "备注": "分母错误地设为0"}
    manager.import_parameters(
        parameters={"分子": 30, "分母": 0, "总数": 550, "样本量": 50, "A值": 85, "B值": 70},
        source_type="manual",
        source_id="manual_input_001",
        source_name="手动录入",
        raw_data=raw_data3,
        created_by="排班同事",
        version_name="v3",
        change_description="添加A值和B值，分母意外设为0",
        change_reason="测试除零边界处理",
        notes="用于测试边界条件",
    )
    
    _save_manager(manager, data_file)
    
    console.print(Panel.fit(
        "[green]✓ 演示数据生成成功[/green]\n\n"
        "已创建3个版本，包含:\n"
        "  • v1: 初始参数\n"
        "  • v2: 修正分子和总数\n"
        "  • v3: 添加A/B值，分母设为0（测试除零边界）\n\n"
        "[bold]下一步可以运行:[/bold]\n"
        "  python -m src.cli timeline\n"
        "  python -m src.cli explain --version v3\n"
        "  python -m src.cli compare --version1 v1 --version2 v2\n"
        "  python -m src.cli trace --param 分母\n"
        "  python -m src.cli package --name '演示材料包' --output ./output",
        title="🎬 演示数据",
        border_style="green",
    ))


@app.command()
def versions(
    data_file: str = typer.Option(DEFAULT_DATA_FILE, help="数据文件路径"),
):
    """列出所有版本"""
    manager = _load_or_create_manager(data_file)
    versions = manager.list_versions()
    
    if not versions:
        console.print("[yellow]暂无版本记录[/yellow]")
        return
    
    table = Table(title="📋 所有版本")
    table.add_column("版本名称", style="bold cyan")
    table.add_column("版本ID", style="dim")
    table.add_column("创建时间", style="dim")
    table.add_column("创建人", style="magenta")
    table.add_column("参数数量", style="right")
    table.add_column("当前", style="center")
    
    active_id = manager.get_active_version().version_id if manager.get_active_version() else None
    
    for v in versions:
        is_active = "✓" if v.version_id == active_id else ""
        table.add_row(
            v.version_name,
            v.version_id[:8] + "...",
            v.created_at.strftime("%Y-%m-%d %H:%M"),
            v.created_by,
            str(len(v.parameters)),
            is_active,
        )
    
    console.print(table)


if __name__ == "__main__":
    app()
