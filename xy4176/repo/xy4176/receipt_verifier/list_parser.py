"""清单解析模块 - 解析 ERP 付款 CSV、发票清单 JSON 和供应商台账"""

import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import pandas as pd

from .models import ERPPayment, InvoiceItem, SupplierLedger
from .utils import parse_date, parse_decimal, normalize_text


class CSVParser:
    """CSV 文件解析器"""

    def __init__(self, encoding: str = "utf-8"):
        self.encoding = encoding

    def _detect_encoding(self, file_path: str) -> str:
        """尝试检测文件编码

        Args:
            file_path: 文件路径

        Returns:
            检测到的编码
        """
        encodings = ["utf-8", "gbk", "gb2312", "gb18030", "utf-8-sig", "latin-1"]

        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    f.read(1024)
                return enc
            except UnicodeDecodeError:
                continue

        return self.encoding

    def parse_to_dict_list(
        self, file_path: str, delimiter: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """解析 CSV 文件为字典列表

        Args:
            file_path: 文件路径
            delimiter: 分隔符（自动检测时为 None）

        Returns:
            字典列表
        """
        encoding = self._detect_encoding(file_path)
        results: List[Dict[str, Any]] = []

        try:
            if delimiter:
                df = pd.read_csv(file_path, encoding=encoding, sep=delimiter)
            else:
                df = pd.read_csv(file_path, encoding=encoding)

            for _, row in df.iterrows():
                row_dict = {str(k): v for k, v in row.to_dict().items()}
                results.append(row_dict)
        except Exception as e:
            with open(file_path, "r", encoding=encoding) as f:
                content = f.read()

            if delimiter is None:
                delimiters = [",", ";", "\t", "|"]
                for d in delimiters:
                    if d in content[:1000]:
                        delimiter = d
                        break
                if delimiter is None:
                    delimiter = ","

            reader = csv.DictReader(content.splitlines(), delimiter=delimiter)
            for row in reader:
                results.append(dict(row))

        return results


class ERPPaymentParser:
    """ERP 付款记录解析器"""

    FIELD_MAPPINGS = [
        {
            "payment_id": ["付款单号", "付款ID", "payment_id", "id", "编号", "单号"],
            "payee_name": ["收款人", "收款单位", "供应商名称", "payee", "供应商"],
            "payee_account": ["收款账号", "银行账号", "收款人账号", "account", "账号"],
            "amount": ["金额", "付款金额", "支付金额", "amount", "money"],
            "payment_date": ["日期", "付款日期", "支付日期", "date", "time"],
            "invoice_number": ["发票号", "发票编号", "invoice", "发票号码"],
            "supplier_code": ["供应商编码", "供应商代码", "supplier_code"],
            "department": ["部门", "department", "部门名称"],
            "remark": ["备注", "摘要", "remark", "说明"],
        }
    ]

    def __init__(self):
        self.csv_parser = CSVParser()

    def _map_field(self, row: Dict[str, Any], field_name: str) -> Any:
        """映射字段

        Args:
            row: 行数据
            field_name: 目标字段名

        Returns:
            映射后的值
        """
        for mapping in self.FIELD_MAPPINGS:
            if field_name in mapping:
                for possible_key in mapping[field_name]:
                    for key in row.keys():
                        if possible_key.lower() in key.lower() or key.lower() in possible_key.lower():
                            return row[key]
        return row.get(field_name, "")

    def parse(self, file_path: str) -> List[ERPPayment]:
        """解析 ERP 付款 CSV 文件

        Args:
            file_path: CSV 文件路径

        Returns:
            ERPPayment 列表
        """
        rows = self.csv_parser.parse_to_dict_list(file_path)
        payments: List[ERPPayment] = []

        for row in rows:
            payment = ERPPayment(
                payment_id=str(self._map_field(row, "payment_id") or "").strip(),
                payee_name=normalize_text(str(self._map_field(row, "payee_name") or "")),
                payee_account=str(self._map_field(row, "payee_account") or "").strip(),
                amount=parse_decimal(self._map_field(row, "amount")),
                payment_date=parse_date(self._map_field(row, "payment_date")),
                invoice_number=str(self._map_field(row, "invoice_number") or "").strip(),
                supplier_code=str(self._map_field(row, "supplier_code") or "").strip(),
                department=normalize_text(str(self._map_field(row, "department") or "")),
                remark=normalize_text(str(self._map_field(row, "remark") or "")),
                source_file=file_path,
            )
            payments.append(payment)

        return payments


class InvoiceParser:
    """发票清单解析器"""

    def __init__(self):
        self.csv_parser = CSVParser()

    def parse_json(self, file_path: str) -> List[InvoiceItem]:
        """从 JSON 文件解析发票清单

        Args:
            file_path: JSON 文件路径

        Returns:
            InvoiceItem 列表
        """
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        invoices: List[InvoiceItem] = []

        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = data.get("invoices", []) or data.get("items", [])
            if not items and "data" in data:
                items = data["data"]
                if isinstance(items, dict):
                    items = [items]
        else:
            items = []

        for item in items:
            if not isinstance(item, dict):
                continue

            invoice = InvoiceItem(
                invoice_number=str(item.get("发票号", item.get("invoice_number", item.get("发票号码", "")))).strip(),
                invoice_date=parse_date(item.get("开票日期", item.get("invoice_date", item.get("日期", None)))),
                amount=parse_decimal(item.get("金额", item.get("amount", item.get("不含税金额", 0)))),
                tax_amount=parse_decimal(item.get("税额", item.get("tax_amount", item.get("税金", 0)))),
                total_amount=parse_decimal(item.get("价税合计", item.get("total_amount", item.get("合计金额", 0)))),
                supplier_name=normalize_text(str(item.get("供应商", item.get("supplier_name", item.get("销售方", item.get("销货方", "")))))),
                supplier_tax_id=str(item.get("纳税人识别号", item.get("supplier_tax_id", item.get("税号", "")))).strip(),
                goods_name=normalize_text(str(item.get("货物名称", item.get("goods_name", item.get("商品名称", item.get("品名", "")))))),
                payment_id=str(item.get("付款单号", item.get("payment_id", item.get("关联单号", "")))).strip(),
                source_file=file_path,
            )

            if invoice.total_amount == 0 and invoice.amount > 0:
                invoice.total_amount = invoice.amount + invoice.tax_amount

            invoices.append(invoice)

        return invoices

    def parse_csv(self, file_path: str) -> List[InvoiceItem]:
        """从 CSV 文件解析发票清单

        Args:
            file_path: CSV 文件路径

        Returns:
            InvoiceItem 列表
        """
        rows = self.csv_parser.parse_to_dict_list(file_path)
        invoices: List[InvoiceItem] = []

        for row in rows:
            invoice = InvoiceItem(
                invoice_number=str(row.get("发票号", row.get("invoice_number", row.get("发票号码", "")))).strip(),
                invoice_date=parse_date(row.get("开票日期", row.get("invoice_date", row.get("日期", None)))),
                amount=parse_decimal(row.get("金额", row.get("amount", row.get("不含税金额", 0)))),
                tax_amount=parse_decimal(row.get("税额", row.get("tax_amount", row.get("税金", 0)))),
                total_amount=parse_decimal(row.get("价税合计", row.get("total_amount", row.get("合计金额", 0)))),
                supplier_name=normalize_text(str(row.get("供应商", row.get("supplier_name", row.get("销售方", row.get("销货方", "")))))),
                supplier_tax_id=str(row.get("纳税人识别号", row.get("supplier_tax_id", row.get("税号", "")))).strip(),
                goods_name=normalize_text(str(row.get("货物名称", row.get("goods_name", row.get("商品名称", row.get("品名", "")))))),
                payment_id=str(row.get("付款单号", row.get("payment_id", row.get("关联单号", "")))).strip(),
                source_file=file_path,
            )

            if invoice.total_amount == 0 and invoice.amount > 0:
                invoice.total_amount = invoice.amount + invoice.tax_amount

            invoices.append(invoice)

        return invoices

    def parse(self, file_path: str) -> List[InvoiceItem]:
        """解析发票清单文件（自动检测格式）

        Args:
            file_path: 文件路径

        Returns:
            InvoiceItem 列表
        """
        path = Path(file_path)
        if path.suffix.lower() == ".json":
            return self.parse_json(file_path)
        else:
            return self.parse_csv(file_path)


class SupplierLedgerParser:
    """供应商台账解析器"""

    def __init__(self):
        self.csv_parser = CSVParser()

    def parse(self, file_path: str) -> List[SupplierLedger]:
        """解析供应商台账文件

        Args:
            file_path: CSV/Excel 文件路径

        Returns:
            SupplierLedger 列表
        """
        path = Path(file_path)
        suppliers: List[SupplierLedger] = []

        if path.suffix.lower() in (".xlsx", ".xls"):
            df = pd.read_excel(file_path)
            rows = []
            for _, row in df.iterrows():
                rows.append({str(k): v for k, v in row.to_dict().items()})
        else:
            rows = self.csv_parser.parse_to_dict_list(file_path)

        for row in rows:
            supplier = SupplierLedger(
                supplier_code=str(row.get("供应商编码", row.get("supplier_code", row.get("代码", row.get("编号", ""))))).strip(),
                supplier_name=normalize_text(str(row.get("供应商名称", row.get("supplier_name", row.get("名称", row.get("供应商", "")))))),
                bank_account=str(row.get("银行账号", row.get("bank_account", row.get("账号", row.get("收款账号", ""))))).strip(),
                bank_name=normalize_text(str(row.get("开户银行", row.get("bank_name", row.get("银行", ""))))),
                tax_id=str(row.get("纳税人识别号", row.get("tax_id", row.get("税号", "")))).strip(),
                contact_person=normalize_text(str(row.get("联系人", row.get("contact_person", row.get("负责人", ""))))),
                contact_phone=str(row.get("联系电话", row.get("contact_phone", row.get("电话", "")))).strip(),
                address=normalize_text(str(row.get("地址", row.get("address", row.get("注册地址", ""))))),
                source_file=file_path,
            )
            suppliers.append(supplier)

        return suppliers


class ListImporter:
    """清单导入器 - 统一入口"""

    def __init__(self):
        self.erp_parser = ERPPaymentParser()
        self.invoice_parser = InvoiceParser()
        self.supplier_parser = SupplierLedgerParser()

    def import_erp_payments(self, file_path: str) -> List[ERPPayment]:
        """导入 ERP 付款记录

        Args:
            file_path: 文件路径

        Returns:
            ERPPayment 列表
        """
        return self.erp_parser.parse(file_path)

    def import_invoices(self, file_path: str) -> List[InvoiceItem]:
        """导入发票清单

        Args:
            file_path: 文件路径

        Returns:
            InvoiceItem 列表
        """
        return self.invoice_parser.parse(file_path)

    def import_suppliers(self, file_path: str) -> List[SupplierLedger]:
        """导入供应商台账

        Args:
            file_path: 文件路径

        Returns:
            SupplierLedger 列表
        """
        return self.supplier_parser.parse(file_path)


def import_erp_payments(file_path: str) -> List[ERPPayment]:
    """便捷函数：导入 ERP 付款记录"""
    importer = ListImporter()
    return importer.import_erp_payments(file_path)


def import_invoices(file_path: str) -> List[InvoiceItem]:
    """便捷函数：导入发票清单"""
    importer = ListImporter()
    return importer.import_invoices(file_path)


def import_suppliers(file_path: str) -> List[SupplierLedger]:
    """便捷函数：导入供应商台账"""
    importer = ListImporter()
    return importer.import_suppliers(file_path)
