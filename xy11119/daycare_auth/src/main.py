import click
from pathlib import Path
from datetime import datetime
import sys

from src.config import AppConfig
from src.data_reader import DataReader
from src.validator import AuthValidator
from src.output_writer import OutputWriter


@click.group()
def cli():
    """儿童托管班接送授权名单处理工具"""
    pass


@cli.command()
@click.argument("input_dir", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.argument("output_dir", type=click.Path(file_okay=False, path_type=Path))
@click.option("--config", "-c", type=click.Path(exists=True, dir_okay=False, path_type=Path), 
              help="规则配置文件路径")
@click.option("--reference-date", "-d", type=str, default=None,
              help="参考日期（用于计算证件过期，格式：YYYY-MM-DD，默认：今天）")
@click.option("--incremental/--no-incremental", default=False,
              help="增量处理模式（跳过已处理过的记录）")
@click.option("--verbose/--no-verbose", default=True,
              help="显示详细处理信息")
def process(input_dir: Path, output_dir: Path, config: Path = None, 
            reference_date: str = None, incremental: bool = False, verbose: bool = True):
    """处理儿童托管班接送授权名单
    
    INPUT_DIR: 输入目录（包含CSV文件）
    OUTPUT_DIR: 输出目录
    """
    if verbose:
        click.echo("=" * 60)
        click.echo("儿童托管班接送授权名单处理工具")
        click.echo("=" * 60)
    
    try:
        if verbose:
            click.echo(f"\n[1/6] 加载配置...")
        app_config = AppConfig.load(config)
        if verbose:
            if config:
                click.echo(f"  配置文件: {config}")
            else:
                click.echo(f"  使用默认配置")
        
        if verbose:
            click.echo(f"\n[2/6] 读取输入数据...")
        reader = DataReader(app_config)
        df = reader.read_directory(input_dir)
        if verbose:
            click.echo(f"  共读取 {len(df)} 条记录")
        
        if len(df) == 0:
            click.echo("  警告: 输入目录中没有找到CSV文件")
            return
        
        if verbose:
            click.echo(f"\n[3/6] 解析日期字段...")
        df = reader.parse_dates(df)
        
        if verbose:
            click.echo(f"\n[4/6] 验证必填字段...")
        df = reader.validate_required_fields(df)
        
        if reference_date:
            ref_date = datetime.strptime(reference_date, "%Y-%m-%d")
        else:
            ref_date = datetime.now()
        
        if verbose:
            click.echo(f"\n[5/6] 验证证件和授权...")
        validator = AuthValidator(app_config)
        df = validator.check_id_expiry(df, ref_date)
        df = validator.check_auth_period(df, ref_date)
        df = validator.find_duplicate_parents(df)
        
        valid_df = validator.get_valid_records(df)
        expired_df = validator.get_expired_records(df)
        warning_df = validator.get_warning_records(df)
        duplicate_df = validator.get_duplicate_records(df)
        invalid_df = df[df["validation_errors"] != ""].copy()
        
        if verbose:
            click.echo(f"\n[6/6] 输出结果...")
        output_dir.mkdir(parents=True, exist_ok=True)
        writer = OutputWriter(app_config)
        result_dir = writer.write_results(
            output_dir, df, valid_df, expired_df, warning_df, duplicate_df, invalid_df, incremental
        )
        
        if verbose:
            click.echo(f"\n" + "=" * 60)
            click.echo("处理完成!")
            click.echo(f"输出目录: {result_dir}")
            click.echo(f"  - 有效记录: {len(valid_df)} 条")
            click.echo(f"  - 证件已过期: {len(expired_df)} 条")
            click.echo(f"  - 证件即将过期: {len(warning_df)} 条")
            click.echo(f"  - 同名家长: {len(duplicate_df)} 条")
            click.echo(f"  - 字段验证失败: {len(invalid_df)} 条")
            click.echo("=" * 60)
        
    except Exception as e:
        click.echo(f"\n错误: {str(e)}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--output", "-o", type=click.Path(path_type=Path), default="rules.yaml",
              help="输出配置文件路径")
def init_config(output: Path):
    """生成默认配置文件"""
    config = AppConfig()
    import yaml
    
    config_dict = config.model_dump()
    with open(output, "w", encoding="utf-8") as f:
        yaml.dump(config_dict, f, allow_unicode=True, default_flow_style=False, indent=2)
    
    click.echo(f"配置文件已生成: {output}")


if __name__ == "__main__":
    cli()
