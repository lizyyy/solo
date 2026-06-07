from sqlalchemy.orm import Session
from models import TodoExtract, ExportRecord, GrayBatch
from datetime import datetime
from typing import List, Dict, Any, Optional
import hashlib
import json
import pandas as pd
import io


class UnifiedDataService:
    @staticmethod
    def get_todo_list(
        db: Session,
        gray_batch_id: Optional[int] = None,
        status: Optional[str] = None,
        import_batch_id: Optional[str] = None,
        needs_security_review: Optional[bool] = None,
        is_overridden: Optional[bool] = None
    ) -> List[TodoExtract]:
        query = db.query(TodoExtract)
        if gray_batch_id:
            query = query.filter(TodoExtract.gray_batch_id == gray_batch_id)
        if status:
            query = query.filter(TodoExtract.status == status)
        if import_batch_id:
            query = query.filter(TodoExtract.import_batch_id == import_batch_id)
        if needs_security_review is not None:
            query = query.filter(TodoExtract.needs_security_review == needs_security_review)
        if is_overridden is not None:
            query = query.filter(TodoExtract.is_overridden_by_batch == is_overridden)
        return query.order_by(TodoExtract.id).all()

    @staticmethod
    def get_todo_detail(db: Session, todo_id: int) -> Optional[TodoExtract]:
        return db.query(TodoExtract).filter(TodoExtract.id == todo_id).first()

    @staticmethod
    def export_todos(
        db: Session,
        export_format: str = "xlsx",
        gray_batch_id: Optional[int] = None,
        status: Optional[str] = None,
        exported_by: str = "system"
    ) -> tuple[bytes, ExportRecord]:
        todos = UnifiedDataService.get_todo_list(
            db, gray_batch_id=gray_batch_id, status=status
        )

        data_list = UnifiedDataService._serialize_todos(todos)
        data_hash = UnifiedDataService._calculate_hash(data_list)

        if export_format == "xlsx":
            file_content = UnifiedDataService._generate_excel(data_list)
        elif export_format == "csv":
            file_content = UnifiedDataService._generate_csv(data_list)
        else:
            file_content = json.dumps(data_list, ensure_ascii=False, indent=2).encode("utf-8")

        export_record = ExportRecord(
            export_type="todo_extract",
            export_format=export_format,
            source_query={
                "gray_batch_id": gray_batch_id,
                "status": status
            },
            record_count=len(todos),
            data_hash=data_hash,
            exported_by=exported_by,
            exported_at=datetime.utcnow(),
            file_path=f"exports/todo_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{export_format}"
        )
        db.add(export_record)
        db.commit()

        return file_content, export_record

    @staticmethod
    def get_page_data(
        db: Session,
        page: int = 1,
        page_size: int = 20,
        gray_batch_id: Optional[int] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        todos = UnifiedDataService.get_todo_list(
            db, gray_batch_id=gray_batch_id, status=status
        )
        total = len(todos)
        start = (page - 1) * page_size
        end = start + page_size
        page_todos = todos[start:end]

        return {
            "items": UnifiedDataService._serialize_todos(page_todos),
            "total": total,
            "page": page,
            "page_size": page_size,
            "data_hash": UnifiedDataService._calculate_hash(
                UnifiedDataService._serialize_todos(todos)
            )
        }

    @staticmethod
    def get_api_response(
        db: Session,
        todo_ids: Optional[List[int]] = None,
        gray_batch_id: Optional[int] = None
    ) -> Dict[str, Any]:
        if todo_ids:
            todos = db.query(TodoExtract).filter(TodoExtract.id.in_(todo_ids)).order_by(TodoExtract.id).all()
        else:
            todos = UnifiedDataService.get_todo_list(db, gray_batch_id=gray_batch_id)

        data_list = UnifiedDataService._serialize_todos(todos)
        return {
            "code": 0,
            "message": "success",
            "data": data_list,
            "data_hash": UnifiedDataService._calculate_hash(data_list),
            "timestamp": datetime.utcnow().isoformat()
        }

    @staticmethod
    def _serialize_todos(todos: List[TodoExtract]) -> List[Dict[str, Any]]:
        result = []
        for todo in todos:
            result.append({
                "id": todo.id,
                "meeting_id": todo.meeting_id,
                "meeting_title": todo.meeting_title,
                "todo_content": todo.todo_content,
                "assignee": todo.assignee,
                "deadline": todo.deadline,
                "priority": todo.priority,
                "status": todo.status,
                "desensitization_level": todo.desensitization_level,
                "desensitization_note": todo.desensitization_note,
                "gray_batch_id": todo.gray_batch_id,
                "gray_batch_name": todo.gray_batch.batch_name if todo.gray_batch else None,
                "is_manual_judgment": todo.is_manual_judgment,
                "manual_judgment_by": todo.manual_judgment_by,
                "manual_judgment_at": todo.manual_judgment_at.isoformat() if todo.manual_judgment_at else None,
                "is_overridden_by_batch": todo.is_overridden_by_batch,
                "overridden_by_batch_id": todo.overridden_by_batch_id,
                "needs_security_review": todo.needs_security_review,
                "security_review_status": todo.security_review_status,
                "source_version": todo.source_version,
                "import_batch_id": todo.import_batch_id,
                "created_at": todo.created_at.isoformat(),
                "updated_at": todo.updated_at.isoformat()
            })
        return result

    @staticmethod
    def _calculate_hash(data_list: List[Dict[str, Any]]) -> str:
        data_str = json.dumps(data_list, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(data_str.encode("utf-8")).hexdigest()

    @staticmethod
    def _generate_excel(data_list: List[Dict[str, Any]]) -> bytes:
        df = pd.DataFrame(data_list)
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="待办抽取明细")
        return output.getvalue()

    @staticmethod
    def _generate_csv(data_list: List[Dict[str, Any]]) -> bytes:
        df = pd.DataFrame(data_list)
        output = io.BytesIO()
        df.to_csv(output, index=False, encoding="utf-8-sig")
        return output.getvalue()
