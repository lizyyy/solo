"""
核心业务逻辑服务
包含限额调整、升级事务处理、降级缓冲、超限拦截等功能
"""

from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
from datetime import datetime

from .models import (
    PlanVersion, QuotaBucket, UpgradeTransaction,
    QuotaChange, TenantReport, QuotaType,
    TransactionStatus, ChangeReason
)
from .storage import QuotaStorage
from .validators import QuotaValidator, ValidationResult


@dataclass
class ServiceResult:
    """服务执行结果"""
    success: bool
    message: str
    data: Optional[dict] = None
    transaction_id: Optional[str] = None
    errors: Optional[List[str]] = None


class QuotaService:
    """限额服务
    核心业务逻辑
    """
    
    def __init__(self, storage: Optional[QuotaStorage] = None) -> None:
        self.storage = storage or QuotaStorage()
        self.validator = QuotaValidator()
    
    # ========== 套餐升级 ==========
    
    def upgrade_plan(
        self,
        tenant_id: str,
        new_plan_id: str,
        new_plan_version: int,
        request_id: Optional[str] = None,
        operator_id: Optional[str] = None,
        notes: Optional[str] = None
    ) -> ServiceResult:
        """升级租户套餐
        包含幂等性检查、降级缓冲、事务处理
        """
        existing_tx = self.storage.get_transaction_by_request(request_id) if request_id else None
        is_duplicate, existing_tx_id = self.validator.check_duplicate_request(
            request_id, existing_tx
        )
        
        if is_duplicate and existing_tx:
            return ServiceResult(
                success=True,
                message="重复请求，返回已有事务",
                data=self._transaction_to_dict(existing_tx),
                transaction_id=existing_tx.transaction_id
            )
        
        old_bucket = self.storage.get_tenant_bucket(tenant_id)
        if not old_bucket:
            return ServiceResult(
                success=False,
                message="租户限额桶不存在",
                errors=["租户限额桶不存在"]
            )
        
        old_plan = old_bucket.plan_version
        new_plan = self.storage.get_plan(new_plan_id, new_plan_version)
        
        validation = self.validator.validate_plan_upgrade(
            tenant_id, old_plan, new_plan, request_id
        )
        
        if not validation.is_valid:
            return ServiceResult(
                success=False,
                message="参数验证失败",
                errors=validation.error_messages
            )
        
        transaction = UpgradeTransaction(
            tenant_id=tenant_id,
            old_plan_version=old_plan,
            new_plan_version=new_plan,
            request_id=request_id,
            operator_id=operator_id,
            notes=notes,
            status=TransactionStatus.PROCESSING
        )
        
        self.storage.save_transaction(transaction)
        
        try:
            is_downgrade = self._is_downgrade(old_plan, new_plan)
            if is_downgrade:
                transaction.reason = ChangeReason.DOWNGRADE
            else:
                transaction.reason = ChangeReason.UPGRADE
            
            changes = self._calculate_changes(old_bucket, new_plan)
            
            is_safe, unsafe_types = self.validator.check_downgrade_safety(old_bucket, new_plan)
            buffer_quotas = {}
            if unsafe_types:
                for qt in unsafe_types:
                    used = old_bucket.get_usage(qt)
                    new_quota = new_plan.get_quota(qt)
                    buffer_quotas[qt] = used - new_quota
            
            new_bucket = self._apply_changes(
                old_bucket, new_plan, changes, buffer_quotas
            )
            
            for qt, change in changes.items():
                quota_change = QuotaChange(
                    quota_type=qt,
                    old_value=change["old_value"],
                    new_value=change["new_value"],
                    change_amount=change["change_amount"],
                    reason="升级" if not is_downgrade else "降级"
                )
                transaction.add_change(quota_change)
            
            if buffer_quotas:
                for qt, buffer in buffer_quotas.items():
                    quota_change = QuotaChange(
                        quota_type=qt,
                        old_value=0,
                        new_value=buffer,
                        change_amount=buffer,
                        reason="降级缓冲"
                    )
                    transaction.add_change(quota_change)
            
            self.storage.save_bucket(new_bucket)
            transaction.mark_completed()
            self.storage.save_transaction(transaction)
            
            return ServiceResult(
                success=True,
                message="套餐升级成功",
                data={
                    "transaction": self._transaction_to_dict(transaction),
                    "new_bucket": self._bucket_to_dict(new_bucket)
                },
                transaction_id=transaction.transaction_id
            )
            
        except Exception as e:
            transaction.mark_failed(str(e))
            self.storage.save_transaction(transaction)
            
            try:
                self._rollback_transaction(transaction)
            except Exception as rollback_error:
                return ServiceResult(
                    success=False,
                    message=f"升级失败，回滚也失败: {str(rollback_error)}",
                    errors=[str(e), f"回滚失败: {str(rollback_error)}"],
                    transaction_id=transaction.transaction_id
                )
            
            return ServiceResult(
                success=False,
                message=f"升级失败，已回滚: {str(e)}",
                errors=[str(e)],
                transaction_id=transaction.transaction_id
            )
    
    def _calculate_changes(
        self,
        old_bucket: QuotaBucket,
        new_plan: PlanVersion
    ) -> Dict[QuotaType, dict]:
        """计算限额变化"""
        changes = {}
        for qt in QuotaType:
            old_value = old_bucket.quotas.get(qt, 0)
            new_value = new_plan.get_quota(qt)
            change_amount = new_value - old_value
            if change_amount != 0:
                changes[qt] = {
                    "old_value": old_value,
                    "new_value": new_value,
                    "change_amount": change_amount
                }
        return changes
    
    def _apply_changes(
        self,
        old_bucket: QuotaBucket,
        new_plan: PlanVersion,
        changes: Dict[QuotaType, dict],
        buffer_quotas: Dict[QuotaType, int]
    ) -> QuotaBucket:
        """应用限额变化到限额桶"""
        new_bucket = QuotaBucket(
            bucket_id=old_bucket.bucket_id,
            tenant_id=old_bucket.tenant_id,
            plan_version=new_plan,
            quotas=dict(old_bucket.quotas),
            used=dict(old_bucket.used),
            buffer_quotas=dict(buffer_quotas),
            manual_overrides=dict(old_bucket.manual_overrides)
        )
        
        for qt in QuotaType:
            new_bucket.quotas[qt] = new_plan.get_quota(qt)
        
        return new_bucket
    
    def _is_downgrade(self, old_plan: PlanVersion, new_plan: PlanVersion) -> bool:
        """判断是否是降级"""
        if old_plan is None:
            return False
        
        for qt in QuotaType:
            if new_plan.get_quota(qt) < old_plan.get_quota(qt):
                return True
        
        return False
    
    def _rollback_transaction(self, transaction: UpgradeTransaction) -> None:
        """回滚事务"""
        if transaction.status != TransactionStatus.FAILED:
            return
        
        bucket = self.storage.get_tenant_bucket(transaction.tenant_id)
        if not bucket:
            return
        
        if transaction.old_plan_version:
            bucket.plan_version = transaction.old_plan_version
            for qt in QuotaType:
                bucket.quotas[qt] = transaction.old_plan_version.get_quota(qt)
        
        bucket.buffer_quotas = {}
        self.storage.save_bucket(bucket)
        
        rollback_tx = UpgradeTransaction(
            tenant_id=transaction.tenant_id,
            old_plan_version=transaction.new_plan_version,
            new_plan_version=transaction.old_plan_version,
            reason=ChangeReason.MANUAL_ADJUSTMENT,
            notes=f"回滚事务: {transaction.transaction_id}",
            status=TransactionStatus.ROLLED_BACK
        )
        self.storage.save_transaction(rollback_tx)
        
        transaction.rollback_transaction_id = rollback_tx.transaction_id
        self.storage.save_transaction(transaction)
    
    # ========== 人工调整 ==========
    
    def manual_adjustment(
        self,
        tenant_id: str,
        quota_type: str,
        new_value: int,
        operator_id: str,
        reason: str = ""
    ) -> ServiceResult:
        """人工调整限额
        支持运营人员手动修改租户限额
        """
        validation = self.validator.validate_manual_adjustment(
            tenant_id, quota_type, new_value, operator_id
        )
        
        if not validation.is_valid:
            return ServiceResult(
                success=False,
                message="参数验证失败",
                errors=validation.error_messages
            )
        
        qt = QuotaType(quota_type)
        bucket = self.storage.get_tenant_bucket(tenant_id)
        
        if not bucket:
            return ServiceResult(
                success=False,
                message="租户限额桶不存在",
                errors=["租户限额桶不存在"]
            )
        
        old_value = bucket.get_effective_quota(qt)
        
        transaction = UpgradeTransaction(
            tenant_id=tenant_id,
            old_plan_version=bucket.plan_version,
            new_plan_version=bucket.plan_version,
            reason=ChangeReason.MANUAL_ADJUSTMENT,
            operator_id=operator_id,
            notes=f"人工调整: {reason}",
            status=TransactionStatus.PROCESSING
        )
        self.storage.save_transaction(transaction)
        
        try:
            bucket.manual_overrides[qt] = new_value
            
            quota_change = QuotaChange(
                quota_type=qt,
                old_value=old_value,
                new_value=new_value,
                change_amount=new_value - old_value,
                reason=f"人工调整: {reason}" if reason else "人工调整"
            )
            transaction.add_change(quota_change)
            
            self.storage.save_bucket(bucket)
            transaction.mark_completed()
            self.storage.save_transaction(transaction)
            
            return ServiceResult(
                success=True,
                message="人工调整成功",
                data={
                    "transaction": self._transaction_to_dict(transaction),
                    "new_bucket": self._bucket_to_dict(bucket)
                },
                transaction_id=transaction.transaction_id
            )
            
        except Exception as e:
            transaction.mark_failed(str(e))
            self.storage.save_transaction(transaction)
            return ServiceResult(
                success=False,
                message=f"人工调整失败: {str(e)}",
                errors=[str(e)],
                transaction_id=transaction.transaction_id
            )
    
    def clear_manual_override(
        self,
        tenant_id: str,
        quota_type: str,
        operator_id: str
    ) -> ServiceResult:
        """清除人工覆盖，恢复套餐默认值"""
        try:
            qt = QuotaType(quota_type)
        except ValueError:
            return ServiceResult(
                success=False,
                message=f"无效的限额类型: {quota_type}",
                errors=[f"无效的限额类型: {quota_type}"]
            )
        
        bucket = self.storage.get_tenant_bucket(tenant_id)
        if not bucket:
            return ServiceResult(
                success=False,
                message="租户限额桶不存在",
                errors=["租户限额桶不存在"]
            )
        
        if qt not in bucket.manual_overrides:
            return ServiceResult(
                success=True,
                message="没有人工覆盖需要清除",
                data={"quota_type": quota_type}
            )
        
        old_value = bucket.get_effective_quota(qt)
        del bucket.manual_overrides[qt]
        new_value = bucket.get_effective_quota(qt)
        
        transaction = UpgradeTransaction(
            tenant_id=tenant_id,
            old_plan_version=bucket.plan_version,
            new_plan_version=bucket.plan_version,
            reason=ChangeReason.MANUAL_ADJUSTMENT,
            operator_id=operator_id,
            notes="清除人工覆盖，恢复套餐默认值",
            status=TransactionStatus.PROCESSING
        )
        self.storage.save_transaction(transaction)
        
        quota_change = QuotaChange(
            quota_type=qt,
            old_value=old_value,
            new_value=new_value,
            change_amount=new_value - old_value,
            reason="清除人工覆盖"
        )
        transaction.add_change(quota_change)
        
        self.storage.save_bucket(bucket)
        transaction.mark_completed()
        self.storage.save_transaction(transaction)
        
        return ServiceResult(
            success=True,
            message="已清除人工覆盖",
            data={
                "transaction": self._transaction_to_dict(transaction),
                "new_bucket": self._bucket_to_dict(bucket)
            },
            transaction_id=transaction.transaction_id
        )
    
    # ========== 使用量管理 ==========
    
    def consume_quota(
        self,
        tenant_id: str,
        quota_type: str,
        amount: int = 1
    ) -> ServiceResult:
        """消费限额
        包含超限拦截
        """
        try:
            qt = QuotaType(quota_type)
        except ValueError:
            return ServiceResult(
                success=False,
                message=f"无效的限额类型: {quota_type}",
                errors=[f"无效的限额类型: {quota_type}"]
            )
        
        bucket = self.storage.get_tenant_bucket(tenant_id)
        if not bucket:
            return ServiceResult(
                success=False,
                message="租户限额桶不存在",
                errors=["租户限额桶不存在"]
            )
        
        remaining = bucket.get_remaining(qt)
        is_overflow = bucket.is_overflow(qt)
        
        if is_overflow and remaining < 0:
            return ServiceResult(
                success=False,
                message=f"限额不足，已超限: {abs(remaining)}",
                errors=["限额超限"],
                data={
                    "quota_type": quota_type,
                    "used": bucket.get_usage(qt),
                    "total": bucket.get_effective_quota(qt),
                    "remaining": remaining,
                    "is_overflow": True
                }
            )
        
        if remaining < amount:
            return ServiceResult(
                success=False,
                message=f"限额不足，剩余: {remaining}, 需要: {amount}",
                errors=["限额不足"],
                data={
                    "quota_type": quota_type,
                    "used": bucket.get_usage(qt),
                    "total": bucket.get_effective_quota(qt),
                    "remaining": remaining,
                    "is_overflow": False
                }
            )
        
        bucket.used[qt] = bucket.get_usage(qt) + amount
        self.storage.save_bucket(bucket)
        
        new_remaining = bucket.get_remaining(qt)
        warning_remaining = bucket.get_effective_quota(qt) * 0.1
        
        return ServiceResult(
            success=True,
            message="消费成功" if new_remaining > warning_remaining else "消费成功，剩余额度不足10%",
            data={
                "quota_type": quota_type,
                "used": bucket.get_usage(qt),
                "total": bucket.get_effective_quota(qt),
                "remaining": new_remaining,
                "is_overflow": bucket.is_overflow(qt),
                "warning": new_remaining <= warning_remaining
            }
        )
    
    def check_quota(
        self,
        tenant_id: str,
        quota_type: str
    ) -> ServiceResult:
        """检查限额状态"""
        try:
            qt = QuotaType(quota_type)
        except ValueError:
            return ServiceResult(
                success=False,
                message=f"无效的限额类型: {quota_type}",
                errors=[f"无效的限额类型: {quota_type}"]
            )
        
        bucket = self.storage.get_tenant_bucket(tenant_id)
        if not bucket:
            return ServiceResult(
                success=False,
                message="租户限额桶不存在",
                errors=["租户限额桶不存在"]
            )
        
        return ServiceResult(
            success=True,
            message="限额状态查询成功",
            data={
                "quota_type": quota_type,
                "total": bucket.get_effective_quota(qt),
                "base_quota": bucket.quotas.get(qt, 0),
                "buffer_quota": bucket.buffer_quotas.get(qt, 0),
                "manual_override": bucket.manual_overrides.get(qt),
                "used": bucket.get_usage(qt),
                "remaining": bucket.get_remaining(qt),
                "is_overflow": bucket.is_overflow(qt)
            }
        )
    
    # ========== 租户报表 ==========
    
    def get_tenant_report(
        self,
        tenant_id: str,
        transaction_limit: int = 10
    ) -> ServiceResult:
        """获取租户报表
        包含当前套餐、限额使用情况、历史变更记录
        """
        bucket = self.storage.get_tenant_bucket(tenant_id)
        transactions = self.storage.get_tenant_transactions(tenant_id, limit=transaction_limit)
        
        report = TenantReport(
            tenant_id=tenant_id,
            current_plan=bucket.plan_version if bucket else None,
            current_bucket=bucket,
            recent_transactions=transactions
        )
        
        return ServiceResult(
            success=True,
            message="租户报表生成成功",
            data=report.to_dict()
        )
    
    def export_tenant_report(
        self,
        tenant_id: str,
        transaction_limit: int = 100
    ) -> ServiceResult:
        """导出租户报表
        详细明细，可追溯
        """
        return self.get_tenant_report(tenant_id, transaction_limit)
    
    # ========== 工具方法 ==========
    
    def _transaction_to_dict(self, transaction: UpgradeTransaction) -> dict:
        """转换事务为字典"""
        return {
            "transaction_id": transaction.transaction_id,
            "tenant_id": transaction.tenant_id,
            "old_plan": {
                "plan_id": transaction.old_plan_version.plan_id,
                "version": transaction.old_plan_version.version,
                "name": transaction.old_plan_version.name
            } if transaction.old_plan_version else None,
            "new_plan": {
                "plan_id": transaction.new_plan_version.plan_id,
                "version": transaction.new_plan_version.version,
                "name": transaction.new_plan_version.name
            } if transaction.new_plan_version else None,
            "status": transaction.status.value,
            "reason": transaction.reason.value,
            "changes": [
                {
                    "quota_type": c.quota_type.value,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "change_amount": c.change_amount,
                    "reason": c.reason
                }
                for c in transaction.changes.values()
            ],
            "created_at": transaction.created_at.isoformat(),
            "completed_at": transaction.completed_at.isoformat() if transaction.completed_at else None,
            "error_message": transaction.error_message,
            "operator_id": transaction.operator_id,
            "request_id": transaction.request_id,
            "notes": transaction.notes
        }
    
    def _bucket_to_dict(self, bucket: QuotaBucket) -> dict:
        """转换限额桶为字典"""
        return {
            "bucket_id": bucket.bucket_id,
            "tenant_id": bucket.tenant_id,
            "plan": {
                "plan_id": bucket.plan_version.plan_id,
                "version": bucket.plan_version.version,
                "name": bucket.plan_version.name
            } if bucket.plan_version else None,
            "quotas": {
                qt.value: {
                    "base": bucket.quotas.get(qt, 0),
                    "buffer": bucket.buffer_quotas.get(qt, 0),
                    "manual_override": bucket.manual_overrides.get(qt),
                    "effective": bucket.get_effective_quota(qt),
                    "used": bucket.get_usage(qt),
                    "remaining": bucket.get_remaining(qt),
                    "is_overflow": bucket.is_overflow(qt)
                }
                for qt in QuotaType
            },
            "last_updated": bucket.last_updated.isoformat()
        }
