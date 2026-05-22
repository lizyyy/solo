import io
import csv
import json
import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

import pandas as pd

from pharmacy_expiry_tracker.models.orm import ExpiryRecord, ExportAuditLog
from pharmacy_expiry_tracker.models.enums import UserRole, ChangeType
from pharmacy_expiry_tracker.schemas.export import ExportRequest
from pharmacy_expiry_tracker.utils.helpers import (
    calculate_file_hash,
    mask_sensitive_data
)
from pharmacy_expiry_tracker.utils.exceptions import (
    PermissionDeniedException,
    InvalidStateException
)


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def _check_export_permission(self, user_role: str) -> bool:
        allowed_roles = [
            UserRole.TOWN_SUPERVISOR,
            UserRole.REGIONAL_SUPERVISOR,
            UserRole.AUDITOR,
            UserRole.ADMIN
        ]
        return UserRole(user_role) in allowed_roles

    def _get_records_for_export(
        self,
        request: ExportRequest
    ) -> List[ExpiryRecord]:
        query = self.db.query(ExpiryRecord)

        if request.region:
            query = query.filter(ExpiryRecord.region == request.region)
        if request.town:
            query = query.filter(ExpiryRecord.town == request.town)
        if request.pharmacy_code:
            query = query.filter(ExpiryRecord.pharmacy_code == request.pharmacy_code)
        if request.status:
            query = query.filter(ExpiryRecord.status == request.status)
        if request.start_date:
            query = query.filter(ExpiryRecord.created_at >= datetime.combine(request.start_date, datetime.min.time()))
        if request.end_date:
            query = query.filter(ExpiryRecord.created_at <= datetime.combine(request.end_date, datetime.max.time()))

        records = query.order_by(ExpiryRecord.created_at.desc()).all()

        for record in records:
            if record.is_frozen:
                raise InvalidStateException(
                    f"记录 {record.record_no} 处于冻结状态，无法导出。请先解冻后再导出。"
                )

        return records

    def _record_to_dict(
        self,
        record: ExpiryRecord,
        is_masked: bool = True,
        user_role: str = ""
    ) -> Dict[str, Any]:
        data = {
            "记录编号": record.record_no,
            "药房编码": record.pharmacy_code,
            "药房名称": record.pharmacy_name,
            "区域": record.region,
            "乡镇": record.town,
            "药品编码": record.drug_code,
            "药品名称": record.drug_name,
            "药品规格": record.drug_spec,
            "批号": record.batch_no,
            "有效期": record.expiry_date.strftime("%Y-%m-%d") if record.expiry_date else "",
            "数量": record.quantity,
            "单位": record.unit,
            "近效期天数": record.days_near_expiry,
            "近效期分类": record.expiry_category,
            "追责结果": record.liability_result,
            "追责金额": record.liability_amount,
            "状态": record.status,
            "是否冻结": "是" if record.is_frozen else "否",
            "创建人": record.created_by,
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
            "更新人": record.updated_by,
            "更新时间": record.updated_at.strftime("%Y-%m-%d %H:%M:%S") if record.updated_at else "",
            "当前版本": record.current_version,
            "变更原因": record.change_reason,
            "备注": record.remarks
        }

        if is_masked:
            data = mask_sensitive_data(data, user_role)

        return data

    def _create_audit_log(
        self,
        request: ExportRequest,
        export_id: str,
        file_name: str,
        file_content: bytes,
        record_count: int
    ) -> ExportAuditLog:
        filters = {
            "region": request.region,
            "town": request.town,
            "pharmacy_code": request.pharmacy_code,
            "status": request.status,
            "start_date": str(request.start_date) if request.start_date else None,
            "end_date": str(request.end_date) if request.end_date else None
        }

        audit_log = ExportAuditLog(
            export_id=export_id,
            exported_by=request.exported_by,
            user_role=request.user_role,
            record_count=record_count,
            is_masked=request.is_masked,
            filters_applied=json.dumps(filters, ensure_ascii=False),
            file_name=file_name,
            file_hash=calculate_file_hash(file_content)
        )
        self.db.add(audit_log)
        self.db.commit()
        return audit_log

    def export_to_excel(
        self,
        request: ExportRequest
    ) -> tuple[bytes, str, int]:
        if not self._check_export_permission(request.user_role):
            raise PermissionDeniedException(f"角色 {request.user_role} 无导出权限")

        records = self._get_records_for_export(request)
        record_count = len(records)

        data_list = [
            self._record_to_dict(r, request.is_masked, request.user_role)
            for r in records
        ]

        df = pd.DataFrame(data_list)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='近效期台账')

            worksheet = writer.sheets['近效期台账']
            for idx, col in enumerate(df.columns):
                max_length = max(
                    df[col].astype(str).map(len).max(),
                    len(col)
                ) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_length, 50)

        file_content = output.getvalue()
        export_id = f"EXP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        file_name = f"近效期台账_{export_id}.xlsx"

        self._create_audit_log(request, export_id, file_name, file_content, record_count)

        return file_content, file_name, record_count

    def export_to_csv(
        self,
        request: ExportRequest
    ) -> tuple[bytes, str, int]:
        if not self._check_export_permission(request.user_role):
            raise PermissionDeniedException(f"角色 {request.user_role} 无导出权限")

        records = self._get_records_for_export(request)
        record_count = len(records)

        data_list = [
            self._record_to_dict(r, request.is_masked, request.user_role)
            for r in records
        ]

        output = io.StringIO()
        if data_list:
            writer = csv.DictWriter(output, fieldnames=data_list[0].keys())
            writer.writeheader()
            writer.writerows(data_list)

        file_content = output.getvalue().encode('utf-8-sig')
        export_id = f"EXP-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        file_name = f"近效期台账_{export_id}.csv"

        self._create_audit_log(request, export_id, file_name, file_content, record_count)

        return file_content, file_name, record_count

    def export_records(
        self,
        request: ExportRequest
    ) -> tuple[bytes, str, int]:
        if request.export_format.lower() == 'csv':
            return self.export_to_csv(request)
        else:
            return self.export_to_excel(request)

    def get_export_audit_logs(
        self,
        skip: int = 0,
        limit: int = 100,
        exported_by: Optional[str] = None,
        user_role: Optional[str] = None
    ) -> tuple[List[ExportAuditLog], int]:
        query = self.db.query(ExportAuditLog)

        if exported_by:
            query = query.filter(ExportAuditLog.exported_by == exported_by)
        if user_role:
            query = query.filter(ExportAuditLog.user_role == user_role)

        total = query.count()
        logs = query.order_by(ExportAuditLog.exported_at.desc()).offset(skip).limit(limit).all()

        return logs, total

    def get_export_audit_log(self, export_id: str) -> Optional[ExportAuditLog]:
        return self.db.query(ExportAuditLog).filter(ExportAuditLog.export_id == export_id).first()
