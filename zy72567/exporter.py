"""
导出模块
确保导出的明细、页面展示、接口返回读同一份结果
"""
import csv
import json
from typing import List
from io import StringIO

from models import BoundarySample
from database import Database


class Exporter:
    """
    统一导出入口
    所有导出格式（CSV/JSON/Excel）都从同一个数据源读，保证一致
    页面展示、API接口也走同一个查询逻辑（database.py中的list_samples/get_sample）
    """
    
    def __init__(self, db: Database):
        self.db = db
    
    def export_to_csv(self, status=None, batch_id=None, has_anomaly=None) -> str:
        """导出为CSV（页面上的导出按钮、后台下载都走这个）"""
        samples, _ = self.db.list_samples(
            status=status,
            batch_id=batch_id,
            has_anomaly=has_anomaly,
            page_size=10000
        )
        
        output = StringIO()
        writer = csv.writer(output)
        
        # 表头（跟页面展示列对应，保持一致）
        writer.writerow([
            "样本ID", "样本Key", "批次ID", "文本内容",
            "预测分类", "实际分类", "当前状态", "异常类型",
            "YAML版本ID", "YAML原始行号", "更新时间", "最后操作人"
        ])
        
        for s in samples:
            writer.writerow([
                s.id,
                s.sample_key,
                s.batch_id,
                s.text_content,
                s.predicted_category,
                s.actual_category,
                self._status_label(s.status.value),
                ",".join([self._anomaly_label(t.value) for t in s.anomaly_types]),
                s.yaml_version_id,
                s.yaml_line_number,
                s.updated_at.isoformat(),
                s.last_updated_by
            ])
        
        return output.getvalue()
    
    def export_to_json(self, status=None, batch_id=None, has_anomaly=None) -> str:
        """导出为JSON"""
        samples, _ = self.db.list_samples(
            status=status,
            batch_id=batch_id,
            has_anomaly=has_anomaly,
            page_size=10000
        )
        
        result = []
        for s in samples:
            result.append({
                "id": s.id,
                "sample_key": s.sample_key,
                "batch_id": s.batch_id,
                "text_content": s.text_content,
                "predicted_category": s.predicted_category,
                "actual_category": s.actual_category,
                "status": s.status.value,
                "status_label": self._status_label(s.status.value),
                "anomaly_types": [t.value for t in s.anomaly_types],
                "anomaly_labels": [self._anomaly_label(t.value) for t in s.anomaly_types],
                "yaml_version_id": s.yaml_version_id,
                "yaml_line_number": s.yaml_line_number,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat(),
                "last_updated_by": s.last_updated_by
            })
        
        return json.dumps(result, ensure_ascii=False, indent=2)
    
    def _status_label(self, status: str) -> str:
        """状态中文标签（页面、导出、接口用同一套，保持一致）"""
        labels = {
            "imported": "已导入",
            "slice_viewed": "已看切片",
            "feature_updated": "已更特征",
            "pending_review": "待产品复核",
            "normal": "确认正常",
            "abnormal": "确认异常"
        }
        return labels.get(status, status)
    
    def _anomaly_label(self, anomaly: str) -> str:
        """异常类型中文标签"""
        labels = {
            "duplicate_import": "重复导入",
            "duplicate_train": "重复训练",
            "supplement_recalc": "补录待重算",
            "export_inconsistent": "导出不一致"
        }
        return labels.get(anomaly, anomaly)
