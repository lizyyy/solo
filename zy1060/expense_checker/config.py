import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

from .models import Severity


@dataclass
class RuleConfig:
    enabled: bool = True
    severity: Severity = Severity.ERROR
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class CheckerConfig:
    allowed_expense_types: list[str] = field(default_factory=lambda: [
        "差旅费", "办公费", "招待费", "交通费", "通讯费",
        "设备采购", "服务费", "咨询费", "会议费", "培训费",
        "广告费", "租赁费", "物业费", "水电费", "其他"
    ])
    
    max_single_amount: float = 10000.0
    reimbursement_days: int = 90
    csv_filename: str = "expenses.csv"
    
    required_attachment_types: dict[str, list[str]] = field(default_factory=lambda: {
        "设备采购": ["发票", "合同"],
        "服务费": ["发票", "合同", "验收单"],
        "咨询费": ["发票", "合同", "验收单"],
        "会议费": ["发票", "会议纪要"],
        "培训费": ["发票", "培训通知"],
        "差旅费": ["发票", "出差审批单"],
        "招待费": ["发票", "招待清单"],
    })
    
    filename_patterns: dict[str, str] = field(default_factory=lambda: {
        "invoice": r"^(发票|invoice|fp)_?\d+",
        "payment": r"^(付款|payment|pay)_?\d+",
        "contract": r"^(合同|contract|ht)_?\d+",
        "acceptance": r"^(验收|acceptance|ys)_?\d+",
    })
    
    rules: dict[str, RuleConfig] = field(default_factory=dict)
    
    def __post_init__(self):
        if not self.rules:
            self.rules = self._get_default_rules()
    
    @staticmethod
    def _get_default_rules() -> dict[str, RuleConfig]:
        return {
            "missing_attachment": RuleConfig(enabled=True, severity=Severity.ERROR),
            "duplicate_invoice": RuleConfig(enabled=True, severity=Severity.ERROR),
            "amount_mismatch": RuleConfig(enabled=True, severity=Severity.ERROR),
            "date_expired": RuleConfig(enabled=True, severity=Severity.WARNING),
            "missing_contract": RuleConfig(enabled=True, severity=Severity.ERROR),
            "missing_acceptance": RuleConfig(enabled=True, severity=Severity.ERROR),
            "invalid_filename": RuleConfig(enabled=True, severity=Severity.WARNING),
            "invalid_expense_type": RuleConfig(enabled=True, severity=Severity.ERROR),
            "amount_exceed_limit": RuleConfig(enabled=True, severity=Severity.WARNING),
        }
    
    def is_rule_enabled(self, rule_name: str) -> bool:
        if rule_name not in self.rules:
            return False
        return self.rules[rule_name].enabled
    
    def get_rule_severity(self, rule_name: str) -> Severity:
        if rule_name not in self.rules:
            return Severity.ERROR
        return self.rules[rule_name].severity
    
    def get_rule_param(self, rule_name: str, param_name: str, default: Any = None) -> Any:
        if rule_name not in self.rules:
            return default
        return self.rules[rule_name].params.get(param_name, default)


def load_config(config_path: Optional[str] = None) -> CheckerConfig:
    config = CheckerConfig()
    
    search_paths = []
    if config_path:
        search_paths.append(Path(config_path))
    
    search_paths.extend([
        Path("./expense-checker.yaml"),
        Path("./expense-checker.yml"),
        Path("./.expense-checker.yaml"),
        Path.home() / ".config" / "expense-checker" / "config.yaml",
    ])
    
    for path in search_paths:
        if path.exists() and path.is_file():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    yaml_data = yaml.safe_load(f) or {}
                config = _merge_config(config, yaml_data)
                break
            except Exception:
                continue
    
    return config


def _merge_config(config: CheckerConfig, data: dict) -> CheckerConfig:
    if "allowed_expense_types" in data:
        config.allowed_expense_types = data["allowed_expense_types"]
    
    if "max_single_amount" in data:
        config.max_single_amount = float(data["max_single_amount"])
    
    if "reimbursement_days" in data:
        config.reimbursement_days = int(data["reimbursement_days"])
    
    if "csv_filename" in data:
        config.csv_filename = data["csv_filename"]
    
    if "required_attachment_types" in data:
        config.required_attachment_types.update(data["required_attachment_types"])
    
    if "filename_patterns" in data:
        config.filename_patterns.update(data["filename_patterns"])
    
    if "rules" in data:
        for rule_name, rule_data in data["rules"].items():
            if rule_name in config.rules:
                if isinstance(rule_data, bool):
                    config.rules[rule_name].enabled = rule_data
                elif isinstance(rule_data, dict):
                    if "enabled" in rule_data:
                        config.rules[rule_name].enabled = bool(rule_data["enabled"])
                    if "severity" in rule_data:
                        severity_str = rule_data["severity"].lower()
                        if severity_str == "error":
                            config.rules[rule_name].severity = Severity.ERROR
                        elif severity_str == "warning":
                            config.rules[rule_name].severity = Severity.WARNING
                        elif severity_str == "info":
                            config.rules[rule_name].severity = Severity.INFO
                    if "params" in rule_data:
                        config.rules[rule_name].params.update(rule_data["params"])
    
    return config


def generate_sample_config() -> str:
    sample = """# 报销材料包体检工具配置文件
# 此文件用于自定义校验规则和参数

# 允许的费用类型列表
allowed_expense_types:
  - 差旅费
  - 办公费
  - 招待费
  - 交通费
  - 通讯费
  - 设备采购
  - 服务费
  - 咨询费
  - 会议费
  - 培训费
  - 广告费
  - 租赁费
  - 物业费
  - 水电费
  - 其他

# 单笔金额上限（元），超过此金额会触发警告
max_single_amount: 10000.0

# 报销截止天数（从发票日期到报销日期的最大允许天数）
reimbursement_days: 90

# 报销明细CSV文件名
csv_filename: "expenses.csv"

# 不同费用类型所需的附件类型
required_attachment_types:
  设备采购: ["发票", "合同"]
  服务费: ["发票", "合同", "验收单"]
  咨询费: ["发票", "合同", "验收单"]
  会议费: ["发票", "会议纪要"]
  培训费: ["发票", "培训通知"]
  差旅费: ["发票", "出差审批单"]
  招待费: ["发票", "招待清单"]

# 文件名匹配规则（正则表达式）
filename_patterns:
  invoice: "^(发票|invoice|fp)_?\\d+"
  payment: "^(付款|payment|pay)_?\\d+"
  contract: "^(合同|contract|ht)_?\\d+"
  acceptance: "^(验收|acceptance|ys)_?\\d+"

# 校验规则开关和严重程度
# severity: error（错误，必须修复）| warning（警告，建议检查）| info（提示）
rules:
  # 缺少附件
  missing_attachment:
    enabled: true
    severity: error
  
  # 重复发票号
  duplicate_invoice:
    enabled: true
    severity: error
  
  # 金额合计不一致
  amount_mismatch:
    enabled: true
    severity: error
  
  # 日期超期
  date_expired:
    enabled: true
    severity: warning
  
  # 缺少合同
  missing_contract:
    enabled: true
    severity: error
  
  # 缺少验收单
  missing_acceptance:
    enabled: true
    severity: error
  
  # 文件名不规范
  invalid_filename:
    enabled: true
    severity: warning
  
  # 无效的费用类型
  invalid_expense_type:
    enabled: true
    severity: error
  
  # 单笔金额超限
  amount_exceed_limit:
    enabled: true
    severity: warning
"""
    return sample
