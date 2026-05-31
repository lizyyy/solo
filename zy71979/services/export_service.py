import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

import pandas as pd

from models import ExportRecord, ReviewSample, FilterCondition
import schemas
from config import EXPORT_DIR, CHANGE_TYPES, ANOMALY_TYPES, DATA_SOURCE_TYPES
from services.filter_service import FilterService
from services.change_service import ChangeHistoryService
from services.trace_service import TraceService


class ExportService:
    @staticmethod
    def _generate_snapshot_hash(filter_id: int, sample_ids: List[int], timestamp: datetime) -> str:
        data = {
            "filter_id": filter_id,
            "sample_ids": sorted(sample_ids),
            "timestamp": timestamp.isoformat(),
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def _generate_export_no() -> str:
        now = datetime.now()
        return f"EXPORT-{now.strftime('%Y%m%d%H%M%S')}"

    @staticmethod
    def get_samples_for_export(
        db: Session,
        filter_condition_id: int = None,
        sample_ids: List[int] = None,
    ) -> List[ReviewSample]:
        if sample_ids:
            return db.query(ReviewSample).filter(
                ReviewSample.id.in_(sample_ids)
            ).all()
        elif filter_condition_id:
            return FilterService.get_associated_samples(db, filter_condition_id)
        else:
            return db.query(ReviewSample).all()

    @staticmethod
    def export_weekly_report(
        db: Session,
        filter_condition_id: int = None,
        sample_ids: List[int] = None,
        exported_by: str = None,
    ) -> ExportRecord:
        samples = ExportService.get_samples_for_export(db, filter_condition_id, sample_ids)

        if filter_condition_id is None and sample_ids:
            filter_condition = db.query(FilterCondition).filter(
                FilterCondition.id == samples[0].filter_condition_id
            ).first() if samples and samples[0].filter_condition_id else None
            filter_condition_id = filter_condition.id if filter_condition else None

        sample_ids_list = [s.id for s in samples]
        timestamp = datetime.now()
        snapshot_hash = ExportService._generate_snapshot_hash(
            filter_condition_id, sample_ids_list, timestamp
        )

        change_classifications = ChangeHistoryService.classify_changes_for_report(
            db, sample_ids_list
        )

        data_rows = []
        for sample in samples:
            trace = TraceService.get_sample_trace(db, sample.id)
            sensitive_check = TraceService.check_sensitive_data_anomaly(db, sample.id)
            classification = next(
                (c for c in change_classifications if c["sample_id"] == sample.id),
                None
            )

            data_sources = []
            if sample.inspection:
                data_sources.append(DATA_SOURCE_TYPES["QUALITY_FORM"])
            if sample.dialog:
                data_sources.append(DATA_SOURCE_TYPES["CUSTOMER_SERVICE"])
            if sample.knowledge_entry:
                data_sources.append(DATA_SOURCE_TYPES["KNOWLEDGE_BASE"])

            row = {
                "复判编号": sample.id,
                "批次号": sample.sample_batch_no,
                "采样日期": sample.sample_date.strftime("%Y-%m-%d") if sample.sample_date else "",
                "采样人": sample.sampler,
                "复判人": sample.reviewer,
                "复判状态": sample.review_status,
                "是否异常": "是" if sample.is_anomaly else "否",
                "异常类型": ANOMALY_TYPES.get(sample.anomaly_type, sample.anomaly_type) if sample.anomaly_type else "",
                "结论": sample.conclusion,
                "依据摘要": sample.evidence_summary,
                "敏感词检查": sensitive_check["judgment"],
                "数据来源": "、".join(data_sources),
                "变更分类": classification["classification"] if classification else "",
                "是否仅补材料": "是" if (classification and classification["is_material_only"]) else "否",
                "是否结论变更": "是" if (classification and classification["is_conclusion_change"]) else "否",
                "补材料次数": classification["material_supplement_count"] if classification else 0,
                "结论变更次数": classification["conclusion_change_count"] if classification else 0,
                "原始结论": classification["original_conclusion"] if classification else "",
                "最终结论": classification["final_conclusion"] if classification else "",
                "质检表编号": sample.inspection.inspection_no if sample.inspection else "",
                "质检表晚交": "是" if (sample.inspection and sample.inspection.is_late_submit) else "否",
                "客服对话编号": sample.dialog.dialog_id if sample.dialog else "",
                "客服对话晚补": "是" if (sample.dialog and sample.dialog.is_late_supplement) else "否",
                "知识库条目编号": sample.knowledge_entry.entry_id if sample.knowledge_entry else "",
                "知识库手工改动": "是" if (sample.knowledge_entry and sample.knowledge_entry.is_manual_modified) else "否",
                "溯源链接": f"/review-samples/{sample.id}/trace",
            }
            data_rows.append(row)

        df = pd.DataFrame(data_rows)
        export_no = ExportService._generate_export_no()
        file_name = f"质检周报_{export_no}_{timestamp.strftime('%Y%m%d')}.xlsx"
        file_path = EXPORT_DIR / file_name

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="复判明细", index=False)

            summary_data = {
                "统计项": [
                    "总样本数",
                    "异常数",
                    "正常数",
                    "待复判数",
                    "仅补材料数",
                    "结论变更数",
                    "数据修正数",
                    "敏感词漏脱敏异常数",
                ],
                "数量": [
                    len(samples),
                    sum(1 for s in samples if s.is_anomaly),
                    sum(1 for s in samples if not s.is_anomaly and s.review_status == "completed"),
                    sum(1 for s in samples if s.review_status == "pending"),
                    sum(1 for c in change_classifications if c["is_material_only"]),
                    sum(1 for c in change_classifications if c["is_conclusion_change"]),
                    sum(1 for c in change_classifications if not c["is_material_only"] and not c["is_conclusion_change"]),
                    sum(1 for s in samples if TraceService.check_sensitive_data_anomaly(db, s.id)["is_exception"]),
                ],
            }
            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name="统计汇总", index=False)

        export_record = ExportRecord(
            export_no=export_no,
            export_type="weekly_report",
            file_name=file_name,
            file_path=str(file_path),
            filter_condition_id=filter_condition_id,
            record_count=len(samples),
            exported_by=exported_by,
            exported_at=timestamp,
            snapshot_hash=snapshot_hash,
        )
        db.add(export_record)
        db.commit()

        return export_record

    @staticmethod
    def verify_export_consistency(
        db: Session,
        export_id: int,
        current_filter_id: int,
    ) -> Dict[str, Any]:
        export = db.query(ExportRecord).filter(ExportRecord.id == export_id).first()
        if not export:
            raise ValueError(f"Export {export_id} not found")

        if export.filter_condition_id != current_filter_id:
            filter_compare = FilterService.compare_filters(
                db, export.filter_condition_id, current_filter_id
            )
        else:
            filter_compare = {
                "hash_match": True,
                "conditions_match": True,
                "page_match": True,
                "page_size_match": True,
                "sort_match": True,
                "total_count_diff": 0,
            }

        current_samples = FilterService.get_filter_samples(db, current_filter_id, apply_conditions=True)
        export_samples = FilterService.get_associated_samples(db, export.filter_condition_id)

        current_ids = set(s.id for s in current_samples)
        export_ids = set(s.id for s in export_samples)

        return {
            "export_id": export_id,
            "export_no": export.export_no,
            "exported_at": export.exported_at.isoformat(),
            "export_count": export.record_count,
            "current_filter_id": current_filter_id,
            "export_filter_id": export.filter_condition_id,
            "filter_match": filter_compare,
            "sample_count_match": len(current_samples) == len(export_samples),
            "sample_ids_match": current_ids == export_ids,
            "new_samples_since_export": list(current_ids - export_ids),
            "removed_samples_since_export": list(export_ids - current_ids),
            "is_consistent": (
                filter_compare["hash_match"]
                and len(current_samples) == len(export_samples)
                and current_ids == export_ids
            ),
        }

    @staticmethod
    def get_recent_exports(db: Session, limit: int = 10, exported_by: str = None) -> List[ExportRecord]:
        from sqlalchemy import desc
        query = db.query(ExportRecord)
        if exported_by:
            query = query.filter(ExportRecord.exported_by == exported_by)
        return query.order_by(desc(ExportRecord.exported_at)).limit(limit).all()
