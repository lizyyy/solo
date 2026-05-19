from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models import (
    Booth, Equipment, Rental, RentalItem, ReturnRecord, ReturnItem,
    DamageRecord, User, AuditLog
)
from app.schemas import BoothCreate, EquipmentCreate, RentalCreate, ReturnCreate
from app.rules import RentalRuleEngine, ReturnRuleEngine, DamageFeeCalculator
from app.audit import AuditLogger
import uuid


def generate_rental_no() -> str:
    return f"R{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


class BatchOperationHandler:
    def __init__(self, db: Session):
        self.db = db

    def process_batch(self, items: List[Any], processor_func) -> Dict[str, Any]:
        successful = []
        failed = []
        
        for idx, item in enumerate(items):
            savepoint = self.db.begin_nested()
            try:
                result = processor_func(item)
                savepoint.commit()
                successful.append(result)
            except Exception as e:
                savepoint.rollback()
                failed.append({
                    "index": idx,
                    "item": item,
                    "error": str(e)
                })
        
        return {
            "success_count": len(successful),
            "failed_count": len(failed),
            "total_count": len(items),
            "successful": successful,
            "failed": failed
        }


def create_booth(db: Session, booth: BoothCreate) -> Booth:
    db_booth = Booth(**booth.dict())
    db.add(db_booth)
    db.commit()
    db.refresh(db_booth)
    return db_booth


def get_booths(db: Session, skip: int = 0, limit: int = 100) -> List[Booth]:
    return db.query(Booth).offset(skip).limit(limit).all()


def create_equipment(db: Session, equipment: EquipmentCreate) -> Equipment:
    db_equipment = Equipment(**equipment.dict())
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    return db_equipment


def get_equipment(db: Session, skip: int = 0, limit: int = 100) -> List[Equipment]:
    return db.query(Equipment).offset(skip).limit(limit).all()


def get_equipment_by_barcode(db: Session, barcode: str) -> Optional[Equipment]:
    return db.query(Equipment).filter(Equipment.barcode == barcode).first()


def create_rental(db: Session, rental: RentalCreate, operator_id: int, ip_address: Optional[str] = None) -> Dict[str, Any]:
    audit_logger = AuditLogger(db)
    rule_engine = RentalRuleEngine(db)
    
    equipment_ids = [item.equipment_id for item in rental.items]
    validation = rule_engine.validate_rental(equipment_ids, rental.booth_id)
    
    if not validation["passed"]:
        reason = "; ".join([r.message for r in validation["failed_rules"]])
        audit_logger.log_rental_create(
            user_id=operator_id,
            rental_id=None,
            passed=False,
            reason=reason,
            request_data=rental.dict(),
            ip_address=ip_address
        )
        db.commit()
        return {
            "success": False,
            "reason": reason,
            "validation": validation
        }
    
    try:
        db_rental = Rental(
            rental_no=generate_rental_no(),
            booth_id=rental.booth_id,
            operator_id=operator_id,
            remarks=rental.remarks,
            status="active"
        )
        db.add(db_rental)
        db.flush()
        
        total_amount = 0
        total_deposit = 0
        
        for item in rental.items:
            equipment = db.query(Equipment).filter(Equipment.id == item.equipment_id).first()
            if equipment:
                rental_item = RentalItem(
                    rental_id=db_rental.id,
                    equipment_id=item.equipment_id,
                    quantity=item.quantity,
                    daily_rate=equipment.daily_rate,
                    deposit=equipment.deposit,
                    status="borrowed",
                    remarks=item.remarks
                )
                db.add(rental_item)
                total_amount += equipment.daily_rate * item.quantity
                total_deposit += equipment.deposit * item.quantity
                
                equipment.status = "borrowed"
                equipment.current_location = f"Booth {db_rental.booth.booth_number}"
        
        db_rental.total_amount = total_amount
        db_rental.total_deposit = total_deposit
        
        db.commit()
        db.refresh(db_rental)
        
        audit_logger.log_rental_create(
            user_id=operator_id,
            rental_id=db_rental.id,
            passed=True,
            reason="所有规则验证通过",
            request_data=rental.dict(),
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "rental": db_rental,
            "validation": validation
        }
        
    except Exception as e:
        db.rollback()
        audit_logger.log_rental_create(
            user_id=operator_id,
            rental_id=None,
            passed=False,
            reason=f"创建失败: {str(e)}",
            request_data=rental.dict(),
            ip_address=ip_address
        )
        db.commit()
        return {
            "success": False,
            "reason": str(e),
            "validation": None
        }


def create_return(db: Session, return_data: ReturnCreate, operator_id: int, ip_address: Optional[str] = None) -> Dict[str, Any]:
    audit_logger = AuditLogger(db)
    rule_engine = ReturnRuleEngine(db)
    
    items_dict = [item.dict() for item in return_data.items]
    validation = rule_engine.validate_return(return_data.rental_id, items_dict)
    
    if not validation["passed"]:
        reason = "; ".join([r.message for r in validation["failed_rules"]])
        audit_logger.log_return_create(
            user_id=operator_id,
            return_id=None,
            passed=False,
            reason=reason,
            request_data=return_data.dict(),
            ip_address=ip_address
        )
        db.commit()
        return {
            "success": False,
            "reason": reason,
            "validation": validation
        }
    
    try:
        rental = db.query(Rental).filter(Rental.id == return_data.rental_id).first()
        
        db_return = ReturnRecord(
            rental_id=return_data.rental_id,
            operator_id=operator_id,
            remarks=return_data.remarks
        )
        db.add(db_return)
        db.flush()
        
        total_items = 0
        returned_items = 0
        total_damage_fee = 0
        
        for item in return_data.items:
            equipment = db.query(Equipment).filter(Equipment.id == item.equipment_id).first()
            rental_item = db.query(RentalItem).filter(
                RentalItem.rental_id == return_data.rental_id,
                RentalItem.equipment_id == item.equipment_id
            ).first()
            
            total_items += rental_item.quantity if rental_item else 0
            returned_items += item.quantity
            
            damage_fee = 0
            if item.status != "good" and item.damage_level:
                if DamageFeeCalculator.validate_damage_level(item.damage_level):
                    damage_fee = DamageFeeCalculator.calculate_fee(
                        rental_item.deposit if rental_item else 0,
                        item.damage_level
                    )
                    total_damage_fee += damage_fee
                    
                    damage_record = DamageRecord(
                        equipment_id=item.equipment_id,
                        rental_id=return_data.rental_id,
                        return_record_id=db_return.id,
                        operator_id=operator_id,
                        damage_level=item.damage_level,
                        fee=damage_fee,
                        description=item.remarks
                    )
                    db.add(damage_record)
                    
                    if equipment:
                        equipment.status = "damaged"
                else:
                    return {
                        "success": False,
                        "reason": f"无效的损坏等级: {item.damage_level}",
                        "validation": None
                    }
            
            return_item = ReturnItem(
                return_record_id=db_return.id,
                equipment_id=item.equipment_id,
                quantity=item.quantity,
                status=item.status,
                damage_level=item.damage_level,
                damage_fee=damage_fee,
                remarks=item.remarks
            )
            db.add(return_item)
            
            if rental_item and rental_item.quantity <= item.quantity:
                rental_item.status = "returned"
            elif rental_item:
                rental_item.quantity -= item.quantity
            
            if equipment and item.status == "good":
                equipment.status = "available"
                equipment.current_location = "仓库"
        
        db_return.total_items = total_items
        db_return.returned_items = returned_items
        db_return.damage_fee = total_damage_fee
        
        rental_items = db.query(RentalItem).filter(RentalItem.rental_id == return_data.rental_id).all()
        all_returned = all(item.status == "returned" for item in rental_items)
        
        if all_returned:
            rental.status = "completed"
            rental.end_time = datetime.now()
            rental.actual_damage_fee = total_damage_fee
        
        db_return.refund_amount = max(0, rental.total_deposit - total_damage_fee)
        
        db.commit()
        db.refresh(db_return)
        
        audit_logger.log_return_create(
            user_id=operator_id,
            return_id=db_return.id,
            passed=True,
            reason="所有规则验证通过",
            request_data=return_data.dict(),
            ip_address=ip_address
        )
        
        return {
            "success": True,
            "return": db_return,
            "validation": validation
        }
        
    except Exception as e:
        db.rollback()
        audit_logger.log_return_create(
            user_id=operator_id,
            return_id=None,
            passed=False,
            reason=f"创建失败: {str(e)}",
            request_data=return_data.dict(),
            ip_address=ip_address
        )
        db.commit()
        return {
            "success": False,
            "reason": str(e),
            "validation": None
        }


def rollback_rental(db: Session, rental_id: int, operator_id: int, reason: str, ip_address: Optional[str] = None) -> Dict[str, Any]:
    audit_logger = AuditLogger(db)
    
    try:
        rental = db.query(Rental).filter(Rental.id == rental_id).first()
        if not rental:
            return {"success": False, "reason": "借用单不存在"}
        
        if rental.status not in ["active", "completed"]:
            return {"success": False, "reason": "借用单状态不允许回滚"}
        
        for rental_item in rental.items:
            equipment = db.query(Equipment).filter(Equipment.id == rental_item.equipment_id).first()
            if equipment:
                equipment.status = "available"
                equipment.current_location = "仓库"
            rental_item.status = "cancelled"
        
        damage_records = db.query(DamageRecord).filter(DamageRecord.rental_id == rental_id).all()
        for dr in damage_records:
            dr.status = "cancelled"
        
        rental.status = "cancelled"
        
        db.commit()
        
        audit_logger.log_rollback(
            user_id=operator_id,
            resource_type="rental",
            resource_id=rental_id,
            reason=reason,
            ip_address=ip_address
        )
        
        return {"success": True, "rental_id": rental_id}
        
    except Exception as e:
        db.rollback()
        return {"success": False, "reason": str(e)}


def get_rentals(db: Session, skip: int = 0, limit: int = 100) -> List[Rental]:
    return db.query(Rental).offset(skip).limit(limit).all()


def get_rental_by_id(db: Session, rental_id: int) -> Optional[Rental]:
    return db.query(Rental).filter(Rental.id == rental_id).first()


def get_returns(db: Session, skip: int = 0, limit: int = 100) -> List[ReturnRecord]:
    return db.query(ReturnRecord).offset(skip).limit(limit).all()


def get_audit_logs(db: Session, skip: int = 0, limit: int = 100) -> List[AuditLog]:
    return db.query(AuditLog).offset(skip).limit(limit).all()
