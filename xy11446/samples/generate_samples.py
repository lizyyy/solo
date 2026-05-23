#!/usr/bin/env python3
import pandas as pd
from datetime import datetime, timedelta
import os

os.makedirs("samples", exist_ok=True)

def generate_pile_alarms():
    data = [
        {"pile_id": "P001", "alarm_time": "2024-05-20 08:30:00", "alarm_code": "E001", "alarm_name": "过流保护", "duration_minutes": 45, "area": "片区A"},
        {"pile_id": "P002", "alarm_time": "2024-05-20 09:15:00", "alarm_code": "E002", "alarm_name": "过压保护", "duration_minutes": 30, "area": "片区A"},
        {"pile_id": "", "alarm_time": "2024-05-20 10:00:00", "alarm_code": "E003", "alarm_name": "漏电告警", "duration_minutes": 60, "area": "片区B"},
        {"pile_id": "P004", "alarm_time": "", "alarm_code": "E001", "alarm_name": "过流保护", "duration_minutes": 15, "area": "片区B"},
        {"pile_id": "P005", "alarm_time": "2024-05-20 11:30:00", "alarm_code": "", "alarm_name": "通讯异常", "duration_minutes": -10, "area": "片区C"},
        {"pile_id": "P006", "alarm_time": "2024-05-20 14:00:00", "alarm_code": "E004", "alarm_name": "高温告警", "duration_minutes": "invalid", "area": "片区C"},
    ]
    df = pd.DataFrame(data)
    df.to_excel("samples/pile_alarms.xlsx", index=False)
    print("已生成: samples/pile_alarms.xlsx")

def generate_inspections():
    data = [
        {"pile_id": "P001", "inspection_date": "2024-05-19", "inspector": "张三", "status": "正常", "remark": "设备运行良好"},
        {"pile_id": "P002", "inspection_date": "2024-05-19", "inspector": "李四", "status": "需维修", "remark": "显示屏故障"},
        {"pile_id": "", "inspection_date": "2024-05-19", "inspector": "王五", "status": "正常", "remark": ""},
        {"pile_id": "P004", "inspection_date": "", "inspector": "赵六" * 10, "status": "正常", "remark": ""},
    ]
    df = pd.DataFrame(data)
    df.to_excel("samples/inspections.xlsx", index=False)
    print("已生成: samples/inspections.xlsx")

def generate_complaints():
    data = [
        {"complaint_no": "C202405001", "customer_name": "王客户", "customer_phone": "13800138001", "complaint_time": "2024-05-20 10:00:00", "content": "充电枪无法拔出", "pile_id": "P001"},
        {"complaint_no": "C202405002", "customer_name": "李客户", "customer_phone": "", "complaint_time": "2024-05-20 11:00:00", "content": "充电速度慢", "pile_id": "P002"},
        {"complaint_no": "", "customer_name": "张客户", "customer_phone": "13900139002", "complaint_time": "2024-05-20 12:00:00", "content": "APP无法连接", "pile_id": "P003"},
    ]
    df = pd.DataFrame(data)
    df.to_excel("samples/complaints.xlsx", index=False)
    print("已生成: samples/complaints.xlsx")

def generate_supplier_bills():
    data = [
        {"bill_no": "B202405001", "supplier_name": "供应商A", "amount": 15000.50, "bill_date": "2024-05-15", "status": "待支付"},
        {"bill_no": "B202405002", "supplier_name": "供应商B", "amount": "not_a_number", "bill_date": "2024-05-16", "status": "待支付"},
        {"bill_no": "", "supplier_name": "供应商C", "amount": 8500.00, "bill_date": "2024-05-17", "status": "已支付"},
    ]
    df = pd.DataFrame(data)
    df.to_excel("samples/supplier_bills.xlsx", index=False)
    print("已生成: samples/supplier_bills.xlsx")

def generate_offline_work_orders():
    data = [
        {"order_no": "W202405001", "pile_id": "P001", "alarm_time": "2024-05-20 08:30:00", "recover_time": "2024-05-20 09:15:00", "status": "completed", "operator": "运维A"},
        {"order_no": "W202405002", "pile_id": "P002", "alarm_time": "2024-05-20 09:00:00", "recover_time": "2024-05-20 08:00:00", "status": "processing", "operator": "运维B"},
        {"order_no": "", "pile_id": "P003", "alarm_time": "2024-05-20 10:00:00", "recover_time": "", "status": "unknown_status", "operator": "运维C"},
    ]
    df = pd.DataFrame(data)
    df.to_excel("samples/offline_work_orders.xlsx", index=False)
    print("已生成: samples/offline_work_orders.xlsx")

def generate_approval_emails():
    data = [
        {"email_id": "EM001", "subject": "关于P001故障维修审批", "sender": "运维主管", "send_time": "2024-05-20 09:00:00", "related_batch_no": "", "content": "同意维修方案"},
        {"email_id": "", "subject": "关于片区设备更新审批", "sender": "片区经理", "send_time": "2024-05-20 10:00:00", "related_batch_no": "BATCH-001", "content": "同意更新"},
    ]
    df = pd.DataFrame(data)
    df.to_excel("samples/approval_emails.xlsx", index=False)
    print("已生成: samples/approval_emails.xlsx")

if __name__ == "__main__":
    generate_pile_alarms()
    generate_inspections()
    generate_complaints()
    generate_supplier_bills()
    generate_offline_work_orders()
    generate_approval_emails()
    print("\n所有样例数据已生成完成！")
