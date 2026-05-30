from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np


class RecordStatus(enum.Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    REJECTED = "rejected"
    OPTIMIZING = "optimizing"
    REBALANCING = "rebalancing"
    COMPLETED = "completed"
    FAILED = "failed"


class ValidationFlag(enum.Enum):
    SINGULAR_COVARIANCE = "singular_covariance"
    WEIGHT_OUT_OF_BOUNDS = "weight_out_of_bounds"
    COST_DEDUCTION_MISSING = "cost_deduction_missing"
    MISMATCHED_DIMENSIONS = "mismatched_dimensions"
    MISSING_ASSET_DATA = "missing_asset_data"


@dataclass
class AssetReturn:
    assets: List[str]
    expected_returns: np.ndarray
    source: str = ""

    def __post_init__(self):
        self.expected_returns = np.asarray(self.expected_returns, dtype=float)


@dataclass
class CovarianceMatrix:
    assets: List[str]
    matrix: np.ndarray
    source: str = ""

    def __post_init__(self):
        self.matrix = np.asarray(self.matrix, dtype=float)

    @property
    def n_assets(self) -> int:
        return len(self.assets)


@dataclass
class PositionWeight:
    assets: List[str]
    weights: np.ndarray
    source: str = ""

    def __post_init__(self):
        self.weights = np.asarray(self.weights, dtype=float)


@dataclass
class TransactionCost:
    assets: List[str]
    cost_rate: np.ndarray
    source: str = ""

    def __post_init__(self):
        self.cost_rate = np.asarray(self.cost_rate, dtype=float)


@dataclass
class RiskConstraint:
    weight_lower: Optional[np.ndarray] = None
    weight_upper: Optional[np.ndarray] = None
    max_single_weight: float = 0.40
    min_single_weight: float = 0.02
    turnover_limit: Optional[float] = None
    source: str = ""


@dataclass
class ValidationIssue:
    flag: ValidationFlag
    message: str
    asset_indices: Optional[List[int]] = None
    severity: str = "error"


@dataclass
class RiskContributionResult:
    assets: List[str]
    risk_contributions: np.ndarray
    marginal_risk_contributions: np.ndarray
    portfolio_volatility: float
    weights_used: np.ndarray


@dataclass
class OptimizationResult:
    assets: List[str]
    optimal_weights: np.ndarray
    risk_contributions: RiskContributionResult
    converged: bool
    iterations: int
    active_constraints: List[str] = field(default_factory=list)


@dataclass
class RebalanceDiff:
    assets: List[str]
    current_weights: np.ndarray
    target_weights: np.ndarray
    weight_changes: np.ndarray
    transaction_costs: np.ndarray
    net_weight_changes: np.ndarray
    turnover: float
    total_cost: float


@dataclass
class RebalanceRecord:
    record_id: str
    asset_return: Optional[AssetReturn] = None
    covariance: Optional[CovarianceMatrix] = None
    current_position: Optional[PositionWeight] = None
    transaction_cost: Optional[TransactionCost] = None
    risk_constraint: Optional[RiskConstraint] = None
    status: RecordStatus = RecordStatus.PENDING
    validation_issues: List[ValidationIssue] = field(default_factory=list)
    optimization_result: Optional[OptimizationResult] = None
    rebalance_diff: Optional[RebalanceDiff] = None
    rejection_reasons: List[str] = field(default_factory=list)
    audit_trail: List[Dict] = field(default_factory=list)

    def add_audit(self, step: str, detail: str):
        self.audit_trail.append({
            "step": step,
            "detail": detail,
            "status": self.status.value,
        })
