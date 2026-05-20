#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import json
from app.models import init_db, get_connection
from app.services import (
    DeviceModelService, FirmwareService, GrayBatchService,
    UpgradeReceiptService, ReportService
)

def run_test(name, test_func):
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print('='*60)
    try:
        test_func()
        print(f"✅ {name} - 通过")
        return True
    except AssertionError as e:
        print(f"❌ {name} - 失败: {e}")
        return False
    except Exception as e:
        print(f"❌ {name} - 异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_device_model():
    model = DeviceModelService.create(
        model_name="智能网关",
        model_code="GW-V1",
        description="第一代智能网关设备"
    )
    assert model['id'] is not None
    assert model['model_name'] == "智能网关"
    
    models = DeviceModelService.get_all()
    assert len(models) >= 1
    return model

def test_firmware_version(model):
    firmware = FirmwareService.create(
        model_id=model['id'],
        version="2.0.1",
        file_path="/firmware/gw-v1-2.0.1.bin",
        md5="abc123def456",
        release_notes="修复已知BUG，提升稳定性"
    )
    assert firmware['id'] is not None
    assert firmware['version'] == "2.0.1"
    
    versions = FirmwareService.get_all()
    assert len(versions) >= 1
    return firmware

def test_create_batch(model, firmware):
    batch = GrayBatchService.create(
        name="灰度批次-001",
        model_id=model['id'],
        firmware_id=firmware['id'],
        pause_threshold=0.1
    )
    assert batch['id'] is not None
    assert batch['status'] == 'created'
    assert batch['pause_threshold'] == 0.1
    return batch

def test_start_batch(batch):
    success, msg = GrayBatchService.start_batch(batch['id'])
    assert success is True
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['status'] == 'running'
    assert updated['started_at'] is not None

def test_create_receipts(batch):
    device_sns = ["DEV001", "DEV002", "DEV003", "DEV004", "DEV005",
                   "DEV006", "DEV007", "DEV008", "DEV009", "DEV010"]
    
    for sn in device_sns:
        receipt = UpgradeReceiptService.create(batch['id'], sn)
        assert receipt['id'] is not None
        assert receipt['status'] == 'pending'
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['current_devices'] == 10
    assert updated['target_devices'] == 10

def test_upgrade_flow(batch):
    receipts = UpgradeReceiptService.get_by_batch(batch['id'])
    assert len(receipts) == 10
    
    for i, receipt in enumerate(receipts[:7]):
        success, msg = UpgradeReceiptService.start_upgrade(receipt['id'])
        assert success is True
        
        success, msg = UpgradeReceiptService.complete_upgrade(
            receipt['id'],
            success=True
        )
        assert success is True
    
    for i, receipt in enumerate(receipts[7:]):
        success, msg = UpgradeReceiptService.start_upgrade(receipt['id'])
        assert success is True
        
        success, msg = UpgradeReceiptService.complete_upgrade(
            receipt['id'],
            success=False,
            error_code="ERR_DOWNLOAD",
            error_message=f"固件下载失败 #{i+1}"
        )
        assert success is True
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['success_count'] == 7
    assert updated['failed_count'] == 3

def test_auto_pause_trigger():
    model = DeviceModelService.create(
        model_name="测试设备",
        model_code="TEST-PAUSE"
    )
    firmware = FirmwareService.create(model['id'], "1.0.0")
    
    batch = GrayBatchService.create(
        name="自动暂停测试批次",
        model_id=model['id'],
        firmware_id=firmware['id'],
        pause_threshold=0.2
    )
    
    GrayBatchService.start_batch(batch['id'])
    
    device_sns = [f"TEST{i:03d}" for i in range(1, 11)]
    for sn in device_sns:
        UpgradeReceiptService.create(batch['id'], sn)
    
    receipts = UpgradeReceiptService.get_by_batch(batch['id'])
    for receipt in receipts[:3]:
        UpgradeReceiptService.start_upgrade(receipt['id'])
        UpgradeReceiptService.complete_upgrade(
            receipt['id'],
            success=False,
            error_message="模拟失败"
        )
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['status'] == 'paused', f"期望状态为 paused，实际为 {updated['status']}"
    assert "失败率达到阈值" in updated['pause_reason']
    
    print(f"✅ 自动暂停触发成功 - 当前状态: {updated['status']}")
    print(f"   失败率: {updated['failed_count']}/{updated['current_devices']} = {updated['failed_count']/updated['current_devices']:.1%}")
    print(f"   暂停原因: {updated['pause_reason']}")

def test_manual_pause_resume():
    model = DeviceModelService.create(
        model_name="手动测试设备",
        model_code="TEST-MANUAL"
    )
    firmware = FirmwareService.create(model['id'], "1.0.0")
    
    batch = GrayBatchService.create(
        name="手动暂停测试批次",
        model_id=model['id'],
        firmware_id=firmware['id']
    )
    GrayBatchService.start_batch(batch['id'])
    
    success, msg = GrayBatchService.pause_batch(batch['id'], "管理员手动暂停")
    assert success is True
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['status'] == 'paused'
    
    success, msg = GrayBatchService.resume_batch(batch['id'])
    assert success is True
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['status'] == 'running'

def test_rollback():
    model = DeviceModelService.create(
        model_name="回滚测试设备",
        model_code="TEST-ROLLBACK"
    )
    firmware = FirmwareService.create(model['id'], "1.0.0")
    
    batch = GrayBatchService.create(
        name="回滚测试批次",
        model_id=model['id'],
        firmware_id=firmware['id']
    )
    GrayBatchService.start_batch(batch['id'])
    
    UpgradeReceiptService.create(batch['id'], "ROLL001")
    
    success, msg = GrayBatchService.rollback_batch(batch['id'])
    assert success is True
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['status'] == 'rolled_back'
    
    receipts = UpgradeReceiptService.get_by_batch(batch['id'])
    for r in receipts:
        assert r['status'] == 'rolled_back'

def test_report_generation():
    model = DeviceModelService.create(
        model_name="报告测试设备",
        model_code="TEST-REPORT"
    )
    firmware = FirmwareService.create(model['id'], "1.0.0")
    
    batch = GrayBatchService.create(
        name="报告测试批次",
        model_id=model['id'],
        firmware_id=firmware['id'],
        pause_threshold=0.9
    )
    GrayBatchService.start_batch(batch['id'])
    
    for i in range(1, 6):
        receipt = UpgradeReceiptService.create(batch['id'], f"REP{i:03d}")
        UpgradeReceiptService.start_upgrade(receipt['id'])
        UpgradeReceiptService.complete_upgrade(
            receipt['id'],
            success=(i <= 3),
            error_message="下载失败" if i > 3 else None
        )
    
    report = ReportService.generate_batch_report(batch['id'])
    assert report is not None
    assert report['summary']['total'] == 5
    assert report['summary']['success'] == 3
    assert report['summary']['failed'] == 2
    assert report['summary']['success_rate'] == 0.6
    
    print(f"✅ 报告生成成功")
    print(f"   总数: {report['summary']['total']}")
    print(f"   成功: {report['summary']['success']}")
    print(f"   失败: {report['summary']['failed']}")
    print(f"   成功率: {report['summary']['success_rate']:.1%}")

def test_bulk_import():
    model = DeviceModelService.create(
        model_name="批量导入测试",
        model_code="TEST-BULK"
    )
    firmware = FirmwareService.create(model['id'], "1.0.0")
    
    batch = GrayBatchService.create(
        name="批量导入测试批次",
        model_id=model['id'],
        firmware_id=firmware['id']
    )
    
    device_sns = [f"BULK{i:03d}" for i in range(1, 21)]
    result = UpgradeReceiptService.bulk_import(batch['id'], device_sns)
    
    assert result['created'] == 20
    assert result['failed'] == 0
    
    updated = GrayBatchService.get_by_id(batch['id'])
    assert updated['target_devices'] == 20
    
    print(f"✅ 批量导入成功 - 导入 {result['created']} 台设备")

def test_pause_blocks_upgrade():
    model = DeviceModelService.create(
        model_name="暂停阻断测试",
        model_code="TEST-BLOCK"
    )
    firmware = FirmwareService.create(model['id'], "1.0.0")
    
    batch = GrayBatchService.create(
        name="暂停阻断测试批次",
        model_id=model['id'],
        firmware_id=firmware['id'],
        pause_threshold=0.5
    )
    GrayBatchService.start_batch(batch['id'])
    
    for i in range(1, 6):
        UpgradeReceiptService.create(batch['id'], f"BLOCK{i:03d}")
    
    receipts = UpgradeReceiptService.get_by_batch(batch['id'])
    
    success, msg = UpgradeReceiptService.start_upgrade(receipts[0]['id'])
    assert success is True, f"运行中批次应该能开始升级: {msg}"
    print(f"   ✅ 运行中可以开始升级")
    
    success, msg = UpgradeReceiptService.complete_upgrade(
        receipts[0]['id'],
        success=True
    )
    assert success is True
    print(f"   ✅ 运行中可以完成升级")
    
    success, msg = GrayBatchService.pause_batch(batch['id'], "手动暂停测试")
    assert success is True
    
    updated_batch = GrayBatchService.get_by_id(batch['id'])
    assert updated_batch['status'] == 'paused'
    print(f"   批次状态: {updated_batch['status']}")
    print(f"   暂停原因: {updated_batch['pause_reason']}")
    
    success, msg = UpgradeReceiptService.start_upgrade(receipts[1]['id'])
    assert success is False, "暂停后不应该能开始新升级"
    assert "暂停" in msg
    print(f"   ✅ 暂停后开始升级被阻断: {msg}")
    
    success, msg = UpgradeReceiptService.complete_upgrade(receipts[2]['id'], success=True)
    assert success is False, "暂停后不应该能完成升级"
    assert "暂停" in msg
    print(f"   ✅ 暂停后完成升级被阻断: {msg}")
    
    try:
        UpgradeReceiptService.create(batch['id'], "BLOCK-NEW")
        assert False, "暂停后应该无法创建新回执"
    except Exception as e:
        assert "暂停" in str(e)
        print(f"   ✅ 暂停后添加新设备被阻断: {str(e)}")
    
    success, msg = GrayBatchService.resume_batch(batch['id'])
    assert success is True
    
    success, msg = UpgradeReceiptService.start_upgrade(receipts[1]['id'])
    assert success is True, "恢复后应该能开始升级"
    print(f"   ✅ 恢复后可以开始升级")

def main():
    print("\n" + "🚀"*30)
    print("设备固件灰度系统 - 核心逻辑自检脚本")
    print("🚀"*30)
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'firmware_gray.db')
    if os.path.exists(db_path):
        os.remove(db_path)
    
    init_db()
    
    results = []
    
    model = test_device_model()
    results.append(("设备型号管理", True))
    
    firmware = test_firmware_version(model)
    results.append(("固件版本管理", True))
    
    def test_upgrade_flow_with_new_batch():
        batch = GrayBatchService.create(
            name="升级流程测试批次",
            model_id=model['id'],
            firmware_id=firmware['id'],
            pause_threshold=0.5
        )
        GrayBatchService.start_batch(batch['id'])
        test_create_receipts(batch)
        test_upgrade_flow(batch)
    
    results.append(("升级流程模拟", run_test("升级流程模拟", test_upgrade_flow_with_new_batch)))
    results.append(("自动暂停触发", run_test("自动暂停触发", test_auto_pause_trigger)))
    results.append(("手动暂停/恢复", run_test("手动暂停/恢复", test_manual_pause_resume)))
    results.append(("批次回滚功能", run_test("批次回滚功能", test_rollback)))
    results.append(("报告生成", run_test("报告生成", test_report_generation)))
    results.append(("批量导入设备", run_test("批量导入设备", test_bulk_import)))
    results.append(("暂停阻断推送", run_test("暂停阻断推送", test_pause_blocks_upgrade)))
    
    print("\n" + "📊"*30)
    print("测试结果汇总")
    print("📊"*30)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, r in results:
        status = "✅ 通过" if r else "❌ 失败"
        print(f"  {status} - {name}")
    
    print(f"\n总计: {passed}/{total} 项测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！核心逻辑验证成功！")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 项测试失败，请检查代码")
        return 1

if __name__ == '__main__':
    exit(main())
