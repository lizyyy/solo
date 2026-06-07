import os
import pandas as pd
from datetime import datetime
from typing import List, Optional
from config import EXPORT_DIR, EXPORT_FIELDS
from models import AlertResult
from core.desensitization import DesensitizationChecker


class ExportManager:
    def __init__(self):
        self.desens_checker = DesensitizationChecker()
        os.makedirs(EXPORT_DIR, exist_ok=True)

    def _mask_text(self, text: str) -> str:
        if not text:
            return text
        _, _, masked = self.desens_checker.check_text(text)
        return masked

    def _result_to_row(self, result: AlertResult) -> dict:
        row = {
            '批次号': result.batch_id,
            '会话ID': result.session_id,
            '知识片段ID': result.knowledge_id,
            '原始问题': self._mask_text(result.original_question),
            '当前口径': self._mask_text(result.current_answer),
            '标注员留言': self._mask_text(result.annotation_remark),
            '现场说法': self._mask_text(result.on_site_statement),
            '预警状态': result.alert_status.value,
            '脱敏状态': result.desensitization_status.value,
            '处理人': result.processed_by or '',
            '处理时间': result.processed_at or '',
            '证据来源': result.evidence_source.value,
            '版本': f"v{result.version}"
        }
        return row

    def export_results_to_excel(
        self,
        results: List[AlertResult],
        filename: Optional[str] = None,
        batch_id: str = ""
    ) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            batch_suffix = f"_{batch_id}" if batch_id else ""
            filename = f"客服知识片段预警结果{batch_suffix}_{timestamp}.xlsx"

        filepath = os.path.join(EXPORT_DIR, filename)
        rows = [self._result_to_row(r) for r in results]
        df = pd.DataFrame(rows)

        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='预警结果', index=False)

            summary_data = self._build_summary(results)
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='统计概览', index=False)

            history_rows = self._build_history_sheet(results)
            if history_rows:
                history_df = pd.DataFrame(history_rows)
                history_df.to_excel(writer, sheet_name='操作历史', index=False)

        return filepath

    def _build_summary(self, results: List[AlertResult]) -> list:
        alert_counts = {}
        desens_counts = {}
        source_counts = {}

        for r in results:
            a = r.alert_status.value
            d = r.desensitization_status.value
            s = r.evidence_source.value
            alert_counts[a] = alert_counts.get(a, 0) + 1
            desens_counts[d] = desens_counts.get(d, 0) + 1
            source_counts[s] = source_counts.get(s, 0) + 1

        summary = []
        summary.append({"统计维度": "预警状态汇总", "类别": "", "数量": ""})
        for k, v in alert_counts.items():
            summary.append({"统计维度": "", "类别": k, "数量": v})

        summary.append({"统计维度": "脱敏状态汇总", "类别": "", "数量": ""})
        for k, v in desens_counts.items():
            summary.append({"统计维度": "", "类别": k, "数量": v})

        summary.append({"统计维度": "证据来源汇总", "类别": "", "数量": ""})
        for k, v in source_counts.items():
            summary.append({"统计维度": "", "类别": k, "数量": v})

        summary.append({"统计维度": "总记录数", "类别": "", "数量": len(results)})
        return summary

    def _build_history_sheet(self, results: List[AlertResult]) -> list:
        rows = []
        for r in results:
            for h in r.history:
                rows.append({
                    '结果ID': r.result_id,
                    '会话ID': r.session_id,
                    '版本': f"v{h.get('version', 1)}",
                    '操作': h.get('action', ''),
                    '操作人': h.get('operator', ''),
                    '详情': h.get('detail', ''),
                    '时间': h.get('time', '')
                })
        return rows

    def export_single_result(self, result: AlertResult) -> str:
        return self.export_results_to_excel([result], batch_id=result.batch_id)
