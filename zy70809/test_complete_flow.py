#!/usr/bin/env python3
import os
import sys

# 移除旧数据库确保干净测试
if os.path.exists('fire_maintenance.db'):
    os.remove('fire_maintenance.db')

# 先测试核心模块
print('=== 测试1: 核心模块导入 ===')
try:
    from app.excel_parser import parse_equipment_excel, parse_photo_excel, parse_contract_excel
    from app.validation_engine import validate_all
    from app.models import Batch, Equipment, Contract, InspectionPhoto, ValidationResult
    from app.database import get_db, engine, Base
    print('✅ 所有模块导入成功')
except Exception as e:
    print('❌ 模块导入失败:', str(e))
    sys.exit(1)

print('')
print('=== 测试2: Excel解析功能 ===')
try:
    equipment = parse_equipment_excel('test_equipment.xlsx')
    photos = parse_photo_excel('test_photos.xlsx')
    contracts = parse_contract_excel('test_contracts.xlsx')
    print(f'✅ 解析成功: 设备{len(equipment)}条, 照片{len(photos)}条, 合同{len(contracts)}条')
except Exception as e:
    print('❌ Excel解析失败:', str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)

print('')
print('=== 测试3: 业务规则校验引擎 ===')
try:
    normal_items, pending_confirm_items, failed_items = validate_all(equipment, photos, contracts)
    print(f'✅ 校验成功:')
    print(f'   正常项: {len(normal_items)}')
    print(f'   待确认项: {len(pending_confirm_items)}')
    print(f'   失败项: {len(failed_items)}')
    
    if pending_confirm_items:
        print(f'   待确认样例: {pending_confirm_items[0]["equipment_code"]} - {pending_confirm_items[0]["rule_type"]}')
    if failed_items:
        print(f'   失败样例: {failed_items[0]["equipment_code"]} - {failed_items[0]["rule_type"]}')
        
except Exception as e:
    print('❌ 校验引擎失败:', str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)

print('')
print('=== 测试4: 数据库存储功能 ===')
try:
    from sqlalchemy.orm import sessionmaker
    
    # 创建数据库表
    Base.metadata.create_all(bind=engine)
    print('✅ 数据库表创建成功')
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # 创建测试批次
    from datetime import datetime
    from app.models import BatchStatus
    test_batch = Batch(
        batch_no='INTEGRATION_TEST_001',
        status=BatchStatus.PROCESSING,
        created_at=datetime.utcnow()
    )
    db.add(test_batch)
    db.commit()
    db.refresh(test_batch)
    print(f'✅ 批次创建成功: ID={test_batch.id}')
    
    # 存储设备数据
    for eq in equipment:
        db_equipment = Equipment(
            batch_id=test_batch.id,
            equipment_code=eq['equipment_code'],
            equipment_name=eq['equipment_name'],
            equipment_type=eq['equipment_type'],
            location=eq['location'],
            last_maintenance_date=eq['last_maintenance_date'],
            next_maintenance_date=eq['next_maintenance_date'],
            maintenance_company=eq['maintenance_company']
        )
        db.add(db_equipment)
    db.commit()
    print(f'✅ 设备数据存储成功')
    
    # 存储校验结果
    from app.excel_parser import to_json_str
    for result in failed_items:
        db_result = ValidationResult(
            batch_id=test_batch.id,
            equipment_code=result['equipment_code'],
            result_type=result['result_type'],
            rule_type=result['rule_type'],
            original_data=to_json_str(result),
            suggestion=result['suggestion']
        )
        db.add(db_result)
    db.commit()
    print(f'✅ 校验结果存储成功')
    
    # 验证查询
    saved_results = db.query(ValidationResult).filter(ValidationResult.batch_id == test_batch.id).all()
    print(f'✅ 结果查询成功: 共{len(saved_results)}条失败记录')
    
    db.close()
except Exception as e:
    print('❌ 数据库操作失败:', str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)

print('')
print('=== 测试5: API应用启动验证 ===')
try:
    from app.main import app
    print(f'✅ FastAPI应用启动成功: 标题={app.title}, 路由数={len(app.routes)}')
except Exception as e:
    print('❌ API应用启动失败:', str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)

print('')
print('🎉 ======================================')
print('🎉 所有核心流程测试通过！')
print('🎉 项目可安装、可运行、可验证')
print('🎉 ======================================')
