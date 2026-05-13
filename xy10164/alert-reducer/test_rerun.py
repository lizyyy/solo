#!/usr/bin/env python3
"""测试重跑校验功能"""

import sys
sys.path.insert(0, '/Users/mac/pro/solo/workspaces/xy10164/alert-reducer')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from alert_reducer.models import (
    Base, Alert, MergedAlert, ProcessBatch, 
    SuppressedAlert, EscalatedAlert
)
from datetime import datetime

# 创建数据库连接
engine = create_engine('sqlite:///alerts.db')
Session = sessionmaker(bind=engine)
session = Session()

print("=" * 80)
print("测试重跑校验功能")
print("=" * 80)

print("\n1. 批次1信息:")
print("-" * 80)
batch = session.query(ProcessBatch).filter(ProcessBatch.id == 1).first()
if batch:
    print(f"  批次ID: {batch.id}")
    print(f"  批次UUID: {batch.batch_uuid[:8]}...")
    print(f"  状态: {batch.status}")
    print(f"  批次执行时间:")
    print(f"    start_time: {batch.start_time}")
    print(f"    end_time: {batch.end_time}")
    print(f"  告警时间范围:")
    print(f"    alerts_start_time: {batch.alerts_start_time}")
    print(f"    alerts_end_time: {batch.alerts_end_time}")
    print(f"  统计:")
    print(f"    total_alerts: {batch.total_alerts}")
    print(f"    suppressed_alerts: {batch.suppressed_alerts}")
    print(f"    merged_alerts: {batch.merged_alerts}")
    print(f"    escalated_alerts: {batch.escalated_alerts}")

print("\n2. 原始告警的batch_id回写情况:")
print("-" * 80)
alerts = session.query(Alert).order_by(Alert.id).all()
alerts_with_batch_id = [a for a in alerts if a.batch_id == 1]
alerts_without_batch_id = [a for a in alerts if a.batch_id != 1 and a.status != 'pending']

print(f"  总告警数: {len(alerts)}")
print(f"  已设置batch_id=1的告警数: {len(alerts_with_batch_id)}")
print(f"  被处理的告警数（状态非pending）: {len([a for a in alerts if a.status != 'pending'])}")

if len(alerts_with_batch_id) == len([a for a in alerts if a.status != 'pending']):
    print(f"  ✅ 所有被处理的告警都已正确设置batch_id")
else:
    print(f"  ❌ 部分被处理的告警未设置batch_id")

print("\n3. 处理记录数量:")
print("-" * 80)
suppressed_count = session.query(SuppressedAlert).filter(
    SuppressedAlert.batch_id == 1
).count()
merged_count = session.query(MergedAlert).filter(
    MergedAlert.batch_id == 1
).count()
escalated_count = session.query(EscalatedAlert).filter(
    EscalatedAlert.batch_id == 1
).count()

print(f"  抑制记录数: {suppressed_count}")
print(f"  合并记录数: {merged_count}")
print(f"  升级记录数: {escalated_count}")

session.close()

print("\n" + "=" * 80)
print("下一步: 请运行以下命令测试重跑功能")
print("=" * 80)
print("\n1. 先查看当前批次列表:")
print("   python3 -m alert_reducer batches")
print("\n2. 按批次重跑（批次ID=1）:")
print("   python3 -m alert_reducer rerun --batch-id 1")
print("\n3. 验证重跑结果:")
print("   python3 -m alert_reducer report --start \"2026-05-09 00:00:00\" --end \"2026-05-09 23:59:59\" --format json")
