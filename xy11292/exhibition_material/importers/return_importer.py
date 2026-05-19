from typing import List, Dict, Any, Tuple, Optional
import csv
from pathlib import Path
from sqlalchemy.orm import Session
from exhibition_material.models import AnomalyType
from exhibition_material.services import AllocationService, ReturnService, BatchService
from exhibition_material.utils import Validators, Helpers

class ReturnImporter:
    def __init__(self, session: Session):
        self.session = session
        self.allocation_service = AllocationService(session)
        self.return_service = ReturnService(session)
        self.batch_service = BatchService(session)
    
    def import_returns(self, file_path: str) -> Dict[str, Any]:
        returns_data = self._read_csv_file(file_path)
        
        def create_return_wrapper(item: Dict[str, Any]) -> Tuple[Any, Optional[Dict[str, Any]]]:
            return self._create_return_from_row(item)
        
        result = self.batch_service.execute_batch_operation(
            returns_data,
            create_return_wrapper,
            source_file=file_path
        )
        
        return result.to_dict()
    
    def _read_csv_file(self, file_path: str) -> List[Dict[str, Any]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        returns = []
        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                returns.append(row)
        
        return returns
    
    def _create_return_from_row(self, row: Dict[str, Any]) -> Tuple[Any, Optional[Dict[str, Any]]]:
        allocation_no = Helpers.safe_str(row.get("allocation_no") or row.get("调拨单号"))
        quantity = Helpers.safe_float(row.get("quantity") or row.get("归还数量"))
        received_by = Helpers.safe_str(row.get("received_by") or row.get("接收人"))
        returned_by = Helpers.safe_str(row.get("returned_by") or row.get("归还人"))
        returned_at_str = Helpers.safe_str(row.get("returned_at") or row.get("归还日期"))
        booth_number = Helpers.safe_str(row.get("booth_number") or row.get("展位号"))
        condition_remark = Helpers.safe_str(row.get("condition_remark") or row.get("状况备注"))
        remarks = Helpers.safe_str(row.get("remarks") or row.get("备注"))
        
        valid, error_msg = Validators.validate_quantity(quantity)
        if not valid:
            error = {
                "error_type": AnomalyType.INVALID_DATA,
                "error_message": error_msg,
                "suggestion": "请填写正确的归还数量"
            }
            return None, error
        
        valid, error_msg = Validators.validate_person_name(received_by)
        if not valid:
            error = {
                "error_type": AnomalyType.MISSING_FIELD,
                "error_message": error_msg,
                "suggestion": "请填写正确的接收人姓名"
            }
            return None, error
        
        valid, error_msg = Validators.validate_person_name(returned_by)
        if not valid:
            error = {
                "error_type": AnomalyType.MISSING_FIELD,
                "error_message": error_msg,
                "suggestion": "请填写正确的归还人姓名"
            }
            return None, error
        
        allocation = self.allocation_service.get_allocation(allocation_no=allocation_no)
        if not allocation:
            error = {
                "error_type": AnomalyType.MATERIAL_NOT_FOUND,
                "error_message": f"调拨单号 {allocation_no} 不存在",
                "suggestion": "请检查调拨单号是否正确或先导入调拨单"
            }
            return None, error
        
        returned_at = None
        if returned_at_str:
            valid, msg, dt = Validators.validate_date_format(returned_at_str)
            if valid:
                returned_at = dt
        
        try:
            record, error = self.return_service.create_return_record(
                allocation_id=allocation.id,
                quantity=quantity,
                received_by=received_by,
                returned_by=returned_by,
                returned_at=returned_at,
                booth_number=booth_number,
                condition_remark=condition_remark,
                remarks=remarks
            )
            return record, error
        except Exception as e:
            error = {
                "error_type": AnomalyType.INVALID_DATA,
                "error_message": str(e),
                "suggestion": "请检查数据是否正确"
            }
            return None, error
    
    def validate_return_csv(self, file_path: str) -> Dict[str, Any]:
        returns_data = self._read_csv_file(file_path)
        errors = []
        
        for idx, row in enumerate(returns_data):
            allocation_no = Helpers.safe_str(row.get("allocation_no") or row.get("调拨单号"))
            quantity = Helpers.safe_float(row.get("quantity") or row.get("归还数量"))
            received_by = Helpers.safe_str(row.get("received_by") or row.get("接收人"))
            returned_by = Helpers.safe_str(row.get("returned_by") or row.get("归还人"))
            
            row_errors = []
            
            if not allocation_no:
                row_errors.append("调拨单号不能为空")
            
            valid, msg = Validators.validate_quantity(quantity)
            if not valid:
                row_errors.append(msg)
            
            valid, msg = Validators.validate_person_name(received_by)
            if not valid:
                row_errors.append(msg)
            
            valid, msg = Validators.validate_person_name(returned_by)
            if not valid:
                row_errors.append(msg)
            
            if row_errors:
                errors.append({
                    "row": idx + 2,
                    "allocation_no": allocation_no,
                    "errors": row_errors
                })
        
        return {
            "total_rows": len(returns_data),
            "error_count": len(errors),
            "errors": errors,
            "is_valid": len(errors) == 0
        }
