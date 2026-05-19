from typing import List, Dict, Any, Tuple, Optional
import csv
from pathlib import Path
from sqlalchemy.orm import Session
from exhibition_material.models import MaterialType, AnomalyType
from exhibition_material.services import MaterialService, BatchService
from exhibition_material.utils import Validators, Helpers

class CSVImporter:
    def __init__(self, session: Session):
        self.session = session
        self.material_service = MaterialService(session)
        self.batch_service = BatchService(session)
    
    def import_materials(self, file_path: str) -> Dict[str, Any]:
        materials_data = self._read_csv_file(file_path)
        
        def create_material_wrapper(item: Dict[str, Any]) -> Tuple[Any, Optional[Dict[str, Any]]]:
            return self._create_material_from_row(item)
        
        result = self.batch_service.execute_batch_operation(
            materials_data,
            create_material_wrapper,
            source_file=file_path
        )
        
        return result.to_dict()
    
    def _read_csv_file(self, file_path: str) -> List[Dict[str, Any]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        materials = []
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                materials.append(row)
        
        return materials
    
    def _create_material_from_row(self, row: Dict[str, Any]) -> Tuple[Any, Optional[Dict[str, Any]]]:
        code = Helpers.safe_str(row.get("code") or row.get("物料编码"))
        name = Helpers.safe_str(row.get("name") or row.get("物料名称"))
        type_str = Helpers.safe_str(row.get("type") or row.get("物料类型"))
        unit = Helpers.safe_str(row.get("unit") or row.get("单位"))
        quantity = Helpers.safe_float(row.get("quantity") or row.get("数量") or row.get("total_quantity"))
        specification = Helpers.safe_str(row.get("specification") or row.get("规格"))
        location = Helpers.safe_str(row.get("location") or row.get("存放位置"))
        responsible_person = Helpers.safe_str(row.get("responsible_person") or row.get("负责人"))
        remarks = Helpers.safe_str(row.get("remarks") or row.get("备注"))
        
        valid, error_msg = Validators.validate_material_code(code)
        if not valid:
            error = {
                "error_type": AnomalyType.MISSING_FIELD,
                "error_message": error_msg,
                "suggestion": "请填写正确的物料编码"
            }
            return None, error
        
        valid, error_msg = Validators.validate_material_type(type_str)
        if not valid:
            error = {
                "error_type": AnomalyType.INVALID_DATA,
                "error_message": error_msg,
                "suggestion": "请选择正确的物料类型"
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
        
        existing = self.material_service.get_material(code=code)
        if existing:
            error = {
                "error_type": AnomalyType.DUPLICATE_RECORD,
                "error_message": f"物料编码 {code} 已存在",
                "suggestion": "请修改物料编码或使用更新功能"
            }
            return None, error
        
        try:
            material = self.material_service.create_material(
                code=code,
                name=name,
                material_type=MaterialType(type_str),
                unit=unit,
                total_quantity=quantity,
                specification=specification,
                location=location,
                responsible_person=responsible_person,
                remarks=remarks
            )
            return material, None
        except Exception as e:
            error = {
                "error_type": AnomalyType.INVALID_DATA,
                "error_message": str(e),
                "suggestion": "请检查数据是否正确"
            }
            return None, error
    
    def validate_material_csv(self, file_path: str) -> Dict[str, Any]:
        materials_data = self._read_csv_file(file_path)
        errors = []
        
        for idx, row in enumerate(materials_data):
            code = Helpers.safe_str(row.get("code") or row.get("物料编码"))
            name = Helpers.safe_str(row.get("name") or row.get("物料名称"))
            type_str = Helpers.safe_str(row.get("type") or row.get("物料类型"))
            quantity = Helpers.safe_float(row.get("quantity") or row.get("数量"))
            
            row_errors = []
            
            valid, msg = Validators.validate_material_code(code)
            if not valid:
                row_errors.append(msg)
            
            if not name:
                row_errors.append("物料名称不能为空")
            
            valid, msg = Validators.validate_material_type(type_str)
            if not valid:
                row_errors.append(msg)
            
            valid, msg = Validators.validate_quantity(quantity)
            if not valid:
                row_errors.append(msg)
            
            if row_errors:
                errors.append({
                    "row": idx + 2,
                    "code": code,
                    "errors": row_errors
                })
        
        return {
            "total_rows": len(materials_data),
            "error_count": len(errors),
            "errors": errors,
            "is_valid": len(errors) == 0
        }
