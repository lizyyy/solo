import pandas as pd
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime


class DataParser:
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        self._ensure_directory()

    def _ensure_directory(self):
        os.makedirs(self.upload_dir, exist_ok=True)

    def parse_complaints_csv(self, file_path: str) -> List[Dict[str, Any]]:
        df = pd.read_csv(file_path, encoding='utf-8')
        df = df.fillna('')
        
        expected_columns = ['投诉编号', '来电时间', '居民姓名', '联系电话', 
                           '所属街道', '投诉摘要', '紧急程度']
        
        missing_cols = [col for col in expected_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"CSV文件缺少必要列: {missing_cols}")

        complaints = []
        for _, row in df.iterrows():
            complaint = {
                'id': str(row.get('投诉编号', '')),
                'call_time': self._parse_datetime(row.get('来电时间', '')),
                'resident_name': str(row.get('居民姓名', '')),
                'phone': str(row.get('联系电话', '')),
                'district': str(row.get('所属街道', '')),
                'summary': str(row.get('投诉摘要', '')),
                'urgency': str(row.get('紧急程度', '普通')),
                'source_type': 'complaint',
                'status': 'pending'
            }
            complaints.append(complaint)

        return complaints

    def parse_work_orders_json(self, file_path: str) -> List[Dict[str, Any]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        work_orders = []
        for item in data:
            work_order = {
                'id': str(item.get('工单编号', item.get('id', ''))),
                'complaint_id': str(item.get('关联投诉编号', item.get('complaint_id', ''))),
                'create_time': self._parse_datetime(item.get('创建时间', item.get('create_time', ''))),
                'assigned_department': str(item.get('派单部门', item.get('assigned_department', ''))),
                'handler': str(item.get('处理人', item.get('handler', ''))),
                'result': str(item.get('处理结果', item.get('result', ''))),
                'status': str(item.get('工单状态', item.get('status', '处理中'))),
                'source_type': 'work_order'
            }
            work_orders.append(work_order)

        return work_orders

    def parse_keywords_csv(self, file_path: str) -> Dict[str, List[str]]:
        df = pd.read_csv(file_path, encoding='utf-8')
        df = df.fillna('')

        keywords_dict = {}

        for _, row in df.iterrows():
            street = str(row.get('街道', row.get('street', ''))).strip()
            if not street:
                continue

            keywords = []
            for col in df.columns:
                if '关键词' in col or 'keyword' in col.lower():
                    val = str(row.get(col, '')).strip()
                    if val:
                        keywords.extend([k.strip() for k in val.split(',') if k.strip()])

            keywords_dict[street] = list(set(keywords))

        return keywords_dict

    def _parse_datetime(self, dt_str: str) -> Optional[datetime]:
        if not dt_str:
            return None

        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%Y年%m月%d日 %H:%M:%S',
            '%Y年%m月%d日'
        ]

        for fmt in formats:
            try:
                return datetime.strptime(str(dt_str).strip(), fmt)
            except (ValueError, TypeError):
                continue

        return None

    def save_uploaded_file(self, file_data: bytes, filename: str) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        base, ext = os.path.splitext(filename)
        saved_filename = f"{base}_{timestamp}{ext}"
        saved_path = os.path.join(self.upload_dir, saved_filename)

        with open(saved_path, 'wb') as f:
            f.write(file_data)

        return saved_path
