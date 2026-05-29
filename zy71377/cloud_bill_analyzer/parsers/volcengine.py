import os
import csv
import json
from typing import Dict, Any
from ..core.models import CloudProvider
from .base import BillParser


class VolcengineParser(BillParser):
    provider = CloudProvider.VOLCENGINE

    _FIELD_MARKERS = [
        "ResourceID",
        "资源ID",
        "Product",
        "产品",
        "BillingStart",
        "计费开始",
        "BillingEnd",
        "计费结束",
        "Cost",
        "费用",
        "OriginalCost",
        "原价",
        "DeductedByPackage",
        "包年包月抵扣",
        "VolcEngine",
        "火山引擎",
    ]

    _TAG_FIELDS = [
        "Tags",
        "标签",
        "ResourceTags",
        "资源标签",
    ]

    _RI_CREDIT_FIELDS = [
        "DeductedByPackage",
        "包年包月抵扣",
        "DeductedByResourcePackage",
        "资源包抵扣",
        "DiscountType",
        "优惠类型",
        "SavingType",
        "节省类型",
    ]

    _RI_CREDIT_VALUES = [
        "MonthlyPackage",
        "包年包月",
        "ResourcePackage",
        "资源包",
        "RI",
        "预留实例",
        "SavingsPlan",
        "节省计划",
    ]

    def detect(self, filepath: str) -> bool:
        if not os.path.exists(filepath):
            return False
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        if ext not in [".csv", ".xlsx", ".xls"]:
            return False

        filename = os.path.basename(filepath).lower()
        if "volcengine" in filename or "volc" in filename or "火山引擎" in filename or "huoshan" in filename:
            return True

        try:
            if ext == ".csv":
                with open(filepath, "r", encoding="utf-8-sig") as f:
                    reader = csv.reader(f)
                    header = next(reader, [])
            else:
                import pandas as pd
                df = pd.read_excel(filepath, nrows=1)
                header = list(df.columns)

            header_str = ",".join(header).lower()
            for marker in self._FIELD_MARKERS:
                if marker.lower() in header_str:
                    return True
        except Exception:
            pass

        return False

    def _get_tag_prefix(self) -> str:
        return "tag:"

    def _extract_tags(self, row: Dict[str, Any]) -> Dict[str, str]:
        tags: Dict[str, str] = {}

        for tag_field in self._TAG_FIELDS:
            value = row.get(tag_field)
            if value is None:
                continue

            if isinstance(value, str) and value.strip():
                tags.update(self._parse_tag_string(value.strip()))

        for key, value in row.items():
            if value is None:
                continue
            key_lower = key.lower()
            if key_lower.startswith("tag:") or key_lower.startswith("tag_"):
                if isinstance(value, str) and value.strip():
                    tag_name = key_lower.replace("tag:", "").replace("tag_", "")
                    tags[tag_name] = value.strip()

        for field in ["Project", "项目", "ProjectName", "项目名称", "Team", "团队", "Env", "Environment", "环境"]:
            value = row.get(field)
            if value and isinstance(value, str) and value.strip():
                tag_name = field.lower() if field.isascii() else {
                    "项目": "project",
                    "项目名称": "project",
                    "团队": "team",
                    "环境": "environment",
                }.get(field, field)
                tags[tag_name] = value.strip()

        return tags

    _TAG_KEY_MAP = {
        "项目": "project",
        "团队": "team",
        "环境": "environment",
        "env": "environment",
        "proj": "project",
    }

    def _normalize_tag_key(self, key: str) -> str:
        key_lower = key.strip().lower()
        for cn_key, en_key in self._TAG_KEY_MAP.items():
            if key == cn_key or key_lower == cn_key.lower():
                return en_key
        return key_lower

    def _parse_tag_string(self, tag_str: str) -> Dict[str, str]:
        tags: Dict[str, str] = {}

        try:
            parsed = json.loads(tag_str)
            if isinstance(parsed, dict):
                for k, v in parsed.items():
                    if isinstance(v, str) and v.strip():
                        tags[self._normalize_tag_key(k.strip())] = v.strip()
                    elif isinstance(v, (int, float)):
                        tags[self._normalize_tag_key(k.strip())] = str(v)
            elif isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        k = item.get("Key", item.get("key", item.get("TagKey", "")))
                        v = item.get("Value", item.get("value", item.get("TagValue", "")))
                        if k and v and isinstance(v, str) and v.strip():
                            tags[self._normalize_tag_key(str(k).strip())] = v.strip()
            return tags
        except (json.JSONDecodeError, ValueError):
            pass

        parts = tag_str.split(";")
        for part in parts:
            if "=" in part:
                key, value = part.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key and value:
                    tags[self._normalize_tag_key(key)] = value
            elif ":" in part:
                key, value = part.split(":", 1)
                key = key.strip()
                value = value.strip()
                if key and value:
                    tags[self._normalize_tag_key(key)] = value

        return tags

    def _detect_ri_credit(self, row: Dict[str, Any]) -> bool:
        for field in self._RI_CREDIT_FIELDS:
            value = row.get(field)
            if value is None:
                continue
            value_str = str(value).strip()
            if not value_str:
                continue
            if value_str in self._RI_CREDIT_VALUES:
                return True
            for ri_val in self._RI_CREDIT_VALUES:
                if ri_val.lower() in value_str.lower():
                    return True

        cost = row.get("Cost", row.get("费用"))
        if cost is not None and isinstance(cost, (int, float)) and cost < 0:
            return True

        deduction = row.get("Deduction", row.get("抵扣金额"))
        if deduction is not None and isinstance(deduction, (int, float)) and deduction != 0:
            return True

        return False
