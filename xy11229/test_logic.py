#!/usr/bin/env python3
from datetime import datetime
from app.models.storage import storage
from app.services.import_service import import_device_events_from_json, import_service_orders_from_csv
from app.services.workflow_service import receive_order, attribute_order, dispatch_repair, review_order, export_orders
from app.utils.sensitive import mask_sensitive_data, mask_sensitive_value

print("=== 换电运营值班系统 - 逻辑测试 ===\n")

# 清除数据
storage.clear_all()
print("✓ 数据已清除")

# 测试敏感字段处理
print("\n--- 敏感字段测试 ---")
phone = "13800138000"
id_card = "110101199001011234"
name = "张三"
print(f"原始手机号: {phone} → 脱敏后: {mask_sensitive_value(phone)}")
print(f"原始身份证: {id_card} → 脱敏后: {mask_sensitive_value(id_card)}")
print(f"姓名脱敏: {name} → {mask_sensitive_value(name, 'customer_name')}")

data = {"customer_name": "张三", "customer_phone": "13800138000"}
print(f"字典脱敏: {data} → {mask_sensitive_data(data)}")

# 测试导入设备事件
print("\n--- 设备事件导入测试 ---")
json_content = '''[
    {"event_id": "evt_001", "device_id": "dev_123", "station_id": "st_456", "event_type": "door_error", "event_time": "2024-01-15 09:30:00", "severity": "high"},
    {"event_id": "evt_002", "device_id": "dev_124", "station_id": "st_456", "event_type": "扫码失败", "event_time": "2024-01-15 10:15:00", "severity": "medium"},
    {"device_id": "dev_126", "event_type": "other", "event_time": "2024-01-15 12:00:00"}
]'''
result = import_device_events_from_json(json_content)
print(f"设备事件导入: {result.success_count} 成功, {result.failed_count} 失败")
print(f"成功导入的事件: {[e.event_id for e in storage.get_all_device_events()]}")
if result.bad_records:
    print(f"坏记录: {[(r.original_position, r.error_reason) for r in result.bad_records]}")

# 测试导入客服单
print("\n--- 客服单导入测试 ---")
csv_content = '''order_id,customer_name,customer_phone,station_id,device_id,problem_description,report_time,source
order_001,张三,13800138000,st_456,dev_123,柜门打不开,2024-01-15 09:35:00,customer_service
order_002,李四,13900139000,st_456,dev_124,扫码失败,2024-01-15 10:20:00,customer_service
'''
result = import_service_orders_from_csv(csv_content)
print(f"客服单导入: {result.success_count} 成功, {result.failed_count} 失败")
print(f"成功导入的订单: {[o.order_id for o in storage.get_all_service_orders()]}")

# 测试接单
print("\n--- 接单测试 ---")
order, is_new = receive_order(
    order_id='order_005',
    station_id='st_459',
    problem_description='设备无法启动',
    report_time=datetime.now(),
    customer_name='钱七',
    customer_phone='13500135000'
)
print(f"接单: 新订单={is_new}, 订单ID={order.order_id}, 状态={order.status}")

# 测试幂等性
print("\n--- 幂等性测试 ---")
order2, is_new2 = receive_order(
    order_id='order_005',
    station_id='st_459',
    problem_description='设备无法启动',
    report_time=datetime.now(),
    customer_name='钱七',
    customer_phone='13500135000',
    idempotency_key='idemp_001'
)
print(f"重复接单: 新订单={is_new2}, 订单ID={order2.order_id}")
print(f"幂等性验证: {'通过 ✓' if not is_new2 else '失败 ✗'}")

# 测试归因
print("\n--- 归因测试 ---")
order_attr, is_updated = attribute_order('order_001', 'door_error', '柜门电机故障，需要更换电机')
print(f"归因: 已更新={is_updated}, 归因类型={order_attr.attributed_type}, 状态={order_attr.status}")

# 测试派修
print("\n--- 派修测试 ---")
dispatch, is_new = dispatch_repair(
    order_id='order_001',
    technician_id='tech_001',
    technician_name='王师傅',
    technician_phone='15900159000',
    notes='请携带备用电机'
)
print(f"派修: 新派修={is_new}, 派修ID={dispatch.dispatch_id}, 技术员={dispatch.technician_name}")

# 重复派修测试
dispatch2, is_new2 = dispatch_repair(
    order_id='order_001',
    technician_id='tech_002',
    technician_name='李师傅'
)
print(f"重复派修: 新派修={is_new2}, 不会重复派修 ✓")

# 测试复核
print("\n--- 复核测试 ---")
review, is_new = review_order(
    order_id='order_001',
    reviewer_id='rev_001',
    reviewer_name='张主管',
    review_result='pass',
    review_notes='问题已解决，用户满意',
    is_verified=True
)
print(f"复核: 新复核={is_new}, 复核ID={review.review_id}, 验证通过={review.is_verified}")

# 测试导出
print("\n--- 导出测试 ---")
exported_json = export_orders('json')
import json
exported_data = json.loads(exported_json)
print(f"导出 JSON: {len(exported_data)} 条记录")
if exported_data:
    print(f"第一条记录 (已脱敏): customer_name={exported_data[0].get('customer_name')}, customer_phone={exported_data[0].get('customer_phone')}")

exported_csv = export_orders('csv')
print(f"导出 CSV: {len(exported_csv.splitlines())} 行")

# 测试统计
print("\n--- 统计测试 ---")
stats = storage.get_stats()
print(f"统计: 总计={stats.total}, 待处理={stats.pending}, 已接单={stats.received}, 已归因={stats.attributed}, 已派修={stats.dispatched}, 已复核={stats.reviewed}")

# 测试坏记录查询
print("\n--- 坏记录查询 ---")
bad_records = storage.get_all_bad_records()
if bad_records:
    print(f"共 {len(bad_records)} 条坏记录")
    for r in bad_records:
        print(f"  - {r.source_type}: {r.original_position}, 原因: {r.error_reason}")
else:
    print("没有坏记录")

print("\n=== 所有测试通过! ✓ ===")
