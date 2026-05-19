#!/usr/bin/env python3
import sys
import argparse
from datetime import date, datetime
from database import SessionLocal, init_db
from services import (
    WorkOrderService, ImportService, BillingService,
    ReviewService, HistoryService, MasterDataService
)

def get_db_session():
    return SessionLocal()

def cmd_init_db(args):
    """初始化数据库"""
    init_db()
    print("数据库初始化完成")

def cmd_create_operator(args):
    """创建机手"""
    db = get_db_session()
    service = MasterDataService(db)
    result = service.create_operator(
        name=args.name,
        phone=args.phone,
        id_card=args.id_card,
        hourly_rate=args.hourly_rate
    )
    print(f"机手创建成功: ID={result['id']}, 姓名={result['name']}")

def cmd_list_operators(args):
    """列出所有机手"""
    db = get_db_session()
    service = MasterDataService(db)
    operators = service.get_all_operators()
    if not operators:
        print("没有机手数据")
        return
    print(f"{'ID':<5} {'姓名':<10} {'电话':<15} {'小时单价':<10}")
    print("-" * 45)
    for op in operators:
        print(f"{op['id']:<5} {op['name']:<10} {op['phone']:<15} {op['hourly_rate']:<10}")

def cmd_create_tractor(args):
    """创建拖拉机"""
    db = get_db_session()
    service = MasterDataService(db)
    result = service.create_tractor(
        plate_number=args.plate_number,
        model=args.model,
        horsepower=args.horsepower,
        hourly_rate=args.hourly_rate,
        area_rate=args.area_rate
    )
    print(f"拖拉机创建成功: ID={result['id']}, 车牌号={result['plate_number']}")

def cmd_list_tractors(args):
    """列出所有拖拉机"""
    db = get_db_session()
    service = MasterDataService(db)
    tractors = service.get_all_tractors()
    if not tractors:
        print("没有拖拉机数据")
        return
    print(f"{'ID':<5} {'车牌号':<15} {'型号':<15} {'小时单价':<10} {'亩单价':<10}")
    print("-" * 60)
    for t in tractors:
        print(f"{t['id']:<5} {t['plate_number']:<15} {t['model']:<15} {t['hourly_rate']:<10} {t['area_rate']:<10}")

def cmd_create_work_order(args):
    """创建作业单"""
    db = get_db_session()
    service = WorkOrderService(db)
    data = {
        "order_no": args.order_no,
        "operator_id": args.operator_id,
        "tractor_id": args.tractor_id,
        "customer_name": args.customer_name,
        "work_type": args.work_type,
        "start_time": datetime.fromisoformat(args.start_time),
        "end_time": datetime.fromisoformat(args.end_time),
        "work_area": args.work_area,
        "fuel_used": args.fuel_used,
        "hourly_rate": args.hourly_rate,
        "area_rate": args.area_rate,
        "fuel_price": args.fuel_price,
        "minimum_charge": args.minimum_charge
    }
    result = service.create_work_order(data)
    if result["success"]:
        print(f"作业单创建成功: ID={result['work_order_id']}, 单号={result['order_no']}")
        billing = result.get("billing", {})
        if billing:
            print(f"  计费结果: {billing['final_amount']}元")
            for detail in billing['details']:
                print(f"    {detail}")
    else:
        print(f"作业单验证失败: {result['validation']['errors']}")

def cmd_get_work_order(args):
    """查看作业单详情"""
    db = get_db_session()
    service = WorkOrderService(db)
    result = service.get_work_order(args.id)
    if not result:
        print("作业单不存在")
        return
    print(f"作业单ID: {result['id']}")
    print(f"作业单号: {result['order_no']}")
    print(f"机手ID: {result['operator_id']}")
    print(f"拖拉机ID: {result['tractor_id']}")
    print(f"开始时间: {result['start_time']}")
    print(f"结束时间: {result['end_time']}")
    print(f"作业时长: {result['work_hours']}小时")
    print(f"作业面积: {result['work_area']}亩")
    print(f"最终金额: {result['final_amount']}元")
    print(f"状态: {result['status']}")
    print("\n验证日志:")
    for log in result['validation_logs']:
        status = "✓" if log['passed'] else "✗"
        print(f"  {status} {log['check_name']}: {log['message']}")

def cmd_import_csv(args):
    """从CSV导入作业单"""
    db = get_db_session()
    service = ImportService(db)
    with open(args.file, 'r', encoding='utf-8') as f:
        csv_content = f.read()
    result = service.import_from_csv(csv_content, filename=args.file)
    print(f"导入完成 - 批次ID: {result['batch_id']}")
    print(f"总行数: {result['total_rows']}, 有效: {result['valid_rows']}, 无效: {result['invalid_rows']}")
    print("\n详细结果:")
    for r in result['results']:
        status = "✓" if r['success'] else "✗"
        print(f"  第{r['row']}行: {status} {r.get('order_no', '')}")
        if not r['success']:
            if 'errors' in r:
                for err in r['errors']:
                    print(f"      错误: {err}")
            elif 'validation' in r and 'errors' in r['validation']:
                for err in r['validation']['errors']:
                    print(f"      错误: {err}")

def cmd_generate_bill(args):
    """生成账单"""
    db = get_db_session()
    service = BillingService(db)
    result = service.generate_bill(
        operator_id=args.operator_id,
        start_date=date.fromisoformat(args.start_date),
        end_date=date.fromisoformat(args.end_date)
    )
    if result.get("success"):
        print(f"账单生成成功: ID={result['bill_id']}, 单号={result['bill_no']}")
        print(f"  作业单数: {result.get('work_order_count', 0)}")
        print(f"  总工时: {result.get('total_hours', 0)}小时")
        print(f"  总面积: {result.get('total_area', 0)}亩")
        print(f"  总油耗: {result.get('total_fuel', 0)}升")
        print(f"  总金额: {result.get('total_amount', 0)}元")
        if result.get("message"):
            print(f"  提示: {result['message']}")
    else:
        print(f"账单生成失败: {result.get('error')}")

def cmd_get_bill(args):
    """查看账单详情"""
    db = get_db_session()
    service = BillingService(db)
    result = service.get_bill(args.id)
    if not result:
        print("账单不存在")
        return
    print(f"账单ID: {result['id']}")
    print(f"账单号: {result['bill_no']}")
    print(f"机手ID: {result['operator_id']}")
    print(f"计费周期: {result['billing_period_start']} 至 {result['billing_period_end']}")
    print(f"总工时: {result['total_hours']}小时")
    print(f"总面积: {result['total_area']}亩")
    print(f"总油耗: {result['total_fuel']}升")
    print(f"小计: {result['subtotal']}元")
    print(f"扣款: {result['deductions']}元")
    print(f"总金额: {result['total_amount']}元")
    print(f"状态: {result['status']}")
    print("\n明细:")
    for item in result['items']:
        print(f"  作业单{item['work_order_id']}: {item['line_total']}元")
        print(f"    {item['work_hours']}小时, {item['work_area']}亩, {item['fuel_used']}升")

def cmd_review_bill(args):
    """复核账单"""
    db = get_db_session()
    service = ReviewService(db)
    result = service.review_bill(
        bill_id=args.bill_id,
        reviewer=args.reviewer,
        notes=args.notes
    )
    if result.get("success"):
        print(f"账单复核成功: 账单号={result['bill_no']}, 复核人={result['reviewed_by']}")
    else:
        print(f"复核失败: {result.get('error')}")

def cmd_work_order_history(args):
    """查看作业单历史"""
    db = get_db_session()
    service = HistoryService(db)
    result = service.get_work_order_history(
        operator_id=args.operator_id,
        start_date=date.fromisoformat(args.start_date) if args.start_date else None,
        end_date=date.fromisoformat(args.end_date) if args.end_date else None,
        status=args.status
    )
    if not result:
        print("没有作业单记录")
        return
    print(f"{'ID':<5} {'单号':<15} {'开始时间':<20} {'工时':<8} {'面积':<8} {'金额':<10} {'状态':<10}")
    print("-" * 80)
    for wo in result:
        print(f"{wo['id']:<5} {wo['order_no']:<15} {str(wo['start_time']):<20} "
              f"{wo['work_hours']:<8} {wo['work_area']:<8} {wo['final_amount']:<10} {wo['status']:<10}")

def cmd_bill_history(args):
    """查看账单历史"""
    db = get_db_session()
    service = HistoryService(db)
    result = service.get_bill_history(
        operator_id=args.operator_id,
        start_date=date.fromisoformat(args.start_date) if args.start_date else None,
        end_date=date.fromisoformat(args.end_date) if args.end_date else None
    )
    if not result:
        print("没有账单记录")
        return
    print(f"{'ID':<5} {'账单号':<20} {'金额':<10} {'状态':<10} {'创建时间':<20}")
    print("-" * 70)
    for bill in result:
        print(f"{bill['id']:<5} {bill['bill_no']:<20} {bill['total_amount']:<10} "
              f"{bill['status']:<10} {str(bill['created_at']):<20}")

def cmd_import_history(args):
    """查看导入批次历史"""
    db = get_db_session()
    service = HistoryService(db)
    result = service.get_import_batches(batch_id=args.batch_id)
    if not result:
        print("没有导入记录")
        return
    print(f"{'批次ID':<25} {'文件名':<20} {'总行数':<8} {'有效':<8} {'无效':<8} {'状态':<10}")
    print("-" * 90)
    for batch in result:
        print(f"{batch['batch_id']:<25} {batch['filename'] or '':<20} {batch['total_rows']:<8} "
              f"{batch['valid_rows']:<8} {batch['invalid_rows']:<8} {batch['status']:<10}")

def cmd_demo_data(args):
    """创建演示数据"""
    db = get_db_session()
    master_service = MasterDataService(db)
    wo_service = WorkOrderService(db)

    print("创建演示数据...")
    
    op1 = master_service.create_operator("张三", "13800138001", hourly_rate=100)
    op2 = master_service.create_operator("李四", "13800138002", hourly_rate=120)
    print(f"  机手: {op1['name']}(ID={op1['id']}), {op2['name']}(ID={op2['id']})")

    t1 = master_service.create_tractor("京A12345", "东方红904", hourly_rate=150, area_rate=30)
    t2 = master_service.create_tractor("京A67890", "雷沃1204", hourly_rate=180, area_rate=35)
    print(f"  拖拉机: {t1['plate_number']}(ID={t1['id']}), {t2['plate_number']}(ID={t2['id']})")

    work_orders = [
        {
            "order_no": "WO001",
            "operator_id": op1['id'],
            "tractor_id": t1['id'],
            "customer_name": "王家庄",
            "work_type": "耕地",
            "start_time": datetime(2024, 5, 10, 8, 0, 0),
            "end_time": datetime(2024, 5, 10, 12, 0, 0),
            "work_area": 50,
            "fuel_used": 20,
            "hourly_rate": 150,
            "area_rate": 30,
            "fuel_price": 7.5,
            "minimum_charge": 500
        },
        {
            "order_no": "WO002",
            "operator_id": op1['id'],
            "tractor_id": t1['id'],
            "customer_name": "李家庄",
            "work_type": "播种",
            "start_time": datetime(2024, 5, 10, 14, 0, 0),
            "end_time": datetime(2024, 5, 10, 18, 0, 0),
            "work_area": 40,
            "fuel_used": 15,
            "hourly_rate": 150,
            "area_rate": 30,
            "fuel_price": 7.5,
            "minimum_charge": 300
        },
        {
            "order_no": "WO003",
            "operator_id": op2['id'],
            "tractor_id": t2['id'],
            "customer_name": "赵家庄",
            "work_type": "收割",
            "start_time": datetime(2024, 5, 11, 7, 0, 0),
            "end_time": datetime(2024, 5, 11, 19, 0, 0),
            "work_area": 100,
            "fuel_used": 50,
            "hourly_rate": 180,
            "area_rate": 35,
            "fuel_price": 7.5,
            "minimum_charge": 1000
        }
    ]

    for wo in work_orders:
        result = wo_service.create_work_order(wo)
        if result['success']:
            print(f"  作业单{result['order_no']}: {result['billing']['final_amount']}元")
        else:
            print(f"  作业单{wo['order_no']}: 创建失败")

    print("\n演示数据创建完成！")

def main():
    parser = argparse.ArgumentParser(description="农机合作社财务系统 CLI",
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    parser_init = subparsers.add_parser("init", help="初始化数据库")
    parser_init.set_defaults(func=cmd_init_db)

    parser_demo = subparsers.add_parser("demo", help="创建演示数据")
    parser_demo.set_defaults(func=cmd_demo_data)

    parser_op_create = subparsers.add_parser("op-create", help="创建机手")
    parser_op_create.add_argument("name", help="姓名")
    parser_op_create.add_argument("--phone", default="", help="电话")
    parser_op_create.add_argument("--id-card", default="", help="身份证号")
    parser_op_create.add_argument("--hourly-rate", type=float, default=0, help="小时单价")
    parser_op_create.set_defaults(func=cmd_create_operator)

    parser_op_list = subparsers.add_parser("op-list", help="列出机手")
    parser_op_list.set_defaults(func=cmd_list_operators)

    parser_t_create = subparsers.add_parser("t-create", help="创建拖拉机")
    parser_t_create.add_argument("plate_number", help="车牌号")
    parser_t_create.add_argument("--model", default="", help="型号")
    parser_t_create.add_argument("--horsepower", type=int, default=0, help="马力")
    parser_t_create.add_argument("--hourly-rate", type=float, default=0, help="小时单价")
    parser_t_create.add_argument("--area-rate", type=float, default=0, help="亩单价")
    parser_t_create.set_defaults(func=cmd_create_tractor)

    parser_t_list = subparsers.add_parser("t-list", help="列出拖拉机")
    parser_t_list.set_defaults(func=cmd_list_tractors)

    parser_wo_create = subparsers.add_parser("wo-create", help="创建作业单")
    parser_wo_create.add_argument("order_no", help="作业单号")
    parser_wo_create.add_argument("operator_id", type=int, help="机手ID")
    parser_wo_create.add_argument("tractor_id", type=int, help="拖拉机ID")
    parser_wo_create.add_argument("--start-time", required=True, help="开始时间(ISO格式)")
    parser_wo_create.add_argument("--end-time", required=True, help="结束时间(ISO格式)")
    parser_wo_create.add_argument("--customer", default="", dest="customer_name", help="客户名称")
    parser_wo_create.add_argument("--work-type", default="", help="作业类型")
    parser_wo_create.add_argument("--area", type=float, default=0, dest="work_area", help="作业面积(亩)")
    parser_wo_create.add_argument("--fuel", type=float, default=0, dest="fuel_used", help="耗油量(升)")
    parser_wo_create.add_argument("--hourly-rate", type=float, default=0, help="小时单价")
    parser_wo_create.add_argument("--area-rate", type=float, default=0, help="亩单价")
    parser_wo_create.add_argument("--fuel-price", type=float, default=0, help="油价")
    parser_wo_create.add_argument("--min-charge", type=float, default=0, dest="minimum_charge", help="最低收费")
    parser_wo_create.set_defaults(func=cmd_create_work_order)

    parser_wo_get = subparsers.add_parser("wo-get", help="查看作业单")
    parser_wo_get.add_argument("id", type=int, help="作业单ID")
    parser_wo_get.set_defaults(func=cmd_get_work_order)

    parser_import = subparsers.add_parser("import", help="从CSV导入作业单")
    parser_import.add_argument("file", help="CSV文件路径")
    parser_import.set_defaults(func=cmd_import_csv)

    parser_bill_gen = subparsers.add_parser("bill-gen", help="生成账单")
    parser_bill_gen.add_argument("operator_id", type=int, help="机手ID")
    parser_bill_gen.add_argument("start_date", help="开始日期(YYYY-MM-DD)")
    parser_bill_gen.add_argument("end_date", help="结束日期(YYYY-MM-DD)")
    parser_bill_gen.set_defaults(func=cmd_generate_bill)

    parser_bill_get = subparsers.add_parser("bill-get", help="查看账单")
    parser_bill_get.add_argument("id", type=int, help="账单ID")
    parser_bill_get.set_defaults(func=cmd_get_bill)

    parser_review = subparsers.add_parser("review", help="复核账单")
    parser_review.add_argument("bill_id", type=int, help="账单ID")
    parser_review.add_argument("reviewer", help="复核人")
    parser_review.add_argument("--notes", default="", help="备注")
    parser_review.set_defaults(func=cmd_review_bill)

    parser_wo_history = subparsers.add_parser("wo-history", help="作业单历史")
    parser_wo_history.add_argument("--operator-id", type=int, help="机手ID")
    parser_wo_history.add_argument("--start-date", help="开始日期")
    parser_wo_history.add_argument("--end-date", help="结束日期")
    parser_wo_history.add_argument("--status", help="状态")
    parser_wo_history.set_defaults(func=cmd_work_order_history)

    parser_bill_history = subparsers.add_parser("bill-history", help="账单历史")
    parser_bill_history.add_argument("--operator-id", type=int, help="机手ID")
    parser_bill_history.add_argument("--start-date", help="开始日期")
    parser_bill_history.add_argument("--end-date", help="结束日期")
    parser_bill_history.set_defaults(func=cmd_bill_history)

    parser_import_history = subparsers.add_parser("import-history", help="导入历史")
    parser_import_history.add_argument("--batch-id", help="批次ID")
    parser_import_history.set_defaults(func=cmd_import_history)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    init_db()
    args.func(args)

if __name__ == "__main__":
    main()
