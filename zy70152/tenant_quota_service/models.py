"""
数据模型定义
包含套餐版本、限额桶、升级事务三个核心模型
"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from uuid import uuid4


class QuotaType(Enum):
    """限额类型"""
    REQUESTS = "requests"
    STORAGE = "storage"
    MEMBERS = "members"


class TransactionStatus(Enum):
    """升级事务状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class ChangeReason(Enum):
    """变更原因"""
    UPGRADE = "upgrade"
    DOWNGRADE = "downgrade"
    MANUAL_ADJUSTMENT = "manual_adjustment"
    DEMO_EXTENSION = "demo_extension"


@dataclass
class PlanVersion:
    """套餐版本模型
    定义不同套餐的基础限额配置
    """
    plan_id: str
    version: int
    name: str
    quotas: Dict[QuotaType, int]
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    description: Optional[str] = None
    
    def get_quota(self, quota_type: QuotaType) -> int:
        """获取指定类型的限额值"""
        return self.quotas.get(quota_type, 0)


@dataclass
class QuotaBucket:
    """限额桶模型
    租户当前使用的限额配置和使用情况
    """
    bucket_id: str = field(default_factory=lambda: str(uuid4()))
    tenant_id: str = ""
    plan_version: Optional[PlanVersion] = None
    quotas: Dict[QuotaType, int] = field(default_factory=dict)
    used: Dict[QuotaType, int] = field(default_factory=dict)
    buffer_quotas: Dict[QuotaType, int] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.now)
    is_active: bool = True
    manual_overrides: Dict[QuotaType, int] = field(default_factory=dict)
    
    def get_effective_quota(self, quota_type: QuotaType) -> int:
        """获取实际生效的限额（考虑人工覆盖）"""
        if quota_type in self.manual_overrides:
            return self.manual_overrides[quota_type]
        base = self.quotas.get(quota_type, 0)
        buffer = self.buffer_quotas.get(quota_type, 0)
        return base + buffer
    
    def get_usage(self, quota_type: QuotaType) -> int:
        """获取已使用量"""
        return self.used.get(quota_type, 0)
    
    def get_remaining(self, quota_type: QuotaType) -> int:
        """获取剩余额度"""
        return self.get_effective_quota(quota_type) - self.get_usage(quota_type)
    
    def is_overflow(self, quota_type: QuotaType) -> bool:
        """检查是否超限"""
        return self.get_remaining(quota_type) < 0


@dataclass
class QuotaChange:
    """限额变更明细
    记录每一项限额的具体变化
    """
    change_id: str = field(default_factory=lambda: str(uuid4()))
    transaction_id: str = ""
    quota_type: QuotaType = QuotaType.REQUESTS
    old_value: int = 0
    new_value: int = 0
    change_amount: int = 0
    reason: Optional[str] = None


@dataclass
class UpgradeTransaction:
    """升级事务模型
    记录整个套餐升级的完整过程
    """
    transaction_id: str = field(default_factory=lambda: str(uuid4()))
    tenant_id: str = ""
    old_plan_version: Optional[PlanVersion] = None
    new_plan_version: Optional[PlanVersion] = None
    status: TransactionStatus = TransactionStatus.PENDING
    reason: ChangeReason = ChangeReason.UPGRADE
    changes: Dict[str, QuotaChange] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    rollback_transaction_id: Optional[str] = None
    operator_id: Optional[str] = None
    request_id: Optional[str] = None
    notes: Optional[str] = None
    
    def add_change(self, change: QuotaChange) -> None:
        """添加限额变更明细"""
        change.transaction_id = self.transaction_id
        self.changes[change.change_id] = change
    
    def mark_completed(self) -> None:
        """标记事务完成"""
        self.status = TransactionStatus.COMPLETED
        self.completed_at = datetime.now()
    
    def mark_failed(self, error_message: str) -> None:
        """标记事务失败"""
        self.status = TransactionStatus.FAILED
        self.error_message = error_message


@dataclass
class TenantReport:
    """租户报表
    包含租户的限额使用情况和历史变更记录
    """
    tenant_id: str
    current_plan: Optional[PlanVersion] = None
    current_bucket: Optional[QuotaBucket] = None
    recent_transactions: list = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典格式用于导出"""
        return {
            "tenant_id": self.tenant_id,
            "current_plan": self.current_plan.name if self.current_plan else None,
            "plan_version": self.current_plan.version if self.current_plan else None,
            "quotas": {
                qt.value: {
                    "total": self.current_bucket.get_effective_quota(qt) if self.current_bucket else 0,
                    "used": self.current_bucket.get_usage(qt) if self.current_bucket else 0,
                    "remaining": self.current_bucket.get_remaining(qt) if self.current_bucket else 0,
                    "is_overflow": self.current_bucket.is_overflow(qt) if self.current_bucket else False
                }
                for qt in QuotaType
            },
            "recent_transactions": [
                {
                    "transaction_id": tx.transaction_id,
                    "status": tx.status.value,
                    "reason": tx.reason.value,
                    "created_at": tx.created_at.isoformat(),
                    "changes": [
                        {
                            "quota_type": c.quota_type.value,
                            "old_value": c.old_value,
                            "new_value": c.new_value,
                            "change_amount": c.change_amount
                        }
                        for c in tx.changes.values()
                    ]
                }
                for tx in self.recent_transactions
            ],
            "generated_at": self.generated_at.isoformat()
        }
