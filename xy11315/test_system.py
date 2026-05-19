#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from bus_scheduler.models import Role, RulingResult
from bus_scheduler.storage import IdempotentStore
from bus_scheduler.service import BusSchedulerService


def test_full_workflow():
    print("=" * 60)
    print("测试完整工作流")
    print("=" * 60)
    
    store = IdempotentStore()
    service = BusSchedulerService(store)
    
    print("\n1. 测试接收家长申诉...")
    success1, appeal_id1 = service.receive_appeal(
        parent_id="P001",
        parent_name="张三爸爸",
        student_name="张三",
        bus_id="BUS001",
        route_id="R001",
        stop_name="阳光小区站",
        scheduled_time=datetime(2026, 5, 19, 8, 0, 0),
        actual_arrival_time=datetime(2026, 5, 19, 8, 15, 0),
        appeal_time=datetime(2026, 5, 19, 8, 20, 0),
        description="校车今天迟到了15分钟",
        operator="调度员001",
        operator_role=Role.DISPATCHER
    )
    
    success2, appeal_id2 = service.receive_appeal(
        parent_id="P002",
        parent_name="李四妈妈",
        student_name="李四",
        bus_id="BUS001",
        route_id="R001",
        stop_name="幸福花园站",
        scheduled_time=datetime(2026, 5, 19, 8, 10, 0),
        actual_arrival_time=datetime(2026, 5, 19, 8, 25, 0),
        appeal_time=datetime(2026, 5, 19, 8, 30, 0),
        description="校车今天也迟到了",
        operator="调度员001",
        operator_role=Role.DISPATCHER
    )
    status1 = f"成功 - ID={appeal_id1}" if success1 else f"失败 - {appeal_id1}"
    status2 = f"成功 - ID={appeal_id2}" if success2 else f"失败 - {appeal_id2}"
    print(f"   申诉1: {status1}")
    print(f"   申诉2: {status2}")
    
    print("\n2. 测试幂等性 - 重复提交申诉...")
    success_idem, message = service.receive_appeal(
        parent_id="P001",
        parent_name="张三爸爸",
        student_name="张三",
        bus_id="BUS001",
        route_id="R001",
        stop_name="阳光小区站",
        scheduled_time=datetime(2026, 5, 19, 8, 0, 0),
        actual_arrival_time=datetime(2026, 5, 19, 8, 15, 0),
        appeal_time=datetime(2026, 5, 19, 8, 20, 0),
        description="校车今天迟到了15分钟",
        operator="调度员001",
        operator_role=Role.DISPATCHER
    )
    print(f"   重复提交: {'被正确拦截' if not success_idem else '错误 - 未拦截重复提交'}")
    
    print("\n3. 测试接收GPS轨迹...")
    gps_points = [
        {"timestamp": datetime(2026, 5, 19, 7, 30, 0), "latitude": 31.2304, "longitude": 121.4737, "accuracy": 5.0},
        {"timestamp": datetime(2026, 5, 19, 7, 45, 0), "latitude": 31.2310, "longitude": 121.4740, "accuracy": 5.0},
        {"timestamp": datetime(2026, 5, 19, 8, 0, 0), "latitude": 31.2315, "longitude": 121.4745, "accuracy": 5.0},
        {"timestamp": datetime(2026, 5, 19, 8, 20, 0), "latitude": 31.2320, "longitude": 121.4750, "accuracy": 5.0},
    ]
    success_gps, gps_id = service.receive_gps_track(
        bus_id="BUS001",
        route_id="R001",
        date="2026-05-19",
        points=gps_points,
        operator="系统",
        operator_role=Role.DISPATCHER
    )
    status_gps = f"成功 - ID={gps_id}" if success_gps else f"失败 - {gps_id}"
    print(f"   GPS轨迹: {status_gps}")
    
    print("\n4. 测试接收司机打卡...")
    success_checkin, checkin_id = service.receive_driver_checkin(
        driver_id="D001",
        driver_name="李司机",
        bus_id="BUS001",
        route_id="R001",
        checkin_time=datetime(2026, 5, 19, 7, 0, 0),
        location="停车场",
        operator="李司机",
        operator_role=Role.DRIVER
    )
    status_checkin = f"成功 - ID={checkin_id}" if success_checkin else f"失败 - {checkin_id}"
    print(f"   司机打卡: {status_checkin}")
    
    print("\n5. 测试批量匹配申诉...")
    match_result = service.match_all_pending_appeals(
        operator="调度员001",
        operator_role=Role.DISPATCHER
    )
    print(f"   匹配结果: 总数={match_result.total_count}, 成功={match_result.success_count}, 失败={match_result.failure_count}")
    
    print("\n6. 测试批量裁定案例...")
    rule_result = service.rule_all_matched_cases(
        operator="调度员001",
        operator_role=Role.DISPATCHER
    )
    print(f"   裁定结果: 总数={rule_result.total_count}, 成功={rule_result.success_count}, 失败={rule_result.failure_count}")
    
    print("\n7. 测试查看裁定原因...")
    cases = store.get_all_matched_cases()
    for case in cases[:1]:
        details = service.get_case_details(case.case_id)
        if details and details.get('rulings'):
            for ruling in details['rulings']:
                print(f"   案例 {case.case_id}:")
                print(f"     裁定结果: {ruling.result.value}")
                print(f"     裁定原因: {ruling.reason}")
    
    print("\n8. 测试复核裁定...")
    if cases:
        case = cases[0]
        success_review, review_id = service.review_ruling(
            case_id=case.case_id,
            uphold=True,
            reason="经核查，裁定准确无误",
            operator="管理员001",
            operator_role=Role.ADMIN
        )
        status_review = f"成功 - ID={review_id}" if success_review else f"失败 - {review_id}"
        print(f"   复核: {status_review}")
    
    print("\n9. 测试重复申诉合并检测...")
    groups = service.merge_duplicate_appeals()
    print(f"   申诉分组数: {len(groups)}")
    
    print("\n10. 测试审计日志...")
    logs = store.get_audit_logs()
    print(f"   审计日志总数: {len(logs)}")
    for log in logs[:3]:
        print(f"     [{log.timestamp.strftime('%H:%M:%S')}] {log.entity_type}:{log.entity_id} - {log.action} by {log.operator}")
    
    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    test_full_workflow()
