import json
import os
from typing import Dict, List, Any
from datetime import datetime


class BatchImporter:
    def __init__(self):
        self.batch_data = None
        self.validation_errors = []

    def load_batch(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"批次文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.batch_data = data
        return data

    def validate_batch(self, data: Dict[str, Any]) -> Dict[str, Any]:
        errors = []
        required_fields = ['batch_id', 'fruit_type', 'batch_size', 'production_date', 'source_farm']
        
        for field in required_fields:
            if field not in data:
                errors.append(f"缺少必要字段: {field}")
        
        if 'fruit_type' in data:
            from .config import GRADE_STANDARDS
            if data['fruit_type'] not in GRADE_STANDARDS:
                errors.append(f"不支持的水果类型: {data['fruit_type']}")
        
        if 'batch_size' in data:
            if data['batch_size'] <= 0:
                errors.append("批次数量必须大于0")
        
        self.validation_errors = errors
        
        return {
            'valid': len(errors) == 0,
            'errors': errors,
            'summary': self._generate_summary(data)
        }

    def _generate_summary(self, data: Dict[str, Any]) -> Dict[str, Any]:
        summary = {
            'batch_id': data.get('batch_id', 'N/A'),
            'fruit_type': data.get('fruit_type', 'N/A'),
            'batch_size': data.get('batch_size', 0),
            'production_date': data.get('production_date', 'N/A'),
            'source_farm': data.get('source_farm', 'N/A'),
            'import_time': datetime.now().isoformat()
        }
        
        if 'measurements' in data:
            measurements = data['measurements']
            sugars = [m['sugar'] for m in measurements if 'sugar' in m]
            if sugars:
                summary['total_measurements'] = len(measurements)
                summary['sugar_min'] = min(sugars)
                summary['sugar_max'] = max(sugars)
                summary['sugar_avg'] = sum(sugars) / len(sugars)
        
        return summary
