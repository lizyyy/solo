import os
import json
from typing import Dict, Any


DEFAULT_CONFIG = {
    "data_dir": ".salary_data",
    "months": ["2024-01", "2024-02", "2024-03"],
    "rules": {
        "allowance_limits": {
            "transportation": 1000,
            "housing": 5000,
            "meal": 800,
            "communication": 300,
            "overtime_meal": 200
        },
        "deduction_types": [
            "social_insurance",
            "housing_fund",
            "tax",
            "absent_deduction",
            "late_deduction",
            "loan_repayment",
            "damage_compensation"
        ],
        "bank_retry_max": 3
    },
    "employee_types": {
        "full_time": {
            "name": "正式员工",
            "tax_base": 5000,
            "social_insurance_rate": 0.105,
            "housing_fund_rate": 0.12
        },
        "part_time": {
            "name": "实习生",
            "tax_base": 800,
            "social_insurance_rate": 0,
            "housing_fund_rate": 0
        },
        "terminated": {
            "name": "离职员工",
            "tax_base": 5000,
            "social_insurance_rate": 0.105,
            "housing_fund_rate": 0.12
        }
    }
}


class ConfigManager:
    def __init__(self, config_path: str = "salary_checker.json"):
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if os.path.exists(self.config_path):
            with open(self.config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return DEFAULT_CONFIG.copy()

    def save(self):
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)

    def get_data_dir(self) -> str:
        return self.config.get("data_dir", ".salary_data")

    def get_allowance_limit(self, allowance_type: str) -> float:
        limits = self.config.get("rules", {}).get("allowance_limits", {})
        return limits.get(allowance_type, float("inf"))

    def is_valid_deduction_type(self, deduction_type: str) -> bool:
        types = self.config.get("rules", {}).get("deduction_types", [])
        return deduction_type in types

    def get_employee_type_config(self, emp_type: str) -> Dict[str, Any]:
        return self.config.get("employee_types", {}).get(emp_type, {})

    def get_bank_retry_max(self) -> int:
        return self.config.get("rules", {}).get("bank_retry_max", 3)
