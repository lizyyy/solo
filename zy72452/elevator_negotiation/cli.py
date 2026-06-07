import argparse
import json
import sys
import os
from .engine import NegotiationEngine
from .exporter import MapExporter
from .models import ConstructionNotice, PointStatus


def main():
    parser = argparse.ArgumentParser(
        description="老旧小区电梯加装协商系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例流程（三步走）:
  1. 网格员导入巡查表:  python -m elevator_negotiation import data/sample_inspection.csv
  2. 规划员小姜补告示:  python -m elevator_negotiation supplement P001 --notice-id N001 --unit "XX建筑公司" --date 2024-01-15 --content "电梯加装施工告示"
  3. 导出地图更新报告:  python -m elevator_negotiation export
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入网格员巡查表")
    import_parser.add_argument("csv_file", help="巡查表CSV文件路径")
    import_parser.add_argument("--operator", default="网格员", help="操作人姓名")

    list_parser = subparsers.add_parser("list", help="列出所有点位")
    list_parser.add_argument("--boundary-only", action="store_true", help="只显示边界点位")

    view_parser = subparsers.add_parser("view", help="查看单个点位详情")
    view_parser.add_argument("point_id", help="点位ID")

    supplement_parser = subparsers.add_parser("supplement", help="街道规划员补录施工告示")
    supplement_parser.add_argument("point_id", help="点位ID")
    supplement_parser.add_argument("--notice-id", required=True, help="告示编号")
    supplement_parser.add_argument("--unit", required=True, help="施工单位")
    supplement_parser.add_argument("--date", required=True, help="告示日期 (YYYY-MM-DD)")
    supplement_parser.add_argument("--content", required=True, help="告示内容")
    supplement_parser.add_argument("--operator", default="街道规划员小姜", help="操作人")

    review_parser = subparsers.add_parser("review", help="项目经理复核边界点位")
    review_parser.add_argument("point_id", help="点位ID")
    review_parser.add_argument("--notes", required=True, help="复核备注")
    review_parser.add_argument("--confirm-boundary", action="store_true", default=True, help="确认是边界点位")
    review_parser.add_argument("--operator", default="项目经理", help="操作人")

    export_parser = subparsers.add_parser("export", help="导出地图报告")
    export_parser.add_argument("--output", help="输出文件名（可选）")

    sample_parser = subparsers.add_parser("init-sample", help="初始化样例数据")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    engine = NegotiationEngine()
    exporter = MapExporter()

    if args.command == "init-sample":
        cmd_init_sample()
        return

    if args.command == "import":
        cmd_import(engine, args)
    elif args.command == "list":
        cmd_list(engine, args)
    elif args.command == "view":
        cmd_view(engine, args)
    elif args.command == "supplement":
        cmd_supplement(engine, args)
    elif args.command == "review":
        cmd_review(engine, args)
    elif args.command == "export":
        cmd_export(engine, exporter, args)


def cmd_init_sample():
    data_dir = "data"
    os.makedirs(data_dir, exist_ok=True)

    streets = [
        {
            "name": "和平街道",
            "code": "HP001",
            "boundary": [
                [116.397, 39.908], [116.405, 39.908],
                [116.405, 39.915], [116.397, 39.915],
                [116.397, 39.908]
            ]
        },
        {
            "name": "团结街道",
            "code": "TJ001",
            "boundary": [
                [116.405, 39.908], [116.413, 39.908],
                [116.413, 39.915], [116.405, 39.915],
                [116.405, 39.908]
            ]
        },
        {
            "name": "新华街道",
            "code": "XH001",
            "boundary": [
                [116.397, 39.915], [116.405, 39.915],
                [116.405, 39.922], [116.397, 39.922],
                [116.397, 39.915]
            ]
        }
    ]

    with open(os.path.join(data_dir, "streets.json"), "w", encoding="utf-8") as f:
        json.dump(streets, f, ensure_ascii=False, indent=2)

    csv_content = """point_id,name,address,lng,lat,record_id,inspector,inspection_date,community_name,building_number,unit_count,resident_count,support_rate,issues
P001,阳光花园3号楼,和平区阳光路88号,116.405,39.911,R001,王网格员,2024-01-10,阳光花园,3号楼,3,42,0.78,楼道灯光昏暗|消防通道堵塞
P002,幸福里5号楼,团结区幸福街12号,116.408,39.910,R002,李网格员,2024-01-11,幸福里,5号楼,2,28,0.85,
P003,新华小区2号楼,新华区新华路56号,116.400,39.918,R003,张网格员,2024-01-12,新华小区,2号楼,4,56,0.65,低楼层居民反对
"""

    with open(os.path.join(data_dir, "sample_inspection.csv"), "w", encoding="utf-8") as f:
        f.write(csv_content)

    print("✅ 样例数据已初始化!")
    print("   - data/streets.json (三个街道的边界数据)")
    print("   - data/sample_inspection.csv (3个巡查点位，其中P001在街道边界上)")
    print()
    print("下一步: 运行 python -m elevator_negotiation import data/sample_inspection.csv")


def cmd_import(engine: NegotiationEngine, args):
    if not os.path.exists(args.csv_file):
        print(f"❌ 文件不存在: {args.csv_file}")
        sys.exit(1)
    
    points = engine.import_inspection_csv(args.csv_file, args.operator)
    print(f"✅ 成功导入 {len(points)} 条巡查记录")
    print()
    
    for p in points:
        flag = "🔴" if p.is_boundary else "🟢"
        streets = "、".join(p.located_streets) if p.located_streets else "未知"
        print(f"{flag} [{p.point_id}] {p.name}")
        print(f"   地址: {p.address}")
        print(f"   涉及街道: {streets}")
        print(f"   状态: {p.status.value}")
        print(f"   下一步: {p.next_action.value}")
        if p.missing_materials:
            print(f"   缺少材料: {', '.join(p.missing_materials)}")
        print()
    
    boundary_count = len([p for p in points if p.is_boundary])
    if boundary_count > 0:
        print(f"⚠️  发现 {boundary_count} 个边界点位，已标记为待项目经理复核")


def cmd_list(engine: NegotiationEngine, args):
    points = engine.get_boundary_points() if args.boundary_only else engine.list_points()
    
    if not points:
        print("暂无点位数据")
        return
    
    print(f"共 {len(points)} 个点位:")
    print("-" * 80)
    for p in points:
        flag = "🔴" if p.is_boundary else "🟢"
        notice_flag = "📋" if p.notice else "❌"
        print(f"{flag} [{p.point_id}] {p.name:20s} | 状态: {p.status.value:12s} | 告示: {notice_flag} | 下一步: {p.next_action.value}")


def cmd_view(engine: NegotiationEngine, args):
    point = engine.get_point(args.point_id)
    if not point:
        print(f"❌ 未找到点位: {args.point_id}")
        sys.exit(1)
    
    flag = "🔴 边界点位" if point.is_boundary else "🟢 正常点位"
    print(f"\n{'='*60}")
    print(f"点位详情: {point.point_id} - {point.name}")
    print(f"{'='*60}")
    print(f"分类: {flag}")
    print(f"地址: {point.address}")
    print(f"坐标: {point.lng}, {point.lat}")
    print(f"涉及街道: {'、'.join(point.located_streets) if point.located_streets else '未知'}")
    print(f"当前状态: {point.status.value}")
    print(f"下一步行动: {point.next_action.value}")
    print(f"缺少材料: {', '.join(point.missing_materials) if point.missing_materials else '无'}")
    print()
    
    if point.inspection:
        print("📋 巡查记录:")
        print(f"   巡查员: {point.inspection.inspector}")
        print(f"   日期: {point.inspection.inspection_date}")
        print(f"   小区: {point.inspection.community_name}")
        print(f"   楼号: {point.inspection.building_number}")
        print(f"   单元数: {point.inspection.unit_count}")
        print(f"   居民数: {point.inspection.resident_count}")
        print(f"   支持率: {point.inspection.support_rate:.0%}")
        if point.inspection.issues:
            print(f"   问题: {', '.join(point.inspection.issues)}")
        print()
    
    if point.notice:
        print("🏗️  施工告示:")
        print(f"   告示编号: {point.notice.notice_id}")
        print(f"   施工单位: {point.notice.construction_unit}")
        print(f"   告示日期: {point.notice.notice_date}")
        print(f"   内容: {point.notice.content}")
        print()
    else:
        print("🏗️  施工告示: ❌ 未补录 (找街道规划员小姜)")
        print()
    
    if point.review_notes:
        print("👔 项目经理复核备注:")
        print(f"   {point.review_notes}")
        print()
    
    if point.history:
        print("📜 操作历史:")
        for h in point.history:
            print(f"   [{h['time']}] {h['operator']}: {h['action']} {h.get('note', '')}")
    
    print(f"{'='*60}\n")


def cmd_supplement(engine: NegotiationEngine, args):
    point = engine.get_point(args.point_id)
    if not point:
        print(f"❌ 未找到点位: {args.point_id}")
        sys.exit(1)
    
    notice = ConstructionNotice(
        notice_id=args.notice_id,
        point_id=args.point_id,
        construction_unit=args.unit,
        notice_date=args.date,
        content=args.content
    )
    
    updated = engine.supplement_notice(args.point_id, notice, args.operator)
    
    if updated:
        print(f"✅ 施工告示已补录!")
        print(f"   点位: {updated.name}")
        print(f"   告示编号: {args.notice_id}")
        print(f"   新状态: {updated.status.value}")
        print(f"   下一步: {updated.next_action.value}")
        
        if updated.is_boundary:
            print(f"⚠️  该点位仍在边界上，需项目经理复核确认归属")


def cmd_review(engine: NegotiationEngine, args):
    point = engine.get_point(args.point_id)
    if not point:
        print(f"❌ 未找到点位: {args.point_id}")
        sys.exit(1)
    
    updated = engine.manager_review(
        args.point_id,
        args.notes,
        confirm_boundary=args.confirm_boundary,
        operator=args.operator
    )
    
    if updated:
        boundary_text = "确认边界点位" if args.confirm_boundary else "排除边界，归入正常流程"
        print(f"✅ 项目经理复核完成!")
        print(f"   点位: {updated.name}")
        print(f"   复核结论: {boundary_text}")
        print(f"   新状态: {updated.status.value}")
        print(f"   下一步: {updated.next_action.value}")


def cmd_export(engine: NegotiationEngine, exporter: MapExporter, args):
    points = engine.list_points()
    if not points:
        print("❌ 暂无点位数据，先导入巡查表")
        sys.exit(1)
    
    filepath = exporter.export_report(points, args.output)
    print(f"✅ 报告已导出: {filepath}")
    print()
    print(f"   包含 {len(points)} 个点位")
    print(f"   其中边界点位: {len([p for p in points if p.is_boundary])} 个")
    print(f"   已补录告示: {len([p for p in points if p.notice])} 个")
    print()
    print("   报告特点:")
    print("   - 不是冷冰冰的系统日志")
    print("   - 说明每条为什么被留下")
    print("   - 说明还缺什么材料")
    print("   - 说明下一步找谁（项目经理还是规划员小姜）")


if __name__ == "__main__":
    main()
