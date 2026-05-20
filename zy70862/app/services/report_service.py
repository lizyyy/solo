import pandas as pd
from datetime import datetime
from typing import Dict
from sqlalchemy.orm import Session
from io import BytesIO
from app.models.models import ReconciliationDiff, MaterialRequisition, ReconciliationSummary, ReviewRecord
from app.services.reconciliation_service import ReconciliationService


class ReportService:
    @staticmethod
    def generate_reconciliation_report(db: Session, report_date: datetime = None) -> Dict:
        if report_date is None:
            report_date = datetime.now()

        summary = db.query(ReconciliationSummary).filter(
            ReconciliationSummary.summary_date <= report_date
        ).order_by(ReconciliationSummary.summary_date.desc()).first()

        if not summary:
            return {"success": False, "error": "没有对账数据"}

        diffs = db.query(ReconciliationDiff).all()
        requisitions = db.query(MaterialRequisition).all()
        review_records = db.query(ReviewRecord).order_by(ReviewRecord.review_date.desc()).all()

        diff_by_type = {}
        for diff in diffs:
            dtype = diff.diff_type
            if dtype not in diff_by_type:
                diff_by_type[dtype] = {
                    "name": ReconciliationService.DIFF_TYPES.get(dtype, dtype),
                    "count": 0,
                    "approved": 0,
                    "pending": 0,
                    "rejected": 0
                }
            diff_by_type[dtype]["count"] += 1
            if diff.is_approved:
                diff_by_type[dtype]["approved"] += 1
            elif diff.status == "pending":
                diff_by_type[dtype]["pending"] += 1
            elif diff.status == "rejected":
                diff_by_type[dtype]["rejected"] += 1

        requisition_status_summary = {}
        for req in requisitions:
            status = req.status
            if status not in requisition_status_summary:
                requisition_status_summary[status] = 0
            requisition_status_summary[status] += 1

        return {
            "success": True,
            "report_date": report_date.isoformat(),
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_requisitions": summary.total_requisitions,
                "emergency_requisitions": summary.emergency_requisitions,
                "total_diffs": summary.total_diffs,
                "resolved_diffs": summary.resolved_diffs,
                "pending_diffs": summary.pending_diffs,
                "negative_inventory_count": summary.negative_inventory_count,
                "return_diff_count": summary.return_diff_count,
                "resolution_rate": round(summary.resolved_diffs / summary.total_diffs * 100, 2) if summary.total_diffs > 0 else 0
            },
            "diff_by_type": diff_by_type,
            "requisition_status_summary": requisition_status_summary,
            "recent_reviews": [{
                "id": rr.id,
                "reviewer": rr.reviewer,
                "review_date": rr.review_date.isoformat(),
                "review_status": rr.review_status,
                "review_remark": rr.review_remark
            } for rr in review_records[:10]]
        }

    @staticmethod
    def export_diffs_to_excel(db: Session, diff_type: str = None, status: str = None) -> BytesIO:
        diffs = ReconciliationService.get_diff_list(db, diff_type, status)

        data = []
        for diff in diffs:
            data.append({
                "差异编号": diff["diff_no"],
                "差异类型": diff["diff_type_name"],
                "物资编码": diff["material_code"],
                "物资名称": diff["material_name"],
                "领料单数量": diff["requisition_quantity"],
                "车辆使用数量": diff["vehicle_quantity"],
                "库存数量": diff["inventory_quantity"],
                "差异数量": diff["diff_quantity"],
                "差异说明": diff["explanation"],
                "状态": diff["status"],
                "是否批准": "是" if diff["is_approved"] else "否",
                "批准人": diff["approver"] or "",
                "批准日期": diff["approval_date"] or "",
                "创建时间": diff["created_at"]
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='差异明细', index=False)

        output.seek(0)
        return output

    @staticmethod
    def export_requisitions_to_excel(db: Session) -> BytesIO:
        requisitions = db.query(MaterialRequisition).all()

        data = []
        for req in requisitions:
            data.append({
                "领料单号": req.requisition_no,
                "抢修队": req.repair_team,
                "车牌号": req.vehicle_no,
                "领料日期": req.requisition_date.strftime('%Y-%m-%d') if req.requisition_date else "",
                "物资编码": req.material_code,
                "物资名称": req.material_name,
                "规格型号": req.specification,
                "数量": req.quantity,
                "单位": req.unit,
                "批次号": req.batch_no,
                "是否紧急": "是" if req.is_emergency else "否",
                "操作员": req.operator,
                "状态": req.status,
                "创建时间": req.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                "更新时间": req.updated_at.strftime('%Y-%m-%d %H:%M:%S')
            })

        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='领料单明细', index=False)

        output.seek(0)
        return output

    @staticmethod
    def export_full_reconciliation_report(db: Session) -> BytesIO:
        diffs = ReconciliationService.get_diff_list(db)
        requisitions = db.query(MaterialRequisition).all()
        summaries = db.query(ReconciliationSummary).order_by(ReconciliationSummary.summary_date.desc()).all()

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            summary_data = []
            for s in summaries:
                summary_data.append({
                    "汇总日期": s.summary_date.strftime('%Y-%m-%d') if s.summary_date else "",
                    "领料单总数": s.total_requisitions,
                    "紧急领用数": s.emergency_requisitions,
                    "差异总数": s.total_diffs,
                    "已解决差异": s.resolved_diffs,
                    "待处理差异": s.pending_diffs,
                    "库存负数预警": s.negative_inventory_count,
                    "归还差异数": s.return_diff_count
                })
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='对账汇总', index=False)

            diff_data = []
            for diff in diffs:
                diff_data.append({
                    "差异编号": diff["diff_no"],
                    "差异类型": diff["diff_type_name"],
                    "物资编码": diff["material_code"],
                    "物资名称": diff["material_name"],
                    "领料单数量": diff["requisition_quantity"],
                    "车辆使用数量": diff["vehicle_quantity"],
                    "库存数量": diff["inventory_quantity"],
                    "差异数量": diff["diff_quantity"],
                    "差异说明": diff["explanation"],
                    "状态": diff["status"],
                    "是否批准": "是" if diff["is_approved"] else "否",
                    "批准人": diff["approver"] or "",
                    "批准日期": diff["approval_date"] or ""
                })
            pd.DataFrame(diff_data).to_excel(writer, sheet_name='差异明细', index=False)

            req_data = []
            for req in requisitions:
                req_data.append({
                    "领料单号": req.requisition_no,
                    "抢修队": req.repair_team,
                    "车牌号": req.vehicle_no,
                    "领料日期": req.requisition_date.strftime('%Y-%m-%d') if req.requisition_date else "",
                    "物资编码": req.material_code,
                    "物资名称": req.material_name,
                    "数量": req.quantity,
                    "单位": req.unit,
                    "批次号": req.batch_no,
                    "是否紧急": "是" if req.is_emergency else "否",
                    "状态": req.status
                })
            pd.DataFrame(req_data).to_excel(writer, sheet_name='领料单明细', index=False)

        output.seek(0)
        return output
