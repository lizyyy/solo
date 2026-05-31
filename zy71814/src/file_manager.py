"""
文件管理模块
处理结算附件的存储、索引和历史记录
"""
import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import pandas as pd

from .models import generate_id


class FileManager:
    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = os.path.join(os.getcwd(), 'data')

        self.base_dir = Path(base_dir)
        self.attachments_dir = self.base_dir / 'attachments'
        self.history_dir = self.base_dir / 'history'
        self.exports_dir = self.base_dir / 'exports'
        self.index_file = self.base_dir / 'file_index.json'

        self._init_directories()
        self._init_index()

    def _init_directories(self):
        for dir_path in [self.attachments_dir, self.history_dir, self.exports_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)

    def _init_index(self):
        if not self.index_file.exists():
            self._save_index({
                'transactions': [],
                'settlements': [],
                'reconciliations': []
            })

    def _load_index(self) -> Dict:
        with open(self.index_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save_index(self, index: Dict):
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

    def save_attachment(self, source_path: str, file_type: str, period: str = None) -> Dict:
        file_id = generate_id()
        original_name = os.path.basename(source_path)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_filename = f"{file_id}_{timestamp}_{original_name}"

        dest_path = self.attachments_dir / new_filename
        shutil.copy2(source_path, dest_path)

        file_info = {
            'file_id': file_id,
            'original_name': original_name,
            'stored_name': new_filename,
            'file_type': file_type,
            'period': period,
            'upload_time': datetime.now().isoformat(),
            'file_path': str(dest_path)
        }

        index = self._load_index()
        if file_type == 'transaction':
            index['transactions'].append(file_info)
        elif file_type == 'settlement':
            index['settlements'].append(file_info)
        self._save_index(index)

        return file_info

    def save_uploaded_file(self, uploaded_file, file_type: str, period: str = None) -> Dict:
        file_id = generate_id()
        original_name = uploaded_file.name
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        new_filename = f"{file_id}_{timestamp}_{original_name}"

        dest_path = self.attachments_dir / new_filename

        with open(dest_path, 'wb') as f:
            f.write(uploaded_file.getbuffer())

        file_info = {
            'file_id': file_id,
            'original_name': original_name,
            'stored_name': new_filename,
            'file_type': file_type,
            'period': period,
            'upload_time': datetime.now().isoformat(),
            'file_path': str(dest_path)
        }

        index = self._load_index()
        if file_type == 'transaction':
            index['transactions'].append(file_info)
        elif file_type == 'settlement':
            index['settlements'].append(file_info)
        self._save_index(index)

        return file_info

    def get_file_list(self, file_type: str = None) -> List[Dict]:
        index = self._load_index()
        if file_type == 'transaction':
            return index['transactions']
        elif file_type == 'settlement':
            return index['settlements']
        else:
            return index['transactions'] + index['settlements']

    def get_file_path(self, file_id: str) -> Optional[str]:
        index = self._load_index()
        for file_type in ['transactions', 'settlements']:
            for file_info in index[file_type]:
                if file_info['file_id'] == file_id:
                    return file_info['file_path']
        return None

    def get_file_info(self, file_id: str) -> Optional[Dict]:
        index = self._load_index()
        for file_type in ['transactions', 'settlements']:
            for file_info in index[file_type]:
                if file_info['file_id'] == file_id:
                    return file_info
        return None

    def save_reconciliation_history(self, reconciliation_data: Dict) -> str:
        history_id = generate_id()
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"recon_{history_id}_{timestamp}.json"
        file_path = self.history_dir / filename

        history_record = {
            'history_id': history_id,
            'created_at': datetime.now().isoformat(),
            'data': reconciliation_data
        }

        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(history_record, f, ensure_ascii=False, indent=2, default=str)

        index = self._load_index()
        index['reconciliations'].append({
            'history_id': history_id,
            'filename': filename,
            'created_at': history_record['created_at'],
            'period': reconciliation_data.get('period', '')
        })
        self._save_index(index)

        return history_id

    def get_reconciliation_history(self) -> List[Dict]:
        index = self._load_index()
        return sorted(
            index['reconciliations'],
            key=lambda x: x['created_at'],
            reverse=True
        )

    def load_reconciliation(self, history_id: str) -> Optional[Dict]:
        index = self._load_index()
        for record in index['reconciliations']:
            if record['history_id'] == history_id:
                file_path = self.history_dir / record['filename']
                with open(file_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        return None

    def export_to_excel(self, df: pd.DataFrame, filename: str) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        export_filename = f"{timestamp}_{filename}"
        export_path = self.exports_dir / export_filename

        df.to_excel(export_path, index=False, engine='openpyxl')

        return str(export_path)

    def export_reconciliation_report(self, report_data: Dict, filename: str) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        export_filename = f"{timestamp}_{filename}"
        export_path = self.exports_dir / export_filename

        with pd.ExcelWriter(export_path, engine='openpyxl') as writer:
            if 'transactions' in report_data:
                pd.DataFrame(report_data['transactions']).to_excel(
                    writer, sheet_name='交易明细', index=False
                )
            if 'settlements' in report_data:
                pd.DataFrame(report_data['settlements']).to_excel(
                    writer, sheet_name='结算记录', index=False
                )
            if 'summary' in report_data:
                pd.DataFrame([report_data['summary']]).to_excel(
                    writer, sheet_name='汇总表', index=False
                )

        return str(export_path)
