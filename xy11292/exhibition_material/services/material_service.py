from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from exhibition_material.storage.repository import MaterialRepository
from exhibition_material.models import Material, MaterialType

class MaterialService:
    def __init__(self, session: Session):
        self.repository = MaterialRepository(session)
    
    def create_material(self, code: str, name: str, material_type: MaterialType,
                        unit: str, total_quantity: float, specification: str = None,
                        location: str = None, responsible_person: str = None,
                        remarks: str = None) -> Material:
        existing = self.repository.get_by_code(code)
        if existing:
            raise ValueError(f"物料编码 {code} 已存在")
        
        return self.repository.create(
            code=code,
            name=name,
            type=material_type,
            unit=unit,
            total_quantity=total_quantity,
            available_quantity=total_quantity,
            specification=specification,
            location=location,
            responsible_person=responsible_person,
            remarks=remarks
        )
    
    def get_material(self, material_id: int = None, code: str = None) -> Optional[Material]:
        if material_id:
            return self.repository.get_by_id(material_id)
        if code:
            return self.repository.get_by_code(code)
        return None
    
    def update_material(self, material_id: int, **kwargs) -> Material:
        material = self.repository.get_by_id(material_id)
        if not material:
            raise ValueError(f"物料 {material_id} 不存在")
        
        if 'code' in kwargs:
            existing = self.repository.get_by_code(kwargs['code'])
            if existing and existing.id != material_id:
                raise ValueError(f"物料编码 {kwargs['code']} 已存在")
        
        if 'total_quantity' in kwargs:
            delta = kwargs['total_quantity'] - material.total_quantity
            kwargs['available_quantity'] = material.available_quantity + delta
        
        return self.repository.update(material, **kwargs)
    
    def delete_material(self, material_id: int):
        material = self.repository.get_by_id(material_id)
        if not material:
            raise ValueError(f"物料 {material_id} 不存在")
        self.repository.update(material, is_active=False)
    
    def list_materials(self, material_type: MaterialType = None,
                       responsible_person: str = None,
                       keyword: str = None,
                       is_active: bool = True) -> List[Material]:
        if keyword or material_type is not None or is_active is not None:
            return self.repository.search(keyword, material_type, is_active)
        return self.repository.list_all()
    
    def check_available_quantity(self, material_id: int, required_quantity: float) -> bool:
        material = self.repository.get_by_id(material_id)
        if not material:
            return False
        return material.available_quantity >= required_quantity
    
    def allocate_quantity(self, material_id: int, quantity: float):
        material = self.repository.get_by_id(material_id)
        if not material:
            raise ValueError(f"物料 {material_id} 不存在")
        if material.available_quantity < quantity:
            raise ValueError(f"物料 {material.code} 库存不足，可用：{material.available_quantity}，需要：{quantity}")
        
        self.repository.update_quantities(
            material_id,
            available_delta=-quantity,
            allocated_delta=quantity
        )
    
    def return_quantity(self, material_id: int, quantity: float):
        material = self.repository.get_by_id(material_id)
        if not material:
            raise ValueError(f"物料 {material_id} 不存在")
        
        self.repository.update_quantities(
            material_id,
            available_delta=quantity,
            allocated_delta=-quantity,
            returned_delta=quantity
        )
