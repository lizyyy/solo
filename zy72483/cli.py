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
        click.echo("   - 1次人工修正、1次重跑、1次边界确认")
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
        points = [p for p in points if p.is_night_sampling]
    elif point_type == 'complaint':
        points = [p for p in points if p.complaint_id]

    if not points:
        click.echo("暂无点位数据")
        return

    click.echo(f"\n{'ID':<8} {'名称':<16} {'类型':<22} {'状态':<20} {'边界':<6} {'投诉'}")
    click.echo("-" * 90)
    for p in points:
        boundary_mark = "⚠️ 是" if p.is_on_boundary else "  否"
        complaint_mark = p.complaint_id or "-"
        click.echo(f"{p.id:<8} {p.name:<16} {p.type_label:<22} {p.status.value:<20} {boundary_mark:<6} {complaint_mark}")
    click.echo(f"\n共 {len(points)} 个点位")


@cli.command()
@click.argument('point_id')
def detail(point_id):
    """查看点位详情（含改前改后内容）"""
    store = DataStore()
    point = store.get_point(point_id)
    if not point:
        click.echo(f"❌ 未找到点位 {point_id}")
        return

    click.echo(f"\n📍 {point.name} ({point.id})")
    click.echo(f"   地址：{point.address}")
    click.echo(f"   坐标：{point.lng}, {point.lat}")
    click.echo(f"   类型：{point.type_label}")
    click.echo(f"   状态：{point.status.value}")
    click.echo(f"   边界点位：{'是 ⚠️' if point.is_on_boundary else '否'}")

    if point.is_on_boundary:
        click.echo(f"   边界来源：{point.boundary_source}")
        click.echo(f"   边界结论：{point.boundary_conclusion or '待确认'}")

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

    if point.notes:
        click.echo(f"\n📌 备注/误差说明：")
        for n in point.notes:
            click.echo(f"   • {n}")

    if point.review_records:
        click.echo(f"\n📝 复核轨迹（含变更明细）：")
        for r in point.review_records:
            status_change = f" [{r.before_status} → {r.after_status}]" if r.before_status else ""
            click.echo(f"   • {r.timestamp} | {r.operator} | {r.action}{status_change}")
            if r.note:
                click.echo(f"     说明：{r.note}")
            if r.field_changes:
                click.echo(f"     变更明细：")
                for fc in r.field_changes:
                    old_val = fc.old_value if fc.old_value else "(无)"
                    new_val = fc.new_value if fc.new_value else "(无)"
                    click.echo(f"       {fc.field_label}：{old_val} → {new_val}")
            if r.affected_result:
                click.echo(f"     ⚡ 影响：{r.affected_result}")

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


@cli.command('confirm-boundary')
@click.argument('point_id')
@click.option('--operator', required=True, help='确认人')
@click.option('--conclusion', required=True, help='边界归属结论')
def confirm_boundary(point_id, operator, conclusion):
    """确认边界点位归属"""
    store = DataStore()
    point = store.get_point(point_id)
    if not point:
        click.echo(f"❌ 未找到点位 {point_id}")
        return

    if not point.is_on_boundary:
        click.echo(f"⚠️ 点位 {point.name} 不是边界点位")
        return

    point.confirm_boundary(operator, conclusion)
    store.save_point(point)
    click.echo(f"✅ 点位 {point.name} 边界归属已确认：{conclusion}")


@cli.command()
@click.option('--output', '-o', help='输出文件名')
@click.option('--title', default='公厕服务半径复核地图', help='地图标题')
def export(output, title):
    """导出地图"""
    store = DataStore()
    exporter = MapExporter()

    points = store.get_all_points()
    if not points:
        click.echo("⚠️ 暂无点位数据，请先导入或初始化演示数据")
        return

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
    """打开小看板"""
    store = DataStore()
    points = store.get_all_points()

    if not points:
        click.echo("⚠️ 暂无数据，先生成演示数据：")
        click.echo("   python3 cli.py init --demo")
        click.echo("   python3 cli.py export")
        return

    output_dir = os.path.join(os.path.dirname(__file__), 'output')
    html_files = [f for f in os.listdir(output_dir) if f.endswith('.html')] if os.path.exists(output_dir) else []

    if not html_files:
        click.echo("⚠️ 请先导出地图：python3 cli.py export")
        return

    latest = max(html_files)
    filepath = os.path.join(output_dir, latest)

    click.echo(f"📊 打开小看板：{filepath}")
    os.system(f'open "{filepath}"' if os.name == 'posix' else f'start "{filepath}"')


@cli.command()
def demo_flow():
    """演示完整流程：导入→边界识别→补录投诉→确认边界→导出地图"""
    click.echo("\n" + "=" * 70)
    click.echo("🚻 公厕服务半径复核 - 完整流程演示")
    click.echo("=" * 70)

    click.echo("\n📌 第一步：初始化演示数据（模拟夜间采样点导入）")
    click.echo("-" * 70)
    store = setup_demo_data()
    points = store.get_all_points()
    click.echo(f"   已导入 {len(points)} 个点位：")
    for p in points:
        click.echo(f"   {p.id} {p.name} | 类型：{p.type_label} | 状态：{p.status.value}")

    click.echo("\n📌 第二步：社区书记周姐补看居民投诉并补录")
    click.echo("-" * 70)
    point_p005 = store.get_point("P-005")
    complaint_p005 = store.get_complaint("C-002")
    click.echo(f"   点位：{point_p005.name}（{point_p005.type_label}）")
    click.echo(f"   补录投诉：{complaint_p005.complaint_no} - {complaint_p005.description}")
    point_p005.add_complaint(complaint_p005)
    store.save_point(point_p005)
    click.echo("   ✅ 投诉补录完成，状态更新为：已补录投诉")

    click.echo("\n📌 第三步：项目经理确认边界归属")
    click.echo("-" * 70)
    point_p002 = store.get_point("P-002")
    click.echo(f"   点位：{point_p002.name}（{point_p002.type_label}）")
    click.echo(f"   边界来源：{point_p002.boundary_source}")
    point_p002.confirm_boundary("项目经理老张", "归属和平街道管理，服务半径覆盖两侧")
    store.save_point(point_p002)
    click.echo("   ✅ 边界归属已确认，状态更新为：已确认")

    click.echo("\n📌 第四步：导出复核地图")
    click.echo("-" * 70)
    exporter = MapExporter()
    points = store.get_all_points()
    streets = store.get_all_streets()
    complaints = store.get_all_complaints()
    filepath = exporter.export_map(points, streets, complaints,
                                    title="公厕服务半径复核 - 完整报告",
                                    filename="demo_flow_result.html")
    click.echo(f"   ✅ 地图报告已导出：{filepath}")

    click.echo("\n📌 第五步：核对关键问题")
    click.echo("-" * 70)
    check_ok = True

    for p in store.get_all_points():
        if p.is_night_sampling and "夜间采样" not in p.type_label:
            click.echo(f"   ❌ {p.id} {p.name}：夜间采样标记丢失，类型显示为「{p.type_label}」")
            check_ok = False
        if p.is_on_boundary and "边界" not in p.type_label:
            click.echo(f"   ❌ {p.id} {p.name}：边界标记丢失，类型显示为「{p.type_label}」")
            check_ok = False
        if p.is_night_sampling and p.is_on_boundary:
            if p.type_label != "夜间采样 + 边界点位":
                click.echo(f"   ❌ {p.id} {p.name}：双标记显示错误，应为「夜间采样 + 边界点位」，实际为「{p.type_label}」")
                check_ok = False

        has_field_changes = any(r.field_changes for r in p.review_records)
        if p.review_records and not has_field_changes:
            click.echo(f"   ⚠️ {p.id} {p.name}：有复核记录但无变更明细")

        if p.is_on_boundary and not p.boundary_source:
            click.echo(f"   ❌ {p.id} {p.name}：边界点位缺少边界来源")
            check_ok = False

    if check_ok:
        click.echo("   ✅ 所有关键问题核对通过：")
        click.echo("     • 夜间采样标记：正确保留，不因边界标记而丢失")
        click.echo("     • 类型标签：支持「夜间采样 + 边界点位」双标记")
        click.echo("     • 变更明细：每条复核记录都包含改前改后内容")
        click.echo("     • 边界来源：每个边界点位都记录了来源信息")
        click.echo("     • 边界结论：来源+处理状态+结论在同一份结果中")

    click.echo("\n" + "=" * 70)
    click.echo("🎉 完整流程演示完成！")
    click.echo(f"   打开地图报告查看：{filepath}")
    click.echo("=" * 70 + "\n")


if __name__ == '__main__':
    cli()
