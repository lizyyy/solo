from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
import yaml
from sqlalchemy.orm import Session
from exhibition_material.models import AnomalyType
from exhibition_material.services import MaterialService, AllocationService, BatchService
from exhibition_material.utils import Validators, Helpers

class YAMLImporter:
    def __init__(self, session: Session):
        self.session = session
        self.material_service = MaterialService(session)
        self.allocation_service = AllocationService(session)
        self.batch_service = BatchService(session)
    
    def import_allocations(self, file_path: str) -> Dict[str, Any]:
        allocations_data = self._read_yaml_file(file_path)
        
        allocations_list = allocations_data if isinstance(allocations_data, list) else allocations_data.get("allocations", [])
        
        def create_allocation_wrapper(item: Dict[str, Any]) -> Tuple[Any, Optional[Dict[str, Any]]]:
            return self._create_allocation_from_dict(item)
        
        result = self.batch_service.execute_batch_operation(
            allocations_list,
            create_allocation_wrapper,
            source_file=file_path
        )
        
        return result.to_dict()
    
    def _read_yaml_file(self, file_path: str) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        return data or {}
    
    def _create_allocation_from_dict(self, data: Dict[str, Any]) -> Tuple[Any, Optional[Dict[str, Any]]]:
        material_code = Helpers.safe_str(data.get("material_code") or data.get("物料编码"))
        booth_number = Helpers.safe_str(data.get("booth_number") or data.get("展位号"))
        quantity = Helpers.safe_float(data.get("quantity") or data.get("数量"))
        responsible_person = Helpers.safe_str(data.get("responsible_person") or data.get("负责人"))
        contact_phone = Helpers.safe_str(data.get("contact_phone") or data.get("联系电话"))
        allocated_at_str = Helpers.safe_str(data.get("allocated_at") or data.get("调拨日期"))
        expected_return_at_str = Helpers.safe_str(data.get("expected_return_at") or data.get("预计归还日期"))
        remarks = Helpers.safe_str(data.get("remarks") or data.get("备注"))
        
        valid, error_msg = Validators.validate_booth_number(booth_number)
        if not valid:
            error = {
                "error_type": AnomalyType.MISSING_FIELD,
                "error_message": error_msg,
                "suggestion": "请填写正确的展位号"
            }
            return None, error
        
        valid, error_msg = Validators.validate_quantity(quantity)
        if not valid:
            error = {
                "error_type": AnomalyType.INVALID_DATA,
                "error_message": error_msg,
                "suggestion": "请填写正确的数量"
            }
            return None, error
        
        valid, error_msg = Validators.validate_person_name(responsible_person)
        if not valid:
            error = {
                "error_type": AnomalyType.MISSING_FIELD,
                "error_message": error_msg,
                "suggestion": "请填写正确的负责人姓名"
            }
            return None, error
        
        material = self.material_service.get_material(code=material_code)
        if not material:
            error = {
                "error_type": AnomalyType.MATERIAL_NOT_FOUND,
                "error_message": f"物料编码 {material_code} 不存在",
                "suggestion": "请先导入物料或检查物料编码是否正确"
            }
            return None, error
        
        allocated_at = None
        if allocated_at_str:
            valid, msg, dt = Validators.validate_date_format(allocated_at_str)
            if valid:
                allocated_at = dt
        
        expected_return_at = None
        if expected_return_at_str:
            valid, msg, dt = Validators.validate_date_format(expected_return_at_str)
            if valid:
                expected_return_at = dt
        
        try:
            allocation, error = self.allocation_service.create_allocation(
                material_id=material.id,
                booth_number=booth_number,
                quantity=quantity,
                responsible_person=responsible_person,
                contact_phone=contact_phone,
                allocated_at=allocated_at,
                expected_return_at=expected_return_at,
                remarks=remarks
            )
            return allocation, error
        except Exception as e:
            error = {
                "error_type": AnomalyType.INVALID_DATA,
                "error_message": str(e),
                "suggestion": "请检查数据是否正确"
            }
            return None, error
    
    def validate_allocation_yaml(self, file_path: str) -> Dict[str, Any]:
        allocations_data = self._read_yaml_file(file_path)
        allocations_list = allocations_data if isinstance(allocations_data, list) else allocations_data.get("allocations", [])
        errors = []
        
        for idx, item in enumerate(allocations_list):
            material_code = Helpers.safe_str(item.get("material_code") or item.get("物料编码"))
            booth_number = Helpers.safe_str(item.get("booth_number") or item.get("展位号"))
            quantity = Helpers.safe_float(item.get("quantity") or item.get("数量"))
            responsible_person = Helpers.safe_str(item.get("responsible_person") or item.get("负责人"))
            
            row_errors = []
            
            if not material_code:
                row_errors.append("物料编码不能为空")
            
            valid, msg = Validators.validate_booth_number(booth_number)
            if not valid:
                row_errors.append(msg)
            
            valid, msg = Validators.validate_quantity(quantity)
            if not valid:
                row_errors.append(msg)
            
            valid, msg = Validators.validate_person_name(responsible_person)
            if not valid:
                row_errors.append(msg)
            
            if row_errors:
                errors.append({
                    "row": idx + 1,
                    "material_code": material_code,
                    "booth_number": booth_number,
                    "errors": row_errors
                })
        
        return {
            "total_items": len(allocations_list),
            "error_count": len(errors),
            "errors": errors,
            "is_valid": len(errors) == 0
        }
