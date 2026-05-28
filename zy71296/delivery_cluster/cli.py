import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from delivery_cluster.importer import (
    import_orders,
    import_riders,
    import_road_network,
    import_bridges,
    import_nodes,
    import_capacity_config,
    ImportResult,
)
from delivery_cluster.road_network import RoadNetwork
from delivery_cluster.cluster import DeliveryClusterer, ClusterResult
from delivery_cluster.exporter import Exporter
from delivery_cluster.explainer import Explainer
from delivery_cluster.models import AnomalyType


def _print_import_errors(label: str, result: ImportResult):
    if result.errors:
        print(f"\n❌ 导入 {label} 时发现 {len(result.errors)} 个错误:", file=sys.stderr)
        for err in result.errors:
            location = f"（{err.get('row_data', {}).get('source_file', '')}"
            if err.get("line_number"):
                location += f" 第 {err['line_number']} 行）"
            else:
                location += ")"
            print(f"  - {err['message']}{location}", file=sys.stderr)
            if err.get("row_data"):
                row_str = json.dumps(err["row_data"], ensure_ascii=False, default=str)
                print(f"    原始数据: {row_str}", file=sys.stderr)

    if result.warnings:
        print(f"\n⚠️  导入 {label} 时发现 {len(result.warnings)} 个警告:", file=sys.stderr)
        for w in result.warnings:
            location = f"（第 {w.get('line_number', '?')} 行）"
            print(f"  - {w['message']}{location}", file=sys.stderr)


def _load_all_inputs(args) -> dict:
    inputs = {}

    print("📥 正在导入数据...")

    orders_result = import_orders(args.orders)
    _print_import_errors("订单", orders_result)
    if not orders_result.success:
        print("\n❌ 订单数据导入失败，终止执行", file=sys.stderr)
        sys.exit(1)
    inputs["orders"] = orders_result.items
    print(f"  ✅ 订单: {len(inputs['orders'])} 条")

    riders_result = import_riders(args.riders) if args.riders else ImportResult()
    _print_import_errors("骑手", riders_result)
    if args.riders and not riders_result.success:
        print("\n❌ 骑手数据导入失败，终止执行", file=sys.stderr)
        sys.exit(1)
    inputs["riders"] = riders_result.items
    print(f"  ✅ 骑手: {len(inputs['riders'])} 名")

    roads_result = import_road_network(args.roads) if args.roads else ImportResult()
    _print_import_errors("路网", roads_result)
    if args.roads and not roads_result.success:
        print("\n❌ 路网数据导入失败，终止执行", file=sys.stderr)
        sys.exit(1)
    inputs["roads"] = roads_result.items
    print(f"  ✅ 路段: {len(inputs['roads'])} 条")

    bridges_result = import_bridges(args.bridges) if args.bridges else ImportResult()
    _print_import_errors("桥梁", bridges_result)
    if args.bridges and not bridges_result.success:
        print("\n❌ 桥梁数据导入失败，终止执行", file=sys.stderr)
        sys.exit(1)
    inputs["bridges"] = bridges_result.items
    print(f"  ✅ 桥梁: {len(inputs['bridges'])} 座")

    nodes_result = import_nodes(args.nodes) if args.nodes else ImportResult()
    _print_import_errors("节点", nodes_result)
    if args.nodes and not nodes_result.success:
        print("\n❌ 节点数据导入失败，终止执行", file=sys.stderr)
        sys.exit(1)
    inputs["nodes"] = nodes_result.items
    print(f"  ✅ 节点: {len(inputs['nodes'])} 个")

    try:
        inputs["config"] = import_capacity_config(args.config) if args.config else None
    except Exception as e:
        print(f"\n❌ 容量配置导入失败: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"  ✅ 容量配置已加载" if inputs["config"] else "  ℹ️  使用默认容量配置")

    return inputs


def cmd_import(args):
    print("=== 📥 导入数据 ===")
    inputs = _load_all_inputs(args)

    if args.validate_only:
        print("\n✅ 所有数据验证通过")
        return

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "orders": [
                {
                    "id": o.id,
                    "lat": o.lat,
                    "lng": o.lng,
                    "weight": o.weight,
                    "timestamp": o.timestamp,
                    "source_file": o.source_file,
                    "source_line": o.source_line,
                }
                for o in inputs["orders"]
            ],
            "riders": [
                {
                    "id": r.id,
                    "lat": r.lat,
                    "lng": r.lng,
                    "capacity": r.capacity,
                    "source_file": r.source_file,
                    "source_line": r.source_line,
                }
                for r in inputs["riders"]
            ],
            "roads": [
                {
                    "from_node": e.from_node,
                    "to_node": e.to_node,
                    "distance_m": e.distance_m,
                    "has_bridge": e.has_bridge,
                    "bridge_id": e.bridge_id,
                }
                for e in inputs["roads"]
            ],
            "bridges": [
                {
                    "id": b.id,
                    "name": b.name,
                    "lat": b.lat,
                    "lng": b.lng,
                    "detour_penalty_m": b.detour_penalty_m,
                }
                for b in inputs["bridges"]
            ],
            "nodes": [
                {"id": n.id, "lat": n.lat, "lng": n.lng} for n in inputs["nodes"]
            ],
            "config": inputs["config"].__dict__ if inputs["config"] else None,
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 合并数据已导出到: {out_path}")


def cmd_cluster(args):
    print("=== 🧩 聚类分析 ===")
    inputs = _load_all_inputs(args)

    print("\n🔗 正在构建路网...")
    network = RoadNetwork()
    network.build(
        edges=inputs["roads"],
        nodes=inputs["nodes"],
        bridges=inputs["bridges"],
    )
    print(
        f"  ✅ 路网构建完成，共 {network.graph.number_of_nodes()} 个节点"
        f"，{network.graph.number_of_edges()} 条边"
    )

    print("\n🧮 正在执行聚类...")
    clusterer = DeliveryClusterer(network, config=inputs["config"])
    result = clusterer.cluster(inputs["orders"], inputs["riders"])

    print("\n📊 聚类结果:")
    print(f"  总订单数: {result.stats['total_orders']}")
    print(f"  片区数: {result.stats['total_zones']}")
    print(f"  平均每区订单: {result.stats['avg_orders_per_zone']}")
    print(f"  最大片区订单: {result.stats['max_zone_orders']}")
    print(f"  最小片区订单: {result.stats['min_zone_orders']}")
    print(f"  未分配订单: {len(result.unassigned_orders)}")
    print(f"  全局异常: {len(result.anomalies)} 个")
    print(f"  距离误导警告: {len(result.distance_warnings)} 个")

    for zone in result.zones:
        has_anomaly = "⚠️ " if zone.anomalies else ""
        print(
            f"\n  {has_anomaly}片区 {zone.id}:"
            f" 订单 {zone.order_count} | 总重 {zone.total_weight:.1f}"
            f" | 最大路网距离 {zone.max_road_distance_m:.0f}m"
            f" | 最大直线距离 {zone.max_straight_distance_m:.0f}m"
            f" | 跨桥 {zone.bridge_crossings} 次"
        )
        if zone.anomalies:
            for a in zone.anomalies:
                severity_color = {"critical": "🔴", "high": "🟠", "medium": "🟡", "warning": "🔵"}
                color = severity_color.get(a.severity, "⚪")
                print(f"    {color} [{a.severity}] {a.message}")

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)
        print(f"\n✅ 聚类结果已保存到: {out_path}")

    return result, inputs


def cmd_query(args):
    print("=== 🔍 查询订单/片区 ===")
    inputs = _load_all_inputs(args)

    print("\n🔗 正在构建路网...")
    network = RoadNetwork()
    network.build(
        edges=inputs["roads"],
        nodes=inputs["nodes"],
        bridges=inputs["bridges"],
    )

    clusterer = DeliveryClusterer(network, config=inputs["config"])
    result = clusterer.cluster(inputs["orders"], inputs["riders"])

    if args.order_id:
        found = False
        for zone in result.zones:
            for o in zone.orders:
                if o.id == args.order_id:
                    print(f"\n📦 订单 {o.id}:")
                    print(f"  坐标: ({o.lat}, {o.lng})")
                    print(f"  重量: {o.weight}")
                    print(f"  归属片区: {zone.id}")
                    if o.source_file:
                        print(f"  来源: {o.source_file}:{o.source_line}")

                    if zone.rider_id:
                        rider = next(
                            (r for r in inputs["riders"] if r.id == zone.rider_id), None
                        )
                        if rider:
                            road_dist, straight_dist, crossings = network.rider_to_order_distance(
                                rider, o
                            )
                            print(f"  到骑手 {rider.id} 距离:")
                            print(f"    路网: {road_dist:.0f}m")
                            print(f"    直线: {straight_dist:.0f}m")
                            ratio = straight_dist / road_dist if road_dist > 0 else 1
                            print(f"    比值: {ratio:.2f}")
                            if crossings:
                                print(f"    跨桥 {len(crossings)} 次:")
                                for c in crossings:
                                    b = c.get("bridge", {})
                                    print(
                                        f"      - {b.get('bridge_name', c.get('bridge_id', '未知'))}"
                                        f"（绕行 {b.get('detour_penalty_m', 0):.0f}m）"
                                    )
                    found = True
                    break
            if found:
                break

        if not found:
            o = next((o for o in inputs["orders"] if o.id == args.order_id), None)
            if o:
                print(f"\n❌ 订单 {args.order_id} 存在但未分配到任何片区")
            else:
                print(f"\n❌ 未找到订单: {args.order_id}")

    if args.zone_id:
        zone = next((z for z in result.zones if z.id == args.zone_id), None)
        if zone:
            explainer = Explainer()
            explanation = explainer.explain_zone(zone)
            print(f"\n{explanation['summary']}")
            print(f"\n  订单列表:")
            for o in zone.orders:
                print(f"    - {o.id} ({o.lat}, {o.lng})")

            if explanation["anomaly_explanations"]:
                print(f"\n  异常解释:")
                for ae in explanation["anomaly_explanations"]:
                    print(f"\n    [{ae['severity']}] {ae['type']}")
                    for line in ae["explanation"].split("\n"):
                        print(f"      {line}")
        else:
            print(f"\n❌ 未找到片区: {args.zone_id}")

    if args.distance_between:
        ids = args.distance_between.split(",")
        if len(ids) != 2:
            print("❌ 请使用格式: --distance-between order1,order2")
            return

        o1 = next((o for o in inputs["orders"] if o.id == ids[0]), None)
        o2 = next((o for o in inputs["orders"] if o.id == ids[1]), None)

        if not o1 or not o2:
            missing = [x for x in ids if not next((o for o in inputs["orders"] if o.id == x), None)]
            print(f"❌ 未找到订单: {', '.join(missing)}")
            return

        road_dist, straight_dist, crossings = network.order_to_order_distance(o1, o2)
        ratio = straight_dist / road_dist if road_dist > 0 else 1
        diff = road_dist - straight_dist

        print(f"\n📏 订单 {o1.id} ↔ {o2.id} 距离分析:")
        print(f"  路网距离: {road_dist:.0f}m")
        print(f"  直线距离: {straight_dist:.0f}m")
        print(f"  差值: {diff:.0f}m")
        print(f"  比值（直线/路网）: {ratio:.3f}")

        if ratio < 0.7:
            print(f"  ⚠️  比值 {ratio:.2f} < 0.7，直线距离严重误导！")

        if crossings:
            print(f"  🌉 跨越桥梁 {len(crossings)} 次:")
            for c in crossings:
                b = c.get("bridge", {})
                name = b.get("bridge_name", c.get("bridge_id", "未知"))
                penalty = b.get("detour_penalty_m", 0)
                if penalty > 0:
                    print(f"     - {name}（绕行罚距 {penalty:.0f}m）")
                else:
                    print(f"     - {name}")


def cmd_export(args):
    print("=== 📤 导出报告 ===")
    inputs = _load_all_inputs(args)

    print("\n🔗 正在构建路网...")
    network = RoadNetwork()
    network.build(
        edges=inputs["roads"],
        nodes=inputs["nodes"],
        bridges=inputs["bridges"],
    )

    print("\n🧮 正在执行聚类...")
    clusterer = DeliveryClusterer(network, config=inputs["config"])
    result = clusterer.cluster(inputs["orders"], inputs["riders"])

    exporter = Exporter(output_dir=args.output_dir)

    exported_files = []

    if args.format in ("json", "all"):
        json_path = exporter.export_report(
            result, inputs["orders"], inputs["riders"], format_type="json"
        )
        exported_files.append(json_path)
        print(f"  ✅ JSON 报告: {json_path}")

    if args.format in ("csv", "all"):
        csv_path = exporter.export_report(
            result, inputs["orders"], inputs["riders"], format_type="csv"
        )
        exported_files.append(csv_path)
        print(f"  ✅ CSV 报告: {csv_path}")

    if args.format in ("map", "all"):
        map_path = exporter.export_map(result, inputs["orders"], inputs["riders"])
        exported_files.append(map_path)
        print(f"  ✅ 交互式地图: {map_path}")

    print(f"\n✅ 共导出 {len(exported_files)} 个文件")
    for f in exported_files:
        print(f"   - {f}")

    if args.explain:
        print("\n=== 📝 异常解释 ===")
        explainer = Explainer()

        if result.anomalies:
            print(f"\n发现 {len(result.anomalies)} 个全局异常:")
            for i, a in enumerate(result.anomalies, 1):
                print(f"\n--- 异常 {i} ---")
                print(explainer.explain_anomaly(a))

        for zone in result.zones:
            if zone.anomalies:
                print(f"\n=== 片区 {zone.id} 异常 ===")
                for a in zone.anomalies:
                    print(f"\n{explainer.explain_anomaly(a)}")

    return result, inputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="delivery-cluster",
        description="配送聚类半径工具 - 基于路网距离和容量约束的智能片区划分",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 1. 验证并导入数据
  delivery-cluster import --orders orders.csv --riders riders.csv --roads roads.csv --bridges bridges.csv --nodes nodes.csv --validate-only

  # 2. 执行聚类
  delivery-cluster cluster --orders orders.csv --roads roads.csv --bridges bridges.csv --nodes nodes.csv --out result.json

  # 3. 查询特定订单
  delivery-cluster query --orders orders.csv --roads roads.csv --nodes nodes.csv --order-id O001

  # 4. 导出完整报告（含交互式地图）
  delivery-cluster export --orders orders.csv --riders riders.csv --roads roads.csv --bridges bridges.csv --nodes nodes.csv --format all --explain

  # 5. 查询两订单间距离
  delivery-cluster query --orders orders.csv --roads roads.csv --nodes nodes.csv --distance-between O001,O002
""",
    )

    parent_parser = argparse.ArgumentParser(add_help=False)
    parent_parser.add_argument("--orders", required=True, help="订单数据文件 (CSV/JSON)")
    parent_parser.add_argument("--riders", help="骑手数据文件 (CSV/JSON)")
    parent_parser.add_argument("--roads", help="路网边数据文件 (CSV/JSON)")
    parent_parser.add_argument("--bridges", help="桥梁数据文件 (CSV/JSON)")
    parent_parser.add_argument("--nodes", help="路网节点数据文件 (CSV/JSON)")
    parent_parser.add_argument("--config", help="容量配置文件 (JSON)")

    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser(
        "import",
        help="导入并验证数据",
        parents=[parent_parser],
    )
    import_parser.add_argument("--out", help="输出合并后的 JSON 文件")
    import_parser.add_argument("--validate-only", action="store_true", help="仅验证不导出")
    import_parser.set_defaults(func=cmd_import)

    cluster_parser = subparsers.add_parser(
        "cluster",
        help="执行空间聚类划分片区",
        parents=[parent_parser],
    )
    cluster_parser.add_argument("--out", help="输出聚类结果 JSON 文件")
    cluster_parser.set_defaults(func=cmd_cluster)

    query_parser = subparsers.add_parser(
        "query",
        help="查询订单、片区或距离信息",
        parents=[parent_parser],
    )
    query_parser.add_argument("--order-id", help="按订单ID查询")
    query_parser.add_argument("--zone-id", help="按片区ID查询")
    query_parser.add_argument("--distance-between", help="查询两订单距离，格式: id1,id2")
    query_parser.set_defaults(func=cmd_query)

    export_parser = subparsers.add_parser(
        "export",
        help="导出片区报告和地图",
        parents=[parent_parser],
    )
    export_parser.add_argument(
        "--format",
        choices=["json", "csv", "map", "all"],
        default="all",
        help="导出格式 (默认: all)",
    )
    export_parser.add_argument("--output-dir", default="./output", help="输出目录")
    export_parser.add_argument("--explain", action="store_true", help="输出异常详细解释")
    export_parser.set_defaults(func=cmd_export)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        args.func(args)
    except KeyboardInterrupt:
        print("\n⏹️  操作已取消", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ 执行失败: {e}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
