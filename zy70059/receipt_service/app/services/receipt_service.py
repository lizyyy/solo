import uuid
import json
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.models import (
    Receipt, 
    SignatureRecord, 
    ReprintPermission, 
    DownloadLog, 
    AuditLog,
    EnterpriseCustomer
)
from app.schemas import (
    PermissionRequest, 
    DownloadRequest, 
    DownloadResult,
    ValidationResult,
    ExportItem
)
from app.services.consistency_validator import ConsistencyValidator
from app.config import settings
from app.db import db_lock


class ReceiptService:
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:16]}"
    
    def _record_audit(
        self,
        operation_type: str,
        operator_id: str,
        operator_name: str,
        operation_result: str,
        customer_id: Optional[str] = None,
        receipt_index: Optional[str] = None,
        original_transaction_id: Optional[str] = None,
        permission_id: Optional[str] = None,
        operation_details: Optional[str] = None,
        before_value: Optional[str] = None,
        after_value: Optional[str] = None,
        client_ip: Optional[str] = None
    ) -> None:
        audit = AuditLog(
            audit_id=self._generate_id("AUD"),
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            customer_id=customer_id,
            receipt_index=receipt_index,
            original_transaction_id=original_transaction_id,
            permission_id=permission_id,
            operation_details=operation_details,
            before_value=before_value,
            after_value=after_value,
            operation_result=operation_result,
            client_ip=client_ip
        )
        self.db.add(audit)
    
    def create_permission(self, request: PermissionRequest) -> Tuple[ReprintPermission, ValidationResult]:
        receipt = self.db.query(Receipt).filter(
            Receipt.receipt_index == request.receipt_index
        ).first()
        
        if not receipt:
            result = ValidationResult(valid=False, errors=["回单不存在"])
            self._record_audit(
                operation_type="PERMISSION_CREATE",
                operator_id=request.operator_id,
                operator_name=request.operator_name,
                operation_result="FAILED",
                customer_id=request.customer_id,
                receipt_index=request.receipt_index,
                operation_details=f"创建权限失败: 回单不存在"
            )
            return None, result
        
        if receipt.customer_id != request.customer_id:
            result = ValidationResult(valid=False, errors=["客户与回单不匹配"])
            self._record_audit(
                operation_type="PERMISSION_CREATE",
                operator_id=request.operator_id,
                operator_name=request.operator_name,
                operation_result="FAILED",
                customer_id=request.customer_id,
                receipt_index=request.receipt_index,
                operation_details="创建权限失败: 客户与回单不匹配"
            )
            return None, result
        
        signature = self.db.query(SignatureRecord).filter(
            SignatureRecord.receipt_id == receipt.id
        ).first()
        
        sig_validation = ConsistencyValidator.validate_receipt_signature_consistency(
            receipt, signature
        )
        if not sig_validation.valid:
            self._record_audit(
                operation_type="PERMISSION_CREATE",
                operator_id=request.operator_id,
                operator_name=request.operator_name,
                operation_result="FAILED",
                customer_id=request.customer_id,
                receipt_index=request.receipt_index,
                original_transaction_id=receipt.original_transaction_id,
                operation_details=f"创建权限失败: 签章校验失败 - {';'.join(sig_validation.errors)}"
            )
            return None, sig_validation
        
        existing_active = self.db.query(ReprintPermission).filter(
            ReprintPermission.customer_id == request.customer_id,
            ReprintPermission.receipt_id == receipt.id,
            ReprintPermission.is_active == True
        ).first()
        
        if existing_active:
            validity_check = ConsistencyValidator.validate_permission_validity(existing_active)
            if validity_check.valid:
                download_check = ConsistencyValidator.validate_download_count(existing_active)
                if download_check.valid:
                    result = ValidationResult(
                        valid=False,
                        errors=["已存在有效的补打权限"],
                        warnings=[f"现有权限ID: {existing_active.permission_id}"]
                    )
                    return None, result
        
        now = datetime.utcnow()
        permission = ReprintPermission(
            permission_id=self._generate_id("PERM"),
            customer_id=request.customer_id,
            receipt_id=receipt.id,
            receipt_index=receipt.receipt_index,
            original_transaction_id=receipt.original_transaction_id,
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            request_reason=request.request_reason,
            max_download_count=request.max_download_count,
            current_download_count=0,
            valid_from=now,
            valid_until=now + timedelta(days=request.valid_days),
            is_active=True,
            approved_by=request.operator_id,
            approved_at=now
        )
        
        self.db.add(permission)
        self._record_audit(
            operation_type="PERMISSION_CREATE",
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            operation_result="SUCCESS",
            customer_id=request.customer_id,
            receipt_index=receipt.receipt_index,
            original_transaction_id=receipt.original_transaction_id,
            permission_id=permission.permission_id,
            operation_details=json.dumps({
                "max_download_count": request.max_download_count,
                "valid_days": request.valid_days,
                "reason": request.request_reason
            }, ensure_ascii=False)
        )
        
        try:
            self.db.commit()
            self.db.refresh(permission)
            return permission, ValidationResult(valid=True)
        except SQLAlchemyError as e:
            self.db.rollback()
            return None, ValidationResult(valid=False, errors=[f"数据库错误: {str(e)}"])
    
    def download_receipt(self, request: DownloadRequest) -> DownloadResult:
        with db_lock:
            try:
                return self._do_download(request)
            except Exception as e:
                return DownloadResult(
                    success=False,
                    receipt_index=request.receipt_index,
                    error_message=f"处理异常: {str(e)}"
                )
    
    def _do_download(self, request: DownloadRequest) -> DownloadResult:
        permission = self.db.query(ReprintPermission).filter(
            ReprintPermission.permission_id == request.permission_id
        ).first()
        
        if not permission:
            self._record_audit(
                operation_type="RECEIPT_DOWNLOAD",
                operator_id=request.operator_id,
                operator_name=request.operator_name,
                operation_result="FAILED",
                customer_id=request.customer_id,
                receipt_index=request.receipt_index,
                operation_details="下载失败: 权限不存在"
            )
            return DownloadResult(
                success=False,
                receipt_index=request.receipt_index,
                error_message="补打权限不存在"
            )
        
        receipt = self.db.query(Receipt).filter(
            Receipt.receipt_index == request.receipt_index
        ).first()
        
        if not receipt:
            self._record_audit(
                operation_type="RECEIPT_DOWNLOAD",
                operator_id=request.operator_id,
                operator_name=request.operator_name,
                operation_result="FAILED",
                customer_id=request.customer_id,
                receipt_index=request.receipt_index,
                permission_id=permission.permission_id,
                operation_details="下载失败: 回单不存在"
            )
            return DownloadResult(
                success=False,
                receipt_index=request.receipt_index,
                error_message="回单不存在"
            )
        
        signature = self.db.query(SignatureRecord).filter(
            SignatureRecord.receipt_id == receipt.id
        ).first()
        
        download_logs = self.db.query(DownloadLog).filter(
            DownloadLog.permission_id == permission.permission_id
        ).order_by(DownloadLog.downloaded_at).all()
        
        validation = ConsistencyValidator.validate_full_download_chain(
            receipt=receipt,
            signature=signature,
            permission=permission,
            download_logs=download_logs
        )
        
        if not validation.valid:
            error_msg = "; ".join(validation.errors)
            self._record_audit(
                operation_type="RECEIPT_DOWNLOAD",
                operator_id=request.operator_id,
                operator_name=request.operator_name,
                operation_result="FAILED",
                customer_id=request.customer_id,
                receipt_index=receipt.receipt_index,
                original_transaction_id=receipt.original_transaction_id,
                permission_id=permission.permission_id,
                operation_details=f"下载失败: 校验不通过 - {error_msg}"
            )
            return DownloadResult(
                success=False,
                receipt_index=request.receipt_index,
                error_message=error_msg
            )
        
        new_seq = permission.current_download_count + 1
        watermark_info = self._generate_watermark(
            receipt_index=receipt.receipt_index,
            download_seq=new_seq,
            operator_name=request.operator_name,
            customer_id=request.customer_id
        )
        
        permission.current_download_count = new_seq
        
        if permission.current_download_count >= permission.max_download_count:
            permission.is_active = False
        
        download_log = DownloadLog(
            log_id=self._generate_id("LOG"),
            receipt_id=receipt.id,
            receipt_index=receipt.receipt_index,
            permission_id=permission.permission_id,
            customer_id=request.customer_id,
            original_transaction_id=receipt.original_transaction_id,
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            download_seq=new_seq,
            watermark_info=watermark_info,
            client_ip=request.client_ip,
            user_agent=request.user_agent,
            status="SUCCESS"
        )
        self.db.add(download_log)
        
        self._record_audit(
            operation_type="RECEIPT_DOWNLOAD",
            operator_id=request.operator_id,
            operator_name=request.operator_name,
            operation_result="SUCCESS",
            customer_id=request.customer_id,
            receipt_index=receipt.receipt_index,
            original_transaction_id=receipt.original_transaction_id,
            permission_id=permission.permission_id,
            operation_details=json.dumps({
                "download_seq": new_seq,
                "watermark": watermark_info
            }, ensure_ascii=False),
            before_value=json.dumps({
                "current_download_count": new_seq - 1,
                "is_active": True
            }),
            after_value=json.dumps({
                "current_download_count": new_seq,
                "is_active": permission.is_active
            }),
            client_ip=request.client_ip
        )
        
        try:
            self.db.commit()
            self.db.refresh(download_log)
            
            updated_logs = self.db.query(DownloadLog).filter(
                DownloadLog.permission_id == permission.permission_id
            ).order_by(DownloadLog.downloaded_at).all()
            
            count_check = ConsistencyValidator.validate_download_logs_consistency(
                permission, updated_logs
            )
            if not count_check.valid:
                self.db.rollback()
                return DownloadResult(
                    success=False,
                    receipt_index=request.receipt_index,
                    error_message=f"下载后一致性校验失败: {';'.join(count_check.errors)}"
                )
            
            return DownloadResult(
                success=True,
                receipt_index=request.receipt_index,
                download_seq=new_seq,
                watermark_info=watermark_info
            )
            
        except SQLAlchemyError as e:
            self.db.rollback()
            return DownloadResult(
                success=False,
                receipt_index=request.receipt_index,
                error_message=f"数据库错误: {str(e)}"
            )
    
    def _generate_watermark(
        self,
        receipt_index: str,
        download_seq: int,
        operator_name: str,
        customer_id: str
    ) -> str:
        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        return json.dumps({
            "watermark_text": settings.watermark_text,
            "receipt_index": receipt_index,
            "download_seq": download_seq,
            "operator_name": operator_name,
            "customer_id": customer_id,
            "download_time": now,
            "is_copy": True
        }, ensure_ascii=False)
    
    def get_export_items(
        self,
        customer_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> List[ExportItem]:
        receipts = self.db.query(Receipt).filter(
            Receipt.customer_id == customer_id,
            Receipt.transaction_date >= start_date,
            Receipt.transaction_date <= end_date
        ).order_by(Receipt.transaction_date.desc()).all()
        
        items = []
        for receipt in receipts:
            download_logs = self.db.query(DownloadLog).filter(
                DownloadLog.receipt_id == receipt.id,
                DownloadLog.status == "SUCCESS"
            ).order_by(DownloadLog.downloaded_at.desc()).all()
            
            last_log = download_logs[0] if download_logs else None
            
            item = ExportItem(
                receipt_index=receipt.receipt_index,
                original_transaction_id=receipt.original_transaction_id,
                transaction_date=receipt.transaction_date,
                transaction_type=receipt.transaction_type,
                transaction_amount=receipt.transaction_amount,
                counterparty_name=receipt.counterparty_name,
                reprint_count=len(download_logs),
                last_download_at=last_log.downloaded_at if last_log else None,
                last_operator=last_log.operator_name if last_log else None
            )
            items.append(item)
        
        return items