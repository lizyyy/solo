#!/usr/bin/env python3
import sys
import json
import argparse
from datetime import datetime

from storage import DatabaseManager, RecordStatus
from business import BillingService, ImportService, ReviewService, ExportService


def init_services(db_path: str = "agri_finance.db"):
    db = DatabaseManager(db_path)
    billing_service = BillingService(db)
    import_service = ImportService(db, billing_service)
    review_service = ReviewService(db)
    export_service = ExportService(db)
    return db, billing_service, import_service, review_service, export_service


def cmd_import(args):
    _, _, import_service, _, _ = init_services(args.db)
    result = import_service.import_from_excel(args.file, args.operator)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_retry(args):
    _, _, import_service, _, _ = init_services(args.db)
    result = import_service.retry_failed_records(args.batch_id, args.operator)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_review(args):
    _, _, _, review_service, _ = init_services(args.db)
    
    if args.record_id:
        result = review_service.review_record(
            args.record_id, args.reviewer, args.approved, args.comment
        )
    elif args.batch_id:
        db = DatabaseManager(args.db)
        results = db.get_import_results(args.batch_id)
        record_ids = [r.record_id for r in results if r.record_id]
        result = review_service.batch_review(
            record_ids, args.reviewer, args.approved, args.comment
        )
    else:
        records = review_service.get_records_for_review(
            args.operator, args.start_date, args.end_date
        )
        print(f"待复核记录数: {len(records)}")
        for r in records:
            print(f"  ID: {r.id}, 编号: {r.record_no}, 机手: {r.operator}, 金额: {r.total_amount}")
        return

    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_export(args):
    _, _, _, _, export_service = init_services(args.db)
    
    query_params = {}
    if args.operator:
        query_params['operator'] = args.operator
    if args.start_date:
        query_params['start_date'] = args.start_date
    if args.end_date:
        query_params['end_date'] = args.end_date
    if args.status:
        query_params['status'] = args.status
    if args.exception_type:
        query_params['exception_type'] = args.exception_type
    if args.tractor_no:
        query_params['tractor_no'] = args.tractor_no
    if args.work_type:
        query_params['work_type'] = args.work_type
    
    result = export_service.query_and_export(args.output, **query_params)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_query(args):
    db, _, _, _, _ = init_services(args.db)
    
    query_params = {}
    if args.operator:
        query_params['operator'] = args.operator
    if args.start_date:
        query_params['start_date'] = args.start_date
    if args.end_date:
        query_params['end_date'] = args.end_date
    if args.status:
        query_params['status'] = args.status
    if args.exception_type:
        query_params['exception_type'] = args.exception_type
    if args.tractor_no:
        query_params['tractor_no'] = args.tractor_no
    if args.work_type:
        query_params['work_type'] = args.work_type
    
    records = db.query_work_records(**query_params)
    
    print(f"查询结果: 共 {len(records)} 条记录")
    print("-" * 100)
    
    for r in records:
        status_str = f"[{r.status}]" if r.status else ""
        exception_str = f" <{r.exception_type}>" if r.exception_type else ""
        print(f"ID:{r.id} 编号:{r.record_no} 机手:{r.operator} 日期:{r.work_date} "
              f"金额:{r.total_amount}元 {status_str}{exception_str}")
        if r.exception_detail:
            print(f"  异常详情: {r.exception_detail}")
        if r.reviewer:
            print(f"  复核: {r.reviewer} - {r.review_comment or '无意见'}")


def cmd_logs(args):
    db, _, _, _, _ = init_services(args.db)
    
    logs = db.get_action_logs(
        record_id=args.record_id,
        batch_id=args.batch_id,
        action_type=args.action_type
    )
    
    print(f"操作日志: 共 {len(logs)} 条")
    print("-" * 80)
    
    for log in logs:
        print(f"时间: {log['action_time']}")
        print(f"类型: {log['action_type']}, 操作人: {log['operator']}")
        if log['details']:
            print(f"详情: {log['details']}")
        print("-" * 40)


def cmd_batch(args):
    db, _, _, _, _ = init_services(args.db)
    
    if args.batch_id:
        batch = db.get_import_batch(args.batch_id)
        if not batch:
            print("批次不存在")
            return
        
        print(f"批次ID: {batch.batch_id}")
        print(f"文件名: {batch.file_name}")
        print(f"状态: {batch.status}")
        print(f"总数: {batch.total_count}, 成功: {batch.success_count}, 失败: {batch.failed_count}")
        print(f"创建人: {batch.created_by}")
        print(f"创建时间: {batch.created_at}")
        
        results = db.get_import_results(args.batch_id)
        print(f"\n导入结果明细 ({len(results)} 条):")
        for r in results:
            status = "成功" if r.success else "失败"
            print(f"  编号:{r.record_no} - {status}")
            if r.exception_detail:
                print(f"    原因: {r.exception_detail}")
    else:
        print("请提供 --batch_id 参数查看具体批次")


def cmd_calculate(args):
    db, billing_service, _, _, _ = init_services(args.db)
    
    total, errors = billing_service.calculate_total(
        billing_type=args.billing_type,
        hours=args.hours,
        hourly_rate=args.hourly_rate,
        area=args.area,
        area_rate=args.area_rate,
        fuel_consumption=args.fuel,
        fuel_price=args.fuel_price
    )
    
    if errors:
        print("计算错误:")
        for e in errors:
            print(f"  - {e}")
    else:
        print(f"计费类型: {args.billing_type}")
        print(f"计算结果: {total} 元")


def main():
    parser = argparse.ArgumentParser(description="农机合作社财务管理系统")
    parser.add_argument("--db", default="agri_finance.db", help="数据库文件路径")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    import_parser = subparsers.add_parser("import", help="从Excel导入数据")
    import_parser.add_argument("file", help="Excel文件路径")
    import_parser.add_argument("--operator", required=True, help="操作人姓名")
    
    retry_parser = subparsers.add_parser("retry", help="重试失败的导入记录")
    retry_parser.add_argument("batch_id", help="导入批次ID")
    retry_parser.add_argument("--operator", required=True, help="操作人姓名")
    
    review_parser = subparsers.add_parser("review", help="复核记录")
    review_parser.add_argument("--record_id", type=int, help="单条记录ID")
    review_parser.add_argument("--batch_id", help="批次ID（批量复核）")
    review_parser.add_argument("--operator", help="按机手筛选待复核记录")
    review_parser.add_argument("--start_date", help="开始日期 YYYY-MM-DD")
    review_parser.add_argument("--end_date", help="结束日期 YYYY-MM-DD")
    review_parser.add_argument("--reviewer", required=True, help="复核人姓名")
    review_parser.add_argument("--approved", action="store_true", help="是否通过")
    review_parser.add_argument("--comment", default="", help="复核意见")
    
    export_parser = subparsers.add_parser("export", help="查询并导出数据")
    export_parser.add_argument("output", help="输出Excel文件路径")
    export_parser.add_argument("--operator", help="按机手筛选")
    export_parser.add_argument("--start_date", help="开始日期 YYYY-MM-DD")
    export_parser.add_argument("--end_date", help="结束日期 YYYY-MM-DD")
    export_parser.add_argument("--status", help="按状态筛选")
    export_parser.add_argument("--exception_type", help="按异常类型筛选")
    export_parser.add_argument("--tractor_no", help="按拖拉机号筛选")
    export_parser.add_argument("--work_type", help="按作业类型筛选")
    
    query_parser = subparsers.add_parser("query", help="查询记录")
    query_parser.add_argument("--operator", help="按机手筛选")
    query_parser.add_argument("--start_date", help="开始日期 YYYY-MM-DD")
    query_parser.add_argument("--end_date", help="结束日期 YYYY-MM-DD")
    query_parser.add_argument("--status", help="按状态筛选")
    query_parser.add_argument("--exception_type", help="按异常类型筛选")
    query_parser.add_argument("--tractor_no", help="按拖拉机号筛选")
    query_parser.add_argument("--work_type", help="按作业类型筛选")
    
    logs_parser = subparsers.add_parser("logs", help="查看操作日志")
    logs_parser.add_argument("--record_id", type=int, help="按记录ID筛选")
    logs_parser.add_argument("--batch_id", help="按批次ID筛选")
    logs_parser.add_argument("--action_type", help="按操作类型筛选")
    
    batch_parser = subparsers.add_parser("batch", help="查看导入批次")
    batch_parser.add_argument("--batch_id", help="批次ID")
    
    calc_parser = subparsers.add_parser("calculate", help="计算金额")
    calc_parser.add_argument("--billing_type", required=True, 
                           choices=["hourly", "by_area", "fuel", "mixed"],
                           help="计费类型")
    calc_parser.add_argument("--hours", type=float, help="小时数")
    calc_parser.add_argument("--hourly_rate", type=float, help="小时单价")
    calc_parser.add_argument("--area", type=float, help="亩数")
    calc_parser.add_argument("--area_rate", type=float, help="亩单价")
    calc_parser.add_argument("--fuel", type=float, help="油耗(升)")
    calc_parser.add_argument("--fuel_price", type=float, help="油价(元/升)")
    
    args = parser.parse_args()
    
    if args.command == "import":
        cmd_import(args)
    elif args.command == "retry":
        cmd_retry(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "query":
        cmd_query(args)
    elif args.command == "logs":
        cmd_logs(args)
    elif args.command == "batch":
        cmd_batch(args)
    elif args.command == "calculate":
        cmd_calculate(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
