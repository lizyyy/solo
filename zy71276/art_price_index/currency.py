from datetime import datetime
from typing import Dict, List, Optional, Tuple
import json
from pathlib import Path

from .models import (
    AuctionRecord,
    RecordState,
    Issue,
    IssueType,
    IssueSeverity,
    ProcessingResult,
)


class CurrencyNormalizer:
    def __init__(self, target_currency: str = "USD"):
        self.target_currency = target_currency
        self.historical_rates = self._load_default_rates()
        self.conversion_stats: Dict[str, int] = {}

    def _load_default_rates(self) -> Dict[str, Dict[str, float]]:
        return {
            "2020": {
                "CNY": 6.8976,
                "USD": 1.0,
                "EUR": 0.8875,
                "GBP": 0.7773,
                "JPY": 106.78,
                "HKD": 7.7537,
                "KRW": 1179.2,
                "CHF": 0.9193,
                "AUD": 1.4519,
                "CAD": 1.3413,
            },
            "2021": {
                "CNY": 6.4515,
                "USD": 1.0,
                "EUR": 0.8460,
                "GBP": 0.7271,
                "JPY": 109.92,
                "HKD": 7.7785,
                "KRW": 1132.7,
                "CHF": 0.9142,
                "AUD": 1.3349,
                "CAD": 1.2536,
            },
            "2022": {
                "CNY": 6.7261,
                "USD": 1.0,
                "EUR": 0.9510,
                "GBP": 0.8336,
                "JPY": 131.50,
                "HKD": 7.8336,
                "KRW": 1291.4,
                "CHF": 0.9548,
                "AUD": 1.4418,
                "CAD": 1.3015,
            },
            "2023": {
                "CNY": 7.1800,
                "USD": 1.0,
                "EUR": 0.9240,
                "GBP": 0.8045,
                "JPY": 145.00,
                "HKD": 7.8200,
                "KRW": 1290.0,
                "CHF": 0.8810,
                "AUD": 1.5200,
                "CAD": 1.3500,
            },
            "2024": {
                "CNY": 7.2400,
                "USD": 1.0,
                "EUR": 0.9350,
                "GBP": 0.8150,
                "JPY": 150.00,
                "HKD": 7.8100,
                "KRW": 1320.0,
                "CHF": 0.8900,
                "AUD": 1.5400,
                "CAD": 1.3600,
            },
            "2025": {
                "CNY": 7.2000,
                "USD": 1.0,
                "EUR": 0.9400,
                "GBP": 0.8200,
                "JPY": 148.00,
                "HKD": 7.8000,
                "KRW": 1310.0,
                "CHF": 0.8850,
                "AUD": 1.5300,
                "CAD": 1.3550,
            },
            "default": {
                "CNY": 7.0,
                "USD": 1.0,
                "EUR": 0.9,
                "GBP": 0.8,
                "JPY": 140.0,
                "HKD": 7.8,
                "KRW": 1300.0,
                "CHF": 0.9,
                "AUD": 1.45,
                "CAD": 1.32,
            },
        }

    def _get_year_key(self, date: Optional[datetime]) -> str:
        if date:
            year = str(date.year)
            if year in self.historical_rates:
                return year
        return "default"

    def _get_exchange_rate(
        self, from_currency: str, date: Optional[datetime]
    ) -> Tuple[Optional[float], Optional[Issue]]:
        if from_currency == self.target_currency:
            return 1.0, None

        if from_currency == "UNKNOWN":
            return None, Issue(
                issue_type=IssueType.UNKNOWN_CURRENCY,
                severity=IssueSeverity.ERROR,
                message="未知币种无法转换",
                field="currency",
                impact="币种归一化失败，该记录价格不可比",
                suggestion="补充币种信息或使用默认币种",
            )

        year_key = self._get_year_key(date)
        rates = self.historical_rates[year_key]

        if from_currency not in rates:
            return None, Issue(
                issue_type=IssueType.UNKNOWN_CURRENCY,
                severity=IssueSeverity.WARNING,
                message=f"不支持的币种: {from_currency}",
                field="currency",
                impact="币种归一化失败，该记录价格不可比",
                suggestion="添加币种汇率配置",
            )

        rate = rates[from_currency]
        return rate, None

    def _convert_to_target(
        self,
        amount: float,
        from_currency: str,
        date: Optional[datetime],
    ) -> Tuple[Optional[float], List[Issue]]:
        issues = []
        rate, rate_issue = self._get_exchange_rate(from_currency, date)

        if rate_issue:
            issues.append(rate_issue)
            return None, issues

        converted = amount / rate
        return converted, issues

    def normalize_record(self, record: AuctionRecord) -> Tuple[AuctionRecord, List[Issue]]:
        issues = []

        if record.original_price is None or record.auction_date is None:
            return record, issues

        if record.state != RecordState.IMPORTED:
            return record, issues

        from_currency = record.original_currency or "UNKNOWN"
        converted_price, conversion_issues = self._convert_to_target(
            record.original_price, from_currency, record.auction_date
        )

        issues.extend(conversion_issues)

        if converted_price is not None:
            record.usd_price = converted_price
            record.state = RecordState.CURRENCY_NORMALIZED
            self.conversion_stats[from_currency] = (
                self.conversion_stats.get(from_currency, 0) + 1
            )
        else:
            for issue in conversion_issues:
                record.add_issue(issue)

        return record, issues

    def normalize_records(
        self, result: ProcessingResult
    ) -> ProcessingResult:
        all_issues: List[Issue] = []
        normalized_count = 0
        failed_count = 0

        for record in result.records:
            if record.state == RecordState.IMPORTED:
                _, issues = self.normalize_record(record)
                all_issues.extend(issues)

                if record.state == RecordState.CURRENCY_NORMALIZED:
                    normalized_count += 1
                elif any(
                    i.issue_type == IssueType.UNKNOWN_CURRENCY
                    and i.severity == IssueSeverity.ERROR
                    for i in issues
                ):
                    failed_count += 1

        result.issues.extend(all_issues)

        result.records_by_state = {}
        for record in result.records:
            state = record.state.value
            result.records_by_state[state] = result.records_by_state.get(state, 0) + 1

        result.completed_at = datetime.now()
        return result

    def load_rates_from_file(self, file_path: str) -> None:
        path = Path(file_path)
        with open(path, "r", encoding="utf-8") as f:
            self.historical_rates = json.load(f)

    def get_conversion_summary(self) -> Dict:
        return {
            "target_currency": self.target_currency,
            "conversions_by_currency": dict(self.conversion_stats),
            "supported_currencies": list(
                set(
                    curr
                    for year_rates in self.historical_rates.values()
                    for curr in year_rates.keys()
                )
            ),
        }
