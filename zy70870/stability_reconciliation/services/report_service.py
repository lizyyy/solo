import uuid
import json
import pandas as pd
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from stability_reconciliation.models.database import (
    TestProtocol, Sample, ReconciliationRecord, Report
)


class ReportService:
    def __init__(self, db: Session):
        self.db = db
        self.report_dir = "stability_reconciliation/data"

    def generate_reconciliation_report(self, protocol_id: str, 
                                       reconciliation_batch_id: str,
                                       report_type: str = "summary",
                                       generated_by: str = "system") -> Report:
        protocol = self.db.query(TestProtocol).filter(
            TestProtocol.id == protocol_id
        ).first()
        
        if not protocol:
            raise ValueError(f"Protocol not found")
        
        records = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.reconciliation_batch_id == reconciliation_batch_id
        ).all()
        
        samples = self.db.query(Sample).filter(
            Sample.protocol_id == protocol_id
        ).all()
        
        summary_data = self._generate_summary_data(records, samples, protocol)
        
        if report_type == "detailed":
            file_path = self._generate_detailed_excel(records, samples, protocol, reconciliation_batch_id)
        elif report_type == "json":
            file_path = self._generate_json_report(records, samples, protocol, reconciliation_batch_id)
        else:
            file_path = self._generate_summary_excel(records, samples, protocol, reconciliation_batch_id)
        
        report_id = f"REPORT-{uuid.uuid4().hex[:8].upper()}"
        
        report = Report(
            id=report_id,
            report_type=report_type,
            protocol_id=protocol_id,
            reconciliation_batch_id=reconciliation_batch_id,
            generated_by=generated_by,
            generated_at=datetime.utcnow(),
            file_path=file_path,
            status="generated",
            summary_data=summary_data
        )
        
        self.db.add(report)
        self.db.commit()
        
        return report

    def _generate_summary_data(self, records: List[ReconciliationRecord],
                              samples: List[Sample], protocol: TestProtocol) -> Dict[str, Any]:
        total = len(records)
        matched = sum(1 for r in records if r.status == "matched")
        discrepancy = sum(1 for r in records if r.status == "discrepancy")
        resolved = sum(1 for r in records if r.is_resolved)
        pending = total - resolved
        
        discrepancy_types = {}
        discrepancy_sources = {}
        for r in records:
            if r.discrepancy_type:
                discrepancy_types[r.discrepancy_type] = discrepancy_types.get(r.discrepancy_type, 0) + 1
            if r.discrepancy_source:
                discrepancy_sources[r.discrepancy_source] = discrepancy_sources.get(r.discrepancy_source, 0) + 1
        
        return {
            "protocol_info": {
                "protocol_id": protocol.id,
                "protocol_name": protocol.protocol_name,
                "product_name": protocol.product_name,
                "batch_number": protocol.batch_number
            },
            "summary_statistics": {
                "total_records": total,
                "matched_records": matched,
                "discrepancy_records": discrepancy,
                "resolved_records": resolved,
                "pending_review": pending,
                "resolution_rate": resolved / total if total > 0 else 0
            },
            "discrepancy_breakdown": {
                "by_type": discrepancy_types,
                "by_source": discrepancy_sources
            },
            "sample_count": len(samples),
            "generated_at": datetime.utcnow().isoformat()
        }

    def _generate_summary_excel(self, records: List[ReconciliationRecord],
                               samples: List[Sample], protocol: TestProtocol,
                               batch_id: str) -> str:
        file_path = f"{self.report_dir}/reconciliation_summary_{batch_id}.xlsx"
        
        writer = pd.ExcelWriter(file_path, engine='xlsxwriter')
        
        summary_df = pd.DataFrame([{
            "项目": protocol.protocol_name,
            "产品": protocol.product_name,
            "批次号": protocol.batch_number,
            "对账批次": batch_id,
            "样品总数": len(samples),
            "匹配数": sum(1 for r in records if r.status == "matched"),
            "差异数": sum(1 for r in records if r.status == "discrepancy"),
            "已解决": sum(1 for r in records if r.is_resolved),
            "待审核": len(records) - sum(1 for r in records if r.is_resolved),
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
        return file_path

    def _generate_detailed_excel(self, records: List[ReconciliationRecord],
                                samples: List[Sample], protocol: TestProtocol,
                                batch_id: str) -> str:
        file_path = f"{self.report_dir}/reconciliation_detailed_{batch_id}.xlsx"
        
        writer = pd.ExcelWriter(file_path, engine='xlsxwriter')
        
        summary_df = pd.DataFrame([{
            "项目": protocol.protocol_name,
            "产品": protocol.product_name,
            "批次号": protocol.batch_number,
            "对账批次": batch_id,
            "样品总数": len(samples),
            "匹配数": sum(1 for r in records if r.status == "matched"),
            "差异数": sum(1 for r in records if r.status == "discrepancy"),
            "已解决": sum(1 for r in records if r.is_resolved),
            "待审核": len(records) - sum(1 for r in records if r.is_resolved),
            "生成时间": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        }])
        summary_df.to_excel(writer, sheet_name="汇总", index=False)
        
        discrepancy_data = []
        for record in records:
            if record.status == "discrepancy":
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
        return file_path

    def _generate_json_report(self, records: List[ReconciliationRecord],
                             samples: List[Sample], protocol: TestProtocol,
                             batch_id: str) -> str:
        file_path = f"{self.report_dir}/reconciliation_report_{batch_id}.json"
        
        report_data = {
            "protocol_info": {
                "id": protocol.id,
                "name": protocol.protocol_name,
                "product": protocol.product_name,
                "batch_number": protocol.batch_number
            },
            "reconciliation_batch": batch_id,
            "generated_at": datetime.utcnow().isoformat(),
            "summary": {
                "total_samples": len(samples),
                "total_records": len(records),
                "matched": sum(1 for r in records if r.status == "matched"),
                "discrepancy": sum(1 for r in records if r.status == "discrepancy"),
                "resolved": sum(1 for r in records if r.is_resolved)
            },
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
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return file_path

    def get_report_list(self, protocol_id: Optional[str] = None,
                       report_type: Optional[str] = None,
                       limit: int = 50) -> List[Report]:
        query = self.db.query(Report)
        
        if protocol_id:
            query = query.filter(Report.protocol_id == protocol_id)
        
        if report_type:
            query = query.filter(Report.report_type == report_type)
        
        query = query.order_by(Report.generated_at.desc()).limit(limit)
        
        return query.all()

    def get_report_content(self, report_id: str) -> Dict[str, Any]:
        report = self.db.query(Report).filter(Report.id == report_id).first()
        
        if not report:
            raise ValueError(f"Report not found")
        
        try:
            with open(report.file_path, 'r', encoding='utf-8') as f:
                content = json.load(f)
        except:
            content = {"summary": report.summary_data}
        
        return {
            "report_info": {
                "id": report.id,
                "type": report.report_type,
                "protocol_id": report.protocol_id,
                "reconciliation_batch_id": report.reconciliation_batch_id,
                "generated_by": report.generated_by,
                "generated_at": report.generated_at.isoformat(),
                "file_path": report.file_path
            },
            "summary": report.summary_data,
            "content": content
        }
