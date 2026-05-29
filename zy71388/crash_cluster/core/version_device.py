import re
from typing import Optional, Dict


class VersionBucketer:
    PATTERN = re.compile(r'^(\d+)\.(\d+)(?:[.\-](\w+))?')

    @staticmethod
    def bucket(version: Optional[str]) -> str:
        if not version:
            return "unknown"
        version = version.strip()
        if not version:
            return "unknown"

        m = VersionBucketer.PATTERN.match(version)
        if not m:
            return "unknown"

        major = m.group(1)
        minor = m.group(2)
        return f"{major}.{minor}.x"

    @staticmethod
    def is_misclassified(report_version: Optional[str], cluster_version: Optional[str]) -> bool:
        if not report_version or not cluster_version:
            return False
        rb = VersionBucketer.bucket(report_version)
        cb = VersionBucketer.bucket(cluster_version)
        return rb != cb and rb != "unknown" and cb != "unknown"


DEVICE_MAP = {
    "iPhone14,2": "iPhone 13 Pro",
    "iPhone14,3": "iPhone 13 Pro Max",
    "iPhone14,4": "iPhone 13 mini",
    "iPhone14,5": "iPhone 13",
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone15,4": "iPhone 14",
    "iPhone15,5": "iPhone 14 Plus",
    "iPhone16,1": "iPhone 15 Pro",
    "iPhone16,2": "iPhone 15 Pro Max",
    "iPhone16,3": "iPhone 15",
    "iPhone16,4": "iPhone 15 Plus",
    "iPhone17,1": "iPhone 16 Pro",
    "iPhone17,2": "iPhone 16 Pro Max",
    "iPad13,1": "iPad Air 4",
    "iPad13,2": "iPad Air 4",
    "iPad14,1": "iPad Pro 11-inch 3",
    "iPad14,2": "iPad Pro 11-inch 3",
}

DEVICE_BRAND_PATTERNS = [
    (re.compile(r'^iPhone', re.IGNORECASE), "Apple"),
    (re.compile(r'^iPad', re.IGNORECASE), "Apple"),
    (re.compile(r'^SM-', re.IGNORECASE), "Samsung"),
    (re.compile(r'^Pixel', re.IGNORECASE), "Google"),
    (re.compile(r'^Nexus', re.IGNORECASE), "Google"),
    (re.compile(r'^HUAWEI|^ATH|^ALP|^VOG|^ELE|^TNY|^ANA|^NOH', re.IGNORECASE), "Huawei"),
    (re.compile(r'^Xiaomi|^Redmi|^MI ', re.IGNORECASE), "Xiaomi"),
    (re.compile(r'^OPPO|^CPH|^RMX|^A5|^A9|^R\d', re.IGNORECASE), "OPPO"),
    (re.compile(r'^vivo|^V\d{4}', re.IGNORECASE), "vivo"),
]

DEVICE_FAMILY_MAP = {
    "Apple": ["iPhone", "iPad"],
    "Samsung": ["Galaxy S", "Galaxy Note", "Galaxy A", "Galaxy Z"],
    "Google": ["Pixel"],
    "Huawei": ["Mate", "P", "Nova"],
    "Xiaomi": ["Mi", "Redmi"],
    "OPPO": ["Reno", "Find", "A"],
    "vivo": ["X", "V", "Y"],
}


class DeviceNormalizer:
    @staticmethod
    def friendly_name(model: Optional[str]) -> str:
        if not model:
            return "Unknown"
        model = model.strip()
        return DEVICE_MAP.get(model, model)

    @staticmethod
    def brand(model: Optional[str]) -> str:
        if not model:
            return "Unknown"
        model = model.strip()
        for pat, brand in DEVICE_BRAND_PATTERNS:
            if pat.match(model):
                return brand
        return "Other"

    @staticmethod
    def family(model: Optional[str]) -> str:
        if not model:
            return "Unknown"
        model = model.strip()
        friendly = DeviceNormalizer.friendly_name(model)
        brand = DeviceNormalizer.brand(model)
        families = DEVICE_FAMILY_MAP.get(brand, [])
        for f in families:
            if f.lower() in friendly.lower():
                return f"{brand} {f}"
        return brand
