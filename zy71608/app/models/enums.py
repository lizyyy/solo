import enum


class ContractStatus(str, enum.Enum):
    DRAFT = "草稿"
    ACTIVE = "生效中"
    EXPIRED = "已到期"
    TERMINATED = "已终止"
    SUPERSEDED = "已被替代"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    PROCESSING = "处理中"
    TRIAL_CALCULATED = "已试算"
    ANOMALY_DETECTED = "异常待处理"
    REVIEWING = "复核中"
    APPROVED = "已通过"
    REJECTED = "已驳回"
    SUPPLEMENTARY_SIGNED = "补充协议已签署"
    COMPLETED = "已完成"


class AnomalyType(str, enum.Enum):
    DAYS_EXCEEDED = "减免天数超限"
    CONTRACT_VERSION_ERROR = "合同版本错误"
    DUPLICATE_APPLICATION = "重复申请"
    DATA_INCONSISTENCY = "数据不一致"
    MISSING_DOCUMENT = "材料缺失"
    CALCULATION_ERROR = "计算异常"
    INVALID_DATA = "无效数据"


class AnomalySeverity(str, enum.Enum):
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "严重"


class AnomalyStatus(str, enum.Enum):
    OPEN = "待处理"
    ACKNOWLEDGED = "已确认"
    RESOLVED = "已解决"
    IGNORED = "已忽略"


class DocumentType(str, enum.Enum):
    LEASE_CONTRACT = "租赁合同"
    RENT_PLAN = "租金计划"
    STORE_CLOSURE_PROOF = "闭店证明"
    REDUCTION_APPLICATION = "减免申请"
    SUPPLEMENTARY_AGREEMENT = "补充协议"
    APPROVAL_REPORT = "审批报告"
    OTHER = "其他"


class ApprovalAction(str, enum.Enum):
    SUBMIT = "提交"
    PROCESS = "处理"
    TRIAL_CALCULATE = "试算"
    REVIEW = "复核"
    APPROVE = "通过"
    REJECT = "驳回"
    REVISE = "修改"
    SIGN_SUPPLEMENTARY = "签署补充协议"
    COMPLETE = "完成"


class OperationType(str, enum.Enum):
    CREATE = "创建"
    UPDATE = "更新"
    DELETE = "删除"
    SUBMIT = "提交"
    APPROVE = "审批"
    REJECT = "驳回"
    IMPORT = "导入"
    EXPORT = "导出"
    CALCULATE = "计算"
    MANUAL_OVERRIDE = "人工修改"
    ANOMALY_MARK = "异常标记"
    ANOMALY_RESOLVE = "异常解决"
