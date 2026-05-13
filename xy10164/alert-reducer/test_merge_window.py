#!/usr/bin/env python3
"""测试合并窗口逻辑"""

import sys
sys.path.insert(0, '/Users/mac/pro/solo/workspaces/xy10164/alert-reducer')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from alert_reducer.models import Base, Alert, MergedAlert, EscalatedAlert
from datetime import datetime

# 创建数据库连接
engine = create_engine('sqlite:///alerts.db')
Session = sessionmaker(bind=engine)
session = Session()

print("=" * 80)
print("测试合并窗口逻辑")
print("=" * 80)

print("\n1. 所有原始告警:")
print("-" * 80)
alerts = session.query(Alert).order_by(Alert.starts_at).all()
for alert in alerts:
    print(f"  ID: {alert.id}")
    print(f"    名称: {alert.alertname}")
    print(f"    优先级: {alert.severity}")
    print(f"    开始时间: {alert.starts_at}")
    print(f"    状态: {alert.status}")
    print(f"    合并告警ID: {alert.merged_alert_id}")
    print()

print("\n2. 合并告警:")
print("-" * 80)
merged_alerts = session.query(MergedAlert).order_by(MergedAlert.starts_at).all()
for merged in merged_alerts:
    print(f"  ID: {merged.id}")
    print(f"    名称: {merged.alertname}")
    print(f"    优先级: {merged.severity}")
    print(f"    开始时间: {merged.starts_at}")
    print(f"    结束时间: {merged.ends_at}")
    print(f"    告警数量: {merged.alert_count}")
    print(f"    状态: {merged.status}")
    print(f"    合并键: {merged.merge_key[:8]}...")
    print()

print("\n3. 升级告警:")
print("-" * 80)
escalated_alerts = session.query(EscalatedAlert).order_by(EscalatedAlert.created_at).all()
for escalated in escalated_alerts:
    print(f"  ID: {escalated.id}")
    print(f"    合并告警ID: {escalated.merged_alert_id}")
    print(f"    原始告警ID: {escalated.alert_id}")
    print(f"    升级级别: {escalated.escalation_level}")
    print(f"    创建时间: {escalated.created_at}")
    print()

print("\n" + "=" * 80)
print("验证结果:")
print("=" * 80)

# 验证
total_merged_count = len(merged_alerts)
print(f"合并告警数量: {total_merged_count} (期望值: 2")

if total_merged_count == 2:
    print("✅ 合并告警数量正确")
    
    # 检查每个合并告警的告警数量
    for i, merged in enumerate(merged_alerts):
        print(f"\n合并告警 {i+1}:")
        print(f"  告警数量: {merged.alert_count} (期望值: 2)")
        if merged.alert_count == 2:
            print(f"  ✅ 告警数量正确")
        else:
            print(f"  ❌ 告警数量错误")
    
    # 检查时间间隔
    if len(merged_alerts) >= 2:
        time_diff = (merged_alerts[1].starts_at - merged_alerts[0].starts_at).total_seconds() / 60
        print(f"\n两个合并告警的时间间隔: {time_diff} 分钟")
        if time_diff >= 45:  # 应该大于15分钟
            print("✅ 时间间隔大于15分钟，正确分成了两个窗口")
        else:
            print("❌ 时间间隔小于15分钟，可能存在问题")
else:
    print("❌ 合并告警数量错误")

session.close()
