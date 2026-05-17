"""
仓储WMS接口批次库存冻结释放系统
验收测试脚本

验收场景：
1. 完整流转：冻结 -> 提交释放审核 -> 释放
2. 冲突记录：质检未完成被销售单占用
3. 导入坏行：导入错误数据并生成错误明细
"""
import os
import sys
import pandas as pd
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config import config
from models import Base, BatchInventory, InventoryFreeze, ReleaseVoucher, InventoryConflict, OperationHistory
from inventory_service import InventoryService
from export_service import ExportService

def init_db():
    """初始化数据库"""
    engine = create_engine(config.SQLALCHEMY_DATABASE_URI, echo=False)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    return Session()

def insert_test_data(db):
    """插入测试基础数据"""
    from models import Sku, FreezeReason
    
    skus = [
        Sku(sku_id='SKU001', sku_name='华为Mate 60 Pro', category='手机数码', unit='台'),
        Sku(sku_id='SKU002', sku_name='iPhone 15 Pro Max', category='手机数码', unit='台'),
        Sku(sku_id='SKU003', sku_name='小米14 Ultra', category='手机数码', unit='台'),
    ]
    
    reasons = [
        FreezeReason(reason_code='QUALITY_001', reason_name='待质检冻结', reason_type='QUALITY', description='商品到货待质检，临时冻结库存'),
        FreezeReason(reason_code='AUDIT_001', reason_name='审计抽查', reason_type='AUDIT', description='财务审计抽查冻结'),
    ]
    
    batches = [
        BatchInventory(
            batch_id='BATCH001',
            sku_id='SKU001',
            batch_no='B20240501001',
            warehouse_code='WH001',
            warehouse_name='上海中心仓',
            location_code='A-01-01',
            total_qty=1000,
            available_qty=1000,
            frozen_qty=0,
            released_qty=0,
            quality_status='PASSED',
            inventory_status='AVAILABLE'
        ),
        BatchInventory(
            batch_id='BATCH002',
            sku_id='SKU002',
            batch_no='B20240502001',
            warehouse_code='WH001',
            warehouse_name='上海中心仓',
            location_code='A-01-02',
            total_qty=800,
            available_qty=800,
            frozen_qty=0,
            released_qty=0,
            quality_status='PASSED',
            inventory_status='AVAILABLE'
        ),
        BatchInventory(
            batch_id='BATCH003',
            sku_id='SKU003',
            batch_no='B20240503001',
            warehouse_code='WH002',
            warehouse_name='北京顺义仓',
            location_code='B-02-03',
            total_qty=500,
            available_qty=500,
            frozen_qty=0,
            released_qty=0,
            quality_status='PENDING',
            inventory_status='AVAILABLE'
        ),
    ]
    
    db.add_all(skus)
    db.add_all(reasons)
    db.add_all(batches)
    db.commit()
    print('基础数据插入完成')

def scenario_1_complete_flow(db):
    """场景1：完整流转 - 冻结 -> 提交释放审核 -> 释放"""
    print('\n' + '='*60)
    print('场景1：完整流转 - 冻结 -> 提交释放审核 -> 释放')
    print('='*60)
    
    service = InventoryService(db)
    
    # 1. 冻结库存
    print('\n1. 执行冻结...')
    freeze_result = service.freeze_inventory(
        sku_id='SKU001',
        batch_id='BATCH001',
        warehouse_code='WH001',
        reason_code='AUDIT_001',
        freeze_qty=100,
        operator='admin',
        freeze_remark='审计抽查冻结',
        evidence_attachments=[
            {'name': '审计通知.pdf', 'url': '/files/audit.pdf', 'size': 102400}
        ]
    )
    print(f'冻结结果: {freeze_result}')
    freeze_id = freeze_result['freeze_id']
    
    # 查询冻结列表
    print('\n查询冻结列表:')
    freeze_list = service.get_freeze_list(sku_id='SKU001')
    for item in freeze_list:
        print(f"  冻结单号: {item['freeze_no']}, SKU: {item['sku_name']}, 数量: {item['freeze_qty']}, 状态: {item['status_name']}")
    
    # 查询冻结详情
    print('\n查询冻结详情:')
    freeze_detail = service.get_freeze_detail(freeze_id)
    for k, v in freeze_detail.items():
        print(f'  {k}: {v}')
    
    # 2. 提交释放审核
    print('\n2. 提交释放审核...')
    audit_result = service.submit_release_audit(
        freeze_id=freeze_id,
        operator='manager',
        audit_remark='审核通过，同意释放'
    )
    print(f'审核结果: {audit_result}')
    
    # 再次查询冻结详情（状态变化）
    print('\n查询审核后冻结详情:')
    freeze_detail = service.get_freeze_detail(freeze_id)
    print(f"  状态: {freeze_detail['status']} - {freeze_detail['status_name']}")
    print(f"  审核人: {freeze_detail['release_audit_operator']}")
    print(f"  审核时间: {freeze_detail['release_audit_time']}")
    
    # 3. 执行释放
    print('\n3. 执行释放...')
    release_result = service.release_inventory(
        freeze_id=freeze_id,
        release_qty=100,
        operator='operator',
        release_reason='审计完成释放',
        release_remark='库存审计完成，恢复可用',
        evidence_attachments=[
            {'name': '审计报告.pdf', 'url': '/files/report.pdf', 'size': 204800}
        ],
        related_order_no='REL20240501001',
        related_order_type='AUDIT_RELEASE'
    )
    print(f'释放结果: {release_result}')
    
    # 查询操作历史
    print('\n查询操作历史:')
    history = service.get_operation_history(business_type='FREEZE', business_id=freeze_id)
    for h in history:
        print(f"  时间: {h['operate_time']}, 动作: {h['action']}, 操作人: {h['operator']}")
        print(f"    变更前: {h['before_data']}")
        print(f"    变更后: {h['after_data']}")
    
    print('\n场景1完成！')

def scenario_2_conflict_record(db):
    """场景2：冲突记录 - 质检未完成被销售单占用"""
    print('\n' + '='*60)
    print('场景2：冲突记录 - 质检未完成被销售单占用')
    print('='*60)
    
    service = InventoryService(db)
    
    # 尝试冻结质检未完成的批次，携带销售单号
    print('\n尝试冻结质检未完成的批次...')
    freeze_result = service.freeze_inventory(
        sku_id='SKU003',
        batch_id='BATCH003',
        warehouse_code='WH002',
        reason_code='QUALITY_001',
        freeze_qty=50,
        operator='admin',
        freeze_remark='质检未完成的批次冻结',
        sales_order_no='SO20240501001'
    )
    print(f'冻结结果: {freeze_result}')
    
    # 查询冲突列表
    print('\n查询冲突列表:')
    conflicts = service.get_conflict_list()
    for c in conflicts:
        print(f"  冲突编号: {c['conflict_no']}")
        print(f"  类型: {c['conflict_type_name']}")
        print(f"  SKU: {c['sku_name']}, 批次: {c['batch_no']}")
        print(f"  关联单号: {c['related_order_no']}")
        print(f"  详情: {c['conflict_detail']}")
        print(f"  质检状态: {c['quality_status_name']}")
        print(f"  处理结果: {c['handle_result_name']}")
    
    # 处理冲突
    if conflicts:
        conflict_id = conflicts[0]['conflict_id']
        print(f'\n处理冲突: {conflict_id}')
        handle_result = service.handle_conflict(
            conflict_id=conflict_id,
            handler='supervisor',
            handle_result='RESOLVED',
            handle_remark='已确认质检通过，可以继续冻结'
        )
        print(f'处理结果: {handle_result}')
        
        # 查询处理后的冲突
        print('\n查询处理后的冲突:')
        conflicts_after = service.get_conflict_list()
        for c in conflicts_after:
            print(f"  冲突编号: {c['conflict_no']}, 处理结果: {c['handle_result_name']}, 状态: {c['status']}")
    
    print('\n场景2完成！')

def scenario_3_import_error(db):
    """场景3：导入坏行 - 导入错误数据并生成错误明细"""
    print('\n' + '='*60)
    print('场景3：导入坏行 - 导入错误数据并生成错误明细')
    print('='*60)
    
    export_service = ExportService(db)
    
    # 创建导入测试文件（包含错误数据）
    test_file_path = 'test_import_errors.xlsx'
    print(f'\n创建测试导入文件: {test_file_path}')
    
    test_data = [
        {'SKU编码': 'SKU001', '批次号': 'B20240501001', '仓库编码': 'WH001', '冻结原因编码': 'AUDIT_001', '冻结数量': 50},
        {'SKU编码': '', '批次号': 'B20240502001', '仓库编码': 'WH001', '冻结原因编码': 'AUDIT_001', '冻结数量': 30},
        {'SKU编码': 'SKU002', '批次号': '', '仓库编码': 'WH001', '冻结原因编码': 'AUDIT_001', '冻结数量': 40},
        {'SKU编码': 'SKU999', '批次号': 'B20240501001', '仓库编码': 'WH001', '冻结原因编码': 'AUDIT_001', '冻结数量': 100},
        {'SKU编码': 'SKU002', '批次号': 'B20240502001', '仓库编码': 'WH001', '冻结原因编码': 'AUDIT_001', '冻结数量': 20},
    ]
    
    df = pd.DataFrame(test_data)
    df.to_excel(test_file_path, index=False)
    print(f'测试文件包含 {len(test_data)} 条记录')
    print('其中: 第2行SKU编码为空, 第3行批次号为空, 第4行SKU不存在')
    
    # 执行导入
    print('\n执行导入...')
    import_result = export_service.import_freeze_records(
        file_path=test_file_path,
        operator='importer'
    )
    print(f'导入结果: {import_result}')
    
    # 检查错误明细文件
    if import_result.get('error_file_path') and os.path.exists(import_result['error_file_path']):
        print(f'\n错误明细文件已生成: {import_result["error_file_path"]}')
        df_errors = pd.read_excel(import_result['error_file_path'])
        print(f'错误明细内容:')
        print(df_errors.to_string())
    
    # 查询冻结列表确认成功导入的记录
    print('\n查询成功导入的冻结记录:')
    service = InventoryService(db)
    freeze_list = service.get_freeze_list()
    for item in freeze_list:
        print(f"  冻结单号: {item['freeze_no']}, SKU: {item['sku_name']}, 数量: {item['freeze_qty']}")
    
    # 清理测试文件
    if os.path.exists(test_file_path):
        os.remove(test_file_path)
    
    print('\n场景3完成！')

def scenario_4_export_test(db):
    """场景4：导出测试"""
    print('\n' + '='*60)
    print('场景4：导出测试')
    print('='*60)
    
    export_service = ExportService(db)
    
    # 导出冻结记录
    print('\n导出冻结记录...')
    freeze_export = export_service.export_freeze_records(operator='exporter')
    print(f'冻结记录导出结果: {freeze_export}')
    
    # 导出冲突记录
    print('\n导出冲突记录...')
    conflict_export = export_service.export_conflict_records(operator='exporter')
    print(f'冲突记录导出结果: {conflict_export}')
    
    # 检查导出的文件
    if freeze_export.get('file_path') and os.path.exists(freeze_export['file_path']):
        print(f'\n冻结记录导出文件内容:')
        df_freeze = pd.read_excel(freeze_export['file_path'])
        print(df_freeze.to_string())
    
    print('\n场景4完成！')

def main():
    print('仓储WMS接口批次库存冻结释放系统 - 验收测试')
    print('开始时间:', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    
    # 初始化数据库
    db = init_db()
    
    try:
        # 插入基础数据
        insert_test_data(db)
        
        # 执行验收场景
        scenario_1_complete_flow(db)
        scenario_2_conflict_record(db)
        scenario_3_import_error(db)
        scenario_4_export_test(db)
        
        print('\n' + '='*60)
        print('所有验收场景执行完成！')
        print('='*60)
        print('结束时间:', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
        
    except Exception as e:
        print(f'测试执行出错: {e}')
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == '__main__':
    main()
