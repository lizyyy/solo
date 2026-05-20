import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
import markdown
from io import StringIO

class CSVParser:
    @staticmethod
    def _normalize_header(col: str) -> str:
        return col.strip().lower().replace(' ', '_')
    
    @staticmethod
    def _get_row_value(row: pd.Series, *keys: str) -> Any:
        for key in keys:
            normalized_key = CSVParser._normalize_header(key)
            if normalized_key in row.index and pd.notna(row[normalized_key]):
                return row[normalized_key]
        return None
    
    @staticmethod
    def parse_inventory(file_content: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(StringIO(file_content))
        df.columns = [CSVParser._normalize_header(col) for col in df.columns]
        
        inventory_items = []
        for _, row in df.iterrows():
            item = {
                'batch_number': str(CSVParser._get_row_value(row, 'batch_number', '批号') or '').strip(),
                'material_name': str(CSVParser._get_row_value(row, 'material_name', '材料名称') or '').strip(),
                'material_type': str(CSVParser._get_row_value(row, 'material_type', '材料类型', '品类') or '').strip(),
                'spec': str(CSVParser._get_row_value(row, 'spec', '规格') or '').strip(),
                'quantity': float(CSVParser._get_row_value(row, 'quantity', '数量') or 0),
                'unit': str(CSVParser._get_row_value(row, 'unit', '单位') or '').strip(),
                'supplier': str(CSVParser._get_row_value(row, 'supplier', '供应商') or '').strip(),
                'store_id': str(CSVParser._get_row_value(row, 'store_id', '门店ID', '门店编号', '门店id') or '').strip(),
                'store_name': str(CSVParser._get_row_value(row, 'store_name', '门店名称') or '').strip(),
            }
            
            expiry_date = CSVParser._get_row_value(row, 'expiry_date', '有效期', '过期日期')
            if pd.notna(expiry_date):
                try:
                    item['expiry_date'] = pd.to_datetime(expiry_date).to_pydatetime()
                except:
                    pass
            
            production_date = CSVParser._get_row_value(row, 'production_date', '生产日期')
            if pd.notna(production_date):
                try:
                    item['production_date'] = pd.to_datetime(production_date).to_pydatetime()
                except:
                    pass
            
            is_replacement = CSVParser._get_row_value(row, 'is_replacement')
            if pd.notna(is_replacement):
                item['is_replacement'] = bool(is_replacement)
            
            replaced_batch = CSVParser._get_row_value(row, 'replaced_batch', '被替代批号', '替换批号')
            if pd.notna(replaced_batch) and str(replaced_batch).strip():
                item['replaced_batch'] = str(replaced_batch).strip()
            
            original_source = CSVParser._get_row_value(row, 'original_source', '原始来源', '来源说明')
            if pd.notna(original_source) and str(original_source).strip():
                item['original_source'] = str(original_source).strip()
            
            inventory_items.append(item)
        
        return inventory_items

    @staticmethod
    def parse_consumption(file_content: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(StringIO(file_content))
        df.columns = [CSVParser._normalize_header(col) for col in df.columns]
        
        consumption_items = []
        for _, row in df.iterrows():
            item = {
                'store_id': str(CSVParser._get_row_value(row, 'store_id', '门店ID', '门店id') or '').strip(),
                'store_name': str(CSVParser._get_row_value(row, 'store_name', '门店名称') or '').strip(),
                'batch_number': str(CSVParser._get_row_value(row, 'batch_number', '批号') or '').strip(),
                'material_name': str(CSVParser._get_row_value(row, 'material_name', '材料名称') or '').strip(),
                'quantity': float(CSVParser._get_row_value(row, 'quantity', '消耗数量', '数量') or 0),
                'unit': str(CSVParser._get_row_value(row, 'unit', '单位') or '').strip(),
            }
            
            consumption_date = CSVParser._get_row_value(row, 'consumption_date', '消耗日期')
            if pd.notna(consumption_date):
                try:
                    item['consumption_date'] = pd.to_datetime(consumption_date).to_pydatetime()
                except:
                    item['consumption_date'] = datetime.now()
            else:
                item['consumption_date'] = datetime.now()
            
            patient_id = CSVParser._get_row_value(row, 'patient_id', '患者ID', '患者id')
            if pd.notna(patient_id) and str(patient_id).strip():
                item['patient_id'] = str(patient_id).strip()
            
            dentist = CSVParser._get_row_value(row, 'dentist', '牙医', '医生')
            if pd.notna(dentist) and str(dentist).strip():
                item['dentist'] = str(dentist).strip()
            
            notes = CSVParser._get_row_value(row, 'notes', '备注', '说明')
            if pd.notna(notes) and str(notes).strip():
                item['notes'] = str(notes).strip()
            
            consumption_items.append(item)
        
        return consumption_items

class MarkdownRecallParser:
    @staticmethod
    def parse(markdown_content: str) -> Dict[str, Any]:
        lines = markdown_content.split('\n')
        result = {
            'title': '',
            'notice_date': None,
            'issuer': '',
            'affected_material': '',
            'affected_batches': [],
            'reason': '',
            'level': '一般'
        }
        
        current_section = ''
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('# '):
                result['title'] = line[2:].strip()
            elif line.startswith('## '):
                section = line[3:].strip()
                if '日期' in section or '发布时间' in section:
                    current_section = 'date'
                elif '发布' in section or '机构' in section:
                    current_section = 'issuer'
                elif '涉及产品' in section or '召回产品' in section:
                    current_section = 'material'
                elif '批号' in section or '批次' in section:
                    current_section = 'batches'
                elif '原因' in section or '理由' in section:
                    current_section = 'reason'
                elif '级别' in section or '等级' in section:
                    current_section = 'level'
            else:
                if current_section == 'date':
                    try:
                        date_str = line.replace('*', '').replace('-', '').strip()
                        result['notice_date'] = pd.to_datetime(date_str).to_pydatetime()
                    except:
                        pass
                elif current_section == 'issuer':
                    result['issuer'] = line.replace('*', '').strip()
                elif current_section == 'material':
                    result['affected_material'] = line.replace('*', '').strip()
                elif current_section == 'batches':
                    batch_line = line.replace('*', '').strip()
                    batches = [b.strip() for b in batch_line.replace(',', ' ').replace('、', ' ').split() if b.strip()]
                    result['affected_batches'].extend(batches)
                elif current_section == 'reason':
                    result['reason'] += ' ' + line.replace('*', '').strip()
                elif current_section == 'level':
                    result['level'] = line.replace('*', '').strip()
        
        result['reason'] = result['reason'].strip()
        result['affected_batches'] = ','.join(result['affected_batches'])
        
        if not result['notice_date']:
            result['notice_date'] = datetime.now()
        
        return result
