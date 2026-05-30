"""核心计算引擎 - 等额本息、提前还款计算"""

from datetime import date, datetime, timedelta
from typing import Optional, List
from decimal import Decimal, ROUND_HALF_UP

from pydantic import BaseModel, Field

from ..models.loan import LoanContract, RepaymentMethod
from ..models.repayment import RepaymentRecord, RepaymentStatus
from ..models.goal import PrepayStrategy


D = Decimal
ROUND = lambda x: D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)
ROUND4 = lambda x: D(x).quantize(D("0.0001"), rounding=ROUND_HALF_UP)


class RepaymentScheduleItem(BaseModel):
    """还款计划条目"""
    period_no: int
    payment_date: date
    total_payment: Decimal = Field()
    principal_payment: Decimal = Field()
    interest_payment: Decimal = Field()
    remaining_principal: Decimal = Field()
    is_prepayment: bool = False
    prepayment_amount: Optional[Decimal] = Field(default=None,)
    penalty_amount: Decimal = Field(default=Decimal("0"),)
    note: Optional[str] = None


class RepaymentSummary(BaseModel):
    """还款汇总"""
    original_loan_amount: Decimal = Field()
    original_term_months: int
    original_interest_rate: Decimal = Field()
    original_monthly_payment: Decimal = Field()
    total_interest_original: Decimal = Field()
    total_payment_original: Decimal = Field()
    remaining_months: int
    remaining_principal: Decimal = Field()
    total_paid_principal: Decimal = Field()
    total_paid_interest: Decimal = Field()


class PrepayResult(BaseModel):
    """提前还款结果"""
    strategy: PrepayStrategy
    prepay_amount: Decimal = Field()
    penalty_amount: Decimal = Field()
    total_cost: Decimal = Field()
    new_monthly_payment: Optional[Decimal] = Field(default=None,)
    new_term_months: Optional[int] = None
    interest_saved: Decimal = Field()
    months_saved: int = 0
    new_maturity_date: Optional[date] = None
    cashflow_impact: Decimal = Field()
    schedule: List[RepaymentScheduleItem] = Field(default_factory=list)


def calculate_monthly_payment(
    principal: Decimal,
    annual_rate: Decimal,
    term_months: int,
) -> Decimal:
    """
    计算等额本息月供
    M = P * r * (1+r)^n / ((1+r)^n - 1)
    """
    if term_months <= 0:
        raise ValueError("贷款期限必须大于0")
    if principal <= 0:
        raise ValueError("贷款本金必须大于0")

    monthly_rate = annual_rate / D("12")
    if monthly_rate == 0:
        return ROUND(principal / term_months)

    n = term_months
    compound = (D("1") + monthly_rate) ** n
    numerator = principal * monthly_rate * compound
    denominator = compound - D("1")

    return ROUND(numerator / denominator)


def calculate_remaining_principal(
    principal: Decimal,
    annual_rate: Decimal,
    term_months: int,
    paid_months: int,
    monthly_payment: Optional[Decimal] = None,
) -> Decimal:
    """
    计算剩余本金
    B = P * (1+r)^n - M * ((1+r)^n - 1) / r
    """
    if paid_months <= 0:
        return ROUND(principal)
    if paid_months >= term_months:
        return D("0")

    monthly_rate = annual_rate / D("12")
    if monthly_payment is None:
        monthly_payment = calculate_monthly_payment(principal, annual_rate, term_months)

    if monthly_rate == 0:
        return ROUND(principal - monthly_payment * paid_months)

    n = paid_months
    compound = (D("1") + monthly_rate) ** n
    remaining = principal * compound - monthly_payment * (compound - D("1")) / monthly_rate

    return ROUND(max(D("0"), remaining))


def calculate_interest_saved(
    original_result: RepaymentSummary,
    prepay_result: PrepayResult,
) -> Decimal:
    """计算提前还款节省的利息"""
    return ROUND(prepay_result.interest_saved)


def generate_repayment_schedule(
    loan: LoanContract,
    start_period: int = 1,
    end_period: Optional[int] = None,
    existing_records: Optional[List[RepaymentRecord]] = None,
) -> List[RepaymentScheduleItem]:
    """生成还款计划"""
    if end_period is None:
        end_period = loan.loan_term_months

    monthly_payment = calculate_monthly_payment(
        loan.loan_amount,
        loan.annual_interest_rate,
        loan.loan_term_months,
    )

    remaining = loan.loan_amount
    monthly_rate = loan.monthly_rate
    schedule: List[RepaymentScheduleItem] = []
    current_date = loan.first_payment_date

    for period in range(1, end_period + 1):
        if period < start_period:
            interest = ROUND(remaining * monthly_rate)
            principal_paid = ROUND(monthly_payment - interest)
            remaining = ROUND(remaining - principal_paid)
            current_date = _add_one_month(current_date)
            continue

        if existing_records and period <= len(existing_records):
            record = existing_records[period - 1]
            remaining = record.remaining_principal
            current_date = _add_one_month(current_date)
            continue

        interest = ROUND(remaining * monthly_rate)
        principal_paid = ROUND(monthly_payment - interest)
        remaining = ROUND(remaining - principal_paid)

        if remaining < 0:
            principal_paid = ROUND(principal_paid + remaining)
            remaining = D("0")

        schedule.append(RepaymentScheduleItem(
            period_no=period,
            payment_date=current_date,
            total_payment=ROUND(principal_paid + interest),
            principal_payment=principal_paid,
            interest_payment=interest,
            remaining_principal=remaining,
        ))

        current_date = _add_one_month(current_date)

        if remaining <= 0:
            break

    return schedule


def simulate_prepayment(
    loan: LoanContract,
    prepay_amount: Decimal,
    strategy: PrepayStrategy,
    paid_months: int,
    penalty_amount: Decimal = D("0"),
    existing_records: Optional[List[RepaymentRecord]] = None,
) -> PrepayResult:
    """
    模拟提前还款
    """
    if prepay_amount <= 0:
        raise ValueError("提前还款金额必须大于0")

    monthly_rate = loan.monthly_rate
    original_monthly_payment = calculate_monthly_payment(
        loan.loan_amount,
        loan.annual_interest_rate,
        loan.loan_term_months,
    )

    remaining_principal = calculate_remaining_principal(
        loan.loan_amount,
        loan.annual_interest_rate,
        loan.loan_term_months,
        paid_months,
        original_monthly_payment,
    )

    if prepay_amount > remaining_principal:
        prepay_amount = remaining_principal

    new_remaining = ROUND(remaining_principal - prepay_amount)
    total_cost = ROUND(prepay_amount + penalty_amount)

    original_remaining_months = loan.loan_term_months - paid_months
    original_interest_remaining = _calculate_total_interest(
        remaining_principal, monthly_rate, original_remaining_months, original_monthly_payment
    )

    new_monthly_payment = None
    new_term_months = None
    new_interest_remaining = D("0")
    cashflow_impact = D("0")
    schedule: List[RepaymentScheduleItem] = []

    if new_remaining <= 0:
        interest_saved = original_interest_remaining
        months_saved = original_remaining_months
        new_term_months = paid_months
    elif strategy == PrepayStrategy.SHORTEN_TERM:
        new_monthly_payment = original_monthly_payment
        new_term_months = _calculate_required_months(
            new_remaining, monthly_rate, original_monthly_payment
        )
        new_interest_remaining = _calculate_total_interest(
            new_remaining, monthly_rate, new_term_months, original_monthly_payment
        )
        interest_saved = ROUND(original_interest_remaining - new_interest_remaining - penalty_amount)
        months_saved = original_remaining_months - new_term_months
        cashflow_impact = D("0")
        schedule = _generate_prepay_schedule(
            loan, paid_months, new_remaining, monthly_rate, original_monthly_payment, new_term_months
        )
    elif strategy == PrepayStrategy.REDUCE_PAYMENT:
        new_term_months = original_remaining_months
        new_monthly_payment = calculate_monthly_payment(
            new_remaining, loan.annual_interest_rate, new_term_months
        )
        new_interest_remaining = _calculate_total_interest(
            new_remaining, monthly_rate, new_term_months, new_monthly_payment
        )
        interest_saved = ROUND(original_interest_remaining - new_interest_remaining - penalty_amount)
        months_saved = 0
        cashflow_impact = ROUND(original_monthly_payment - new_monthly_payment)
        schedule = _generate_prepay_schedule(
            loan, paid_months, new_remaining, monthly_rate, new_monthly_payment, new_term_months
        )
    else:
        raise ValueError(f"暂不支持的提前还款策略: {strategy}")

    first_payment_date = loan.first_payment_date
    new_maturity_date = None
    if new_term_months is not None:
        new_maturity_date = _add_n_months(first_payment_date, new_term_months + paid_months - 1)

    return PrepayResult(
        strategy=strategy,
        prepay_amount=ROUND(prepay_amount),
        penalty_amount=ROUND(penalty_amount),
        total_cost=total_cost,
        new_monthly_payment=ROUND(new_monthly_payment) if new_monthly_payment else None,
        new_term_months=new_term_months,
        interest_saved=ROUND(max(D("0"), interest_saved)),
        months_saved=months_saved,
        new_maturity_date=new_maturity_date,
        cashflow_impact=cashflow_impact,
        schedule=schedule,
    )


def get_repayment_summary(
    loan: LoanContract,
    paid_months: int,
    existing_records: Optional[List[RepaymentRecord]] = None,
) -> RepaymentSummary:
    """获取还款汇总信息"""
    original_monthly_payment = calculate_monthly_payment(
        loan.loan_amount,
        loan.annual_interest_rate,
        loan.loan_term_months,
    )

    total_payment_original = ROUND(original_monthly_payment * loan.loan_term_months)
    total_interest_original = ROUND(total_payment_original - loan.loan_amount)

    remaining_principal = calculate_remaining_principal(
        loan.loan_amount,
        loan.annual_interest_rate,
        loan.loan_term_months,
        paid_months,
        original_monthly_payment,
    )

    total_paid_principal = D("0")
    total_paid_interest = D("0")

    if existing_records:
        for record in existing_records[:paid_months]:
            total_paid_principal += record.principal_amount
            total_paid_interest += record.interest_amount
    else:
        monthly_rate = loan.monthly_rate
        remaining = loan.loan_amount
        for _ in range(paid_months):
            interest = ROUND(remaining * monthly_rate)
            principal = ROUND(original_monthly_payment - interest)
            total_paid_interest += interest
            total_paid_principal += principal
            remaining = ROUND(remaining - principal)

    remaining_months = max(0, loan.loan_term_months - paid_months)

    return RepaymentSummary(
        original_loan_amount=loan.loan_amount,
        original_term_months=loan.loan_term_months,
        original_interest_rate=loan.annual_interest_rate,
        original_monthly_payment=original_monthly_payment,
        total_interest_original=total_interest_original,
        total_payment_original=total_payment_original,
        remaining_months=remaining_months,
        remaining_principal=remaining_principal,
        total_paid_principal=ROUND(total_paid_principal),
        total_paid_interest=ROUND(total_paid_interest),
    )


def _add_one_month(d: date) -> date:
    """日期加一个月"""
    if d.month == 12:
        return d.replace(year=d.year + 1, month=1)
    try:
        return d.replace(month=d.month + 1)
    except ValueError:
        next_month = d.replace(month=d.month + 2, day=1) - timedelta(days=1)
        return next_month


def _add_n_months(d: date, n: int) -> date:
    """日期加n个月"""
    result = d
    for _ in range(n):
        result = _add_one_month(result)
    return result


def _calculate_total_interest(
    principal: Decimal,
    monthly_rate: Decimal,
    term_months: int,
    monthly_payment: Decimal,
) -> Decimal:
    """计算总利息"""
    if term_months <= 0:
        return D("0")
    total_payment = monthly_payment * term_months
    return ROUND(total_payment - principal)


def _calculate_required_months(
    principal: Decimal,
    monthly_rate: Decimal,
    monthly_payment: Decimal,
) -> int:
    """计算需要的期数"""
    if monthly_rate == 0:
        return int((principal / monthly_payment).to_integral_value(rounding="ceil"))

    n = 0
    remaining = principal
    while remaining > 0 and n < 360:
        interest = ROUND(remaining * monthly_rate)
        principal_paid = ROUND(monthly_payment - interest)
        remaining = ROUND(remaining - principal_paid)
        n += 1
        if principal_paid <= 0:
            raise ValueError("月供不足以覆盖利息，无法结清贷款")

    return n


def _generate_prepay_schedule(
    loan: LoanContract,
    paid_months: int,
    new_remaining: Decimal,
    monthly_rate: Decimal,
    monthly_payment: Decimal,
    new_term_months: int,
) -> List[RepaymentScheduleItem]:
    """生成提前还款后的还款计划"""
    schedule: List[RepaymentScheduleItem] = []
    remaining = new_remaining
    current_date = _add_n_months(loan.first_payment_date, paid_months)

    for i in range(new_term_months):
        period_no = paid_months + i + 1
        interest = ROUND(remaining * monthly_rate)
        principal_paid = ROUND(monthly_payment - interest)
        remaining = ROUND(remaining - principal_paid)

        if remaining < 0:
            principal_paid = ROUND(principal_paid + remaining)
            remaining = D("0")

        schedule.append(RepaymentScheduleItem(
            period_no=period_no,
            payment_date=current_date,
            total_payment=ROUND(principal_paid + interest),
            principal_payment=principal_paid,
            interest_payment=interest,
            remaining_principal=remaining,
        ))

        current_date = _add_one_month(current_date)
        if remaining <= 0:
            break

    return schedule
