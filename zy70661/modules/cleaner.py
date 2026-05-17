import re
from typing import Dict, List, Any


class DataCleaner:
    def __init__(self, phone_col: str):
        self.phone_col = phone_col

    def normalize_phone(self, phone: str) -> str:
        if not phone:
            return ''
        phone_str = str(phone).strip()
        phone_str = re.sub(r'[\s\-\(\)\+]', '', phone_str)
        if phone_str.startswith('86'):
            phone_str = phone_str[2:]
        if phone_str.startswith('0') and len(phone_str) > 11:
            phone_str = phone_str[1:]
        if len(phone_str) == 11 and phone_str.isdigit():
            return phone_str
        return phone_str

    def clean_visit(self, visit_data: List[Dict]) -> List[Dict]:
        cleaned = []
        for row in visit_data:
            normalized_phone = self.normalize_phone(row.get(self.phone_col, ''))
            row['_normalized_phone'] = normalized_phone
            cleaned.append(row)
        cleaned.sort(key=lambda x: (x['_normalized_phone'], x['_source_row']))
        return cleaned

    def clean_channel(self, channel_data: List[Dict]) -> List[Dict]:
        cleaned = []
        for row in channel_data:
            normalized_phone = self.normalize_phone(row.get(self.phone_col, ''))
            row['_normalized_phone'] = normalized_phone
            cleaned.append(row)
        cleaned.sort(key=lambda x: (x['_normalized_phone'], x['_source_row']))
        return cleaned
