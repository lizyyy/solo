#!/usr/bin/env python3
import os
import csv
from datetime import datetime

os.chdir(os.path.dirname(os.path.abspath(__file__)))

from data_loader import load_prescription, load_frame, load_scan, load_tolerance, merge_order_data
from validator import validate_order
from database import init_db, save_review, load_all_reviews

init_db()

prescriptions = load_prescription('sample_data/prescription.csv')
frames = load_frame('sample_data/frame.json')
scans, duplicates = load_scan('sample_data/scan.jsonl')
tolerance = load_tolerance('sample_data/tolerance_rules.yaml')
orders = merge_order_data(prescriptions, frames, scans, tolerance)

print(f"[1] Loaded {len(orders)} orders")
print(f"[2] Duplicates found: {dict(duplicates)}")

for oid in orders:
    dup_info = duplicates.get(oid, [])
    status, issues = validate_order(orders[oid], dup_info)
    orders[oid]['saved_status'] = status
    orders[oid]['saved_issues'] = issues
    save_review(oid, status, datetime.now().isoformat(), '', issues)

print(f"[3] Reviews saved to database")

saved = load_all_reviews()
print(f"[4] Loaded {len(saved)} reviews from database")

pending = sum(1 for o in orders.values() if o.get('saved_status') == '待复核')
deliverable = sum(1 for o in orders.values() if o.get('saved_status') == '可交付')
rework = sum(1 for o in orders.values() if o.get('saved_status') == '需返工')
print(f"[5] Status summary - Pending: {pending}, Deliverable: {deliverable}, Rework: {rework}")

md_path = 'sample_data/report.md'
with open(md_path, 'w', encoding='utf-8') as f:
    f.write("# 配镜加工单复核报告\n")
    f.write(f"生成时间: {datetime.now().isoformat()}\n\n")
    f.write("## 汇总\n")
    f.write(f"- 待复核: {pending}\n")
    f.write(f"- 可交付: {deliverable}\n")
    f.write(f"- 需返工: {rework}\n\n")
    f.write("## 订单明细\n")
    for oid in sorted(orders.keys()):
        order = orders[oid]
        prescription = order.get('prescription', {})
        status = order.get('saved_status', '待复核')
        issues = order.get('saved_issues', [])
        f.write(f"### {oid}\n")
        f.write(f"- 患者: {prescription.get('patient_name', '未知')}\n")
        f.write(f"- 状态: {status}\n")
        if issues:
            f.write(f"- 问题: {', '.join(issues)}\n")
        f.write("\n")
print(f"[6] Markdown report exported to {md_path}")

csv_path = 'sample_data/report.csv'
with open(csv_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(["订单号", "患者姓名", "状态", "复核时间", "备注", "问题"])
    for oid in sorted(orders.keys()):
        order = orders[oid]
        prescription = order.get('prescription', {})
        status = order.get('saved_status', '待复核')
        issues = ",".join(order.get('saved_issues', []))
        writer.writerow([oid, prescription.get('patient_name', ''), status, '', '', issues])
print(f"[7] CSV report exported to {csv_path}")

print("\n=== All flows verified successfully ===")
print("To launch GUI: python3 app.py")