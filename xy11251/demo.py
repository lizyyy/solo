import json
from services import ShortageService, BatchOperationService, QueryExportService
from models import CompensationType


def demo_basic_flow():
    print("=" * 60)
    print("演示1: 基础流程 - 识别缺货 -> 确认 -> 补偿 -> 结算")
    print("=" * 60)

    print("\n1. 识别缺货...")
    result = ShortageService.identify_shortage(
        order_no="ORD20240501001",
        product_id="PRD001",
        product_name="新鲜草莓",
        shortage_quantity=2,
        shortage_amount=59.8,
        operator="zhangsan",
        user_id="USER001",
        user_name="张三",
        phone="13800138000"
    )
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    shortage_no = result["data"]["shortage_no"]

    print("\n2. 重复提交（幂等性测试）...")
    result2 = ShortageService.identify_shortage(
        order_no="ORD20240501001",
        product_id="PRD001",
        product_name="新鲜草莓",
        shortage_quantity=2,
        shortage_amount=59.8,
        operator="zhangsan"
    )
    print(f"结果: {result2['message']}")
    print(f"是否幂等: {result2['is_idempotent']}")

    print("\n3. 确认缺货...")
    result3 = ShortageService.confirm_shortage(shortage_no, operator="zhangsan")
    print(f"结果: {json.dumps(result3, ensure_ascii=False, indent=2)}")

    print("\n4. 退款补偿...")
    result4 = ShortageService.compensate_shortage(
        shortage_no=shortage_no,
        compensation_type=CompensationType.REFUND,
        compensation_amount=59.8,
        operator="lisi"
    )
    print(f"结果: {json.dumps(result4, ensure_ascii=False, indent=2)}")
    compensation_no = result4["data"]["compensation_no"]

    print("\n5. 结算...")
    result5 = ShortageService.settle_shortage(shortage_no, operator="manager")
    print(f"结果: {json.dumps(result5, ensure_ascii=False, indent=2)}")

    print("\n" + "=" * 60)
    print("演示2: 回滚功能")
    print("=" * 60)

    print("\n1. 新识别并确认一个缺货...")
    result6 = ShortageService.identify_shortage(
        order_no="ORD20240501002",
        product_id="PRD002",
        product_name="新鲜牛奶",
        shortage_quantity=1,
        shortage_amount=25.0,
        operator="zhangsan"
    )
    shortage_no2 = result6["data"]["shortage_no"]
    ShortageService.confirm_shortage(shortage_no2, operator="zhangsan")

    print("\n2. 发放优惠券补偿...")
    result7 = ShortageService.compensate_shortage(
        shortage_no=shortage_no2,
        compensation_type=CompensationType.COUPON,
        compensation_amount=30.0,
        operator="lisi",
        coupon_id="COUPON001",
        coupon_name="新人专享券"
    )
    compensation_no2 = result7["data"]["compensation_no"]
    print(f"补偿成功: {compensation_no2}")

    print("\n3. 回滚补偿...")
    result8 = ShortageService.rollback_compensation(compensation_no2, operator="manager")
    print(f"结果: {json.dumps(result8, ensure_ascii=False, indent=2)}")

    print("\n" + "=" * 60)
    print("演示3: 批量操作")
    print("=" * 60)

    print("\n批量识别缺货...")
    batch_result = BatchOperationService.batch_identify(
        shortage_list=[
            {
                "order_no": "ORD20240501003",
                "product_id": "PRD003",
                "product_name":"新鲜苹果",
                "shortage_quantity": 3,
                "shortage_amount": 45.0
            },
            {
                "order_no": "ORD20240501004",
                "product_id": "PRD004",
                "product_name": "新鲜香蕉",
                "shortage_quantity": 5,
                "shortage_amount": 30.0
            },
            {
                "order_no": "ORD20240501003",
                "product_id": "PRD999",
                "product_name": "不存在的商品",
                "shortage_quantity": "错误的数量类型",
                "shortage_amount": 100.0
            }
        ],
        operator="zhangsan"
    )
    print(f"批量结果: {json.dumps(batch_result, ensure_ascii=False, indent=2)}")

    print("\n" + "=" * 60)
    print("演示4: 查询和导出")
    print("=" * 60)

    print("\n查询所有缺货记录...")
    query_result = QueryExportService.query_shortages(page=1, page_size=10)
    print(f"总数: {query_result['data']['total']}")
    for rec in query_result['data']['records']:
        print(f"  - {rec['shortage_no']}: {rec['product_name']} ({rec['status']})")

    print("\n导出CSV...")
    export_result = QueryExportService.export_shortages(file_format="csv")
    print(f"导出数量: {export_result['data']['total_count']}")
    print("CSV内容:")
    print(export_result['data']['content'])

    print("\n" + "=" * 60)
    print("演示5: 查询操作日志")
    print("=" * 60)

    print("\n查询操作日志...")
    log_result = QueryExportService.query_operation_logs(page=1, page_size=10)
    print(f"总操作次数: {log_result['data']['total']}")
    for log in log_result['data']['records']:
        print(f"  - {log['batch_no']}: {log['operation_type']} - {log['operation_status']} "
              f"(成功: {log['success_count']}, 失败: {log['failed_count']})")

    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)


if __name__ == "__main__":
    import os
    if not os.path.exists("shortage_system.db"):
        from init_db import init_database
        init_database()
    demo_basic_flow()
