from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import (
    MaterialRequisition, ReconciliationDiff, ReviewRecord,
    ReconciliationSummary, BatchTrace, Inventory
)
from app.services.reconciliation_service import ReconciliationService


class ReviewService:
    REVIEW_STATUSES = ["approved", "rejected", "need_material"]
    REQUISITION_STATUSES = ["pending", "reviewing", "approved", "rejected", "completed"]

    @staticmethod
    def review_diff(db: Session, diff_id: int, reviewer: str, review_status: str,
                    review_remark: str = None, diff_explanation: str = None) -> Dict:
        if review_status not in ["approved", "rejected", "need_material"]:
            return {"success": False, "error": "无效的复核状态"}

        diff = db.query(ReconciliationDiff).filter(ReconciliationDiff.id == diff_id).first()
        if not diff:
            return {"success": False, "error": "差异记录不存在"}

        previous_status = diff.status

        diff.status = review_status
        diff.is_approved = (review_status == "approved")
        diff.approver = reviewer
        diff.approval_date = datetime.now()

        review_record = ReviewRecord(
            requisition_id=diff.requisition_id,
            reviewer=reviewer,
            review_status=review_status,
            review_remark=review_remark,
            previous_status=previous_status,
            diff_explanation=diff_explanation
        )
        db.add(review_record)

        if diff.requisition_id:
            requisition = db.query(MaterialRequisition).filter(
                MaterialRequisition.id == diff.requisition_id
            ).first()
            if requisition:
                if review_status == "approved":
                    requisition.status = "approved"
                elif review_status == "rejected":
                    requisition.status = "rejected"
                elif review_status == "need_material":
                    requisition.status = "need_material"

        ReconciliationService._generate_summary(db, datetime.now())

        db.commit()

        return {
            "success": True,
            "diff_id": diff_id,
            "review_status": review_status,
            "reviewer": reviewer,
            "review_record_id": review_record.id
        }

    @staticmethod
    def batch_review_diffs(db: Session, diff_ids: List[int], reviewer: str,
                           review_status: str, review_remark: str = None) -> Dict:
        results = []
        for diff_id in diff_ids:
            result = ReviewService.review_diff(db, diff_id, reviewer, review_status, review_remark)
            results.append(result)

        success_count = sum(1 for r in results if r.get("success"))
        failed_count = len(results) - success_count

        return {
            "success": True,
            "total_count": len(diff_ids),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results
        }

    @staticmethod
    def update_requisition_and_recalculate(db: Session, requisition_id: int,
                                           updates: Dict) -> Dict:
        requisition = db.query(MaterialRequisition).filter(
            MaterialRequisition.id == requisition_id
        ).first()

        if not requisition:
            return {"success": False, "error": "领料单不存在"}

        for key, value in updates.items():
            if hasattr(requisition, key):
                setattr(requisition, key, value)

        requisition.updated_at = datetime.now()

        if "batch_no" in updates or "quantity" in updates:
            existing_trace = db.query(BatchTrace).filter(
                BatchTrace.requisition_id == requisition_id
            ).first()
            if existing_trace:
                existing_trace.batch_no = updates.get("batch_no", existing_trace.batch_no)
                existing_trace.quantity = updates.get("quantity", existing_trace.quantity)
                existing_trace.remark = f"复核更新: 数量={requisition.quantity}, 批次={requisition.batch_no}"

        db.query(ReconciliationDiff).filter(
            ReconciliationDiff.requisition_id == requisition_id
        ).delete()

        new_diffs = ReconciliationService._analyze_requisition_diff(db, requisition)
        for diff_data in new_diffs:
            diff = ReconciliationDiff(**diff_data)
            db.add(diff)

        ReconciliationService._check_negative_inventory(db)
        ReconciliationService._generate_summary(db, datetime.now())

        db.commit()

        ReconciliationService.run_auto_reconciliation(db)

        return {
            "success": True,
            "requisition_id": requisition_id,
            "new_diffs_count": len(new_diffs)
        }

    @staticmethod
    def get_review_history(db: Session, requisition_id: int = None) -> List[Dict]:
        query = db.query(ReviewRecord)

        if requisition_id:
            query = query.filter(ReviewRecord.requisition_id == requisition_id)

        records = query.order_by(ReviewRecord.review_date.desc()).all()

        return [{
            "id": record.id,
            "requisition_id": record.requisition_id,
            "reviewer": record.reviewer,
            "review_date": record.review_date.isoformat(),
            "review_status": record.review_status,
            "review_remark": record.review_remark,
            "previous_status": record.previous_status,
            "diff_explanation": record.diff_explanation,
            "created_at": record.created_at.isoformat()
        } for record in records]

    @staticmethod
    def get_requisition_detail(db: Session, requisition_id: int) -> Dict:
        requisition = db.query(MaterialRequisition).filter(
            MaterialRequisition.id == requisition_id
        ).first()

        if not requisition:
            return {"success": False, "error": "领料单不存在"}

        diffs = db.query(ReconciliationDiff).filter(
            ReconciliationDiff.requisition_id == requisition_id
        ).all()

        review_records = db.query(ReviewRecord).filter(
            ReviewRecord.requisition_id == requisition_id
        ).order_by(ReviewRecord.review_date.desc()).all()

        batch_traces = db.query(BatchTrace).filter(
            BatchTrace.requisition_id == requisition_id
        ).all()

        return {
            "success": True,
            "requisition": {
                "id": requisition.id,
                "requisition_no": requisition.requisition_no,
                "repair_team": requisition.repair_team,
                "vehicle_no": requisition.vehicle_no,
                "requisition_date": requisition.requisition_date.isoformat(),
                "material_code": requisition.material_code,
                "material_name": requisition.material_name,
                "specification": requisition.specification,
                "quantity": requisition.quantity,
                "unit": requisition.unit,
                "batch_no": requisition.batch_no,
                "is_emergency": requisition.is_emergency,
                "operator": requisition.operator,
                "status": requisition.status,
                "created_at": requisition.created_at.isoformat(),
                "updated_at": requisition.updated_at.isoformat()
            },
            "diffs": [{
                "id": diff.id,
                "diff_no": diff.diff_no,
                "diff_type": diff.diff_type,
                "diff_type_name": ReconciliationService.DIFF_TYPES.get(diff.diff_type, diff.diff_type),
                "explanation": diff.explanation,
                "status": diff.status,
                "is_approved": diff.is_approved
            } for diff in diffs],
            "review_records": [{
                "id": rr.id,
                "reviewer": rr.reviewer,
                "review_date": rr.review_date.isoformat(),
                "review_status": rr.review_status,
                "review_remark": rr.review_remark,
                "diff_explanation": rr.diff_explanation
            } for rr in review_records],
            "batch_traces": [{
                "id": bt.id,
                "batch_no": bt.batch_no,
                "action_type": bt.action_type,
                "quantity": bt.quantity,
                "operator": bt.operator,
                "operation_date": bt.operation_date.isoformat() if bt.operation_date else None,
                "remark": bt.remark
            } for bt in batch_traces]
        }
