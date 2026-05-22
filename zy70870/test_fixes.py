#!/usr/bin/env python3
"""测试修复是否正确"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from stability_reconciliation.models.database import (
    init_db, SessionLocal, TestProtocol, Sample, ChamberRecord,
    ReconciliationRecord
)
from stability_reconciliation.services.reconciliation_engine import ReconciliationEngine
from stability_reconciliation.services.import_service import DataImportService
from datetime import datetime, timedelta
import uuid

def test_extension_approval_bug():
    """测试延期审批检查的TypeError bug是否修复"""
    print("测试1: 延期审批检查的TypeError bug修复...")
    
    db = SessionLocal()
    
    protocol = TestProtocol(
        id=f"PROTO-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_name="测试方案",
        product_name="测试产品",
        batch_number="BATCH-001",
        conditions={},
        sampling_points=[],
        status="active"
    )
    db.add(protocol)
    
    sample1 = Sample(
        id=f"SAMP-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_id=protocol.id,
        sample_id="S001",
        sampling_point="3月",
        planned_sampling_date=datetime.now(),
        actual_sampling_date=datetime.now() + timedelta(days=5),
        condition="25°C/60%RH",
        storage_location="箱体A",
        status="extended",
        test_results=None
    )
    db.add(sample1)
    
    sample2 = Sample(
        id=f"SAMP-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_id=protocol.id,
        sample_id="S002",
        sampling_point="6月",
        planned_sampling_date=datetime.now(),
        actual_sampling_date=datetime.now() + timedelta(days=5),
        condition="25°C/60%RH",
        storage_location="箱体A",
        status="extended",
        test_results={"extension_approved": True}
    )
    db.add(sample2)
    
    db.commit()
    
    engine = ReconciliationEngine(db)
    
    try:
        discrepancies1 = engine._check_extension_approval(sample1)
        print(f"  ✓ test_results=None 时正常运行，发现 {len(discrepancies1)} 个差异（预期1个）")
        assert len(discrepancies1) == 1, "应该检测到未审批的延期"
        assert discrepancies1[0].type == "extension_unapproved"
    except TypeError as e:
        print(f"  ✗ TypeError: {e}")
        return False
    except Exception as e:
        print(f"  ✗ 其他错误: {e}")
        return False
    
    try:
        discrepancies2 = engine._check_extension_approval(sample2)
        print(f"  ✓ 已审批的延期样品正常运行，发现 {len(discrepancies2)} 个差异（预期0个）")
        assert len(discrepancies2) == 0, "已审批的延期不应该有差异"
    except Exception as e:
        print(f"  ✗ 错误: {e}")
        return False
    
    db.rollback()
    db.close()
    print("  ✓ 测试通过!")
    return True


def test_recalculate_does_not_duplicate():
    """测试重新计算不会新增对账记录"""
    print("\n测试2: 重新计算不会新增对账记录...")
    
    db = SessionLocal()
    
    protocol = TestProtocol(
        id=f"PROTO-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_name="测试方案",
        product_name="测试产品",
        batch_number="BATCH-001",
        conditions={},
        sampling_points=[],
        status="active"
    )
    db.add(protocol)
    
    sample = Sample(
        id=f"SAMP-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_id=protocol.id,
        sample_id="S001",
        sampling_point="0月",
        planned_sampling_date=datetime.now(),
        actual_sampling_date=datetime.now(),
        condition="25°C/60%RH",
        storage_location="箱体A",
        status="imported",
        test_results={}
    )
    db.add(sample)
    db.commit()
    
    engine = ReconciliationEngine(db)
    batch_id, records, summary = engine.run_reconciliation(protocol.id)
    
    initial_count = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_batch_id == batch_id
    ).count()
    
    print(f"  对账后记录数: {initial_count}")
    
    record_id = records[0].id
    
    engine.recalculate_reconciliation(record_id, {})
    
    final_count = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_batch_id == batch_id
    ).count()
    
    print(f"  重新计算后记录数: {final_count}")
    
    if initial_count == final_count:
        print(f"  ✓ 测试通过! 记录数保持不变 ({initial_count})")
        result = True
    else:
        print(f"  ✗ 测试失败! 记录数从 {initial_count} 变成 {final_count}")
        result = False
    
    db.rollback()
    db.close()
    return result


def test_sample_import_with_extension_fields():
    """测试样品CSV导入支持延期字段"""
    print("\n测试3: 样品CSV导入支持延期字段...")
    
    db = SessionLocal()
    
    protocol = TestProtocol(
        id=f"PROTO-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_name="测试方案",
        product_name="测试产品",
        batch_number="BATCH-001",
        conditions={},
        sampling_points=[],
        status="active"
    )
    db.add(protocol)
    db.commit()
    
    csv_content = """sample_id,sampling_point,planned_sampling_date,actual_sampling_date,condition,storage_location,status,extension_approved,extension_note,extension_approved_by
S001,0月,2024-01-01,2024-01-02,25°C/60%RH,箱体A,imported,,
S002,3月,2024-04-01,2024-04-10,25°C/60%RH,箱体A,extended,true,春节假期,QA001
S003,6月,2024-07-01,,40°C/75%RH,箱体B,pending,,
"""
    
    import_service = DataImportService(db)
    samples = import_service.import_samples_csv(csv_content, protocol.id)
    
    print(f"  导入了 {len(samples)} 个样品")
    
    extended_sample = next((s for s in samples if s.sample_id == "S002"), None)
    if extended_sample:
        print(f"  延期样品状态: {extended_sample.status}")
        print(f"  延期样品test_results: {extended_sample.test_results}")
        
        if extended_sample.status == "extended" and extended_sample.test_results:
            if extended_sample.test_results.get("extension_approved") == True:
                print("  ✓ 延期审批字段正确导入!")
                result = True
            else:
                print("  ✗ extension_approved 不正确")
                result = False
        else:
            print("  ✗ 状态或test_results不正确")
            result = False
    else:
        print("  ✗ 未找到延期样品")
        result = False
    
    db.rollback()
    db.close()
    return result


def test_full_workflow():
    """测试完整的对账流程"""
    print("\n测试4: 完整对账流程...")
    
    db = SessionLocal()
    
    protocol = TestProtocol(
        id=f"PROTO-TEST-{uuid.uuid4().hex[:6].upper()}",
        protocol_name="测试方案",
        product_name="测试产品",
        batch_number="BATCH-001",
        conditions={},
        sampling_points=[],
        status="active"
    )
    db.add(protocol)
    
    for i in range(3):
        sample = Sample(
            id=f"SAMP-TEST-{uuid.uuid4().hex[:6].upper()}",
            protocol_id=protocol.id,
            sample_id=f"S00{i+1}",
            sampling_point=f"{i*3}月",
            planned_sampling_date=datetime.now() + timedelta(days=i*90),
            actual_sampling_date=datetime.now() + timedelta(days=i*90 + (5 if i == 1 else 0)),
            condition="25°C/60%RH",
            storage_location="箱体A",
            status="extended" if i == 1 else "imported",
            test_results={"extension_approved": True} if i == 1 else {}
        )
        db.add(sample)
    
    db.commit()
    
    engine = ReconciliationEngine(db)
    batch_id, records, summary = engine.run_reconciliation(protocol.id)
    
    print(f"  批次ID: {batch_id}")
    print(f"  总结: {summary}")
    
    initial_count = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_batch_id == batch_id
    ).count()
    print(f"  对账记录数: {initial_count}")
    
    for record in records:
        engine.recalculate_reconciliation(record.id, {})
    
    final_count = db.query(ReconciliationRecord).filter(
        ReconciliationRecord.reconciliation_batch_id == batch_id
    ).count()
    print(f"  全部重新计算后记录数: {final_count}")
    
    if initial_count == final_count:
        print("  ✓ 完整流程测试通过!")
        result = True
    else:
        print("  ✗ 记录数不一致")
        result = False
    
    db.rollback()
    db.close()
    return result


if __name__ == "__main__":
    print("=" * 60)
    print("开始测试修复...")
    print("=" * 60)
    
    init_db()
    
    results = []
    results.append(("延期审批TypeError修复", test_extension_approval_bug()))
    results.append(("重新计算不新增记录", test_recalculate_does_not_duplicate()))
    results.append(("样品导入延期字段", test_sample_import_with_extension_fields()))
    results.append(("完整对账流程", test_full_workflow()))
    
    print("\n" + "=" * 60)
    print("测试总结:")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✓ 通过" if result else "✗ 失败"
        print(f"  {name}: {status}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n✓ 所有测试通过!")
        sys.exit(0)
    else:
        print("\n✗ 部分测试失败!")
        sys.exit(1)
