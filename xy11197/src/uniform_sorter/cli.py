import click
import sys
import os
from pathlib import Path
from .sorter import UniformSorter


@click.group()
def cli():
    pass


@cli.command()
@click.argument('input_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.argument('output_dir', type=click.Path(file_okay=False, dir_okay=True))
@click.option('--force', '-f', is_flag=True, help='覆盖已存在的输出目录')
def sort(input_dir, output_dir, force):
    """小学校服订购点校服批次分拣
    
    INPUT_DIR: 包含校服订单CSV文件的输入目录
    OUTPUT_DIR: 分拣结果输出目录
    """
    click.echo(f"\n{'='*60}")
    click.echo("      小学校服订购点校服批次分拣工具")
    click.echo(f"{'='*60}")
    
    output_path = Path(output_dir)
    if output_path.exists() and any(output_path.iterdir()):
        if not force:
            click.echo(click.style(f"\n警告: 输出目录 {output_dir} 已存在且不为空", fg="yellow"))
            click.echo(click.style("使用 --force 参数覆盖已有文件，或指定新的输出目录\n", fg="yellow"))
            sys.exit(1)
        else:
            click.echo(click.style(f"覆盖输出目录: {output_dir}", fg="yellow"))
    
    click.echo(f"\n输入目录: {input_dir}")
    click.echo(f"输出目录: {output_dir}")
    click.echo("\n开始处理...")
    
    try:
        sorter = UniformSorter(input_dir, output_dir)
        result = sorter.process()
        
        click.echo(click.style("\n处理完成!", fg="green"))
        click.echo(f"\n{'='*60}")
        click.echo("处理统计:")
        click.echo(f"{'='*60}")
        
        normal_count = sum(len(orders) for orders in result.normal_orders.values())
        click.echo(f"  正常订单: {normal_count} 条")
        click.echo(f"  换码订单: {len(result.size_change_orders)} 条")
        click.echo(f"  缺货订单: {len(result.out_of_stock_orders)} 条")
        click.echo(f"  同名学生订单: {len(result.duplicate_name_orders)} 条")
        click.echo(f"  数据异常: {len(result.errors)} 条")
        
        if result.errors:
            click.echo(click.style(f"\n发现 {len(result.errors)} 条异常，请查看 异常摘要.csv", fg="red"))
            click.echo("前5条异常预览:")
            for i, err in enumerate(result.errors[:5]):
                click.echo(f"  [{i+1}] {err.file_name}:{err.line_number} - {err.error_type}: {err.message}")
        
        click.echo(f"\n{'='*60}")
        click.echo(f"输出文件位置: {output_dir}")
        click.echo(f"{'='*60}\n")
        
    except Exception as e:
        click.echo(click.style(f"\n处理失败: {str(e)}", fg="red"))
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
def example():
    """生成示例数据用于测试"""
    click.echo("正在生成示例数据...")
    examples_dir = Path("示例数据")
    examples_dir.mkdir(exist_ok=True)
    
    example_file = examples_dir / "实验小学_订单汇总.csv"
    with open(example_file, 'w', encoding='utf-8-sig', newline='') as f:
        f.write("学校名称,年级,班级,学生姓名,学号,性别,校服类型,尺码,数量,备注\n")
        f.write("实验小学,一,1,张三,202401001,男,夏季运动服,120,1,\n")
        f.write("实验小学,一,1,李四,202401002,女,夏季运动服,110,1,\n")
        f.write("实验小学,一,1,王五,202401003,男,夏季运动服,120,1,换码\n")
        f.write("实验小学,一,2,赵六,202402001,女,夏季运动服,110,1,\n")
        f.write("实验小学,一,2,赵六,202402002,男,夏季运动服,120,1,\n")
        f.write("实验小学,二,1,孙七,202301001,男,秋季运动服,130,1,缺货\n")
    
    click.echo(click.style(f"示例数据已生成到: {examples_dir}", fg="green"))
    click.echo(f"\n运行示例: 校服分拣 {examples_dir} 输出目录")


def main():
    cli()


if __name__ == '__main__':
    main()
