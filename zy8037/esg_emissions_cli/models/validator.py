"""
Input data validation
"""

from typing import Dict, List, Any


class ValidationError(Exception):
    pass


class InputValidator:
    REQUIRED_BILL_FIELDS = ['site', 'month', 'energy_type', 'consumption', 'bill_id']
    REQUIRED_ORG_FIELDS = ['sites']
    REQUIRED_FACTOR_FIELDS = ['energy_type', 'factor_value', 'unit', 'scope']

    def validate_all(self, bills, org, factors, adjustments):
        self.validate_energy_bills(bills)
        self.validate_org_boundary(org)
        self.validate_emission_factors(factors)
        self.validate_adjustments(adjustments)

    def validate_energy_bills(self, bills: List[Dict]) -> None:
        if not bills:
            raise ValidationError("能源账单不能为空")

        for i, bill in enumerate(bills):
            for field in self.REQUIRED_BILL_FIELDS:
                if field not in bill or str(bill.get(field, '')).strip() == '':
                    raise ValidationError(f"账单第 {i+1} 行缺少必填字段: {field}")

            try:
                float(bill['consumption'])
            except (ValueError, KeyError):
                raise ValidationError(f"账单第 {i+1} 行 consumption 必须是数字")

    def validate_org_boundary(self, org: Dict) -> None:
        if not org:
            raise ValidationError("组织边界配置不能为空")

        if 'sites' not in org:
            raise ValidationError("组织边界必须包含 sites 字段")

        if not isinstance(org['sites'], dict):
            raise ValidationError("sites 必须是字典结构")

    def validate_emission_factors(self, factors: List[Dict]) -> None:
        if not factors:
            raise ValidationError("排放因子不能为空")

        for i, factor in enumerate(factors):
            for field in self.REQUIRED_FACTOR_FIELDS:
                if field not in factor:
                    raise ValidationError(f"因子第 {i+1} 行缺少必填字段: {field}")

    def validate_adjustments(self, adjustments: List[Dict]) -> None:
        required = ['site', 'month', 'energy_type', 'amount']
        for i, adj in enumerate(adjustments):
            for field in required:
                if field not in adj:
                    raise ValidationError(f"调整项第 {i+1} 行缺少必填字段: {field}")
