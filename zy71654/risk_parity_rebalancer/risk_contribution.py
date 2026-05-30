from __future__ import annotations

import numpy as np

from .models import CovarianceMatrix, RiskContributionResult


def compute_risk_contribution(
    weights: np.ndarray,
    covariance: CovarianceMatrix,
    assets: list[str] | None = None,
) -> RiskContributionResult:
    w = np.asarray(weights, dtype=float).flatten()
    sigma = covariance.matrix

    portfolio_var = w @ sigma @ w
    portfolio_vol = np.sqrt(portfolio_var) if portfolio_var > 0 else 0.0

    marginal_rc = (sigma @ w) / portfolio_vol if portfolio_vol > 0 else np.zeros_like(w)

    rc = w * marginal_rc

    return RiskContributionResult(
        assets=assets or covariance.assets,
        risk_contributions=rc,
        marginal_risk_contributions=marginal_rc,
        portfolio_volatility=portfolio_vol,
        weights_used=w.copy(),
    )


def risk_contribution_ratio(rc_result: RiskContributionResult) -> np.ndarray:
    total = rc_result.risk_contributions.sum()
    if total == 0:
        return np.zeros_like(rc_result.risk_contributions)
    return rc_result.risk_contributions / total


def risk_contribution_deviation(rc_result: RiskContributionResult) -> float:
    n = len(rc_result.risk_contributions)
    if n <= 1:
        return 0.0
    target_rc = rc_result.portfolio_volatility / n
    deviations = rc_result.risk_contributions - target_rc
    return float(np.sqrt(np.mean(deviations**2)))
