from datetime import datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import BatchTrace, MaterialRequisition, VehicleMaterial, Inventory


class BatchTraceService:
    ACTION_TYPES = {
        "in": "入库",
        "out": "出库",
        "requisition": "领料",
        "return": "归还",
        "adjust": "调整",
        "check": "盘点"
    }

    @staticmethod
    def trace_batch_history(db: Session, batch_no: str) -> Dict:
        traces = db.query(BatchTrace).filter(
            BatchTrace.batch_no == batch_no
        ).order_by(BatchTrace.operation_date.desc()).all()

        if not traces:
            return {
                "success": False,
                "error": "未找到该批次的追踪记录",
                "batch_no": batch_no
            }

        material_codes = set(t.material_code for t in traces)
        material_info = {}

        for mc in material_codes:
            inventory = db.query(Inventory).filter(
                Inventory.material_code == mc
            ).first()
            material_info[mc] = {
                "material_name": traces[0].material_name,
                "current_quantity": inventory.quantity if inventory else 0,
                "current_batch_no": inventory.batch_no if inventory else None,
                "unit": inventory.unit if inventory else ""
            }

        timeline = []
        for trace in traces:
            timeline.append({
                "id": trace.id,
                "batch_no": trace.batch_no,
                "material_code": trace.material_code,
                "material_name": trace.material_name,
                "source_type": trace.source_type,
                "source_no": trace.source_no,
                "action_type": trace.action_type,
                "action_type_name": BatchTraceService.ACTION_TYPES.get(trace.action_type, trace.action_type),
                "quantity": trace.quantity,
                "operator": trace.operator,
                "operation_date": trace.operation_date.isoformat() if trace.operation_date else None,
                "remark": trace.remark,
                "created_at": trace.created_at.isoformat()
            })

        return {
            "success": True,
            "batch_no": batch_no,
            "material_info": material_info,
            "timeline": timeline,
            "total_records": len(timeline)
        }

    @staticmethod
    def get_material_batch_list(db: Session, material_code: str = None) -> List[Dict]:
        query = db.query(BatchTrace)

        if material_code:
            query = query.filter(BatchTrace.material_code == material_code)

        traces = query.order_by(BatchTrace.batch_no, BatchTrace.operation_date.desc()).all()

        batch_groups = {}
        for trace in traces:
            if trace.batch_no not in batch_groups:
                batch_groups[trace.batch_no] = {
                    "batch_no": trace.batch_no,
                    "material_code": trace.material_code,
                    "material_name": trace.material_name,
                    "first_operation": None,
                    "last_operation": None,
                    "total_out": 0,
                    "total_in": 0,
                    "record_count": 0
                }

            group = batch_groups[trace.batch_no]
            group["record_count"] += 1

            op_date = trace.operation_date
            if op_date:
                if not group["first_operation"] or op_date < group["first_operation"]:
                    group["first_operation"] = op_date
                if not group["last_operation"] or op_date > group["last_operation"]:
                    group["last_operation"] = op_date

            if trace.action_type in ["in", "return"]:
                group["total_in"] += trace.quantity
            elif trace.action_type in ["out", "requisition"]:
                group["total_out"] += trace.quantity

        result = []
        for bg in batch_groups.values():
            result.append({
                "batch_no": bg["batch_no"],
                "material_code": bg["material_code"],
                "material_name": bg["material_name"],
                "first_operation": bg["first_operation"].isoformat() if bg["first_operation"] else None,
                "last_operation": bg["last_operation"].isoformat() if bg["last_operation"] else None,
                "total_in": bg["total_in"],
                "total_out": bg["total_out"],
                "balance": bg["total_in"] - bg["total_out"],
                "record_count": bg["record_count"]
            })

        return result

    @staticmethod
    def add_batch_trace(db: Session, batch_no: str, material_code: str, material_name: str,
                        action_type: str, quantity: float, operator: str, operation_date: datetime = None,
                        source_type: str = None, source_no: str = None, remark: str = None,
                        requisition_id: int = None) -> Dict:
        if operation_date is None:
            operation_date = datetime.now()

        trace = BatchTrace(
            batch_no=batch_no,
            material_code=material_code,
            material_name=material_name,
            source_type=source_type,
            source_no=source_no,
            action_type=action_type,
            quantity=quantity,
            operator=operator,
            operation_date=operation_date,
            remark=remark,
            requisition_id=requisition_id
        )
        db.add(trace)
        db.commit()

        return {
            "success": True,
            "trace_id": trace.id,
            "batch_no": batch_no
        }

    @staticmethod
    def trace_requisition_batch_source(db: Session, requisition_id: int) -> Dict:
        requisition = db.query(MaterialRequisition).filter(
            MaterialRequisition.id == requisition_id
        ).first()

        if not requisition:
            return {"success": False, "error": "领料单不存在"}

        if not requisition.batch_no:
            return {"success": False, "error": "该领料单没有批次号"}

        batch_history = BatchTraceService.trace_batch_history(db, requisition.batch_no)

        related_vehicles = db.query(VehicleMaterial).filter(
            VehicleMaterial.batch_no == requisition.batch_no
        ).all()

        return {
            "success": True,
            "requisition_no": requisition.requisition_no,
            "batch_no": requisition.batch_no,
            "material_code": requisition.material_code,
            "material_name": requisition.material_name,
            "quantity": requisition.quantity,
            "unit": requisition.unit,
            "batch_history": batch_history,
            "related_vehicles": [{
                "vehicle_no": v.vehicle_no,
                "check_date": v.check_date.isoformat() if v.check_date else None,
                "start_quantity": v.start_quantity,
                "end_quantity": v.end_quantity,
                "used_quantity": v.used_quantity
            } for v in related_vehicles]
        }
