from .models import StreetPoint
from .store import store
from . import service
from .models import Status


DEMO_POINTS = [
    StreetPoint(
        id="p001",
        name="人民广场地铁站出口",
        lat=31.2304,
        lng=121.4737,
        district="黄浦区"
    ),
    StreetPoint(
        id="p002",
        name="南京东路步行街",
        lat=31.2352,
        lng=121.4803,
        district="黄浦区"
    ),
    StreetPoint(
        id="p003",
        name="外滩观景平台",
        lat=31.2397,
        lng=121.4905,
        district="黄浦区"
    ),
]


def init_demo_data():
    for point in DEMO_POINTS:
        if point.id not in store.points:
            store.add_point(point)

    if len([o for o in store.orders.values()]) > 0:
        print("演示数据已存在，跳过初始化")
        return

    print("=" * 60)
    print("【演示流程开始】街道家具破损派单系统")
    print("=" * 60)

    print("\n【步骤1】施工告示第一次导入")
    print("-" * 40)
    order1, heatmap1 = service.import_construction_notice(
        point_id="p001",
        title="人民广场街道座椅破损",
        description="地铁站3号出口处，3张公共座椅靠背损坏，螺丝松动",
        operator="系统导入"
    )
    print(f"✅ 派单创建: {order1.id} - {order1.title}")
    print(f"   状态: {order1.status.value}")
    print(f"   原因: {order1.missing_reason}")
    print(f"   下一步: {order1.next_action}")
    print(f"   热力图版本: v{heatmap1.version}")
    for cell in heatmap1.cells:
        if cell.point_id == "p001":
            print(f"   热力图得分: {cell.score} | 状态: {cell.status.value}")
            print(f"   原因: {cell.reason}")
            break

    print("\n【步骤2】市政巡检员小付补看无障碍坡道记录（白天）")
    print("-" * 40)
    order2, heatmap2 = service.supplement_ramp_record(
        order_id=order1.id,
        ramp_description="地铁站3号出口无障碍坡道完好，坡度1:12，扶手齐全，防滑条有效",
        operator="市政巡检员小付",
        is_night=False
    )
    print(f"✅ 已补录白天无障碍坡道记录")
    print(f"   状态: {order2.status.value}")
    print(f"   原因: {order2.missing_reason}")
    print(f"   下一步: {order2.next_action}")
    print(f"   热力图版本: v{heatmap2.version}")
    for cell in heatmap2.cells:
        if cell.point_id == "p001":
            print(f"   热力图得分: {cell.score} | 状态: {cell.status.value}")
            print(f"   原因: {cell.reason}")
            break

    print("\n【关键点】晚上缺采样导致热力图偏低，留给街道规划员复核")
    print("-" * 40)
    print("⚠️  注意：当前只有白天采样，热力图得分偏低（0.48→0.51）")
    print("⚠️  状态标记为：晚上缺采样导致热力图偏低")
    print("⚠️  不会自动归为正常，已转交街道规划员复核")

    print("\n【步骤3】热力图更新（重跑）")
    print("-" * 40)
    heatmap3 = service.generate_heatmap(operator="市政巡检员小付", reason="流程验证重跑")
    print(f"✅ 热力图已重跑，版本: v{heatmap3.version}")
    print(f"   提示信息共 {len(heatmap3.notes)} 条:")
    for note in heatmap3.notes:
        print(f"   - {note}")

    print("\n【附加演示】人工修正和第二次重跑")
    print("-" * 40)
    order3, heatmap4 = service.manual_correct(
        order_id=order1.id,
        new_status=Status.CORRECTED,
        new_reason="经现场核实，该点位晚间有路灯照明，可视条件良好，无需额外晚间采样",
        operator="市政巡检员小付",
        correction_note="现场核实：人民广场地铁站出口24小时有照明，晚间采样条件满足"
    )
    print(f"✅ 人工修正完成")
    print(f"   新状态: {order3.status.value}")
    print(f"   修正原因: {order3.missing_reason}")
    print(f"   热力图版本: v{heatmap4.version}")
    for cell in heatmap4.cells:
        if cell.point_id == "p001":
            print(f"   热力图得分: {cell.score} | 状态: {cell.status.value}")
            break

    heatmap5 = service.generate_heatmap(operator="系统", reason="人工修正后重跑")
    print(f"✅ 修正后重跑热力图，版本: v{heatmap5.version}")

    print("\n" + "=" * 60)
    print("【演示数据初始化完成】")
    print("=" * 60)
    print(f"📊 街道点: {len(store.points)} 个")
    print(f"📋 派单记录: {len(store.orders)} 条")
    print(f"📝 采样记录: {len(store.records)} 条")
    print(f"📜 审计日志: {len(store.audit_logs)} 条")
    print(f"🗺️  热力图版本: v{store.heatmap_version}")
    print("\n🎯 演示数据包含:")
    print("   ✅ 施工告示第一次导入")
    print("   ✅ 市政巡检员小付补看无障碍坡道记录")
    print("   ✅ 热力图更新（三步流程）")
    print("   ✅ 晚上缺采样导致热力图偏低标记")
    print("   ✅ 一次人工修正")
    print("   ✅ 两次重跑")


def run_demo_workflow():
    print("\n" + "=" * 60)
    print("【运行完整演示流程】")
    print("=" * 60)

    order_id = list(store.orders.keys())[0] if store.orders else None
    if not order_id:
        init_demo_data()
        order_id = list(store.orders.keys())[0]

    detail = service.get_order_detail(order_id)
    order = detail["order"]
    print(f"\n📋 派单详情: {order['title']}")
    print(f"   ID: {order['id']}")
    print(f"   状态: {order['status']}")
    print(f"   热力图得分: {order['heatmap_score']}")
    print(f"   原因说明: {order['missing_reason']}")
    print(f"   下一步: {order['next_action']}")
    print(f"   负责人: {order['responsible_person']}")

    print(f"\n📜 变更审计记录 ({len(detail['audit_logs'])} 条):")
    for log in sorted(detail['audit_logs'], key=lambda x: x['timestamp']):
        print(f"   [{log['timestamp'][:19]}] {log['operator']} - {log['action']}")
        print(f"      原因: {log['reason']}")
        if log['changes']:
            for k, v in log['changes'].items():
                print(f"      {k}: {v}")

    latest_heatmap = store.get_latest_heatmap()
    if latest_heatmap:
        print(f"\n🗺️  当前热力图 (v{latest_heatmap.version}):")
        for cell in latest_heatmap.cells:
            point = store.points.get(cell.point_id)
            point_name = point.name if point else cell.point_id
            print(f"   {point_name}: 得分={cell.score}, 状态={cell.status.value}")
            if cell.reason:
                print(f"      说明: {cell.reason}")
            print(f"      白天采样: {'✅' if cell.has_day_coverage else '❌'} | 晚间采样: {'✅' if cell.has_night_coverage else '❌'}")
