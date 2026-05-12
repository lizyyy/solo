from enum import Enum


class OrderStatus(Enum):
    PENDING = "待处理"
    PAID = "已支付"
    SHIPPED = "已发货"
    PARTIAL_RETURNED = "部分退货"
    RETURNED = "已退货"
    CANCELLED = "已取消"


class GiftStatus(Enum):
    PENDING = "待判断"
    ELIGIBLE = "符合条件"
    NOT_ELIGIBLE = "不符合条件"
    ALLOCATED = "已分配"
    SHIPPED = "已发货"
    PARTIAL_RETURNED = "部分退回"
    RETURNED = "已退回"
    DEDUCTED = "已扣费"
    REISSUE_PENDING = "待补发"
    REISSUED = "已补发"


class InventoryOperationType(Enum):
    ALLOCATE = "占用"
    RELEASE = "释放"
    DEDUCT = "扣减"
    REISSUE = "补发"
    MANUAL_ADJUST = "人工调整"


class ActionType(Enum):
    INIT = "初始化"
    IMPORT = "导入"
    CHECK = "规则校验"
    ALLOCATE = "赠品分配"
    SHIP = "发货"
    RETURN = "退货"
    REISSUE = "补发"
    MANUAL_FIX = "人工修正"
    REPORT = "生成报告"
