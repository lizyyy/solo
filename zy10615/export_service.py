import os
import pandas as pd
from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from models import ImportExportLog, generate_id
from inventory_service import InventoryService

EXPORT_FIELDS = {
    'freeze': [
        {'field': 'freeze_no', 'name': '冻结单号', 'width': 20},
        {'field': 'sku_id', 'name': 'SKU编码', 'width': 15},
        {'field': 'sku_name', 'name': 'SKU名称', 'width': 20},
        {'field': 'batch_no', 'name': '批次号', 'width': 20},
        {'field': 'warehouse_code', 'name': '仓库编码', 'width': 12},
        {'field': 'reason_code', 'name': '冻结原因编码', 'width': 15},
        {'field': 'reason_name', 'name': '冻结原因名称', 'width': 20},
        {'field': 'freeze_qty', 'name': '冻结数量', 'width': 12},
        {'field': 'freeze_operator', 'name': '冻结操作人', 'width': 12},
        {'field': 'freeze_time', 'name': '冻结时间', 'width': 20},
        {'field': 'status', 'name': '状态编码', 'width': 15},
        {'field': 'status_name', 'name': '状态名称', 'width': 15}
    ],
    'conflict': [
        {'field': 'conflict_no', 'name': '冲突编号', 'width': 20},
        {'field': 'conflict_type', 'name': '冲突类型编码', 'width': 20},
        {'field': 'conflict_type_name', 'name': '冲突类型名称', 'width': 25},
        {'field': 'sku_id', 'name': 'SKU编码', 'width': 15},
        {'field': 'sku_name', 'name': 'SKU名称', 'width': 20},
        {'field': 'batch_no', 'name': '批次号', 'width': 20},
        {'field': 'warehouse_code', 'name': '仓库编码', 'width': 12},
        {'field': 'related_order_no', 'name': '关联单号', 'width': 20},
        {'field': 'related_order_type', 'name': '关联单类型', 'width': 15},
        {'field': 'conflict_qty', 'name': '冲突数量', 'width': 12},
        {'field': 'quality_status', 'name': '质检状态编码', 'width': 15},
        {'field': 'quality_status_name', 'name': '质检状态名称', 'width': 15},
        {'field': 'conflict_detail', 'name': '冲突详情', 'width': 40},
        {'field': 'handle_result', 'name': '处理结果编码', 'width': 15},
        {'field': 'handle_result_name', 'name': '处理结果名称', 'width': 15},
        {'field': 'handler', 'name': '处理人', 'width': 12},
        {'field': 'handle_time', 'name': '处理时间', 'width': 20},
        {'field': 'handle_remark', 'name': '处理备注', 'width': 30},
        {'field': 'status', 'name': '状态', 'width': 10},
        {'field': 'created_at', 'name': '创建时间', 'width': 20}
    ],
    'import_error': [
        {'field': 'row_number', 'name': '行号', 'width': 8},
        {'field': 'sku_id', 'name': 'SKU编码', 'width': 15},
        {'field': 'batch_no', 'name': '批次号', 'width': 20},
        {'field': 'warehouse_code', 'name': '仓库编码', 'width': 12},
        {'field': 'error_field', 'name': '错误字段', 'width': 15},
        {'field': 'error_message', 'name': '错误信息', 'width': 40},
        {'field': 'original_value', 'name': '原始值', 'width': 20}
    ]
}

class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.inventory_service = InventoryService(db)
        self.export_dir = 'exports'
        os.makedirs(self.export_dir, exist_ok=True)
    
    def _generate_export_no(self) -> str:
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        return f'EXP{timestamp}'
    
    def export_freeze_records(self, operator: str, sku_id: str = None,
                             batch_no: str = None, status: str = None,
                             warehouse_code: str = None) -> Dict:
        export_no = self._generate_export_no()
        file_name = f'冻结记录导出_{export_no}.xlsx'
        file_path = os.path.join(self.export_dir, file_name)
        
        import_export_log = ImportExportLog(
            batch_no=export_no,
            operate_type='EXPORT',
            business_type='FREEZE',
            file_name=file_name,
            file_path=file_path,
            operator=operator,
            operate_time=datetime.now(),
            status='PROCESSING'
        )
        self.db.add(import_export_log)
        self.db.flush()
        
        try:
            data = self.inventory_service.get_freeze_list(
                sku_id=sku_id,
                batch_no=batch_no,
                status=status,
                warehouse_code=warehouse_code
            )
            
            if not data:
                import_export_log.status = 'COMPLETED'
                import_export_log.total_count = 0
                import_export_log.success_count = 0
                self.db.commit()
                return {
                    'success': True,
                    'message': '无数据可导出',
                    'export_no': export_no,
                    'file_path': None,
                    'count': 0
                }
            
            field_config = EXPORT_FIELDS['freeze']
            export_fields = [f['field'] for f in field_config]
            column_names = [f['name'] for f in field_config]
            
            df = pd.DataFrame(data)
            df_export = df[export_fields].copy()
            df_export.columns = column_names
            
            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                df_export.to_excel(writer, sheet_name='冻结记录', index=False)
                
                worksheet = writer.sheets['冻结记录']
                for idx, field in enumerate(field_config):
                    worksheet.column_dimensions[chr(65 + idx)].width = field['width']
            
            file_size = os.path.getsize(file_path)
            
            import_export_log.file_size = file_size
            import_export_log.total_count = len(data)
            import_export_log.success_count = len(data)
            import_export_log.status = 'COMPLETED'
            self.db.commit()
            
            return {
                'success': True,
                'message': '导出成功',
                'export_no': export_no,
                'file_name': file_name,
                'file_path': file_path,
                'count': len(data)
            }
            
        except Exception as e:
            import_export_log.status = 'FAILED'
            import_export_log.error_details = [{'error': str(e)}]
            self.db.commit()
            return {
                'success': False,
                'message': f'导出失败: {str(e)}',
                'export_no': export_no
            }
    
    def export_conflict_records(self, operator: str, status: str = None,
                               conflict_type: str = None, handle_result: str = None) -> Dict:
        export_no = self._generate_export_no()
        file_name = f'冲突记录导出_{export_no}.xlsx'
        file_path = os.path.join(self.export_dir, file_name)
        
        import_export_log = ImportExportLog(
            batch_no=export_no,
            operate_type='EXPORT',
            business_type='CONFLICT',
            file_name=file_name,
            file_path=file_path,
            operator=operator,
            operate_time=datetime.now(),
            status='PROCESSING'
        )
        self.db.add(import_export_log)
        self.db.flush()
        
        try:
            data = self.inventory_service.get_conflict_list(
                status=status,
                conflict_type=conflict_type,
                handle_result=handle_result
            )
            
            if not data:
                import_export_log.status = 'COMPLETED'
                import_export_log.total_count = 0
                import_export_log.success_count = 0
                self.db.commit()
                return {
                    'success': True,
                    'message': '无数据可导出',
                    'export_no': export_no,
                    'file_path': None,
                    'count': 0
                }
            
            field_config = EXPORT_FIELDS['conflict']
            export_fields = [f['field'] for f in field_config]
            column_names = [f['name'] for f in field_config]
            
            df = pd.DataFrame(data)
            
            for field in export_fields:
                if field not in df.columns:
                    df[field] = ''
            
            df_export = df[export_fields].copy()
            df_export.columns = column_names
            
            with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                df_export.to_excel(writer, sheet_name='冲突记录', index=False)
                
                worksheet = writer.sheets['冲突记录']
                for idx, field in enumerate(field_config):
                    worksheet.column_dimensions[chr(65 + idx)].width = field['width']
            
            file_size = os.path.getsize(file_path)
            
            import_export_log.file_size = file_size
            import_export_log.total_count = len(data)
            import_export_log.success_count = len(data)
            import_export_log.status = 'COMPLETED'
            self.db.commit()
            
            return {
                'success': True,
                'message': '导出成功',
                'export_no': export_no,
                'file_name': file_name,
                'file_path': file_path,
                'count': len(data)
            }
            
        except Exception as e:
            import_export_log.status = 'FAILED'
            import_export_log.error_details = [{'error': str(e)}]
            self.db.commit()
            return {
                'success': False,
                'message': f'导出失败: {str(e)}',
                'export_no': export_no
            }
    
    def import_freeze_records(self, file_path: str, operator: str) -> Dict:
        import_no = self._generate_export_no().replace('EXP', 'IMP')
        
        import_export_log = ImportExportLog(
            batch_no=import_no,
            operate_type='IMPORT',
            business_type='FREEZE',
            file_name=os.path.basename(file_path),
            file_path=file_path,
            operator=operator,
            operate_time=datetime.now(),
            status='PROCESSING'
        )
        self.db.add(import_export_log)
        self.db.flush()
        
        success_count = 0
        fail_count = 0
        error_details = []
        
        try:
            df = pd.read_excel(file_path)
            
            field_config = EXPORT_FIELDS['freeze']
            name_to_field = {f['name']: f['field'] for f in field_config}
            
            for idx, row in df.iterrows():
                row_number = idx + 2
                row_errors = []
                row_data = {}
                
                for col_name in df.columns:
                    if col_name in name_to_field:
                        field = name_to_field[col_name]
                        row_data[field] = row[col_name] if pd.notna(row[col_name]) else None
                
                required_fields = ['sku_id', 'batch_no', 'warehouse_code', 'reason_code', 'freeze_qty']
                for field in required_fields:
                    if field not in row_data or row_data[field] is None:
                        row_errors.append({
                            'row_number': row_number,
                            'error_field': field,
                            'error_message': f'{field} 不能为空',
                            'original_value': str(row_data.get(field, ''))
                        })
                
                if row_errors:
                    fail_count += 1
                    error_details.extend(row_errors)
                    continue
                
                try:
                    result = self.inventory_service.freeze_inventory(
                        sku_id=row_data['sku_id'],
                        batch_id=self._get_batch_id(row_data['sku_id'], row_data['batch_no'], row_data['warehouse_code']),
                        warehouse_code=row_data['warehouse_code'],
                        reason_code=row_data['reason_code'],
                        freeze_qty=float(row_data['freeze_qty']),
                        operator=operator,
                        freeze_remark=row_data.get('freeze_remark')
                    )
                    
                    if result['success']:
                        success_count += 1
                    else:
                        fail_count += 1
                        error_details.append({
                            'row_number': row_number,
                            'error_field': 'system',
                            'error_message': result['message'],
                            'original_value': ''
                        })
                        
                except Exception as e:
                    fail_count += 1
                    error_details.append({
                        'row_number': row_number,
                        'error_field': 'system',
                        'error_message': str(e),
                        'original_value': ''
                    })
            
            import_export_log.total_count = len(df)
            import_export_log.success_count = success_count
            import_export_log.fail_count = fail_count
            import_export_log.error_details = error_details
            import_export_log.status = 'COMPLETED'
            self.db.commit()
            
            if fail_count > 0:
                error_file_name = f'导入错误明细_{import_no}.xlsx'
                error_file_path = os.path.join(self.export_dir, error_file_name)
                self._export_error_details(error_details, error_file_path)
            else:
                error_file_path = None
            
            return {
                'success': True,
                'message': f'导入完成，成功 {success_count} 条，失败 {fail_count} 条',
                'import_no': import_no,
                'total_count': len(df),
                'success_count': success_count,
                'fail_count': fail_count,
                'error_file_path': error_file_path
            }
            
        except Exception as e:
            import_export_log.status = 'FAILED'
            import_export_log.error_details = [{'error': str(e)}]
            self.db.commit()
            return {
                'success': False,
                'message': f'导入失败: {str(e)}',
                'import_no': import_no
            }
    
    def _get_batch_id(self, sku_id: str, batch_no: str, warehouse_code: str) -> str:
        from models import BatchInventory
        batch = self.db.query(BatchInventory).filter(
            BatchInventory.sku_id == sku_id,
            BatchInventory.batch_no == batch_no,
            BatchInventory.warehouse_code == warehouse_code
        ).first()
        return batch.batch_id if batch else None
    
    def _export_error_details(self, error_details: List[Dict], file_path: str):
        if not error_details:
            return
        
        field_config = EXPORT_FIELDS['import_error']
        export_fields = [f['field'] for f in field_config]
        column_names = [f['name'] for f in field_config]
        
        df = pd.DataFrame(error_details)
        
        for field in export_fields:
            if field not in df.columns:
                df[field] = ''
        
        df_export = df[export_fields].copy()
        df_export.columns = column_names
        
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df_export.to_excel(writer, sheet_name='错误明细', index=False)
            
            worksheet = writer.sheets['错误明细']
            for idx, field in enumerate(field_config):
                worksheet.column_dimensions[chr(65 + idx)].width = field['width']
