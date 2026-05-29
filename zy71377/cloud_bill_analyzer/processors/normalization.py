from typing import List, Dict, Any, Tuple
from datetime import datetime
import re

from ..core.models import (
    BillRecord,
    NormalizedBill,
    CloudProvider,
    TagIssue,
    TagIssueType,
    AnomalyRecord,
    AnomalyType,
)
from ..core.config import Config
from ..utils.currency import convert_currency, normalize_currency_code
from ..utils.security import get_masked_logger
from ..parsers.base import BillParser
from ..parsers import get_parser


AWS_FIELD_MAP = {
    "resource_id": ["lineItem/ResourceId", "resourceId", "ResourceId"],
    "billing_period_start": ["lineItem/UsageStartDate", "UsageStartDate"],
    "billing_period_end": ["lineItem/UsageEndDate", "UsageEndDate"],
    "cost": ["lineItem/UnblendedCost", "lineItem/BlendedCost", "UnblendedCost", "BlendedCost"],
    "currency": ["lineItem/CurrencyCode", "CurrencyCode"],
    "service": ["lineItem/ProductCode", "ProductCode", "product/ProductName", "ProductName"],
    "region": ["product/region", "lineItem/AvailabilityZone", "region", "AvailabilityZone"],
    "instance_type": ["product/instanceType", "instanceType", "InstanceType"],
    "ri_arn": ["reservation/ReservationARN", "savingsPlan/SavingsPlanARN"],
}

ALIYUN_FIELD_MAP = {
    "resource_id": ["实例ID", "ResourceID", "资源ID", "InstanceId", "资源实例ID"],
    "billing_period_start": ["计费开始时间", "StartTime", "UsageStartTime", "开始时间"],
    "billing_period_end": ["计费结束时间", "EndTime", "UsageEndTime", "结束时间"],
    "cost": ["优惠后金额", "PretaxAmount", "应付金额", "PretaxGrossAmount", "现金支付", "CashAmount"],
    "currency": ["币种", "Currency", "货币单位"],
    "service": ["产品代码", "ProductCode", "产品名称", "ProductName", "产品"],
    "region": ["区域", "Region", "地域", "Zone", "可用区"],
    "instance_type": ["实例规格", "InstanceSpec", "InstanceType", "规格"],
    "ri_arn": ["资源包ID", "ResourcePackageId", "包年包月ID"],
}

VOLCENGINE_FIELD_MAP = {
    "resource_id": ["ResourceID", "资源ID", "InstanceId", "资源实例ID"],
    "billing_period_start": ["BillingStart", "计费开始", "StartTime", "开始时间"],
    "billing_period_end": ["BillingEnd", "计费结束", "EndTime", "结束时间"],
    "cost": ["Cost", "费用", "应付金额", "PayableAmount"],
    "currency": ["Currency", "币种", "货币单位"],
    "service": ["Product", "产品", "ProductName", "产品名称"],
    "region": ["Region", "地域", "Zone", "可用区"],
    "instance_type": ["InstanceType", "实例类型", "规格", "Spec"],
    "ri_arn": ["PackageId", "资源包ID", "RIID", "预留实例ID"],
}

PROVIDER_FIELD_MAPS = {
    CloudProvider.AWS: AWS_FIELD_MAP,
    CloudProvider.ALIYUN: ALIYUN_FIELD_MAP,
    CloudProvider.VOLCENGINE: VOLCENGINE_FIELD_MAP,
}


def _parse_datetime(value: Any) -> Tuple[datetime, List[TagIssue]]:
    issues: List[TagIssue] = []
    if value is None:
        return datetime.min, issues

    value_str = str(value).strip()
    if not value_str:
        return datetime.min, issues

    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y%m%d",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%S+00:00",
        "%Y-%m-%dT%H:%M:%S.%f+00:00",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(value_str, fmt)
            return dt, issues
        except (ValueError, TypeError):
            continue

    try:
        from dateutil import parser as date_parser
        dt = date_parser.parse(value_str)
        return dt, issues
    except Exception:
        issues.append(TagIssue(
            field_name="billing_period",
            issue_type=TagIssueType.INVALID_FORMAT,
            original_value=value_str,
            message=f"Cannot parse datetime: {value_str}",
        ))
        return datetime.min, issues


def _parse_cost(value: Any) -> Tuple[float, List[TagIssue]]:
    issues: List[TagIssue] = []
    if value is None:
        return 0.0, issues

    if isinstance(value, (int, float)):
        return float(value), issues

    value_str = str(value).strip()
    if not value_str:
        return 0.0, issues

    value_str = value_str.replace(",", "").replace("¥", "").replace("$", "").strip()

    try:
        return float(value_str), issues
    except (ValueError, TypeError):
        issues.append(TagIssue(
            field_name="cost",
            issue_type=TagIssueType.INVALID_FORMAT,
            original_value=str(value),
            message=f"Cannot parse cost value: {value}",
        ))
        return 0.0, issues


def _get_field_value(row: Dict[str, Any], field_names: List[str]) -> Any:
    for name in field_names:
        if name in row and row[name] is not None:
            value = row[name]
            if isinstance(value, str) and value.strip():
                return value
            elif isinstance(value, (int, float)):
                return value
    return None


def _normalize_single_bill(
    record: BillRecord,
    parser: BillParser,
    config: Config,
) -> Tuple[NormalizedBill, List[AnomalyRecord]]:
    anomalies: List[AnomalyRecord] = []
    field_map = PROVIDER_FIELD_MAPS.get(record.provider, {})

    resource_id = str(_get_field_value(record.raw_data, field_map.get("resource_id", [])) or "")
    billing_start_raw = _get_field_value(record.raw_data, field_map.get("billing_period_start", []))
    billing_end_raw = _get_field_value(record.raw_data, field_map.get("billing_period_end", []))
    cost_raw = _get_field_value(record.raw_data, field_map.get("cost", []))
    currency_raw = str(_get_field_value(record.raw_data, field_map.get("currency", [])) or "")
    service = str(_get_field_value(record.raw_data, field_map.get("service", [])) or "")
    region = str(_get_field_value(record.raw_data, field_map.get("region", [])) or "")
    instance_type = str(_get_field_value(record.raw_data, field_map.get("instance_type", [])) or "")
    ri_arn = str(_get_field_value(record.raw_data, field_map.get("ri_arn", [])) or "")

    missing_fields: List[str] = []
    if not resource_id:
        missing_fields.append("resource_id")
    if not currency_raw:
        missing_fields.append("currency")
    if not service:
        missing_fields.append("service")

    for field in missing_fields:
        anomalies.append(AnomalyRecord(
            anomaly_type=AnomalyType.MISSING_REQUIRED_FIELD,
            severity="high",
            message=f"Missing required field: {field}",
            provider=record.provider,
            period="",
            raw_data={"source_file": record.source_file, "line_number": record.line_number},
        ))

    billing_start, dt_issues_start = _parse_datetime(billing_start_raw)
    billing_end, dt_issues_end = _parse_datetime(billing_end_raw)

    cost, cost_issues = _parse_cost(cost_raw)
    original_currency = normalize_currency_code(currency_raw)

    if not original_currency:
        original_currency = ""
        anomalies.append(AnomalyRecord(
            anomaly_type=AnomalyType.CURRENCY_ERROR,
            severity="high",
            message=f"Missing or invalid currency code: {currency_raw}",
            provider=record.provider,
            raw_data={"original_currency": currency_raw},
        ))

    try:
        if original_currency and original_currency != config.target_currency:
            normalized_cost, exchange_rate = convert_currency(
                cost, original_currency, config.target_currency, config
            )
        else:
            normalized_cost = cost
            exchange_rate = 1.0
    except ValueError as e:
        anomalies.append(AnomalyRecord(
            anomaly_type=AnomalyType.CURRENCY_ERROR,
            severity="high",
            message=str(e),
            provider=record.provider,
            raw_data={"from": original_currency, "to": config.target_currency},
        ))
        normalized_cost = cost
        exchange_rate = 0.0

    tags = parser._extract_tags(record.raw_data)

    project = tags.get("project", tags.get("Project"))
    team = tags.get("team", tags.get("Team"))
    environment = tags.get("environment", tags.get("Environment", tags.get("env")))

    all_issues = record.tag_issues + dt_issues_start + dt_issues_end + cost_issues

    normalized = NormalizedBill(
        provider=record.provider,
        resource_id=resource_id,
        billing_period_start=billing_start,
        billing_period_end=billing_end,
        cost=cost,
        original_currency=original_currency,
        normalized_currency=config.target_currency,
        exchange_rate=exchange_rate,
        normalized_cost=normalized_cost,
        service=service,
        region=region or None,
        instance_type=instance_type or None,
        tags=tags,
        project=project or None,
        team=team or None,
        environment=environment or None,
        is_ri_credit=record.has_ri_credit,
        ri_arn=ri_arn or None,
        original_record=record,
        issues=all_issues,
        missing_fields=missing_fields,
    )

    return normalized, anomalies


def normalize_bills(
    records: List[BillRecord],
    config: Config,
    parser_hint: CloudProvider = None,
) -> Tuple[List[NormalizedBill], List[AnomalyRecord]]:
    logger = get_masked_logger(config, "normalizer")
    logger.info(f"Normalizing {len(records)} bill records")

    normalized_bills: List[NormalizedBill] = []
    all_anomalies: List[AnomalyRecord] = []

    parser_cache: Dict[CloudProvider, BillParser] = {}

    for record in records:
        provider = record.provider
        if provider not in parser_cache:
            if parser_hint and parser_hint == provider:
                parser_cache[provider] = get_parser(record.source_file, config, parser_hint)
            else:
                parser_cache[provider] = get_parser(record.source_file, config, provider)

        parser = parser_cache[provider]
        normalized, anomalies = _normalize_single_bill(record, parser, config)
        normalized_bills.append(normalized)
        all_anomalies.extend(anomalies)

    logger.info(
        f"Normalization complete: {len(normalized_bills)} bills, "
        f"{len(all_anomalies)} field/currency anomalies"
    )

    return normalized_bills, all_anomalies
