import csv
import yaml
import re
from datetime import datetime
from dateutil import parser as date_parser
from .database import (
    insert_raw_record, insert_cleaned_record, insert_lineage, 
    insert_conflict, get_latest_rules_version, get_all_cleaned_records
)

class CleaningEngine:
    def __init__(self):
        self.rules = None
        self.rules_version = 0
        self.conflicts = []
    
    def load_rules(self, rules_content, version):
        self.rules = yaml.safe_load(rules_content)
        self.rules_version = version
    
    def clean_csv(self, csv_content, file_id):
        cleaned_records = []
        lines = csv_content.strip().split('\n')
        reader = csv.DictReader(lines)
        
        customer_records = {}
        date_ambiguities = []
        
        for line_number, row in enumerate(reader, start=2):
            raw_data = ','.join([f'"{v}"' for v in row.values()])
            raw_record_id = insert_raw_record(file_id, line_number, raw_data)
            
            cleaned_row = {}
            lineage_info = {}
            
            customer_id = self._clean_customer_id(row.get('customer_id', ''), lineage_info)
            cleaned_row['customer_id'] = customer_id
            
            order_date = self._clean_date(row.get('order_date', ''), lineage_info, line_number)
            cleaned_row['order_date'] = order_date
            
            order_amount = self._clean_amount(row.get('order_amount', ''), lineage_info)
            cleaned_row['order_amount'] = order_amount
            
            status = self._clean_status(row.get('status', ''), lineage_info)
            cleaned_row['status'] = status
            
            cleaned_record_id = insert_cleaned_record(
                raw_record_id,
                customer_id,
                order_date,
                order_amount,
                status,
                self.rules_version
            )
            
            for column, info in lineage_info.items():
                insert_lineage(
                    cleaned_record_id,
                    column,
                    info['original'],
                    info['cleaned'],
                    info['rule'],
                    self.rules_version
                )
            
            cleaned_records.append({
                'id': cleaned_record_id,
                **cleaned_row,
                'line_number': line_number
            })
            
            if customer_id:
                if customer_id not in customer_records:
                    customer_records[customer_id] = []
                customer_records[customer_id].append({
                    'record_id': cleaned_record_id,
                    'line_number': line_number,
                    'data': cleaned_row
                })
        
        self._detect_customer_conflicts(customer_records)
        self._detect_date_ambiguities(date_ambiguities)
        
        return cleaned_records
    
    def _clean_customer_id(self, value, lineage_info):
        original_value = value
        rule_applied = None
        
        if self.rules and 'customer_id' in self.rules.get('rules', {}):
            rules = self.rules['rules']['customer_id']
            
            if 'trim' in rules and rules['trim']:
                value = value.strip()
                rule_applied = 'trim_whitespace'
            
            if 'uppercase' in rules and rules['uppercase']:
                value = value.upper()
                rule_applied = 'to_uppercase'
            
            if 'pattern' in rules:
                pattern = rules['pattern']
                match = re.search(pattern, value)
                if match:
                    value = match.group(0)
                    rule_applied = f'extract_pattern:{pattern}'
            
            if 'default' in rules and not value:
                value = rules['default']
                rule_applied = f'use_default:{value}'
        
        lineage_info['customer_id'] = {
            'original': original_value,
            'cleaned': value,
            'rule': rule_applied
        }
        
        return value if value else None
    
    def _clean_date(self, value, lineage_info, line_number):
        original_value = value
        rule_applied = None
        cleaned_value = None
        
        if not value or value.strip() == '':
            if self.rules and 'order_date' in self.rules.get('rules', {}):
                rules = self.rules['rules']['order_date']
                if 'default' in rules:
                    cleaned_value = rules['default']
                    rule_applied = f'use_default:{cleaned_value}'
            
            lineage_info['order_date'] = {
                'original': original_value,
                'cleaned': cleaned_value,
                'rule': rule_applied
            }
            return cleaned_value
        
        value = value.strip()
        
        if self.rules and 'order_date' in self.rules.get('rules', {}):
            rules = self.rules['rules']['order_date']
            
            if 'formats' in rules:
                for fmt in rules['formats']:
                    try:
                        parsed_date = datetime.strptime(value, fmt)
                        cleaned_value = parsed_date.strftime('%Y-%m-%d')
                        rule_applied = f'parse_format:{fmt}'
                        break
                    except ValueError:
                        continue
            
            if not cleaned_value and 'auto_parse' in rules and rules['auto_parse']:
                try:
                    parsed_date = date_parser.parse(value, fuzzy=True)
                    cleaned_value = parsed_date.strftime('%Y-%m-%d')
                    rule_applied = 'auto_parse_date'
                except:
                    pass
        
        if not cleaned_value:
            try:
                parsed_date = date_parser.parse(value, fuzzy=True)
                cleaned_value = parsed_date.strftime('%Y-%m-%d')
                rule_applied = 'fallback_auto_parse'
            except:
                cleaned_value = None
                rule_applied = 'parse_failed'
        
        lineage_info['order_date'] = {
            'original': original_value,
            'cleaned': cleaned_value,
            'rule': rule_applied
        }
        
        return cleaned_value
    
    def _clean_amount(self, value, lineage_info):
        original_value = value
        rule_applied = None
        cleaned_value = None
        
        if not value or value.strip() == '':
            if self.rules and 'order_amount' in self.rules.get('rules', {}):
                rules = self.rules['rules']['order_amount']
                if 'default' in rules:
                    cleaned_value = float(rules['default'])
                    rule_applied = f'use_default:{cleaned_value}'
            
            lineage_info['order_amount'] = {
                'original': original_value,
                'cleaned': str(cleaned_value) if cleaned_value else None,
                'rule': rule_applied
            }
            return cleaned_value
        
        value = value.strip()
        
        if self.rules and 'order_amount' in self.rules.get('rules', {}):
            rules = self.rules['rules']['order_amount']
            
            if 'remove_currency' in rules and rules['remove_currency']:
                value = re.sub(r'[\$€£¥]', '', value)
                rule_applied = 'remove_currency_symbols'
            
            if 'remove_commas' in rules and rules['remove_commas']:
                value = value.replace(',', '')
                rule_applied = 'remove_thousands_separators'
        
        try:
            cleaned_value = float(value)
            if rule_applied is None:
                rule_applied = 'direct_float_parse'
        except ValueError:
            cleaned_value = None
            rule_applied = 'parse_failed'
        
        lineage_info['order_amount'] = {
            'original': original_value,
            'cleaned': str(cleaned_value) if cleaned_value is not None else None,
            'rule': rule_applied
        }
        
        return cleaned_value
    
    def _clean_status(self, value, lineage_info):
        original_value = value
        rule_applied = None
        cleaned_value = value.strip() if value else None
        
        if self.rules and 'status' in self.rules.get('rules', {}):
            rules = self.rules['rules']['status']
            
            if 'mapping' in rules:
                mapping = rules['mapping']
                lower_value = cleaned_value.lower() if cleaned_value else ''
                for key, mapped_value in mapping.items():
                    if lower_value == key.lower():
                        cleaned_value = mapped_value
                        rule_applied = f'status_mapping:{key}->{mapped_value}'
                        break
            
            if 'default' in rules and (not cleaned_value or cleaned_value == ''):
                cleaned_value = rules['default']
                rule_applied = f'use_default:{cleaned_value}'
        
        lineage_info['status'] = {
            'original': original_value,
            'cleaned': cleaned_value,
            'rule': rule_applied
        }
        
        return cleaned_value
    
    def _detect_customer_conflicts(self, customer_records):
        for customer_id, records in customer_records.items():
            if len(records) > 1:
                fields_to_check = ['order_date', 'order_amount', 'status']
                
                for i in range(len(records)):
                    for j in range(i + 1, len(records)):
                        rec1 = records[i]
                        rec2 = records[j]
                        
                        for field in fields_to_check:
                            val1 = rec1['data'][field]
                            val2 = rec2['data'][field]
                            
                            if val1 != val2 and val1 is not None and val2 is not None:
                                insert_conflict(
                                    'customer_id_conflict',
                                    customer_id,
                                    field,
                                    str(val1),
                                    str(val2),
                                    rec1['line_number'],
                                    rec2['line_number']
                                )
    
    def _detect_date_ambiguities(self, date_ambiguities):
        pass
