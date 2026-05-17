from dataclasses import dataclass
from typing import List, Optional
import json
import os


@dataclass
class ParserConfig:
    cash_register_date_formats: List[str]
    payment_gateway_date_formats: List[str]
    encoding: str = "utf-8"
    delimiter: str = ","
    skip_rows: int = 0
    has_header: bool = True


@dataclass
class MatchingConfig:
    time_window_minutes: int
    amount_tolerance: float
    enable_duplicate_detection: bool
    refund_time_window_minutes: int
    store_id_required: bool = True


@dataclass
class ReportConfig:
    output_dir: str
    generate_csv: bool
    generate_markdown: bool
    include_bad_rows: bool = True
    include_raw_data: bool = False


@dataclass
class AppConfig:
    parser: ParserConfig
    matching: MatchingConfig
    report: ReportConfig
    cash_register_columns: dict
    payment_gateway_columns: dict

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> "AppConfig":
        if config_path and os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return cls(
                    parser=ParserConfig(**data.get("parser", {})),
                    matching=MatchingConfig(**data.get("matching", {})),
                    report=ReportConfig(**data.get("report", {})),
                    cash_register_columns=data.get("cash_register_columns", {}),
                    payment_gateway_columns=data.get("payment_gateway_columns", {})
                )
        return cls.default()

    @classmethod
    def default(cls) -> "AppConfig":
        return cls(
            parser=ParserConfig(
                cash_register_date_formats=["%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"],
                payment_gateway_date_formats=["%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"],
            ),
            matching=MatchingConfig(
                time_window_minutes=5,
                amount_tolerance=0.01,
                enable_duplicate_detection=True,
                refund_time_window_minutes=1440
            ),
            report=ReportConfig(
                output_dir="./reports",
                generate_csv=True,
                generate_markdown=True
            ),
            cash_register_columns={
                "transaction_id": ["transaction_id", "交易号", "流水号"],
                "store_id": ["store_id", "门店编号", "门店号"],
                "amount": ["amount", "金额", "交易金额"],
                "transaction_time": ["transaction_time", "交易时间", "时间"],
                "transaction_type": ["transaction_type", "交易类型", "类型"],
                "payment_method": ["payment_method", "支付方式", "渠道"],
                "order_no": ["order_no", "订单号"],
                "is_refund": ["is_refund", "是否退款", "退款标记"],
                "refund_reference": ["refund_reference", "退款参考号"]
            },
            payment_gateway_columns={
                "transaction_id": ["transaction_id", "支付单号", "流水号"],
                "store_id": ["store_id", "门店编号", "商户号"],
                "amount": ["amount", "金额", "交易金额"],
                "transaction_time": ["transaction_time", "支付时间", "交易时间"],
                "transaction_type": ["transaction_type", "交易类型", "类型"],
                "payment_method": ["payment_method", "支付方式"],
                "order_no": ["order_no", "商户订单号"],
                "is_refund": ["is_refund", "是否退款"],
                "refund_reference": ["refund_reference", "原交易号"]
            }
        )
