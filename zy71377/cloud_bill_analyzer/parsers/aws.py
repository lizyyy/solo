import os
import csv
from typing import Dict, Any
from ..core.models import CloudProvider
from .base import BillParser


class AWSParser(BillParser):
    provider = CloudProvider.AWS

    _AWS_FIELD_MARKERS = [
        "lineItem/UsageAccountId",
        "lineItem/ResourceId",
        "lineItem/ProductCode",
        "lineItem/UsageStartDate",
        "lineItem/UnblendedCost",
        "identity/LineItemType",
        "reservation/ReservationARN",
    ]

    _TAG_PREFIXES = ["user:", "aws:"]

    _RI_CREDIT_FIELDS = [
        "reservation/ReservationARN",
        "reservation/UnusedReservation",
        "savingsPlan/SavingsPlanARN",
    ]

    _RI_CREDIT_VALUES = [
        "DiscountedUsage",
        "Usage",
        "RIFee",
        "ReservationPurchaseRecommendation",
    ]

    def detect(self, filepath: str) -> bool:
        if not os.path.exists(filepath):
            return False
        _, ext = os.path.splitext(filepath)
        ext = ext.lower()
        if ext not in [".csv", ".xlsx", ".xls"]:
            return False

        filename = os.path.basename(filepath).lower()
        if "aws" in filename or "cur" in filename:
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
            for marker in self._AWS_FIELD_MARKERS:
                if marker.lower() in header_str:
                    return True
        except Exception:
            pass

        return False

    def _get_tag_prefix(self) -> str:
        return "user:"

    def _extract_tags(self, row: Dict[str, Any]) -> Dict[str, str]:
        tags: Dict[str, str] = {}
        for key, value in row.items():
            if value is None:
                continue
            for prefix in self._TAG_PREFIXES:
                if key.startswith(prefix):
                    tag_name = key[len(prefix):]
                    if isinstance(value, str) and value.strip():
                        tags[tag_name] = value.strip()
                    break
        return tags

    def _detect_ri_credit(self, row: Dict[str, Any]) -> bool:
        line_item_type = str(row.get("identity/LineItemType", "")).strip()
        if line_item_type in self._RI_CREDIT_VALUES:
            return True

        for field in self._RI_CREDIT_FIELDS:
            value = row.get(field)
            if value is not None and str(value).strip():
                return True

        return False
