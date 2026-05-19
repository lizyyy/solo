from typing import List, Dict, Any
from sqlalchemy.orm import Session
import pandas as pd
from io import BytesIO

from src.services import OperationService, EquipmentService
from src.schemas import (
    ImportOperation,
    OccupyOperation,
    TransferOperation,
    ReturnOperation,
    LossOperation,
    QueryFilter
)
from src.models import OperationType, Equipment, StockSnapshot


class BatchOperationService:
    @staticmethod
    def process_batch(db: Session, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        results = []
        success_count = 0
        failed_count = 0

        for op_data in operations:
            op_type = op_data.get("operation_type")
            try:
                if op_type == OperationType.IMPORT.value:
                    data = ImportOperation(**op_data)
                    result = OperationService.handle_import(db, data)
                elif op_type == OperationType.OCCUPY.value:
                    data = OccupyOperation(**op_data)
                    result = OperationService.handle_occupy(db, data)
                elif op_type == OperationType.TRANSFER.value:
                    data = TransferOperation(**op_data)
                    result = OperationService.handle_transfer(db, data)
                elif op_type == OperationType.RETURN.value:
                    data = ReturnOperation(**op_data)
                    result = OperationService.handle_return(db, data)
                elif op_type == OperationType.LOSS.value:
                    data = LossOperation(**op_data)
                    result = OperationService.handle_loss(db, data)
                else:
                    result = {
                        "success": False,
                        "request_id": op_data.get("request_id", "unknown"),
                        "message": f"不支持的操作类型: {op_type}"
                    }

                if result.get("success"):
                    success_count += 1
                else:
                    failed_count += 1

                results.append(result)
            except Exception as e:
                failed_count += 1
                results.append({
                    "success": False,
                    "request_id": op_data.get("request_id", "unknown"),
                    "message": f"处理异常: {str(e)}"
                })

        return {
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results
        }


class ReportService:
    @staticmethod
    def export_records(db: Session, filter_params: QueryFilter, format: str = "xlsx") -> BytesIO:
        records = OperationService.query_records(db, filter_params)

        data = []
        for record in records:
            equipment = db.query(Equipment).filter(Equipment.id == record.equipment_id).first() if record.equipment_id else None

            data.append({
                "记录ID": record.id,
                "请求ID": record.request_id,
                "设备编号": equipment.code if equipment else "",
                "设备名称": equipment.name if equipment else "",
                "操作类型": record.operation_type.value,
                "数量": record.quantity,
                "展位": record.booth or "",
                "来源展位": record.from_booth or "",
                "目标展位": record.to_booth or "",
                "操作人": record.operator,
                "角色": record.role.value,
                "状态": record.status.value,
                "异常类型": record.exception_type.value,
                "备注": record.remark or "",
                "操作时间": record.operated_at.strftime("%Y-%m-%d %H:%M:%S"),
                "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        df = pd.DataFrame(data)
        output = BytesIO()

        if format.lower() == "csv":
            df.to_csv(output, index=False, encoding="utf-8-sig")
        else:
            df.to_excel(output, index=False, sheet_name="操作记录")

        output.seek(0)
        return output

    @staticmethod
    def export_stock_snapshot(db: Session, format: str = "xlsx") -> BytesIO:
        snapshots = db.query(StockSnapshot).order_by(StockSnapshot.snapshot_at.desc()).all()

        data = []
        for snapshot in snapshots:
            equipment = db.query(Equipment).filter(Equipment.id == snapshot.equipment_id).first()
            data.append({
                "设备编号": equipment.code if equipment else "",
                "设备名称": equipment.name if equipment else "",
                "设备类型": equipment.type.value if equipment else "",
                "总数量": snapshot.total_quantity,
                "可用数量": snapshot.available_quantity,
                "单位": equipment.unit if equipment else "",
                "快照时间": snapshot.snapshot_at.strftime("%Y-%m-%d %H:%M:%S")
            })

        df = pd.DataFrame(data)
        output = BytesIO()

        if format.lower() == "csv":
            df.to_csv(output, index=False, encoding="utf-8-sig")
        else:
            df.to_excel(output, index=False, sheet_name="库存快照")

        output.seek(0)
        return output

    @staticmethod
    def get_current_stock(db: Session) -> List[Dict[str, Any]]:
        equipments = EquipmentService.list_all(db)
        return [
            {
                "code": eq.code,
                "name": eq.name,
                "type": eq.type.value,
                "total_quantity": eq.total_quantity,
                "available_quantity": eq.available_quantity,
                "unit": eq.unit,
                "description": eq.description
            }
            for eq in equipments
        ]
