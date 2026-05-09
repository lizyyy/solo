"""
CLI命令行入口
"""

import click
import sys
from pathlib import Path
from datetime import datetime
from .database import Database
from .models import RoomManager, StoveManager, StayManager, FirewoodInManager
from .calculator import ConsumptionCalculator
from .importer import DataImporter, ReportGenerator


def get_db():
    """获取数据库实例"""
    return Database()


@click.group()
@click.version_option(version="1.0.0", prog_name="firewood-ledger")
def cli():
    """
    🏠 乡村民宿柴火消耗台账系统
    
    核心主线：柴火取暖 -> 炉具差异 -> 入住天数估算
    
    快速开始：
      1. 初始化房间:  firewood-ledger room add
      2. 配置炉具:     firewood-ledger stove add
      3. 录入入住:     firewood-ledger stay add
      4. 录入入库:     firewood-ledger firewood add
      5. 核算消耗:     firewood-ledger calculate
      6. 生成报表:     firewood-ledger report
    """
    pass


# ====== 房间管理 ======
@cli.group()
def room():
    """房间管理"""
    pass


@room.command('add')
@click.option('--room-number', prompt='房间号', help='房间编号，如 101')
@click.option('--name', prompt='房间名称', help='房间名称，如 "山景套房"')
@click.option('--floor', default=1, show_default=True, help='楼层')
@click.option('--max-guests', default=2, show_default=True, help='最大入住人数')
def room_add(room_number, name, floor, max_guests):
    """添加房间"""
    db = get_db()
    manager = RoomManager(db)
    room_id = manager.add_room(room_number, name, floor, max_guests)
    click.echo(f"✅ 房间已添加/更新: ID={room_id}, 房号={room_number}")


@room.command('list')
def room_list():
    """列出所有房间"""
    db = get_db()
    manager = RoomManager(db)
    rooms = manager.list_rooms()
    
    if not rooms:
        click.echo("📋 暂无房间数据")
        return
    
    click.echo("\n" + "=" * 70)
    click.echo(f"{'房号':<8} {'名称':<20} {'楼层':<8} {'人数':<8} {'炉具数':<8}")
    click.echo("-" * 70)
    for r in rooms:
        click.echo(f"{r['room_number']:<8} {r['name']:<20} {r['floor']:<8} {r['max_guests']:<8} {r['stove_count']:<8}")
    click.echo("=" * 70)


@room.command('import')
@click.argument('file_path', type=click.Path(exists=True))
def room_import(file_path):
    """从文件导入房间数据（CSV/JSON）"""
    db = get_db()
    importer = DataImporter(db)
    result = importer.import_rooms(file_path)
    _print_import_result(result)


# ====== 炉具管理 ======
@cli.group()
def stove():
    """炉具管理 - 不同炉具消耗不同"""
    pass


@stove.command('add')
@click.option('--room-number', prompt='房间号', help='房间编号')
@click.option('--stove-type', prompt='炉具类型', 
              type=click.Choice(['土炕', '壁炉', '火炉', '暖墙', '地暖']))
@click.option('--consumption', type=float, help='自定义日消耗量(kg)，不填则按类型默认')
def stove_add(room_number, stove_type, consumption):
    """添加炉具"""
    db = get_db()
    room_manager = RoomManager(db)
    stove_manager = StoveManager(db)
    
    room = room_manager.get_room_by_number(room_number)
    if not room:
        click.echo(f"❌ 房间不存在: {room_number}")
        return
    
    stove_id = stove_manager.add_stove(
        room['id'], stove_type, daily_consumption_kg=consumption
    )
    
    # 获取默认消耗
    default = StoveManager.STOVE_TYPE_CONSUMPTION.get(stove_type, 5.0)
    actual = consumption or default
    
    click.echo(f"✅ 炉具已添加/更新: 房间={room_number}, 类型={stove_type}, 日消耗={actual}kg/天")
    click.echo(f"   (默认: {stove_type}={default}kg/天)")


@stove.command('list')
@click.option('--room-number', help='指定房间号，不填则显示全部')
def stove_list(room_number):
    """列出炉具"""
    db = get_db()
    manager = StoveManager(db)
    room_manager = RoomManager(db)
    
    if room_number:
        room = room_manager.get_room_by_number(room_number)
        if not room:
            click.echo(f"❌ 房间不存在: {room_number}")
            return
        stoves = manager.list_stoves(room['id'])
    else:
        stoves = manager.list_stoves()
    
    if not stoves:
        click.echo("🔥 暂无炉具数据")
        return
    
    click.echo("\n" + "=" * 80)
    click.echo(f"{'房间':<10} {'类型':<10} {'日消耗(kg)':<15} {'型号':<20} {'状态':<8}")
    click.echo("-" * 80)
    for s in stoves:
        status = "✓ 启用" if s['is_active'] else "✗ 停用"
        click.echo(f"{s['room_number']:<10} {s['stove_type']:<10} {s['daily_consumption_kg']:<15.1f} {str(s['model'] or '-'):<20} {status:<8}")
    click.echo("=" * 80)
    click.echo(f"\n💡 参考: 土炕4kg/天, 壁炉6kg/天, 火炉5kg/天, 暖墙3.5kg/天, 地暖7kg/天")


@stove.command('import')
@click.argument('file_path', type=click.Path(exists=True))
def stove_import(file_path):
    """从文件导入炉具数据"""
    db = get_db()
    importer = DataImporter(db)
    result = importer.import_stoves(file_path)
    _print_import_result(result)


# ====== 入住记录管理 ======
@cli.group()
def stay():
    """入住记录管理"""
    pass


@stay.command('add')
@click.option('--stay-code', prompt='入住编码', help='唯一编码，如 STAY-20251115-001')
@click.option('--room-number', prompt='房间号', help='房间编号')
@click.option('--check-in', prompt='入住日期 (YYYY-MM-DD)', help='入住日期')
@click.option('--check-out', help='退房日期 (YYYY-MM-DD)，不填则视为在住')
@click.option('--guest-name', help='客人姓名')
@click.option('--guest-count', default=1, show_default=True, help='入住人数')
@click.option('--status', default='checked_in', type=click.Choice(['checked_in', 'checked_out']))
def stay_add(stay_code, room_number, check_in, check_out, guest_name, guest_count, status):
    """添加入住记录"""
    db = get_db()
    room_manager = RoomManager(db)
    stay_manager = StayManager(db)
    
    room = room_manager.get_room_by_number(room_number)
    if not room:
        click.echo(f"❌ 房间不存在: {room_number}")
        return
    
    try:
        result = stay_manager.add_stay(
            stay_code, room['id'], check_in, check_out,
            guest_name, guest_count, status
        )
        status_text = "在住" if status == 'checked_in' else "已退房"
        click.echo(f"✅ 入住记录已添加/更新: {stay_code}")
        click.echo(f"   房间: {room_number}, 入住: {check_in}, 状态: {status_text}")
        if check_out:
            click.echo(f"   退房: {check_out}")
    except ValueError as e:
        click.echo(f"❌ {e}")


@stay.command('list')
@click.option('--status', type=click.Choice(['checked_in', 'checked_out']), help='按状态筛选')
@click.option('--start-date', help='开始日期')
@click.option('--end-date', help='结束日期')
def stay_list(status, start_date, end_date):
    """列出入住记录"""
    db = get_db()
    manager = StayManager(db)
    stays = manager.list_stays(status, start_date, end_date)
    
    if not stays:
        click.echo("📋 暂无入住记录")
        return
    
    click.echo("\n" + "=" * 90)
    click.echo(f"{'编码':<20} {'房间':<10} {'客人':<12} {'人数':<6} {'入住':<12} {'退房':<12} {'状态':<8}")
    click.echo("-" * 90)
    for s in stays:
        status_text = "在住" if s['status'] == 'checked_in' else "已退房"
        checkout = s['check_out_date'] or "-"
        click.echo(f"{s['stay_code']:<20} {s['room_number']:<10} {(s['guest_name'] or '-'):<12} {s['guest_count']:<6} {s['check_in_date']:<12} {checkout:<12} {status_text:<8}")
    click.echo("=" * 90)


@stay.command('import')
@click.argument('file_path', type=click.Path(exists=True))
def stay_import(file_path):
    """从文件导入入住记录"""
    db = get_db()
    importer = DataImporter(db)
    result = importer.import_stays(file_path)
    _print_import_result(result)


# ====== 柴火入库管理 ======
@cli.group()
def firewood():
    """柴火入库管理"""
    pass


@firewood.command('add')
@click.option('--batch-code', prompt='批次号', help='入库批次号，如 WH-20251101-001')
@click.option('--delivery-date', prompt='送货日期 (YYYY-MM-DD)', help='送货日期')
@click.option('--weight', prompt='重量(kg)', type=float, help='入库重量')
@click.option('--wood-type', help='木材类型，如松木、硬木')
@click.option('--supplier', help='供应商')
@click.option('--unit-price', type=float, help='单价(元/kg)')
@click.option('--notes', help='备注')
def firewood_add(batch_code, delivery_date, weight, wood_type, supplier, unit_price, notes):
    """添加柴火入库"""
    db = get_db()
    manager = FirewoodInManager(db)
    
    result = manager.add_firewood(
        batch_code, delivery_date, weight,
        wood_type, supplier, unit_price, notes
    )
    
    total = unit_price * weight if unit_price and weight else 0
    click.echo(f"✅ 入库记录已添加/更新: {batch_code}")
    click.echo(f"   日期: {delivery_date}, 重量: {weight}kg")
    if total > 0:
        click.echo(f"   单价: {unit_price}元/kg, 总价: {total}元")


@firewood.command('list')
@click.option('--start-date', help='开始日期')
@click.option('--end-date', help='结束日期')
def firewood_list(start_date, end_date):
    """列出入库记录"""
    db = get_db()
    manager = FirewoodInManager(db)
    records = manager.list_firewood(start_date, end_date)
    total = manager.get_total_in(start_date, end_date)
    
    if not records:
        click.echo("🪵 暂无入库记录")
        return
    
    click.echo("\n" + "=" * 90)
    click.echo(f"{'批次号':<20} {'日期':<12} {'重量(kg)':<12} {'类型':<10} {'供应商':<15} {'单价':<10} {'总价':<10}")
    click.echo("-" * 90)
    for r in records:
        unit_price = r['unit_price'] or 0
        total_cost = r['total_cost'] or 0
        click.echo(f"{r['batch_code']:<20} {r['delivery_date']:<12} {r['weight_kg']:<12.1f} {(r['wood_type'] or '-'):<10} {(r['supplier'] or '-'):<15} {unit_price:<10.2f} {total_cost:<10.2f}")
    click.echo("=" * 90)
    click.echo(f"\n📦 总入库量: {total:.1f} 公斤")


@firewood.command('import')
@click.argument('file_path', type=click.Path(exists=True))
def firewood_import(file_path):
    """从文件导入入库记录"""
    db = get_db()
    importer = DataImporter(db)
    result = importer.import_firewood(file_path)
    _print_import_result(result)


# ====== 核心核算 ======
@cli.command()
@click.option('--start-date', help='开始日期')
@click.option('--end-date', help='结束日期')
@click.option('--status', help='入住状态筛选')
@click.option('--save/--no-save', default=True, help='保存核算结果')
def calculate(start_date, end_date, status, save):
    """
    🔥 执行消耗核算
    
    根据房间炉具类型和入住天数估算柴火消耗
    取暖季: 11月-3月
    """
    db = get_db()
    calculator = ConsumptionCalculator(db)
    
    click.echo("\n" + "=" * 70)
    click.echo("🔥 柴火消耗核算")
    click.echo(f"   取暖季: 11月 - 次年3月")
    click.echo("=" * 70)
    
    normal, abnormal = calculator.run_consumption_check(
        start_date, end_date, status
    )
    
    if save:
        saved = calculator.save_consumption_results(normal)
        click.echo(f"\n💾 已保存 {saved} 条核算记录")
    
    # 显示正常记录
    if normal:
        click.echo(f"\n✅ 正常记录 ({len(normal)} 条):")
        click.echo("-" * 70)
        click.echo(f"{'编码':<18} {'房间':<8} {'取暖天数':<10} {'炉具':<6} {'估算消耗':<12}")
        click.echo("-" * 70)
        
        total_estimated = 0
        for r in normal:
            total_estimated += r['estimated_total']
            click.echo(
                f"{r['stay_code']:<18} {r['room_number']:<8} "
                f"{r['total_heating_days']:<10} {r['stove_count']:<6} "
                f"{r['estimated_total']:.1f}kg"
            )
        
        click.echo("-" * 70)
        click.echo(f"{'合计':<44} {total_estimated:.1f}kg")
    
    # 显示异常记录
    if abnormal:
        click.echo(f"\n⚠️  异常记录 ({len(abnormal)} 条):")
        for r in abnormal:
            warning = r.get('warning') or r.get('error') or '未知异常'
            click.echo(f"   - {r['stay_code']}: {warning}")
    
    stats = calculator.get_statistics(start_date, end_date)
    click.echo("\n" + "=" * 70)
    click.echo("📊 库存概览:")
    click.echo(f"   总入库: {stats['inventory']['total_in_kg']:.1f} kg")
    click.echo(f"   估算消耗: {stats['inventory']['total_estimated_kg']:.1f} kg")
    remaining = stats['inventory']['remaining_kg']
    color = 'green' if remaining >= 0 else 'red'
    click.echo(f"   库存结余: {remaining:.1f} kg")
    click.echo("=" * 70)


# ====== 异常检查 ======
@cli.command()
@click.option('--save/--no-save', default=False, help='保存到文件')
def anomalies(save):
    """🔍 查询异常记录"""
    db = get_db()
    calculator = ConsumptionCalculator(db)
    
    anomalies_list = calculator.find_anomalies()
    
    if not anomalies_list:
        click.echo("✅ 未发现异常记录")
        return
    
    click.echo("\n" + "=" * 70)
    click.echo(f"🔍 发现 {len(anomalies_list)} 条异常记录")
    click.echo("=" * 70)
    
    for i, a in enumerate(anomalies_list, 1):
        severity = {
            'high': ('🔴', '高'),
            'medium': ('🟡', '中'),
            'low': ('🟢', '低')
        }.get(a['severity'], ('⚪', '未知'))
        
        click.echo(f"\n{i}. {severity[0]} [{severity[1]}] {a['type']}")
        click.echo(f"   {a['message']}")


# ====== 报表生成 ======
@cli.command()
@click.option('--format', 'fmt', default='html', 
              type=click.Choice(['html', 'csv', 'all']))
@click.option('--output', help='输出目录，默认 data/reports')
@click.option('--start-date', help='开始日期')
@click.option('--end-date', help='结束日期')
def report(fmt, output, start_date, end_date):
    """
    📊 生成业务报表
    
    生成给业务负责人看的报表文件
    """
    db = get_db()
    generator = ReportGenerator(db)
    
    if output:
        output_dir = Path(output)
    else:
        output_dir = Path.cwd() / "data" / "reports"
    
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    files = []
    
    if fmt in ['html', 'all']:
        html_path = output_dir / f"firewood_report_{timestamp}.html"
        generator.generate_html_report(str(html_path), start_date, end_date)
        files.append(str(html_path))
        click.echo(f"📄 HTML报表已生成: {html_path}")
    
    if fmt in ['csv', 'all']:
        csv_path = output_dir / f"firewood_report_{timestamp}.csv"
        generator.generate_csv_report(str(csv_path), start_date, end_date)
        files.append(str(csv_path))
        click.echo(f"📊 CSV报表已生成: {csv_path}")
    
    click.echo(f"\n✅ 共生成 {len(files)} 个报表文件")


# ====== 汇总统计 ======
@cli.command()
@click.option('--start-date', help='开始日期')
@click.option('--end-date', help='结束日期')
def stats(start_date, end_date):
    """📊 查看统计数据"""
    db = get_db()
    calculator = ConsumptionCalculator(db)
    
    stats = calculator.get_statistics(start_date, end_date)
    
    click.echo("\n" + "=" * 70)
    click.echo("📊 柴火消耗统计")
    click.echo("=" * 70)
    
    click.echo("\n📦 库存概览:")
    click.echo(f"   总入库: {stats['inventory']['total_in_kg']:.1f} kg")
    click.echo(f"   估算消耗: {stats['inventory']['total_estimated_kg']:.1f} kg")
    remaining = stats['inventory']['remaining_kg']
    click.echo(f"   库存结余: {remaining:.1f} kg")
    
    if stats['stove_type_breakdown']:
        click.echo("\n🔥 炉具类型消耗分析:")
        click.echo(f"   {'类型':<10} {'入住次数':<10} {'日均消耗':<12} {'总消耗':<12}")
        click.echo("   " + "-" * 50)
        for s in stats['stove_type_breakdown']:
            click.echo(f"   {s['stove_type']:<10} {s['stay_count']:<10} "
                      f"{s['avg_daily_rate']:.1f}kg{'':<8} {s['total_consumption']:.1f}kg")
    
    if stats['room_breakdown']:
        click.echo("\n🛏️ 房间消耗排行 (前5):")
        click.echo(f"   {'房间':<10} {'入住次数':<10} {'总消耗':<12}")
        click.echo("   " + "-" * 35)
        for s in stats['room_breakdown'][:5]:
            click.echo(f"   {s['room_number']:<10} {s['stay_count']:<10} {s['total_consumption']:.1f}kg")
    
    click.echo("\n" + "=" * 70)


# ====== 初始化示例数据 ======
@cli.command('init-demo')
def init_demo():
    """🎮 初始化示例数据（演示用）"""
    db = get_db()
    
    click.echo("🎮 正在初始化示例数据...")
    
    # 房间
    room_manager = RoomManager(db)
    rooms_data = [
        ('101', '山景套房', 1, 2),
        ('102', '园景标间', 1, 2),
        ('103', '家庭房', 1, 4),
        ('201', '豪华套房', 2, 2),
        ('202', '暖炕房', 2, 2),
    ]
    
    for rn, name, floor, guests in rooms_data:
        room_manager.add_room(rn, name, floor, guests)
    click.echo(f"   ✅ 已添加 {len(rooms_data)} 个房间")
    
    # 炉具
    stove_manager = StoveManager(db)
    stoves_data = [
        ('101', '壁炉', None),
        ('102', '火炉', None),
        ('103', '地暖', None),
        ('201', '壁炉', None),
        ('202', '土炕', None),
        ('101', '火炉', None),  # 101有两个炉具
    ]
    
    for rn, stype, cons in stoves_data:
        room = room_manager.get_room_by_number(rn)
        stove_manager.add_stove(room['id'], stype, cons)
    click.echo(f"   ✅ 已添加 {len(stoves_data)} 个炉具")
    
    # 入住记录（取暖季）
    stay_manager = StayManager(db)
    stays_data = [
        ('STAY-20251101-001', '101', '2025-11-01', '2025-11-05', '张三', 2, 'checked_out'),
        ('STAY-20251105-002', '102', '2025-11-05', '2025-11-08', '李四', 2, 'checked_out'),
        ('STAY-20251110-003', '202', '2025-11-10', '2025-11-20', '王五一家', 4, 'checked_out'),
        ('STAY-20251115-004', '103', '2025-11-15', '2025-11-22', '赵六', 3, 'checked_out'),
        ('STAY-20251120-005', '201', '2025-11-20', None, '孙七', 2, 'checked_in'),
    ]
    
    for code, rn, ci, co, name, cnt, status in stays_data:
        room = room_manager.get_room_by_number(rn)
        stay_manager.add_stay(code, room['id'], ci, co, name, cnt, status)
    click.echo(f"   ✅ 已添加 {len(stays_data)} 条入住记录")
    
    # 柴火入库
    fw_manager = FirewoodInManager(db)
    fw_data = [
        ('WH-20251101-001', '2025-11-01', 500.0, '松木', '张师傅', 2.5, None),
        ('WH-20251115-002', '2025-11-15', 800.0, '硬木', '李师傅', 3.0, None),
        ('WH-20251201-003', '2025-12-01', 1000.0, '混合', '王师傅', 2.8, None),
    ]
    
    for bc, dd, wt, wtype, sup, price, notes in fw_data:
        fw_manager.add_firewood(bc, dd, wt, wtype, sup, price, notes)
    click.echo(f"   ✅ 已添加 {len(fw_data)} 条入库记录")
    
    click.echo("\n🎮 示例数据初始化完成！")
    click.echo("\n下一步:")
    click.echo("  1. 执行核算:  firewood-ledger calculate")
    click.echo("  2. 查看异常:  firewood-ledger anomalies")
    click.echo("  3. 生成报表:  firewood-ledger report")


def _print_import_result(result: dict):
    """打印导入结果"""
    click.echo(f"\n📥 导入结果 ({result['type']}):")
    click.echo(f"   总计: {result['total']} 条")
    click.echo(f"   成功: {result['success']} 条")
    click.echo(f"   重复: {result['duplicate']} 条")
    click.echo(f"   错误: {result['error']} 条")
    
    if result['errors']:
        click.echo("\n   错误详情:")
        for err in result['errors']:
            click.echo(f"   - {err}")


def main():
    """主入口"""
    cli()


if __name__ == '__main__':
    main()
