from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import numpy as np


@dataclass
class IntermediateStep:
    step_name: str
    step_order: int
    description: str
    values: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=lambda: __import__('time').time())


@dataclass
class RiskAttribution:
    weights: np.ndarray
    portfolio_volatility: float
    marginal_risk_contribution: np.ndarray
    total_risk_contribution: np.ndarray
    percent_risk_contribution: np.ndarray
    target_risk_budget: np.ndarray
    risk_budget_deviation: np.ndarray


@dataclass
class BoundaryExplanation:
    asset_index: int
    asset_name: str
    bound_type: str
    bound_value: float
    weight_at_bound: float
    lagrangian_multiplier: Optional[float]
    shadow_price: Optional[float]
    kkt_condition: str
    evidence: List[str]
    why_cannot_move: str
    risk_budget_consistency: str


@dataclass
class CovarianceDiagnostic:
    is_positive_definite: bool
    eigenvalues: np.ndarray
    min_eigenvalue: float
    condition_number: float
    correction_applied: bool
    correction_method: Optional[str]
    correction_epsilon: Optional[float]
    original_matrix: Optional[np.ndarray]
    corrected_matrix: Optional[np.ndarray]


@dataclass
class OptimizationResult:
    success: bool
    weights: np.ndarray
    asset_names: List[str]
    optimization_method: str
    iterations: int
    final_objective: float
    lagrangian_multipliers: np.ndarray
    upper_bound_multipliers: np.ndarray
    lower_bound_multipliers: np.ndarray
    risk_attribution: RiskAttribution
    covariance_diagnostic: CovarianceDiagnostic
    boundary_explanations: List[BoundaryExplanation]
    intermediate_steps: List[IntermediateStep]
    warnings: List[str]
    execution_sequence: List[str]
    input_parameters: Dict[str, Any]
