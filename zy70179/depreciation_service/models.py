from dataclasses import dataclass, field, asdict
from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any
import json


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.strftime('%Y-%m-%d %H:%M:%S')
        return super().default(obj)


@dataclass
class CostCenter:
    code: str
    name: str
    effective_from: datetime
    effective_to: Optional[datetime] = None
    is_active: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DepreciationRule:
    code: str
    name: str
    method: str  # 直线法、工作量法、双倍余额递减法、年数总和法
    useful_life_months: int
    salvage_value_rate: Decimal = Decimal('0.05')
    effective_from: datetime = field(default_factory=datetime.now)
    is_active: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AssetCard:
    asset_code: str
    asset_name: str
    original_value: Decimal
    depreciation_rule_code: str
    cost_center_code: str
    purchase_date: datetime
    start_depreciation_month: str
    accumulated_depreciation: Decimal = Decimal('0')
    net_value: Optional[Decimal] = None
    status: str = 'active'
    cost_center_history: List[Dict[str, Any]] = field(default_factory=list)
    depreciation_history: List[Dict[str, Any]] = field(default_factory=list)
    
    def __post_init__(self):
        if self.net_value is None:
            self.net_value = self.original_value - self.accumulated_depreciation
        
        if not self.cost_center_history:
            self.cost_center_history = [{
                'cost_center_code': self.cost_center_code,
                'effective_from': self.start_depreciation_month,
                'effective_to': None,
                'is_current': True
            }]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DepreciationRecord:
    asset_code: str
    period: str  # YYYY-MM
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    net_value: Decimal
    cost_center_code: str
    depreciation_rule_code: str
    version_id: Optional[str] = None
    is_original: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RecalculationVersion:
    version_id: str
    asset_code: str
    change_type: str  # category_change, cost_center_change, both
    old_depreciation_rule_code: str
    new_depreciation_rule_code: str
    old_cost_center_code: str
    new_cost_center_code: str
    effective_period: str  # YYYY-MM
    status: str = 'draft'  # draft, processing, completed, failed
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    created_by: str = 'system'
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DifferenceDetail:
    difference_id: str
    version_id: str
    asset_code: str
    period: str
    original_depreciation: Decimal
    new_depreciation: Decimal
    difference_amount: Decimal
    original_cost_center: str
    new_cost_center: str
    explanation: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AuditLog:
    log_id: str
    asset_code: str
    action: str
    version_id: Optional[str] = None
    before_data: Optional[Dict[str, Any]] = None
    after_data: Optional[Dict[str, Any]] = None
    operator: str = 'system'
    operation_time: datetime = field(default_factory=datetime.now)
    business_description: str = ''
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
