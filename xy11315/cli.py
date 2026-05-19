#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from bus_scheduler.models import Role, RulingResult
from bus_scheduler.storage import IdempotentStore
from bus_scheduler.service import BusSchedulerService
from bus_scheduler.exporter import DataExporter


def parse_datetime(s: str) -> datetime:
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        raise argparse.ArgumentTypeError(f"无效的日期格式: {s}")


def main():
    parser = argparse.ArgumentParser(description="校车调度迟到责任判定系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    appeal_parser = subparsers.add_parser("receive_appeal", help="接收家长申诉")
    appeal_parser.add_argument("--parent_id", required=True, help="家长ID")
    appeal_parser.add_argument("--parent_name", required=True, help="家长姓名")
    appeal_parser.add_argument("--student_name", required=True, help="学生姓名")
    appeal_parser.add_argument("--bus_id", required=True, help="车牌号")
    appeal_parser.add_argument("--route_id", required=True, help="线路ID")
    appeal_parser.add_argument("--stop_name", required=True, help="站点名称")
    appeal_parser.add_argument("--scheduled_time", required=True, type=parse_datetime, help="计划时间 (ISO格式)")
    appeal_parser.add_argument("--appeal_time", required=True, type=parse_datetime, help="申诉时间 (ISO格式)")
    appeal_parser.add_argument("--description", required=True, help="申诉描述")
    appeal_parser.add_argument("--actual_arrival_time", type=parse_datetime, help="实际到达时间")
    appeal_parser.add_argument("--operator", default="dispatcher001", help="操作人")
    appeal_parser.add_argument("--operator_role", default="dispatcher", help="操作人角色")
    
    gps_parser = subparsers.add_parser("receive_gps", help="接收GPS轨迹")
    gps_parser.add_argument("--bus_id", required=True, help="车牌号")
    gps_parser.add_argument("--route_id", required=True, help="线路ID")
    gps_parser.add_argument("--date", required=True, help="日期 (YYYY-MM-DD)")
    gps_parser.add_argument("--points_file", required=True, help="GPS点JSON文件路径")
    gps_parser.add_argument("--operator", default="system", help="操作人")
    gps_parser.add_argument("--operator_role", default="dispatcher", help="操作人角色")
    
    checkin_parser = subparsers.add_parser("receive_checkin", help="接收司机打卡")
    checkin_parser.add_argument("--driver_id", required=True, help="司机ID")
    checkin_parser.add_argument("--driver_name", required=True, help="司机姓名")
    checkin_parser.add_argument("--bus_id", required=True, help="车牌号")
    checkin_parser.add_argument("--route_id", required=True, help="线路ID")
    checkin_parser.add_argument("--checkin_time", required=True, type=parse_datetime, help="打卡时间")
    checkin_parser.add_argument("--location", help="打卡位置")
    checkin_parser.add_argument("--operator", default="driver001", help="操作人")
    checkin_parser.add_argument("--operator_role", default="driver", help="操作人角色")
    
    match_parser = subparsers.add_parser("match", help="匹配申诉")
    match_parser.add_argument("--appeal_id", help="申诉ID，不指定则匹配所有待处理申诉")
    match_parser.add_argument("--operator", required=True, help="操作人")
    match_parser.add_argument("--operator_role", default="dispatcher", help="操作人角色")
    
    rule_parser = subparsers.add_parser("rule", help="裁定案例")
    rule_parser.add_argument("--case_id", help="案例ID，不指定则裁定所有已匹配案例")
    rule_parser.add_argument("--operator", required=True, help="操作人")
    rule_parser.add_argument("--operator_role", default="dispatcher", help="操作人角色")
    
    review_parser = subparsers.add_parser("review", help="复核裁定")
    review_parser.add_argument("--case_id", required=True, help="案例ID")
    review_parser.add_argument("--uphold", required=True, choices=["true", "false"], help="是否维持原裁定")
    review_parser.add_argument("--reason", required=True, help="复核原因")
    review_parser.add_argument("--new_result", choices=[r.value for r in RulingResult], help="新的裁定结果")
    review_parser.add_argument("--operator", default="admin001", help="操作人")
    review_parser.add_argument("--operator_role", default="admin", help="操作人角色")
    
    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("--type", required=True, choices=["appeals_json", "rulings_json", "appeals_csv", "rulings_csv", "excel", "summary"], help="导出类型")
    export_parser.add_argument("--output", required=True, help="输出文件路径")
    export_parser.add_argument("--status", help="按状态过滤申诉")
    
    case_parser = subparsers.add_parser("show_case", help="查看案例详情")
    case_parser.add_argument("--case_id", required=True, help="案例ID")
    
    merge_parser = subparsers.add_parser("merge_check", help="检查重复申诉")
    
    audit_parser = subparsers.add_parser("audit_log", help="查看审计日志")
    audit_parser.add_argument("--entity_type", help="实体类型")
    audit_parser.add_argument("--entity_id", help="实体ID")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    store = IdempotentStore()
    service = BusSchedulerService(store)
    exporter = DataExporter(store)
    
    try:
        if args.command == "receive_appeal":
            role = Role(args.operator_role)
            success, message = service.receive_appeal(
                parent_id=args.parent_id,
                parent_name=args.parent_name,
                student_name=args.student_name,
                bus_id=args.bus_id,
                route_id=args.route_id,
                stop_name=args.stop_name,
                scheduled_time=args.scheduled_time,
                appeal_time=args.appeal_time,
                description=args.description,
                actual_arrival_time=args.actual_arrival_time,
                operator=args.operator,
                operator_role=role
            )
            print(f"{'成功' if success else '失败'}: {message}")
        
        elif args.command == "receive_gps":
            with open(args.points_file, 'r', encoding='utf-8') as f:
                points = json.load(f)
            for p in points:
                if isinstance(p.get("timestamp"), str):
                    p["timestamp"] = datetime.fromisoformat(p["timestamp"])
            
            role = Role(args.operator_role)
            success, message = service.receive_gps_track(
                bus_id=args.bus_id,
                route_id=args.route_id,
                date=args.date,
                points=points,
                operator=args.operator,
                operator_role=role
            )
            print(f"{'成功' if success else '失败'}: {message}")
        
        elif args.command == "receive_checkin":
            role = Role(args.operator_role)
            success, message = service.receive_driver_checkin(
                driver_id=args.driver_id,
                driver_name=args.driver_name,
                bus_id=args.bus_id,
                route_id=args.route_id,
                checkin_time=args.checkin_time,
                location=args.location,
                operator=args.operator,
                operator_role=role
            )
            print(f"{'成功' if success else '失败'}: {message}")
        
        elif args.command == "match":
            role = Role(args.operator_role)
            if args.appeal_id:
                success, message = service.match_appeal(args.appeal_id, args.operator, role)
                print(f"{'成功' if success else '失败'}: {message}")
            else:
                result = service.match_all_pending_appeals(args.operator, role)
                print(f"批量匹配完成: 总数={result.total_count}, 成功={result.success_count}, 失败={result.failure_count}")
                if result.failed_ids:
                    print(f"失败ID: {result.failed_ids}")
        
        elif args.command == "rule":
            role = Role(args.operator_role)
            if args.case_id:
                success, message = service.rule_on_case(args.case_id, args.operator, role)
                print(f"{'成功' if success else '失败'}: {message}")
            else:
                result = service.rule_all_matched_cases(args.operator, role)
                print(f"批量裁定完成: 总数={result.total_count}, 成功={result.success_count}, 失败={result.failure_count}")
                if result.failed_ids:
                    print(f"失败ID: {result.failed_ids}")
        
        elif args.command == "review":
            role = Role(args.operator_role)
            uphold = args.uphold == "true"
            new_result = RulingResult(args.new_result) if args.new_result else None
            success, message = service.review_ruling(
                case_id=args.case_id,
                uphold=uphold,
                reason=args.reason,
                new_result=new_result,
                operator=args.operator,
                operator_role=role
            )
            print(f"{'成功' if success else '失败'}: {message}")
        
        elif args.command == "export":
            output_path = args.output
            if args.type == "appeals_json":
                path = exporter.export_appeals_to_json(output_path, args.status)
            elif args.type == "rulings_json":
                path = exporter.export_rulings_to_json(output_path)
            elif args.type == "appeals_csv":
                path = exporter.export_appeals_to_csv(output_path, args.status)
            elif args.type == "rulings_csv":
                path = exporter.export_rulings_to_csv(output_path)
            elif args.type == "excel":
                path = exporter.export_case_details_to_excel(output_path)
            elif args.type == "summary":
                path = exporter.export_summary_report(output_path)
            print(f"导出成功: {path}")
        
        elif args.command == "show_case":
            details = service.get_case_details(args.case_id)
            if not details:
                print("案例不存在")
                return
            
            print("=" * 60)
            print(f"案例ID: {details['case'].case_id}")
            print(f"申诉ID: {details['case'].appeal_id}")
            print(f"车牌号: {details['case'].bus_id}")
            print(f"线路ID: {details['case'].route_id}")
            print(f"站点: {details['case'].stop_name}")
            
            if details.get('appeal'):
                print(f"\n申诉信息:")
                print(f"  家长: {details['appeal'].parent_name}")
                print(f"  学生: {details['appeal'].student_name}")
                print(f"  计划时间: {details['appeal'].scheduled_time}")
                print(f"  状态: {details['appeal'].status.value}")
            
            if details.get('rulings'):
                print(f"\n裁定信息:")
                for r in details['rulings']:
                    print(f"  裁定ID: {r.ruling_id}")
                    print(f"  结果: {r.result.value}")
                    print(f"  原因: {r.reason}")
                    print(f"  裁定人: {r.ruled_by}")
            
            if details.get('reviews'):
                print(f"\n复核信息:")
                for r in details['reviews']:
                    print(f"  复核ID: {r.review_id}")
                    print(f"  是否维持: {'是' if r.uphold else '否'}")
                    print(f"  原因: {r.reason}")
                    print(f"  复核人: {r.reviewed_by}")
            
            if details.get('audit_logs'):
                print(f"\n审计日志:")
                for log in details['audit_logs'][:5]:
                    print(f"  [{log.timestamp}] {log.action} - {log.operator}")
            print("=" * 60)
        
        elif args.command == "merge_check":
            groups = service.merge_duplicate_appeals()
            print(f"发现 {len(groups)} 组可能的重复申诉:")
            for key, appeals in groups.items():
                if len(appeals) > 1:
                    print(f"\n分组 {key}:")
                    for a in appeals:
                        print(f"  - {a.appeal_id}: {a.parent_name} - {a.student_name}")
        
        elif args.command == "audit_log":
            logs = store.get_audit_logs(args.entity_type, args.entity_id)
            print(f"共 {len(logs)} 条审计日志:")
            for log in logs:
                print(f"[{log.timestamp}] {log.entity_type}:{log.entity_id} - {log.action} by {log.operator}({log.operator_role.value})")
                if log.details:
                    print(f"  详情: {log.details}")
    
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
