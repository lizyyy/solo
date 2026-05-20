from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from app.models.models import (
    MaterialRequisition, VehicleMaterial, Inventory,
    ReconciliationDiff, ReconciliationSummary, BatchTrace, ReviewRecord
)


class ReconciliationService:
    DIFF_TYPES = {
        "EMERGENCY": "紧急领用差异",
        "RETURN": "归还差异",
        "NEGATIVE_INVENTORY": "库存负数",
        "QUANTITY_MISMATCH": "数量不匹配",
        "BATCH_MISMATCH": "批次不匹配",
        "MISSING_VEHICLE": "车辆数据缺失",
    }

    @staticmethod
    def run_auto_reconciliation(db: Session, check_date: datetime = None) -> Dict:
        if check_date is None:
            check_date = datetime.now()

        db.query(ReconciliationDiff).delete()
        db.commit()

        requisitions = db.query(MaterialRequisition).all()

        diff_results = []
        import uuid
        for idx, req in enumerate(requisitions):
            diffs = ReconciliationService._analyze_requisition_diff(db, req, idx)
            diff_results.extend(diffs)

        for diff_data in diff_results:
            diff = ReconciliationDiff(**diff_data)
            db.add(diff)

        summary = ReconciliationService._generate_summary(db, check_date)
        db.add(summary)

        ReconciliationService._check_negative_inventory(db, len(diff_results))

        db.commit()

        return {
            "success": True,
            "total_diffs": len(diff_results),
            "summary": ReconciliationService._summary_to_dict(summary)
        }

    @staticmethod
    def _analyze_requisition_diff(db: Session, req: MaterialRequisition, req_idx: int = 0) -> List[Dict]:
        diffs = []

        vehicle_materials = db.query(VehicleMaterial).filter(
            and_(
                VehicleMaterial.vehicle_no == req.vehicle_no,
                VehicleMaterial.material_code == req.material_code
            )
        ).all()

        inventory = db.query(Inventory).filter(
            Inventory.material_code == req.material_code
        ).first()

        vehicle_quantity = sum(vm.used_quantity for vm in vehicle_materials) if vehicle_materials else 0
        inventory_quantity = inventory.quantity if inventory else 0

        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')

        if req.is_emergency:
            diffs.append({
                "diff_no": f"DIFF_{timestamp}_{req_idx}_{len(diffs)}",
                "diff_type": "EMERGENCY",
                "requisition_id": req.id,
                "material_code": req.material_code,
                "material_name": req.material_name,
                "requisition_quantity": req.quantity,
                "vehicle_quantity": vehicle_quantity,
                "inventory_quantity": inventory_quantity,
                "diff_quantity": req.quantity - vehicle_quantity,
                "explanation": f"紧急领用，领料单号：{req.requisition_no}，数量：{req.quantity}{req.unit}。夜间抢修无手续出库，需后续补录",
                "status": "pending",
                "is_approved": False
            })

        if not vehicle_materials:
            diffs.append({
                "diff_no": f"DIFF_{timestamp}_{req_idx}_{len(diffs)}",
                "diff_type": "MISSING_VEHICLE",
                "requisition_id": req.id,
                "material_code": req.material_code,
                "material_name": req.material_name,
                "requisition_quantity": req.quantity,
                "vehicle_quantity": 0,
                "inventory_quantity": inventory_quantity,
                "diff_quantity": req.quantity,
                "explanation": f"车辆物资数据缺失，车牌号：{req.vehicle_no}，物资：{req.material_name}",
                "status": "pending",
                "is_approved": False
            })
        else:
            if abs(req.quantity - vehicle_quantity) > 0.001:
                diff_type = "RETURN" if req.quantity > vehicle_quantity else "QUANTITY_MISMATCH"
                diffs.append({
                    "diff_no": f"DIFF_{timestamp}_{req_idx}_{len(diffs)}",
                    "diff_type": diff_type,
                    "requisition_id": req.id,
                    "material_code": req.material_code,
                    "material_name": req.material_name,
                    "requisition_quantity": req.quantity,
                    "vehicle_quantity": vehicle_quantity,
                    "inventory_quantity": inventory_quantity,
                    "diff_quantity": req.quantity - vehicle_quantity,
                    "explanation": f"{'归还差异' if diff_type == 'RETURN' else '数量不匹配'}：领料单数量{req.quantity}{req.unit}，车辆实际使用{vehicle_quantity}{req.unit}，差异{abs(req.quantity - vehicle_quantity)}{req.unit}",
                    "status": "pending",
                    "is_approved": False
                })

            vehicle_batch_nos = set(vm.batch_no for vm in vehicle_materials if vm.batch_no)
            if req.batch_no and vehicle_batch_nos and req.batch_no not in vehicle_batch_nos:
                diffs.append({
                    "diff_no": f"DIFF_{timestamp}_{req_idx}_{len(diffs)}",
                    "diff_type": "BATCH_MISMATCH",
                    "requisition_id": req.id,
                    "material_code": req.material_code,
                    "material_name": req.material_name,
                    "requisition_quantity": req.quantity,
                    "vehicle_quantity": vehicle_quantity,
                    "inventory_quantity": inventory_quantity,
                    "diff_quantity": 0,
                    "explanation": f"批次不匹配：领料单批次{req.batch_no}，车辆物资批次：{', '.join(vehicle_batch_nos)}",
                    "status": "pending",
                    "is_approved": False
                })

        return diffs

    @staticmethod
    def _check_negative_inventory(db: Session, start_idx: int = 0):
        negative_items = db.query(Inventory).filter(Inventory.quantity < 0).all()
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')

        for idx, item in enumerate(negative_items):
            existing_diff = db.query(ReconciliationDiff).filter(
                and_(
                    ReconciliationDiff.diff_type == "NEGATIVE_INVENTORY",
                    ReconciliationDiff.material_code == item.material_code
                )
            ).first()

            if not existing_diff:
                diff = ReconciliationDiff(
                    diff_no=f"NEG_{timestamp}_{start_idx + idx}",
                    diff_type="NEGATIVE_INVENTORY",
                    material_code=item.material_code,
                    material_name=item.material_name,
                    requisition_quantity=0,
                    vehicle_quantity=0,
                    inventory_quantity=item.quantity,
                    diff_quantity=item.quantity,
                    explanation=f"库存负数预警：{item.material_name} 当前库存{item.quantity}{item.unit}，低于安全库存{item.safety_stock}{item.unit}",
                    status="pending",
                    is_approved=False
                )
                db.add(diff)

    @staticmethod
    def _generate_summary(db: Session, summary_date: datetime) -> ReconciliationSummary:
        existing = db.query(ReconciliationSummary).filter(
            func.date(ReconciliationSummary.summary_date) == summary_date.date()
        ).first()

        total_requisitions = db.query(MaterialRequisition).count()
        emergency_requisitions = db.query(MaterialRequisition).filter(
            MaterialRequisition.is_emergency == True
        ).count()

        total_diffs = db.query(ReconciliationDiff).count()
        resolved_diffs = db.query(ReconciliationDiff).filter(
            ReconciliationDiff.is_approved == True
        ).count()
        pending_diffs = total_diffs - resolved_diffs

        negative_inventory_count = db.query(ReconciliationDiff).filter(
            ReconciliationDiff.diff_type == "NEGATIVE_INVENTORY"
        ).count()
        return_diff_count = db.query(ReconciliationDiff).filter(
            ReconciliationDiff.diff_type == "RETURN"
        ).count()

        if existing:
            existing.total_requisitions = total_requisitions
            existing.emergency_requisitions = emergency_requisitions
            existing.total_diffs = total_diffs
            existing.resolved_diffs = resolved_diffs
            existing.pending_diffs = pending_diffs
            existing.negative_inventory_count = negative_inventory_count
            existing.return_diff_count = return_diff_count
            return existing
        else:
            return ReconciliationSummary(
                summary_date=summary_date,
                total_requisitions=total_requisitions,
                emergency_requisitions=emergency_requisitions,
                total_diffs=total_diffs,
                resolved_diffs=resolved_diffs,
                pending_diffs=pending_diffs,
                negative_inventory_count=negative_inventory_count,
                return_diff_count=return_diff_count
            )

    @staticmethod
    def _summary_to_dict(summary: ReconciliationSummary) -> Dict:
        return {
            "summary_date": summary.summary_date.isoformat(),
            "total_requisitions": summary.total_requisitions,
            "emergency_requisitions": summary.emergency_requisitions,
            "total_diffs": summary.total_diffs,
            "resolved_diffs": summary.resolved_diffs,
            "pending_diffs": summary.pending_diffs,
            "negative_inventory_count": summary.negative_inventory_count,
            "return_diff_count": summary.return_diff_count
        }

    @staticmethod
    def get_diff_list(db: Session, diff_type: str = None, status: str = None) -> List[Dict]:
        query = db.query(ReconciliationDiff)

        if diff_type:
            query = query.filter(ReconciliationDiff.diff_type == diff_type)
        if status:
            query = query.filter(ReconciliationDiff.status == status)

        diffs = query.all()

        return [{
            "id": diff.id,
            "diff_no": diff.diff_no,
            "diff_type": diff.diff_type,
            "diff_type_name": ReconciliationService.DIFF_TYPES.get(diff.diff_type, diff.diff_type),
            "material_code": diff.material_code,
            "material_name": diff.material_name,
            "requisition_quantity": diff.requisition_quantity,
            "vehicle_quantity": diff.vehicle_quantity,
            "inventory_quantity": diff.inventory_quantity,
            "diff_quantity": diff.diff_quantity,
            "explanation": diff.explanation,
            "status": diff.status,
            "is_approved": diff.is_approved,
            "approver": diff.approver,
            "approval_date": diff.approval_date.isoformat() if diff.approval_date else None,
            "created_at": diff.created_at.isoformat()
        } for diff in diffs]
