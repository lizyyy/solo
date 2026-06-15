import hashlib
import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
import pandas as pd
from app.models import CheckResult, ExportRecord, EvaluationSlice, FeatureSnapshot, ManualChange, StatusHistory
from app.schemas import ExportRequest


class ExportService:
    def __init__(self, db: Session):
        self.db = db
        self.export_dir = "./exports"
        os.makedirs(self.export_dir, exist_ok=True)
        self._all_manual_changes: List[ManualChange] = []
        self._all_status_history: List[StatusHistory] = []

    def _load_all_history(self):
        self._all_manual_changes = self.db.query(ManualChange).order_by(ManualChange.change_time.desc()).all()
        self._all_status_history = self.db.query(StatusHistory).order_by(StatusHistory.change_time.desc()).all()

    def _query_check_results(
        self,
        check_status_filter: Optional[List[str]] = None,
        check_type_filter: Optional[List[str]] = None,
    ) -> List[CheckResult]:
        query = self.db.query(CheckResult)

        if check_status_filter:
            query = query.filter(CheckResult.check_status.in_(check_status_filter))
        if check_type_filter:
            query = query.filter(CheckResult.check_type.in_(check_type_filter))

        results = query.order_by(CheckResult.created_at.desc()).all()
        return results

    def _get_slice_manual_changes(self, slice_id: int) -> List[Dict[str, Any]]:
        return [
            {
                "id": mc.id,
                "field_name": mc.field_name,
                "old_value": mc.old_value,
                "new_value": mc.new_value,
                "changed_by": mc.changed_by,
                "change_time": mc.change_time.strftime("%Y-%m-%d %H:%M:%S") if mc.change_time else "",
                "change_reason": mc.change_reason,
            }
            for mc in self._all_manual_changes if mc.evaluation_slice_id == slice_id
        ]

    def _get_slice_status_history(self, slice_id: int) -> List[Dict[str, Any]]:
        return [
            {
                "id": sh.id,
                "old_status": sh.old_status,
                "new_status": sh.new_status,
                "changed_by": sh.changed_by,
                "change_reason": sh.change_reason,
                "change_time": sh.change_time.strftime("%Y-%m-%d %H:%M:%S") if sh.change_time else "",
            }
            for sh in self._all_status_history if sh.evaluation_slice_id == slice_id
        ]

    def _flatten_result(self, cr: CheckResult) -> Dict[str, Any]:
        result_detail = cr.result_detail or {}
        evidence_chain = cr.evidence_chain or {}
        main_process = evidence_chain.get("main_process_summary", {})
        feature_snap = evidence_chain.get("feature_snapshot", {})

        manual_changes = self._get_slice_manual_changes(cr.evaluation_slice_id)
        status_history = self._get_slice_status_history(cr.evaluation_slice_id)

        status_guidance = result_detail.get("status_guidance", "")
        alignment_status = result_detail.get("alignment_status", "")
        diff_value = result_detail.get("diff_value", "")
        threshold_record_id = result_detail.get("threshold_record_id", "")
        is_applied_in_report = result_detail.get("is_applied_in_report", "")

        return {
            "检查结果ID": cr.id,
            "检查类型": self._translate_check_type(cr.check_type),
            "检查状态": self._translate_status(cr.check_status),
            "严重程度": self._translate_severity(cr.severity),
            "是否需数据科学家复核": "是" if cr.needs_data_scientist_review else "否",
            "评测切片ID": cr.evaluation_slice_id,
            "原始行号": evidence_chain.get("original_row_number", ""),
            "导入批次号": evidence_chain.get("import_batch_id", ""),
            "主流程指标名": main_process.get("metric_name", ""),
            "主流程指标值": main_process.get("metric_value", ""),
            "报告中阈值": main_process.get("report_threshold", ""),
            "特征快照ID": cr.feature_snapshot_id,
            "特征快照编号": feature_snap.get("snapshot_number", ""),
            "现场说法": feature_snap.get("on_site_statement", ""),
            "补录人": feature_snap.get("supplemented_by", ""),
            "是否补录重算": "是" if feature_snap.get("is_resupplemented") else "否",
            "阈值旧值": cr.threshold_old_value,
            "阈值新值": cr.threshold_new_value,
            "报告显示阈值": cr.report_threshold_value,
            "阈值差值": diff_value,
            "是否应用到报告": "是" if is_applied_in_report == True else ("否" if is_applied_in_report == False else ""),
            "对齐状态": alignment_status,
            "处理指引": status_guidance,
            "阈值变更记录ID": threshold_record_id,
            "人工改动次数": len(manual_changes),
            "人工改动历史": json.dumps(manual_changes, ensure_ascii=False),
            "状态变更次数": len(status_history),
            "状态变化轨迹": json.dumps(status_history, ensure_ascii=False),
            "详细信息": result_detail.get("message", ""),
            "详细结果JSON": json.dumps(result_detail, ensure_ascii=False),
            "证据链JSON": json.dumps(evidence_chain, ensure_ascii=False),
            "复核人": cr.reviewer or "",
            "复核意见": cr.review_comment or "",
            "复核时间": cr.review_time.strftime("%Y-%m-%d %H:%M:%S") if cr.review_time else "",
            "创建时间": cr.created_at.strftime("%Y-%m-%d %H:%M:%S") if cr.created_at else "",
        }

    def _translate_check_type(self, check_type: str) -> str:
        mapping = {
            "duplicate_import": "重复导入",
            "threshold_mismatch": "阈值不匹配",
            "resupplement": "补录重算",
            "cross_leak": "特征交叉泄漏",
            "export_consistency": "导出一致性",
        }
        return mapping.get(check_type, check_type)

    def _translate_status(self, status: str) -> str:
        mapping = {
            "normal": "正常",
            "abnormal": "异常",
            "pending_review": "待复核",
        }
        return mapping.get(status, status)

    def _translate_severity(self, severity: str) -> str:
        mapping = {
            "low": "低",
            "medium": "中",
            "high": "高",
        }
        return mapping.get(severity, severity)

    def _compute_content_hash(self, results: List[Dict[str, Any]]) -> str:
        canonical_data = sorted(results, key=lambda x: x.get("检查结果ID", 0))
        return hashlib.sha256(
            json.dumps(canonical_data, sort_keys=True, default=str, ensure_ascii=False).encode()
        ).hexdigest()

    def export_to_excel(
        self,
        export_request: ExportRequest,
    ) -> Dict[str, Any]:
        self._load_all_history()

        results = self._query_check_results(
            check_status_filter=export_request.check_status_filter,
            check_type_filter=export_request.check_type_filter,
        )

        flattened = [self._flatten_result(r) for r in results]
        content_hash = self._compute_content_hash(flattened)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"特征交叉泄漏检查_{export_request.export_type}_{timestamp}.xlsx"
        file_path = os.path.join(self.export_dir, filename)

        if export_request.export_type == "detail":
            df = pd.DataFrame(flattened)
        else:
            summary = self._build_summary(results)
            df = pd.DataFrame([summary])

        df.to_excel(file_path, index=False, engine="openpyxl")

        export_record = ExportRecord(
            export_type=export_request.export_type,
            exported_by=export_request.exported_by,
            check_result_ids=[r.id for r in results],
            export_hash=content_hash,
            file_path=file_path,
        )
        self.db.add(export_record)
        self.db.commit()
        self.db.refresh(export_record)

        return {
            "file_path": file_path,
            "filename": filename,
            "record_count": len(results),
            "export_hash": content_hash,
            "export_record_id": export_record.id,
        }

    def _build_summary(self, results: List[CheckResult]) -> Dict[str, Any]:
        by_type = {}
        by_status = {}
        by_severity = {}
        needs_review = 0

        for r in results:
            ct = self._translate_check_type(r.check_type)
            st = self._translate_status(r.check_status)
            sv = self._translate_severity(r.severity)
            by_type[ct] = by_type.get(ct, 0) + 1
            by_status[st] = by_status.get(st, 0) + 1
            by_severity[sv] = by_severity.get(sv, 0) + 1
            if r.needs_data_scientist_review:
                needs_review += 1

        return {
            "总记录数": len(results),
            "待复核数": needs_review,
            "按类型分布": json.dumps(by_type, ensure_ascii=False),
            "按状态分布": json.dumps(by_status, ensure_ascii=False),
            "按严重程度分布": json.dumps(by_severity, ensure_ascii=False),
            "导出时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    def get_export_data_for_api(
        self,
        check_status_filter: Optional[List[str]] = None,
        check_type_filter: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        self._load_all_history()
        results = self._query_check_results(check_status_filter, check_type_filter)
        return [self._flatten_result(r) for r in results]
