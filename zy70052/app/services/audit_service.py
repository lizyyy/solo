from typing import Dict, Any, Optional
from datetime import datetime
import json

from sqlalchemy.orm import Session

from app.models import AuditLog
from app.utils import (
    BusinessType, OperationType, OperationResult, 
    IdGenerator, DateTimeUtils
)


class AuditService:
    def __init__(self, db: Session):
        self.db = db
    
    def log_operation(
        self,
        business_type: BusinessType,
        operation_type: OperationType,
        business_id: Optional[int] = None,
        business_no: Optional[str] = None,
        operation_desc: Optional[str] = None,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None,
        operator_type: str = "USER",
        request_path: Optional[str] = None,
        request_method: Optional[str] = None,
        request_ip: Optional[str] = None,
        result: OperationResult = OperationResult.SUCCESS,
        error_message: Optional[str] = None
    ) -> AuditLog:
        log = AuditLog(
            log_no=IdGenerator.generate_log_no(),
            audit_time=DateTimeUtils.now_naive(),
            business_type=business_type.value,
            business_no=business_no,
            business_id=business_id,
            operation_type=operation_type.value,
            operation_desc=operation_desc,
            operator_id=operator_id,
            operator_name=operator_name,
            operator_type=operator_type,
            request_path=request_path,
            request_method=request_method,
            request_ip=request_ip,
            before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None,
            after_data=json.dumps(after_data, ensure_ascii=False) if after_data else None,
            operation_result=result.value,
            error_message=error_message
        )
        self.db.add(log)
        self.db.flush()
        return log
    
    def log_success(
        self,
        business_type: BusinessType,
        operation_type: OperationType,
        business_id: Optional[int] = None,
        business_no: Optional[str] = None,
        operation_desc: Optional[str] = None,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        return self.log_operation(
            business_type=business_type,
            operation_type=operation_type,
            business_id=business_id,
            business_no=business_no,
            operation_desc=operation_desc,
            before_data=before_data,
            after_data=after_data,
            operator_id=operator_id,
            operator_name=operator_name,
            result=OperationResult.SUCCESS,
            **kwargs
        )
    
    def log_failure(
        self,
        business_type: BusinessType,
        operation_type: OperationType,
        error_message: str,
        business_id: Optional[int] = None,
        business_no: Optional[str] = None,
        operation_desc: Optional[str] = None,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None,
        **kwargs
    ) -> AuditLog:
        return self.log_operation(
            business_type=business_type,
            operation_type=operation_type,
            business_id=business_id,
            business_no=business_no,
            operation_desc=operation_desc,
            before_data=before_data,
            after_data=after_data,
            operator_id=operator_id,
            operator_name=operator_name,
            result=OperationResult.FAILED,
            error_message=error_message,
            **kwargs
        )
    
    def log_extension_application_submit(
        self,
        application_id: int,
        application_no: str,
        loan_account_id: int,
        before_account_data: Dict[str, Any],
        operator_id: str,
        operator_name: str
    ) -> AuditLog:
        return self.log_success(
            business_type=BusinessType.EXTENSION_APPLICATION,
            operation_type=OperationType.SUBMIT,
            business_id=application_id,
            business_no=application_no,
            operation_desc=f"提交展期申请：{application_no}",
            before_data=before_account_data,
            operator_id=operator_id,
            operator_name=operator_name
        )
    
    def log_approval(
        self,
        application_id: int,
        application_no: str,
        approval_stage: str,
        operation_type: OperationType,
        before_status: str,
        after_status: str,
        operator_id: str,
        operator_name: str,
        comment: Optional[str] = None
    ) -> AuditLog:
        desc = f"{approval_stage}展期申请：{application_no}"
        if comment:
            desc += f"（{comment}）"
        
        return self.log_success(
            business_type=BusinessType.APPROVAL,
            operation_type=operation_type,
            business_id=application_id,
            business_no=application_no,
            operation_desc=desc,
            before_data={"status": before_status},
            after_data={"status": after_status},
            operator_id=operator_id,
            operator_name=operator_name
        )
    
    def log_plan_change(
        self,
        plan_id: int,
        plan_no: str,
        before_data: Dict[str, Any],
        after_data: Dict[str, Any],
        operation_type: OperationType,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None,
        reason: Optional[str] = None
    ) -> AuditLog:
        desc = f"还款计划变更：{plan_no}"
        if reason:
            desc += f"（{reason}）"
        
        return self.log_success(
            business_type=BusinessType.REPAYMENT_PLAN,
            operation_type=operation_type,
            business_id=plan_id,
            business_no=plan_no,
            operation_desc=desc,
            before_data=before_data,
            after_data=after_data,
            operator_id=operator_id,
            operator_name=operator_name,
            operator_type="SYSTEM" if not operator_id else "USER"
        )
    
    def log_limit_change(
        self,
        customer_id: str,
        operation_type: str,
        before_limit: str,
        after_limit: str,
        change_amount: str,
        reason: str,
        business_id: Optional[int] = None,
        business_no: Optional[str] = None
    ) -> AuditLog:
        return self.log_success(
            business_type=BusinessType.CREDIT_LIMIT,
            operation_type=OperationType.UPDATE,
            business_id=business_id,
            business_no=business_no,
            operation_desc=f"额度变更：{reason}",
            before_data={
                "customer_id": customer_id,
                "available_limit": before_limit
            },
            after_data={
                "customer_id": customer_id,
                "available_limit": after_limit,
                "change_amount": change_amount
            },
            operator_type="SYSTEM"
        )
    
    def log_task_execution(
        self,
        task_name: str,
        business_no: Optional[str],
        success: bool,
        result: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None
    ) -> AuditLog:
        return self.log_operation(
            business_type=BusinessType.TASK,
            operation_type=OperationType.EXECUTE,
            business_no=business_no,
            operation_desc=f"执行任务：{task_name}",
            after_data=result,
            operator_type="SYSTEM",
            result=OperationResult.SUCCESS if success else OperationResult.FAILED,
            error_message=error_message
        )
    
    def log_penalty_snapshot(
        self,
        snapshot_id: int,
        snapshot_no: str,
        loan_account_id: int,
        penalty_amount: str,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None
    ) -> AuditLog:
        return self.log_success(
            business_type=BusinessType.PENALTY,
            operation_type=OperationType.CREATE,
            business_id=snapshot_id,
            business_no=snapshot_no,
            operation_desc=f"创建罚息快照：{snapshot_no}，罚息金额：{penalty_amount}",
            after_data={
                "loan_account_id": loan_account_id,
                "penalty_amount": penalty_amount
            },
            operator_id=operator_id,
            operator_name=operator_name,
            operator_type="SYSTEM" if not operator_id else "USER"
        )
    
    def log_reconciliation_export(
        self,
        export_no: str,
        start_date: str,
        end_date: str,
        record_count: int,
        success: bool,
        error_message: Optional[str] = None
    ) -> AuditLog:
        return self.log_operation(
            business_type=BusinessType.RECONCILIATION,
            operation_type=OperationType.EXECUTE,
            business_no=export_no,
            operation_desc=f"导出对账数据：{start_date} 至 {end_date}",
            after_data={
                "record_count": record_count,
                "start_date": start_date,
                "end_date": end_date
            },
            operator_type="SYSTEM",
            result=OperationResult.SUCCESS if success else OperationResult.FAILED,
            error_message=error_message
        )
