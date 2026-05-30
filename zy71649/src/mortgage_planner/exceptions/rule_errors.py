"""规则类异常 - 违反业务规则、违约金规则、提前还款限制等"""

from .base import MortgageException, ErrorCategory, ErrorSeverity, ErrorContext


class RuleViolationError(MortgageException):
    """规则违反错误"""
    category = ErrorCategory.RULE_ERROR
    severity = ErrorSeverity.ERROR
    default_message = "违反业务规则"

    def __init__(self, message: str, rule_name: str = None, **kwargs):
        context = kwargs.pop("context", None) or ErrorContext(
            source=rule_name,
            suggestions=[
                "请检查是否符合贷款合同约定",
                "如有疑问，请咨询银行客户经理",
                "可调整提前还款方案以符合规则",
            ],
        )
        super().__init__(message, context=context, **kwargs)


class InvalidPenaltyRuleError(RuleViolationError):
    """违约金规则无效"""
    severity = ErrorSeverity.ERROR
    default_message = "违约金规则无效"

    def __init__(self, message: str, **kwargs):
        context = kwargs.pop("context", None) or ErrorContext(
            suggestions=[
                "请检查违约金规则配置是否正确",
                "确认规则类型与参数匹配",
                "阶梯型规则必须包含至少一个阶梯",
            ],
        )
        super().__init__(message, rule_name="违约金规则", context=context, **kwargs)


class UnsupportedStrategyError(RuleViolationError):
    """不支持的提前还款策略"""
    severity = ErrorSeverity.ERROR
    default_message = "不支持的提前还款策略"

    def __init__(self, strategy: str, supported: list, **kwargs):
        message = f"不支持的提前还款策略: '{strategy}'，支持的策略: {', '.join(supported)}"
        context = kwargs.pop("context", None) or ErrorContext(
            value=strategy,
            expected=f"选择以下策略之一: {', '.join(supported)}",
            suggestions=[
                f"请选择支持的提前还款策略",
                "shorten_term: 缩短期限（月供不变）",
                "reduce_payment: 减少月供（期限不变）",
            ],
        )
        super().__init__(message, rule_name="提前还款策略", context=context, **kwargs)


class PrepayTooEarlyError(RuleViolationError):
    """提前还款太早"""
    severity = ErrorSeverity.WARNING
    default_message = "还款时间未满限制期"

    def __init__(self, paid_months: int, required_months: int, **kwargs):
        message = f"已还款 {paid_months} 个月，未满合同约定的 {required_months} 个月限制期"
        context = kwargs.pop("context", None) or ErrorContext(
            value=paid_months,
            expected=f">= {required_months} 个月",
            suggestions=[
                f"请等待还款满 {required_months} 个月后再提前还款",
                "可与银行协商是否可豁免此限制",
                f"还需等待 {required_months - paid_months} 个月",
            ],
        )
        super().__init__(message, rule_name="提前还款期限限制", context=context, **kwargs)


class PrepayAmountTooSmallError(RuleViolationError):
    """提前还款金额太小"""
    severity = ErrorSeverity.WARNING
    default_message = "提前还款金额低于最低限额"

    def __init__(self, amount, min_amount, **kwargs):
        message = f"提前还款金额 {amount} 元低于银行规定的最低限额 {min_amount} 元"
        context = kwargs.pop("context", None) or ErrorContext(
            value=amount,
            expected=f">= {min_amount} 元",
            suggestions=[
                f"请增加提前还款金额至 {min_amount} 元以上",
                "可累计资金后再进行提前还款操作",
            ],
        )
        super().__init__(message, rule_name="提前还款最低金额", context=context, **kwargs)


class InterestRateSwitchError(RuleViolationError):
    """利率切换错误"""
    severity = ErrorSeverity.ERROR
    default_message = "利率切换错误"

    def __init__(self, message: str, **kwargs):
        context = kwargs.pop("context", None) or ErrorContext(
            suggestions=[
                "请确认LPR利率与加点计算是否正确",
                "LPR定价贷款: 执行利率 = LPR + 加点",
                "检查合同利率是否与计算结果一致",
                "如为固定利率贷款，请关闭LPR定价开关",
            ],
        )
        super().__init__(message, rule_name="利率切换规则", context=context, **kwargs)


class CashflowNegativeError(RuleViolationError):
    """现金流为负"""
    severity = ErrorSeverity.CRITICAL
    default_message = "现金流出现负数"

    def __init__(self, month, amount, **kwargs):
        message = f"{month.strftime('%Y年%m月')} 现金流为负: {amount} 元"
        context = kwargs.pop("context", None) or ErrorContext(
            value=amount,
            expected=">= 0",
            suggestions=[
                "⚠️ 此方案将导致现金流缺口，建议调整",
                "降低提前还款金额",
                "选择'减少月供'方式降低每月支出",
                "延后提前还款时间，先积累预备金",
            ],
        )
        super().__init__(message, rule_name="现金流约束", context=context, **kwargs)


class PenaltyExceedsSavingError(RuleViolationError):
    """违约金超过节省利息"""
    severity = ErrorSeverity.WARNING
    default_message = "违约金超过节省利息"

    def __init__(self, penalty, saving, **kwargs):
        message = f"违约金 {penalty} 元 > 节省利息 {saving} 元，经济上不划算"
        context = kwargs.pop("context", None) or ErrorContext(
            suggestions=[
                "建议延后提前还款时间",
                "待还款期数增加后违约金会降低",
                "如利率有下行预期可考虑转换LPR",
            ],
        )
        super().__init__(message, rule_name="提前还款经济性", context=context, **kwargs)
