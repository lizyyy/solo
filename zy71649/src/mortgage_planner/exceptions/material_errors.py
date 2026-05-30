"""材料类异常 - 必要材料未提供、数据不完整、等待客户确认等"""

from .base import MortgageException, ErrorCategory, ErrorSeverity, ErrorContext


class MaterialMissingError(MortgageException):
    """材料缺失错误"""
    category = ErrorCategory.MATERIAL_ERROR
    severity = ErrorSeverity.WARNING
    default_message = "必要材料缺失"

    def __init__(self, material_name: str = None, purpose: str = None, message: str = None, **kwargs):
        if message is None:
            purpose_desc = f"（用于{purpose}）" if purpose else ""
            message = f"缺少必要材料: '{material_name}'{purpose_desc}"
        context = kwargs.pop("context", None) or ErrorContext(
            source=material_name,
            suggestions=[
                f"请向客户索要 '{material_name}'",
                f"收到材料后使用 import 命令重新导入",
                "可使用 status 命令查看当前缺失材料清单",
            ],
        )
        super().__init__(message=message, context=context, **kwargs)


class IncompleteDataError(MaterialMissingError):
    """数据不完整"""
    severity = ErrorSeverity.WARNING
    default_message = "数据不完整"

    def __init__(self, entity: str, missing_fields: list, **kwargs):
        fields_desc = "、".join([f"'{f}'" for f in missing_fields])
        message = f"{entity}数据不完整，缺少字段: {fields_desc}"
        context = kwargs.pop("context", None) or ErrorContext(
            field=", ".join(missing_fields),
            suggestions=[
                f"请补充{entity}的 {fields_desc} 字段",
                "检查导入文件是否完整",
                "部分功能可能因数据不全而受限",
            ],
        )
        super().__init__(material_name=f"{entity}完整数据", context=context, message=message, **kwargs)


class PendingConfirmationError(MaterialMissingError):
    """等待确认"""
    severity = ErrorSeverity.INFO
    default_message = "等待客户确认"

    def __init__(self, entity: str, detail: str = None, **kwargs):
        detail_desc = f": {detail}" if detail else ""
        message = f"{entity}等待客户确认{detail_desc}"
        context = kwargs.pop("context", None) or ErrorContext(
            suggestions=[
                f"请联系客户确认{entity}",
                "确认后使用 confirm 命令标记为已确认",
                "未确认的数据不影响计算，但报告中会标注",
            ],
        )
        context.field = entity
        super().__init__(material_name=f"{entity}确认函", context=context, message=message, **kwargs)


class LoanContractMissingError(MaterialMissingError):
    """贷款合同缺失"""
    def __init__(self, contract_no: str = None, **kwargs):
        if contract_no:
            message = f"未找到合同号为 '{contract_no}' 的贷款合同"
        else:
            message = "缺少贷款合同数据"
        super().__init__(
            material_name="贷款合同",
            purpose="进行还款计算和提前还款分析",
            contract_no=contract_no,
            **kwargs,
        )


class RepaymentRecordsMissingError(MaterialMissingError):
    """还款流水缺失"""
    def __init__(self, contract_no: str, **kwargs):
        super().__init__(
            material_name="还款流水",
            purpose=f"计算合同 {contract_no} 的已还款情况和剩余本金",
            contract_no=contract_no,
            suggestions=[
                f"请导入合同 {contract_no} 的还款流水",
                "如无完整流水，系统将基于合同自动推算",
                "自动推算结果可能与实际有细微差异",
            ],
            **kwargs,
        )


class BudgetMissingError(MaterialMissingError):
    """预算数据缺失"""
    def __init__(self, customer_id: str, **kwargs):
        super().__init__(
            material_name="家庭收入预算",
            purpose="进行现金流压力测试",
            customer_id=customer_id,
            suggestions=[
                "请导入客户的家庭收入预算数据",
                "现金流分析将基于预算数据进行",
                "缺少预算数据时将跳过现金流压力测试",
            ],
            **kwargs,
        )


class PenaltyRuleMissingError(MaterialMissingError):
    """违约金规则缺失"""
    def __init__(self, contract_no: str, **kwargs):
        super().__init__(
            material_name="违约金规则",
            purpose=f"计算合同 {contract_no} 的提前还款违约金",
            contract_no=contract_no,
            suggestions=[
                f"请导入合同 {contract_no} 的违约金规则",
                "可查阅贷款合同中的'提前还款'条款",
                "未配置时将默认按无违约金计算",
            ],
            **kwargs,
        )


class ClientGoalMissingError(MaterialMissingError):
    """客户目标缺失"""
    def __init__(self, customer_id: str, **kwargs):
        super().__init__(
            material_name="客户目标",
            purpose="为客户定制最优提前还款方案",
            customer_id=customer_id,
            suggestions=[
                "请导入客户的提前还款目标",
                "至少指定：提前还款金额、目标结清日期或目标月供",
                "系统将基于目标生成最优方案",
            ],
            **kwargs,
        )
