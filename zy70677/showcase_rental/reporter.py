import csv
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import List, Dict, Any, Optional

from .models import (
    Contract,
    Showcase,
    LeasePeriod,
    AddCabinetRecord,
    DepositRecord,
    BillingPeriod,
    ValidationError,
    BadRow,
    ProcessingResult,
)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


class ReportGenerator:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _stable_sort(self, items: List[Any], key_func) -> List[Any]:
        return sorted(items, key=key_func)

    def _convert_to_serializable(self, obj: Any) -> Any:
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return str(obj)
        if isinstance(obj, dict):
            return {k: self._convert_to_serializable(v) for k, v in sorted(obj.items())}
        if isinstance(obj, list):
            return [self._convert_to_serializable(item) for item in obj]
        return obj

    def generate_billing_report_csv(self, billing_periods: List[BillingPeriod], filename: str):
        filepath = self.output_dir / filename
        sorted_billing = self._stable_sort(billing_periods, lambda b: (b.contract_id, b.period_id))

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "账期ID", "合同ID", "开始日期", "结束日期",
                "基础天数", "基础金额", "加柜天数", "加柜金额",
                "保证金抵扣", "应收总额", "来源"
            ])

            for billing in sorted_billing:
                writer.writerow([
                    billing.period_id,
                    billing.contract_id,
                    billing.start_date.isoformat(),
                    billing.end_date.isoformat(),
                    billing.base_days,
                    str(billing.base_amount),
                    billing.add_cabinet_days,
                    str(billing.add_cabinet_amount),
                    str(billing.deposit_deduction),
                    str(billing.total_amount),
                    str(billing.source),
                ])

        return str(filepath)

    def generate_validation_errors_csv(self, errors: List[ValidationError], filename: str):
        filepath = self.output_dir / filename
        sorted_errors = self._stable_sort(
            errors, lambda e: (e.severity.value, e.rule_code, str(e.source))
        )

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "严重程度", "规则代码", "消息", "数据ID", "来源位置"
            ])

            for error in sorted_errors:
                writer.writerow([
                    error.severity.value,
                    error.rule_code,
                    error.message,
                    error.data_id or "",
                    str(error.source),
                ])

        return str(filepath)

    def generate_bad_rows_csv(self, bad_rows: List[BadRow], filename: str):
        filepath = self.output_dir / filename
        sorted_bad_rows = self._stable_sort(bad_rows, lambda b: (str(b.source), b.error_message))

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "来源位置", "错误消息", "原始数据"
            ])

            for bad_row in sorted_bad_rows:
                writer.writerow([
                    str(bad_row.source),
                    bad_row.error_message,
                    json.dumps(bad_row.raw_data, ensure_ascii=False, cls=DateTimeEncoder),
                ])

        return str(filepath)

    def generate_summary_json(self, summary: Dict[str, Any], filename: str):
        filepath = self.output_dir / filename
        serializable_summary = self._convert_to_serializable(summary)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(serializable_summary, f, ensure_ascii=False, indent=2, sort_keys=True, cls=DateTimeEncoder)

        return str(filepath)

    def generate_contract_details_csv(self, contracts: List[Contract], filename: str):
        filepath = self.output_dir / filename
        sorted_contracts = self._stable_sort(contracts, lambda c: c.contract_id)

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "合同ID", "商户名称", "开始日期", "结束日期",
                "日租金", "保证金", "展柜数量", "允许加柜",
                "加柜日租金", "账期天数", "来源"
            ])

            for contract in sorted_contracts:
                writer.writerow([
                    contract.contract_id,
                    contract.merchant_name,
                    contract.start_date.isoformat(),
                    contract.end_date.isoformat(),
                    str(contract.daily_rate),
                    str(contract.deposit_amount),
                    contract.showcase_count,
                    contract.allow_add_cabinet,
                    str(contract.add_cabinet_daily_rate or ""),
                    contract.billing_cycle_days,
                    str(contract.source),
                ])

        return str(filepath)

    def generate_all_reports(
        self,
        result: ProcessingResult,
        prefix: str = "",
    ) -> Dict[str, str]:
        if prefix:
            prefix = f"{prefix}_"

        reports = {}

        reports["billing_report"] = self.generate_billing_report_csv(
            result.billing_periods, f"{prefix}billing_report.csv"
        )

        reports["validation_errors"] = self.generate_validation_errors_csv(
            result.validation_errors, f"{prefix}validation_errors.csv"
        )

        reports["bad_rows"] = self.generate_bad_rows_csv(
            result.bad_rows, f"{prefix}bad_rows.csv"
        )

        reports["summary"] = self.generate_summary_json(
            result.summary, f"{prefix}summary.json"
        )

        reports["contract_details"] = self.generate_contract_details_csv(
            result.contracts, f"{prefix}contract_details.csv"
        )

        return reports

    def print_console_summary(self, result: ProcessingResult):
        print("\n" + "=" * 80)
        print("展柜租赁账期核算报告")
        print("=" * 80)

        error_summary = {
            "ERROR": sum(1 for e in result.validation_errors if e.severity.value == "ERROR"),
            "WARNING": sum(1 for e in result.validation_errors if e.severity.value == "WARNING"),
            "INFO": sum(1 for e in result.validation_errors if e.severity.value == "INFO"),
        }

        print(f"\n数据验证结果:")
        print(f"  错误 (ERROR): {error_summary['ERROR']}")
        print(f"  警告 (WARNING): {error_summary['WARNING']}")
        print(f"  信息 (INFO): {error_summary['INFO']}")
        print(f"  坏行记录: {len(result.bad_rows)}")

        print(f"\n数据统计:")
        print(f"  合同数量: {result.summary.get('total_contracts', 0)}")
        print(f"  展柜数量: {result.summary.get('total_showcases', 0)}")
        print(f"  租期记录: {result.summary.get('total_lease_periods', 0)}")
        print(f"  加柜记录: {result.summary.get('total_add_cabinet_records', 0)}")
        print(f"  保证金记录: {result.summary.get('total_deposit_records', 0)}")
        print(f"  生成账期: {result.summary.get('total_billing_periods', 0)}")

        grand_totals = result.summary.get("grand_totals", {})
        print(f"\n费用汇总:")
        print(f"  基础租赁天数: {grand_totals.get('base_days', 0)} 天")
        print(f"  基础租赁金额: {grand_totals.get('base_amount', '0')}")
        print(f"  加柜天数: {grand_totals.get('add_cabinet_days', 0)} 天")
        print(f"  加柜金额: {grand_totals.get('add_cabinet_amount', '0')}")
        print(f"  保证金抵扣: {grand_totals.get('deposit_deduction', '0')}")
        print(f"  应收总额: {grand_totals.get('total_amount', '0')}")

        if result.validation_errors:
            print(f"\n前10条验证错误:")
            sorted_errors = sorted(
                result.validation_errors,
                key=lambda e: (e.severity.value, e.rule_code)
            )
            for i, error in enumerate(sorted_errors[:10], 1):
                print(f"  {i}. [{error.severity.value}] {error.rule_code}: {error.message}")
                print(f"     来源: {error.source}")

        print("\n" + "=" * 80)
        print(f"报告已生成到: {self.output_dir.absolute()}")
        print("=" * 80 + "\n")
