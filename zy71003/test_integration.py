import sys
import time
sys.path.insert(0, '.')

from app.services import process_temperature_window, check_temperature_window
from app import schemas, models
from app.database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    timestamp = int(time.time() * 1000)
    test_slot = f"TEST-SLOT-{timestamp}"
    test_bat = f"TEST-BAT-{timestamp}"
    test_biz = f"TEST-BIZ-{timestamp}"
    test_win = f"WIN-TEST-{timestamp}"

    print("测试1: 检查异常类型检测")
    temps = [25.0, 30.0, 55.0, 45.0]
    stats = check_temperature_window(temps, 50.0)
    print(f"  异常类型: {stats['anomaly_types']}")
    assert '超温' in stats['anomaly_types'], "应该包含'超温'"
    assert '快速温升' in stats['anomaly_types'], "应该包含'快速温升'"
    print("  ✓ 通过")
    
    print("\n测试2: 测试 process_temperature_window 创建禁用记录")
    
    from app.services import get_or_create_slot, validate_slot_transition
    slot = get_or_create_slot(db, test_slot)
    if slot.status != "available":
        slot.status = "available"
        db.commit()
    if validate_slot_transition(slot.status, "occupied"):
        slot.status = "occupied"
        slot.battery_id = test_bat
        db.commit()
    
    request = schemas.TemperatureWindowRequest(
        business_no=test_biz,
        slot_number=test_slot,
        battery_id=test_bat,
        temperatures=[25.0, 30.0, 55.0, 45.0],
        window_id=test_win,
        threshold=50.0
    )
    
    result = process_temperature_window(db, request)
    print(f"  is_anomaly: {result['is_anomaly']}")
    print(f"  slot_status: {result['slot_status']}")
    print(f"  disable_record_id: {result.get('disable_record_id')}")
    
    assert result['is_anomaly'] == True, "应该检测到异常"
    assert result['slot_status'] == 'disabled', "格口应该被禁用"
    assert 'disable_record_id' in result, "应该返回 disable_record_id"
    
    disable_record_id = result['disable_record_id']
    
    disable_record = db.query(models.DisableRecord).filter(models.DisableRecord.id == disable_record_id).first()
    assert disable_record is not None, "禁用记录应该存在"
    assert disable_record.operator == "system", f"操作人应该是 system，实际是 {disable_record.operator}"
    assert "超温" in disable_record.reason, f"原因应该包含超温，实际是 {disable_record.reason}"
    assert disable_record.is_active == True, "记录应该是活跃的"
    print(f"  禁用记录 - operator: {disable_record.operator}, reason: {disable_record.reason}")
    print("  ✓ 通过")
    
    print("\n测试3: 验证操作日志")
    logs = db.query(models.OperationLog).filter(
        models.OperationLog.operation_type == "create_disable",
        models.OperationLog.slot_number == "TEST-SLOT-002"
    ).all()
    assert len(logs) > 0, "应该有创建禁用记录的日志"
    log = logs[-1]
    assert log.operator == "system", f"日志操作人应该是 system，实际是 {log.operator}"
    assert "证据链" in log.details, "日志应该包含证据链"
    print(f"  日志详情包含证据链: {'证据链' in log.details}")
    print("  ✓ 通过")
    
    print("\n✅ 所有集成测试通过！")
    
finally:
    db.close()
