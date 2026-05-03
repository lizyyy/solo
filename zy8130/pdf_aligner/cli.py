"""
CLI入口模块 - 命令行界面
"""
import sys
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from . import __version__
from .parse_validator import ParseValidator, TemplateConfig, BusinessData, PageSize, FieldConfig
from .coordinate_transformer import CoordinateTransformer, CoordinateSystem
from .pdf_renderer import PDFRenderer, RenderMode
from .issue_rules import IssueDetector, ReviewReport, IssueSeverity


console = Console()


def get_sample_dir() -> Path:
    """获取示例数据目录"""
    return Path(__file__).parent.parent / "samples"


def print_banner():
    """打印欢迎横幅"""
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║           PDF 表单套打校准器 v{__version__}                          ║
║           PDF Form Alignment & Preview Tool                    ║
╚══════════════════════════════════════════════════════════════╝
"""
    console.print(banner, style="bold blue")


def print_summary(
    template: TemplateConfig,
    business_data_list: List[BusinessData],
    report: Optional[ReviewReport] = None
):
    """打印摘要信息"""
    table = Table(title="处理摘要", show_header=True, header_style="bold magenta")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    
    table.add_row("模板名称", template.name)
    table.add_row("页面尺寸", f"{template.page_size.value} ({'横向' if template.orientation == 'landscape' else '纵向'})")
    table.add_row("总字段数", str(len(template.fields)))
    table.add_row("总记录数", str(len(business_data_list)))
    
    if report:
        table.add_row("严重问题", f"[red]{report.critical_count}[/red]")
        table.add_row("警告问题", f"[yellow]{report.warning_count}[/yellow]")
        table.add_row("信息提示", f"[blue]{report.info_count}[/blue]")
    
    console.print(table)


def load_template(
    template_config_path: Optional[str],
    coordinates_csv_path: Optional[str],
    page_size: str = "A4",
    validator: Optional[ParseValidator] = None
) -> TemplateConfig:
    """
    加载模板配置
    
    优先使用JSON配置，如果没有则使用CSV坐标文件
    """
    if validator is None:
        validator = ParseValidator()
    
    if template_config_path:
        # 使用JSON配置
        console.print(f"[cyan]正在加载模板配置: {template_config_path}[/cyan]")
        template = validator.parse_template_config(template_config_path)
        
        # 如果同时提供了CSV，合并字段
        if coordinates_csv_path:
            console.print(f"[cyan]正在合并CSV坐标: {coordinates_csv_path}[/cyan]")
            csv_fields = validator.parse_coordinates_csv(coordinates_csv_path)
            # 合并：CSV中的字段会覆盖JSON中的同名字段
            existing_names = {f.name for f in template.fields}
            for field in csv_fields:
                if field.name in existing_names:
                    # 替换
                    for i, f in enumerate(template.fields):
                        if f.name == field.name:
                            template.fields[i] = field
                            break
                else:
                    template.fields.append(field)
        
        return template
    
    elif coordinates_csv_path:
        # 只使用CSV
        console.print(f"[cyan]正在加载坐标CSV: {coordinates_csv_path}[/cyan]")
        fields = validator.parse_coordinates_csv(coordinates_csv_path)
        
        # 创建默认模板配置
        try:
            ps = PageSize(page_size.upper())
        except ValueError:
            console.print(f"[yellow]警告: 未知页面尺寸 '{page_size}'，使用 A4[/yellow]")
            ps = PageSize.A4
        
        return TemplateConfig(
            name="CSV Template",
            page_size=ps,
            fields=fields
        )
    
    else:
        raise click.UsageError("必须提供 --template-config 或 --coordinates-csv 参数")


def load_business_data(
    data_path: str,
    validator: Optional[ParseValidator] = None
) -> List[BusinessData]:
    """加载业务数据"""
    if validator is None:
        validator = ParseValidator()
    
    console.print(f"[cyan]正在加载业务数据: {data_path}[/cyan]")
    return validator.parse_business_data(data_path)


@click.group()
@click.version_option(__version__, '-v', '--version')
def cli():
    """
    PDF 表单套打校准器 - 本地命令行工具
    
    用于预览和校准PDF表单套打，支持：
    - 字段位置预览
    - 越界检测
    - 二维码遮挡检测
    - 问题报告生成
    """
    pass


@cli.command()
@click.option('--template-config', '-t', type=click.Path(exists=True), help='模板配置JSON文件路径')
@click.option('--coordinates-csv', '-c', type=click.Path(exists=True), help='字段坐标CSV文件路径')
@click.option('--business-data', '-d', type=click.Path(exists=True), required=True, help='业务数据文件路径（JSON或CSV）')
@click.option('--output', '-o', type=click.Path(), help='输出PDF文件路径')
@click.option('--page-size', '-p', default='A4', type=click.Choice(['A4', 'Letter']), help='页面尺寸（仅使用CSV时有效）')
@click.option('--mode', '-m', default='preview', type=click.Choice(['production', 'preview', 'debug']), help='渲染模式')
@click.option('--coordinate-system', '-s', default='top_left', type=click.Choice(['pdf', 'top_left']), help='坐标系类型')
@click.option('--report', '-r', type=click.Path(), help='问题报告输出路径（Markdown）')
@click.option('--margin-threshold', type=float, default=20.0, help='边缘检测阈值（pt）')
@click.option('--skip-check', is_flag=True, help='跳过问题检查')
def preview(
    template_config: Optional[str],
    coordinates_csv: Optional[str],
    business_data: str,
    output: Optional[str],
    page_size: str,
    mode: str,
    coordinate_system: str,
    report: Optional[str],
    margin_threshold: float,
    skip_check: bool
):
    """
    预览PDF套打效果
    
    生成带字段边框的预览PDF，并执行问题检查。
    """
    print_banner()
    
    validator = ParseValidator()
    transformer = CoordinateTransformer()
    renderer = PDFRenderer()
    detector = IssueDetector()
    
    try:
        # 1. 加载模板
        template = load_template(template_config, coordinates_csv, page_size, validator)
        
        # 2. 加载业务数据
        data_list = load_business_data(business_data, validator)
        
        # 3. 确定输出路径
        if output is None:
            data_path = Path(business_data)
            output = str(data_path.parent / f"{data_path.stem}_preview.pdf")
        
        # 4. 确定坐标系
        cs = CoordinateSystem.PDF if coordinate_system == 'pdf' else CoordinateSystem.TOP_LEFT
        
        # 5. 确定渲染模式
        render_mode = {
            'production': RenderMode.PRODUCTION,
            'preview': RenderMode.PREVIEW,
            'debug': RenderMode.DEBUG
        }[mode]
        
        # 6. 执行问题检查
        review_report = None
        if not skip_check:
            console.print("\n[cyan]正在执行问题检查...[/cyan]")
            review_report = detector.analyze_all(
                template, data_list, cs, margin_threshold
            )
            
            # 打印检查结果
            if review_report.has_critical_issues():
                console.print(f"\n[red]⚠️ 发现 {review_report.critical_count} 个严重问题！[/red]")
            elif review_report.warning_count > 0:
                console.print(f"\n[yellow]ℹ️ 发现 {review_report.warning_count} 个警告[/yellow]")
            else:
                console.print("\n[green]✅ 所有检查通过[/green]")
        
        # 7. 打印摘要
        print_summary(template, data_list, review_report)
        
        # 8. 生成预览PDF
        console.print(f"\n[cyan]正在生成预览PDF: {output}[/cyan]")
        
        result = renderer.generate_pdf(
            output,
            template,
            data_list,
            render_mode,
            cs
        )
        
        if result.success:
            console.print(f"\n[green]✅ 预览PDF已生成: {output}[/green]")
            console.print(f"[green]   页面数量: {result.page_count}[/green]")
            
            if result.warnings:
                console.print(f"\n[yellow]警告:[/yellow]")
                for w in result.warnings:
                    console.print(f"  - {w}")
        else:
            console.print(f"\n[red]❌ PDF生成失败[/red]")
            for e in result.errors:
                console.print(f"  - {e}")
            sys.exit(1)
        
        # 9. 保存报告
        if review_report and report:
            console.print(f"\n[cyan]正在生成问题报告: {report}[/cyan]")
            if review_report.save_markdown(report):
                console.print(f"[green]✅ 问题报告已保存: {report}[/green]")
            else:
                console.print(f"[red]❌ 报告保存失败[/red]")
        
        # 10. 最终状态
        if review_report and review_report.has_critical_issues():
            console.print(f"\n[bold red]⚠️ 存在严重问题，建议修复后再进行套打[/bold red]")
            sys.exit(2)
        
    except Exception as e:
        console.print(f"\n[red]❌ 处理失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option('--template-config', '-t', type=click.Path(exists=True), help='模板配置JSON文件路径')
@click.option('--coordinates-csv', '-c', type=click.Path(exists=True), help='字段坐标CSV文件路径')
@click.option('--business-data', '-d', type=click.Path(exists=True), required=True, help='业务数据文件路径（JSON或CSV）')
@click.option('--output', '-o', type=click.Path(), help='输出PDF文件路径')
@click.option('--page-size', '-p', default='A4', type=click.Choice(['A4', 'Letter']), help='页面尺寸（仅使用CSV时有效）')
@click.option('--coordinate-system', '-s', default='top_left', type=click.Choice(['pdf', 'top_left']), help='坐标系类型')
@click.option('--force', '-f', is_flag=True, help='即使存在严重问题也强制生成')
def render(
    template_config: Optional[str],
    coordinates_csv: Optional[str],
    business_data: str,
    output: Optional[str],
    page_size: str,
    coordinate_system: str,
    force: bool
):
    """
    渲染最终PDF（生产模式）
    
    执行问题检查后，生成不带边框的最终PDF。
    默认情况下，如果存在严重问题会阻止生成。
    """
    print_banner()
    
    validator = ParseValidator()
    renderer = PDFRenderer()
    detector = IssueDetector()
    
    try:
        # 1. 加载模板
        template = load_template(template_config, coordinates_csv, page_size, validator)
        
        # 2. 加载业务数据
        data_list = load_business_data(business_data, validator)
        
        # 3. 确定输出路径
        if output is None:
            data_path = Path(business_data)
            output = str(data_path.parent / f"{data_path.stem}_output.pdf")
        
        # 4. 确定坐标系
        cs = CoordinateSystem.PDF if coordinate_system == 'pdf' else CoordinateSystem.TOP_LEFT
        
        # 5. 执行问题检查
        console.print("\n[cyan]正在执行问题检查...[/cyan]")
        review_report = detector.analyze_all(template, data_list, cs)
        
        # 6. 打印摘要
        print_summary(template, data_list, review_report)
        
        # 7. 检查是否允许生成
        if review_report.has_critical_issues() and not force:
            console.print(f"\n[bold red]❌ 存在 {review_report.critical_count} 个严重问题，阻止生成[/bold red]")
            console.print("[yellow]使用 --force 参数可以强制生成，但不建议这样做[/yellow]")
            sys.exit(2)
        
        # 8. 生成PDF
        console.print(f"\n[cyan]正在生成最终PDF: {output}[/cyan]")
        
        result = renderer.generate_pdf(
            output,
            template,
            data_list,
            RenderMode.PRODUCTION,
            cs
        )
        
        if result.success:
            console.print(f"\n[green]✅ 最终PDF已生成: {output}[/green]")
            console.print(f"[green]   页面数量: {result.page_count}[/green]")
            
            if review_report.has_critical_issues():
                console.print(f"\n[yellow]⚠️ 注意：此PDF是在存在严重问题的情况下强制生成的[/yellow]")
        else:
            console.print(f"\n[red]❌ PDF生成失败[/red]")
            for e in result.errors:
                console.print(f"  - {e}")
            sys.exit(1)
        
    except Exception as e:
        console.print(f"\n[red]❌ 处理失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option('--template-config', '-t', type=click.Path(exists=True), help='模板配置JSON文件路径')
@click.option('--coordinates-csv', '-c', type=click.Path(exists=True), help='字段坐标CSV文件路径')
@click.option('--business-data', '-d', type=click.Path(exists=True), help='业务数据文件路径（JSON或CSV）')
@click.option('--output', '-o', type=click.Path(), help='问题报告输出路径（Markdown）')
@click.option('--page-size', '-p', default='A4', type=click.Choice(['A4', 'Letter']), help='页面尺寸（仅使用CSV时有效）')
@click.option('--coordinate-system', '-s', default='top_left', type=click.Choice(['pdf', 'top_left']), help='坐标系类型')
@click.option('--margin-threshold', type=float, default=20.0, help='边缘检测阈值（pt）')
@click.option('--json', is_flag=True, help='输出JSON格式')
def check(
    template_config: Optional[str],
    coordinates_csv: Optional[str],
    business_data: Optional[str],
    output: Optional[str],
    page_size: str,
    coordinate_system: str,
    margin_threshold: float,
    json: bool
):
    """
    检查模板和数据问题
    
    只执行问题检查，不生成PDF。
    """
    print_banner()
    
    validator = ParseValidator()
    detector = IssueDetector()
    
    try:
        # 1. 加载模板
        template = load_template(template_config, coordinates_csv, page_size, validator)
        
        # 2. 加载业务数据（如果提供）
        data_list = []
        if business_data:
            data_list = load_business_data(business_data, validator)
        else:
            # 创建空数据用于静态检查
            from .parse_validator import BusinessData as BD
            data_list = [BD(id="static_check", fields={})]
        
        # 3. 确定坐标系
        cs = CoordinateSystem.PDF if coordinate_system == 'pdf' else CoordinateSystem.TOP_LEFT
        
        # 4. 执行检查
        console.print("\n[cyan]正在执行问题检查...[/cyan]")
        review_report = detector.analyze_all(template, data_list, cs, margin_threshold)
        
        # 5. 打印摘要
        print_summary(template, data_list, review_report)
        
        # 6. 输出详细问题
        if json:
            import json as json_module
            output_data = {
                "template_name": review_report.template_name,
                "page_size": review_report.page_size,
                "total_records": review_report.total_records,
                "total_fields": review_report.total_fields,
                "critical_count": review_report.critical_count,
                "warning_count": review_report.warning_count,
                "info_count": review_report.info_count,
                "issues": [issue.to_dict() for issue in review_report.issues],
                "generated_at": review_report.generated_at
            }
            console.print("\n[cyan]问题详情（JSON）:[/cyan]")
            rprint(json_module.dumps(output_data, indent=2, ensure_ascii=False))
        else:
            # 按严重程度输出
            for severity, title in [
                (IssueSeverity.CRITICAL, "🔴 严重问题"),
                (IssueSeverity.WARNING, "🟡 警告问题"),
                (IssueSeverity.INFO, "🔵 信息提示"),
            ]:
                issues = review_report.get_issues_by_severity(severity)
                if issues:
                    console.print(f"\n[bold]{title} ({len(issues)}个):[/bold]")
                    for issue in issues:
                        console.print(f"\n{issue.to_markdown()}")
        
        # 7. 保存报告
        if output:
            console.print(f"\n[cyan]正在保存问题报告: {output}[/cyan]")
            if review_report.save_markdown(output):
                console.print(f"[green]✅ 问题报告已保存: {output}[/green]")
            else:
                console.print(f"[red]❌ 报告保存失败[/red]")
        
        # 8. 退出码
        if review_report.has_critical_issues():
            sys.exit(2)
        
    except Exception as e:
        console.print(f"\n[red]❌ 检查失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option('--output-dir', '-o', type=click.Path(), help='输出目录')
@click.option('--show-report', is_flag=True, help='显示报告内容')
def demo(output_dir: Optional[str], show_report: bool):
    """
    运行演示示例
    
    使用内置的示例数据生成预览PDF和问题报告。
    """
    print_banner()
    
    sample_dir = get_sample_dir()
    
    # 确定输出目录
    if output_dir is None:
        output_dir = Path.cwd() / "demo_output"
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    console.print(f"[cyan]演示模式[/cyan]")
    console.print(f"[cyan]示例数据目录: {sample_dir}[/cyan]")
    console.print(f"[cyan]输出目录: {output_dir}[/cyan]")
    
    # 查找示例文件
    template_config = sample_dir / "template_config.json"
    coordinates_csv = sample_dir / "field_coordinates.csv"
    business_data = sample_dir / "business_data.json"
    
    # 检查示例文件是否存在
    if not template_config.exists() and not coordinates_csv.exists():
        console.print(f"\n[red]❌ 未找到示例配置文件[/red]")
        console.print(f"[yellow]请确保以下文件存在:[/yellow]")
        console.print(f"  - {template_config} 或 {coordinates_csv}")
        console.print(f"  - {business_data}")
        sys.exit(1)
    
    if not business_data.exists():
        console.print(f"\n[red]❌ 未找到示例数据文件: {business_data}[/red]")
        sys.exit(1)
    
    # 构建参数
    args = []
    if template_config.exists():
        args.extend(['--template-config', str(template_config)])
    if coordinates_csv.exists():
        args.extend(['--coordinates-csv', str(coordinates_csv)])
    
    args.extend([
        '--business-data', str(business_data),
        '--output', str(output_dir / "demo_preview.pdf"),
        '--report', str(output_dir / "review_report.md"),
        '--mode', 'preview'
    ])
    
    console.print(f"\n[cyan]执行命令: pdf-aligner preview {' '.join(args)}[/cyan]")
    
    # 调用preview命令
    from click.testing import CliRunner
    runner = CliRunner()
    
    result = runner.invoke(preview, args[1:])  # 去掉第一个参数（preview）
    
    if result.exit_code == 0:
        console.print(f"\n[green]✅ 演示完成！[/green]")
        console.print(f"\n[cyan]生成的文件:[/cyan]")
        console.print(f"  - 预览PDF: {output_dir / 'demo_preview.pdf'}")
        console.print(f"  - 问题报告: {output_dir / 'review_report.md'}")
        
        if show_report:
            report_path = output_dir / "review_report.md"
            if report_path.exists():
                console.print(f"\n[cyan]报告内容:[/cyan]")
                console.print("-" * 60)
                with open(report_path, 'r', encoding='utf-8') as f:
                    console.print(f.read())
                console.print("-" * 60)
    else:
        console.print(f"\n[red]❌ 演示执行失败[/red]")
        console.print(result.output)
        sys.exit(result.exit_code)


if __name__ == '__main__':
    cli()
