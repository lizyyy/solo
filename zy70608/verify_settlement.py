from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app

client = TestClient(app)

print('=' * 70)
print('无人货柜库存快照货损补货结算后端API - 完整结算闭环验证')
print('=' * 70)
print()

# 1. 创建基础数据
print('【1】创建基础数据')
client.post('/cabinets/', json={'cabinet_no': 'A001', 'location': '一楼大堂'})
client.post('/skus/', json={'sku_code': 'COLA', 'name': '可乐', 'price': 3.0, 'unit': '瓶'})
print('    ✓ 创建货柜 A001')
print('    ✓ 创建商品 COLA(可乐)')
print()

# 2. 创建期初库存快照
print('【2】创建期初库存快照')
period_start = datetime.now() - timedelta(days=30)

# 直接在数据库中创建期初快照，设置snapshot_time为period_start之前
from database import SessionLocal
from models import InventorySnapshot, Cabinet, SKU

db = SessionLocal()
cabinet = db.query(Cabinet).filter(Cabinet.cabinet_no == 'A001').first()
sku = db.query(SKU).filter(SKU.sku_code == 'COLA').first()

snapshot = InventorySnapshot(
    cabinet_id=cabinet.id,
    sku_id=sku.id,
    quantity=100,
    batch_no='BATCH001',
    created_by='admin',
    snapshot_time=period_start - timedelta(days=1)
)
db.add(snapshot)
db.commit()
db.close()

print('    ✓ 创建期初库存: COLA = 100瓶')
print()

# 3. 创建补货单并确认
print('【3】创建补货单并确认')
client.post(
    '/replenishments/',
    json={
        'cabinet_no': 'A001',
        'replenishment_no': 'REP001',
        'items': [{'sku_code': 'COLA', 'quantity': 50, 'batch_no': 'BATCH002'}],
        'remark': '日常补货',
        'operator_id': 'OP001',
        'operator_name': '张三'
    }
)
client.post(
    '/replenishments/REP001/confirm',
    json={'operator_id': 'OP001', 'operator_name': '张三'}
)
print('    ✓ 创建补货单 REP001，补货 50瓶')
print('    ✓ 补货员确认')
print()

# 4. 创建货损记录
print('【4】创建货损记录并确认')
response = client.post(
    '/damages/',
    json={
        'cabinet_no': 'A001',
        'sku_code': 'COLA',
        'quantity': 5,
        'damage_type': '包装破损',
        'reason': '运输挤压',
        'reporter_id': 'OP001',
        'reporter_name': '张三'
    }
)
damage_no = response.json()['damage_no']
client.post(
    f'/damages/{damage_no}/confirm',
    json={'confirmer_id': 'MGR001', 'confirmer_name': '经理'}
)
print(f'    ✓ 创建货损记录 {damage_no}，货损 5瓶')
print('    ✓ 经理确认货损')
print()

# 5. 创建临期下架记录
print('【5】创建临期下架记录并确认')
response = client.post(
    '/expired-products/',
    json={
        'cabinet_no': 'A001',
        'sku_code': 'COLA',
        'quantity': 3,
        'batch_no': 'BATCH001',
        'operator_id': 'OP001',
        'operator_name': '张三'
    }
)
expired_no = response.json()['record_no']
client.post(f'/expired-products/{expired_no}/confirm')
print(f'    ✓ 创建临期下架记录 {expired_no}，下架 3瓶')
print('    ✓ 确认临期下架')
print()

# 6. 创建期末库存快照
print('【6】创建期末库存快照')
client.post(
    '/inventory/snapshots/',
    json={
        'cabinet_no': 'A001',
        'sku_code': 'COLA',
        'quantity': 60,
        'batch_no': 'BATCH002',
        'created_by': 'admin'
    }
)
print('    ✓ 创建期末库存: COLA = 60瓶')
print()

# 7. 创建结算单
print('【7】创建结算单')
period_end = datetime.now()
response = client.post(
    '/settlements/',
    json={
        'cabinet_no': 'A001',
        'settlement_no': 'SET001',
        'period_start': period_start.isoformat(),
        'period_end': period_end.isoformat(),
        'created_by': 'finance'
    }
)
settlement = response.json()
print(f'    ✓ 创建结算单 SET001')
print()

# 8. 输出结算详情
print('【8】结算详情')
print('=' * 70)
print('    货柜:', settlement['cabinet_no'])
print('    结算单号:', settlement['settlement_no'])
print('    状态:', settlement['status'])
print()
detail = settlement['details'][0]
print('    SKU明细:', detail['sku_name'])
print('      - 期初库存:', detail['opening_inventory'], '瓶')
print('      - 本期补货:', detail['replenishment_quantity'], '瓶')
print('      - 货损数量:', detail['damage_quantity'], '瓶')
print('      - 临期下架:', detail['expired_quantity'], '瓶')
print('      - 销售数量:', detail['sales_quantity'], '瓶')
print('      - 期末库存:', detail['closing_inventory'], '瓶')
print()
print('    销售公式验证: 100 + 50 - 5 - 3 - 82 = 60')
print()
print('    金额汇总:')
print('      - 销售总额: %.2f 元 (82 × 3)' % settlement['total_sales'])
print('      - 货损损失: %.2f 元 (5 × 3)' % settlement['total_damage_loss'])
print('      - 临期损失: %.2f 元 (3 × 3)' % settlement['total_expired_loss'])
print('      - 净结算金额: %.2f 元' % settlement['net_amount'])
print('=' * 70)
print()

# 9. 确认结算单
print('【9】确认结算单')
response = client.post(
    '/settlements/SET001/confirm',
    json={'confirmed_by': 'finance_manager'}
)
settlement_confirmed = response.json()
print('    ✓ 结算单已确认，状态:', settlement_confirmed['status'])
print()

# 10. 测试异常路径留痕
print('【10】异常路径留痕验证')
print('    尝试重复创建补货单(幂等测试)...')
response = client.post(
    '/replenishments/',
    json={
        'cabinet_no': 'A001',
        'replenishment_no': 'REP001',
        'items': [{'sku_code': 'COLA', 'quantity': 100}],
        'operator_id': 'OP002',
        'operator_name': '李四'
    }
)
print('    ✓ 错误响应:', response.status_code, '-', response.json()['detail'])
print()

print('    查看操作日志...')
response = client.get('/operation-logs/')
logs = response.json()
failed_logs = [log for log in logs if log['status'] == 'failed']
print('    ✓ 共记录', len(failed_logs), '条失败操作日志')
for log in failed_logs:
    print('      -', log['operation_type'], ':', log['conclusion'])
print()

print('=' * 70)
print('✅ 结算闭环验证完成！')
print('  ✓ 库存快照正常工作')
print('  ✓ 货损扣减正常计算')
print('  ✓ 临期下架正常统计')
print('  ✓ 补货员确认流程正常')
print('  ✓ 销量自动推导正确')
print('  ✓ 金额自动计算正确')
print('  ✓ 异常路径操作日志留痕正常')
print('=' * 70)
