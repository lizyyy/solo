from enum import Enum


class DangerLevel(Enum):
    NONE = "无"
    LOW = "低危"
    MEDIUM = "中危"
    HIGH = "高危"
    EXTREME = "剧毒"


class ApplicationStatus(Enum):
    DRAFT = "草稿"
    PENDING = "待审批"
    APPROVING = "审批中"
    APPROVED = "已通过"
    REJECTED = "已驳回"
    CANCELLED = "已取消"
    COMPLETED = "已完成"


class ApprovalResult(Enum):
    PENDING = "待审批"
    APPROVED = "同意"
    REJECTED = "驳回"


class OperationType(Enum):
    APPLY = "申请"
    APPROVE = "审批"
    OUTBOUND = "出库"
    RETURN = "归还"
    INVENTORY = "盘点"
    ADJUST = "调整"


class ExceptionType(Enum):
    NONE = "无异常"
    INSUFFICIENT_STOCK = "库存不足"
    NEGATIVE_STOCK = "库存负数"
    DANGER_GOODS_UNAPPROVED = "危险品未审批"
    SINGLE_APPROVAL_FOR_DANGER = "危险品单人审批"
    DUPLICATE_SUBMISSION = "重复提交"
    INVALID_QUANTITY = "数量无效"
    REJECTED_RESUBMIT = "驳回重提"


class InventoryStatus(Enum):
    NORMAL = "正常"
    WARNING = "预警"
    OUT_OF_STOCK = "缺货"
    EXPIRED = "已过期"
