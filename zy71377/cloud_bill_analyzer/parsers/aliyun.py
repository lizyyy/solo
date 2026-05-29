import os
import csv
import json
from typing import Dict, Any
from ..core.models import CloudProvider
from .base import BillParser


class AliyunParser(BillParser):
    provider = CloudProvider.ALIYUN

    _FIELD_MARKERS = [
        "实例ID",
        "ResourceID",
        "资源ID",
        "产品代码",
        "ProductCode",
        "计费开始时间",
        "StartTime",
        "应付金额",
        "PretaxGrossAmount",
        "优惠后金额",
        "PretaxAmount",
        "抵扣资源包",
        "DeductedByResourcePackage",
    ]

    _TAG_FIELDS = [
        "标签",
        "Tags",
        "资源标签",
        "ResourceTags",
    ]

    _RI_CREDIT_FIELDS = [
        "抵扣资源包",
        "DeductedByResourcePackage",
        "包年包月抵扣",
        "DeductedByMonthlyPackage",
        "优惠类型",
        "DiscountType",
    ]

    _RI_CREDIT_VALUES = [
        "包年包月",
        "资源包",
        "MonthlyPackage",
        "ResourcePackage",
        "抵扣",
    ]

    def detect(self, filepath: str) -> bool:
        if not os.path.exists(filepath):
            return False
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        if ext not in [".csv", ".xlsx", ".xls"]:
            return False

        filename = os.path.basename(filepath).lower()
        if "aliyun" in filename or "alibaba" in filename or "阿里云" in filename:
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
        return ""

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
            if "tag" in key_lower and key not in self._TAG_FIELDS:
                if isinstance(value, str) and value.strip():
                    tag_name = key_lower.replace("tag:", "").replace("tag_", "")
                    tags[tag_name] = value.strip()

        for field in ["项目", "Project", "团队", "Team", "环境", "Environment"]:
            value = row.get(field)
            if value and isinstance(value, str) and value.strip():
                tag_name = field.lower() if field.isascii() else {"项目": "project", "团队": "team", "环境": "environment"}.get(field, field)
                tags[tag_name] = value.strip()

        return tags

    _TAG_KEY_MAP = {
        "项目": "project",
        "团队": "team",
        "环境": "environment",
        "服务": "service",
        "产品": "product",
        "env": "environment",
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
            elif isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        k = item.get("Key", item.get("key", ""))
                        v = item.get("Value", item.get("value", ""))
                        if k and v and isinstance(v, str) and v.strip():
                            tags[self._normalize_tag_key(str(k).strip())] = v.strip()
            return tags
        except (json.JSONDecodeError, ValueError):
            pass

        parts = tag_str.split(",")
        for part in parts:
            if ":" in part:
                key, value = part.split(":", 1)
                key = key.strip()
                value = value.strip()
                if key and value:
                    tags[self._normalize_tag_key(key)] = value
            elif "：" in part:
                key, value = part.split("：", 1)
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
                if ri_val in value_str:
                    return True

        cost = row.get("PretaxAmount", row.get("优惠后金额"))
        if cost is not None and isinstance(cost, (int, float)) and cost < 0:
            return True

        return False
