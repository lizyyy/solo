#!/usr/bin/env python3
"""
演示环境初始化脚本
此脚本会创建一些样例数据，用于演示各种场景
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from park_visitor_system.services import DataStore, ParkService


def setup_demo_data():
    store = DataStore("./data")
    service = ParkService(store)
    
    today = datetime.now().date()
    
    service.create_reservation(
        visitor_name="张三",
        visitor_id="110101199001011234",
        visitor_phone="13800138001",
        visitor_company="科技有限公司",
        plate_number="京A12345",
        arrival_time=datetime.combine(today, datetime.min.time().replace(hour=9)),
        departure_time=datetime.combine(today, datetime.min.time().replace(hour=18)),
        access_area="全园区",
        approved=True
    )
    
    service.create_reservation(
        visitor_name="李四",
        visitor_id="110101199002022345",
        visitor_phone="13800138002",
        visitor_company="贸易有限公司",
        plate_number="京B67890",
        arrival_time=datetime.combine(today, datetime.min.time().replace(hour=10)),
        departure_time=datetime.combine(today, datetime.min.time().replace(hour=17)),
        access_area="A栋",
        approved=True
    )
    
    service.create_reservation(
        visitor_name="王五",
        visitor_id="110101199003033456",
        visitor_phone="13800138003",
        visitor_company="咨询有限公司",
        plate_number="京C11111",
        arrival_time=datetime.combine(today, datetime.min.time().replace(hour=14)),
        departure_time=datetime.combine(today, datetime.min.time().replace(hour=16)),
        access_area="全园区",
        approved=True
    )
    
    service.create_reservation(
        visitor_name="赵六",
        visitor_id="110101199004044567",
        visitor_phone="13800138004",
        visitor_company="网络科技公司",
        plate_number="京D22222",
        arrival_time=datetime.combine(today, datetime.min.time().replace(hour=9)),
        departure_time=datetime.combine(today, datetime.min.time().replace(hour=12)),
        access_area="全园区",
        approved=True
    )
    
    service.add_to_blacklist(
        plate_number="京Z99999",
        reason="上次来访时损坏园区设施，被禁止进入",
        added_by="安保主管-刘队长"
    )
    
    print("=" * 60)
    print("演示环境初始化完成！")
    print("=" * 60)
    print("\n已创建以下访客预约：")
    print("  1. 张三 - 京A12345 - 09:00~18:00 - 全园区")
    print("  2. 李四 - 京B67890 - 10:00~17:00 - A栋")
    print("  3. 王五 - 京C11111 - 14:00~16:00 - 全园区")
    print("  4. 赵六 - 京D22222 - 09:00~12:00 - 全园区")
    print("\n已添加黑名单：")
    print("  京Z99999 - 上次来访时损坏园区设施")
    print("\n提示：")
    print("  1. 张三（京A12345）可以演示正常预约入场")
    print("  2. 李四（京B67890）可以演示临时换车审批流程")
    print("  3. 王五（京C11111）可以演示超时离场")
    print("  4. 京Z99999 可以演示黑名单拦截")
    print("  5. 可以测试重复入场、出场早于入场等异常场景")
    print("=" * 60)


if __name__ == "__main__":
    setup_demo_data()
