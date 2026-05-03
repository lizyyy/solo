import csv
import json
import os
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from typing import List, Dict, Any, Optional, Tuple
import yaml

from .models import (
    Invoice, PurchaseOrderLine, Receipt, Payment, 
    ValidationRule, IssueSeverity
)


def parse_date(date_str: str) -> Optional[date]:
    if not date_str or date_str.strip() == "":
        return None
    date_str = date_str.strip()
    formats = ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y", "%Y%m%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def parse_decimal(value: Any, default: Decimal = Decimal(0)) -> Decimal:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", "")
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return default


class InvoiceParser:
    @classmethod
    def parse_file(cls, file_path: str) -> List[Invoice]:
        invoices = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                invoice = cls.parse_row(row, row_num)
                invoices.append(invoice)
        return invoices

    @classmethod
    def parse_row(cls, row: Dict[str, Any], row_num: int = 1) -> Invoice:
        amount = parse_decimal(row.get("amount") or row.get("不含税金额") or row.get("exclusive_tax_amount") or 0)
        tax_amount = parse_decimal(row.get("tax_amount") or row.get("税额") or row.get("tax") or 0)
        total_amount = parse_decimal(row.get("total_amount") or row.get("价税合计") or row.get("total") or (amount + tax_amount))
        
        tax_rate = parse_decimal(row.get("tax_rate") or row.get("税率")) if (row.get("tax_rate") or row.get("税率")) else None
        if tax_rate and tax_rate > 1:
            tax_rate = tax_rate / Decimal(100)

        invoice_number = row.get("invoice_number") or row.get("发票号码") or row.get("invoice_no") or f"INV-{row_num:06d}"
        
        is_split = str(row.get("is_split") or row.get("是否拆分") or "").lower() in ["true", "yes", "1", "是"]
        is_merged = str(row.get("is_merged") or row.get("是否合并") or "").lower() in ["true", "yes", "1", "是"]
        
        merged_invoices = []
        merged_str = row.get("merged_invoices") or row.get("合并发票") or ""
        if merged_str:
            merged_invoices = [x.strip() for x in str(merged_str).split(",") if x.strip()]

        return Invoice(
            doc_id=invoice_number,
            doc_type=None,
            vendor_id=row.get("vendor_id") or row.get("供应商ID") or row.get("vendor_code") or "",
            vendor_name=row.get("vendor_name") or row.get("供应商名称") or row.get("vendor") or "",
            amount=amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency=row.get("currency") or row.get("币种") or None,
            tax_rate=tax_rate,
            date=parse_date(row.get("date") or row.get("发票日期") or row.get("invoice_date") or ""),
            status=row.get("status") or row.get("状态") or "pending",
            related_ids=cls._parse_related_ids(row),
            invoice_number=invoice_number,
            po_number=row.get("po_number") or row.get("采购订单号") or row.get("purchase_order") or None,
            tax_invoice_code=row.get("tax_invoice_code") or row.get("发票代码") or row.get("invoice_code") or "",
            line_items=cls._parse_line_items(row),
            is_split=is_split,
            is_merged=is_merged,
            split_from=row.get("split_from") or row.get("拆分自") or None,
            merged_invoices=merged_invoices,
        )

    @classmethod
    def _parse_related_ids(cls, row: Dict[str, Any]) -> List[str]:
        related = []
        for key in ["related_ids", "related_docs", "相关单据"]:
            if row.get(key):
                related.extend([x.strip() for x in str(row[key]).split(",") if x.strip()])
        return related

    @classmethod
    def _parse_line_items(cls, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        line_items_str = row.get("line_items") or row.get("明细") or ""
        if not line_items_str:
            return []
        try:
            return json.loads(line_items_str)
        except (json.JSONDecodeError, TypeError):
            return []


class PurchaseOrderParser:
    @classmethod
    def parse_file(cls, file_path: str) -> List[PurchaseOrderLine]:
        po_lines = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                po_line = cls.parse_row(row, row_num)
                po_lines.append(po_line)
        return po_lines

    @classmethod
    def parse_row(cls, row: Dict[str, Any], row_num: int = 1) -> PurchaseOrderLine:
        po_number = row.get("po_number") or row.get("采购订单号") or row.get("purchase_order") or f"PO-{row_num:06d}"
        po_line_number = int(row.get("po_line_number") or row.get("行号") or row.get("line_no") or 1)
        quantity = parse_decimal(row.get("quantity") or row.get("数量") or 0)
        unit_price = parse_decimal(row.get("unit_price") or row.get("单价") or 0)
        amount = quantity * unit_price
        
        tax_rate = parse_decimal(row.get("tax_rate") or row.get("税率")) if (row.get("tax_rate") or row.get("税率")) else None
        if tax_rate and tax_rate > 1:
            tax_rate = tax_rate / Decimal(100)
        
        tax_amount = amount * (tax_rate or Decimal(0)) if tax_rate else parse_decimal(row.get("tax_amount") or row.get("税额") or 0)
        total_amount = amount + tax_amount

        return PurchaseOrderLine(
            doc_id=f"{po_number}-{po_line_number:03d}",
            doc_type=None,
            vendor_id=row.get("vendor_id") or row.get("供应商ID") or row.get("vendor_code") or "",
            vendor_name=row.get("vendor_name") or row.get("供应商名称") or row.get("vendor") or "",
            amount=amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency=row.get("currency") or row.get("币种") or None,
            tax_rate=tax_rate,
            date=parse_date(row.get("date") or row.get("订单日期") or row.get("order_date") or ""),
            status=row.get("status") or row.get("状态") or "pending",
            po_number=po_number,
            po_line_number=po_line_number,
            item_code=row.get("item_code") or row.get("物料代码") or row.get("product_code") or "",
            item_description=row.get("item_description") or row.get("物料描述") or row.get("description") or "",
            quantity=quantity,
            unit_price=unit_price,
        )


class ReceiptParser:
    @classmethod
    def parse_file(cls, file_path: str) -> List[Receipt]:
        receipts = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    receipt = cls.parse_json(data, line_num)
                    receipts.append(receipt)
                except json.JSONDecodeError:
                    continue
        return receipts

    @classmethod
    def parse_json(cls, data: Dict[str, Any], line_num: int = 1) -> Receipt:
        receipt_number = data.get("receipt_number") or data.get("收货单号") or data.get("grn_number") or f"REC-{line_num:06d}"
        received_quantity = parse_decimal(data.get("received_quantity") or data.get("收货数量") or data.get("quantity") or 0)
        
        unit_price = parse_decimal(data.get("unit_price") or data.get("单价") or 0)
        amount = received_quantity * unit_price
        
        tax_rate = parse_decimal(data.get("tax_rate") or data.get("税率")) if (data.get("tax_rate") or data.get("税率")) else None
        if tax_rate and tax_rate > 1:
            tax_rate = tax_rate / Decimal(100)
        
        tax_amount = amount * (tax_rate or Decimal(0)) if tax_rate else parse_decimal(data.get("tax_amount") or data.get("税额") or 0)
        total_amount = amount + tax_amount

        return Receipt(
            doc_id=receipt_number,
            doc_type=None,
            vendor_id=data.get("vendor_id") or data.get("供应商ID") or data.get("vendor_code") or "",
            vendor_name=data.get("vendor_name") or data.get("供应商名称") or data.get("vendor") or "",
            amount=amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency=data.get("currency") or data.get("币种") or None,
            tax_rate=tax_rate,
            date=parse_date(data.get("date") or data.get("收货日期") or data.get("receipt_date") or ""),
            status=data.get("status") or data.get("状态") or "pending",
            receipt_number=receipt_number,
            po_number=data.get("po_number") or data.get("采购订单号") or data.get("purchase_order") or None,
            po_line_number=int(data.get("po_line_number") or data.get("行号") or data.get("line_no") or 1) if (data.get("po_line_number") or data.get("行号")) else None,
            item_code=data.get("item_code") or data.get("物料代码") or data.get("product_code") or "",
            received_quantity=received_quantity,
            warehouse=data.get("warehouse") or data.get("仓库") or "",
        )


class PaymentParser:
    @classmethod
    def parse_file(cls, file_path: str) -> List[Payment]:
        payments = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                payment = cls.parse_row(row, row_num)
                payments.append(payment)
        return payments

    @classmethod
    def parse_row(cls, row: Dict[str, Any], row_num: int = 1) -> Payment:
        amount = parse_decimal(row.get("amount") or row.get("金额") or row.get("payment_amount") or 0)
        tax_amount = parse_decimal(row.get("tax_amount") or row.get("税额") or 0)
        total_amount = parse_decimal(row.get("total_amount") or row.get("付款金额") or (amount + tax_amount))
        
        payment_number = row.get("payment_number") or row.get("付款单号") or row.get("payment_no") or f"PAY-{row_num:06d}"
        
        is_cross_month = str(row.get("is_cross_month") or row.get("是否跨月") or "").lower() in ["true", "yes", "1", "是"]

        return Payment(
            doc_id=payment_number,
            doc_type=None,
            vendor_id=row.get("vendor_id") or row.get("供应商ID") or row.get("vendor_code") or "",
            vendor_name=row.get("vendor_name") or row.get("供应商名称") or row.get("vendor") or "",
            amount=amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            currency=row.get("currency") or row.get("币种") or None,
            tax_rate=None,
            date=parse_date(row.get("date") or row.get("付款日期") or row.get("payment_date") or ""),
            status=row.get("status") or row.get("状态") or "pending",
            payment_number=payment_number,
            invoice_number=row.get("invoice_number") or row.get("发票号码") or row.get("invoice_no") or None,
            payment_method=row.get("payment_method") or row.get("付款方式") or "",
            bank_account=row.get("bank_account") or row.get("银行账号") or "",
            is_cross_month=is_cross_month,
        )


class RulesParser:
    @classmethod
    def parse_file(cls, file_path: str) -> List[ValidationRule]:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            data = yaml.safe_load(f)
        
        rules = []
        rules_list = data.get("rules") or data.get("校验规则") or []
        
        for rule_data in rules_list:
            rule = cls.parse_rule(rule_data)
            if rule:
                rules.append(rule)
        
        return rules

    @classmethod
    def parse_rule(cls, rule_data: Dict[str, Any]) -> Optional[ValidationRule]:
        if not rule_data:
            return None
        
        severity_str = str(rule_data.get("severity") or rule_data.get("严重程度") or "warning").lower()
        severity_map = {
            "critical": IssueSeverity.CRITICAL,
            "high": IssueSeverity.CRITICAL,
            "warning": IssueSeverity.WARNING,
            "medium": IssueSeverity.WARNING,
            "info": IssueSeverity.INFO,
            "low": IssueSeverity.INFO,
        }
        severity = severity_map.get(severity_str, IssueSeverity.WARNING)
        
        enabled = rule_data.get("enabled")
        if enabled is None:
            enabled = rule_data.get("是否启用", True)
        if isinstance(enabled, str):
            enabled = enabled.lower() in ["true", "yes", "1", "是"]

        return ValidationRule(
            rule_id=rule_data.get("rule_id") or rule_data.get("规则ID") or "",
            rule_name=rule_data.get("rule_name") or rule_data.get("规则名称") or "",
            rule_type=rule_data.get("rule_type") or rule_data.get("规则类型") or "",
            description=rule_data.get("description") or rule_data.get("描述") or "",
            conditions=rule_data.get("conditions") or rule_data.get("条件") or {},
            severity=severity,
            enabled=bool(enabled),
        )


def get_default_rules() -> List[ValidationRule]:
    default_rules = [
        ValidationRule(
            rule_id="R001",
            rule_name="金额一致性校验",
            rule_type="amount",
            description="校验发票、采购订单、收货单、付款单的金额是否一致",
            conditions={
                "tolerance": "0.01",
                "check_tax": True
            },
            severity=IssueSeverity.CRITICAL,
            enabled=True
        ),
        ValidationRule(
            rule_id="R002",
            rule_name="供应商一致性校验",
            rule_type="vendor",
            description="校验发票、采购订单、收货单的供应商是否一致",
            conditions={},
            severity=IssueSeverity.CRITICAL,
            enabled=True
        ),
        ValidationRule(
            rule_id="R003",
            rule_name="数量一致性校验",
            rule_type="quantity",
            description="校验发票明细、采购订单、收货单的数量是否一致",
            conditions={
                "tolerance": "0"
            },
            severity=IssueSeverity.WARNING,
            enabled=True
        ),
        ValidationRule(
            rule_id="R004",
            rule_name="税率一致性校验",
            rule_type="tax_rate",
            description="校验发票、采购订单的税率是否一致",
            conditions={},
            severity=IssueSeverity.WARNING,
            enabled=True
        ),
        ValidationRule(
            rule_id="R005",
            rule_name="币种一致性校验",
            rule_type="currency",
            description="校验所有单据的币种是否一致",
            conditions={},
            severity=IssueSeverity.WARNING,
            enabled=True
        ),
        ValidationRule(
            rule_id="R006",
            rule_name="日期逻辑校验",
            rule_type="date",
            description="校验单据日期的逻辑顺序（订单->收货->发票->付款）",
            conditions={
                "allow_cross_month": True
            },
            severity=IssueSeverity.INFO,
            enabled=True
        ),
        ValidationRule(
            rule_id="R007",
            rule_name="必填字段校验",
            rule_type="required",
            description="校验币种、税率等必填字段是否缺失",
            conditions={
                "fields": ["currency", "tax_rate"]
            },
            severity=IssueSeverity.WARNING,
            enabled=True
        ),
    ]
    return default_rules
