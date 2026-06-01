from typing import Optional, Dict, Tuple
from ..models.bond import BondRecord, CalculationResult, ProcessStatus
from ..models.params import CalculationParams
from .unit_converter import UnitConverter


class BondCalculator:
    def __init__(self, params: CalculationParams):
        self.params = params
        self.unit_converter = UnitConverter(params)

    def calculate_conversion_value(self, face_value: float, conversion_price: float, stock_price: float) -> Tuple[float, str]:
        if conversion_price == 0:
            raise ValueError("转股价格不能为0，会导致除零错误")

        conversion_value = (face_value / conversion_price) * stock_price
        formula = f"转股价值 = 面值({face_value}元) ÷ 转股价({conversion_price}元) × 正股价({stock_price}元) = {conversion_value:.4f}元"
        return conversion_value, formula

    def calculate_premium_rate(self, bond_price: float, conversion_value: float) -> Tuple[float, str]:
        if conversion_value == 0:
            raise ValueError("转股价值为0，无法计算溢价率")

        premium_rate = ((bond_price - conversion_value) / conversion_value) * 100
        formula = f"转股溢价率 = (转债价({bond_price}元) - 转股价值({conversion_value:.4f}元)) ÷ 转股价值({conversion_value:.4f}元) × 100% = {premium_rate:.4f}%"
        return premium_rate, formula

    def calculate(self, record: BondRecord) -> CalculationResult:
        result = CalculationResult(
            bond_code=record.bond_code,
            bond_name=record.bond_name,
            status=ProcessStatus.FAILED,
            original_source=record.original_source,
            raw_data=record.raw_data,
            remark=record.remark,
            line_number=record.line_number,
        )

        try:
            unit_results = self.unit_converter.normalize_price_units(record)
            result.warnings.extend(unit_results["warnings"])

            bond_price = unit_results["bond_price"]
            conversion_price = unit_results["conversion_price"]
            stock_price = unit_results["stock_price"]
            face_value = unit_results["face_value"]

            missing_fields = []
            if bond_price is None:
                missing_fields.append("转债价格")
            if conversion_price is None:
                missing_fields.append("转股价格")
            if stock_price is None:
                missing_fields.append("正股价格")
            if face_value is None:
                missing_fields.append("面值")

            if missing_fields:
                result.error_reason = f"缺少必要字段: {', '.join(missing_fields)}，无法进行计算"
                result.status = ProcessStatus.FAILED
                return result

            if conversion_price <= 0:
                result.error_reason = f"转股价格({conversion_price})必须大于0"
                result.status = ProcessStatus.FAILED
                return result

            if face_value <= 0:
                result.error_reason = f"面值({face_value})必须大于0"
                result.status = ProcessStatus.FAILED
                return result

            result.units_used = {
                "bond_price": unit_results.get("bond_price_unit", "元"),
                "conversion_price": unit_results.get("conversion_price_unit", "元"),
                "stock_price": unit_results.get("stock_price_unit", "元"),
                "face_value": unit_results.get("face_value_unit", "元"),
            }

            result.boundary_values = {
                "premium_rate_low": self.params.boundary_premium_rate_low,
                "premium_rate_high": self.params.boundary_premium_rate_high,
            }

            conversion_value, conv_formula = self.calculate_conversion_value(
                face_value, conversion_price, stock_price
            )
            result.conversion_value = round(conversion_value, 4)
            result.formulas["conversion_value"] = conv_formula

            premium_rate, premium_formula = self.calculate_premium_rate(
                bond_price, conversion_value
            )
            result.conversion_premium_rate = round(premium_rate, 4)
            result.formulas["premium_rate"] = premium_formula

            if abs(premium_rate) < 0.01:
                result.warnings.append("转股溢价率接近0，注意可能存在的计算精度问题")

            result.status = ProcessStatus.SUCCESS

        except Exception as e:
            result.error_reason = f"计算过程中发生异常: {str(e)}"
            result.status = ProcessStatus.FAILED

        return result
