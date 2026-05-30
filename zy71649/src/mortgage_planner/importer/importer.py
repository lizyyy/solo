"""数据导入模块"""

import json
import csv
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Optional, List, Type, Dict, Any, Tuple
from io import StringIO

import yaml
import pandas as pd
from pydantic import ValidationError

from .base import ImportResult, ImportAction
from ..models.base import ConflictResolution, BaseModel
from ..models.loan import LoanContract, RepaymentMethod
from ..models.repayment import RepaymentRecord, RepaymentStatus
from ..models.budget import Budget, IncomeExpense
from ..models.penalty import PenaltyRule, PenaltyType, PenaltyTier
from ..models.goal import ClientGoal, PrepayStrategy, Priority
from ..storage.store import DataStore
from ..exceptions.base import MortgageException, ErrorContext, ErrorCategory
from ..exceptions.data_errors import (
    MissingFieldError,
    InvalidValueError,
    InvalidDateFormatError,
    InvalidAmountError,
    InvalidRateError,
)
from ..exceptions.rule_errors import InterestRateSwitchError


SUPPORTED_FORMATS = {
    ".csv": "csv",
    ".xlsx": "excel",
    ".xls": "excel",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
}


class ImportConflict:
    """导入冲突"""
    def __init__(
        self,
        existing_record: Any,
        new_record: Any,
        business_key: Dict[str, Any],
        diff_fields: List[str],
    ):
        self.existing_record = existing_record
        self.new_record = new_record
        self.business_key = business_key
        self.diff_fields = diff_fields


class DataImporter:
    """数据导入器"""
    def __init__(self, store: DataStore):
        self.store = store

    def _detect_format(self, filename: str) -> str:
        """检测文件格式"""
        ext = Path(filename).suffix.lower()
        if ext not in SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {ext}，支持格式: {', '.join(SUPPORTED_FORMATS.keys())}")
        return SUPPORTED_FORMATS[ext]

    def _read_file(self, filename: str, format_type: str) -> List[Dict[str, Any]]:
        """读取文件"""
        if format_type == "json":
            return self._read_json(filename)
        elif format_type == "yaml":
            return self._read_yaml(filename)
        elif format_type == "csv":
            return self._read_csv(filename)
        elif format_type == "excel":
            return self._read_excel(filename)
        else:
            raise ValueError(f"未知格式: {format_type}")

    def _read_json(self, filename: str) -> List[Dict[str, Any]]:
        """读取JSON文件"""
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            data = [data]
        return data

    def _read_yaml(self, filename: str) -> List[Dict[str, Any]]:
        """读取YAML文件"""
        with open(filename, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if isinstance(data, dict):
            data = [data]
        return data

    def _read_csv(self, filename: str) -> List[Dict[str, Any]]:
        """读取CSV文件"""
        with open(filename, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return list(reader)

    def _read_excel(self, filename: str) -> List[Dict[str, Any]]:
        """读取Excel文件"""
        df = pd.read_excel(filename)
        return df.where(pd.notnull(df), None).to_dict("records")

    def _parse_date(self, value: Any, field_name: str, entity: str) -> Optional[date]:
        """解析日期"""
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        try:
            if isinstance(value, (int, float)):
                return date.fromtimestamp(value)
            date_str = str(value).strip()
            for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y年%m月%d日"]:
                try:
                    return datetime.strptime(date_str, fmt).date()
                except ValueError:
                    continue
            raise InvalidDateFormatError(field_name=field_name, value=value, entity=entity)
        except InvalidDateFormatError:
            raise
        except Exception as e:
            raise InvalidDateFormatError(field_name=field_name, value=value, entity=entity) from e

    def _parse_decimal(self, value: Any, field_name: str, entity: str, allow_zero: bool = True) -> Decimal:
        """解析金额"""
        if value is None or value == "":
            raise MissingFieldError(field_name=field_name, entity=entity)
        try:
            if isinstance(value, Decimal):
                d = value
            else:
                s = str(value).replace(",", "").replace("，", "").strip()
                d = Decimal(s)
            if not allow_zero and d == 0:
                raise InvalidAmountError(field_name=field_name, value=value, entity=entity)
            if d < 0:
                raise InvalidAmountError(field_name=field_name, value=value, entity=entity)
            return d
        except (InvalidAmountError, MissingFieldError):
            raise
        except Exception as e:
            raise InvalidAmountError(field_name=field_name, value=value, entity=entity) from e

    def _parse_rate(self, value: Any, field_name: str, entity: str) -> Decimal:
        """解析利率"""
        d = self._parse_decimal(value, field_name, entity)
        if d > Decimal("1"):
            raise InvalidRateError(field_name=field_name, value=value, entity=entity)
        return d

    def _parse_int(self, value: Any, field_name: str, entity: str, min_val: int = 0) -> int:
        """解析整数"""
        if value is None or value == "":
            raise MissingFieldError(field_name=field_name, entity=entity)
        try:
            i = int(value)
            if i < min_val:
                raise InvalidValueError(
                    field_name=field_name,
                    value=value,
                    expected=f"大于等于 {min_val} 的整数",
                    entity=entity,
                )
            return i
        except (MissingFieldError, InvalidValueError):
            raise
        except Exception as e:
            raise InvalidValueError(
                field_name=field_name,
                value=value,
                expected="有效的整数",
                entity=entity,
            ) from e

    def _parse_enum(self, value: Any, field_name: str, enum_class: Type, entity: str) -> Any:
        """解析枚举值"""
        if value is None or value == "":
            raise MissingFieldError(field_name=field_name, entity=entity)
        try:
            if isinstance(value, enum_class):
                return value
            s = str(value).strip().lower().replace(" ", "_")
            for member in enum_class:
                if member.value.lower() == s or member.name.lower() == s:
                    return member
            raise InvalidValueError(
                field_name=field_name,
                value=value,
                expected=f"有效值: {', '.join([m.value for m in enum_class])}",
                entity=entity,
            )
        except (MissingFieldError, InvalidValueError):
            raise
        except Exception as e:
            raise InvalidValueError(
                field_name=field_name,
                value=value,
                expected=f"有效值: {', '.join([m.value for m in enum_class])}",
                entity=entity,
            ) from e

    def _validate_loan_contract(self, raw: Dict[str, Any]) -> LoanContract:
        """验证并转换贷款合同"""
        entity = "贷款合同"

        contract_no = raw.get("contract_no") or raw.get("合同号")
        if not contract_no:
            raise MissingFieldError(field_name="contract_no", entity=entity)

        loan = LoanContract(
            contract_no=str(contract_no).strip(),
            customer_name=str(raw.get("customer_name") or raw.get("客户姓名", "")).strip(),
            customer_id=str(raw.get("customer_id") or raw.get("客户ID", "")).strip(),
            loan_amount=self._parse_decimal(raw.get("loan_amount") or raw.get("贷款金额"), "loan_amount", entity, allow_zero=False),
            loan_term_months=self._parse_int(raw.get("loan_term_months") or raw.get("贷款期限(月)"), "loan_term_months", entity, min_val=1),
            annual_interest_rate=self._parse_rate(raw.get("annual_interest_rate") or raw.get("年利率"), "annual_interest_rate", entity),
            repayment_method=self._parse_enum(
                raw.get("repayment_method") or raw.get("还款方式", "equal_principal_interest"),
                "repayment_method",
                RepaymentMethod,
                entity,
            ),
            start_date=self._parse_date(raw.get("start_date") or raw.get("贷款起始日"), "start_date", entity),
            first_payment_date=self._parse_date(raw.get("first_payment_date") or raw.get("首次还款日"), "first_payment_date", entity),
            maturity_date=self._parse_date(raw.get("maturity_date") or raw.get("到期日"), "maturity_date", entity),
            lpr_based=bool(raw.get("lpr_based") or raw.get("是否LPR定价", False)),
            lpr_adjustment_period_months=raw.get("lpr_adjustment_period_months") and self._parse_int(
                raw.get("lpr_adjustment_period_months") or raw.get("LPR调整周期(月)", 0),
                "lpr_adjustment_period_months",
                entity,
            ),
            current_lpr_rate=raw.get("current_lpr_rate") and self._parse_rate(
                raw.get("current_lpr_rate") or raw.get("当前LPR利率", 0),
                "current_lpr_rate",
                entity,
            ),
            lpr_margin=raw.get("lpr_margin") and self._parse_decimal(
                raw.get("lpr_margin") or raw.get("LPR加点", 0),
                "lpr_margin",
                entity,
            ),
            loan_purpose=raw.get("loan_purpose") or raw.get("贷款用途"),
            property_address=raw.get("property_address") or raw.get("房产地址"),
            bank_name=raw.get("bank_name") or raw.get("贷款银行"),
            account_no=raw.get("account_no") or raw.get("还款账号"),
            notes=raw.get("notes") or raw.get("备注"),
        )

        if loan.lpr_based:
            if loan.current_lpr_rate is None or loan.lpr_margin is None:
                raise InterestRateSwitchError(
                    message="LPR定价贷款必须指定当前LPR利率和加点",
                    context=ErrorContext(
                        field="lpr_based",
                        value=True,
                        expected="current_lpr_rate 和 lpr_margin 不能为空",
                    ),
                )
            calculated_rate = loan.current_lpr_rate + loan.lpr_margin
            if abs(calculated_rate - loan.annual_interest_rate) > Decimal("0.0001"):
                raise InterestRateSwitchError(
                    message=f"LPR计算利率与合同利率不匹配: {calculated_rate} != {loan.annual_interest_rate}",
                    context=ErrorContext(
                        field="annual_interest_rate",
                        value=loan.annual_interest_rate,
                        expected=f"LPR({loan.current_lpr_rate}) + 加点({loan.lpr_margin}) = {calculated_rate}",
                    ),
                )

        return loan

    def _validate_repayment_record(self, raw: Dict[str, Any]) -> RepaymentRecord:
        """验证并转换还款记录"""
        entity = "还款流水"

        contract_no = raw.get("contract_no") or raw.get("合同号")
        if not contract_no:
            raise MissingFieldError(field_name="contract_no", entity=entity)

        return RepaymentRecord(
            contract_no=str(contract_no).strip(),
            repayment_date=self._parse_date(raw.get("repayment_date") or raw.get("还款日期"), "repayment_date", entity),
            period_no=self._parse_int(raw.get("period_no") or raw.get("期数"), "period_no", entity, min_val=1),
            total_amount=self._parse_decimal(raw.get("total_amount") or raw.get("还款总额"), "total_amount", entity),
            principal_amount=self._parse_decimal(raw.get("principal_amount") or raw.get("本金"), "principal_amount", entity),
            interest_amount=self._parse_decimal(raw.get("interest_amount") or raw.get("利息"), "interest_amount", entity),
            penalty_amount=self._parse_decimal(raw.get("penalty_amount") or raw.get("违约金", 0), "penalty_amount", entity),
            overdue_amount=self._parse_decimal(raw.get("overdue_amount") or raw.get("逾期罚息", 0), "overdue_amount", entity),
            remaining_principal=self._parse_decimal(raw.get("remaining_principal") or raw.get("剩余本金"), "remaining_principal", entity),
            status=self._parse_enum(
                raw.get("status") or raw.get("还款状态", "normal"),
                "status",
                RepaymentStatus,
                entity,
            ),
            is_prepayment=bool(raw.get("is_prepayment") or raw.get("是否提前还款", False)),
            prepayment_type=raw.get("prepayment_type") or raw.get("提前还款类型"),
            payment_method=raw.get("payment_method") or raw.get("支付方式"),
            transaction_no=raw.get("transaction_no") or raw.get("交易流水号"),
            bank_remark=raw.get("bank_remark") or raw.get("银行备注"),
            notes=raw.get("notes") or raw.get("备注"),
        )

    def _validate_budget(self, raw: Dict[str, Any]) -> Budget:
        """验证并转换预算"""
        entity = "家庭预算"

        customer_id = raw.get("customer_id") or raw.get("客户ID")
        if not customer_id:
            raise MissingFieldError(field_name="customer_id", entity=entity)

        income_details = []
        if "income_details" in raw and isinstance(raw["income_details"], list):
            for item in raw["income_details"]:
                income_details.append(IncomeExpense(
                    item_type=item.get("item_type", "income"),
                    category=item.get("category", ""),
                    amount=self._parse_decimal(item.get("amount", 0), "amount", entity),
                    is_monthly=item.get("is_monthly", True),
                    start_date=self._parse_date(item.get("start_date"), "start_date", entity) if item.get("start_date") else None,
                    end_date=self._parse_date(item.get("end_date"), "end_date", entity) if item.get("end_date") else None,
                    description=item.get("description"),
                ))

        expense_details = []
        if "expense_details" in raw and isinstance(raw["expense_details"], list):
            for item in raw["expense_details"]:
                expense_details.append(IncomeExpense(
                    item_type=item.get("item_type", "expense"),
                    category=item.get("category", ""),
                    amount=self._parse_decimal(item.get("amount", 0), "amount", entity),
                    is_monthly=item.get("is_monthly", True),
                    start_date=self._parse_date(item.get("start_date"), "start_date", entity) if item.get("start_date") else None,
                    end_date=self._parse_date(item.get("end_date"), "end_date", entity) if item.get("end_date") else None,
                    description=item.get("description"),
                ))

        return Budget(
            customer_id=str(customer_id).strip(),
            budget_month=self._parse_date(raw.get("budget_month") or raw.get("预算月份"), "budget_month", entity),
            monthly_household_income=self._parse_decimal(raw.get("monthly_household_income") or raw.get("月收入"), "monthly_household_income", entity),
            monthly_household_expense=self._parse_decimal(raw.get("monthly_household_expense") or raw.get("月支出"), "monthly_household_expense", entity),
            monthly_mortgage_payment=self._parse_decimal(raw.get("monthly_mortgage_payment") or raw.get("月供"), "monthly_mortgage_payment", entity),
            monthly_surplus=self._parse_decimal(raw.get("monthly_surplus") or raw.get("月结余", 0), "monthly_surplus", entity),
            total_assets=raw.get("total_assets") and self._parse_decimal(raw.get("total_assets") or raw.get("总资产", 0), "total_assets", entity),
            total_liabilities=raw.get("total_liabilities") and self._parse_decimal(raw.get("total_liabilities") or raw.get("总负债", 0), "total_liabilities", entity),
            emergency_fund=raw.get("emergency_fund") and self._parse_decimal(raw.get("emergency_fund") or raw.get("紧急预备金", 0), "emergency_fund", entity),
            available_cash=raw.get("available_cash") and self._parse_decimal(raw.get("available_cash") or raw.get("可用现金", 0), "available_cash", entity),
            income_details=income_details,
            expense_details=expense_details,
            risk_tolerance=raw.get("risk_tolerance") or raw.get("风险承受能力"),
            future_income_change=raw.get("future_income_change") or raw.get("未来收入变化"),
            major_expense_plan=raw.get("major_expense_plan") or raw.get("重大支出计划"),
            notes=raw.get("notes") or raw.get("备注"),
        )

    def _validate_penalty_rule(self, raw: Dict[str, Any]) -> PenaltyRule:
        """验证并转换违约金规则"""
        entity = "违约金规则"

        contract_no = raw.get("contract_no") or raw.get("合同号")
        if not contract_no:
            raise MissingFieldError(field_name="contract_no", entity=entity)

        tiers = []
        if "tiers" in raw and isinstance(raw["tiers"], list):
            for tier in raw["tiers"]:
                tiers.append(PenaltyTier(
                    min_months=self._parse_int(tier.get("min_months", 0), "min_months", entity),
                    max_months=tier.get("max_months") and self._parse_int(tier.get("max_months"), "max_months", entity, min_val=1),
                    penalty_type=self._parse_enum(tier.get("penalty_type"), "penalty_type", PenaltyType, entity),
                    penalty_value=self._parse_decimal(tier.get("penalty_value", 0), "penalty_value", entity),
                    description=tier.get("description"),
                ))

        penalty_type = self._parse_enum(
            raw.get("penalty_type") or raw.get("违约金类型", "no_penalty"),
            "penalty_type",
            PenaltyType,
            entity,
        )
        if tiers:
            penalty_type = PenaltyType.TIERED

        return PenaltyRule(
            contract_no=str(contract_no).strip(),
            rule_name=str(raw.get("rule_name") or raw.get("规则名称", "默认规则")).strip(),
            rule_effective_date=self._parse_date(raw.get("rule_effective_date") or raw.get("规则生效日"), "rule_effective_date", entity),
            rule_expiry_date=raw.get("rule_expiry_date") and self._parse_date(raw.get("rule_expiry_date") or raw.get("规则失效日"), "rule_expiry_date", entity),
            penalty_type=penalty_type,
            penalty_value=self._parse_decimal(raw.get("penalty_value") or raw.get("违约金值", 0), "penalty_value", entity),
            tiers=tiers,
            min_months_to_prepay=self._parse_int(raw.get("min_months_to_prepay") or raw.get("最低还款月数", 0), "min_months_to_prepay", entity),
            min_prepay_amount=self._parse_decimal(raw.get("min_prepay_amount") or raw.get("最低提前还款额", 10000), "min_prepay_amount", entity),
            max_prepay_times_per_year=raw.get("max_prepay_times_per_year") and self._parse_int(
                raw.get("max_prepay_times_per_year") or raw.get("每年最多提前还款次数", 0),
                "max_prepay_times_per_year",
                entity,
                min_val=1,
            ),
            prepay_date_restriction=raw.get("prepay_date_restriction") or raw.get("还款日限制"),
            special_conditions=raw.get("special_conditions") or raw.get("特殊条件"),
            source_document=raw.get("source_document") or raw.get("来源文件"),
            notes=raw.get("notes") or raw.get("备注"),
        )

    def _validate_client_goal(self, raw: Dict[str, Any]) -> ClientGoal:
        """验证并转换客户目标"""
        entity = "客户目标"

        customer_id = raw.get("customer_id") or raw.get("客户ID")
        if not customer_id:
            raise MissingFieldError(field_name="customer_id", entity=entity)

        return ClientGoal(
            customer_id=str(customer_id).strip(),
            target_date=raw.get("target_date") and self._parse_date(raw.get("target_date") or raw.get("目标日期"), "target_date", entity),
            prepay_amount=raw.get("prepay_amount") and self._parse_decimal(
                raw.get("prepay_amount") or raw.get("提前还款金额", 0),
                "prepay_amount",
                entity,
            ),
            prepay_strategy=self._parse_enum(
                raw.get("prepay_strategy") or raw.get("提前还款策略", "shorten_term"),
                "prepay_strategy",
                PrepayStrategy,
                entity,
            ),
            priority=self._parse_enum(
                raw.get("priority") or raw.get("优先级", "balanced"),
                "priority",
                Priority,
                entity,
            ),
            target_monthly_payment=raw.get("target_monthly_payment") and self._parse_decimal(
                raw.get("target_monthly_payment") or raw.get("目标月供", 0),
                "target_monthly_payment",
                entity,
            ),
            target_payoff_date=raw.get("target_payoff_date") and self._parse_date(
                raw.get("target_payoff_date") or raw.get("目标结清日期"),
                "target_payoff_date",
                entity,
            ),
            maximum_monthly_payment=raw.get("maximum_monthly_payment") and self._parse_decimal(
                raw.get("maximum_monthly_payment") or raw.get("最大可承受月供", 0),
                "maximum_monthly_payment",
                entity,
            ),
            minimum_monthly_surplus=raw.get("minimum_monthly_surplus") and self._parse_decimal(
                raw.get("minimum_monthly_surplus") or raw.get("最低月结余要求", 0),
                "minimum_monthly_surplus",
                entity,
            ),
            expected_interest_saving=raw.get("expected_interest_saving") and self._parse_decimal(
                raw.get("expected_interest_saving") or raw.get("期望节省利息", 0),
                "expected_interest_saving",
                entity,
            ),
            risk_preference=raw.get("risk_preference") or raw.get("风险偏好"),
            other_requirements=raw.get("other_requirements") or raw.get("其他要求"),
            notes=raw.get("notes") or raw.get("备注"),
        )

    def import_data(
        self,
        filename: str,
        data_type: str,
        conflict_resolution: ConflictResolution = ConflictResolution.ASK,
        operator: Optional[str] = None,
    ) -> ImportResult:
        """
        导入数据

        Args:
            filename: 文件名
            data_type: 数据类型 (loan, repayment, budget, penalty, goal)
            conflict_resolution: 冲突处理策略
            operator: 操作人

        Returns:
            导入结果
        """
        result = ImportResult(
            filename=filename,
            started_at=datetime.now(),
            conflict_resolution=conflict_resolution,
        )

        try:
            format_type = self._detect_format(filename)
            raw_records = self._read_file(filename, format_type)

            validator_map = {
                "loan": (self._validate_loan_contract, LoanContract),
                "repayment": (self._validate_repayment_record, RepaymentRecord),
                "budget": (self._validate_budget, Budget),
                "penalty": (self._validate_penalty_rule, PenaltyRule),
                "goal": (self._validate_client_goal, ClientGoal),
            }

            if data_type not in validator_map:
                raise ValueError(f"未知数据类型: {data_type}")

            validator, model_class = validator_map[data_type]

            for raw in raw_records:
                try:
                    record = validator(raw)
                    stored_record, conflicts = self.store.save(
                        record,
                        conflict_resolution=conflict_resolution,
                        operator=operator,
                    )

                    if conflicts:
                        if stored_record.status.value == "conflicted":
                            result.add_record(ImportAction.CONFLICTED, record, conflicts[0])
                        elif conflict_resolution == ConflictResolution.SKIP:
                            result.add_record(ImportAction.SKIPPED, record, conflicts[0])
                        elif conflict_resolution == ConflictResolution.UPDATE:
                            result.add_record(ImportAction.UPDATED, record, None)
                        elif conflict_resolution == ConflictResolution.ERROR:
                            result.add_record(ImportAction.FAILED, record, conflicts[0])
                    else:
                        result.add_record(ImportAction.INSERTED, record, None)

                except MortgageException as e:
                    result.add_record(ImportAction.FAILED, None, e)
                except ValidationError as e:
                    errors = []
                    for err in e.errors():
                        field = ".".join(str(loc) for loc in err["loc"])
                        errors.append(InvalidValueError(
                            field_name=field,
                            value=err.get("input"),
                            expected=err.get("msg", ""),
                            entity=data_type,
                        ))
                    result.add_record(ImportAction.FAILED, None, errors[0] if errors else None)
                except Exception as e:
                    wrapped = MortgageException(
                        message=str(e),
                        category=ErrorCategory.SYSTEM_ERROR,
                    )
                    result.add_record(ImportAction.FAILED, None, wrapped)

        except Exception as e:
            wrapped = MortgageException(
                message=f"导入文件失败: {e}",
                category=ErrorCategory.SYSTEM_ERROR,
            )
            result.add_record(ImportAction.FAILED, None, wrapped)

        result.complete()
        return result
