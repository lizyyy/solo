import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
import hashlib
import re

class ValidationStatus(Enum):
    PASS = "通过"
    FAIL = "不通过"
    WARN = "警告"
    SKIP = "跳过"

@dataclass
class ValidationIssue:
    row_index: int
    machine_id: str
    channel_id: str
    issue_type: str
    description: str
    severity: ValidationStatus

@dataclass
class ValidationResult:
    file_name: str
    success: bool
    total_rows: int = 0
    passed_count: int = 0
    failed_count: int = 0
    warning_count: int = 0
    skipped_count: int = 0
    issues: List[ValidationIssue] = field(default_factory=list)
    combination_products: List[Dict] = field(default_factory=list)
    temp_replacements: List[Dict] = field(default_factory=list)
    rerun_items: List[Dict] = field(default_factory=list)
    error_message: Optional[str] = None
    processed_at: str = ""
    file_hash: str = ""

class ChannelValidator:
    def __init__(self):
        self.channel_pattern = re.compile(r'^[A-Z]\d{2}$')
        self.machine_pattern = re.compile(r'^VM\d{6}$')
        
    def validate_machine_id(self, machine_id: str, row_idx: int) -> Optional[ValidationIssue]:
        if pd.isna(machine_id) or str(machine_id).strip() == "":
            return ValidationIssue(
                row_index=row_idx,
                machine_id="",
                channel_id="",
                issue_type="售货机编号缺失",
                description="售货机编号不能为空",
                severity=ValidationStatus.FAIL
            )
        machine_str = str(machine_id).strip()
        if not self.machine_pattern.match(machine_str):
            return ValidationIssue(
                row_index=row_idx,
                machine_id=machine_str,
                channel_id="",
                issue_type="售货机编号格式错误",
                description=f"售货机编号 {machine_str} 格式不正确，应为 VM + 6位数字（如 VM000001）",
                severity=ValidationStatus.FAIL
            )
        return None
    
    def validate_channel_id(self, channel_id: str, machine_id: str, row_idx: int) -> Optional[ValidationIssue]:
        if pd.isna(channel_id) or str(channel_id).strip() == "":
            return ValidationIssue(
                row_index=row_idx,
                machine_id=str(machine_id),
                channel_id="",
                issue_type="货道编号缺失",
                description="货道编号不能为空",
                severity=ValidationStatus.FAIL
            )
        channel_str = str(channel_id).strip()
        if not self.channel_pattern.match(channel_str):
            return ValidationIssue(
                row_index=row_idx,
                machine_id=str(machine_id),
                channel_id=channel_str,
                issue_type="货道编号格式错误",
                description=f"货道编号 {channel_str} 格式不正确，应为 大写字母+2位数字（如 A01）",
                severity=ValidationStatus.FAIL
            )
        return None
    
    def validate_product(self, product_name: str, product_code: str, 
                         machine_id: str, channel_id: str, row_idx: int) -> List[ValidationIssue]:
        issues = []
        if pd.isna(product_name) or str(product_name).strip() == "":
            issues.append(ValidationIssue(
                row_index=row_idx,
                machine_id=str(machine_id),
                channel_id=str(channel_id),
                issue_type="商品名称缺失",
                description="商品名称不能为空",
                severity=ValidationStatus.FAIL
            ))
        if pd.isna(product_code) or str(product_code).strip() == "":
            issues.append(ValidationIssue(
                row_index=row_idx,
                machine_id=str(machine_id),
                channel_id=str(channel_id),
                issue_type="商品编码缺失",
                description="商品编码不能为空",
                severity=ValidationStatus.FAIL
            ))
        return issues
    
    def validate_stock(self, stock_qty, machine_id: str, channel_id: str, row_idx: int) -> Optional[ValidationIssue]:
        try:
            qty = float(stock_qty)
            if qty < 0:
                return ValidationIssue(
                    row_index=row_idx,
                    machine_id=str(machine_id),
                    channel_id=str(channel_id),
                    issue_type="库存数量异常",
                    description=f"库存数量 {stock_qty} 不能为负数",
                    severity=ValidationStatus.FAIL
                )
            if qty == 0:
                return ValidationIssue(
                    row_index=row_idx,
                    machine_id=str(machine_id),
                    channel_id=str(channel_id),
                    issue_type="库存为空",
                    description="货道库存为0，请确认是否需要补货",
                    severity=ValidationStatus.WARN
                )
        except (ValueError, TypeError):
            return ValidationIssue(
                row_index=row_idx,
                machine_id=str(machine_id),
                channel_id=str(channel_id),
                issue_type="库存数量格式错误",
                description=f"库存数量 {stock_qty} 不是有效的数字",
                severity=ValidationStatus.FAIL
            )
        return None

class SpecialCaseHandler:
    def __init__(self):
        pass
    
    def is_combination_product(self, product_name: str) -> bool:
        if pd.isna(product_name):
            return False
        return "组合" in str(product_name) or "套餐" in str(product_name)
    
    def is_temp_replacement(self, row_data: Dict) -> bool:
        check_status = str(row_data.get("校验状态", "")).strip()
        return "临时" in check_status or "换品" in check_status
    
    def is_rerun_needed(self, row_data: Dict) -> bool:
        check_status = str(row_data.get("校验状态", "")).strip()
        return "复跑" in check_status or "重跑" in check_status or "待确认" in check_status
    
    def process_combination_product(self, row_data: Dict, row_idx: int) -> Dict:
        return {
            "row_index": row_idx,
            "machine_id": str(row_data.get("售货机编号", "")),
            "channel_id": str(row_data.get("货道编号", "")),
            "product_name": str(row_data.get("商品名称", "")),
            "product_code": str(row_data.get("商品编码", "")),
            "reason": "组合商品/套餐商品，需单独校验商品组成清单",
            "action_required": "请核对组合商品包含的子商品及数量配置"
        }
    
    def process_temp_replacement(self, row_data: Dict, row_idx: int) -> Dict:
        return {
            "row_index": row_idx,
            "machine_id": str(row_data.get("售货机编号", "")),
            "channel_id": str(row_data.get("货道编号", "")),
            "original_product": str(row_data.get("商品名称", "")),
            "reason": "临时换品标记",
            "action_required": "请登记临时换品记录，确认换回时间"
        }
    
    def process_rerun_item(self, row_data: Dict, row_idx: int) -> Dict:
        return {
            "row_index": row_idx,
            "machine_id": str(row_data.get("售货机编号", "")),
            "channel_id": str(row_data.get("货道编号", "")),
            "product_name": str(row_data.get("商品名称", "")),
            "reason": "标记为可复跑/待确认",
            "action_required": "请再次跑批校验或人工确认"
        }
