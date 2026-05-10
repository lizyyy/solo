"""
存储层
提供数据持久化能力，支持内存存储以便测试
"""

from typing import Dict, List, Optional
from datetime import datetime

from .models import (
    PlanVersion, QuotaBucket, UpgradeTransaction,
    QuotaType, TransactionStatus
)


class QuotaStorage:
    """限额存储
    负责套餐、限额桶、事务的持久化
    """
    
    def __init__(self) -> None:
        self._plans: Dict[str, PlanVersion] = {}
        self._buckets: Dict[str, QuotaBucket] = {}
        self._tenant_buckets: Dict[str, str] = {}
        self._transactions: Dict[str, UpgradeTransaction] = {}
        self._request_to_transaction: Dict[str, str] = {}
        self._tenant_transactions: Dict[str, List[str]] = {}
    
    # ========== 套餐管理 ==========
    
    def save_plan(self, plan: PlanVersion) -> None:
        """保存套餐版本"""
        plan_key = f"{plan.plan_id}:v{plan.version}"
        self._plans[plan_key] = plan
    
    def get_plan(self, plan_id: str, version: int) -> Optional[PlanVersion]:
        """获取指定版本的套餐"""
        plan_key = f"{plan_id}:v{version}"
        return self._plans.get(plan_key)
    
    def get_active_plans(self) -> List[PlanVersion]:
        """获取所有激活的套餐"""
        return [p for p in self._plans.values() if p.is_active]
    
    # ========== 限额桶管理 ==========
    
    def save_bucket(self, bucket: QuotaBucket) -> None:
        """保存限额桶"""
        bucket.last_updated = datetime.now()
        self._buckets[bucket.bucket_id] = bucket
        self._tenant_buckets[bucket.tenant_id] = bucket.bucket_id
    
    def get_bucket(self, bucket_id: str) -> Optional[QuotaBucket]:
        """根据ID获取限额桶"""
        return self._buckets.get(bucket_id)
    
    def get_tenant_bucket(self, tenant_id: str) -> Optional[QuotaBucket]:
        """根据租户ID获取限额桶"""
        bucket_id = self._tenant_buckets.get(tenant_id)
        if bucket_id:
            return self._buckets.get(bucket_id)
        return None
    
    def update_usage(self, tenant_id: str, quota_type: QuotaType, amount: int) -> bool:
        """更新使用量"""
        bucket = self.get_tenant_bucket(tenant_id)
        if not bucket:
            return False
        bucket.used[quota_type] = bucket.used.get(quota_type, 0) + amount
        bucket.last_updated = datetime.now()
        return True
    
    # ========== 事务管理 ==========
    
    def save_transaction(self, transaction: UpgradeTransaction) -> None:
        """保存升级事务"""
        self._transactions[transaction.transaction_id] = transaction
        
        if transaction.request_id:
            self._request_to_transaction[transaction.request_id] = transaction.transaction_id
        
        if transaction.tenant_id not in self._tenant_transactions:
            self._tenant_transactions[transaction.tenant_id] = []
        if transaction.transaction_id not in self._tenant_transactions[transaction.tenant_id]:
            self._tenant_transactions[transaction.tenant_id].append(transaction.transaction_id)
    
    def get_transaction(self, transaction_id: str) -> Optional[UpgradeTransaction]:
        """根据ID获取事务"""
        return self._transactions.get(transaction_id)
    
    def get_transaction_by_request(self, request_id: str) -> Optional[UpgradeTransaction]:
        """根据请求ID获取事务（用于幂等性）"""
        transaction_id = self._request_to_transaction.get(request_id)
        if transaction_id:
            return self._transactions.get(transaction_id)
        return None
    
    def get_tenant_transactions(self, tenant_id: str, limit: int = 100) -> List[UpgradeTransaction]:
        """获取租户的所有事务"""
        transaction_ids = self._tenant_transactions.get(tenant_id, [])
        transactions = []
        for tx_id in transaction_ids[-limit:]:
            tx = self._transactions.get(tx_id)
            if tx:
                transactions.append(tx)
        return sorted(transactions, key=lambda t: t.created_at, reverse=True)
    
    def update_transaction_status(self, transaction_id: str, status: TransactionStatus, 
                                   error_message: Optional[str] = None) -> bool:
        """更新事务状态"""
        tx = self.get_transaction(transaction_id)
        if not tx:
            return False
        tx.status = status
        if error_message:
            tx.error_message = error_message
        if status == TransactionStatus.COMPLETED:
            tx.completed_at = datetime.now()
        return True
