import click
import sys
from datetime import datetime
from pathlib import Path
from .data_loader import DataLoader
from .processor import WasteCalculator
from .models import ProcessConfig
from .output import OutputGenerator


def parse_date(ctx, param, value):
    if value is None:
        return None
    for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S']:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    raise click.BadParameter(f'无法解析日期格式: {value}，请使用 YYYY-MM-DD 或 YYYY/MM/DD')


@click.group()
@click.version_option(version='1.0.0', prog_name='food-waste-cli')
def cli():
    """餐饮原料损耗分析命令行工具
    
    用于分析餐饮门店的原料采购、领用和损耗数据，生成损耗分析报告。
    """
    pass


@cli.command()
@click.option('--materials', '-m', required=True, type=click.Path(exists=True), help='原料数据文件路径 (CSV/Excel)')
@click.option('--stores', '-s', required=True, type=click.Path(exists=True), help='门店数据文件路径 (CSV/Excel)')
@click.option('--purchases', '-p', required=True, type=click.Path(exists=True), help='采购数据文件路径 (CSV/Excel)')
@click.option('--usages', '-u', required=True, type=click.Path(exists=True), help='领用数据文件路径 (CSV/Excel)')
@click.option('--wastes', '-w', required=True, type=click.Path(exists=True), help='报损数据文件路径 (CSV/Excel)')
@click.option('--output-dir', '-o', default='./output', type=click.Path(), help='报告输出目录')
@click.option('--threshold', '-t', default=5.0, type=float, help='损耗率阈值 (%%)，默认 5%%')
@click.option('--date-start', '-d', callback=parse_date, help='统计开始日期，格式: YYYY-MM-DD')
@click.option('--date-end', '-e', callback=parse_date, help='统计结束日期，格式: YYYY-MM-DD')
@click.option('--store', help='指定门店ID进行分析')
@click.option('--category', help='指定原料分类进行分析')
@click.option('--overwrite', is_flag=True, help='覆盖已存在的输出文件')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不输出终端摘要')
def analyze(materials, stores, purchases, usages, wastes, output_dir, threshold, 
            date_start, date_end, store, category, overwrite, quiet):
    """分析原料损耗数据并生成报告"""
    
    try:
        if threshold <= 0 or threshold >= 100:
            raise click.BadParameter('损耗率阈值必须在 0 到 100 之间')
        
        loader = DataLoader()
        
        click.echo(click.style('正在加载数据...', fg='cyan'))
        
        materials_dict, material_errors = loader.load_materials(materials)
        click.echo(f"  原料数据: {len(materials_dict)} 条成功, {len(material_errors)} 条错误")
        
        stores_dict, store_errors = loader.load_stores(stores)
        click.echo(f"  门店数据: {len(stores_dict)} 条成功, {len(store_errors)} 条错误")
        
        purchases_list, purchase_errors = loader.load_purchases(purchases)
        click.echo(f"  采购数据: {len(purchases_list)} 条成功, {len(purchase_errors)} 条错误")
        
        usages_list, usage_errors = loader.load_usages(usages)
        click.echo(f"  领用数据: {len(usages_list)} 条成功, {len(usage_errors)} 条错误")
        
        wastes_list, waste_errors = loader.load_wastes(wastes)
        click.echo(f"  报损数据: {len(wastes_list)} 条成功, {len(waste_errors)} 条错误")
        
        all_errors = loader.get_all_errors()
        if all_errors:
            click.echo(click.style(f'  总计 {len(all_errors)} 条数据校验错误', fg='yellow'))
        
        config = ProcessConfig(
            threshold_waste_rate=threshold,
            date_start=date_start,
            date_end=date_end,
            target_store=store,
            target_category=category
        )
        
        click.echo(click.style('正在计算损耗数据...', fg='cyan'))
        calculator = WasteCalculator(
            materials=materials_dict,
            stores=stores_dict,
            purchases=purchases_list,
            usages=usages_list,
            wastes=wastes_list,
            config=config
        )
        
        report = calculator.generate_report(all_errors)
        
        click.echo(click.style('正在生成输出文件...', fg='cyan'))
        generator = OutputGenerator(report, output_dir, overwrite=overwrite)
        
        json_path = generator.export_json()
        csv_paths = generator.export_csv()
        md_path = generator.generate_markdown_report()
        
        if not quiet:
            generator.print_terminal_summary()
        
        click.echo(click.style(f'报告已生成到: {Path(output_dir).absolute()}', fg='green'))
        click.echo(f'  JSON报告: {json_path.name}')
        click.echo(f'  CSV文件: {len(csv_paths)}个')
        click.echo(f'  Markdown报告: {md_path.name}')
        
        if report.summary['abnormal_items_count'] > 0:
            click.echo(click.style(
                f'警告: 发现 {report.summary["abnormal_items_count"]} 项异常损耗！',
                fg='red', bold=True
            ))
            sys.exit(2)
        
    except FileNotFoundError as e:
        click.echo(click.style(f'文件不存在: {e}', fg='red'), err=True)
        click.echo(click.style('请检查输入文件路径是否正确', fg='yellow'), err=True)
        sys.exit(1)
    except click.BadParameter as e:
        click.echo(click.style(f'参数错误: {e}', fg='red'), err=True)
        sys.exit(1)
    except RuntimeError as e:
        click.echo(click.style(f'数据加载失败: {e}', fg='red'), err=True)
        click.echo(click.style('请检查文件格式是否正确，必要列是否存在', fg='yellow'), err=True)
        sys.exit(1)
    except ValueError as e:
        click.echo(click.style(f'数据错误: {e}', fg='red'), err=True)
        click.echo(click.style('请检查数据格式是否符合要求', fg='yellow'), err=True)
        sys.exit(1)
    except Exception as e:
        error_msg = str(e)
        if '缺少必要列' in error_msg or '无法解析' in error_msg or '格式' in error_msg:
            click.echo(click.style(f'数据格式错误: {e}', fg='red'), err=True)
            click.echo(click.style('请参考README.md中的数据格式说明', fg='yellow'), err=True)
        else:
            click.echo(click.style(f'处理失败: {e}', fg='red'), err=True)
            click.echo(click.style('请检查输入数据是否正确，或查看详细日志', fg='yellow'), err=True)
        sys.exit(1)


@cli.command()
@click.argument('output_dir', type=click.Path(), default='./sample_data')
def init(output_dir):
    """初始化示例数据文件"""
    import csv
    
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    materials_csv = Path(output_dir) / 'materials.csv'
    with open(materials_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['material_id', 'material_name', 'category', 'unit', 'unit_conversion', 'price_per_unit'])
        writer.writerow(['M001', '猪肉', '肉类', '千克', '斤:0.5;克:0.001', 30.0])
        writer.writerow(['M002', '牛肉', '肉类', '千克', '斤:0.5;克:0.001', 60.0])
        writer.writerow(['M003', '青菜', '蔬菜', '千克', '斤:0.5;克:0.001', 5.0])
        writer.writerow(['M004', '西红柿', '蔬菜', '千克', '斤:0.5;克:0.001', 4.0])
        writer.writerow(['M005', '鸡蛋', '蛋类', '千克', '个:0.05;斤:0.5', 10.0])
    
    stores_csv = Path(output_dir) / 'stores.csv'
    with open(stores_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['store_id', 'store_name', 'region', 'manager'])
        writer.writerow(['S001', '北京朝阳店', '北京', '张三'])
        writer.writerow(['S002', '上海浦东店', '上海', '李四'])
        writer.writerow(['S003', '广州天河店', '广州', '王五'])
    
    purchases_csv = Path(output_dir) / 'purchases.csv'
    with open(purchases_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['purchase_id', 'store_id', 'material_id', 'purchase_date', 'quantity', 'unit', 'total_price'])
        writer.writerow(['P001', 'S001', 'M001', '2024-01-15', 100, '千克', 3000.0])
        writer.writerow(['P002', 'S001', 'M003', '2024-01-15', 50, '千克', 250.0])
        writer.writerow(['P003', 'S002', 'M001', '2024-01-15', 80, '千克', 2400.0])
        writer.writerow(['P004', 'S002', 'M002', '2024-01-16', 50, '千克', 3000.0])
        writer.writerow(['P005', 'S003', 'M005', '2024-01-16', 200, '千克', 2000.0])
    
    usages_csv = Path(output_dir) / 'usages.csv'
    with open(usages_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['usage_id', 'store_id', 'material_id', 'usage_date', 'quantity', 'unit', 'department'])
        writer.writerow(['U001', 'S001', 'M001', '2024-01-15', 80, '千克', '厨房'])
        writer.writerow(['U002', 'S001', 'M003', '2024-01-15', 40, '千克', '厨房'])
        writer.writerow(['U003', 'S002', 'M001', '2024-01-15', 70, '千克', '厨房'])
        writer.writerow(['U004', 'S002', 'M002', '2024-01-16', 45, '千克', '厨房'])
        writer.writerow(['U005', 'S003', 'M005', '2024-01-16', 180, '千克', '厨房'])
    
    wastes_csv = Path(output_dir) / 'wastes.csv'
    with open(wastes_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['waste_id', 'store_id', 'material_id', 'waste_date', 'quantity', 'unit', 'reason'])
        writer.writerow(['W001', 'S001', 'M001', '2024-01-16', 8, '千克', '过期'])
        writer.writerow(['W002', 'S001', 'M003', '2024-01-16', 5, '千克', '变质'])
        writer.writerow(['W003', 'S002', 'M001', '2024-01-16', 2, '千克', '过期'])
        writer.writerow(['W004', 'S002', 'M002', '2024-01-17', 3, '千克', '变质'])
        writer.writerow(['W005', 'S003', 'M005', '2024-01-17', 15, '千克', '破损'])
    
    click.echo(click.style(f'示例数据已生成到: {output_dir}', fg='green'))
    click.echo('\n使用示例命令:')
    click.echo(click.style(
        f'  food-waste analyze -m {output_dir}/materials.csv -s {output_dir}/stores.csv '
        f'-p {output_dir}/purchases.csv -u {output_dir}/usages.csv -w {output_dir}/wastes.csv',
        fg='cyan'
    ))


def main():
    cli()


if __name__ == '__main__':
    main()
