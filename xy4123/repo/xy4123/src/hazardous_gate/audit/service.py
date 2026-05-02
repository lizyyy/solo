import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.models.database import AuditLog
from hazardous_gate.storage.crud import AuditLogCRUD


class AuditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _serialize_details(details: Optional[dict[str, Any]]) -> Optional[str]:
        if details is None:
            return None
        try:
            return json.dumps(details, ensure_ascii=False, default=str)
        except Exception:
            return str(details)

    async def log_reagent_create(
        self,
        reagent_id: int,
        reagent_name: str,
        cas_number: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="CREATE",
            resource_type="Reagent",
            resource_id=reagent_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "name": reagent_name,
                "cas_number": cas_number,
            }),
            ip_address=ip_address,
        )

    async def log_reagent_update(
        self,
        reagent_id: int,
        changes: dict[str, Any],
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="UPDATE",
            resource_type="Reagent",
            resource_id=reagent_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({"changes": changes}),
            ip_address=ip_address,
        )

    async def log_reagent_delete(
        self,
        reagent_id: int,
        reagent_name: str,
        cas_number: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="DELETE",
            resource_type="Reagent",
            resource_id=reagent_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "name": reagent_name,
                "cas_number": cas_number,
            }),
            ip_address=ip_address,
        )

    async def log_batch_create(
        self,
        batch_id: int,
        batch_number: str,
        reagent_id: int,
        initial_quantity: float,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="CREATE",
            resource_type="Batch",
            resource_id=batch_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "batch_number": batch_number,
                "reagent_id": reagent_id,
                "initial_quantity": initial_quantity,
            }),
            ip_address=ip_address,
        )

    async def log_batch_quantity_change(
        self,
        batch_id: int,
        batch_number: str,
        old_quantity: float,
        new_quantity: float,
        reason: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="QUANTITY_CHANGE",
            resource_type="Batch",
            resource_id=batch_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "batch_number": batch_number,
                "old_quantity": old_quantity,
                "new_quantity": new_quantity,
                "delta": new_quantity - old_quantity,
                "reason": reason,
            }),
            ip_address=ip_address,
        )

    async def log_usage_create(
        self,
        usage_id: int,
        usage_number: str,
        teacher_name: str,
        course_name: str,
        item_count: int,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="CREATE",
            resource_type="CourseUsage",
            resource_id=usage_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "usage_number": usage_number,
                "teacher_name": teacher_name,
                "course_name": course_name,
                "item_count": item_count,
            }),
            ip_address=ip_address,
        )

    async def log_usage_approve(
        self,
        usage_id: int,
        usage_number: str,
        approved: bool,
        approved_by: str,
        violations: Optional[list] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="APPROVE" if approved else "REJECT",
            resource_type="CourseUsage",
            resource_id=usage_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "usage_number": usage_number,
                "approved": approved,
                "approved_by": approved_by,
                "violations": violations or [],
            }),
            ip_address=ip_address,
        )

    async def log_usage_issue(
        self,
        usage_id: int,
        usage_number: str,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="ISSUE",
            resource_type="CourseUsage",
            resource_id=usage_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "usage_number": usage_number,
            }),
            ip_address=ip_address,
        )

    async def log_return_create(
        self,
        return_id: int,
        return_number: str,
        usage_id: int,
        return_type: str,
        handler: str,
        total_returned: float,
        total_waste: float,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="RETURN",
            resource_type="ReturnRecord",
            resource_id=return_id,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "return_number": return_number,
                "usage_id": usage_id,
                "return_type": return_type,
                "handler": handler,
                "total_returned": total_returned,
                "total_waste": total_waste,
            }),
            ip_address=ip_address,
        )

    async def log_csv_import(
        self,
        total_rows: int,
        valid_rows: int,
        invalid_rows: int,
        imported_ids: list[int],
        errors: Optional[list] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="IMPORT_CSV",
            resource_type="Batch",
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "total_rows": total_rows,
                "valid_rows": valid_rows,
                "invalid_rows": invalid_rows,
                "imported_count": len(imported_ids),
                "errors": errors or [],
            }),
            ip_address=ip_address,
        )

    async def log_export(
        self,
        export_type: str,
        format: str,
        record_count: int,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="EXPORT",
            resource_type=export_type,
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "format": format,
                "record_count": record_count,
            }),
            ip_address=ip_address,
        )

    async def log_rule_violation(
        self,
        rule_name: str,
        severity: str,
        message: str,
        context: Optional[dict] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        return await AuditLogCRUD.create(
            db=self.db,
            action="RULE_VIOLATION",
            resource_type="RuleEngine",
            user_id=user_id,
            user_name=user_name,
            details=self._serialize_details({
                "rule_name": rule_name,
                "severity": severity,
                "message": message,
                "context": context or {},
            }),
            ip_address=ip_address,
        )
