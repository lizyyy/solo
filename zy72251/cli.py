import argparse
import sys
from valve_service import ValvePositioningService
from models import ValveStatus, NextAction
from demo_data import create_demo_scenario


def cmd_demo(args):
    print("\n🚀 运行地下管廊阀门定位演示场景\n")
    service, record_id = create_demo_scenario()
    print(f"\n📝 演示完成！记录ID: {record_id}")


def cmd_import(args):
    service = ValvePositioningService()
    print(f"\n📂 导入楼层剖面草图: {args.file}")
    
    valve_positions = [
        {"valve_id": f"V-{i+1:03d}", "label": f"阀门{i+1}", 
         "distance_to_obstacle": 1.5 + i * 0.3, "required_distance": 2.0}
        for i in range(args.valve_count)
    ]
    
    if args.has_screenshot:
        valve_positions[0]["has_screenshot_overlay"] = True
        valve_positions[0]["label_visibility"] = 20
    
    record = service.import_floor_sketch(
        file_name=args.file,
        floor_level=args.floor,
        uploaded_by=args.user,
        valve_positions=valve_positions,
        has_mobile_screenshot=args.has_screenshot
    )
    
    print(f"✅ 导入成功，记录ID: {record.record_id}")
    print(f"📍 标记阀门数: {len(valve_positions)}")
    
    report = service.calculate_safety_distance(record.record_id, args.user)
    print(f"\n📊 安全距离报告已生成:")
    print(f"   总计: {report.summary['total_valves']}")
    print(f"   正常: {report.summary['normal_count']}")
    print(f"   异常: {report.summary['abnormal_count']}")
    print(f"   截图遮挡: {report.summary['blocked_count']}")
    
    for issue in report.issues:
        status_icon = "🔴" if issue.is_blocked_by_screenshot else "🟡" if issue.status != ValveStatus.NORMAL else "🟢"
        print(f"\n   {status_icon} {issue.valve_label}")
        print(f"      状态: {issue.status.value}")
        print(f"      说明: {issue.why_kept}")
        if issue.missing_materials:
            print(f"      缺材料: {', '.join(issue.missing_materials)}")
        print(f"      下一步: {issue.next_action.value} → {issue.next_action_person.value}")


def cmd_add_log(args):
    service = ValvePositioningService()
    print(f"\n📝 补录点云抽稀日志到记录: {args.record_id}")
    
    log = service.add_point_cloud_log(
        record_id=args.record_id,
        operator=args.user,
        raw_remark=args.remark,
        thinning_ratio=args.ratio,
        confidence_level=args.confidence
    )
    
    if log:
        print(f"✅ 日志已添加: {log.log_id}")
        print(f"💬 原始备注: {log.raw_remark}")
        
        if args.rerun:
            print("\n🔄 重跑安全距离报告...")
            report = service.calculate_safety_distance(args.record_id, args.user)
            print(f"✅ 报告已更新: {report.report_id}")
    else:
        print(f"❌ 记录不存在: {args.record_id}")


def cmd_report(args):
    service = ValvePositioningService()
    print(f"\n📊 安全距离报告 - 记录ID: {args.record_id}")
    
    record = service.get_record(args.record_id)
    if not record:
        print(f"❌ 记录不存在")
        return
    
    if args.rerun:
        report = service.calculate_safety_distance(args.record_id, args.user)
    else:
        report = record.safety_report
    
    if not report:
        print("⚠️  暂无报告，请先计算")
        return
    
    print(f"\n生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"生成人: {report.generated_by}")
    print(f"\n汇总:")
    for k, v in report.summary.items():
        print(f"  {k}: {v}")
    
    print(f"\n问题详情:")
    for issue in report.issues:
        blocked_marker = "⚠️ 截图遮挡 " if issue.is_blocked_by_screenshot else ""
        print(f"\n  [{issue.status.value}] {blocked_marker}{issue.valve_label}")
        print(f"    距离: {issue.detected_distance}m / 要求 {issue.required_distance}m")
        print(f"    说明: {issue.why_kept}")
        if issue.missing_materials:
            print(f"    缺材料: {', '.join(issue.missing_materials)}")
        print(f"    下一步: {issue.next_action.value}")
        print(f"    责任人: {issue.next_action_person.value}")
    
    if args.show_changes:
        print(f"\n📜 变更历史:")
        for change in record.change_history:
            print(f"\n  [{change.timestamp.strftime('%H:%M:%S')}] {change.who}")
            print(f"    改了: {change.what_changed}")
            print(f"    原因: {change.why_changed}")


def cmd_changes(args):
    service = ValvePositioningService()
    print("\n📜 所有变更记录")
    print("=" * 60)
    
    changes = service.get_all_changes()
    if not changes:
        print("暂无变更记录")
        return
    
    for change in changes:
        print(f"\n[{change.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {change.who}")
        print(f"  改了什么: {change.what_changed}")
        print(f"  为什么改: {change.why_changed}")
        print(f"  影响: {change.affected_results}")


def main():
    parser = argparse.ArgumentParser(
        description="地下管廊阀门定位系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py demo                          # 运行演示场景
  python cli.py import -f B1.dwg -l B1 -u 小陶 -v 3 --screenshot
  python cli.py add-log -r <record_id> -u 小陶 -m "现场复测确认"
  python cli.py report -r <record_id> --rerun
  python cli.py web                           # 启动Web小看板
        """
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    demo_parser = subparsers.add_parser("demo", help="运行演示场景")
    
    import_parser = subparsers.add_parser("import", help="导入楼层剖面草图")
    import_parser.add_argument("-f", "--file", required=True, help="草图文件名")
    import_parser.add_argument("-l", "--floor", default="B1", help="楼层")
    import_parser.add_argument("-u", "--user", default="园区运维小陶", help="操作人")
    import_parser.add_argument("-v", "--valve-count", type=int, default=3, help="阀门数量")
    import_parser.add_argument("--screenshot", action="store_true", dest="has_screenshot", help="包含移动端截图")
    
    log_parser = subparsers.add_parser("add-log", help="补录点云抽稀日志")
    log_parser.add_argument("-r", "--record-id", required=True, help="记录ID")
    log_parser.add_argument("-u", "--user", default="园区运维小陶", help="操作人")
    log_parser.add_argument("-m", "--remark", required=True, help="点云抽稀日志备注")
    log_parser.add_argument("--ratio", type=float, default=0.75, help="抽稀率")
    log_parser.add_argument("--confidence", type=float, default=0.85, help="置信度")
    log_parser.add_argument("--rerun", action="store_true", help="添加后重跑报告")
    
    report_parser = subparsers.add_parser("report", help="查看安全距离报告")
    report_parser.add_argument("-r", "--record-id", required=True, help="记录ID")
    report_parser.add_argument("-u", "--user", default="园区运维小陶", help="操作人")
    report_parser.add_argument("--rerun", action="store_true", help="重跑报告")
    report_parser.add_argument("--show-changes", action="store_true", help="显示变更历史")
    
    changes_parser = subparsers.add_parser("changes", help="查看所有变更记录")
    
    web_parser = subparsers.add_parser("web", help="启动Web小看板")
    web_parser.add_argument("-p", "--port", type=int, default=8000, help="端口号")
    
    args = parser.parse_args()
    
    if args.command == "demo":
        cmd_demo(args)
    elif args.command == "import":
        cmd_import(args)
    elif args.command == "add-log":
        cmd_add_log(args)
    elif args.command == "report":
        cmd_report(args)
    elif args.command == "changes":
        cmd_changes(args)
    elif args.command == "web":
        print(f"\n🌐 启动Web小看板: http://localhost:{args.port}")
        import uvicorn
        uvicorn.run("web_app:app", host="0.0.0.0", port=args.port, reload=True)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
