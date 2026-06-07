import click
import json
import os
from toilet_checker import DataStore, BoundaryChecker, MapExporter
from toilet_checker.models import Point, Complaint, PointType
from toilet_checker.demo_data import setup_demo_data


@click.group()
def cli():
    """公厕服务半径复核系统"""
    pass


@cli.command()
@click.option('--demo', is_flag=True, help='使用演示数据初始化')
def init(demo):
    """初始化数据"""
    if demo:
        store = setup_demo_data()
        click.echo("✅ 演示数据已初始化完成")
        click.echo("   - 5个公厕点位（含2个夜间采样点）")
        click.echo("   - 3个街道范围")
        click.echo("   - 2条居民投诉记录")
        click.echo("   - 1次人工修正、1次重跑记录")
    else:
        store = DataStore()
        store.clear_all()
        click.echo("✅ 空数据库已初始化")


@cli.command('list')
@click.option('--type', 'point_type', type=click.Choice(['all', 'boundary', 'night', 'complaint']),
              default='all', help='筛选类型')
def list_points(point_type):
    """列出所有点位"""
    store = DataStore()
    points = store.get_all_points()

    if point_type == 'boundary':
        points = [p for p in points if p.is_on_boundary]
    elif point_type == 'night':
        points = [p for p in points if p.point_type == PointType.NIGHT_SAMPLING]
    elif point_type == 'complaint':
        points = [p for p in points if p.complaint_id]

    if not points:
        click.echo("暂无点位数据")
        return

    click.echo(f"\n{'ID':<8} {'名称':<16} {'类型':<12} {'状态':<20} {'边界':<6} {'投诉'}")
    click.echo("-" * 80)
    for p in points:
        boundary_mark = "⚠️ 是" if p.is_on_boundary else "  否"
        type_label = "夜间采样" if p.point_type == PointType.NIGHT_SAMPLING else "常规"
        complaint_mark = p.complaint_id or "-"
        click.echo(f"{p.id:<8} {p.name:<16} {type_label:<12} {p.status.value:<20} {boundary_mark:<6} {complaint_mark}")
    click.echo(f"\n共 {len(points)} 个点位")


@cli.command()
@click.argument('point_id')
def detail(point_id):
    """查看点位详情"""
    store = DataStore()
    point = store.get_point(point_id)
    if not point:
        click.echo(f"❌ 未找到点位 {point_id}")
        return

    click.echo(f"\n📍 {point.name} ({point.id})")
    click.echo(f"   地址：{point.address}")
    click.echo(f"   坐标：{point.lng}, {point.lat}")
    click.echo(f"   类型：{'夜间采样点' if point.point_type == PointType.NIGHT_SAMPLING else '常规点位'}")
    click.echo(f"   状态：{point.status.value}")
    click.echo(f"   边界点位：{'是 ⚠️' if point.is_on_boundary else '否'}")

    streets = store.get_all_streets()
    street_map = {s.id: s.name for s in streets}
    street_names = [street_map[sid] for sid in point.street_ids if sid in street_map]
    click.echo(f"   涉及街道：{'、'.join(street_names) or '待确认'}")

    if point.complaint_id:
        complaint = store.get_complaint(point.complaint_id)
        if complaint:
            click.echo(f"\n📋 关联投诉：")
            click.echo(f"   编号：{complaint.complaint_no}")
            click.echo(f"   内容：{complaint.description}")
            click.echo(f"   来源：{complaint.source}")
            click.echo(f"   登记人：{complaint.reporter} ({complaint.report_date})")

    if point.review_records:
        click.echo(f"\n📝 复核轨迹：")
        for r in point.review_records:
            status_change = f" [{r.before_status} → {r.after_status}]" if r.before_status else ""
            click.echo(f"   • {r.timestamp} | {r.operator} | {r.action}{status_change}")
            if r.note:
                click.echo(f"     {r.note}")

    click.echo("")


@cli.command()
@click.argument('point_id')
@click.argument('complaint_no')
@click.option('--desc', required=True, help='投诉内容')
@click.option('--reporter', required=True, help='投诉人')
@click.option('--date', required=True, help='投诉日期 YYYY-MM-DD')
@click.option('--source', default='12345热线', help='投诉来源')
def add_complaint(point_id, complaint_no, desc, reporter, date, source):
    """补录居民投诉编号"""
    store = DataStore()
    point = store.get_point(point_id)
    if not point:
        click.echo(f"❌ 未找到点位 {point_id}")
        return

    existing = store.get_complaint_by_no(complaint_no)
    if existing:
        click.echo(f"❌ 投诉编号 {complaint_no} 已存在")
        return

    complaint = Complaint(
        id=f"C-{len(store.get_all_complaints()) + 1:03d}",
        complaint_no=complaint_no,
        point_id=point_id,
        description=desc,
        reporter=reporter,
        report_date=date,
        source=source
    )
    store.save_complaint(complaint)
    point.add_complaint(complaint)
    store.save_point(point)

    click.echo(f"✅ 已为点位 {point.name} 补录投诉 {complaint_no}")
    click.echo(f"   操作人：社区书记周姐")


@cli.command()
@click.argument('point_id')
@click.option('--operator', required=True, help='操作人')
@click.option('--note', required=True, help='修正说明')
def manual_fix(point_id, operator, note):
    """人工修正点位"""
    store = DataStore()
    point = store.get_point(point_id)
    if not point:
        click.echo(f"❌ 未找到点位 {point_id}")
        return

    point.manual_fix(operator, note)
    store.save_point(point)
    click.echo(f"✅ 点位 {point.name} 已人工修正")


@cli.command()
@click.argument('point_id')
@click.option('--operator', default='系统', help='操作人')
def rerun(point_id, operator):
    """重跑点位复核"""
    store = DataStore()
    point = store.get_point(point_id)
    if not point:
        click.echo(f"❌ 未找到点位 {point_id}")
        return

    streets = store.get_all_streets()
    checker = BoundaryChecker(streets)
    checker.process_point(point)
    point.re_run(operator)
    store.save_point(point)

    click.echo(f"✅ 点位 {point.name} 已重跑复核")


@cli.command()
@click.option('--output', '-o', help='输出文件名')
@click.option('--title', default='公厕服务半径复核地图', help='地图标题')
def export(output, title):
    """导出地图"""
    store = DataStore()
    exporter = MapExporter()

    points = store.get_all_points()
    streets = store.get_all_streets()
    complaints = store.get_all_complaints()

    filepath = exporter.export_map(points, streets, complaints, title=title, filename=output)
    click.echo(f"✅ 地图已导出：{filepath}")


@cli.command()
@click.argument('file_path', type=click.Path(exists=True))
def import_points(file_path):
    """从JSON导入点位"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    store = DataStore()
    streets = store.get_all_streets()
    checker = BoundaryChecker(streets)

    count = 0
    for item in data:
        point = Point(
            id=item['id'],
            name=item['name'],
            lng=item['lng'],
            lat=item['lat'],
            address=item.get('address', ''),
            point_type=PointType(item.get('point_type', 'normal'))
        )
        checker.process_point(point)
        store.save_point(point)
        count += 1

    click.echo(f"✅ 已导入 {count} 个点位")


@cli.command()
def dashboard():
    """打开小看板（在浏览器中打开当前地图）"""
    store = DataStore()
    points = store.get_all_points()

    if not points:
        click.echo("⚠️ 暂无数据，先生成演示数据：")
        click.echo("   python cli.py init --demo")
        click.echo("   python cli.py export")
        return

    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    html_files = [f for f in os.listdir(output_dir) if f.endswith('.html')]

    if not html_files:
        click.echo("⚠️ 请先导出地图：python cli.py export")
        return

    latest = max(html_files)
    filepath = os.path.join(output_dir, latest)

    click.echo(f"📊 打开小看板：{filepath}")
    os.system(f'open "{filepath}"' if os.name == 'posix' else f'start "{filepath}"')


@cli.command()
def demo_flow():
    """演示三步流程：导入→补录投诉→导出更新"""
    click.echo("\n" + "="*60)
    click.echo("🚻 公厕服务半径复核 - 流程演示")
    click.echo("="*60)

    click.echo("\n📌 第一步：初始化演示数据（模拟夜间采样点导入）")
    click.echo("-" * 60)
    store = setup_demo_data()
    points = store.get_all_points()
    click.echo(f"   已导入 {len(points)} 个点位")
    for p in points:
        flag = "⚠️ 边界点位" if p.is_on_boundary else ("🌙 夜间采样" if p.point_type == PointType.NIGHT_SAMPLING else "  常规")
        click.echo(f"   {flag} {p.id} {p.name} - {p.status.value}")

    click.echo("\n📌 第二步：社区书记周姐补录居民投诉编号")
    click.echo("-" * 60)
    point = store.get_point("P-005")
    complaint = store.get_complaint("C-002")
    click.echo(f"   点位：{point.name}")
    click.echo(f"   补录投诉：{complaint.complaint_no} - {complaint.description}")
    point.add_complaint(complaint)
    store.save_point(point)
    click.echo("   ✅ 投诉补录完成，状态更新为：已补录投诉")

    click.echo("\n📌 第三步：重新导出地图")
    click.echo("-" * 60)
    exporter = MapExporter()
    points = store.get_all_points()
    streets = store.get_all_streets()
    complaints = store.get_all_complaints()
    filepath = exporter.export_map(points, streets, complaints,
                                    title="公厕服务半径复核地图 - 演示流程",
                                    filename="demo_flow_result.html")
    click.echo(f"   ✅ 地图已更新导出：{filepath}")
    click.echo(f"   地图中已包含：")
    click.echo(f"     • 边界点位标记（虚线红圈）")
    click.echo(f"     • 投诉编号标签")
    click.echo(f"     • 每个点位的「为什么留下/缺什么/找谁」说明")
    click.echo(f"     • 完整复核轨迹时间线")

    click.echo("\n" + "="*60)
    click.echo("🎉 演示流程完成！")
    click.echo(f"   打开地图查看：{filepath}")
    click.echo("="*60 + "\n")


if __name__ == '__main__':
    cli()
