import click
import os
from pathlib import Path
from tabulate import tabulate
from datetime import datetime, timedelta

from .database import Database
from .importer import DataImporter
from .attribution import AttributionEngine


DB_PATH = os.environ.get('REVIEW_DB', 'review.db')


def get_db():
    return Database(DB_PATH)


@click.group()
def main():
    """餐厅外卖差评复盘 CLI - 导入订单、归因分析、复盘报告"""
    pass


@main.group()
def import_data():
    """导入数据命令组"""
    pass


@import_data.command('orders')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--format', 'fmt', default='csv', type=click.Choice(['csv', 'json']),
              help='数据格式 (csv/json)')
def import_orders(file_path, fmt):
    """导入外卖订单数据"""
    db = get_db()
    importer = DataImporter(db)
    
    if fmt == 'csv':
        result = importer.import_orders_from_csv(file_path)
    else:
        result = importer.import_from_json(file_path, 'orders')
    
    click.echo(f"订单导入完成: 成功 {result['imported']} 条, 跳过 {result['skipped']} 条")


@import_data.command('reviews')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--format', 'fmt', default='csv', type=click.Choice(['csv', 'json']),
              help='数据格式 (csv/json)')
def import_reviews(file_path, fmt):
    """导入用户评价数据"""
    db = get_db()
    importer = DataImporter(db)
    
    if fmt == 'csv':
        result = importer.import_reviews_from_csv(file_path)
    else:
        result = importer.import_from_json(file_path, 'reviews')
    
    click.echo(f"评价导入完成: 成功 {result['imported']} 条, 跳过 {result['skipped']} 条")


@import_data.command('compensations')
@click.argument('file_path', type=click.Path(exists=True))
@click.option('--format', 'fmt', default='csv', type=click.Choice(['csv', 'json']),
              help='数据格式 (csv/json)')
def import_compensations(file_path, fmt):
    """导入补偿记录数据"""
    db = get_db()
    importer = DataImporter(db)
    
    if fmt == 'csv':
        result = importer.import_compensations_from_csv(file_path)
    else:
        result = importer.import_from_json(file_path, 'compensations')
    
    click.echo(f"补偿导入完成: 成功 {result['imported']} 条, 跳过 {result['skipped']} 条")


@import_data.command('all')
@click.option('--orders', 'orders_file', type=click.Path(exists=True), help='订单文件')
@click.option('--reviews', 'reviews_file', type=click.Path(exists=True), help='评价文件')
@click.option('--compensations', 'comp_file', type=click.Path(exists=True), help='补偿文件')
@click.option('--format', 'fmt', default='csv', type=click.Choice(['csv', 'json']),
              help='数据格式')
def import_all(orders_file, reviews_file, comp_file, fmt):
    """导入所有类型数据"""
    db = get_db()
    importer = DataImporter(db)
    
    if orders_file:
        if fmt == 'csv':
            r = importer.import_orders_from_csv(orders_file)
        else:
            r = importer.import_from_json(orders_file, 'orders')
        click.echo(f"订单: 成功 {r['imported']}, 跳过 {r['skipped']}")
    
    if reviews_file:
        if fmt == 'csv':
            r = importer.import_reviews_from_csv(reviews_file)
        else:
            r = importer.import_from_json(reviews_file, 'reviews')
        click.echo(f"评价: 成功 {r['imported']}, 跳过 {r['skipped']}")
    
    if comp_file:
        if fmt == 'csv':
            r = importer.import_compensations_from_csv(comp_file)
        else:
            r = importer.import_from_json(comp_file, 'compensations')
        click.echo(f"补偿: 成功 {r['imported']}, 跳过 {r['skipped']}")


@main.command('analyze')
@click.option('--start', 'start_date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end', 'end_date', help='结束日期 (YYYY-MM-DD)')
def analyze(start_date, end_date):
    """运行自动归因分析"""
    db = get_db()
    engine = AttributionEngine(db)
    
    click.echo("开始自动归因分析...")
    results = engine.run_auto_attribution(start_date, end_date)
    
    click.echo("\n归因结果统计:")
    for cat, count in results.items():
        if count > 0:
            cat_name = Database.ATTRIBUTIONS.get(cat, cat)
            click.echo(f"  {cat_name}: {count} 条")
    
    total = sum(results.values())
    click.echo(f"\n总计分析: {total} 条差评")


@main.command('review')
@click.option('--start', 'start_date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end', 'end_date', help='结束日期 (YYYY-MM-DD)')
@click.option('--pending', is_flag=True, help='只看待复核订单')
@click.option('--all', 'show_all', is_flag=True, help='显示全部字段')
def review(start_date, end_date, pending, show_all):
    """按日期复盘差评列表"""
    db = get_db()
    
    if pending:
        orders = db.get_pending_orders()
    else:
        orders = db.get_negative_orders(start_date, end_date)
    
    if not orders:
        click.echo("没有找到差评记录")
        return
    
    table_data = []
    for o in orders:
        cat_display = Database.ATTRIBUTIONS.get(o.get('category'), '-')
        source_display = Database.SOURCES.get(o.get('source'), '')
        if source_display:
            cat_display = f"{cat_display} ({source_display})"
        
        row = [
            o.get('order_id', '')[:10],
            o.get('order_time', '')[:10],
            o.get('store_name', '')[:10],
            o.get('rating', '-'),
            cat_display,
            (o.get('attribution_reason') or '')[:20],
        ]
        if show_all:
            row.extend([
                o.get('compensation_amount', 0),
                o.get('platform', ''),
            ])
        table_data.append(row)
    
    headers = ['订单ID', '日期', '门店', '评分', '归因', '原因']
    if show_all:
        headers.extend(['补偿', '平台'])
    
    click.echo(tabulate(table_data, headers=headers, tablefmt='simple'))
    click.echo(f"\n共 {len(orders)} 条记录")


@main.command('evidence')
@click.argument('order_id')
def evidence(order_id):
    """查看单条订单的完整证据"""
    db = get_db()
    order = db.get_order_detail(order_id)
    
    if not order:
        click.echo(f"未找到订单: {order_id}")
        return
    
    click.echo("\n" + "="*60)
    click.echo(f"订单详情 - {order['order_id']}")
    click.echo("="*60)
    
    click.echo("\n【基本信息】")
    click.echo(f"  订单号: {order['order_id']}")
    click.echo(f"  平台: {order.get('platform', '-')}")
    click.echo(f"  门店: {order.get('store_name', '-')}")
    click.echo(f"  下单时间: {order.get('order_time', '-')}")
    click.echo(f"  订单金额: ¥{order.get('order_amount', 0)}")
    click.echo(f"  商品: {order.get('items', '-')}")
    click.echo(f"  顾客: {order.get('customer_name', '-')}")
    click.echo(f"  地址: {order.get('address', '-')}")
    
    click.echo("\n【出餐时间】")
    click.echo(f"  开始: {order.get('kitchen_start_time', '-')}")
    click.echo(f"  完成: {order.get('kitchen_finish_time', '-')}")
    if order.get('kitchen_duration_seconds'):
        click.echo(f"  用时: {order['kitchen_duration_seconds'] // 60} 分钟")
    
    click.echo("\n【配送节点】")
    click.echo(f"  取餐: {order.get('rider_pickup_time', '-')}")
    click.echo(f"  送达: {order.get('delivery_arrive_time', '-')}")
    if order.get('delivery_duration_seconds'):
        click.echo(f"  用时: {order['delivery_duration_seconds'] // 60} 分钟")
    has_delivery = order.get('rider_pickup_time') and order.get('delivery_arrive_time')
    if not has_delivery:
        click.echo("  ⚠️ 缺少配送节点数据")
    
    click.echo("\n【用户评价】")
    click.echo(f"  评分: {order.get('rating', '-')} 星")
    click.echo(f"  评价时间: {order.get('review_time', '-')}")
    click.echo(f"  内容: {order.get('review_content', '-')}")
    
    click.echo("\n【补偿记录】")
    if order.get('compensation_amount'):
        click.echo(f"  金额: ¥{order['compensation_amount']}")
        click.echo(f"  原因: {order.get('compensation_reason', '-')}")
        order_amt = order.get('order_amount') or 0
        comp_amt = order.get('compensation_amount') or 0
        if order_amt > 0 and (comp_amt / order_amt > 1.0 or comp_amt > 500):
            click.echo("  ⚠️ 补偿金额异常")
    else:
        click.echo("  无补偿记录")
    
    click.echo("\n【归因结果】")
    if order.get('category'):
        cat_name = Database.ATTRIBUTIONS.get(order['category'], order['category'])
        source_name = Database.SOURCES.get(order.get('source'), '未知')
        click.echo(f"  分类: {cat_name}")
        click.echo(f"  来源: {source_name}")
        click.echo(f"  原因: {order.get('attribution_reason', '-')}")
        click.echo(f"  证据: {order.get('evidence', '-')}")
    else:
        click.echo("  尚未归因")
    
    click.echo("\n" + "="*60)


@main.command('decide')
@click.argument('order_id')
@click.option('--category', required=True, 
              type=click.Choice(['kitchen_slow', 'delivery_slow', 'missing_item', 
                                 'taste_issue', 'service_issue', 'pending']),
              help='归因分类')
@click.option('--reason', required=True, help='归因原因说明')
def decide(order_id, category, reason):
    """人工改判订单归因"""
    db = get_db()
    
    order = db.get_order_detail(order_id)
    if not order:
        click.echo(f"未找到订单: {order_id}")
        return
    
    old_cat = Database.ATTRIBUTIONS.get(order.get('category'), '无')
    
    if db.save_attribution(order_id, category, 'manual', reason, '人工改判'):
        new_cat = Database.ATTRIBUTIONS.get(category, category)
        click.echo(f"改判成功:")
        click.echo(f"  原分类: {old_cat}")
        click.echo(f"  新分类: {new_cat}")
        click.echo(f"  原因: {reason}")
    else:
        click.echo("改判失败")


@main.command('report')
@click.option('--start', 'start_date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end', 'end_date', help='结束日期 (YYYY-MM-DD)')
@click.option('--output', '-o', type=click.Path(), help='输出文件路径 (md格式)')
@click.option('--store', help='门店名称过滤')
def report(start_date, end_date, output, store):
    """生成本周门店复盘报告"""
    db = get_db()
    engine = AttributionEngine(db)
    
    engine.run_auto_attribution(start_date, end_date)
    
    orders = db.get_negative_orders(start_date, end_date)
    if store:
        orders = [o for o in orders if o.get('store_name') == store]
    
    stats = db.get_statistics(start_date, end_date)
    
    if not start_date and not end_date:
        if orders:
            dates = sorted([o['order_time'][:10] for o in orders])
            start_date = dates[0] if dates else '-'
            end_date = dates[-1] if dates else '-'
    
    report_lines = []
    report_lines.append("# 门店差评复盘周报")
    report_lines.append("")
    report_lines.append(f"**报告时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    if start_date and end_date:
        report_lines.append(f"**复盘周期**: {start_date} 至 {end_date}")
    if store:
        report_lines.append(f"**门店**: {store}")
    report_lines.append("")
    
    report_lines.append("## 一、总体概况")
    report_lines.append("")
    report_lines.append("| 指标 | 数值 |")
    report_lines.append("|------|------|")
    report_lines.append(f"| 差评总数 | {stats.get('total_negative', 0)} |")
    report_lines.append(f"| 补偿总金额 | ¥{stats.get('total_compensation', 0):.2f} |")
    report_lines.append(f"| 待复核订单 | {stats.get('pending_count', 0)} |")
    report_lines.append("")
    
    report_lines.append("## 二、归因分布")
    report_lines.append("")
    report_lines.append("| 归因分类 | 数量 | 占比 |")
    report_lines.append("|----------|------|------|")
    total = stats.get('total_negative', 0) or 1
    categories = [
        ('kitchen_slow_count', '厨房慢', 'kitchen_slow'),
        ('delivery_slow_count', '配送慢', 'delivery_slow'),
        ('missing_item_count', '漏餐', 'missing_item'),
        ('taste_issue_count', '口味问题', 'taste_issue'),
        ('service_issue_count', '客服处理不当', 'service_issue'),
        ('pending_count', '待复核', 'pending'),
    ]
    for stat_key, label, cat_key in categories:
        count = stats.get(stat_key, 0) or 0
        pct = (count / total) * 100 if total else 0
        report_lines.append(f"| {label} | {count} | {pct:.1f}% |")
    report_lines.append("")
    
    report_lines.append("## 三、详细归因及依据")
    report_lines.append("")
    
    cat_orders = {}
    for o in orders:
        cat = o.get('category') or 'pending'
        if cat not in cat_orders:
            cat_orders[cat] = []
        cat_orders[cat].append(o)
    
    for cat_key, label in Database.ATTRIBUTIONS.items():
        if cat_key in cat_orders and cat_orders[cat_key]:
            report_lines.append(f"### {label} ({len(cat_orders[cat_key])}条)")
            report_lines.append("")
            for o in cat_orders[cat_key]:
                report_lines.append(f"**订单**: {o['order_id']}")
                report_lines.append(f"- 评分: {o.get('rating', '-')} 星")
                report_lines.append(f"- 评价: {o.get('review_content', '-')}")
                report_lines.append(f"- 归因依据: {o.get('attribution_reason', '-')}")
                report_lines.append(f"- 证据: {o.get('evidence', '-')}")
                if o.get('compensation_amount'):
                    report_lines.append(f"- 补偿: ¥{o['compensation_amount']}")
                report_lines.append("")
    
    report_lines.append("## 四、改进建议")
    report_lines.append("")
    
    max_cat = None
    max_count = 0
    for cat_key, label in Database.ATTRIBUTIONS.items():
        count = stats.get(f'{cat_key}_count') or 0
        if cat_key == 'pending':
            continue
        if count > max_count:
            max_count = count
            max_cat = (cat_key, label)
    
    if max_cat and max_count > 0:
        report_lines.append(f"**主要问题**: {max_cat[1]}（{max_count}条，建议优先处理）")
        report_lines.append("")
        if max_cat[0] == 'kitchen_slow':
            report_lines.append("- 建议优化出餐流程，增加高峰期备餐")
            report_lines.append("- 考虑增加厨房人员或调整排班")
        elif max_cat[0] == 'delivery_slow':
            report_lines.append("- 与配送平台沟通优化路线规划")
            report_lines.append("- 考虑自建配送或更换配送商")
        elif max_cat[0] == 'missing_item':
            report_lines.append("- 完善出餐核对流程")
            report_lines.append("- 增加打包检查环节")
        elif max_cat[0] == 'taste_issue':
            report_lines.append("- 加强厨师培训和品质管控")
            report_lines.append("- 检查供应链和食材新鲜度")
        elif max_cat[0] == 'service_issue':
            report_lines.append("- 加强客服培训，提高响应速度")
            report_lines.append("- 建立顾客投诉快速处理机制")
    else:
        report_lines.append("建议继续保持现有服务水平")
    
    if stats.get('pending_count', 0) > 0:
        report_lines.append("")
        report_lines.append(f"⚠️ **注意**: 有 {stats['pending_count']} 条订单待复核，请及时处理")
    
    report_content = "\n".join(report_lines)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(report_content)
        click.echo(f"报告已保存到: {output}")
    else:
        click.echo(report_content)


@main.command('stats')
@click.option('--start', 'start_date', help='开始日期 (YYYY-MM-DD)')
@click.option('--end', 'end_date', help='结束日期 (YYYY-MM-DD)')
def stats(start_date, end_date):
    """查看统计数据"""
    db = get_db()
    s = db.get_statistics(start_date, end_date)
    
    click.echo("\n差评统计:")
    click.echo(f"  总数: {s.get('total_negative', 0)}")
    click.echo(f"  厨房慢: {s.get('kitchen_slow_count', 0)}")
    click.echo(f"  配送慢: {s.get('delivery_slow_count', 0)}")
    click.echo(f"  漏餐: {s.get('missing_item_count', 0)}")
    click.echo(f"  口味问题: {s.get('taste_issue_count', 0)}")
    click.echo(f"  客服处理: {s.get('service_issue_count', 0)}")
    click.echo(f"  待复核: {s.get('pending_count', 0)}")
    click.echo(f"  补偿总额: ¥{s.get('total_compensation', 0):.2f}")


if __name__ == '__main__':
    main()
