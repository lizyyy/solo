from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import json

from src.models import (
    Equipment,
    OperationRecord,
    AuditLog,
    StockSnapshot,
    OperationType,
    OperationStatus,
    ExceptionType,
    RoleType
)
from src.schemas import (
    ImportOperation,
    OccupyOperation,
    TransferOperation,
    ReturnOperation,
    LossOperation,
    QueryFilter
)


class EquipmentService:
    @staticmethod
    def get_by_code(db: Session, code: str) -> Optional[Equipment]:
        return db.query(Equipment).filter(Equipment.code == code).first()

    @staticmethod
    def create(db: Session, code: str, name: str, type: str, total_quantity: int,
               unit: str, description: Optional[str] = None) -> Equipment:
        equipment = Equipment(
            code=code,
            name=name,
            type=type,
            total_quantity=total_quantity,
            available_quantity=total_quantity,
            unit=unit,
            description=description
        )
        db.add(equipment)
        db.commit()
        db.refresh(equipment)
        return equipment

    @staticmethod
    def update_stock(db: Session, equipment_id: int, quantity_change: int) -> Equipment:
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if equipment:
            old_total = equipment.total_quantity
            old_available = equipment.available_quantity
            equipment.total_quantity += quantity_change
            equipment.available_quantity += quantity_change
            equipment.updated_at = datetime.now()
            db.commit()
            db.refresh(equipment)
            EquipmentService.create_snapshot(db, equipment.id)
        return equipment

    @staticmethod
    def create_snapshot(db: Session, equipment_id: int):
        equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
        if equipment:
            snapshot = StockSnapshot(
                equipment_id=equipment.id,
                total_quantity=equipment.total_quantity,
                available_quantity=equipment.available_quantity,
                snapshot_at=datetime.now()
            )
            db.add(snapshot)
            db.commit()

    @staticmethod
    def list_all(db: Session) -> List[Equipment]:
        return db.query(Equipment).all()


class OperationService:
    @staticmethod
    def check_duplicate_request(db: Session, request_id: str) -> Optional[OperationRecord]:
        return db.query(OperationRecord).filter(OperationRecord.request_id == request_id).first()

    @staticmethod
    def create_audit_log(db: Session, record_id: int, action: str, operator: str,
                         role: RoleType, old_value: Optional[str] = None,
                         new_value: Optional[str] = None):
        audit_log = AuditLog(
            record_id=record_id,
            action=action,
            operator=operator,
            role=role,
            old_value=old_value,
            new_value=new_value
        )
        db.add(audit_log)
        db.commit()

    @staticmethod
    def create_record(db: Session, request_id: str, equipment_id: int,
                      operation_type: OperationType, quantity: int,
                      operator: str, role: RoleType, operated_at: datetime,
                      status: OperationStatus, exception_type: ExceptionType = ExceptionType.NONE,
                      booth: Optional[str] = None, from_booth: Optional[str] = None,
                      to_booth: Optional[str] = None, remark: Optional[str] = None) -> OperationRecord:
        record = OperationRecord(
            request_id=request_id,
            equipment_id=equipment_id,
            operation_type=operation_type,
            quantity=quantity,
            booth=booth,
            from_booth=from_booth,
            to_booth=to_booth,
            operator=operator,
            role=role,
            status=status,
            exception_type=exception_type,
            remark=remark,
            operated_at=operated_at
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @classmethod
    def handle_import(cls, db: Session, data: ImportOperation) -> Dict[str, Any]:
        duplicate = cls.check_duplicate_request(db, data.request_id)
        if duplicate:
            return {
                "success": True,
                "duplicate": True,
                "record_id": duplicate.id,
                "request_id": data.request_id,
                "message": "重复请求，已返回原有记录"
            }

        equipment = EquipmentService.get_by_code(db, data.equipment_code)
        if not equipment:
            record = cls.create_record(
                db, data.request_id, 0, OperationType.IMPORT, data.quantity,
                data.operator, data.role, data.operated_at, OperationStatus.FAILED,
                ExceptionType.INVALID_EQUIPMENT, remark="设备不存在"
            )
            return {
                "success": False,
                "record_id": record.id,
                "request_id": data.request_id,
                "exception_type": ExceptionType.INVALID_EQUIPMENT.value,
                "message": "设备不存在"
            }

        old_value = json.dumps({"available": equipment.available_quantity, "total": equipment.total_quantity})
        equipment.available_quantity += data.quantity
        equipment.total_quantity += data.quantity
        equipment.updated_at = datetime.now()
        db.commit()
        db.refresh(equipment)

        new_value = json.dumps({"available": equipment.available_quantity, "total": equipment.total_quantity})

        record = cls.create_record(
            db, data.request_id, equipment.id, OperationType.IMPORT, data.quantity,
            data.operator, data.role, data.operated_at, OperationStatus.SUCCESS,
            remark=data.remark
        )

        cls.create_audit_log(db, record.id, "import", data.operator, data.role, old_value, new_value)
        EquipmentService.create_snapshot(db, equipment.id)

        return {
            "success": True,
            "record_id": record.id,
            "request_id": data.request_id,
            "equipment_code": data.equipment_code,
            "quantity": data.quantity,
            "new_available": equipment.available_quantity,
            "message": "导入成功"
        }

    @classmethod
    def handle_occupy(cls, db: Session, data: OccupyOperation) -> Dict[str, Any]:
        duplicate = cls.check_duplicate_request(db, data.request_id)
        if duplicate:
            return {
                "success": True,
                "duplicate": True,
                "record_id": duplicate.id,
                "request_id": data.request_id,
                "message": "重复请求，已返回原有记录"
            }

        equipment = EquipmentService.get_by_code(db, data.equipment_code)
        if not equipment:
            record = cls.create_record(
                db, data.request_id, 0, OperationType.OCCUPY, data.quantity,
                data.operator, data.role, data.operated_at, OperationStatus.FAILED,
                ExceptionType.INVALID_EQUIPMENT, booth=data.booth, remark="设备不存在"
            )
            return {
                "success": False,
                "record_id": record.id,
                "request_id": data.request_id,
                "exception_type": ExceptionType.INVALID_EQUIPMENT.value,
                "message": "设备不存在"
            }

        if equipment.available_quantity < data.quantity:
            record = cls.create_record(
                db, data.request_id, equipment.id, OperationType.OCCUPY, data.quantity,
                data.operator, data.role, data.operated_at, OperationStatus.FAILED,
                ExceptionType.INSUFFICIENT_STOCK, booth=data.booth,
                remark=f"库存不足，可用数量：{equipment.available_quantity}"
            )
            return {
                "success": False,
                "record_id": record.id,
                "request_id": data.request_id,
                "exception_type": ExceptionType.INSUFFICIENT_STOCK.value,
                "available_quantity": equipment.available_quantity,
                "message": "库存不足"
            }

        old_value = json.dumps({"available": equipment.available_quantity})
        equipment.available_quantity -= data.quantity
        equipment.updated_at = datetime.now()
        db.commit()
        db.refresh(equipment)

        new_value = json.dumps({"available": equipment.available_quantity})

        record = cls.create_record(
            db, data.request_id, equipment.id, OperationType.OCCUPY, data.quantity,
            data.operator, data.role, data.operated_at, OperationStatus.SUCCESS,
            booth=data.booth, remark=data.remark
        )

        cls.create_audit_log(db, record.id, "occupy", data.operator, data.role, old_value, new_value)
        EquipmentService.create_snapshot(db, equipment.id)

        return {
            "success": True,
            "record_id": record.id,
            "request_id": data.request_id,
            "equipment_code": data.equipment_code,
            "booth": data.booth,
            "quantity": data.quantity,
            "remaining_available": equipment.available_quantity,
            "message": "占用成功"
        }

    @classmethod
    def handle_transfer(cls, db: Session, data: TransferOperation) -> Dict[str, Any]:
        duplicate = cls.check_duplicate_request(db, data.request_id)
        if duplicate:
            return {
                "success": True,
                "duplicate": True,
                "record_id": duplicate.id,
                "request_id": data.request_id,
                "message": "重复请求，已返回原有记录"
            }

        equipment = EquipmentService.get_by_code(db, data.equipment_code)
        if not equipment:
            record = cls.create_record(
                db, data.request_id, 0, OperationType.TRANSFER, data.quantity,
                data.operator, data.role, data.operated_at, OperationStatus.FAILED,
                ExceptionType.INVALID_EQUIPMENT, from_booth=data.from_booth,
                to_booth=data.to_booth, remark="设备不存在"
            )
            return {
                "success": False,
                "record_id": record.id,
                "request_id": data.request_id,
                "exception_type": ExceptionType.INVALID_EQUIPMENT.value,
                "message": "设备不存在"
            }

        record = cls.create_record(
            db, data.request_id, equipment.id, OperationType.TRANSFER, data.quantity,
            data.operator, data.role, data.operated_at, OperationStatus.SUCCESS,
            from_booth=data.from_booth, to_booth=data.to_booth, remark=data.remark
        )

        cls.create_audit_log(
            db, record.id, "transfer", data.operator, data.role,
            json.dumps({"from_booth": data.from_booth}),
            json.dumps({"to_booth": data.to_booth})
        )

        return {
            "success": True,
            "record_id": record.id,
            "request_id": data.request_id,
            "equipment_code": data.equipment_code,
            "from_booth": data.from_booth,
            "to_booth": data.to_booth,
            "quantity": data.quantity,
            "message": "调拨成功"
        }

    @classmethod
    def handle_return(cls, db: Session, data: ReturnOperation) -> Dict[str, Any]:
        duplicate = cls.check_duplicate_request(db, data.request_id)
        if duplicate:
            return {
                "success": True,
                "duplicate": True,
                "record_id": duplicate.id,
                "request_id": data.request_id,
                "message": "重复请求，已返回原有记录"
            }

        equipment = EquipmentService.get_by_code(db, data.equipment_code)
        if not equipment:
            record = cls.create_record(
                db, data.request_id, 0, OperationType.RETURN, data.quantity,
                data.operator, data.role, data.operated_at, OperationStatus.FAILED,
                ExceptionType.INVALID_EQUIPMENT, booth=data.booth, remark="设备不存在"
            )
            return {
                "success": False,
                "record_id": record.id,
                "request_id": data.request_id,
                "exception_type": ExceptionType.INVALID_EQUIPMENT.value,
                "message": "设备不存在"
            }

        old_value = json.dumps({"available": equipment.available_quantity})
        equipment.available_quantity += data.quantity
        equipment.updated_at = datetime.now()
        db.commit()
        db.refresh(equipment)

        new_value = json.dumps({"available": equipment.available_quantity})

        record = cls.create_record(
            db, data.request_id, equipment.id, OperationType.RETURN, data.quantity,
            data.operator, data.role, data.operated_at, OperationStatus.SUCCESS,
            booth=data.booth, remark=data.remark
        )

        cls.create_audit_log(db, record.id, "return", data.operator, data.role, old_value, new_value)
        EquipmentService.create_snapshot(db, equipment.id)

        return {
            "success": True,
            "record_id": record.id,
            "request_id": data.request_id,
            "equipment_code": data.equipment_code,
            "booth": data.booth,
            "quantity": data.quantity,
            "new_available": equipment.available_quantity,
            "message": "归还成功"
        }

    @classmethod
    def handle_loss(cls, db: Session, data: LossOperation) -> Dict[str, Any]:
        duplicate = cls.check_duplicate_request(db, data.request_id)
        if duplicate:
            return {
                "success": True,
                "duplicate": True,
                "record_id": duplicate.id,
                "request_id": data.request_id,
                "message": "重复请求，已返回原有记录"
            }

        equipment = EquipmentService.get_by_code(db, data.equipment_code)
        if not equipment:
            record = cls.create_record(
                db, data.request_id, 0, OperationType.LOSS, data.quantity,
                data.operator, data.role, data.operated_at, OperationStatus.FAILED,
                ExceptionType.INVALID_EQUIPMENT, booth=data.booth,
                remark=data.loss_reason or "设备不存在"
            )
            return {
                "success": False,
                "record_id": record.id,
                "request_id": data.request_id,
                "exception_type": ExceptionType.INVALID_EQUIPMENT.value,
                "message": "设备不存在"
            }

        old_value = json.dumps({"available": equipment.available_quantity, "total": equipment.total_quantity})
        equipment.available_quantity -= data.quantity
        equipment.total_quantity -= data.quantity
        equipment.updated_at = datetime.now()
        db.commit()
        db.refresh(equipment)

        new_value = json.dumps({"available": equipment.available_quantity, "total": equipment.total_quantity})

        record = cls.create_record(
            db, data.request_id, equipment.id, OperationType.LOSS, data.quantity,
            data.operator, data.role, data.operated_at, OperationStatus.SUCCESS,
            booth=data.booth, remark=data.loss_reason
        )

        cls.create_audit_log(db, record.id, "loss", data.operator, data.role, old_value, new_value)
        EquipmentService.create_snapshot(db, equipment.id)

        return {
            "success": True,
            "record_id": record.id,
            "request_id": data.request_id,
            "equipment_code": data.equipment_code,
            "booth": data.booth,
            "quantity": data.quantity,
            "remaining_available": equipment.available_quantity,
            "message": "损耗记录成功"
        }

    @staticmethod
    def query_records(db: Session, filter_params: QueryFilter) -> List[OperationRecord]:
        query = db.query(OperationRecord)

        if filter_params.operator:
            query = query.filter(OperationRecord.operator == filter_params.operator)
        if filter_params.start_time:
            query = query.filter(OperationRecord.operated_at >= filter_params.start_time)
        if filter_params.end_time:
            query = query.filter(OperationRecord.operated_at <= filter_params.end_time)
        if filter_params.status:
            query = query.filter(OperationRecord.status == filter_params.status)
        if filter_params.exception_type:
            query = query.filter(OperationRecord.exception_type == filter_params.exception_type)
        if filter_params.operation_type:
            query = query.filter(OperationRecord.operation_type == filter_params.operation_type)
        if filter_params.booth:
            query = query.filter(
                (OperationRecord.booth == filter_params.booth) |
                (OperationRecord.from_booth == filter_params.booth) |
                (OperationRecord.to_booth == filter_params.booth)
            )
        if filter_params.equipment_code:
            equipment = EquipmentService.get_by_code(db, filter_params.equipment_code)
            if equipment:
                query = query.filter(OperationRecord.equipment_id == equipment.id)
            else:
                return []

        return query.order_by(OperationRecord.operated_at.desc()).all()

    @staticmethod
    def get_record_summary(db: Session) -> Dict[str, Any]:
        total = db.query(OperationRecord).count()
        success = db.query(OperationRecord).filter(OperationRecord.status == OperationStatus.SUCCESS).count()
        failed = db.query(OperationRecord).filter(OperationRecord.status == OperationStatus.FAILED).count()
        has_exception = db.query(OperationRecord).filter(OperationRecord.exception_type != ExceptionType.NONE).count()

        return {
            "total_records": total,
            "success_count": success,
            "failed_count": failed,
            "exception_count": has_exception
        }
