import pandas as pd
from datetime import datetime
from typing import List, Dict
from io import BytesIO
from sqlalchemy.orm import Session
from app.models import ReconciliationResult, ReconciliationBatch, ContractApplication, StampRecord, ApprovalRecord, ExpressRecord


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def get_batch_summary(self, batch_id: str) -> Dict:
        batch = self.db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
        if not batch:
            return {}

        results = self.db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id).all()

        pending_count = sum(1 for r in results if r.status.value == 'pending')

        return {
            "batch_id": batch.batch_id,
            "batch_name": batch.batch_name,
            "total_records": batch.total_records,
            "matched_count": batch.matched_count,
            "discrepancy_count": batch.discrepancy_count,
            "reviewed_count": batch.reviewed_count,
            "approved_count": batch.approved_count,
            "rejected_count": batch.rejected_count,
            "pending_count": pending_count,
            "status": batch.status,
            "created_at": batch.created_at,
            "completed_at": batch.completed_at
        }

    def get_reconciliation_details(self, batch_id: str, status_filter: str = None) -> List[Dict]:
        query = self.db.query(ReconciliationResult).filter(ReconciliationResult.batch_id == batch_id)

        if status_filter:
            query = query.filter(ReconciliationResult.status == status_filter)

        results = query.all()
        details = []

        for result in results:
            app = self.db.query(ContractApplication).filter(
                ContractApplication.application_no == result.application_no
            ).first()

            details.append({
                "id": result.id,
                "application_no": result.application_no,
                "contract_name": app.contract_name if app else None,
                "applicant": app.applicant if app else None,
                "department": app.department if app else None,
                "status": result.status.value,
                "discrepancy_types": result.discrepancy_types,
                "discrepancy_description": result.discrepancy_description,
                "is_unauthorized_stamp": result.is_unauthorized_stamp,
                "is_supplementary_attachment": result.is_supplementary_attachment,
                "is_withdrawal_resubmit": result.is_withdrawal_resubmit,
                "review_action": result.review_action,
                "reviewer": result.reviewer,
                "final_disposition": result.final_disposition,
                "created_at": result.created_at
            })

        return details

    def get_full_chain_detail(self, reconciliation_result_id: int) -> Dict:
        result = self.db.query(ReconciliationResult).filter(
            ReconciliationResult.id == reconciliation_result_id
        ).first()

        if not result:
            return {}

        app = self.db.query(ContractApplication).filter(
            ContractApplication.application_no == result.application_no
        ).first()

        stamps = self.db.query(StampRecord).filter(
            StampRecord.application_no == result.application_no
        ).all()

        approvals = self.db.query(ApprovalRecord).filter(
            ApprovalRecord.application_no == result.application_no
        ).all()

        expresses = self.db.query(ExpressRecord).filter(
            ExpressRecord.application_no == result.application_no
        ).all()

        return {
            "reconciliation_result": result,
            "application": app,
            "stamp_records": stamps,
            "approval_records": approvals,
            "express_records": expresses
        }

    def export_to_excel(self, batch_id: str, output_path: str = None) -> BytesIO:
        summary = self.get_batch_summary(batch_id)
        details = self.get_reconciliation_details(batch_id)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            summary_df = pd.DataFrame([summary])
            summary_df.to_excel(writer, sheet_name='汇总', index=False)

            details_df = pd.DataFrame(details)
            details_df.to_excel(writer, sheet_name='明细', index=False)

            discrepancy_details = []
            for detail in details:
                if detail.get('discrepancy_description'):
                    discrepancy_details.append(detail)

            if discrepancy_details:
                discrepancy_df = pd.DataFrame(discrepancy_details)
                discrepancy_df.to_excel(writer, sheet_name='差异明细', index=False)

        output.seek(0)

        if output_path:
            with open(output_path, 'wb') as f:
                f.write(output.getvalue())

        return output

    def export_single_detail_excel(self, reconciliation_result_id: int, output_path: str = None) -> BytesIO:
        detail = self.get_full_chain_detail(reconciliation_result_id)

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            result_data = {
                '申请编号': [detail['application'].application_no if detail.get('application') else ''],
                '合同名称': [detail['application'].contract_name if detail.get('application') else ''],
                '对账状态': [detail['reconciliation_result'].status.value if detail.get('reconciliation_result') else ''],
                '差异说明': [detail['reconciliation_result'].discrepancy_description if detail.get('reconciliation_result') else ''],
                '最终处理': [detail['reconciliation_result'].final_disposition if detail.get('reconciliation_result') else ''],
                '复核人': [detail['reconciliation_result'].reviewer if detail.get('reconciliation_result') else '']
            }
            pd.DataFrame(result_data).to_excel(writer, sheet_name='基本信息', index=False)

            if detail.get('stamp_records'):
                stamp_data = []
                for s in detail['stamp_records']:
                    stamp_data.append({
                        '盖章日期': s.stamp_date,
                        '盖章人': s.stamp_operator,
                        '印章类型': s.stamp_type,
                        '是否补盖': '是' if s.is_supplementary else '否',
                        '是否撤回': '是' if s.is_withdrawn else '否',
                        '备注': s.remarks
                    })
                pd.DataFrame(stamp_data).to_excel(writer, sheet_name='盖章记录', index=False)

            if detail.get('approval_records'):
                approval_data = []
                for a in detail['approval_records']:
                    approval_data.append({
                        '审批层级': a.approval_level,
                        '审批人': a.approver,
                        '审批日期': a.approval_date,
                        '审批结果': a.approval_result,
                        '是否授权': '是' if a.is_authorised else '否',
                        '审批意见': a.approval_opinion
                    })
                pd.DataFrame(approval_data).to_excel(writer, sheet_name='审批记录', index=False)

            if detail.get('express_records'):
                express_data = []
                for e in detail['express_records']:
                    express_data.append({
                        '快递公司': e.express_company,
                        '运单号': e.tracking_no,
                        '收件人': e.recipient,
                        '寄出日期': e.send_date,
                        '签收日期': e.receive_date,
                        '是否签收': '是' if e.is_received else '否'
                    })
                pd.DataFrame(express_data).to_excel(writer, sheet_name='快递记录', index=False)

        output.seek(0)

        if output_path:
            with open(output_path, 'wb') as f:
                f.write(output.getvalue())

        return output

    def generate_statistics_report(self, start_date: datetime = None, end_date: datetime = None) -> Dict:
        batches = self.db.query(ReconciliationBatch)

        if start_date:
            batches = batches.filter(ReconciliationBatch.created_at >= start_date)
        if end_date:
            batches = batches.filter(ReconciliationBatch.created_at <= end_date)

        batches = batches.all()

        total_batches = len(batches)
        total_records = sum(b.total_records for b in batches)
        total_matched = sum(b.matched_count for b in batches)
        total_discrepancy = sum(b.discrepancy_count for b in batches)
        total_approved = sum(b.approved_count for b in batches)
        total_rejected = sum(b.rejected_count for b in batches)

        discrepancy_breakdown = {}
        results = self.db.query(ReconciliationResult).all()
        for r in results:
            if r.discrepancy_types:
                for dt in r.discrepancy_types.split(','):
                    discrepancy_breakdown[dt] = discrepancy_breakdown.get(dt, 0) + 1

        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date
            },
            "summary": {
                "total_batches": total_batches,
                "total_records": total_records,
                "total_matched": total_matched,
                "total_discrepancy": total_discrepancy,
                "total_approved": total_approved,
                "total_rejected": total_rejected,
                "match_rate": (total_matched / total_records * 100) if total_records > 0 else 0,
                "approval_rate": (total_approved / total_records * 100) if total_records > 0 else 0
            },
            "discrepancy_breakdown": discrepancy_breakdown
        }
