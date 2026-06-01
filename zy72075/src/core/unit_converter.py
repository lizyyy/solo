from typing import Optional, Tuple
from ..models.params import CalculationParams


class UnitConverter:
    def __init__(self, params: CalculationParams):
        self.params = params

    def normalize_unit(self, value: Optional[float], unit: Optional[str], target_unit: str = "元") -> Tuple[Optional[float], Optional[str], str]:
        if value is None:
            return None, None, "值为空，跳过单位转换"

        if unit is None or unit.strip() == "":
            return value, target_unit, f"未指定单位，默认按{target_unit}处理"

        unit = unit.strip()

        if unit == target_unit:
            return value, target_unit, f"单位已是{target_unit}，无需转换"

        conversion_table = self.params.unit_conversion
        if unit not in conversion_table:
            return value, unit, f"未知单位[{unit}]，无法转换，保留原值"

        if target_unit not in conversion_table[unit]:
            return value, unit, f"不支持从[{unit}]转换到[{target_unit}]，保留原值"

        factor = conversion_table[unit][target_unit]
        converted_value = value * factor
        return converted_value, target_unit, f"从[{unit}]转换到[{target_unit}]，乘以{factor}"

    def normalize_price_units(self, bond_record) -> dict:
        results = {}
        warnings = []

        bond_price, bond_unit, msg = self.normalize_unit(
            bond_record.bond_price, bond_record.bond_price_unit, "元"
        )
        results["bond_price"] = bond_price
        results["bond_price_unit"] = bond_unit
        if "无法转换" in msg or "默认按" in msg:
            warnings.append(f"转债价格: {msg}")

        conv_price, conv_unit, msg = self.normalize_unit(
            bond_record.conversion_price, bond_record.conversion_price_unit, "元"
        )
        results["conversion_price"] = conv_price
        results["conversion_price_unit"] = conv_unit
        if "无法转换" in msg or "默认按" in msg:
            warnings.append(f"转股价格: {msg}")

        stock_price, stock_unit, msg = self.normalize_unit(
            bond_record.stock_price, bond_record.stock_price_unit, "元"
        )
        results["stock_price"] = stock_price
        results["stock_price_unit"] = stock_unit
        if "无法转换" in msg or "默认按" in msg:
            warnings.append(f"正股价格: {msg}")

        face_value, face_unit, msg = self.normalize_unit(
            bond_record.face_value, bond_record.face_value_unit, "元"
        )
        results["face_value"] = face_value
        results["face_value_unit"] = face_unit
        if "无法转换" in msg or "默认按" in msg:
            warnings.append(f"面值: {msg}")

        results["warnings"] = warnings
        return results
