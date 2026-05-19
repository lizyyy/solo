from typing import List, Dict, Any, Callable, Tuple, Optional
from datetime import datetime
import uuid
from sqlalchemy.orm import Session
from exhibition_material.storage.repository import ImportErrorRepository
from exhibition_material.models import AnomalyType, ImportError

class BatchOperationResult:
    def __init__(self, batch_id: str):
        self.batch_id = batch_id
        self.success_count = 0
        self.failure_count = 0
        self.success_items: List[Dict[str, Any]] = []
        self.failure_items: List[Dict[str, Any]] = []
        self.start_time = datetime.now()
        self.end_time: Optional[datetime] = None
    
    def add_success(self, item: Dict[str, Any]):
        self.success_count += 1
        self.success_items.append(item)
    
    def add_failure(self, item: Dict[str, Any], error: Dict[str, Any]):
        self.failure_count += 1
        failure_item = {**item, "error": error}
        self.failure_items.append(failure_item)
    
    def complete(self):
        self.end_time = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "total_count": self.success_count + self.failure_count,
            "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.end_time else None,
            "success_items": self.success_items,
            "failure_items": self.failure_items
        }

class BatchService:
    def __init__(self, session: Session):
        self.session = session
        self.error_repo = ImportErrorRepository(session)
    
    def _generate_batch_id(self) -> str:
        return f"BATCH{uuid.uuid4().hex[:12].upper()}"
    
    def execute_batch_operation(self, items: List[Dict[str, Any]],
                                 operation: Callable[[Dict[str, Any]], Tuple[Any, Optional[Dict[str, Any]]]],
                                 source_file: str = None) -> BatchOperationResult:
        batch_id = self._generate_batch_id()
        result = BatchOperationResult(batch_id)
        
        for idx, item in enumerate(items):
            try:
                processed_item, error = operation(item)
                
                if error:
                    result.add_failure(item, error)
                    try:
                        self.session.rollback()
                    except:
                        pass
                    try:
                        self._record_import_error(
                            batch_id=batch_id,
                            source_file=source_file,
                            source_line=idx + 2,
                            raw_data=str(item),
                            error_type=error["error_type"],
                            error_message=error["error_message"],
                            suggestion=error.get("suggestion")
                        )
                    except:
                        pass
                else:
                    if hasattr(processed_item, 'to_dict'):
                        result.add_success(processed_item.to_dict())
                    else:
                        result.add_success({"result": processed_item})
            except Exception as e:
                error = {
                    "error_type": AnomalyType.INVALID_DATA,
                    "error_message": str(e),
                    "suggestion": "请检查数据格式是否正确"
                }
                result.add_failure(item, error)
                try:
                    self.session.rollback()
                except:
                    pass
                try:
                    self._record_import_error(
                        batch_id=batch_id,
                        source_file=source_file,
                        source_line=idx + 2,
                        raw_data=str(item),
                        error_type=AnomalyType.INVALID_DATA,
                        error_message=str(e),
                        suggestion="请检查数据格式是否正确"
                    )
                except:
                    pass
        
        result.complete()
        return result
    
    def _record_import_error(self, batch_id: str, source_file: str, source_line: int,
                             raw_data: str, error_type: AnomalyType, error_message: str,
                             suggestion: str = None):
        self.error_repo.create(
            import_batch_id=batch_id,
            source_file=source_file,
            source_line=source_line,
            raw_data=raw_data,
            error_type=error_type,
            error_message=error_message,
            suggestion=suggestion
        )
    
    def retry_failed_items(self, failure_items: List[Dict[str, Any]],
                           operation: Callable[[Dict[str, Any]], Tuple[Any, Optional[Dict[str, Any]]]],
                           source_file: str = None) -> BatchOperationResult:
        items_to_retry = []
        for failure in failure_items:
            item = {k: v for k, v in failure.items() if k != "error"}
            items_to_retry.append(item)
        
        return self.execute_batch_operation(items_to_retry, operation, source_file)
    
    def get_import_errors(self, batch_id: str = None, unresolved_only: bool = False) -> List[Dict[str, Any]]:
        if batch_id:
            errors = self.error_repo.list_by_batch(batch_id)
        elif unresolved_only:
            errors = self.error_repo.list_unresolved()
        else:
            errors = self.error_repo.list_all()
        
        return [e.to_dict() for e in errors]
    
    def resolve_import_error(self, error_id: int, resolved_by: str):
        self.error_repo.mark_resolved(error_id, resolved_by)
