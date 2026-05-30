from __future__ import annotations

import numpy as np
from scipy.optimize import minimize

from .models import CovarianceMatrix, OptimizationResult, RiskConstraint, RiskContributionResult
from .risk_contribution import compute_risk_contribution


def _risk_parity_objective(
    w: np.ndarray,
    covariance: np.ndarray,
    budget: np.ndarray | None = None,
) -> float:
    n = len(w)
    sigma_w = covariance @ w
    port_var = w @ sigma_w
    if port_var <= 1e-20:
        return 1e12
    port_vol = np.sqrt(port_var)
    rc = w * sigma_w / port_vol
    if budget is None:
        target = port_vol / n
    else:
        target = budget * port_vol
    deviations = rc - target
    return float(np.sum(deviations**2))


def _build_constraints_and_bounds(
    n: int,
    risk_constraint: RiskConstraint | None,
    current_weights: np.ndarray | None = None,
) -> tuple:
    bounds = []
    lower = np.full(n, risk_constraint.min_single_weight if risk_constraint else 0.01)
    upper = np.full(n, risk_constraint.max_single_weight if risk_constraint else 0.40)

    if risk_constraint and risk_constraint.weight_lower is not None:
        lower = np.maximum(lower, risk_constraint.weight_lower[:n])
    if risk_constraint and risk_constraint.weight_upper is not None:
        upper = np.minimum(upper, risk_constraint.weight_upper[:n])

    for i in range(n):
        bounds.append((float(lower[i]), float(upper[i])))

    constraints = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]

    if risk_constraint and risk_constraint.turnover_limit is not None and current_weights is not None:
        limit = risk_constraint.turnover_limit
        constraints.append({
            "type": "ineq",
            "fun": lambda w, lim=limit, cw=current_weights: lim - np.sum(np.abs(w - cw)),
        })

    return bounds, constraints


def risk_parity_optimize(
    covariance: CovarianceMatrix,
    risk_constraint: RiskConstraint | None = None,
    current_weights: np.ndarray | None = None,
    budget: np.ndarray | None = None,
    max_iter: int = 500,
    tol: float = 1e-10,
) -> OptimizationResult:
    n = covariance.n_assets
    w0 = current_weights if current_weights is not None else np.ones(n) / n

    bounds, constraints = _build_constraints_and_bounds(n, risk_constraint, current_weights)

    result = minimize(
        _risk_parity_objective,
        w0,
        args=(covariance.matrix, budget),
        method="SLSQP",
        bounds=bounds,
        constraints=constraints,
        options={"maxiter": max_iter, "ftol": tol, "disp": False},
    )

    optimal_w = result.x
    optimal_w = np.maximum(optimal_w, 0)
    optimal_w /= optimal_w.sum()

    rc_result = compute_risk_contribution(optimal_w, covariance, covariance.assets)

    active_constraints = []
    if risk_constraint:
        for i in range(n):
            if optimal_w[i] <= bounds[i][0] + 1e-6:
                active_constraints.append(f"lower_bound_{covariance.assets[i]}")
            if optimal_w[i] >= bounds[i][1] - 1e-6:
                active_constraints.append(f"upper_bound_{covariance.assets[i]}")
        if risk_constraint.turnover_limit is not None and current_weights is not None:
            turnover = np.sum(np.abs(optimal_w - current_weights))
            if turnover >= risk_constraint.turnover_limit - 1e-6:
                active_constraints.append("turnover_limit")

    return OptimizationResult(
        assets=covariance.assets,
        optimal_weights=optimal_w,
        risk_contributions=rc_result,
        converged=result.success,
        iterations=result.nit,
        active_constraints=active_constraints,
    )
