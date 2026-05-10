import click
import csv
import json
from datetime import date, timedelta
from typing import List

from restock_cli.models import (
    SalesRecord, WeatherRecord, StoreActivity, GroupOrder,
    ActualConsumption, WeatherType, ActivityType, OrderStatus
)
from restock_cli.core import (
    init_system, import_sales_records, import_weather_records,
    import_activities, import_group_orders, generate_restock_suggestions,
    adjust_suggestion, record_actual_consumption, get_previous_deviation,
    date_to_str, parse_date
)
from restock_cli.storage import (
    load_stores, load_ingredients, load_suggestions, load_deviations,
    load_group_orders
)


@click.group()
def cli():
    """连锁餐厅备货预估 CLI 工具"""
    pass


@cli.command()
@click.option('--date', required=True, help='目标日期 (YYYY-MM-DD)')
@click.option('--store-id', required=True, help='门店 ID')
@click.option('--ingredient-id', required=True, help='食材 ID')
@click.option('--quantity', required=True, type=float, help='销量数量 (kg)')
def import_sales(date, store_id, ingredient_id, quantity):
    """导入单条销量记录（自动去重，重复导入会更新而非累计）"""
    init_system()
    record = SalesRecord(
        date=date,
        store_id=store_id,
        ingredient_id=ingredient_id,
        quantity=quantity
    )
    added, updated = import_sales_records([record])
    if updated:
        click.echo(f"已更新销量记录: {date}:{store_id}:{ingredient_id} = {quantity}kg")
    else:
        click.echo(f"已导入销量记录: {date}:{store_id}:{ingredient_id} = {quantity}kg")


@cli.command()
@click.option('--file', 'input_file', required=True, type=click.Path(exists=True), help='CSV 文件路径 (date,store_id,ingredient_id,quantity)')
def import_sales_csv(input_file):
    """批量导入销量记录（CSV 格式）"""
    init_system()
    records = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(SalesRecord(
                date=row['date'],
                store_id=row['store_id'],
                ingredient_id=row['ingredient_id'],
                quantity=float(row['quantity'])
            ))
    
    added, updated = import_sales_records(records)
    click.echo(f"导入完成：新增 {len(added)} 条，更新 {len(updated)} 条")


@cli.command()
@click.option('--date', required=True, help='目标日期 (YYYY-MM-DD)')
@click.option('--store-id', required=True, help='门店 ID')
@click.option('--weather', 'weather_type', required=True,
              type=click.Choice(['sunny', 'cloudy', 'rainy', 'snowy']),
              help='天气类型')
@click.option('--temperature', type=float, default=20.0, help='温度 (°C)')
def import_weather(date, store_id, weather_type, temperature):
    """导入天气记录（缺失时默认晴天 20°C）"""
    init_system()
    record = WeatherRecord(
        date=date,
        store_id=store_id,
        weather_type=WeatherType(weather_type),
        temperature=temperature
    )
    added, updated = import_weather_records([record])
    if updated:
        click.echo(f"已更新天气记录: {date}:{store_id} = {weather_type}, {temperature}°C")
    else:
        click.echo(f"已导入天气记录: {date}:{store_id} = {weather_type}, {temperature}°C")


@cli.command()
@click.option('--file', 'input_file', required=True, type=click.Path(exists=True), help='CSV 文件路径')
def import_weather_csv(input_file):
    """批量导入天气记录（CSV 格式）"""
    init_system()
    records = []
    
    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append(WeatherRecord(
                date=row['date'],
                store_id=row['store_id'],
                weather_type=WeatherType(row['weather_type']),
                temperature=float(row.get('temperature', 20.0))
            ))
    
    added, updated = import_weather_records(records)
    click.echo(f"导入完成：新增 {len(added)} 条，更新 {len(updated)} 条")


@cli.command()
@click.option('--date', required=True, help='目标日期 (YYYY-MM-DD)')
@click.option('--store-id', required=True, help='门店 ID')
@click.option('--activity-type', required=True,
              type=click.Choice(['normal', 'promotion', 'holiday']),
              help='活动类型')
@click.option('--impact-factor', type=float, default=1.0,
              help='影响系数 (1.0 = 无影响, 1.3 = 增加30%)')
def import_activity(date, store_id, activity_type, impact_factor):
    """导入门店活动记录"""
    init_system()
    record = StoreActivity(
        date=date,
        store_id=store_id,
        activity_type=ActivityType(activity_type),
        impact_factor=impact_factor
    )
    added, updated = import_activities([record])
    if updated:
        click.echo(f"已更新活动记录: {date}:{store_id} = {activity_type}, 系数: {impact_factor}")
    else:
        click.echo(f"已导入活动记录: {date}:{store_id} = {activity_type}, 系数: {impact_factor}")


@cli.command()
@click.option('--order-id', required=True, help='团餐订单号')
@click.option('--date', required=True, help='团餐日期 (YYYY-MM-DD)')
@click.option('--store-id', required=True, help='门店 ID')
@click.option('--ingredient-id', required=True, help='食材 ID')
@click.option('--quantity', required=True, type=float, help='订单数量 (kg)')
@click.option('--status', default='confirmed',
              type=click.Choice(['confirmed', 'cancelled']),
              help='订单状态 (取消会回滚备货)')
def import_group_order(order_id, date, store_id, ingredient_id, quantity, status):
    """导入团餐订单（取消状态会回滚对应备货）"""
    init_system()
    order = GroupOrder(
        order_id=order_id,
        date=date,
        store_id=store_id,
        ingredient_id=ingredient_id,
        quantity=quantity,
        status=OrderStatus(status)
    )
    added, updated = import_group_orders([order])
    
    if status == 'cancelled':
        click.echo(f"订单 {order_id} 已标记为取消，备货将回滚")
    elif updated:
        click.echo(f"已更新团餐订单: {order_id}")
    else:
        click.echo(f"已导入团餐订单: {order_id}")


@cli.command()
@click.option('--order-id', required=True, help='团餐订单号')
def cancel_group_order(order_id):
    """取消团餐订单（回滚对应备货）"""
    init_system()
    orders = load_group_orders()
    
    for order in orders:
        if order.order_id == order_id:
            order.status = OrderStatus.CANCELLED
            from restock_cli.storage import save_group_orders
            save_group_orders(orders)
            click.echo(f"订单 {order_id} 已取消，备货将回滚")
            return
    
    click.echo(f"未找到订单: {order_id}")


@cli.command()
@click.option('--date', required=True, help='预估日期 (YYYY-MM-DD)')
def estimate(date):
    """生成指定日期的食材备货建议"""
    init_system()
    suggestions = generate_restock_suggestions(date)
    
    stores = {s.store_id: s.name for s in load_stores()}
    ingredients = {i.ingredient_id: i.name for i in load_ingredients()}
    
    click.echo(f"\n{'='*80}")
    click.echo(f"备货建议 - {date}")
    click.echo(f"{'='*80}")
    
    current_store = None
    for s in sorted(suggestions, key=lambda x: (x.store_id, x.ingredient_id)):
        if current_store != s.store_id:
            current_store = s.store_id
            click.echo(f"\n【{stores.get(s.store_id, s.store_id)}】({s.store_id})")
            click.echo(f"{'-'*80}")
        
        prev_dev = get_previous_deviation(date, s.store_id, s.ingredient_id)
        
        final_qty = s.adjusted_quantity if s.adjusted_quantity is not None else s.suggested_quantity
        
        click.echo(f"\n  食材: {ingredients.get(s.ingredient_id, s.ingredient_id)} ({s.ingredient_id})")
        click.echo(f"    建议备货量: {final_qty:.2f} kg")
        click.echo(f"    基准预估:   {s.base_estimate:.2f} kg")
        click.echo(f"    天气调整:   {s.weather_adjustment:+.2f} kg")
        click.echo(f"    活动调整:   {s.activity_adjustment:+.2f} kg")
        click.echo(f"    团餐订单:   +{s.group_order_quantity:.2f} kg")
        click.echo(f"    调整原因:   {s.adjustment_reason}")
        
        if prev_dev:
            dev_pct = (prev_dev.deviation / prev_dev.suggested_quantity * 100) if prev_dev.suggested_quantity != 0 else 0
            click.echo(f"    前一天偏差: {prev_dev.deviation:+.2f} kg ({dev_pct:+.1f}%)")
            if prev_dev.deviation_reason:
                click.echo(f"    偏差原因:   {prev_dev.deviation_reason}")
        else:
            click.echo(f"    前一天偏差: 无记录")
    
    click.echo(f"\n{'='*80}")


@cli.command()
@click.option('--date', required=True, help='预估日期 (YYYY-MM-DD)')
@click.option('--store-id', required=True, help='门店 ID')
@click.option('--ingredient-id', required=True, help='食材 ID')
@click.option('--quantity', required=True, type=float, help='调整后的备货量 (kg)')
@click.option('--reason', default='', help='人工调整原因')
def adjust(date, store_id, ingredient_id, quantity, reason):
    """人工调整备货建议"""
    init_system()
    
    success = adjust_suggestion(date, store_id, ingredient_id, quantity, reason)
    
    if success:
        click.echo(f"已调整: {date}:{store_id}:{ingredient_id} -> {quantity} kg")
        if reason:
            click.echo(f"调整原因: {reason}")
    else:
        click.echo(f"未找到对应的备货建议: {date}:{store_id}:{ingredient_id}")
        click.echo("请先运行 estimate 命令生成备货建议")


@cli.command()
@click.option('--date', required=True, help='实际消耗日期 (YYYY-MM-DD)')
@click.option('--store-id', required=True, help='门店 ID')
@click.option('--ingredient-id', required=True, help='食材 ID')
@click.option('--quantity', required=True, type=float, help='实际消耗数量 (kg)')
@click.option('--reason', default='', help='偏差原因')
def record_consumption(date, store_id, ingredient_id, quantity, reason):
    """记录实际消耗（用于偏差复盘）"""
    init_system()
    
    consumption = ActualConsumption(
        date=date,
        store_id=store_id,
        ingredient_id=ingredient_id,
        actual_quantity=quantity,
        deviation_reason=reason
    )
    
    added, updated = record_actual_consumption([consumption])
    
    if updated:
        click.echo(f"已更新实际消耗记录: {date}:{store_id}:{ingredient_id} = {quantity} kg")
    else:
        click.echo(f"已记录实际消耗: {date}:{store_id}:{ingredient_id} = {quantity} kg")


@cli.command()
@click.option('--start-date', help='开始日期 (YYYY-MM-DD)，默认最近7天')
@click.option('--end-date', help='结束日期 (YYYY-MM-DD)')
@click.option('--store-id', help='筛选门店 ID')
@click.option('--ingredient-id', help='筛选食材 ID')
def deviation_report(start_date, end_date, store_id, ingredient_id):
    """生成偏差复盘报告"""
    init_system()
    
    deviations = load_deviations()
    
    if not start_date:
        end_date_obj = date.today()
        start_date_obj = end_date_obj - timedelta(days=7)
    else:
        start_date_obj = parse_date(start_date)
        end_date_obj = parse_date(end_date) if end_date else date.today()
    
    filtered = []
    for d in deviations:
        d_date = parse_date(d.date)
        if start_date_obj <= d_date <= end_date_obj:
            if store_id and d.store_id != store_id:
                continue
            if ingredient_id and d.ingredient_id != ingredient_id:
                continue
            filtered.append(d)
    
    if not filtered:
        click.echo("未找到偏差记录")
        return
    
    stores = {s.store_id: s.name for s in load_stores()}
    ingredients = {i.ingredient_id: i.name for i in load_ingredients()}
    
    click.echo(f"\n{'='*80}")
    click.echo(f"偏差复盘报告")
    click.echo(f"日期范围: {date_to_str(start_date_obj)} 至 {date_to_str(end_date_obj)}")
    click.echo(f"{'='*80}")
    
    total_deviation = 0.0
    total_abs_deviation = 0.0
    count = 0
    
    for d in sorted(filtered, key=lambda x: (x.store_id, x.date, x.ingredient_id)):
        dev_pct = (d.deviation / d.suggested_quantity * 100) if d.suggested_quantity != 0 else 0
        
        click.echo(f"\n日期: {d.date}")
        click.echo(f"门店: {stores.get(d.store_id, d.store_id)} ({d.store_id})")
        click.echo(f"食材: {ingredients.get(d.ingredient_id, d.ingredient_id)} ({d.ingredient_id})")
        click.echo(f"  预估: {d.suggested_quantity:.2f} kg")
        click.echo(f"  实际: {d.actual_quantity:.2f} kg")
        click.echo(f"  偏差: {d.deviation:+.2f} kg ({dev_pct:+.1f}%)")
        if d.deviation_reason:
            click.echo(f"  原因: {d.deviation_reason}")
        
        total_deviation += d.deviation
        total_abs_deviation += abs(d.deviation)
        count += 1
    
    click.echo(f"\n{'='*80}")
    click.echo(f"统计汇总")
    click.echo(f"{'='*80}")
    click.echo(f"记录条数: {count}")
    click.echo(f"总偏差量: {total_deviation:+.2f} kg")
    click.echo(f"绝对偏差: {total_abs_deviation:.2f} kg")
    if count > 0:
        click.echo(f"平均偏差: {total_deviation/count:+.2f} kg")
        click.echo(f"平均绝对偏差: {total_abs_deviation/count:.2f} kg")
    click.echo(f"{'='*80}")


@cli.command()
def list_stores():
    """列出所有门店"""
    init_system()
    stores = load_stores()
    
    if not stores:
        click.echo("暂无门店数据")
        return
    
    click.echo("\n门店列表:")
    click.echo("-" * 60)
    for s in stores:
        click.echo(f"  {s.store_id}: {s.name}")
        if s.address:
            click.echo(f"    地址: {s.address}")
    click.echo("-" * 60)


@cli.command()
def list_ingredients():
    """列出所有食材"""
    init_system()
    ingredients = load_ingredients()
    
    if not ingredients:
        click.echo("暂无食材数据")
        return
    
    click.echo("\n食材列表:")
    click.echo("-" * 60)
    for i in ingredients:
        click.echo(f"  {i.ingredient_id}: {i.name} ({i.unit})")
    click.echo("-" * 60)


if __name__ == '__main__':
    cli()
