#!/usr/bin/env python3
"""
快速验证修复脚本
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("="*60)
print("  修复验证 - 市政运维对账服务")
print("="*60)

try:
    print("\n1. 验证模块导入...")
    from app.database import Base, engine, get_db
    from app import models
    from app import schemas
    from app import reconciliation
    from app import report_generator
    from app import crud
    print("   ✓ 所有模块导入成功")
except Exception as e:
    print(f"   ✗ 模块导入失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("\n2. 验证数据模型...")
    from sqlalchemy.orm import Session, sessionmaker
    from sqlalchemy import create_engine
    
    test_engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=test_engine)
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = SessionLocal()
    
    print("   ✓ 数据模型创建成功")
    
    batch = models.ReconciliationBatch(
        batch_id="BATCH_2024_01",
        name="测试批次",
        created_by="测试员"
    )
    db.add(batch)
    db.commit()
    
    assert batch.batch_id == "BATCH_2024_01"
    print("   ✓ 带下划线的批次ID支持")
    
except Exception as e:
    print(f"   ✗ 数据模型验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("\n3. 验证同杆多灯识别逻辑...")
    
    from app.reconciliation import _group_by_pole
    
    class MockAlarm:
        def __init__(self, pole_id, light_id):
            self.pole_id = pole_id
            self.light_id = light_id
    
    alarms = [
        MockAlarm("P001", "L001"),
        MockAlarm("P001", "L002"),
        MockAlarm("P002", "L001"),
    ]
    
    pole_map = _group_by_pole(alarms, [], [])
    p001_light_count = len(pole_map["P001"]["light_ids"])
    p002_light_count = len(pole_map["P002"]["light_ids"])
    
    assert p001_light_count == 2, f"预期P001有2个灯具，实际{p001_light_count}个"
    assert p002_light_count == 1, f"预期P002有1个灯具，实际{p002_light_count}个"
    
    print(f"   ✓ 同杆多灯识别正确: P001={p001_light_count}个灯具, P002={p002_light_count}个灯具")
    
except Exception as e:
    print(f"   ✗ 同杆多灯逻辑验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("\n4. 验证记录ID分隔符...")
    
    from app.reconciliation import _group_by_pole_and_light
    
    class MockRecord:
        def __init__(self, pole_id, light_id):
            self.pole_id = pole_id
            self.light_id = light_id
    
    alarms = [MockRecord("P001", "L001")]
    pole_light_map = _group_by_pole_and_light(alarms, [], [])
    
    assert "P001||L001" in pole_light_map, "使用||分隔符"
    
    key = list(pole_light_map.keys())[0]
    pole_id, light_id = key.split('||', 1)
    
    assert pole_id == "P001"
    assert light_id == "L001"
    
    print(f"   ✓ 记录ID使用||分隔符，避免下划线冲突: {key}")
    
except Exception as e:
    print(f"   ✗ 分隔符验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("\n5. 验证对账记录batch_id字段...")
    
    from sqlalchemy import inspect
    inspector = inspect(test_engine)
    columns = [c['name'] for c in inspector.get_columns('reconciliation_records')]
    
    assert 'batch_id' in columns, "reconciliation_records表缺少batch_id字段"
    print("   ✓ reconciliation_records表有batch_id字段")
    
except Exception as e:
    print(f"   ✗ batch_id字段验证失败: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    db.close()
    test_engine.dispose()
except:
    pass

print("\n" + "="*60)
print("  ✓ 所有修复验证通过!")
print("="*60)
print("\n已修复的问题:")
print("  1. ✅ 同杆多灯识别 - 按pole_id分组统计light_ids")
print("  2. ✅ 批次ID解析 - 使用直接的record.batch_id字段")
print("  3. ✅ 重新计算删除 - 使用batch_id字段精确匹配")
print("  4. ✅ ID分隔符 - 使用||替代_，避免下划线冲突")
print("\n可以运行 pytest tests/ -v 执行完整测试")
print("可以运行 uvicorn app.main:app --reload 启动服务")
