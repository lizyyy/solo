"""
数据库初始化脚本
用于导入示例数据并运行首次比对
"""
import json
import pandas as pd
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models import models
from app.models.models import MaterialBatch, MaterialTraceLog
from datetime import datetime

models.Base.metadata.create_all(bind=engine)

def init_sample_data():
    db = SessionLocal()
    try:
        print("开始导入示例数据...")
        
        from app.services.import_service import ImportService
        
        import_service = ImportService(db)
        
        with open('sample_data/repair_records.csv', 'rb') as f:
            repair_result = import_service.import_repair_csv(f.read(), 'repair_records.csv')
            print(f"返修记录导入结果: {repair_result}")
        
        with open('sample_data/work_orders.json', 'rb') as f:
            wo_result = import_service.import_work_order_json(f.read(), 'work_orders.json')
            print(f"工单导入结果: {wo_result}")
        
        print("\n导入物料批次数据...")
        batches = [
            {
                'batch_no': 'BATCH001',
                'material_code': 'MAT-001',
                'material_name': '电阻0402-1K',
                'supplier': '供应商A',
                'production_date': '2024-04-01',
                'received_date': '2024-04-10',
                'total_qty': 10000,
                'used_qty': 500,
                'defect_qty': 2,
                'storage_location': 'A-01-01',
                'quality_status': '合格'
            },
            {
                'batch_no': 'BATCH002',
                'material_code': 'MAT-001',
                'material_name': '电阻0402-1K',
                'supplier': '供应商A',
                'production_date': '2024-04-15',
                'received_date': '2024-04-20',
                'total_qty': 8000,
                'used_qty': 300,
                'defect_qty': 5,
                'storage_location': 'A-01-02',
                'quality_status': '待检'
            },
            {
                'batch_no': 'BATCH003',
                'material_code': 'MAT-002',
                'material_name': '电容0603-10uF',
                'supplier': '供应商B',
                'production_date': '2024-04-05',
                'received_date': '2024-04-12',
                'total_qty': 5000,
                'used_qty': 400,
                'defect_qty': 3,
                'storage_location': 'B-02-01',
                'quality_status': '合格'
            }
        ]
        
        for batch in batches:
            result = import_service.import_material_batch(batch)
            print(f"物料批次 {batch['batch_no']}: {'成功' if result['success'] else '失败 - ' + result.get('error', '')}")
        
        print("\n运行首次比对...")
        from app.services.comparison_service import ComparisonService
        comparison_service = ComparisonService(db)
        compare_result = comparison_service.run_comparison()
        print(f"比对完成: {compare_result}")
        
        print("\n初始化完成！")
        print(f"批次ID: {compare_result.get('batch_id')}")
        
    finally:
        db.close()

if __name__ == "__main__":
    init_sample_data()
