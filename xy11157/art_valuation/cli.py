import click
import pandas as pd
import logging
import os
import sys
from datetime import datetime

from .valuation_engine import ValuationEngine


def setup_logging(level: str = "INFO", log_file: str = None):
    log_level = getattr(logging, level.upper(), logging.INFO)
    
    handlers = [logging.StreamHandler(sys.stdout)]
    if log_file:
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=handlers,
    )


@click.group()
@click.version_option(version="1.0.0", prog_name="art-valuation")
def main():
    """艺术品寄存库保险估值 CLI 工具
    
    用于艺术品寄存库的保险估值处理，支持币种转换、临时出库调整、断点续跑等功能。
    """
    pass


@main.command()
@click.argument("input_file", type=click.Path(exists=True, readable=True))
@click.option(
    "--output", "-o", type=click.Path(), default="valuation_result.xlsx", help="输出文件路径"
)
@click.option(
    "--config", "-c", type=click.Path(exists=True), default=None, help="配置文件路径"
)
@click.option(
    "--resume", "-r", is_flag=True, default=False, help="从上次中断处继续处理"
)
@click.option(
    "--format", "-f", type=click.Choice(["xlsx", "csv"]), default=None, help="输出格式"
)
@click.option(
    "--log-level", type=click.Choice(["DEBUG", "INFO", "WARNING", "ERROR"]), default="INFO"
)
def run(input_file, output, config, resume, format, log_level):
    """执行艺术品保险估值
    
    INPUT_FILE: 输入的艺术品数据文件路径 (CSV 或 Excel 格式)
    """
    setup_logging(log_level)
    logger = logging.getLogger(__name__)
    
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo(click.style("   艺术品寄存库保险估值工具", fg="cyan", bold=True))
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo()
    
    try:
        engine = ValuationEngine(config)
        
        if format:
            engine.config["output"]["format"] = format
        
        logger.info(f"开始处理输入文件: {input_file}")
        
        if input_file.endswith(".csv"):
            df = pd.read_csv(input_file, dtype={"艺术品编号": str})
        else:
            df = pd.read_excel(input_file, dtype={"艺术品编号": str})
        
        click.echo(f"输入数据行数: {len(df)}")
        click.echo(f"输入数据列数: {len(df.columns)}")
        click.echo()
        
        if resume:
            click.echo(click.style("断点续跑模式: 跳过已处理的记录", fg="yellow"))
            click.echo(
                f"已处理记录数: {len(engine.progress.get('processed_ids', []))}"
            )
            click.echo()
        
        success_df, failed_df = engine.process_data(df, resume)
        
        summary = engine.generate_summary(success_df, failed_df)
        
        output_path = engine.save_output(success_df, failed_df, summary, output)
        
        click.echo(click.style("处理完成!", fg="green", bold=True))
        click.echo()
        click.echo(click.style("估值汇总:", fg="cyan", bold=True))
        click.echo(f"  处理总数: {summary['处理总数']}")
        click.echo(
            f"  成功: {click.style(str(summary['成功数量']), fg='green')} | "
            f"失败: {click.style(str(summary['失败数量']), fg='red')} | "
            f"成功率: {summary['成功率']}%"
        )
        click.echo()
        click.echo(f"  总估值: ¥{summary['总估值(CNY)']:,.2f}")
        click.echo(f"  总保险保费: ¥{summary['总保险保费(CNY)']:,.2f}")
        click.echo(f"  平均估值: ¥{summary['平均估值(CNY)']:,.2f}")
        click.echo()
        click.echo(f"  临时出库数量: {summary['临时出库数量']}")
        click.echo(f"  临时出库总估值: ¥{summary['临时出库总估值(CNY)']:,.2f}")
        click.echo()
        
        if summary["币种分布"]:
            click.echo(click.style("币种分布:", fg="cyan", bold=True))
            for currency, data in summary["币种分布"].items():
                click.echo(
                    f"  {currency}: {data['数量']} 件, 总估值 ¥{data['总估值(CNY)']:,.2f}"
                )
            click.echo()
        
        click.echo(click.style("输出文件:", fg="cyan", bold=True))
        click.echo(f"  {os.path.abspath(output_path)}")
        click.echo()
        
        if len(failed_df) > 0:
            click.echo(
                click.style(
                    f"警告: 有 {len(failed_df)} 条记录处理失败，请查看详细报告",
                    fg="yellow",
                )
            )
        
    except Exception as e:
        click.echo(click.style(f"错误: {str(e)}", fg="red", bold=True), err=True)
        logger.exception("处理失败")
        sys.exit(1)


@main.command()
@click.argument("input_file", type=click.Path(exists=True, readable=True))
@click.option(
    "--config", "-c", type=click.Path(exists=True), default=None, help="配置文件路径"
)
def validate(input_file, config):
    """验证输入数据格式
    
    检查输入文件是否包含必需列，数据格式是否正确。
    """
    setup_logging("INFO")
    logger = logging.getLogger(__name__)
    
    click.echo(click.style("验证输入数据格式...", fg="cyan"))
    click.echo()
    
    try:
        engine = ValuationEngine(config)
        
        if input_file.endswith(".csv"):
            df = pd.read_csv(input_file, dtype={"艺术品编号": str})
        else:
            df = pd.read_excel(input_file, dtype={"艺术品编号": str})
        
        is_valid, errors = engine.validate_input(df)
        
        if is_valid:
            click.echo(click.style("✓ 数据格式验证通过", fg="green"))
            click.echo()
            click.echo(f"数据行数: {len(df)}")
            click.echo(f"数据列数: {len(df.columns)}")
            click.echo()
            
            dup_count = df.duplicated(subset=["艺术品编号"]).sum()
            if dup_count > 0:
                click.echo(
                    click.style(
                        f"! 发现 {dup_count} 条重复的艺术品编号记录", fg="yellow"
                    )
                )
            else:
                click.echo(click.style("✓ 无重复记录", fg="green"))
            
            nan_count = df["估值基数(CNY)"].isna().sum()
            if nan_count > 0:
                click.echo(
                    click.style(f"! 发现 {nan_count} 条估值基数为空的记录", fg="yellow")
                )
            
        else:
            click.echo(click.style("✗ 数据格式验证失败", fg="red"))
            click.echo()
            for error in errors:
                click.echo(click.style(f"  - {error}", fg="red"))
            sys.exit(1)
        
    except Exception as e:
        click.echo(click.style(f"错误: {str(e)}", fg="red", bold=True), err=True)
        sys.exit(1)


@main.command()
@click.option(
    "--config", "-c", type=click.Path(exists=True), default=None, help="配置文件路径"
)
def clear_progress(config):
    """清除处理进度
    
    删除进度文件，下次运行将从头开始处理。
    """
    setup_logging("INFO")
    
    engine = ValuationEngine(config)
    engine.clear_progress()
    
    click.echo(click.style("✓ 进度文件已清除", fg="green"))


@main.command()
def show_config():
    """显示当前配置信息
    
    显示默认配置值，供参考。
    """
    engine = ValuationEngine()
    
    click.echo(click.style("默认配置信息:", fg="cyan", bold=True))
    click.echo()
    
    config = engine.config
    
    click.echo(click.style("估值设置:", fg="yellow"))
    click.echo(f"  默认币种: {config['valuation']['default_currency']}")
    click.echo(f"  支持币种: {', '.join(config['valuation']['supported_currencies'])}")
    click.echo()
    
    click.echo(click.style("汇率设置:", fg="yellow"))
    for rate, value in config["valuation"]["exchange_rates"].items():
        click.echo(f"  {rate}: {value}")
    click.echo()
    
    click.echo(click.style("临时出库调整:", fg="yellow"))
    click.echo(f"  折扣率: {config['valuation']['temporary_out_adjustment']['discount_rate']}")
    click.echo(f"  最大天数: {config['valuation']['temporary_out_adjustment']['max_days']} 天")
    click.echo()
    
    click.echo(click.style("估值规则:", fg="yellow"))
    click.echo(f"  基础估值乘数: {config['valuation']['valuation_rules']['base_value_multiplier']}")
    click.echo(f"  保险费率: {config['valuation']['valuation_rules']['insurance_premium_rate'] * 100}%")
    click.echo()
    
    click.echo(click.style("处理设置:", fg="yellow"))
    click.echo(f"  自动去重: {'是' if config['processing']['remove_duplicates'] else '否'}")
    click.echo(f"  跳过错误: {'是' if config['processing']['skip_errors'] else '否'}")
    click.echo(f"  保存进度: {'是' if config['processing']['save_progress'] else '否'}")
    click.echo()
    
    click.echo(click.style("输出设置:", fg="yellow"))
    click.echo(f"  默认格式: {config['output']['format']}")
    click.echo(f"  包含汇总: {'是' if config['output']['include_summary'] else '否'}")
    click.echo(f"  包含明细: {'是' if config['output']['include_details'] else '否'}")
    click.echo(f"  对比报告: {'是' if config['output']['comparison_report'] else '否'}")


@main.command()
@click.option("--output", "-o", type=click.Path(), default="sample_input.csv", help="输出文件路径")
def generate_sample(output):
    """生成示例输入文件
    
    生成一个包含艺术品示例数据的 CSV 文件，作为输入模板。
    """
    sample_data = [
        {
            "艺术品编号": "ART-001",
            "艺术品名称": "《千里江山图》临摹",
            "艺术家": "王希孟传人",
            "创作年份": 2020,
            "类别": "国画",
            "材质": "绢本设色",
            "尺寸(cm)": "120x60",
            "寄存位置": "A区-01-01",
            "入库日期": "2023-01-15",
            "估值基数(CNY)": 500000,
            "临时出库": "否",
            "临时出库天数": 0,
            "币种": "CNY",
            "备注": "国家级临摹作品",
        },
        {
            "艺术品编号": "ART-002",
            "艺术品名称": "青铜鼎仿古器",
            "艺术家": "张氏铸造",
            "创作年份": 2019,
            "类别": "雕塑",
            "材质": "青铜",
            "尺寸(cm)": "40x30x50",
            "寄存位置": "B区-02-03",
            "入库日期": "2023-02-20",
            "估值基数(CNY)": 150000,
            "临时出库": "是",
            "临时出库天数": 15,
            "币种": "CNY",
            "备注": "博物馆级仿古",
        },
    ]
    
    df = pd.DataFrame(sample_data)
    df.to_csv(output, index=False, encoding="utf-8-sig")
    
    click.echo(click.style(f"✓ 示例文件已生成: {os.path.abspath(output)}", fg="green"))
    click.echo()
    click.echo("必需列说明:")
    click.echo("  - 艺术品编号: 唯一标识")
    click.echo("  - 艺术品名称: 艺术品名称")
    click.echo("  - 估值基数(CNY): 基础估值金额")
    click.echo("  - 临时出库: 是否临时出库(是/否)")
    click.echo("  - 临时出库天数: 临时出库天数")
    click.echo("  - 币种: 估值币种(CNY/USD/EUR/JPY)")


if __name__ == "__main__":
    main()
