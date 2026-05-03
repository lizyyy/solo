"""CSV解析器 - 用于解析证据目录"""
import csv
from typing import Any, Dict, List
from datetime import datetime
from .base_parser import BaseParser


class CSVParser(BaseParser):
    """CSV文件解析器"""
    
    def __init__(self):
        self.supported_extensions = ['.csv']
    
    def supports_file(self, file_path: str) -> bool:
        """检查是否支持该文件类型"""
        return any(file_path.lower().endswith(ext) for ext in self.supported_extensions)
    
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """
        解析证据目录CSV文件
        
        预期的CSV格式：
        - evidence_id: 证据编号（如E001）
        - evidence_name: 证据名称
        - description: 证据描述
        - date: 证据日期（YYYY-MM-DD）
        - source: 证据来源
        - category: 证据类别
        """
        results = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(reader):
                evidence_id = row.get('evidence_id', row.get('id', f'E{str(i+1).zfill(3)}'))
                
                timestamp = None
                date_str = row.get('date', row.get('timestamp', ''))
                if date_str:
                    try:
                        timestamp = self._parse_timestamp(date_str)
                    except Exception:
                        pass
                
                results.append({
                    'id': evidence_id,
                    'type': 'evidence',
                    'content': f"{row.get('evidence_name', row.get('name', ''))}: {row.get('description', '')}",
                    'timestamp': timestamp,
                    'metadata': {
                        'evidence_id': evidence_id,
                        'evidence_name': row.get('evidence_name', row.get('name', '')),
                        'description': row.get('description', ''),
                        'date': date_str,
                        'source': row.get('source', ''),
                        'category': row.get('category', ''),
                        'original_row': row
                    }
                })
        
        return results
