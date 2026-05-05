import click
from pathlib import Path
from datetime import datetime

from .db import init_db, DB_PATH
from .ingest import Ingestor
from .check import RiskChecker
from .review import ReviewManager
from .export import Exporter
from .models import InspectionBatch, Risk

@click.group()
def main():
    """后厨油烟巡检归档员 - 餐饮连锁油烟巡检数据管理工具"""
    pass

@main.command()
def init():
    """初始化数据库"""
    init_db()
    click.echo(f"数据库已初始化: {DB_PATH.absolute()}")

@main.group()
def ingest():
    """导入各类文件"""
    pass

@ingest.command()
@click.option('--batch', '-b', required=True, help='巡检批次名称，如: 2024年Q1')
@click.option('--month', '-m', required=True, help='巡检月份，如: 2024-01')
@click.option('--cleaning', '-c', help='清洗记录CSV文件路径')
@click.option('--sensor', '-s', help='传感器读数CSV文件路径')
@click.option('--photos', '-p', help='照片目录路径')
@click.option('--rectification', '-r', help='整改预约表CSV文件路径')
def files(batch, month, cleaning, sensor, photos, rectification):
    """导入多源文件并保留哈希值
    
    示例:
        kitchen-inspector ingest files -b "2024年Q1" -m "2024-01" -c cleaning.csv -s sensor.csv -p ./photos -r rectification.csv
    """
    ingestor = Ingestor(batch, month)
    
    if cleaning:
        click.echo(f"正在导入清洗记录: {cleaning}")
        ingestor.ingest_cleaning_records(cleaning)
    
    if sensor:
        click.echo(f"正在导入传感器读数: {sensor}")
        ingestor.ingest_sensor_readings(sensor)
    
    if photos:
        click.echo(f"正在导入照片目录: {photos}")
        ingestor.ingest_photo_directory(photos)
    
    if rectification:
        click.echo(f"正在导入整改预约表: {rectification}")
        ingestor.ingest_rectification_records(rectification)
    
    stats = ingestor.get_stats()
    click.echo("\n" + "="*50)
    click.echo("导入统计:")
    click.echo(f"  - 处理文件数: {stats['total_files']}")
    click.echo(f"  - 新文件: {stats['new_files']}")
    click.echo(f"  - 已存在文件: {stats['existing_files']}")
    click.echo(f"  - 清洗记录: {stats['records']['cleaning']} 条")
    click.echo(f"  - 传感器读数: {stats['records']['sensor']} 条")
    click.echo(f"  - 照片记录: {stats['records']['photo']} 条")
    click.echo(f"  - 整改记录: {stats['records']['rectification']} 条")
    click.echo("="*50)

@main.command()
@click.option('--batch', '-b', help='指定巡检批次ID（可选，默认检查所有批次）')
@click.option('--list', '-l', is_flag=True, help='只列出风险不保存到数据库')
def check(batch, list):
    """生成风险清单
    
    检查以下风险类型:
    - 遗漏清洗记录
    - 清洗超期
    - 排放超限
    - 照片归属错误
    - 整改超期
    - 缺少照片
    
    示例:
        kitchen-inspector check
        kitchen-inspector check -b 1
    """
    if batch:
        batch_ids = [int(batch)]
    else:
        # 获取所有批次
        batches = InspectionBatch.get_all()
        batch_ids = [b['id'] for b in batches]
    
    if not batch_ids:
        click.echo("没有找到任何巡检批次，请先导入数据")
        return
    
    total_high = 0
    total_medium = 0
    total_low = 0
    
    for batch_id in batch_ids:
        checker = RiskChecker(batch_id)
        risks = checker.check_all()
        stats = checker.get_stats()
        
        total_high += stats['high_risk']
        total_medium += stats['medium_risk']
        total_low += stats['low_risk']
        
        # 显示该批次的风险
        batch_info = InspectionBatch.get_by_id(batch_id)
        if batch_info:
            click.echo(f"\n批次 [{batch_info['batch_name']} - {batch_info['inspection_month']}] 风险统计:")
        else:
            click.echo(f"\n批次 [{batch_id}] 风险统计:")
        
        click.echo(f"  🔴 高风险: {stats['high_risk']}")
        click.echo(f"  🟡 中风险: {stats['medium_risk']}")
        click.echo(f"  🟢 低风险: {stats['low_risk']}")
        
        # 列出详细风险
        if list or stats['total_risks'] > 0:
            for risk in risks:
                level_icon = {
                    'high': '🔴',
                    'medium': '🟡',
                    'low': '🟢'
                }.get(risk.get('risk_level', 'low'), '🟢')
                
                click.echo(f"    {level_icon} [{risk['id']}] 门店 {risk['store_code']}: {risk['description']}")
    
    click.echo("\n" + "="*50)
    click.echo("总风险统计:")
    click.echo(f"  🔴 高风险: {total_high}")
    click.echo(f"  🟡 中风险: {total_medium}")
    click.echo(f"  🟢 低风险: {total_low}")
    click.echo(f"  总计: {total_high + total_medium + total_low}")
    click.echo("="*50)

@main.group()
def review():
    """人工复核管理"""
    pass

@review.command()
@click.option('--batch', '-b', help='指定巡检批次ID')
@click.option('--level', '-l', type=click.Choice(['high', 'medium', 'low']), help='按风险等级筛选')
@click.option('--store', '-s', help='按门店编号筛选')
def list(batch, level, store):
    """列出待复核的风险
    
    示例:
        kitchen-inspector review list
        kitchen-inspector review list -l high
        kitchen-inspector review list -s S001
    """
    manager = ReviewManager()
    
    batch_id = int(batch) if batch else None
    risks = manager.list_risks_for_review(batch_id=batch_id, risk_level=level, store_code=store)
    
    if not risks:
        click.echo("没有待复核的风险")
        return
    
    click.echo(f"共找到 {len(risks)} 条待复核风险:\n")
    
    for risk in risks:
        level_icon = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        }.get(risk.get('risk_level', 'low'), '🟢')
        
        click.echo(f"  [{risk['id']}] {level_icon} 门店 {risk['store_code']}")
        click.echo(f"      类型: {risk['risk_type']}")
        click.echo(f"      描述: {risk['description']}")
        click.echo()

@review.command()
@click.argument('risk_id', type=int)
@click.option('--reviewer', '-r', required=True, help='复核人姓名')
@click.option('--result', '-R', required=True, 
              type=click.Choice(['confirmed', 'false_alarm', 'resolved']),
              help='复核结果: confirmed(确认属实), false_alarm(误报), resolved(已解决)')
@click.option('--comments', '-c', help='复核备注')
def add(risk_id, reviewer, result, comments):
    """添加复核记录
    
    示例:
        kitchen-inspector review add 1 -r "张三" -R confirmed -c "核实情况属实"
        kitchen-inspector review add 2 -r "李四" -R false_alarm
    """
    manager = ReviewManager()
    
    try:
        review = manager.add_review(
            risk_id=risk_id,
            reviewer=reviewer,
            review_result=result,
            comments=comments or ''
        )
        
        result_text = {
            'confirmed': '✓ 确认属实',
            'false_alarm': '✗ 误报',
            'resolved': '✓ 已解决'
        }.get(result, result)
        
        click.echo(f"复核记录已添加:")
        click.echo(f"  风险ID: {risk_id}")
        click.echo(f"  复核人: {reviewer}")
        click.echo(f"  结果: {result_text}")
        if comments:
            click.echo(f"  备注: {comments}")
            
    except ValueError as e:
        click.echo(f"错误: {e}")

@review.command()
@click.option('--batch', '-b', help='指定巡检批次ID')
def stats(batch):
    """查看复核统计
    
    示例:
        kitchen-inspector review stats
        kitchen-inspector review stats -b 1
    """
    manager = ReviewManager()
    batch_id = int(batch) if batch else None
    stats = manager.get_review_stats(batch_id=batch_id)
    
    click.echo("复核统计:")
    click.echo(f"  总风险数: {stats['total_risks']}")
    click.echo(f"  待复核: {stats['unreviewed']}")
    click.echo(f"  已复核: {stats['reviewed']}")
    click.echo(f"    ✓ 已确认: {stats['by_result']['confirmed']}")
    click.echo(f"    ✗ 误报: {stats['by_result']['false_alarm']}")
    click.echo(f"    ✓ 已解决: {stats['by_result']['resolved']}")

@main.group()
def export():
    """导出巡检数据"""
    pass

@export.command()
@click.option('--batch', '-b', required=True, help='巡检批次ID')
@click.option('--output', '-o', required=True, help='输出目录路径')
def markdown(batch, output):
    """导出 Markdown 巡检包
    
    生成包含以下内容的Markdown报告:
    - 巡检报告.md: 主报告
    - 风险清单.md: 详细风险列表
    - 门店详情.md: 各门店详细信息
    - 复核记录.md: 复核记录汇总
    
    示例:
        kitchen-inspector export markdown -b 1 -o ./report_202401
    """
    exporter = Exporter(int(batch))
    output_path = Path(output)
    
    try:
        exporter.export_markdown(output_path)
        click.echo(f"\nMarkdown 巡检包已导出到: {output_path.absolute()}")
        click.echo(f"  包含文件:")
        click.echo(f"    - 巡检报告.md")
        click.echo(f"    - 风险清单.md")
        click.echo(f"    - 门店详情.md")
        click.echo(f"    - 复核记录.md")
    except Exception as e:
        click.echo(f"导出失败: {e}")

@export.command()
@click.option('--batch', '-b', required=True, help='巡检批次ID')
@click.option('--output', '-o', required=True, help='输出JSON文件路径')
def json(batch, output):
    """导出 JSON 审计明细
    
    包含完整的审计数据，适用于:
    - 数据备份
    - 与其他系统集成
    - 审计追溯
    
    示例:
        kitchen-inspector export json -b 1 -o ./audit_202401.json
    """
    exporter = Exporter(int(batch))
    output_path = Path(output)
    
    try:
        exporter.export_json(output_path)
        click.echo(f"\nJSON 审计明细已导出到: {output_path.absolute()}")
    except Exception as e:
        click.echo(f"导出失败: {e}")

@main.command()
def info():
    """显示系统信息"""
    click.echo("后厨油烟巡检归档员")
    click.echo("====================")
    click.echo(f"数据库路径: {DB_PATH.absolute()}")
    click.echo()
    
    # 显示批次信息
    batches = InspectionBatch.get_all()
    if batches:
        click.echo("巡检批次:")
        for batch in batches:
            click.echo(f"  [{batch['id']}] {batch['batch_name']} - {batch['inspection_month']}")
    else:
        click.echo("暂无巡检批次")

if __name__ == '__main__':
    main()
