from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.models import Elderly
from app.core.logging import app_logger
from app.services.history import HistoryService
from app.utils.validators import validate_elderly_data, validate_phone, validate_id_card
from app.utils.mask import mask_sensitive_data


class ElderlyService:
    @staticmethod
    def create_elderly(
        db: Session,
        name: str,
        gender: Optional[str] = None,
        age: Optional[int] = None,
        phone: Optional[str] = None,
        id_card: Optional[str] = None,
        address: Optional[str] = None,
        room_number: Optional[str] = None,
        dietary_restrictions: Optional[List[str]] = None,
        chronic_diseases: Optional[List[str]] = None,
        emergency_contact: Optional[str] = None,
        emergency_phone: Optional[str] = None,
        delivery_route: Optional[str] = None,
        delivery_sequence: Optional[int] = None,
        notes: Optional[str] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        
        if phone:
            valid, msg = validate_phone(phone)
            if not valid:
                return {"success": False, "message": msg}
        
        if id_card:
            valid, msg = validate_id_card(id_card)
            if not valid:
                return {"success": False, "message": msg}
            
            existing = db.query(Elderly).filter(Elderly.id_card == id_card).first()
            if existing:
                return {"success": False, "message": "身份证号已存在"}
        
        elderly = Elderly(
            name=name,
            gender=gender,
            age=age,
            phone=phone,
            id_card=id_card,
            address=address,
            room_number=room_number,
            dietary_restrictions=dietary_restrictions or [],
            chronic_diseases=chronic_diseases or [],
            emergency_contact=emergency_contact,
            emergency_phone=emergency_phone,
            delivery_route=delivery_route,
            delivery_sequence=delivery_sequence,
            notes=notes,
            is_active=True
        )
        
        db.add(elderly)
        db.commit()
        db.refresh(elderly)
        
        HistoryService.record_operation(
            db=db,
            operation_type="create",
            entity_type="Elderly",
            entity_id=elderly.id,
            after_data={"name": name, "delivery_route": delivery_route},
            operator=operator
        )
        
        app_logger.info(f"创建老人信息成功: {elderly.id}")
        
        return {
            "success": True,
            "elderly_id": elderly.id,
            "message": "创建成功"
        }
    
    @staticmethod
    def update_elderly(
        db: Session,
        elderly_id: int,
        update_data: Dict[str, Any],
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        elderly = db.query(Elderly).filter(Elderly.id == elderly_id).first()
        if not elderly:
            return {"success": False, "message": "老人信息不存在"}
        
        before_data = HistoryService.get_entity_before_data(elderly)
        
        if "phone" in update_data:
            valid, msg = validate_phone(update_data["phone"])
            if not valid:
                return {"success": False, "message": msg}
        
        if "id_card" in update_data:
            valid, msg = validate_id_card(update_data["id_card"])
            if not valid:
                return {"success": False, "message": msg}
            
            existing = db.query(Elderly).filter(
                Elderly.id_card == update_data["id_card"],
                Elderly.id != elderly_id
            ).first()
            if existing:
                return {"success": False, "message": "身份证号已存在"}
        
        for key, value in update_data.items():
            if hasattr(elderly, key):
                setattr(elderly, key, value)
        
        elderly.updated_at = datetime.now()
        
        db.commit()
        
        after_data = HistoryService.get_entity_before_data(elderly)
        changes = HistoryService.calculate_changes(before_data, after_data)
        
        HistoryService.record_operation(
            db=db,
            operation_type="update",
            entity_type="Elderly",
            entity_id=elderly.id,
            before_data=before_data,
            after_data=after_data,
            changes=changes,
            operator=operator
        )
        
        app_logger.info(f"更新老人信息成功: {elderly_id}")
        
        return {
            "success": True,
            "elderly_id": elderly_id,
            "message": "更新成功"
        }
    
    @staticmethod
    def get_elderly(
        db: Session,
        elderly_id: int,
        mask: bool = True
    ) -> Dict[str, Any]:
        elderly = db.query(Elderly).filter(Elderly.id == elderly_id).first()
        if not elderly:
            return {"success": False, "message": "老人信息不存在"}
        
        data = {
            "id": elderly.id,
            "name": elderly.name,
            "gender": elderly.gender,
            "age": elderly.age,
            "phone": elderly.phone,
            "id_card": elderly.id_card,
            "address": elderly.address,
            "room_number": elderly.room_number,
            "dietary_restrictions": elderly.dietary_restrictions,
            "chronic_diseases": elderly.chronic_diseases,
            "emergency_contact": elderly.emergency_contact,
            "emergency_phone": elderly.emergency_phone,
            "delivery_route": elderly.delivery_route,
            "delivery_sequence": elderly.delivery_sequence,
            "notes": elderly.notes,
            "is_active": elderly.is_active,
            "created_at": elderly.created_at.isoformat() if elderly.created_at else None,
            "updated_at": elderly.updated_at.isoformat() if elderly.updated_at else None
        }
        
        if mask:
            data = mask_sensitive_data(data)
        
        return {
            "success": True,
            "data": data
        }
    
    @staticmethod
    def list_elderly(
        db: Session,
        route: Optional[str] = None,
        is_active: Optional[bool] = None,
        mask: bool = True
    ) -> Dict[str, Any]:
        query = db.query(Elderly)
        
        if route:
            query = query.filter(Elderly.delivery_route == route)
        if is_active is not None:
            query = query.filter(Elderly.is_active == is_active)
        
        elderly_list = query.order_by(Elderly.delivery_sequence).all()
        
        result = []
        for elderly in elderly_list:
            data = {
                "id": elderly.id,
                "name": elderly.name,
                "gender": elderly.gender,
                "age": elderly.age,
                "phone": elderly.phone,
                "dietary_restrictions": elderly.dietary_restrictions,
                "chronic_diseases": elderly.chronic_diseases,
                "delivery_route": elderly.delivery_route,
                "delivery_sequence": elderly.delivery_sequence,
                "is_active": elderly.is_active
            }
            if mask:
                data = mask_sensitive_data(data)
            result.append(data)
        
        return {
            "success": True,
            "total": len(result),
            "data": result
        }
