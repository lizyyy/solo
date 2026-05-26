from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple
from datetime import datetime

from app.models.models import (
    ConstructionNode, PhotoRecord, RectificationOrder,
    ReconciliationResult, ReconciliationDetail
)
from app.utils.helpers import calculate_overdue_days, generate_batch_no
from app.schemas.schemas import PhotoStatus, FinalStatus


class AutoCheckEngine:
    def __init__(self, db: Session):
        self.db = db

    def run_auto_reconciliation(self, project_id: int) -> ReconciliationResult:
        nodes = self.db.query(ConstructionNode).filter(
            ConstructionNode.project_id == project_id
        ).all()

        batch_no = generate_batch_no()
        
        result = ReconciliationResult(
            project_id=project_id,
            batch_no=batch_no,
            status="auto_completed"
        )
        self.db.add(result)
        self.db.flush()

        total_nodes = len(nodes)
        completed_nodes = 0
        missing_photo_nodes = 0
        overdue_nodes = 0
        total_rework_count = 0
        total_fine_amount = 0.0
        total_node_amount = 0.0

        for node in nodes:
            detail = self._check_single_node(node, result.id)
            self.db.add(detail)
            
            total_node_amount += node.node_amount
            
            if detail.photo_status == PhotoStatus.COMPLETE and not detail.is_overdue:
                completed_nodes += 1
            if detail.photo_status != PhotoStatus.COMPLETE:
                missing_photo_nodes += 1
            if detail.is_overdue:
                overdue_nodes += 1
            total_rework_count += detail.rework_count
            total_fine_amount += detail.fine_amount

        result.total_nodes = total_nodes
        result.completed_nodes = completed_nodes
        result.missing_photo_nodes = missing_photo_nodes
        result.overdue_nodes = overdue_nodes
        result.rework_count = total_rework_count
        result.total_fine_amount = total_fine_amount
        result.payable_amount = max(0.0, total_node_amount - total_fine_amount)

        self.db.commit()
        self.db.refresh(result)
        return result

    def _check_single_node(self, node: ConstructionNode, result_id: int) -> ReconciliationDetail:
        actual_photos = self.db.query(PhotoRecord).filter(
            PhotoRecord.node_id == node.id
        ).count()

        rectifications = self.db.query(RectificationOrder).filter(
            RectificationOrder.project_id == node.project_id,
            RectificationOrder.node_id == node.id
        ).all()

        is_overdue = False
        overdue_days = 0
        if node.planned_date and node.actual_date:
            overdue_days = calculate_overdue_days(node.planned_date, node.actual_date)
            is_overdue = overdue_days > 0

        photo_status = self._determine_photo_status(node.required_photos, actual_photos)
        rework_count = sum(r.rework_count for r in rectifications)
        total_fine = sum(r.fine_amount for r in rectifications)
        has_rectification = len(rectifications) > 0
        has_rework = any(r.is_rework for r in rectifications)

        auto_check_result = self._generate_auto_check_result(
            node, actual_photos, rectifications, is_overdue, overdue_days, photo_status
        )

        difference_explanation = self._generate_difference_explanation(
            node, actual_photos, photo_status, is_overdue, overdue_days,
            has_rectification, rework_count, has_rework, rectifications
        )

        final_status = self._determine_final_status(
            photo_status, is_overdue, has_rework, rectifications
        )

        return ReconciliationDetail(
            reconciliation_result_id=result_id,
            node_id=node.id,
            node_name=node.node_name,
            node_type=node.node_type,
            node_amount=node.node_amount,
            planned_date=node.planned_date,
            actual_date=node.actual_date,
            required_photos=node.required_photos,
            actual_photos=actual_photos,
            photo_status=photo_status,
            is_overdue=is_overdue,
            overdue_days=overdue_days,
            has_rectification=has_rectification,
            rectification_count=len(rectifications),
            rework_count=rework_count,
            fine_amount=total_fine,
            is_rework=has_rework,
            final_status=final_status,
            difference_explanation=difference_explanation,
            auto_check_result=auto_check_result
        )

    def _determine_photo_status(self, required: int, actual: int) -> str:
        if required <= 0:
            return PhotoStatus.UNKNOWN
        if actual >= required:
            return PhotoStatus.COMPLETE
        if actual == 0:
            return PhotoStatus.MISSING
        return PhotoStatus.PARTIAL

    def _generate_auto_check_result(
        self, node: ConstructionNode, actual_photos: int,
        rectifications: List[RectificationOrder],
        is_overdue: bool, overdue_days: int, photo_status: str
    ) -> Dict[str, Any]:
        return {
            "node_info": {
                "node_code": node.node_code,
                "node_name": node.node_name,
                "node_type": node.node_type,
                "planned_date": node.planned_date.isoformat() if node.planned_date else None,
                "actual_date": node.actual_date.isoformat() if node.actual_date else None,
            },
            "photo_check": {
                "required": node.required_photos,
                "actual": actual_photos,
                "status": photo_status,
                "missing_count": max(0, node.required_photos - actual_photos)
            },
            "overdue_check": {
                "is_overdue": is_overdue,
                "overdue_days": overdue_days,
                "planned_date": node.planned_date.isoformat() if node.planned_date else None,
                "actual_date": node.actual_date.isoformat() if node.actual_date else None
            },
            "rectification_check": {
                "total_rectifications": len(rectifications),
                "rework_count": sum(r.rework_count for r in rectifications),
                "has_rework": any(r.is_rework for r in rectifications),
                "total_fine": sum(r.fine_amount for r in rectifications),
                "rectification_details": [
                    {
                        "order_no": r.order_no,
                        "issue": r.issue_description,
                        "is_rework": r.is_rework,
                        "rework_count": r.rework_count,
                        "fine_amount": r.fine_amount,
                        "status": r.rectification_status
                    } for r in rectifications
                ]
            }
        }

    def _generate_difference_explanation(
        self, node: ConstructionNode, actual_photos: int, photo_status: str,
        is_overdue: bool, overdue_days: int, has_rectification: bool,
        rework_count: int, has_rework: bool, rectifications: List[RectificationOrder]
    ) -> str:
        explanations = []

        if photo_status == PhotoStatus.MISSING:
            explanations.append(
                f"缺照片：要求{node.required_photos}张，实际上传0张"
            )
        elif photo_status == PhotoStatus.PARTIAL:
            missing = node.required_photos - actual_photos
            explanations.append(
                f"照片不全：要求{node.required_photos}张，实际{actual_photos}张，缺{missing}张"
            )

        if is_overdue:
            explanations.append(
                f"逾期完成：计划{node.planned_date.strftime('%Y-%m-%d') if node.planned_date else '未知'}，"
                f"实际{node.actual_date.strftime('%Y-%m-%d') if node.actual_date else '未知'}，逾期{overdue_days}天"
            )

        if has_rework:
            rework_orders = [r for r in rectifications if r.is_rework]
            if rework_orders:
                issues = "、".join([r.issue_description[:20] for r in rework_orders if r.issue_description])
                explanations.append(
                    f"存在返工复验：共{rework_count}次返工，原因：{issues}"
                )

        if has_rectification and not has_rework:
            normal_rect = [r for r in rectifications if not r.is_rework]
            if normal_rect:
                issues = "、".join([r.issue_description[:20] for r in normal_rect if r.issue_description])
                explanations.append(
                    f"存在整改记录：共{len(normal_rect)}条整改，问题：{issues}"
                )

        return "；".join(explanations) if explanations else "数据完整，无异常"

    def _determine_final_status(
        self, photo_status: str, is_overdue: bool, has_rework: bool,
        rectifications: List[RectificationOrder]
    ) -> str:
        if photo_status == PhotoStatus.MISSING:
            return FinalStatus.NEED_MATERIAL
        if photo_status == PhotoStatus.PARTIAL:
            return FinalStatus.NEED_MATERIAL
        if has_rework:
            unfinished_rework = [r for r in rectifications if r.is_rework and r.rectification_status != "completed"]
            if unfinished_rework:
                return FinalStatus.REJECTED
        if is_overdue:
            return FinalStatus.REJECTED
        if photo_status == PhotoStatus.COMPLETE and not is_overdue and not has_rework:
            return FinalStatus.APPROVED
        return FinalStatus.PENDING
