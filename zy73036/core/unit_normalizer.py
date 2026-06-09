import json
import os
import re
from typing import Tuple, Optional, Dict, Any
from .models import ProcessingStatus


class UnitNormalizer:
    def __init__(self, config_path: str = None):
        if config_path is None:
            base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            config_path = os.path.join(base, "config", "system_config.json")
        with open(config_path, "r", encoding="utf-8") as f:
            self.config = json.load(f)
        self._build_unit_index()

    def _build_unit_index(self):
        self.str_to_standard = {}
        for std_name, aliases in self.config["known_units"].items():
            for alias in aliases:
                self.str_to_standard[alias.strip().lower()] = std_name

    def detect_unit(self, unit_str: str, weight_str: str = "") -> Tuple[Optional[str], bool, str]:
        candidates = []
        if unit_str:
            u = unit_str.strip()
            std = self.str_to_standard.get(u.lower())
            if std:
                candidates.append((std, 1.0))
        if weight_str:
            m = re.search(r"([0-9]*\.?[0-9]+)\s*(kg|g|斤|磅|lb|jin|公斤|千克|克)",
                          weight_str.lower())
            if m:
                std = self.str_to_standard.get(m.group(2))
                if std:
                    candidates.append((std, float(m.group(1))))
        embedded = re.search(r"(kg|g|斤|磅|lb|jin|公斤|千克|克)",
                             f"{weight_str} {unit_str}".lower())
        if embedded and not candidates:
            std = self.str_to_standard.get(embedded.group(1))
            if std:
                candidates.append((std, 1.0))
        if len(candidates) == 1:
            return candidates[0][0], True, ""
        if len(candidates) > 1:
            units_found = list({c[0] for c in candidates})
            return None, False, f"检测到多个冲突单位: {', '.join(units_found)}"
        return None, False, "未识别单位，缺失单位标注"

    def extract_numeric(self, weight_str: str) -> Tuple[Optional[float], str]:
        if weight_str is None:
            return None, "空值"
        if isinstance(weight_str, (int, float)):
            return float(weight_str), ""
        s = str(weight_str).strip()
        if not s:
            return None, "空字符串"
        clean = re.sub(r"[，,\s]+", "", s)
        m = re.match(r"([0-9]+(?:\.[0-9]+)?)", clean)
        if not m:
            return None, f"无法提取数值: '{weight_str}'"
        try:
            return float(m.group(1)), ""
        except:
            return None, f"数值解析失败: '{weight_str}'"

    def convert_to_kg(self, value: float, std_unit: str) -> Tuple[Optional[float], str]:
        conv = self.config["unit_conversion"]
        if std_unit == "kg":
            return value, ""
        if std_unit == "g":
            return value / conv["kg_to_g"], ""
        if std_unit == "jin":
            return value * conv["jin_to_kg"], ""
        if std_unit == "lb":
            return value * conv["lb_to_kg"], ""
        return None, f"不支持的单位换算: {std_unit}"

    def full_normalize(self, raw_weight_value: str, raw_unit_value: str = "") -> Dict[str, Any]:
        result = {
            "weight_kg": None,
            "std_unit": None,
            "status": ProcessingStatus.PENDING,
            "unit_normalized": False,
            "block_reason": "",
            "next_step": "",
            "responsible": None,
        }
        num_val, num_err = self.extract_numeric(raw_weight_value)
        if num_val is None:
            result["status"] = ProcessingStatus.FIELD_MISSING
            result["block_reason"] = f"体重量无法解析: {num_err}"
            result["next_step"] = self.config["responsible_roles"]["missing_field"]["instruction"]
            result["responsible"] = self.config["responsible_roles"]["missing_field"]
            return result
        std_unit, ok, unit_msg = self.detect_unit(raw_unit_value, raw_weight_value)
        if not ok:
            result["status"] = ProcessingStatus.UNIT_CONFIRM_REQUIRED
            result["block_reason"] = unit_msg
            result["next_step"] = self.config["responsible_roles"]["unit_mismatch"]["instruction"]
            result["responsible"] = self.config["responsible_roles"]["unit_mismatch"]
            result["raw_numeric"] = num_val
            return result
        kg_val, conv_err = self.convert_to_kg(num_val, std_unit)
        if kg_val is None:
            result["status"] = ProcessingStatus.UNIT_CONFIRM_REQUIRED
            result["block_reason"] = conv_err
            result["next_step"] = self.config["responsible_roles"]["unit_mismatch"]["instruction"]
            result["responsible"] = self.config["responsible_roles"]["unit_mismatch"]
            return result
        result["weight_kg"] = round(kg_val, 4)
        result["std_unit"] = std_unit
        result["unit_normalized"] = True
        result["status"] = ProcessingStatus.CONFIRMED
        return result
