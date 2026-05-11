"""数据导入模块"""

import os
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
from decimal import Decimal
from datetime import datetime

import pandas as pd

from .models import (
    Order, OrderItem, InvoiceHeader, ProductCategory, RefundRecord,
    InvoiceType, OrderStatus
)


COLUMN_MAPPINGS = {
    "headers": {
        "header_id": ["header_id", "抬头ID", "抬头id"],
        "name": ["name", "名称", "抬头名称"],
        "type": ["type", "类型", "抬头类型"],
        "tax_number": ["tax_number", "税号", "纳税人识别号"],
        "address": ["address", "地址"],
        "phone": ["phone", "电话"],
        "bank_name": ["bank_name", "开户行", "开户银行"],
        "bank_account": ["bank_account", "银行账号", "账号"],
        "email": ["email", "邮箱", "电子邮件"],
        "is_valid": ["is_valid", "是否有效"],
    },
    "categories": {
        "category_id": ["category_id", "类目ID", "类目id"],
        "name": ["name", "名称", "类目名称"],
        "tax_rate": ["tax_rate", "税率"],
        "parent_category": ["parent_category", "父类目"],
        "description": ["description", "描述", "说明"],
    },
    "orders": {
        "order_id": ["order_id", "订单ID", "订单id"],
        "platform": ["platform", "平台"],
        "order_date": ["order_date", "订单日期", "下单时间"],
        "header_id": ["header_id", "抬头ID"],
        "header_name": ["header_name", "发票抬头", "抬头名称"],
        "header_type": ["header_type", "抬头类型"],
        "total_amount": ["total_amount", "订单金额", "总金额"],
        "total_refunded_amount": ["total_refunded_amount", "退款金额"],
        "has_invoiced": ["has_invoiced", "是否已开票"],
        "invoice_ids": ["invoice_ids", "已开发票号", "发票号"],
        "notes": ["notes", "备注"],
    },
    "order_items": {
        "item_id": ["item_id", "商品项ID", "itemid"],
        "order_id": ["order_id", "订单ID", "订单id"],
        "product_name": ["product_name", "商品名称"],
        "category_id": ["category_id", "类目ID"],
        "category_name": ["category_name", "类目", "类目名称"],
        "quantity": ["quantity", "数量"],
        "unit_price": ["unit_price", "单价"],
        "amount": ["amount", "金额"],
        "tax_rate": ["tax_rate", "税率"],
        "tax_amount": ["tax_amount", "税额"],
        "refunded_quantity": ["refunded_quantity", "退款数量"],
        "refunded_amount": ["refunded_amount", "退款金额"],
    },
    "refunds": {
        "refund_id": ["refund_id", "退款ID"],
        "order_id": ["order_id", "订单ID"],
        "refund_date": ["refund_date", "退款日期"],
        "refund_type": ["refund_type", "退款类型"],
        "amount": ["amount", "退款金额"],
        "item_id": ["item_id", "商品项ID"],
        "reason": ["reason", "退款原因"],
        "notes": ["notes", "备注"],
        "is_processed": ["is_processed", "是否已处理"],
    },
}


def normalize_columns(df: pd.DataFrame, mapping_type: str) -> pd.DataFrame:
    """将列名标准化为英文"""
    if mapping_type not in COLUMN_MAPPINGS:
        return df

    mapping = COLUMN_MAPPINGS[mapping_type]
    new_columns = {}

    for col in df.columns:
        col_lower = str(col).strip()
        matched = False
        for std_name, aliases in mapping.items():
            if col_lower in aliases or col_lower.lower() in [a.lower() for a in aliases]:
                new_columns[col] = std_name
                matched = True
                break

    if new_columns:
        df = df.rename(columns=new_columns)

    return df


class DataImporter:
    """数据导入器"""

    def __init__(self):
        self.headers_map: Dict[str, InvoiceHeader] = {}
        self.categories_map: Dict[str, ProductCategory] = {}
        self.orders_map: Dict[str, Order] = {}
        self.refunds: List[RefundRecord] = []

    def read_file(self, file_path: str) -> pd.DataFrame:
        """读取文件，支持CSV和Excel"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        suffix = path.suffix.lower()
        if suffix == ".csv":
            return pd.read_csv(file_path, dtype=str, encoding="utf-8")
        elif suffix in [".xlsx", ".xls"]:
            return pd.read_excel(file_path, dtype=str)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _parse_decimal(self, value: Any) -> Decimal:
        """解析金额为Decimal"""
        if pd.isna(value) or value is None or str(value).strip() == "" or str(value).strip().lower() == "nan":
            return Decimal("0")
        return Decimal(str(value).replace(",", "").strip())

    def _parse_int(self, value: Any) -> int:
        """解析整数"""
        if pd.isna(value) or value is None or str(value).strip() == "" or str(value).strip().lower() == "nan":
            return 0
        return int(float(str(value).strip()))

    def _parse_datetime(self, value: Any) -> datetime:
        """解析日期时间"""
        if pd.isna(value) or value is None:
            return datetime.now()
        if isinstance(value, datetime):
            return value
        try:
            return pd.to_datetime(value).to_pydatetime()
        except:
            return datetime.now()

    def _get_value(self, row: pd.Series, key: str, default: Any = None) -> Any:
        """安全获取行值"""
        if key in row.index:
            val = row[key]
            if pd.isna(val):
                return default
            return val
        return default

    def _get_str_value(self, row: pd.Series, key: str, default: str = "") -> str:
        """安全获取字符串值"""
        val = self._get_value(row, key)
        if val is None:
            return default
        s = str(val).strip()
        if s.lower() == "nan":
            return default
        return s

    def import_headers(self, file_path: str) -> List[InvoiceHeader]:
        """导入发票抬头"""
        df = self.read_file(file_path)
        df = normalize_columns(df, "headers")
        headers = []

        required_cols = ["header_id", "name", "type"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"抬头文件缺少必要列: {col}")

        for _, row in df.iterrows():
            header_type_str = self._get_str_value(row, "type", "")
            if header_type_str in ["企业", "ENTERPRISE", "enterprise"]:
                header_type = InvoiceType.ENTERPRISE
            elif header_type_str in ["个人", "PERSONAL", "personal"]:
                header_type = InvoiceType.PERSONAL
            else:
                header_type = InvoiceType.UNKNOWN

            header = InvoiceHeader(
                header_id=self._get_str_value(row, "header_id"),
                name=self._get_str_value(row, "name"),
                type=header_type,
                tax_number=self._get_str_value(row, "tax_number") or None,
                address=self._get_str_value(row, "address") or None,
                phone=self._get_str_value(row, "phone") or None,
                bank_name=self._get_str_value(row, "bank_name") or None,
                bank_account=self._get_str_value(row, "bank_account") or None,
                email=self._get_str_value(row, "email") or None,
                notes=self._get_str_value(row, "notes") or None,
                is_valid=self._get_str_value(row, "is_valid", "true").lower() in ["true", "1", "yes", "是"],
            )
            headers.append(header)
            self.headers_map[header.header_id] = header

        return headers

    def import_categories(self, file_path: str) -> List[ProductCategory]:
        """导入商品类目"""
        df = self.read_file(file_path)
        df = normalize_columns(df, "categories")
        categories = []

        required_cols = ["category_id", "name"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"类目文件缺少必要列: {col}")

        for _, row in df.iterrows():
            tax_rate_value = self._get_value(row, "tax_rate")
            tax_rate = None
            if tax_rate_value is not None:
                tax_rate_str = str(tax_rate_value).strip()
                if tax_rate_str and tax_rate_str.lower() != "nan":
                    tax_rate = self._parse_decimal(tax_rate_str)
                    if tax_rate > Decimal("1"):
                        tax_rate = tax_rate / Decimal("100")

            category = ProductCategory(
                category_id=self._get_str_value(row, "category_id"),
                name=self._get_str_value(row, "name"),
                tax_rate=tax_rate,
                parent_category=self._get_str_value(row, "parent_category") or None,
                description=self._get_str_value(row, "description") or None,
            )
            categories.append(category)
            self.categories_map[category.category_id] = category

        return categories

    def import_orders(self, file_path: str) -> Tuple[List[Order], List[OrderItem]]:
        """导入订单"""
        df = self.read_file(file_path)
        df = normalize_columns(df, "orders")
        orders: Dict[str, Order] = {}
        all_items: List[OrderItem] = []

        required_cols = ["order_id", "platform", "order_date"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"订单文件缺少必要列: {col}")

        for _, row in df.iterrows():
            order_id = self._get_str_value(row, "order_id")

            header_id_value = self._get_value(row, "header_id")
            header_name_value = self._get_value(row, "header_name")
            header_type_value = self._get_value(row, "header_type")

            header_id = None
            if header_id_value is not None:
                s = self._get_str_value(row, "header_id")
                if s:
                    header_id = s

            header_name = None
            if header_name_value is not None:
                s = self._get_str_value(row, "header_name")
                if s:
                    header_name = s

            header_type_str = self._get_str_value(row, "header_type", "")
            if header_type_str in ["企业", "ENTERPRISE"]:
                header_type = InvoiceType.ENTERPRISE
            elif header_type_str in ["个人", "PERSONAL"]:
                header_type = InvoiceType.PERSONAL
            else:
                header_type = InvoiceType.UNKNOWN

            has_invoiced = self._get_str_value(row, "has_invoiced", "false").lower() in ["true", "1", "yes", "是"]
            invoice_ids_value = self._get_value(row, "invoice_ids")
            invoice_ids = []
            if invoice_ids_value is not None:
                invoice_ids_str = self._get_str_value(row, "invoice_ids")
                if invoice_ids_str:
                    invoice_ids = [x.strip() for x in invoice_ids_str.split(",")]

            order = Order(
                order_id=order_id,
                platform=self._get_str_value(row, "platform"),
                order_date=self._parse_datetime(self._get_value(row, "order_date")),
                header_id=header_id,
                header_name=header_name,
                header_type=header_type,
                total_amount=self._parse_decimal(self._get_value(row, "total_amount")),
                total_refunded_amount=self._parse_decimal(self._get_value(row, "total_refunded_amount")),
                status=OrderStatus.COMPLETED,
                has_invoiced=has_invoiced,
                invoice_ids=invoice_ids,
                notes=self._get_str_value(row, "notes") or None,
            )
            orders[order_id] = order
            self.orders_map[order_id] = order

        return list(orders.values()), all_items

    def import_order_items(self, file_path: str) -> List[OrderItem]:
        """导入订单项"""
        df = self.read_file(file_path)
        df = normalize_columns(df, "order_items")
        items: List[OrderItem] = []

        required_cols = ["item_id", "order_id", "product_name", "category_id", "category_name"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"订单项文件缺少必要列: {col}")

        for _, row in df.iterrows():
            order_id = self._get_str_value(row, "order_id")

            tax_rate_value = self._get_value(row, "tax_rate")
            tax_rate = None
            if tax_rate_value is not None:
                tax_rate_str = str(tax_rate_value).strip()
                if tax_rate_str and tax_rate_str.lower() != "nan":
                    tax_rate = self._parse_decimal(tax_rate_str)
                    if tax_rate > Decimal("1"):
                        tax_rate = tax_rate / Decimal("100")

            item = OrderItem(
                item_id=self._get_str_value(row, "item_id"),
                product_name=self._get_str_value(row, "product_name"),
                category_id=self._get_str_value(row, "category_id"),
                category_name=self._get_str_value(row, "category_name"),
                quantity=self._parse_int(self._get_value(row, "quantity", 1)),
                unit_price=self._parse_decimal(self._get_value(row, "unit_price")),
                amount=self._parse_decimal(self._get_value(row, "amount")),
                tax_rate=tax_rate,
                tax_amount=self._parse_decimal(self._get_value(row, "tax_amount")),
                refunded_quantity=self._parse_int(self._get_value(row, "refunded_quantity", 0)),
                refunded_amount=self._parse_decimal(self._get_value(row, "refunded_amount")),
                notes=self._get_str_value(row, "notes") or None,
            )
            items.append(item)

            if order_id in self.orders_map:
                order = self.orders_map[order_id]
                order.items.append(item)

        return items

    def import_refunds(self, file_path: str) -> List[RefundRecord]:
        """导入退款记录"""
        df = self.read_file(file_path)
        df = normalize_columns(df, "refunds")
        refunds: List[RefundRecord] = []

        required_cols = ["refund_id", "order_id", "refund_date", "amount"]
        for col in required_cols:
            if col not in df.columns:
                raise ValueError(f"退款文件缺少必要列: {col}")

        for _, row in df.iterrows():
            refund = RefundRecord(
                refund_id=self._get_str_value(row, "refund_id"),
                order_id=self._get_str_value(row, "order_id"),
                refund_date=self._parse_datetime(self._get_value(row, "refund_date")),
                refund_type=self._get_str_value(row, "refund_type", "部分退款"),
                amount=self._parse_decimal(self._get_value(row, "amount")),
                item_id=self._get_str_value(row, "item_id") or None,
                reason=self._get_str_value(row, "reason") or None,
                notes=self._get_str_value(row, "notes") or None,
                is_processed=self._get_str_value(row, "is_processed", "false").lower() in ["true", "1", "yes", "是"],
            )
            refunds.append(refund)
            self.refunds.append(refund)

        return refunds

    def apply_refunds_to_orders(self):
        """将退款记录应用到订单"""
        for refund in self.refunds:
            if refund.order_id in self.orders_map:
                order = self.orders_map[refund.order_id]
                order.total_refunded_amount += refund.amount

                if refund.item_id:
                    for item in order.items:
                        if item.item_id == refund.item_id:
                            item.refunded_amount += refund.amount
                            item.refunded_quantity += 1
                            break

                if order.total_refunded_amount >= order.total_amount and order.total_amount > 0:
                    order.status = OrderStatus.FULL_REFUND
                elif order.total_refunded_amount > 0:
                    order.status = OrderStatus.PARTIAL_REFUND

    def enrich_items_with_category_tax_rate(self):
        """用类目税率补充订单项税率"""
        for order in self.orders_map.values():
            for item in order.items:
                if item.tax_rate is None and item.category_id in self.categories_map:
                    category = self.categories_map[item.category_id]
                    item.tax_rate = category.tax_rate

    def enrich_orders_with_header(self, headers: Optional[List[InvoiceHeader]] = None):
        """用抬头信息补充订单"""
        header_list = headers or list(self.headers_map.values())
        header_by_name = {h.name: h for h in header_list}

        for order in self.orders_map.values():
            if order.header_id and order.header_id in self.headers_map:
                header = self.headers_map[order.header_id]
                order.header_name = header.name
                order.header_type = header.type
            elif order.header_name and order.header_name in header_by_name:
                header = header_by_name[order.header_name]
                order.header_id = header.header_id
                order.header_type = header.type

    def get_all_data(self) -> Tuple[List[Order], List[InvoiceHeader], List[ProductCategory], List[RefundRecord]]:
        """获取所有导入的数据"""
        return (
            list(self.orders_map.values()),
            list(self.headers_map.values()),
            list(self.categories_map.values()),
            self.refunds,
        )


class DataExporter:
    """数据导出器"""

    @staticmethod
    def export_to_excel(dataframes: Dict[str, pd.DataFrame], file_path: str):
        """导出为Excel"""
        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            for sheet_name, df in dataframes.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)

    @staticmethod
    def export_to_csv(dataframes: Dict[str, pd.DataFrame], output_dir: str, prefix: str = ""):
        """导出为CSV文件"""
        os.makedirs(output_dir, exist_ok=True)
        for sheet_name, df in dataframes.items():
            filename = f"{prefix}{sheet_name}.csv" if prefix else f"{sheet_name}.csv"
            file_path = os.path.join(output_dir, filename)
            df.to_csv(file_path, index=False, encoding="utf-8-sig")
