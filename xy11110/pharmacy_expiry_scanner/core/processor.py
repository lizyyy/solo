from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import logging


class DataProcessor:
    def __init__(self, date_parser, expiry_rules: Dict, processing_config: Dict):
        self.date_parser = date_parser
        self.expiry_rules = expiry_rules
        self.processing_config = processing_config
        self.logger = logging.getLogger("pharmacy_scanner")
        self.warnings = []
    
    def process(self, records: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        processed_records = []
        failed_records = []
        
        for record in records:
            try:
                processed = self._process_single_record(record)
                if processed:
                    processed_records.append(processed)
            except Exception as e:
                failed_records.append({
                    **record,
                    'error': str(e)
                })
                self.warnings.append(f"处理记录失败: {str(e)} (行 {record.get('row_number', '?')})")
        
        if self.processing_config.get('handle_same_batch_diff_location', True):
            processed_records = self._handle_same_batch_diff_locations(processed_records)
        
        if self.processing_config.get('deduplicate', True):
            processed_records = self._deduplicate(processed_records)
        
        return processed_records, failed_records
    
    def _process_single_record(self, record: Dict) -> Optional[Dict]:
        drug_name = record.get('drug_name', '未知药品')
        batch_number = record.get('batch_number', '')
        
        if not drug_name or drug_name == '未知药品':
            self.warnings.append(f"缺少药品名称 (行 {record.get('row_number', '?')})")
        
        expiry_date_str = record.get('expiry_date', '')
        expiry_date, parse_error = self.date_parser.parse(expiry_date_str)
        
        if parse_error:
            self.warnings.append(f"{drug_name} ({batch_number}): {parse_error}")
        
        result = {
            'drug_name': drug_name,
            'batch_number': batch_number,
            'specification': record.get('specification', ''),
            'manufacturer': record.get('manufacturer', ''),
            'quantity': self._parse_quantity(record.get('quantity', '')),
            'location': record.get('location', ''),
            'expiry_date_str': expiry_date_str,
            'expiry_date': expiry_date.strftime('%Y-%m-%d') if expiry_date else '',
            'manufacture_date_str': record.get('manufacture_date', ''),
            'source_file': record.get('source_file', ''),
            'row_number': record.get('row_number', ''),
            'parse_notes': parse_error if parse_error else '',
            'processing_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        if expiry_date:
            days_remaining, expiry_status = self._calculate_expiry_status(expiry_date)
            result['days_remaining'] = days_remaining
            result['expiry_status'] = expiry_status
        else:
            result['days_remaining'] = None
            result['expiry_status'] = '日期解析失败'
        
        return result
    
    def _parse_quantity(self, qty_str: str) -> int:
        if not qty_str:
            return 0
        try:
            return int(float(qty_str))
        except:
            return 0
    
    def _calculate_expiry_status(self, expiry_date: datetime) -> Tuple[int, str]:
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        days_remaining = (expiry_date - today).days
        
        if days_remaining < 0:
            status = self.expiry_rules.get('expired_label', '已过期')
        elif days_remaining <= self.expiry_rules.get('critical_days', 30):
            status = self.expiry_rules.get('critical_label', '临期预警')
        elif days_remaining <= self.expiry_rules.get('warning_days', 90):
            status = self.expiry_rules.get('warning_label', '效期提醒')
        else:
            status = self.expiry_rules.get('normal_label', '效期正常')
        
        return days_remaining, status
    
    def _handle_same_batch_diff_locations(self, records: List[Dict]) -> List[Dict]:
        batch_groups = defaultdict(list)
        
        for record in records:
            key = (record['drug_name'], record['batch_number'])
            batch_groups[key].append(record)
        
        for (drug_name, batch_number), group_records in batch_groups.items():
            if len(group_records) > 1:
                locations = [r.get('location', '未知') for r in group_records]
                note = f"同批次分布在 {len(group_records)} 个货位: {', '.join(locations)}"
                self.warnings.append(f"{drug_name} ({batch_number}): {note}")
                
                for record in group_records:
                    if 'batch_notes' not in record:
                        record['batch_notes'] = []
                    record['batch_notes'].append(note)
        
        return records
    
    def _deduplicate(self, records: List[Dict]) -> List[Dict]:
        seen = set()
        unique_records = []
        
        for record in records:
            key = (
                record['drug_name'],
                record['batch_number'],
                record['location'],
                record['expiry_date']
            )
            
            if key not in seen:
                seen.add(key)
                unique_records.append(record)
            else:
                self.warnings.append(
                    f"重复记录已跳过: {record['drug_name']} ({record['batch_number']}) @ {record['location']}"
                )
        
        return unique_records
    
    def get_warnings(self) -> List[str]:
        return self.warnings
