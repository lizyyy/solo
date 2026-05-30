from __future__ import annotations

import numpy as np

from .models import (
    OptimizationResult,
    PositionWeight,
    RebalanceDiff,
    TransactionCost,
)


def compute_rebalance_diff(
    optimization_result: OptimizationResult,
    current_position: PositionWeight,
    transaction_cost: TransactionCost | None = None,
) -> RebalanceDiff:
    asset_map = {a: i for i, a in enumerate(current_position.assets)}
    n = len(current_position.assets)

    current_w = np.zeros(n)
    target_w = np.zeros(n)
    cost_rate = np.zeros(n)

    for i, asset in enumerate(current_position.assets):
        current_w[i] = current_position.weights[i]
        if asset in asset_map:
            current_w[i] = current_position.weights[asset_map[asset]]

    for i, asset in enumerate(optimization_result.assets):
        if asset in asset_map:
            target_w[asset_map[asset]] = optimization_result.optimal_weights[i]

    if transaction_cost is not None:
        for i, asset in enumerate(transaction_cost.assets):
            if asset in asset_map:
                cost_rate[asset_map[asset]] = transaction_cost.cost_rate[i]

    weight_changes = target_w - current_w

    transaction_costs = np.abs(weight_changes) * cost_rate

    net_weight_changes = weight_changes - np.sign(weight_changes) * transaction_costs

    net_weight_changes_normalized = net_weight_changes.copy()
    total_positive = net_weight_changes_normalized[net_weight_changes_normalized > 0].sum()
    total_negative = net_weight_changes_normalized[net_weight_changes_normalized < 0].sum()
    scale = 1.0 - transaction_costs.sum()
    if scale < 0:
        scale = 0.0
    if total_positive > 0:
        net_weight_changes_normalized[net_weight_changes_normalized > 0] *= scale / total_positive if total_positive != 0 else 0

    turnover = float(np.sum(np.abs(weight_changes)))
    total_cost = float(transaction_costs.sum())

    return RebalanceDiff(
        assets=current_position.assets,
        current_weights=current_w,
        target_weights=target_w,
        weight_changes=weight_changes,
        transaction_costs=transaction_costs,
        net_weight_changes=net_weight_changes,
        turnover=turnover,
        total_cost=total_cost,
    )
