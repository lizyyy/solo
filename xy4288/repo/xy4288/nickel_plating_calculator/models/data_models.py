"""数据模型定义"""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class RiskLevel(Enum):
    """风险等级"""
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"
    CRITICAL = "严重"


class ApprovalStatus(Enum):
    """放行状态"""
    PENDING = "待审核"
    APPROVED = "已放行"
    REJECTED = "已拒绝"


@dataclass
class TitrationData:
    """滴定化验数据"""
    batch_id: str
    timestamp: datetime
    operator: str
    
    nickel_sulfate_edta_volume: float
    nickel_chloride_edta_volume: float
    boric_titrant_volume: float
    ph_value: float
    
    sample_volume: float = 2.0
    edta_concentration: float = 0.05
    naoh_concentration: float = 0.1
    
    @property
    def titration_id(self) -> str:
        return f"{self.batch_id}_{self.timestamp.strftime('%Y%m%d_%H%M%S')}"


@dataclass
class TankRecord:
    """槽液体积/温度记录"""
    tank_id: str
    batch_id: str
    timestamp: datetime
    operator: str
    
    volume_liters: float
    temperature_celsius: float
    current_ph: float
    
    notes: str = ""


@dataclass
class ProductionRecord:
    """生产面积记录"""
    batch_id: str
    timestamp: datetime
    operator: str
    
    total_area_dm2: float
    parts_count: int
    plating_time_minutes: float
    
    estimated_nickel_consumption_g: Optional[float] = None
    estimated_acid_consumption_ml: Optional[float] = None


@dataclass
class ChemicalInventory:
    """药剂库存"""
    chemical_name: str
    batch_id: str
    timestamp: datetime
    operator: str
    
    current_quantity_kg: float
    minimum_stock_kg: float
    unit_price_per_kg: Optional[float] = None
    
    supplier: str = ""
    lot_number: str = ""


@dataclass
class ProcessParameters:
    """工艺参数配置"""
    nickel_sulfate_target_g_l: float = 250.0
    nickel_sulfate_min_g_l: float = 220.0
    nickel_sulfate_max_g_l: float = 280.0
    
    nickel_chloride_target_g_l: float = 45.0
    nickel_chloride_min_g_l: float = 35.0
    nickel_chloride_max_g_l: float = 55.0
    
    boric_acid_target_g_l: float = 40.0
    boric_acid_min_g_l: float = 30.0
    boric_acid_max_g_l: float = 50.0
    
    ph_target: float = 4.2
    ph_min: float = 4.0
    ph_max: float = 4.5
    
    temperature_target_c: float = 50.0
    temperature_min_c: float = 45.0
    temperature_max_c: float = 55.0
    
    nickel_sulfate_purity: float = 0.98
    nickel_chloride_purity: float = 0.97
    boric_acid_purity: float = 0.99
    
    sulfuric_acid_concentration: float = 0.98
    sodium_hydroxide_concentration: float = 0.30


@dataclass
class CalculatedConcentrations:
    """计算出的浓度"""
    batch_id: str
    timestamp: datetime
    
    nickel_sulfate_g_l: float
    nickel_chloride_g_l: float
    boric_acid_g_l: float
    ph_value: float
    
    nickel_sulfate_status: str = "normal"
    nickel_chloride_status: str = "normal"
    boric_acid_status: str = "normal"
    ph_status: str = "normal"


@dataclass
class DosageResult:
    """补加量计算结果"""
    batch_id: str
    timestamp: datetime
    tank_volume_liters: float
    
    nickel_sulfate_to_add_kg: float
    nickel_chloride_to_add_kg: float
    boric_acid_to_add_kg: float
    
    sulfuric_acid_to_add_ml: Optional[float] = None
    sodium_hydroxide_to_add_ml: Optional[float] = None
    
    estimated_nickel_sulfate_cost: Optional[float] = None
    estimated_nickel_chloride_cost: Optional[float] = None
    estimated_boric_acid_cost: Optional[float] = None


@dataclass
class SimulatedResult:
    """模拟补加后的结果"""
    batch_id: str
    timestamp: datetime
    scenario_name: str
    
    simulated_nickel_sulfate_g_l: float
    simulated_nickel_chloride_g_l: float
    simulated_boric_acid_g_l: float
    simulated_ph: float
    
    nickel_sulfate_in_range: bool
    nickel_chloride_in_range: bool
    boric_acid_in_range: bool
    ph_in_range: bool
    
    all_in_range: bool = False
    
    def __post_init__(self):
        self.all_in_range = (
            self.nickel_sulfate_in_range
            and self.nickel_chloride_in_range
            and self.boric_acid_in_range
            and self.ph_in_range
        )


@dataclass
class RiskItem:
    """风险项"""
    category: str
    description: str
    level: RiskLevel
    suggestion: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskAssessment:
    """风险评估结果"""
    batch_id: str
    timestamp: datetime
    
    overall_risk: RiskLevel
    risks: List[RiskItem]
    
    can_proceed: bool = False


@dataclass
class InventoryCheck:
    """库存检查结果"""
    batch_id: str
    timestamp: datetime
    
    nickel_sulfate_available: bool
    nickel_chloride_available: bool
    boric_acid_available: bool
    
    nickel_sulfate_shortage_kg: float
    nickel_chloride_shortage_kg: float
    boric_acid_shortage_kg: float
    
    all_available: bool = False


@dataclass
class SolutionPlan:
    """补加方案"""
    plan_id: str
    plan_name: str
    batch_id: str
    created_at: datetime
    operator: str
    
    dosage: DosageResult
    simulation: SimulatedResult
    risks: RiskAssessment
    inventory: InventoryCheck
    
    notes: str = ""
    is_preferred: bool = False


@dataclass
class ApprovalRecord:
    """放行记录"""
    approval_id: str
    batch_id: str
    timestamp: datetime
    operator: str
    reviewer: str
    
    selected_plan_id: str
    status: ApprovalStatus
    
    actual_nickel_sulfate_added_kg: Optional[float] = None
    actual_nickel_chloride_added_kg: Optional[float] = None
    actual_boric_acid_added_kg: Optional[float] = None
    actual_sulfuric_acid_added_ml: Optional[float] = None
    actual_sodium_hydroxide_added_ml: Optional[float] = None
    
    notes: str = ""


@dataclass
class AuditEntry:
    """审计条目"""
    entry_id: str
    timestamp: datetime
    operator: str
    action: str
    details: Dict[str, Any]
    
    batch_id: Optional[str] = None
    plan_id: Optional[str] = None
    approval_id: Optional[str] = None


@dataclass
class BatchContext:
    """批次上下文 - 整合所有数据"""
    batch_id: str
    created_at: datetime
    
    titration: Optional[TitrationData] = None
    tank_record: Optional[TankRecord] = None
    production: Optional[ProductionRecord] = None
    concentrations: Optional[CalculatedConcentrations] = None
    process_params: Optional[ProcessParameters] = None
    
    inventory: Dict[str, ChemicalInventory] = field(default_factory=dict)
    plans: Dict[str, SolutionPlan] = field(default_factory=dict)
    approval: Optional[ApprovalRecord] = None
    audit_log: List[AuditEntry] = field(default_factory=list)
