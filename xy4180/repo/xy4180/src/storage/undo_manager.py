import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

from src.storage.database import DAOFactory, DatabaseManager
from src.models.models import (
    Team, Material, BorrowRecord, BorrowItem,
    ReturnRecord, ReturnItem, DamageRecord, AuditLog,
    MaterialStatus, ReturnStatus
)


class OperationType(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    CREATE_RETURN = "CREATE_RETURN"
    UPDATE_RETURN = "UPDATE_RETURN"
    CREATE_DAMAGE = "CREATE_DAMAGE"


class EntityType(str, Enum):
    TEAM = "Team"
    MATERIAL = "Material"
    BORROW_RECORD = "BorrowRecord"
    BORROW_ITEM = "BorrowItem"
    RETURN_RECORD = "ReturnRecord"
    RETURN_ITEM = "ReturnItem"
    DAMAGE_RECORD = "DamageRecord"
    ANOMALY_RECORD = "AnomalyRecord"


class UndoManager:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        self.dao_factory = DAOFactory
        self.db_manager = DatabaseManager()
    
    def _entity_to_dict(self, entity) -> Dict[str, Any]:
        if entity is None:
            return {}
        result = {}
        for column in entity.__table__.columns:
            value = getattr(entity, column.name)
            if isinstance(value, (datetime, MaterialStatus, ReturnStatus)):
                result[column.name] = str(value)
            else:
                result[column.name] = value
        return result
    
    def _dict_to_kwargs(self, data: Dict[str, Any]) -> Dict[str, Any]:
        kwargs = {}
        for key, value in data.items():
            if key not in ['id', 'created_at', 'updated_at']:
                if value == 'None' or value is None:
                    kwargs[key] = None
                elif isinstance(value, str) and ' ' in value:
                    try:
                        kwargs[key] = datetime.fromisoformat(value)
                    except ValueError:
                        kwargs[key] = value
                else:
                    kwargs[key] = value
        return kwargs
    
    def log_create(self, entity_type: EntityType, entity, operator: Optional[str] = None) -> AuditLog:
        audit_dao = self.dao_factory.get_audit_log_dao()
        return audit_dao.log_operation(
            operation_type=OperationType.CREATE.value,
            entity_type=entity_type.value,
            entity_id=entity.id,
            after_data=self._entity_to_dict(entity),
            operator=operator
        )
    
    def log_update(
        self,
        entity_type: EntityType,
        entity,
        before_data: Dict[str, Any],
        operator: Optional[str] = None
    ) -> AuditLog:
        audit_dao = self.dao_factory.get_audit_log_dao()
        return audit_dao.log_operation(
            operation_type=OperationType.UPDATE.value,
            entity_type=entity_type.value,
            entity_id=entity.id,
            before_data=before_data,
            after_data=self._entity_to_dict(entity),
            operator=operator
        )
    
    def log_delete(self, entity_type: EntityType, entity, operator: Optional[str] = None) -> AuditLog:
        audit_dao = self.dao_factory.get_audit_log_dao()
        return audit_dao.log_operation(
            operation_type=OperationType.DELETE.value,
            entity_type=entity_type.value,
            entity_id=entity.id,
            before_data=self._entity_to_dict(entity),
            operator=operator
        )
    
    def log_return_creation(
        self,
        return_record: ReturnRecord,
        return_items: List[ReturnItem],
        borrow_record: BorrowRecord,
        operator: Optional[str] = None
    ) -> AuditLog:
        audit_dao = self.dao_factory.get_audit_log_dao()
        
        operation_data = {
            "return_record": self._entity_to_dict(return_record),
            "return_items": [self._entity_to_dict(item) for item in return_items],
            "borrow_record_id": borrow_record.id,
            "borrow_record_before": self._entity_to_dict(borrow_record)
        }
        
        return audit_dao.log_operation(
            operation_type=OperationType.CREATE_RETURN.value,
            entity_type=EntityType.RETURN_RECORD.value,
            entity_id=return_record.id,
            operation_data=operation_data,
            operator=operator
        )
    
    def get_undoable_operations(self) -> List[AuditLog]:
        audit_dao = self.dao_factory.get_audit_log_dao()
        return audit_dao.get_undoable()
    
    def undo_last_operation(self) -> bool:
        undoable = self.get_undoable_operations()
        if not undoable:
            return False
        
        last_op = undoable[0]
        return self.undo_operation(last_op.id)
    
    def undo_operation(self, audit_log_id: int) -> bool:
        audit_dao = self.dao_factory.get_audit_log_dao()
        audit_log = audit_dao.get_by_id(audit_log_id)
        
        if not audit_log or audit_log.is_undone:
            return False
        
        operation_type = audit_log.operation_type
        entity_type = audit_log.entity_type
        
        try:
            if operation_type == OperationType.CREATE.value:
                self._undo_create(entity_type, audit_log)
            elif operation_type == OperationType.UPDATE.value:
                self._undo_update(entity_type, audit_log)
            elif operation_type == OperationType.DELETE.value:
                self._undo_delete(entity_type, audit_log)
            elif operation_type == OperationType.CREATE_RETURN.value:
                self._undo_create_return(audit_log)
            
            audit_dao.update(audit_log_id, is_undone=True)
            return True
            
        except Exception as e:
            print(f"Undo operation failed: {e}")
            return False
    
    def _undo_create(self, entity_type: str, audit_log: AuditLog):
        if entity_type == EntityType.TEAM.value:
            self.dao_factory.get_team_dao().delete(audit_log.entity_id)
        elif entity_type == EntityType.MATERIAL.value:
            self.dao_factory.get_material_dao().delete(audit_log.entity_id)
        elif entity_type == EntityType.BORROW_RECORD.value:
            self.dao_factory.get_borrow_record_dao().delete(audit_log.entity_id)
        elif entity_type == EntityType.DAMAGE_RECORD.value:
            self.dao_factory.get_damage_record_dao().delete(audit_log.entity_id)
    
    def _undo_update(self, entity_type: str, audit_log: AuditLog):
        if not audit_log.before_data:
            return
        
        before_data = json.loads(audit_log.before_data)
        kwargs = self._dict_to_kwargs(before_data)
        
        if entity_type == EntityType.TEAM.value:
            self.dao_factory.get_team_dao().update(audit_log.entity_id, **kwargs)
        elif entity_type == EntityType.MATERIAL.value:
            self.dao_factory.get_material_dao().update(audit_log.entity_id, **kwargs)
        elif entity_type == EntityType.BORROW_RECORD.value:
            self.dao_factory.get_borrow_record_dao().update(audit_log.entity_id, **kwargs)
        elif entity_type == EntityType.RETURN_RECORD.value:
            self.dao_factory.get_return_record_dao().update(audit_log.entity_id, **kwargs)
    
    def _undo_delete(self, entity_type: str, audit_log: AuditLog):
        if not audit_log.before_data:
            return
        
        before_data = json.loads(audit_log.before_data)
        kwargs = self._dict_to_kwargs(before_data)
        
        if entity_type == EntityType.TEAM.value:
            self.dao_factory.get_team_dao().create(**kwargs)
        elif entity_type == EntityType.MATERIAL.value:
            self.dao_factory.get_material_dao().create(**kwargs)
        elif entity_type == EntityType.BORROW_RECORD.value:
            self.dao_factory.get_borrow_record_dao().create(**kwargs)
    
    def _undo_create_return(self, audit_log: AuditLog):
        if not audit_log.operation_data:
            return
        
        operation_data = json.loads(audit_log.operation_data)
        return_record_data = operation_data.get("return_record", {})
        return_items_data = operation_data.get("return_items", [])
        borrow_record_id = operation_data.get("borrow_record_id")
        
        return_dao = self.dao_factory.get_return_record_dao()
        return_item_dao = self.dao_factory.get_return_item_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        material_dao = self.dao_factory.get_material_dao()
        
        for item_data in return_items_data:
            return_item_dao.delete(item_data.get("id"))
            
            borrow_item_id = item_data.get("borrow_item_id")
            material_id = item_data.get("material_id")
            
            if borrow_item_id:
                borrow_item = borrow_item_dao.get_by_id(borrow_item_id)
                if borrow_item:
                    new_returned = max(0, borrow_item.returned_quantity - item_data.get("quantity", 1))
                    borrow_item_dao.update(
                        borrow_item_id,
                        returned_quantity=new_returned,
                        is_returned=new_returned >= borrow_item.quantity
                    )
            
            if material_id:
                material_dao.update_status(material_id, MaterialStatus.BORROWED)
        
        return_dao.delete(audit_log.entity_id)
        
        if borrow_record_id:
            borrow_before = operation_data.get("borrow_record_before", {})
            if borrow_before:
                kwargs = self._dict_to_kwargs(borrow_before)
                borrow_dao.update(borrow_record_id, **kwargs)


def get_undo_manager() -> UndoManager:
    return UndoManager()
