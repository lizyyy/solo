from __future__ import annotations

import numpy as np

from .models import (
    RebalanceRecord,
    RiskConstraint,
    TransactionCost,
    ValidationFlag,
    ValidationIssue,
)


def _check_covariance_singular(record: RebalanceRecord) -> list[ValidationIssue]:
    issues = []
    if record.covariance is None:
        return issues

    sigma = record.covariance.matrix
    try:
        eigs = np.linalg.eigvalsh(sigma)
        min_eig = float(np.min(eigs))
        if min_eig < 1e-8:
            cond = float(np.linalg.cond(sigma))
            issues.append(ValidationIssue(
                flag=ValidationFlag.SINGULAR_COVARIANCE,
                message=(
                    f"协方差矩阵近似奇异：最小特征值={min_eig:.2e}，"
                    f"条件数={cond:.2e}，优化结果可能不可靠"
                ),
                severity="error",
            ))
        elif min_eig < 1e-4:
            cond = float(np.linalg.cond(sigma))
            issues.append(ValidationIssue(
                flag=ValidationFlag.SINGULAR_COVARIANCE,
                message=(
                    f"协方差矩阵病态警告：最小特征值={min_eig:.2e}，"
                    f"条件数={cond:.2e}，结果精度可能受影响"
                ),
                severity="warning",
            ))
    except np.linalg.LinAlgError:
        issues.append(ValidationIssue(
            flag=ValidationFlag.SINGULAR_COVARIANCE,
            message="协方差矩阵特征值分解失败，矩阵可能非正定",
            severity="error",
        ))

    diag = np.diag(sigma)
    neg_diag = np.where(diag < 0)[0]
    if len(neg_diag) > 0:
        assets = record.covariance.assets
        bad_assets = [assets[i] for i in neg_diag if i < len(assets)]
        issues.append(ValidationIssue(
            flag=ValidationFlag.SINGULAR_COVARIANCE,
            message=f"协方差矩阵对角线存在负值：{bad_assets}",
            asset_indices=neg_diag.tolist(),
            severity="error",
        ))

    return issues


def _check_weight_bounds(record: RebalanceRecord) -> list[ValidationIssue]:
    issues = []
    if record.current_position is None or record.risk_constraint is None:
        return issues

    constraint = record.risk_constraint
    weights = record.current_position.weights
    assets = record.current_position.assets
    n = len(weights)

    violations = []
    for i in range(n):
        if weights[i] > constraint.max_single_weight:
            violations.append((i, "upper", float(weights[i]), constraint.max_single_weight))
        if weights[i] < constraint.min_single_weight and weights[i] > 0:
            violations.append((i, "lower", float(weights[i]), constraint.min_single_weight))

    for idx, bound_type, val, limit in violations:
        asset = assets[idx] if idx < len(assets) else f"asset_{idx}"
        direction = "超过" if bound_type == "upper" else "低于"
        issues.append(ValidationIssue(
            flag=ValidationFlag.WEIGHT_OUT_OF_BOUNDS,
            message=f"{asset} 权重 {val:.4f} {direction}限制 {limit:.4f}",
            asset_indices=[idx],
            severity="warning" if bound_type == "lower" else "error",
        ))

    return issues


def _check_cost_deduction(record: RebalanceRecord) -> list[ValidationIssue]:
    issues = []

    if record.current_position is not None and record.transaction_cost is None:
        issues.append(ValidationIssue(
            flag=ValidationFlag.COST_DEDUCTION_MISSING,
            message="存在持仓权重但缺少交易成本参数，调仓差异将不含成本扣减",
            severity="warning",
        ))
        return issues

    if record.transaction_cost is not None:
        cost_rate = record.transaction_cost.cost_rate
        cost_assets = set(record.transaction_cost.assets)
        if record.current_position is not None:
            pos_assets = set(record.current_position.assets)
            missing = pos_assets - cost_assets
            if missing:
                indices = []
                for a in missing:
                    if a in record.current_position.assets:
                        indices.append(record.current_position.assets.index(a))
                issues.append(ValidationIssue(
                    flag=ValidationFlag.COST_DEDUCTION_MISSING,
                    message=f"以下资产缺少交易成本：{sorted(missing)}，将按0成本处理",
                    asset_indices=indices,
                    severity="warning",
                ))

        negative_costs = np.where(cost_rate < 0)[0]
        if len(negative_costs) > 0:
            bad = [record.transaction_cost.assets[i] for i in negative_costs
                   if i < len(record.transaction_cost.assets)]
            issues.append(ValidationIssue(
                flag=ValidationFlag.COST_DEDUCTION_MISSING,
                message=f"交易成本率为负：{bad}，可能数据错误",
                asset_indices=negative_costs.tolist(),
                severity="error",
            ))

    return issues


def _check_dimension_consistency(record: RebalanceRecord) -> list[ValidationIssue]:
    issues = []
    dims = {}

    if record.covariance is not None:
        dims["covariance"] = (record.covariance.n_assets, record.covariance.assets)
    if record.asset_return is not None:
        dims["asset_return"] = (len(record.asset_return.assets), record.asset_return.assets)
    if record.current_position is not None:
        dims["current_position"] = (len(record.current_position.assets), record.current_position.assets)
    if record.transaction_cost is not None:
        dims["transaction_cost"] = (len(record.transaction_cost.assets), record.transaction_cost.assets)

    keys = list(dims.keys())
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            k1, k2 = keys[i], keys[j]
            n1, a1 = dims[k1]
            n2, a2 = dims[k2]
            if n1 != n2:
                issues.append(ValidationIssue(
                    flag=ValidationFlag.MISMATCHED_DIMENSIONS,
                    message=f"{k1} 维度({n1}) 与 {k2} 维度({n2}) 不匹配",
                    severity="error",
                ))
            else:
                if a1 != a2:
                    missing_in_2 = set(a1) - set(a2)
                    missing_in_1 = set(a2) - set(a1)
                    if missing_in_2 or missing_in_1:
                        detail = []
                        if missing_in_2:
                            detail.append(f"{k2} 缺 {sorted(missing_in_2)}")
                        if missing_in_1:
                            detail.append(f"{k1} 缺 {sorted(missing_in_1)}")
                        issues.append(ValidationIssue(
                            flag=ValidationFlag.MISSING_ASSET_DATA,
                            message=f"资产列表不一致：{'；'.join(detail)}",
                            severity="warning",
                        ))

    return issues


def validate_record(record: RebalanceRecord) -> list[ValidationIssue]:
    all_issues = []

    if record.covariance is None:
        all_issues.append(ValidationIssue(
            flag=ValidationFlag.MISSING_ASSET_DATA,
            message="缺少协方差矩阵，无法进行风险平价优化",
            severity="error",
        ))

    if record.current_position is None:
        all_issues.append(ValidationIssue(
            flag=ValidationFlag.MISSING_ASSET_DATA,
            message="缺少当前持仓权重，无法计算调仓差异",
            severity="warning",
        ))

    all_issues.extend(_check_covariance_singular(record))
    all_issues.extend(_check_weight_bounds(record))
    all_issues.extend(_check_cost_deduction(record))
    all_issues.extend(_check_dimension_consistency(record))

    return all_issues


def isolate_anomalies(records: list[RebalanceRecord]) -> tuple[list[RebalanceRecord], list[RebalanceRecord]]:
    normal = []
    anomalous = []

    for record in records:
        issues = validate_record(record)
        record.validation_issues = issues

        has_error = any(i.severity == "error" for i in issues)

        if has_error:
            record.status = record.status.__class__("rejected") if hasattr(record.status, '__class__') else record.status
            from .models import RecordStatus
            record.status = RecordStatus.REJECTED
            record.rejection_reasons = [
                f"[{i.flag.value}] {i.message}" for i in issues if i.severity == "error"
            ]
            record.add_audit("validation", f"退回：{len([i for i in issues if i.severity == 'error'])} 项严重问题")
            anomalous.append(record)
        else:
            record.add_audit("validation", f"通过，{len([i for i in issues if i.severity == 'warning'])} 项警告")
            normal.append(record)

    return normal, anomalous
