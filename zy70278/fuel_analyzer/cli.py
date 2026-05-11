import click
import os
from datetime import date, timedelta
from rich.console import Console
from rich.panel import Panel

from .data_loader import DataLoader, SampleDataGenerator
from .validator import DataValidator
from .analyzer import FuelAnalyzer
from .anomaly_detector import AnomalyDetector
from .reporter import Reporter

console = Console()


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """
    环卫车辆油耗异常分析工具
    
    用于分析环卫车辆油耗数据，检测异常并生成报告。
    """
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output-dir', '-o', default='./reports', help='报告输出目录')
@click.option('--format', '-f', type=click.Choice(['console', 'excel', 'csv', 'all']), 
              default='all', help='报告格式')
@click.option('--show-anomalies-only', is_flag=True, help='仅显示异常记录')
def analyze(input_file, output_dir, format, show_anomalies_only):
    """
    分析油耗数据并生成报告
    
    INPUT_FILE: 输入的CSV或Excel文件路径
    """
    console.print(Panel.fit(
        "[bold blue]环卫车辆油耗异常分析工具[/bold blue]\n"
        f"分析文件: {input_file}",
        border_style="blue"
    ))
    
    try:
        file_ext = os.path.splitext(input_file)[1].lower()
        
        if file_ext == '.csv':
            df = DataLoader.load_csv(input_file)
        elif file_ext in ['.xlsx', '.xls']:
            df = DataLoader.load_excel(input_file)
        else:
            console.print(f"[red]错误: 不支持的文件格式 {file_ext}[/red]")
            return
        
        missing_cols = DataLoader.validate_columns(df)
        if missing_cols:
            console.print(f"[yellow]警告: 缺失必要字段: {', '.join(missing_cols)}[/yellow]")
        
        console.print(f"[green]✓ 数据加载成功，共 {len(df)} 条记录[/green]")
        
        validator = DataValidator()
        validation_result = validator.validate(df)
        console.print(f"[green]✓ 数据校验完成[/green]")
        
        analyzer = FuelAnalyzer()
        valid_df = validation_result.valid_rows
        fuel_analyses = analyzer.analyze(valid_df)
        analysis_summary = analyzer.get_summary_statistics(fuel_analyses)
        console.print(f"[green]✓ 油耗分析完成[/green]")
        
        anomaly_detector = AnomalyDetector()
        anomalies = anomaly_detector.detect_all(df, validation_result, fuel_analyses)
        console.print(f"[green]✓ 异常检测完成，发现 {len(anomalies)} 条异常[/green]")
        
        reporter = Reporter(output_dir=output_dir)
        
        if format in ['console', 'all']:
            reporter.generate_console_report(
                df, validation_result, fuel_analyses,
                anomalies, analysis_summary
            )
        
        if format in ['excel', 'all']:
            reporter.generate_excel_report(
                df, validation_result, fuel_analyses,
                anomalies, analysis_summary
            )
        
        if format in ['csv', 'all']:
            reporter.generate_csv_reports(
                df, validation_result, fuel_analyses, anomalies
            )
        
        console.print("\n[bold green]✓ 分析完成！[/bold green]")
        
    except Exception as e:
        console.print(f"[red]分析过程中出错: {str(e)}[/red]")
        raise


@cli.command()
@click.option('--type', '-t', 
              type=click.Choice(['normal', 'duplicates', 'missing', 'manual', 'all']),
              default='normal',
              help='样例类型')
@click.option('--output', '-o', default='./samples', help='输出目录')
@click.option('--days', '-d', default=7, help='生成天数')
def generate(type, output, days):
    """
    生成样例数据
    
    类型说明:
    - normal: 正常数据
    - duplicates: 包含重复数据
    - missing: 包含缺失字段
    - manual: 包含人工改错
    - all: 包含所有异常类型
    """
    os.makedirs(output, exist_ok=True)
    
    start_date = date(2024, 1, 1)
    
    generator = SampleDataGenerator()
    base_df = generator.generate_normal_data(start_date, days=days)
    
    if type == 'normal':
        df = base_df
        filename = 'sample_normal.csv'
    elif type == 'duplicates':
        df = generator.generate_with_duplicates(base_df)
        filename = 'sample_duplicates.csv'
    elif type == 'missing':
        df = generator.generate_with_missing_fields(base_df)
        filename = 'sample_missing_fields.csv'
    elif type == 'manual':
        df = generator.generate_with_manual_errors(base_df)
        filename = 'sample_manual_errors.csv'
    else:
        df = generator.generate_all_anomalies(base_df)
        filename = 'sample_all_anomalies.csv'
    
    output_path = os.path.join(output, filename)
    df.to_csv(output_path, index=False, encoding='utf-8')
    
    console.print(f"[green]✓ 样例数据已生成: {output_path}[/green]")
    console.print(f"  记录数: {len(df)} 条")
    console.print(f"  类型: {type}")


@cli.command()
@click.option('--output', '-o', default='./samples', help='输出目录')
@click.option('--days', '-d', default=7, help='生成天数')
def generate_all(output, days):
    """
    生成所有类型的样例数据
    """
    os.makedirs(output, exist_ok=True)
    
    start_date = date(2024, 1, 1)
    
    generator = SampleDataGenerator()
    base_df = generator.generate_normal_data(start_date, days=days)
    
    samples = {
        'sample_normal.csv': base_df,
        'sample_duplicates.csv': generator.generate_with_duplicates(base_df),
        'sample_missing_fields.csv': generator.generate_with_missing_fields(base_df),
        'sample_manual_errors.csv': generator.generate_with_manual_errors(base_df),
        'sample_all_anomalies.csv': generator.generate_all_anomalies(base_df),
    }
    
    for filename, df in samples.items():
        output_path = os.path.join(output, filename)
        df.to_csv(output_path, index=False, encoding='utf-8')
        console.print(f"[green]✓ {filename}: {len(df)} 条记录[/green]")
    
    console.print(f"\n[bold green]所有样例数据已生成到: {output}[/bold green]")


@cli.command()
def demo():
    """
    运行完整演示流程
    """
    console.print(Panel.fit(
        "[bold blue]环卫车辆油耗异常分析 - 完整演示[/bold blue]",
        border_style="blue"
    ))
    
    samples_dir = './samples'
    reports_dir = './reports'
    
    os.makedirs(samples_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)
    
    console.print("\n[bold]步骤 1/4: 生成样例数据...[/bold]")
    start_date = date(2024, 1, 1)
    generator = SampleDataGenerator()
    base_df = generator.generate_normal_data(start_date, days=7)
    
    samples = {
        '正常数据': generator.generate_normal_data(start_date, days=7),
        '含重复数据': generator.generate_with_duplicates(base_df),
        '含缺失字段': generator.generate_with_missing_fields(base_df),
        '含人工改错': generator.generate_with_manual_errors(base_df),
        '综合异常数据': generator.generate_all_anomalies(base_df),
    }
    
    for name, df in samples.items():
        path = os.path.join(samples_dir, f'{name}.csv'.replace(' ', '_'))
        df.to_csv(path, index=False, encoding='utf-8')
        console.print(f"[green]  ✓ {name}: {len(df)} 条记录[/green]")
    
    console.print("\n[bold]步骤 2/4: 分析综合异常数据...[/bold]")
    
    all_anomaly_file = os.path.join(samples_dir, '综合异常数据.csv')
    
    df = DataLoader.load_csv(all_anomaly_file)
    
    validator = DataValidator()
    validation_result = validator.validate(df)
    
    analyzer = FuelAnalyzer()
    valid_df = validation_result.valid_rows
    fuel_analyses = analyzer.analyze(valid_df)
    analysis_summary = analyzer.get_summary_statistics(fuel_analyses)
    
    anomaly_detector = AnomalyDetector()
    anomalies = anomaly_detector.detect_all(df, validation_result, fuel_analyses)
    
    console.print(f"[green]  ✓ 分析完成[/green]")
    console.print(f"  总记录数: {len(df)}")
    console.print(f"  有效记录: {len(valid_df)}")
    console.print(f"  异常数量: {len(anomalies)}")
    
    console.print("\n[bold]步骤 3/4: 生成报告...[/bold]")
    
    reporter = Reporter(output_dir=reports_dir)
    reporter.generate_console_report(
        df, validation_result, fuel_analyses, anomalies, analysis_summary
    )
    
    excel_path = reporter.generate_excel_report(
        df, validation_result, fuel_analyses, anomalies, analysis_summary
    )
    csv_files = reporter.generate_csv_reports(
        df, validation_result, fuel_analyses, anomalies
    )
    
    console.print("\n[bold]步骤 4/4: 演示完成[/bold]")
    console.print(Panel.fit(
        "[bold green]✓ 演示完成！[/bold green]\n\n"
        f"生成的报告:\n"
        f"  - Excel报告: {excel_path}\n"
        f"  - CSV报告: {reports_dir}\n"
        f"  - 样例数据: {samples_dir}",
        border_style="green"
    ))


@cli.command()
def info():
    """
    显示工具信息和计算口径
    """
    console.print(Panel.fit(
        "[bold blue]环卫车辆油耗异常分析工具[/bold blue]\n\n"
        "[bold]功能特性:[/bold]\n"
        "  • 数据质量校验（重复、缺失、异常值\n"
        "  • 油耗分析（结合里程、载重、怠速）\n"
        "  • 异常检测（人工改错识别）\n"
        "  • 多格式报告生成\n\n"
        "[bold]计算口径:[/bold]\n"
        "  • 期望油耗 = 基础油耗 + 载重影响 + 怠速影响\n"
        "  • 百公里油耗 = 实际油耗 ÷ 路线里程 × 100\n"
        "  • 油耗偏差 = (实际 - 期望) ÷ 期望 × 100%\n\n"
        "[bold]异常阈值:[/bold]\n"
        "  • 油耗偏差 ±30%\n"
        "  • 百公里油耗超出正常范围",
        border_style="blue"
    ))


if __name__ == '__main__':
    cli()