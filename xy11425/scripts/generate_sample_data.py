#!/usr/bin/env python3
import os
import sys
import pandas as pd
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def generate_visitor_appointment(output_path):
    data = []
    base_date = datetime.now() - timedelta(days=5)
    
    visitors = [
        ("张三", "13800138001", "110101199001011234", "京A12345"),
        ("李四", "13800138002", "110101199002022345", "京B67890"),
        ("王五", "13800138003", "110101199003033456", "京C11111"),
        ("赵六", "13800138004", "110101199004044567", "京D22222"),
        ("钱七", "13800138005", "110101199005055678", "京E33333"),
        ("孙八", "13800138006", "110101199006066789", "京F44444"),
        ("周九", "13800138007", "110101199007077890", "京G55555"),
        ("吴十", "13800138008", "110101199008088901", "京H66666"),
    ]
    
    for i, (name, phone, id_card, plate) in enumerate(visitors):
        visit_date = base_date + timedelta(days=i // 2)
        data.append({
            "访客姓名": name,
            "联系电话": phone,
            "身份证号": id_card,
            "车牌号": plate,
            "访问日期": visit_date.strftime("%Y-%m-%d"),
            "预计离开日期": (visit_date + timedelta(days=1)).strftime("%Y-%m-%d"),
        })
    
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False)
    print(f"Generated: {output_path}")


def generate_gate_record(output_path):
    data = []
    base_date = datetime.now() - timedelta(days=5)
    
    records = [
        ("张三", "京A12345", 9, 18),
        ("李四", "京B67890", 10, 20),
        ("王五", "京C11111", 8, 25),
        ("赵六", "京D22222", 11, 14),
        ("钱七", "京E33333", 7, 30),
        ("孙八", "京F44444", 12, 15),
        ("周九", "京G55555", 9, 48),
        ("吴十", "京H66666", 10, 12),
    ]
    
    for i, (name, plate, in_hour, duration_hours) in enumerate(records):
        visit_date = base_date + timedelta(days=i // 2)
        gate_in = visit_date + timedelta(hours=in_hour)
        gate_out = gate_in + timedelta(hours=duration_hours)
        
        data.append({
            "访客姓名": name,
            "车牌号": plate,
            "入场时间": gate_in.strftime("%Y-%m-%d %H:%M:%S"),
            "出场时间": gate_out.strftime("%Y-%m-%d %H:%M:%S"),
        })
    
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False)
    print(f"Generated: {output_path}")


def generate_price_adjustment(output_path):
    data = [
        {
            "访客姓名": "王五",
            "车牌号": "京C11111",
            "调整金额": -50,
            "调整原因": "系统误判超时，实际已报备",
        },
        {
            "访客姓名": "钱七",
            "车牌号": "京E33333",
            "调整金额": -100,
            "调整原因": "VIP客户特殊权限",
        },
        {
            "访客姓名": "周九",
            "车牌号": "京G55555",
            "调整金额": -80,
            "调整原因": "跨天报备，已核实情况",
        },
    ]
    
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False)
    print(f"Generated: {output_path}")


def main():
    sample_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample")
    os.makedirs(sample_dir, exist_ok=True)
    
    generate_visitor_appointment(os.path.join(sample_dir, "visitor_appointment.xlsx"))
    generate_gate_record(os.path.join(sample_dir, "gate_record.xlsx"))
    generate_price_adjustment(os.path.join(sample_dir, "manual_price_adjustment.xlsx"))
    
    print("\nSample data generated successfully!")
    print(f"Sample directory: {sample_dir}")


if __name__ == "__main__":
    main()
