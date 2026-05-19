from datetime import datetime
from typing import Optional, Tuple, Any
import re


class DataValidator:
    @staticmethod
    def validate_order_number(order_number: str) -> Tuple[bool, Optional[str]]:
        if not order_number or not order_number.strip():
            return False, "订单号不能为空"
        if len(order_number) > 50:
            return False, "订单号长度不能超过50个字符"
        return True, None

    @staticmethod
    def validate_supplier_name(supplier_name: str) -> Tuple[bool, Optional[str]]:
        if not supplier_name or not supplier_name.strip():
            return False, "供应商名称不能为空"
        if len(supplier_name) > 100:
            return False, "供应商名称长度不能超过100个字符"
        return True, None

    @staticmethod
    def validate_product_code(product_code: str) -> Tuple[bool, Optional[str]]:
        if not product_code or not product_code.strip():
            return False, "产品编码不能为空"
        if len(product_code) > 50:
            return False, "产品编码长度不能超过50个字符"
        return True, None

    @staticmethod
    def validate_product_name(product_name: str) -> Tuple[bool, Optional[str]]:
        if not product_name or not product_name.strip():
            return False, "产品名称不能为空"
        if len(product_name) > 100:
            return False, "产品名称长度不能超过100个字符"
        return True, None

    @staticmethod
    def validate_batch_number(batch_number: str) -> Tuple[bool, Optional[str]]:
        if not batch_number or not batch_number.strip():
            return False, "批号不能为空"
        if len(batch_number) > 50:
            return False, "批号长度不能超过50个字符"
        return True, None

    @staticmethod
    def validate_quantity(quantity: Any) -> Tuple[bool, Optional[str], Optional[int]]:
        if quantity is None:
            return False, "数量不能为空", None
        try:
            qty = int(quantity)
            if qty <= 0:
                return False, "数量必须大于0", None
            return True, None, qty
        except (ValueError, TypeError):
            return False, "数量必须是有效的整数", None

    @staticmethod
    def validate_date(date_str: str, field_name: str = "日期") -> Tuple[bool, Optional[str], Optional[datetime]]:
        if not date_str or not str(date_str).strip():
            return False, f"{field_name}不能为空", None
        date_formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y",
            "%d/%m/%Y",
        ]
        for fmt in date_formats:
            try:
                parsed_date = datetime.strptime(str(date_str).strip(), fmt)
                return True, None, parsed_date
            except ValueError:
                continue
        return False, f"{field_name}格式不正确，支持的格式: YYYY-MM-DD, YYYY-MM-DD HH:MM:SS", None

    @staticmethod
    def validate_temperature(temp: Any) -> Tuple[bool, Optional[str], Optional[float]]:
        if temp is None:
            return False, "温度不能为空", None
        try:
            temperature = float(temp)
            if temperature < -50 or temperature > 50:
                return False, "温度超出合理范围（-50°C 到 50°C）", temperature
            return True, None, temperature
        except (ValueError, TypeError):
            return False, "温度必须是有效的数字", None

    @staticmethod
    def validate_humidity(humidity: Any) -> Tuple[bool, Optional[str], Optional[float]]:
        if humidity is None or str(humidity).strip() == "":
            return True, None, None
        try:
            hum = float(humidity)
            if hum < 0 or hum > 100:
                return False, "湿度超出合理范围（0% 到 100%）", hum
            return True, None, hum
        except (ValueError, TypeError):
            return False, "湿度必须是有效的数字", None

    @staticmethod
    def validate_expiry_date(expiry_date: datetime, manufacture_date: Optional[datetime] = None) -> Tuple[bool, Optional[str]]:
        if expiry_date < datetime.now():
            return False, "产品已过期"
        if manufacture_date and expiry_date < manufacture_date:
            return False, "有效期不能早于生产日期"
        return True, None

    @staticmethod
    def suggest_fix(error_message: str, field_name: str, value: Any) -> str:
        if "不能为空" in error_message:
            return f"请在{field_name}字段填写有效值"
        if "格式不正确" in error_message:
            if "日期" in field_name:
                return f"建议使用 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS 格式，当前值: {value}"
            return f"请检查{field_name}字段的格式"
        if "长度" in error_message:
            return f"请缩短{field_name}字段的内容"
        if "范围" in error_message:
            return f"请检查{field_name}字段的取值范围，当前值: {value}"
        if "整数" in error_message or "数字" in error_message:
            return f"请确保{field_name}字段填写有效的数值，当前值: {value}"
        return f"请检查{field_name}字段数据，当前值: {value}"
