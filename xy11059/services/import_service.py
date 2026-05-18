import pandas as pd
from datetime import datetime
from models import db, ReplaceRecord
from sqlalchemy import exists

class ImportService:
    REQUIRED_FIELDS = [
        '换件单号', '客户姓名', '客户电话', '门锁型号', '门锁序列号',
        '故障类型', '新配件编码', '新配件名称', '状态'
    ]
    
    STATUS_FLOW = ['待审核', '配件出库', '工程师上门', '换件完成', '旧件回收', '售后闭环']
    
    def process_import(self, file, allow_manual_override=False, manual_notes=''):
        df = self._read_file(file)
        if df is None:
            return {'success': False, 'error': '文件格式不支持，请使用Excel或CSV'}
        
        success_count = 0
        bad_rows = []
        warning_rows = []
        
        for idx, row in df.iterrows():
            row_num = idx + 2
            result = self._validate_and_process_row(row, row_num, allow_manual_override, manual_notes)
            
            if result['type'] == 'success':
                success_count += 1
            elif result['type'] == 'bad':
                bad_rows.append(result['data'])
            elif result['type'] == 'warning':
                warning_rows.append(result['data'])
                success_count += 1
        
        db.session.commit()
        
        return {
            'success': True,
            'summary': {
                'total': len(df),
                'success': success_count,
                'bad_rows': len(bad_rows),
                'warnings': len(warning_rows)
            },
            'bad_rows': bad_rows,
            'warning_rows': warning_rows
        }
    
    def _read_file(self, file):
        try:
            if file.filename.endswith('.xlsx'):
                return pd.read_excel(file)
            elif file.filename.endswith('.csv'):
                return pd.read_csv(file)
            return None
        except Exception:
            return None
    
    def _validate_and_process_row(self, row, row_num, allow_manual_override, manual_notes):
        row_dict = row.to_dict()
        
        missing_fields = self._check_missing_fields(row_dict)
        if missing_fields:
            return {
                'type': 'bad',
                'data': {
                    'row': row_num,
                    'original_data': self._sanitize_for_json(row_dict),
                    'error': f'缺少必填字段: {", ".join(missing_fields)}',
                    'suggestion': '请补充必填字段后重新导入'
                }
            }
        
        record_id = str(row_dict.get('换件单号', '')).strip()
        
        if self._is_duplicate(record_id):
            return {
                'type': 'bad',
                'data': {
                    'row': row_num,
                    'original_data': self._sanitize_for_json(row_dict),
                    'error': f'换件单号 {record_id} 已存在，重复提交',
                    'suggestion': '如需更新，请先删除原有记录或使用更新接口'
                }
            }
        
        status = str(row_dict.get('状态', '')).strip()
        status_validation = self._validate_status_flow(status, row_dict)
        if status_validation:
            if allow_manual_override:
                pass
            else:
                return {
                    'type': 'bad',
                    'data': {
                        'row': row_num,
                        'original_data': self._sanitize_for_json(row_dict),
                        'error': status_validation['error'],
                        'suggestion': status_validation['suggestion'] + '，或开启人工覆盖模式'
                    }
                }
        
        old_part_check = self._check_old_part_recycle(row_dict, status)
        if old_part_check:
            if allow_manual_override:
                pass
            else:
                return {
                    'type': 'bad',
                    'data': {
                        'row': row_num,
                        'original_data': self._sanitize_for_json(row_dict),
                        'error': old_part_check['error'],
                        'suggestion': old_part_check['suggestion'] + '，或开启人工覆盖模式'
                    }
                }
        
        consistency_check = self._check_consistency(row_dict)
        if consistency_check:
            if allow_manual_override:
                pass
            else:
                return {
                    'type': 'bad',
                    'data': {
                        'row': row_num,
                        'original_data': self._sanitize_for_json(row_dict),
                        'error': consistency_check['error'],
                        'suggestion': consistency_check['suggestion'] + '，或开启人工覆盖模式'
                    }
                }
        
        try:
            record = self._create_record(row_dict)
            if allow_manual_override:
                record.has_manual_override = True
                record.manual_notes = manual_notes
            db.session.add(record)
            
            warnings = []
            if status_validation:
                warnings.append(status_validation['error'])
            if old_part_check:
                warnings.append(old_part_check['error'])
            if consistency_check:
                warnings.append(consistency_check['error'])
            
            if warnings:
                return {
                    'type': 'warning',
                    'data': {
                        'row': row_num,
                        'record_id': record_id,
                        'warnings': warnings,
                        'note': '已通过人工覆盖模式导入'
                    }
                }
            
            return {'type': 'success'}
        except Exception as e:
            return {
                'type': 'bad',
                'data': {
                    'row': row_num,
                    'original_data': self._sanitize_for_json(row_dict),
                    'error': f'数据保存失败: {str(e)}',
                    'suggestion': '请检查数据格式是否正确'
                }
            }
    
    def _check_missing_fields(self, row_dict):
        missing = []
        for field in self.REQUIRED_FIELDS:
            value = row_dict.get(field)
            if pd.isna(value) or str(value).strip() == '':
                missing.append(field)
        return missing
    
    def _is_duplicate(self, record_id):
        return db.session.query(exists().where(ReplaceRecord.record_id == record_id)).scalar()
    
    def _validate_status_flow(self, status, row_dict):
        if status not in self.STATUS_FLOW:
            return {
                'error': f'状态 "{status}" 不是有效状态',
                'suggestion': f'有效状态为: {", ".join(self.STATUS_FLOW)}'
            }
        
        current_idx = self.STATUS_FLOW.index(status)
        
        if status in ['换件完成', '旧件回收', '售后闭环']:
            if pd.isna(row_dict.get('上门工程师姓名')) or pd.isna(row_dict.get('上门服务日期')):
                return {
                    'error': f'状态为"{status}"但缺少工程师上门信息',
                    'suggestion': '请补充工程师姓名和服务日期'
                }
        
        if status == '售后闭环' and not row_dict.get('旧配件是否回收'):
            return {
                'error': '售后闭环但旧配件未回收，流程不一致',
                'suggestion': '请先完成旧配件回收后再闭环'
            }
        
        return None
    
    def _check_old_part_recycle(self, row_dict, status):
        old_part_recycled = row_dict.get('旧配件是否回收', False)
        if isinstance(old_part_recycled, str):
            old_part_recycled = old_part_recycled.lower() in ['true', '是', 'yes', '1']
        
        if not old_part_recycled and status in ['旧件回收', '售后闭环']:
            return {
                'error': f'旧配件未回收却设置状态为"{status}"',
                'suggestion': '请先标记旧配件已回收，或调整状态'
            }
        
        old_part_code = row_dict.get('旧配件编码', '')
        if pd.notna(old_part_code) and str(old_part_code).strip() and not old_part_recycled:
            if status in ['换件完成', '旧件回收', '售后闭环']:
                return {
                    'error': '有旧配件编码但未标记回收',
                    'suggestion': '请确认旧配件回收状态'
                }
        
        return None
    
    def _check_consistency(self, row_dict):
        new_ship_date = row_dict.get('新配件发货日期')
        service_date = row_dict.get('上门服务日期')
        
        if pd.notna(new_ship_date) and pd.notna(service_date):
            try:
                if isinstance(new_ship_date, str):
                    new_ship_date = datetime.strptime(new_ship_date, '%Y-%m-%d')
                if isinstance(service_date, str):
                    service_date = datetime.strptime(service_date, '%Y-%m-%d')
                
                if service_date < new_ship_date:
                    return {
                        'error': '上门服务日期早于新配件发货日期',
                        'suggestion': '请核对日期逻辑'
                    }
            except:
                pass
        
        warranty = row_dict.get('保修状态', '')
        purchase_date = row_dict.get('购买日期', '')
        if warranty and pd.notna(purchase_date):
            pass
        
        return None
    
    def _create_record(self, row_dict):
        def parse_date(value):
            if pd.isna(value):
                return None
            if isinstance(value, datetime):
                return value.date()
            try:
                return datetime.strptime(str(value), '%Y-%m-%d').date()
            except:
                return None
        
        def parse_bool(value):
            if pd.isna(value):
                return False
            if isinstance(value, bool):
                return value
            return str(value).lower() in ['true', '是', 'yes', '1']
        
        return ReplaceRecord(
            record_id=str(row_dict.get('换件单号', '')).strip(),
            customer_name=str(row_dict.get('客户姓名', '')).strip(),
            customer_phone=str(row_dict.get('客户电话', '')).strip(),
            customer_address=str(row_dict.get('客户地址', '')).strip() if pd.notna(row_dict.get('客户地址')) else None,
            lock_model=str(row_dict.get('门锁型号', '')).strip(),
            lock_sn=str(row_dict.get('门锁序列号', '')).strip(),
            purchase_date=parse_date(row_dict.get('购买日期')),
            warranty_status=str(row_dict.get('保修状态', '')).strip() if pd.notna(row_dict.get('保修状态')) else None,
            fault_type=str(row_dict.get('故障类型', '')).strip(),
            fault_description=str(row_dict.get('故障描述', '')).strip() if pd.notna(row_dict.get('故障描述')) else None,
            old_part_code=str(row_dict.get('旧配件编码', '')).strip() if pd.notna(row_dict.get('旧配件编码')) else None,
            old_part_name=str(row_dict.get('旧配件名称', '')).strip() if pd.notna(row_dict.get('旧配件名称')) else None,
            old_part_recycled=parse_bool(row_dict.get('旧配件是否回收')),
            old_part_recycle_date=parse_date(row_dict.get('旧配件回收日期')),
            new_part_code=str(row_dict.get('新配件编码', '')).strip(),
            new_part_name=str(row_dict.get('新配件名称', '')).strip(),
            new_part_warehouse=str(row_dict.get('新配件出库仓库', '')).strip() if pd.notna(row_dict.get('新配件出库仓库')) else None,
            new_part_ship_date=parse_date(row_dict.get('新配件发货日期')),
            technician_name=str(row_dict.get('上门工程师姓名', '')).strip() if pd.notna(row_dict.get('上门工程师姓名')) else None,
            technician_phone=str(row_dict.get('上门工程师电话', '')).strip() if pd.notna(row_dict.get('上门工程师电话')) else None,
            service_date=parse_date(row_dict.get('上门服务日期')),
            status=str(row_dict.get('状态', '')).strip()
        )
    
    def _sanitize_for_json(self, data):
        result = {}
        for k, v in data.items():
            if pd.isna(v):
                result[k] = None
            elif isinstance(v, (datetime, pd.Timestamp)):
                result[k] = v.strftime('%Y-%m-%d')
            else:
                result[k] = str(v)
        return result
