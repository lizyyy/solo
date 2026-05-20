import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
import markdown
from io import StringIO

class CSVParser:
    @staticmethod
    def parse_inventory(file_content: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(StringIO(file_content))
        df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns]
        
        inventory_items = []
        for _, row in df.iterrows():
            item = {
                'batch_number': str(row.get('batch_number', row.get('批号', ''))).strip(),
                'material_name': str(row.get('material_name', row.get('材料名称', ''))).strip(),
                'material_type': str(row.get('material_type', row.get('材料类型', row.get('品类', '')))).strip(),
                'spec': str(row.get('spec', row.get('规格', ''))).strip(),
                'quantity': float(row.get('quantity', row.get('数量', 0))),
                'unit': str(row.get('unit', row.get('单位', ''))).strip(),
                'supplier': str(row.get('supplier', row.get('供应商', ''))).strip(),
                'store_id': str(row.get('store_id', row.get('门店ID', row.get('门店编号', '')))).strip(),
                'store_name': str(row.get('store_name', row.get('门店名称', ''))).strip(),
            }
            
            expiry_date = row.get('expiry_date', row.get('有效期', row.get('过期日期')))
            if pd.notna(expiry_date):
                try:
                    item['expiry_date'] = pd.to_datetime(expiry_date).to_pydatetime()
                except:
                    pass
            
            production_date = row.get('production_date', row.get('生产日期'))
            if pd.notna(production_date):
                try:
                    item['production_date'] = pd.to_datetime(production_date).to_pydatetime()
                except:
                    pass
            
            if pd.notna(row.get('is_replacement')):
                item['is_replacement'] = bool(row['is_replacement'])
            if pd.notna(row.get('replaced_batch')):
                item['replaced_batch'] = str(row['replaced_batch']).strip()
            if pd.notna(row.get('original_source')):
                item['original_source'] = str(row['original_source']).strip()
            
            inventory_items.append(item)
        
        return inventory_items

    @staticmethod
    def parse_consumption(file_content: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(StringIO(file_content))
        df.columns = [col.strip().lower().replace(' ', '_') for col in df.columns]
        
        consumption_items = []
        for _, row in df.iterrows():
            item = {
                'store_id': str(row.get('store_id', row.get('门店ID', ''))).strip(),
                'store_name': str(row.get('store_name', row.get('门店名称', ''))).strip(),
                'batch_number': str(row.get('batch_number', row.get('批号', ''))).strip(),
                'material_name': str(row.get('material_name', row.get('材料名称', ''))).strip(),
                'quantity': float(row.get('quantity', row.get('消耗数量', 0))),
                'unit': str(row.get('unit', row.get('单位', ''))).strip(),
            }
            
            consumption_date = row.get('consumption_date', row.get('消耗日期'))
            if pd.notna(consumption_date):
                try:
                    item['consumption_date'] = pd.to_datetime(consumption_date).to_pydatetime()
                except:
                    item['consumption_date'] = datetime.now()
            
            if pd.notna(row.get('patient_id')):
                item['patient_id'] = str(row['patient_id']).strip()
            if pd.notna(row.get('dentist')):
                item['dentist'] = str(row['dentist']).strip()
            if pd.notna(row.get('notes')):
                item['notes'] = str(row['notes']).strip()
            
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
