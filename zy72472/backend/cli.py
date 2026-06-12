#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime

import click

sys.path.insert(0, os.path.dirname(__file__))

from models import (
    load_points, save_points, get_point_by_id,
    load_streets, load_bus_data, build_street_tree,
    detect_street_membership, calculate_score,
    PointRecord, ScoreRecord, build_export_geojson
)


@click.group()
def cli():
    """儿童友好街区评分 - 命令行工具"""
    pass


@cli.command()
@click.option('--force', is_flag=True, help='强制重新初始化')
def init(force):
    """初始化演示数据"""
    points_file = os.path.join(os.path.dirname(__file__), 'data', 'points.json')
    if os.path.exists(points_file) and not force:
        click.echo("⚠️  数据已存在，使用 --force 强制重新初始化")
        return

    from init_demo import init_demo_data
    init_demo_data()


@cli.command('list')
def list_points():
    """列出所有点位"""
    points = load_points()
    click.echo(f"\n📋 共 {len(points)} 条点位记录\n")
    for p in points:
        boundary_icon = "🟡 边界" if p.is_boundary else "🟢 正常"
        bus_icon = "🚌" if p.bus_swipes_added else "❌"
        status_map = {
            'pending': '待处理',
            'processed': '已处理',
            'bus_added': '已补公交',
            'pending_review': '待复核',
            'completed': '已完成',
            'manually_corrected': '已修正'
        }
        status = status_map.get(p.status, p.status)
        click.echo(f"  [{p.id}] {p.name}")
        click.echo(f"       {boundary_icon} | 公交{bus_icon} | 状态: {status}")
        click.echo(f"       评分: {p.current_score.total} ({p.current_score.level}) | 方法: {p.current_score.method}")
        if p.is_boundary:
            click.echo(f"       涉及街道: {', '.join(p.boundary_streets)}")
        else:
            click.echo(f"       所属街道: {', '.join(p.streets)}")
        click.echo()


@cli.command()
@click.argument('point_id')
def show(point_id):
    """查看点位详情"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    click.echo(f"\n📍 {point.name} ({point.id})")
    click.echo(f"   坐标: {point.lng}, {point.lat}")
    click.echo(f"   路口: {point.cross_road}")
    click.echo(f"   边界: {'是' if point.is_boundary else '否'}")
    if point.is_boundary:
        click.echo(f"   涉及街道: {', '.join(point.boundary_streets)}")
    else:
        click.echo(f"   所属街道: {', '.join(point.streets)}")

    click.echo(f"\n📊 当前评分:")
    click.echo(f"   总分: {point.current_score.total} ({point.current_score.level})")
    click.echo(f"   交通安全: {point.current_score.traffic_safety}")
    click.echo(f"   步行设施: {point.current_score.pedestrian_facility}")
    click.echo(f"   公交可达: {point.current_score.bus_access}")
    click.echo(f"   游戏空间: {point.current_score.play_space}")
    click.echo(f"   计算方法: {point.current_score.method}")
    if point.current_score.note:
        click.echo(f"   备注: {point.current_score.note}")

    if point.score_history:
        click.echo(f"\n📜 评分历史 ({len(point.score_history)} 条):")
        for i, h in enumerate(reversed(point.score_history[-5:])):
            click.echo(f"   [{len(point.score_history)-i}] {h.calculated_at[:19]}")
            click.echo(f"       {h.total} ({h.level}) | 方法: {h.method}")
            if h.note:
                click.echo(f"       备注: {h.note}")

    if point.manual_correction:
        click.echo(f"\n✏️  人工修正: {point.manual_correction.get('reason', '')}")

    bus_list = load_bus_data()
    for b in bus_list:
        if b.get('point_id') == point_id:
            click.echo(f"\n🚌 公交数据:")
            click.echo(f"   线路: {b.get('route')} | 站点: {b.get('stop_name')}")
            click.echo(f"   刷卡时段: {', '.join(b.get('swipe_hours', []))}")
            click.echo(f"   高峰儿童数: {b.get('peak_children_count')}")
            click.echo(f"   口径: {'旧' if b.get('old_calculation') else '新'}")
            break

    click.echo()


@cli.command('add-bus')
@click.argument('point_id')
@click.option('--bus-id', help='公交数据ID')
def add_bus(point_id, bus_id):
    """为点位补录公交刷卡时段"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    bus_list = load_bus_data()
    bus_data = None
    for b in bus_list:
        if b['id'] == bus_id or b.get('point_id') == point_id:
            bus_data = b
            break

    if not bus_data:
        click.echo(f"❌ 未找到公交数据")
        return

    point.bus_data_id = bus_data['id']
    point.bus_swipes_added = True
    point.status = 'bus_added'

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data)
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    click.echo(f"✅ 已为 {point.name} 补录公交数据")
    click.echo(f"   新评分: {point.current_score.total} ({point.current_score.level})")
    click.echo(f"   方法: {point.current_score.method}")


@cli.command('correct')
@click.argument('point_id')
@click.option('--traffic', type=float, help='交通安全分')
@click.option('--pedestrian', type=float, help='步行设施分')
@click.option('--bus', type=float, help='公交可达分')
@click.option('--play', type=float, help='游戏空间分')
@click.option('--reason', default='人工复核调整', help='修正原因')
def manual_correct(point_id, traffic, pedestrian, bus, play, reason):
    """人工修正评分"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    override = {}
    if traffic is not None:
        override['traffic_safety'] = traffic
    if pedestrian is not None:
        override['pedestrian_facility'] = pedestrian
    if bus is not None:
        override['bus_access'] = bus
    if play is not None:
        override['play_space'] = play
    override['reason'] = reason

    if not override:
        click.echo("⚠️  未指定任何修正项")
        return

    bus_list = load_bus_data()
    bus_data = None
    if point.bus_data_id:
        for b in bus_list:
            if b['id'] == point.bus_data_id:
                bus_data = b
                break

    point.manual_correction = override
    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data, override)
    point.status = 'manually_corrected'
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    click.echo(f"✅ 已人工修正 {point.name}")
    click.echo(f"   原因: {reason}")
    click.echo(f"   新评分: {point.current_score.total} ({point.current_score.level})")


@cli.command()
@click.argument('point_id')
def rerun(point_id):
    """重跑评分计算"""
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        click.echo(f"❌ 点位 {point_id} 不存在")
        return

    bus_list = load_bus_data()
    bus_data = None
    if point.bus_data_id:
        for b in bus_list:
            if b['id'] == point.bus_data_id:
                bus_data = b
                break

    manual_override = point.manual_correction

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data, manual_override)
    if point.is_boundary:
        point.status = 'pending_review'
        click.echo(f"⚠️  点位位于街道边界，状态设为待复核")
    else:
        point.status = 'completed'
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    click.echo(f"✅ 已重跑评分: {point.current_score.total} ({point.current_score.level})")


def run_export(output_path=None, show_trail=False):
    """demo 用的简化导出函数"""
    path, geojson = build_export_geojson(output_path=output_path)
    summary = geojson['summary']

    click.echo(f"✅ 已导出到 {path}")
    click.echo()
    click.echo("📊 导出摘要:")
    click.echo(f"   总点位: {summary['total_points']}")
    click.echo(f"   边界待复核: {summary['boundary_points']}")
    click.echo(f"   已补公交: {summary['bus_added_points']}")
    click.echo(f"   人工修正: {summary['manually_corrected']}")
    click.echo(f"   旧口径数据: {summary['old_caliber_points']}")
    click.echo(f"   评分分布: {summary['score_distribution']}")
    click.echo()

    if show_trail:
        click.echo("🔍 追溯链详情:")
        for feat in geojson['features']:
            props = feat['properties']
            click.echo(f"   {props['id']} {props['name']}:")
            for t in props['audit_trail']:
                click.echo(f"     [步骤{t['step']}] {t['event']}: {t['score']}分 ({t['level']})")
        click.echo()

    return path


@cli.command()
@click.option('--format', 'fmt', default='geojson', help='导出格式')
@click.option('--output', help='输出文件路径')
@click.option('--show-trail', is_flag=True, help='显示追溯链信息')
def export(fmt, output, show_trail):
    """导出地图数据（含完整追溯链）"""
    run_export(output, show_trail)


@cli.command()
def demo():
    """运行完整演示流程"""
    click.echo("=" * 70)
    click.echo("🎬 儿童友好街区评分 - 完整流程演示（按实际操作路径复现）")
    click.echo("=" * 70)
    click.echo()

    click.echo("【第一步】初始化并导入路口照片...")
    click.echo("-" * 70)
    from init_demo import init_demo_data
    init_demo_data()
    points = load_points()

    p1 = get_point_by_id(points, 'point_001')
    p2 = get_point_by_id(points, 'point_002')
    p3 = get_point_by_id(points, 'point_003')

    click.echo(f"  ✅ 导入成功，共 {len(points)} 个点位")
    click.echo(f"  📷 point_001: {p1.name} - 照片: {p1.photo_path}")
    click.echo(f"  📷 point_002: {p2.name} - 照片: {p2.photo_path}")
    click.echo(f"  📷 point_003: {p3.name} - 照片: {p3.photo_path}")
    click.echo()
    click.echo(f"  🔍 自动边界检测结果:")
    for p in points:
        if p.is_boundary:
            click.echo(f"     ⚠️  {p.id}: 边界点位！涉及 {', '.join(p.boundary_streets)} - 标记待复核")
        else:
            click.echo(f"     ✅ {p.id}: 归属明确 - {', '.join(p.streets)}")
    click.echo()

    click.echo("【第二步】第一次地图导出（未补录公交）...")
    click.echo("-" * 70)
    export1_path = run_export(os.path.join(os.path.dirname(__file__), '..', 'exports', 'step2_export_before_bus.geojson'))
    click.echo()

    click.echo("【第三步】交通协管老马补录公交刷卡时段...")
    click.echo("-" * 70)
    bus_list = load_bus_data()

    for target_pid in ['point_001', 'point_002', 'point_003']:
        points = load_points()
        p = get_point_by_id(points, target_pid)
        old_total = p.current_score.total
        old_traffic = p.current_score.traffic_safety
        old_bus = p.current_score.bus_access

        bus_data = None
        for b in bus_list:
            if b.get('point_id') == target_pid:
                bus_data = b
                break

        if bus_data:
            p.bus_data_id = bus_data['id']
            p.bus_swipes_added = True
            p.status = 'bus_added'
            old_score = ScoreRecord(**p.current_score.__dict__)
            p.score_history.append(old_score)
            p.current_score = calculate_score(p, bus_data)
            p.updated_at = datetime.now().isoformat()
            save_points(points)

            caliber = "旧口径" if bus_data.get('old_calculation') else "新口径"
            click.echo(f"  🚌 {p.name}:")
            click.echo(f"     线路: {bus_data['route']} | 站点: {bus_data['stop_name']}")
            click.echo(f"     刷卡时段: {', '.join(bus_data['swipe_hours'])}")
            click.echo(f"     统计口径: {caliber} | 高峰儿童: {bus_data['peak_children_count']}人")
            click.echo(f"     评分变化: 公交分 {old_bus} → {p.current_score.bus_access}")
            click.echo(f"     总分变化: {old_total} → {p.current_score.total} ({p.current_score.level})")
            if p.current_score.note:
                click.echo(f"     备注: {p.current_score.note}")
            click.echo()

    click.echo("【第四步】补录公交后的地图导出（验证数据同步）...")
    click.echo("-" * 70)
    export2_path = run_export(os.path.join(os.path.dirname(__file__), '..', 'exports', 'step4_export_after_bus.geojson'))
    click.echo()

    click.echo("【第五步】项目经理人工修正边界点位...")
    click.echo("-" * 70)
    points = load_points()
    p2 = get_point_by_id(points, 'point_002')
    old_traffic = p2.current_score.traffic_safety
    old_total = p2.current_score.total
    click.echo(f"  修正前: 交通安全={old_traffic}, 总分={old_total}")

    override = {
        'traffic_safety': 72.0,
        'pedestrian_facility': 68.0,
        'reason': '项目经理复核：边界点位实际归解放路街道，调整评分'
    }
    p2.manual_correction = override
    old_score = ScoreRecord(**p2.current_score.__dict__)
    p2.score_history.append(old_score)
    p2.current_score = calculate_score(p2, bus_by_id_from_list(bus_list, p2.bus_data_id), override)
    p2.status = 'manually_corrected'
    p2.updated_at = datetime.now().isoformat()
    save_points(points)

    points = load_points()
    p2_check = get_point_by_id(points, 'point_002')
    click.echo(f"  修正后: 交通安全={p2_check.current_score.traffic_safety}, 总分={p2_check.current_score.total}")
    click.echo(f"  ✅ 验证: 人工修正分数已生效，交通安全 58.5 → {p2_check.current_score.traffic_safety}")
    click.echo(f"  修正原因: {p2_check.manual_correction['reason']}")
    click.echo()

    click.echo("【第六步】人工修正后的地图导出（含完整追溯链）...")
    click.echo("-" * 70)
    export3_path = run_export(os.path.join(os.path.dirname(__file__), '..', 'exports', 'step6_export_after_correction.geojson'), show_trail=True)
    click.echo()

    click.echo("【第七步】验证追溯链：从人工修正追回公交补录原始材料")
    click.echo("-" * 70)
    with open(export3_path, 'r', encoding='utf-8') as f:
        export_data = json.load(f)

    for feat in export_data['features']:
        props = feat['properties']
        pid = props['id']
        click.echo(f"  📍 {pid} {props['name']}:")
        click.echo(f"     当前评分: {props['score']['total']} ({props['score']['level']})")
        click.echo(f"     交通安全: {props['score']['traffic_safety']}")

        if props.get('bus_evidence'):
            be = props['bus_evidence']
            click.echo(f"     🚌 公交原始材料: {be['route']} {be['stop_name']}")
            click.echo(f"        时段: {', '.join(be['swipe_hours'])} | 儿童数: {be['peak_children_count']}")
            click.echo(f"        口径: {'旧' if be['old_calculation'] else '新'} | 备注: {be.get('note','')}")

        if props.get('manual_correction'):
            mc = props['manual_correction']
            click.echo(f"     ✏️  人工修正: {mc.get('reason','')}")
            overrides = {k:v for k,v in mc.items() if k != 'reason'}
            if overrides:
                click.echo(f"        调整字段: {overrides}")

        if props.get('audit_trail'):
            click.echo(f"     📜 完整操作痕迹 ({len(props['audit_trail'])} 步):")
            for step in props['audit_trail']:
                click.echo(f"        [{step['step']}] {step['event']} → {step['score']}分")

        click.echo()

    click.echo("=" * 70)
    click.echo("✅ 流程完成！三种处理结果对比：")
    click.echo("=" * 70)
    points = load_points()
    for p in points:
        tag = "顺利" if p.id == 'point_001' else "边界+修正" if p.id == 'point_002' else "旧口径"
        click.echo(f"  [{tag:8s}] {p.name}: {p.current_score.total} ({p.current_score.level})")
        click.echo(f"           交通安全={p.current_score.traffic_safety}, 方法={p.current_score.method}")
        if p.current_score.note:
            click.echo(f"           备注: {p.current_score.note}")
    click.echo()
    click.echo("📁 导出文件清单:")
    click.echo(f"  1. {export1_path}")
    click.echo(f"  2. {export2_path}")
    click.echo(f"  3. {export3_path}")
    click.echo()


def bus_by_id_from_list(bus_list, bus_id):
    for b in bus_list:
        if b['id'] == bus_id:
            return b
    return None


if __name__ == '__main__':
    cli()
