"""统一数据出口

核心原则：明细导出、页面展示、API接口返回，全部从同一个数据源读
绝对不能一个地方算一遍、另一个地方再算一遍
尤其是"线上特征缺失给默认分"这种记录，必须三个地方都能看到
"""

import json
import csv
from io import StringIO
from typing import List, Dict, Any, Optional

from ..models import EmbeddingCompatSession, FeatureComparisonRecord, ProcessingStatus, AnomalyType


class UnifiedDataExporter:
    """统一数据导出器

    所有展示和导出都走这里，保证数据一致性
    """

    def __init__(self, session: EmbeddingCompatSession):
        self.session = session

    def get_page_data(self) -> Dict[str, Any]:
        """页面展示用的数据"""
        return {
            "summary": self.session.get_summary_stats(),
            "records": self.session.export_details(),
            "pending_lead_records": [r.to_dict() for r in self.session.get_pending_lead_review()],
            "default_score_missing": [r.to_dict() for r in self.session.has_default_score_missing_feature()],
        }

    def get_api_response(self, record_id: Optional[str] = None) -> Dict[str, Any]:
        """API接口返回的数据"""
        if record_id:
            for r in self.session.records:
                if r.record_id == record_id:
                    return {"code": 0, "data": r.to_dict()}
            return {"code": 404, "error": "record not found"}
        return {"code": 0, "data": self.get_page_data()}

    def export_details_csv(self) -> str:
        """导出明细CSV

        注意：和页面、API用的完全是同一份 to_dict() 数据
        """
        records = self.session.export_details()
        if not records:
            return ""

        fieldnames = [
            "feature_name",
            "embedding_version_a",
            "embedding_version_b",
            "score_a",
            "score_b",
            "score_diff",
            "feature_present_online",
            "used_default_score",
            "default_score_value",
            "anomaly_type",
            "anomaly_description",
            "status",
            "linji_review_note",
            "lead_review_note",
            "summary_note",
            "record_id",
        ]

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records:
            row = {k: rec.get(k, "") for k in fieldnames}
            writer.writerow(row)

        return output.getvalue()

    def export_details_json(self, pretty: bool = True) -> str:
        """导出明细JSON"""
        data = self.get_page_data()
        indent = 2 if pretty else None
        return json.dumps(data, ensure_ascii=False, indent=indent)

    def get_audit_trail(self, record_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """获取审计轨迹

        推荐负责人追问"谁什么时候改了什么"的时候用
        """
        if record_id:
            for r in self.session.records:
                if r.record_id == record_id:
                    return [log.to_dict() for log in r.audit_logs]
            return []

        all_logs = []
        for r in self.session.records:
            all_logs.extend([log.to_dict() for log in r.audit_logs])
        return sorted(all_logs, key=lambda x: x["timestamp"])

    def get_yaml_evidence(self, record_id: str) -> List[Dict[str, Any]]:
        """获取某条记录的YAML原始行证据

        推荐负责人要回到原始证据的时候用
        """
        for r in self.session.records:
            if r.record_id == record_id:
                return [line.to_dict() for line in r.yaml_source_lines]
        return []
