#!/usr/bin/env python3
"""验证报告生成和追踪功能的修复"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    print("=" * 60)
    print("  报告生成和追踪修复验证")
    print("=" * 60)
    
    print("\n1. 验证模块导入...")
    from app import models, schemas, reconciliation, report_generator
    from app.database import Base
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker, Session
    print("   ✓ 所有模块导入成功")
    
    print("\n2. 验证数据模型和数据库...")
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = SessionLocal()
    print("   ✓ 数据模型创建成功")
    
    print("\n3. 测试报告生成器按batch_id精确筛选...")
    batch_b1 = models.ReconciliationBatch(
        batch_id="B1",
        name="批次B1",
        description="测试批次1"
    )
    batch_b10 = models.ReconciliationBatch(
        batch_id="B10",
        name="批次B10",
        description="测试批次10"
    )
    db.add(batch_b1)
    db.add(batch_b10)
    db.commit()
    
    alarm_b1 = models.Alarm(
        alarm_id="ALM001",
        pole_id="P001",
        light_id="L001",
        alarm_type="灯具故障",
        alarm_level="高",
        alarm_time="2024-01-15 08:30:00",
        description="路灯不亮",
        status="已修复"
    )
    alarm_b10 = models.Alarm(
        alarm_id="ALM002",
        pole_id="P002",
        light_id="L001",
        alarm_type="电源故障",
        alarm_level="高",
        alarm_time="2024-01-15 09:15:00",
        description="电源跳闸",
        status="已修复"
    )
    db.add(alarm_b1)
    db.add(alarm_b10)
    db.commit()
    
    record_b1 = models.ReconciliationRecord(
        reconciliation_id="B1||P001||L001",
        batch_id="B1",
        pole_id="P001",
        light_id="L001",
        status=models.ReconciliationStatus.MATCHED,
        review_status=models.ReviewStatus.PENDING,
        alarm_id=alarm_b1.id
    )
    record_b10 = models.ReconciliationRecord(
        reconciliation_id="B10||P002||L001",
        batch_id="B10",
        pole_id="P002",
        light_id="L001",
        status=models.ReconciliationStatus.MATCHED,
        review_status=models.ReviewStatus.PENDING,
        alarm_id=alarm_b10.id
    )
    db.add(record_b1)
    db.add(record_b10)
    db.commit()
    
    summary_b1 = report_generator.generate_report_summary(db, "B1")
    summary_b10 = report_generator.generate_report_summary(db, "B10")
    
    print(f"   ✓ 批次B1报告记录数: {summary_b1.total_records} (预期: 1)")
    print(f"   ✓ 批次B10报告记录数: {summary_b10.total_records} (预期: 1)")
    
    if summary_b1.total_records == 1 and summary_b10.total_records == 1:
        print("   ✓ 报告生成器按batch_id精确筛选，不会串批次!")
    else:
        print("   ✗ 报告生成器仍存在串批次问题!")
        sys.exit(1)
    
    print("\n4. 测试追踪函数返回batch_id字段...")
    trace_result = reconciliation.trace_by_alarm(db, "ALM001")
    
    if trace_result:
        print(f"   ✓ 追踪函数返回结果存在")
        print(f"   ✓ 返回结果包含batch_id: {trace_result.batch_id}")
        if trace_result.batch_id == "B1":
            print("   ✓ TraceDetail的batch_id字段正确!")
        else:
            print(f"   ✗ batch_id字段值不正确: {trace_result.batch_id}")
            sys.exit(1)
    else:
        print("   ✗ 追踪函数未返回结果!")
        sys.exit(1)
    
    print("\n5. 验证带下划线批次的报告生成...")
    batch_underscore = models.ReconciliationBatch(
        batch_id="BATCH_2024_01",
        name="带下划线的批次",
        description="测试带下划线的批次ID"
    )
    db.add(batch_underscore)
    db.commit()
    
    alarm_under = models.Alarm(
        alarm_id="ALM003",
        pole_id="P003",
        light_id="L001",
        alarm_type="灯泡故障",
        alarm_level="中",
        alarm_time="2024-01-16 10:00:00",
        description="灯泡烧坏",
        status="待修复"
    )
    db.add(alarm_under)
    db.commit()
    
    record_under = models.ReconciliationRecord(
        reconciliation_id="BATCH_2024_01||P003||L001",
        batch_id="BATCH_2024_01",
        pole_id="P003",
        light_id="L001",
        status=models.ReconciliationStatus.DISCREPANCY,
        review_status=models.ReviewStatus.PENDING,
        alarm_id=alarm_under.id
    )
    db.add(record_under)
    db.commit()
    
    summary_under = report_generator.generate_report_summary(db, "BATCH_2024_01")
    print(f"   ✓ 带下划线批次报告记录数: {summary_under.total_records} (预期: 1)")
    
    if summary_under.total_records == 1:
        print("   ✓ 带下划线批次ID的报告生成正确!")
    else:
        print("   ✗ 带下划线批次ID的报告生成错误!")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("  ✓ 所有报告生成和追踪修复验证通过!")
    print("=" * 60)
    
    print("\n已修复的问题:")
    print("  1. ✅ 报告生成器 - 使用batch_id精确匹配，B1不会包含B10")
    print("  2. ✅ 追踪函数 - TraceDetail返回包含batch_id字段")
    print("  3. ✅ 带下划线批次 - BATCH_2024_01格式正确支持")
    
    print("\n核心修复验证完成，项目可安装、可运行!")
    
except Exception as e:
    print(f"\n✗ 验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
