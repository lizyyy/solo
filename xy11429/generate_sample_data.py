#!/usr/bin/env python3
"""
生成样例数据脚本
创建访客预约表、闸机记录、临时车牌截图的Excel样例数据
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from datetime import datetime, timedelta
import random


def generate_visitor_appointments():
    """生成访客预约样例数据"""
    print("生成访客预约表...")

    data = []
    base_date = datetime(2024, 1, 15)

    visitors = [
        ("张三", "13800138001", "110101199001011234", "商务洽谈", "李经理", "市场部", "京A12345"),
        ("李四", "13800138002", "110101199002022345", "设备维修", "王主管", "运维部", "京B67890"),
        ("王五", "13800138003", "110101199003033456", "面试", "赵HR", "人事部", "京C11111"),
        ("赵六", "13800138004", "110101199004044567", "送货", "孙仓库", "物流部", "京D22222"),
        ("钱七", "13800138005", "110101199005055678", "参观", "周总", "总经办", "京E33333"),
        ("吴八", "13800138006", "110101199006066789", "施工", "郑工", "工程部", "京F44444"),
        ("", "13800138007", "", "客户拜访", "陈总监", "销售部", ""),
        ("郑九", "13800138008", "110101199008088901", "技术交流", "林工", "研发部", "京H66666"),
    ]

    for i, (name, phone, id_card, purpose, visited, dept, plate) in enumerate(visitors):
        start_time = base_date + timedelta(days=i, hours=9)
        end_time = base_date + timedelta(days=i, hours=17)
        grant_time = start_time - timedelta(hours=1)

        if i == 1:
            end_time = base_date + timedelta(days=i + 1, hours=12)
        elif i == 3:
            grant_time = None

        data.append({
            "访客姓名": name,
            "联系电话": phone,
            "身份证号": id_card,
            "来访事由": purpose,
            "被访人": visited,
            "被访部门": dept,
            "临时车牌": plate,
            "预约开始时间": start_time,
            "预约结束时间": end_time,
            "权限开通时间": grant_time,
            "权限收回时间": end_time + timedelta(hours=1) if grant_time else None,
        })

    df = pd.DataFrame(data)
    df.to_excel("sample_visitor_appointments.xlsx", index=False)
    print("  已生成 sample_visitor_appointments.xlsx")


def generate_gate_records():
    """生成闸机记录样例数据"""
    print("生成闸机记录表...")

    data = []
    base_date = datetime(2024, 1, 15)

    records = [
        ("张三", "京A12345", 9, 0, 17, 30),
        ("李四", "京B67890", 8, 30, 18, 0),
        ("王五", "京C11111", 10, 0, 15, 0),
        ("赵六", "京D22222", 9, 30, 16, 30),
        ("钱七", "京E33333", 14, 0, 17, 0),
        ("张三", "京A12345", 9, 15, 18, 0),
        ("郑九", "京H66666", 10, 30, 15, 30),
    ]

    for i, (name, plate, entry_h, entry_m, exit_h, exit_m) in enumerate(records):
        day_offset = i // 3
        data.append({
            "访客姓名": name,
            "车牌号": plate,
            "进入时间": base_date + timedelta(days=day_offset, hours=entry_h, minutes=entry_m),
            "离开时间": base_date + timedelta(days=day_offset, hours=exit_h, minutes=exit_m),
        })

    df = pd.DataFrame(data)
    df.to_excel("sample_gate_records.xlsx", index=False)
    print("  已生成 sample_gate_records.xlsx")


def generate_temp_plates():
    """生成临时车牌截图样例数据"""
    print("生成临时车牌数据表...")

    data = []
    base_date = datetime(2024, 1, 15)

    plates = [
        ("京A12345", "张三", 8, 18),
        ("京B67890", "李四", 8, 20),
        ("京C11111", "王五", 9, 17),
        ("京D22222", "赵六", 9, 16),
        ("京E33333", "钱七", 14, 17),
        ("京G55555", "冯十", 0, 0),
        ("京H66666", "郑九", 10, 15),
    ]

    for i, (plate, owner, start_h, end_h) in enumerate(plates):
        if i == 1:
            start = base_date + timedelta(days=i, hours=start_h)
            end = base_date + timedelta(days=i + 2, hours=end_h)
        elif i == 5:
            start = base_date + timedelta(days=i, hours=9)
            end = None
        else:
            start = base_date + timedelta(days=i, hours=start_h)
            end = base_date + timedelta(days=i, hours=end_h)

        data.append({
            "临时车牌": plate,
            "车主姓名": owner,
            "生效时间": start,
            "失效时间": end,
        })

    df = pd.DataFrame(data)
    df.to_excel("sample_temp_plates.xlsx", index=False)
    print("  已生成 sample_temp_plates.xlsx")


def main():
    print("=" * 50)
    print("生成样例数据")
    print("=" * 50)
    print()

    generate_visitor_appointments()
    generate_gate_records()
    generate_temp_plates()

    print()
    print("=" * 50)
    print("样例数据生成完成！")
    print("=" * 50)


if __name__ == "__main__":
    main()
