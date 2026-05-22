import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from stability_reconciliation.models.database import (
    ReconciliationRecord, AuditLog, Sample, Report
)


class ReviewService:
    def __init__(self, db: Session):
        self.db = db

    def review_reconciliation(self, reconciliation_id: str, review_comment: str,
                             is_resolved: bool = False, resolution_note: Optional[str] = None,
                             updated_calculations: Optional[Dict[str, Any]] = None,
                             reviewer: str = "system") -> ReconciliationRecord:
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == reconciliation_id
        ).first()
        
        if not record:
            raise ValueError(f"Reconciliation record not found: {reconciliation_id}")
        
        old_values = {
            "is_resolved": record.is_resolved,
            "status": record.status,
            "review_comments": record.review_comments
        }
        
        if record.review_comments:
            comments = record.review_comments
        else:
            comments = []
        
        new_comment = {
            "comment": review_comment,
            "reviewer": reviewer,
            "timestamp": datetime.utcnow().isoformat(),
            "is_resolved": is_resolved
        }
        comments.append(new_comment)
        record.review_comments = comments
        
        if is_resolved:
            record.is_resolved = True
            record.resolution_note = resolution_note
            record.resolved_by = reviewer
            record.resolved_at = datetime.utcnow()
            record.status = "resolved"
        
        if updated_calculations:
            old_calc = record.calculation_details or {}
            new_calc = {**old_calc, **updated_calculations}
            record.calculation_details = new_calc
        
        record.updated_at = datetime.utcnow()
        
        self._create_audit_log(
            reconciliation_id=reconciliation_id,
            action="review",
            field_changed="review_status",
            old_value=old_values,
            new_value={
                "is_resolved": record.is_resolved,
                "status": record.status,
                "review_comment_count": len(comments)
            },
            performed_by=reviewer,
            comment=review_comment
        )
        
        self._sync_related_data(record)
        
        return record

    def update_sample_data(self, sample_id: str, updates: Dict[str, Any],
                          updated_by: str = "system") -> Sample:
        sample = self.db.query(Sample).filter(Sample.id == sample_id).first()
        
        if not sample:
            raise ValueError(f"Sample not found")
        
        old_values = {}
        for field, new_value in updates.items():
            if hasattr(sample, field):
                old_values[field] = getattr(sample, field)
                setattr(sample, field, new_value)
        
        sample.updated_at = datetime.utcnow()
        
        for field, old_value in old_values.items():
            self._create_audit_log(
                reconciliation_id=None,
                action="update_sample",
                field_changed=field,
                old_value={"old_value": old_value},
                new_value={"new_value": updates[field]},
                performed_by=updated_by,
                comment=f"Updated sample field: {field}"
            )
        
        self._trigger_recalculation_for_sample(sample.id)
        
        self.db.commit()
        
        return sample

    def _sync_related_data(self, record: ReconciliationRecord):
        from sqlalchemy.orm.attributes import flag_modified
        from stability_reconciliation.models.database import ReconciliationRecord as RR
        from stability_reconciliation.models.database import TestProtocol, Sample
        
        reports = self.db.query(Report).filter(
            Report.reconciliation_batch_id == record.reconciliation_batch_id
        ).all()
        
        if not reports:
            return
        
        all_records = self.db.query(RR).filter(
            RR.reconciliation_batch_id == record.reconciliation_batch_id
        ).all()
        
        total = len(all_records)
        matched = sum(1 for r in all_records if r.status == "matched")
        discrepancy = sum(1 for r in all_records if r.status == "discrepancy")
        resolved = sum(1 for r in all_records if r.is_resolved)
        pending = total - resolved
        
        discrepancy_types = {}
        discrepancy_sources = {}
        for r in all_records:
            if r.discrepancy_type:
                discrepancy_types[r.discrepancy_type] = discrepancy_types.get(r.discrepancy_type, 0) + 1
            if r.discrepancy_source:
                discrepancy_sources[r.discrepancy_source] = discrepancy_sources.get(r.discrepancy_source, 0) + 1
        
        for report in reports:
            if not report.summary_data:
                report.summary_data = {}
            
            if "summary_statistics" not in report.summary_data:
                report.summary_data["summary_statistics"] = {}
            
            report.summary_data["summary_statistics"].update({
                "total_records": total,
                "matched_records": matched,
                "discrepancy_records": discrepancy,
                "resolved_records": resolved,
                "pending_review": pending,
                "resolution_rate": resolved / total if total > 0 else 0
            })
            
            report.summary_data["discrepancy_breakdown"] = {
                "by_type": discrepancy_types,
                "by_source": discrepancy_sources
            }
            
            report.summary_data["last_updated"] = datetime.utcnow().isoformat()
            
            flag_modified(report, "summary_data")
            
            protocol = self.db.query(TestProtocol).filter(
                TestProtocol.id == report.protocol_id
            ).first()
            samples = self.db.query(Sample).filter(
                Sample.protocol_id == report.protocol_id
            ).all()
            
            self._regenerate_report_file(report, all_records, samples, protocol)
        
        self.db.commit()
    
    def _regenerate_report_file(self, report: Report, records: list,
                                samples: list, protocol: "TestProtocol"):
        import json
        import pandas as pd
        import os
        
        if not os.path.exists(report.file_path):
            return
        
        file_ext = os.path.splitext(report.file_path)[1].lower()
        
        if file_ext == '.json':
            self._regenerate_json_report(report, records, samples, protocol)
        elif file_ext in ['.xlsx', '.xls']:
            if 'detailed' in report.file_path:
                self._regenerate_detailed_excel(report, records, samples, protocol)
            else:
                self._regenerate_summary_excel(report, records, samples, protocol)
    
    def _regenerate_json_report(self, report: Report, records: list,
                                 samples: list, protocol: "TestProtocol"):
        import json
        
        summary_stats = report.summary_data.get("summary_statistics", {})
        
        report_data = {
            "protocol_info": {
                "id": protocol.id,
                "name": protocol.protocol_name,
                "product": protocol.product_name,
                "batch_number": protocol.batch_number
            },
            "reconciliation_batch": report.reconciliation_batch_id,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": summary_stats,
            "samples": [],
            "reconciliation_records": []
        }
        
        for sample in samples:
            report_data["samples"].append({
                "id": sample.id,
                "sample_id": sample.sample_id,
                "sampling_point": sample.sampling_point,
                "planned_sampling_date": sample.planned_sampling_date.isoformat() if sample.planned_sampling_date else None,
                "actual_sampling_date": sample.actual_sampling_date.isoformat() if sample.actual_sampling_date else None,
                "condition": sample.condition,
                "storage_location": sample.storage_location
            })
        
        for record in records:
            report_data["reconciliation_records"].append({
                "id": record.id,
                "sample_id": record.sample_id,
                "status": record.status,
                "discrepancy_type": record.discrepancy_type,
                "discrepancy_source": record.discrepancy_source,
                "discrepancy_description": record.discrepancy_description,
                "is_resolved": record.is_resolved,
                "resolution_note": record.resolution_note,
                "resolved_by": record.resolved_by,
                "resolved_at": record.resolved_at.isoformat() if record.resolved_at else None,
                "calculation_details": record.calculation_details
            })
        
        with open(report.file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
    
    def _regenerate_summary_excel(self, report: Report, records: list,
                                   samples: list, protocol: "TestProtocol"):
        import pandas as pd
        
        writer = pd.ExcelWriter(report.file_path, engine='xlsxwriter')
        
        summary_stats = report.summary_data.get("summary_statistics", {})
        summary_df = pd.DataFrame([{
            "项目": protocol.protocol_name,
            "产品": protocol.product_name,
            "批次号": protocol.batch_number,
            "对账批次": report.reconciliation_batch_id,
            "样品总数": summary_stats.get("total_records", len(samples)),
            "匹配数": summary_stats.get("matched_records", 0),
            "差异数": summary_stats.get("discrepancy_records", 0),
            "已解决": summary_stats.get("resolved_records", 0),
            "待审核": summary_stats.get("pending_review", 0),
            "生成时间": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        }])
        summary_df.to_excel(writer, sheet_name="汇总", index=False)
        
        sample_data = []
        for sample in samples:
            record = next((r for r in records if r.sample_id == sample.id), None)
            sample_data.append({
                "样品ID": sample.sample_id,
                "取样点": sample.sampling_point,
                "计划取样日期": sample.planned_sampling_date.strftime("%Y-%m-%d") if sample.planned_sampling_date else "",
                "实际取样日期": sample.actual_sampling_date.strftime("%Y-%m-%d") if sample.actual_sampling_date else "",
                "存储条件": sample.condition,
                "箱体位置": sample.storage_location,
                "对账状态": record.status if record else "未对账",
                "差异类型": record.discrepancy_type if record else "",
                "是否解决": "是" if record and record.is_resolved else "否"
            })
        
        pd.DataFrame(sample_data).to_excel(writer, sheet_name="样品列表", index=False)
        
        writer.close()
    
    def _regenerate_detailed_excel(self, report: Report, records: list,
                                     samples: list, protocol: "TestProtocol"):
        import pandas as pd
        
        writer = pd.ExcelWriter(report.file_path, engine='xlsxwriter')
        
        summary_stats = report.summary_data.get("summary_statistics", {})
        summary_df = pd.DataFrame([{
            "项目": protocol.protocol_name,
            "产品": protocol.product_name,
            "批次号": protocol.batch_number,
            "对账批次": report.reconciliation_batch_id,
            "样品总数": summary_stats.get("total_records", len(samples)),
            "匹配数": summary_stats.get("matched_records", 0),
            "差异数": summary_stats.get("discrepancy_records", 0),
            "已解决": summary_stats.get("resolved_records", 0),
            "待审核": summary_stats.get("pending_review", 0),
            "生成时间": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        }])
        summary_df.to_excel(writer, sheet_name="汇总", index=False)
        
        discrepancy_data = []
        for record in records:
            if record.status == "discrepancy" or record.is_resolved:
                sample = next((s for s in samples if s.id == record.sample_id), None)
                calc_details = record.calculation_details or {}
                
                discrepancy_data.append({
                    "对账记录ID": record.id,
                    "样品ID": sample.sample_id if sample else "",
                    "取样点": sample.sampling_point if sample else "",
                    "差异类型": record.discrepancy_type,
                    "差异来源": record.discrepancy_source,
                    "差异描述": record.discrepancy_description,
                    "是否解决": "是" if record.is_resolved else "否",
                    "解决说明": record.resolution_note or "",
                    "解决人": record.resolved_by or "",
                    "解决时间": record.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if record.resolved_at else "",
                    "有效性评估": calc_details.get("validity_assessment", "")
                })
        
        pd.DataFrame(discrepancy_data).to_excel(writer, sheet_name="差异详情", index=False)
        
        review_data = []
        for record in records:
            if record.review_comments:
                sample = next((s for s in samples if s.id == record.sample_id), None)
                for comment in record.review_comments:
                    review_data.append({
                        "对账记录ID": record.id,
                        "样品ID": sample.sample_id if sample else "",
                        "评论内容": comment.get("comment", ""),
                        "评论人": comment.get("reviewer", ""),
                        "评论时间": comment.get("timestamp", ""),
                        "是否解决": "是" if comment.get("is_resolved") else "否"
                    })
        
        if review_data:
            pd.DataFrame(review_data).to_excel(writer, sheet_name="审核记录", index=False)
        
        writer.close()

    def _trigger_recalculation_for_sample(self, sample_id: str):
        from stability_reconciliation.services.reconciliation_engine import ReconciliationEngine
        
        records = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.sample_id == sample_id
        ).all()
        
        engine = ReconciliationEngine(self.db)
        
        for record in records:
            engine.recalculate_reconciliation(record.id, {})

    def _create_audit_log(self, reconciliation_id: Optional[str], action: str,
                         field_changed: Optional[str], old_value: Optional[Dict[str, Any]],
                         new_value: Optional[Dict[str, Any]], performed_by: str,
                         comment: Optional[str] = None):
        log_id = f"AUDIT-{uuid.uuid4().hex[:8].upper()}"
        
        log = AuditLog(
            id=log_id,
            reconciliation_id=reconciliation_id,
            action=action,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            performed_by=performed_by,
            performed_at=datetime.utcnow(),
            comment=comment
        )
        
        self.db.add(log)

    def get_audit_history(self, reconciliation_id: Optional[str] = None,
                         action: Optional[str] = None,
                         limit: int = 100) -> List[AuditLog]:
        query = self.db.query(AuditLog)
        
        if reconciliation_id:
            query = query.filter(AuditLog.reconciliation_id == reconciliation_id)
        
        if action:
            query = query.filter(AuditLog.action == action)
        
        query = query.order_by(AuditLog.performed_at.desc()).limit(limit)
        
        return query.all()

    def bulk_resolve_discrepancies(self, reconciliation_ids: List[str],
                                    resolution_note: str, resolved_by: str) -> Dict[str, Any]:
        results = {
            "success": [],
            "failed": [],
            "total": len(reconciliation_ids)
        }
        
        for rec_id in reconciliation_ids:
            try:
                self.review_reconciliation(
                    reconciliation_id=rec_id,
                    review_comment="批量解决差异",
                    is_resolved=True,
                    resolution_note=resolution_note,
                    reviewer=resolved_by
                )
                results["success"].append(rec_id)
            except Exception as e:
                results["failed"].append({
                    "id": rec_id,
                    "error": str(e)
                })
        
        return results

    def get_review_statistics(self, batch_id: Optional[str] = None,
                             protocol_id: Optional[str] = None) -> Dict[str, Any]:
        query = self.db.query(ReconciliationRecord)
        
        if batch_id:
            query = query.filter(ReconciliationRecord.reconciliation_batch_id == batch_id)
        
        if protocol_id:
            query = query.filter(ReconciliationRecord.protocol_id == protocol_id)
        
        records = query.all()
        
        total = len(records)
        resolved = sum(1 for r in records if r.is_resolved)
        with_discrepancy = sum(1 for r in records if r.status == "discrepancy")
        matched = sum(1 for r in records if r.status == "matched")
        
        return {
            "total_records": total,
            "resolved_records": resolved,
            "records_with_discrepancy": with_discrepancy,
            "matched_records": matched,
            "pending_review": total - resolved,
            "resolution_rate": resolved / total if total > 0 else 0
        }
