import click
import sys
from pathlib import Path

from .processor import process_file
from .exporter import ResultExporter


@click.group()
def cli():
    """物业水电抄表数据处理工具"""
    pass


@cli.command()
@click.argument("input_file", type=click.Path(exists=True, readable=True))
@click.option(
    "-o", "--output-dir",
    default="./output",
    help="输出目录 (默认: ./output)",
    type=click.Path(file_okay=False, writable=True),
)
@click.option(
    "-t", "--threshold",
    default=2.0,
    type=float,
    help="异常用量阈值倍数 (默认: 2.0，即超过平均值2倍判定为异常)",
)
@click.option(
    "-r", "--reference",
    default=None,
    help="参考表号CSV文件，用于检测缺表 (需包含'表号'列)",
    type=click.Path(exists=True, readable=True),
)
@click.option(
    "-e", "--encoding",
    default="utf-8",
    help="输入文件编码 (默认: utf-8)",
)
@click.option(
    "-d", "--delimiter",
    default=",",
    help="CSV分隔符 (默认: ,)",
)
def process(input_file, output_dir, threshold, reference, encoding, delimiter):
    """处理抄表数据文件
    
    INPUT_FILE: 输入的CSV文件路径 (必须包含: 住户、表号、上月读数、本月读数列)
    """
    try:
        click.echo(f"正在处理文件: {input_file}")
        click.echo(f"输出目录: {output_dir}")
        click.echo(f"异常阈值: {threshold}x")
        
        result = process_file(
            input_file=input_file,
            output_dir=output_dir,
            abnormal_threshold=threshold,
            reference_file=reference,
            encoding=encoding,
            delimiter=delimiter,
        )
        
        exporter = ResultExporter(result, output_dir)
        outputs = exporter.export_all()
        
        click.echo(f"\n输出文件已生成:")
        click.echo(f"  JSON结果: {click.style(outputs['json'], fg='green')}")
        click.echo(f"  Excel报告: {click.style(outputs['report'], fg='green')}")
        
        if result.has_errors or result.has_abnormal:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except FileNotFoundError as e:
        click.echo(click.style(f"错误: {e}", fg="red"), err=True)
        sys.exit(2)
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg="red"), err=True)
        sys.exit(2)
    except Exception as e:
        click.echo(click.style(f"发生未知错误: {e}", fg="red"), err=True)
        import traceback
        traceback.print_exc()
        sys.exit(3)


@cli.command()
@click.option(
    "-o", "--output-dir",
    default="./",
    help="示例文件输出目录 (默认: 当前目录)",
)
def example(output_dir):
    """生成示例CSV文件"""
    output_path = Path(output_dir)
    
    clean_csv = output_path / "示例_干净数据.csv"
    dirty_csv = output_path / "示例_含错误数据.csv"
    reference_csv = output_path / "示例_参考表号.csv"
    
    clean_content = """住户,表号,上月读数,本月读数,倍率
1栋101,DB001,100,150,1
1栋102,DB002,200,260,1
1栋201,DB003,150,210,1
1栋202,DB004,180,250,1
2栋101,DB005,300,380,1
2栋102,DB006,220,290,1
"""
    
    dirty_content = """住户,表号,上月读数,本月读数,倍率
1栋101,DB001,100,150,1
1栋102,,200,260,1
,DB003,150,210,1
1栋202,DB004,180,abc,1
2栋101,DB005,300,280,1
2栋102,DB006,220,290,-5
3栋101,DB007,100,300,1
3栋102,DB008,150,145,1
3栋201,DB009,200,,1
3栋202,DB010,,250,1
4栋101,DB011,100,150,abc
4栋102,DB012,200,260,0
4栋201,DB013,150,210,-3
"""
    
    reference_content = """表号
DB001
DB002
DB003
DB004
DB005
DB006
DB007
DB008
DB009
DB010
DB011
DB012
"""
    
    clean_csv.write_text(clean_content, encoding="utf-8")
    dirty_csv.write_text(dirty_content, encoding="utf-8")
    reference_csv.write_text(reference_content, encoding="utf-8")
    
    click.echo(click.style("示例文件已生成:", fg="green"))
    click.echo(f"  干净数据: {clean_csv}")
    click.echo(f"  含错数据: {dirty_csv}")
    click.echo(f"  参考表号: {reference_csv}")
    click.echo(f"\n使用示例:")
    click.echo(f"  meter-cli process {clean_csv}")
    click.echo(f"  meter-cli process {dirty_csv} -t 1.5")
    click.echo(f"  meter-cli process {clean_csv} -r {reference_csv}")


def main():
    cli()


if __name__ == "__main__":
    main()
