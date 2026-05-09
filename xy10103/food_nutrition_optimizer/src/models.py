from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
import pandas as pd


class QualityIssueType(Enum):
    MISSING_VALUE = "缺失值"
    DUPLICATE = "重复数据"
    UNIT_ERROR = "单位错误"
    OUTLIER = "异常值"
    ALLERGEN = "过敏原问题"
    INVALID_RECORD = "无效记录"


@dataclass
class QualityIssue:
    issue_type: QualityIssueType
    description: str
    ingredient_name: Optional[str] = None
    row_index: Optional[int] = None
    column: Optional[str] = None
    original_value: Any = None


@dataclass
class Constraint:
    name: str
    min_value: float
    max_value: float
    unit: str
    current_value: Optional[float] = None
    is_satisfied: bool = True


@dataclass
class Ingredient:
    id: str
    name: str
    category: str
    protein: float
    sodium: float
    cost: float
    weight: float = 100.0
    protein_unit: str = "g"
    sodium_unit: str = "mg"
    cost_unit: str = "USD"
    allergens: List[str] = field(default_factory=list)
    notes: str = ""
    quality_issues: List[QualityIssue] = field(default_factory=list)
    is_valid: bool = True


@dataclass
class RecipeResult:
    ingredients: List[str]
    proportions: Dict[str, float]
    total_protein: float
    total_sodium: float
    total_cost: float
    total_weight: float
    constraints: List[Constraint]
    is_feasible: bool
    optimization_time: float
    notes: str = ""


@dataclass
class ProcessingReport:
    total_records: int = 0
    valid_records: int = 0
    invalid_records: int = 0
    issues: List[QualityIssue] = field(default_factory=list)
    removed_duplicates: int = 0
    filled_missing_values: int = 0
    converted_units: int = 0
    removed_outliers: int = 0
    removed_allergens: int = 0
    timing_stats: Dict[str, float] = field(default_factory=dict)
    
    def add_issue(self, issue: QualityIssue) -> None:
        self.issues.append(issue)
        
    def get_issues_by_type(self) -> Dict[str, List[QualityIssue]]:
        result = {}
        for issue in self.issues:
            type_name = issue.issue_type.value
            if type_name not in result:
                result[type_name] = []
            result[type_name].append(issue)
        return result
