#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime, timedelta
import json

from database import SessionLocal, init_db, HazardStatus
from services import HazardManagementService
from exporter import DataExporter


def print_result(result):
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_register(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        result = service.register_hazard(
            hazard_no=args.hazard_no,
            title=args.title,
            description=args.description,
            location=args.location,
            level=args.level,
            operator_id=args.operator_id,
            photo_path=args.photo_path,
            request_id=args.request_id
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_assign(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        deadline = datetime.fromisoformat(args.deadline) if args.deadline else datetime.utcnow() + timedelta(days=7)
        result = service.assign_hazard(
            hazard_no=args.hazard_no,
            rectifier_id=args.rectifier_id,
            deadline=deadline,
            operator_id=args.operator_id,
            remark=args.remark,
            request_id=args.request_id
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_rectify(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        result = service.rectify_hazard(
            hazard_no=args.hazard_no,
            rectification_desc=args.description,
            operator_id=args.operator_id,
            photo_path=args.photo_path,
            request_id=args.request_id
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_recheck(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        result = service.recheck_hazard(
            hazard_no=args.hazard_no,
            recheck_result=args.passed,
            recheck_opinion=args.opinion,
            operator_id=args.operator_id,
            photo_path=args.photo_path,
            request_id=args.request_id
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_archive(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        result = service.archive_hazard(
            hazard_no=args.hazard_no,
            operator_id=args.operator_id,
            remark=args.remark,
            request_id=args.request_id
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_get(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        result = service.get_hazard(hazard_no=args.hazard_no)
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_list(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        status = HazardStatus(args.status) if args.status else None
        start_date = datetime.fromisoformat(args.start_date) if args.start_date else None
        end_date = datetime.fromisoformat(args.end_date) if args.end_date else None
        result = service.list_hazards(
            status=status,
            level=args.level,
            rectifier_id=args.rectifier_id,
            start_date=start_date,
            end_date=end_date,
            page=args.page,
            page_size=args.page_size
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_statistics(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        start_date = datetime.fromisoformat(args.start_date) if args.start_date else None
        end_date = datetime.fromisoformat(args.end_date) if args.end_date else None
        result = service.get_statistics(start_date=start_date, end_date=end_date)
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_logs(args):
    db = SessionLocal()
    service = HazardManagementService(db)
    try:
        start_date = datetime.fromisoformat(args.start_date) if args.start_date else None
        end_date = datetime.fromisoformat(args.end_date) if args.end_date else None
        result = service.get_operation_logs(
            hazard_no=args.hazard_no,
            operator_id=args.operator_id,
            start_date=start_date,
            end_date=end_date,
            page=args.page,
            page_size=args.page_size
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_export_excel(args):
    db = SessionLocal()
    exporter = DataExporter(db)
    try:
        status = HazardStatus(args.status) if args.status else None
        start_date = datetime.fromisoformat(args.start_date) if args.start_date else None
        end_date = datetime.fromisoformat(args.end_date) if args.end_date else None
        result = exporter.export_hazards_to_excel(
            file_path=args.output,
            status=status,
            level=args.level,
            start_date=start_date,
            end_date=end_date
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_export_json(args):
    db = SessionLocal()
    exporter = DataExporter(db)
    try:
        status = HazardStatus(args.status) if args.status else None
        start_date = datetime.fromisoformat(args.start_date) if args.start_date else None
        end_date = datetime.fromisoformat(args.end_date) if args.end_date else None
        result = exporter.export_hazards_to_json(
            file_path=args.output,
            status=status,
            level=args.level,
            start_date=start_date,
            end_date=end_date
        )
        print_result(result)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


def cmd_demo(args):
    print("运行演示流程...")
    db = SessionLocal()
    service = HazardManagementService(db)

    hazard_no = f"DEMO{int(datetime.now().timestamp())}"

    print(f"\n1. 登记隐患 {hazard_no}")
    result = service.register_hazard(
        hazard_no=hazard_no,
        title="车间消防通道堵塞",
        description="A栋3楼车间西侧消防通道被原材料堆放占用",
        location="A栋3楼西侧",
        level="严重",
        operator_id="SA001"
    )
    print(f"   结果: {result['message']}")

    print(f"\n2. 派发隐患给整改人 R001")
    result = service.assign_hazard(
        hazard_no=hazard_no,
        rectifier_id="R001",
        deadline=datetime.utcnow() + timedelta(days=3),
        operator_id="SA001",
        remark="请尽快整改"
    )
    print(f"   结果: {result['message']}")
    print(f"   整改人: {result['data']['rectifier_name']}")

    print(f"\n3. 整改人 R001 完成整改")
    result = service.rectify_hazard(
        hazard_no=hazard_no,
        rectification_desc="已清理通道内所有物料，通道已恢复畅通",
        operator_id="R001"
    )
    print(f"   结果: {result['message']}")

    print(f"\n4. 安全员 SA001 复查通过")
    result = service.recheck_hazard(
        hazard_no=hazard_no,
        recheck_result=True,
        recheck_opinion="现场确认已整改完毕，符合要求",
        operator_id="SA001"
    )
    print(f"   结果: {result['message']}")

    print(f"\n5. 归档隐患，完成闭环")
    result = service.archive_hazard(
        hazard_no=hazard_no,
        operator_id="SA001"
    )
    print(f"   结果: {result['message']}")

    print(f"\n6. 查看隐患完整信息")
    result = service.get_hazard(hazard_no=hazard_no)
    print(f"   状态: {result['data']['status']}")
    print(f"   登记人: {result['data']['registered_by_name']}")
    print(f"   整改人: {result['data']['rectifier_name']}")

    print(f"\n7. 查看统计数据")
    result = service.get_statistics()
    stats = result['data']
    print(f"   总隐患数: {stats['total']}")
    print(f"   已闭环: {stats['closed']}")
    print(f"   闭环率: {stats['closure_rate']}%")

    print(f"\n8. 导出Excel文件")
    import os
    os.makedirs("exports", exist_ok=True)
    exporter = DataExporter(db)
    export_file = f"exports/demo_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    result = exporter.export_hazards_to_excel(file_path=export_file)
    print(f"   导出文件: {export_file}")

    print(f"\n演示完成! 隐患编号: {hazard_no}")
    print("提示: 重复运行本命令将创建新的隐患记录，不会产生重复操作")


def main():
    init_db()

    parser = argparse.ArgumentParser(
        description="隐患闭环管理系统命令行工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
内置用户:
  SA001   张安全   安全员
  R001    李整改   整改人
  RV001   王复查   复查员
  ADMIN001  管理员  管理员
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser_register = subparsers.add_parser("register", help="登记隐患")
    parser_register.add_argument("--hazard-no", required=True, help="隐患编号")
    parser_register.add_argument("--title", required=True, help="隐患标题")
    parser_register.add_argument("--description", required=True, help="隐患描述")
    parser_register.add_argument("--location", required=True, help="位置")
    parser_register.add_argument("--level", default="一般", help="等级")
    parser_register.add_argument("--operator-id", default="SA001", help="操作人ID")
    parser_register.add_argument("--photo-path", help="照片路径")
    parser_register.add_argument("--request-id", help="请求ID(幂等用)")

    parser_assign = subparsers.add_parser("assign", help="派发隐患")
    parser_assign.add_argument("--hazard-no", required=True, help="隐患编号")
    parser_assign.add_argument("--rectifier-id", default="R001", help="整改人ID")
    parser_assign.add_argument("--deadline", help="截止时间(ISO格式)")
    parser_assign.add_argument("--operator-id", default="SA001", help="操作人ID")
    parser_assign.add_argument("--remark", help="备注")
    parser_assign.add_argument("--request-id", help="请求ID(幂等用)")

    parser_rectify = subparsers.add_parser("rectify", help="整改隐患")
    parser_rectify.add_argument("--hazard-no", required=True, help="隐患编号")
    parser_rectify.add_argument("--description", required=True, help="整改描述")
    parser_rectify.add_argument("--operator-id", default="R001", help="操作人ID")
    parser_rectify.add_argument("--photo-path", help="照片路径")
    parser_rectify.add_argument("--request-id", help="请求ID(幂等用)")

    parser_recheck = subparsers.add_parser("recheck", help="复查隐患")
    parser_recheck.add_argument("--hazard-no", required=True, help="隐患编号")
    parser_recheck.add_argument("--passed", action="store_true", help="是否通过")
    parser_recheck.add_argument("--opinion", default="符合要求", help="复查意见")
    parser_recheck.add_argument("--operator-id", default="SA001", help="操作人ID")
    parser_recheck.add_argument("--photo-path", help="照片路径")
    parser_recheck.add_argument("--request-id", help="请求ID(幂等用)")

    parser_archive = subparsers.add_parser("archive", help="归档隐患")
    parser_archive.add_argument("--hazard-no", required=True, help="隐患编号")
    parser_archive.add_argument("--operator-id", default="SA001", help="操作人ID")
    parser_archive.add_argument("--remark", help="备注")
    parser_archive.add_argument("--request-id", help="请求ID(幂等用)")

    parser_get = subparsers.add_parser("get", help="获取隐患详情")
    parser_get.add_argument("--hazard-no", required=True, help="隐患编号")

    parser_list = subparsers.add_parser("list", help="列出隐患")
    parser_list.add_argument("--status", help="状态")
    parser_list.add_argument("--level", help="等级")
    parser_list.add_argument("--rectifier-id", help="整改人ID")
    parser_list.add_argument("--start-date", help="开始日期")
    parser_list.add_argument("--end-date", help="结束日期")
    parser_list.add_argument("--page", type=int, default=1, help="页码")
    parser_list.add_argument("--page-size", type=int, default=20, help="每页数量")

    parser_stats = subparsers.add_parser("statistics", help="统计数据")
    parser_stats.add_argument("--start-date", help="开始日期")
    parser_stats.add_argument("--end-date", help="结束日期")

    parser_logs = subparsers.add_parser("logs", help="操作日志")
    parser_logs.add_argument("--hazard-no", help="隐患编号")
    parser_logs.add_argument("--operator-id", help="操作人ID")
    parser_logs.add_argument("--start-date", help="开始日期")
    parser_logs.add_argument("--end-date", help="结束日期")
    parser_logs.add_argument("--page", type=int, default=1, help="页码")
    parser_logs.add_argument("--page-size", type=int, default=50, help="每页数量")

    parser_export_excel = subparsers.add_parser("export-excel", help="导出Excel")
    parser_export_excel.add_argument("--output", required=True, help="输出文件路径")
    parser_export_excel.add_argument("--status", help="过滤状态")
    parser_export_excel.add_argument("--level", help="过滤等级")
    parser_export_excel.add_argument("--start-date", help="开始日期")
    parser_export_excel.add_argument("--end-date", help="结束日期")

    parser_export_json = subparsers.add_parser("export-json", help="导出JSON")
    parser_export_json.add_argument("--output", required=True, help="输出文件路径")
    parser_export_json.add_argument("--status", help="过滤状态")
    parser_export_json.add_argument("--level", help="过滤等级")
    parser_export_json.add_argument("--start-date", help="开始日期")
    parser_export_json.add_argument("--end-date", help="结束日期")

    parser_demo = subparsers.add_parser("demo", help="运行完整演示流程")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    command_map = {
        "register": cmd_register,
        "assign": cmd_assign,
        "rectify": cmd_rectify,
        "recheck": cmd_recheck,
        "archive": cmd_archive,
        "get": cmd_get,
        "list": cmd_list,
        "statistics": cmd_statistics,
        "logs": cmd_logs,
        "export-excel": cmd_export_excel,
        "export-json": cmd_export_json,
        "demo": cmd_demo,
    }

    command_map[args.command](args)


if __name__ == "__main__":
    main()
