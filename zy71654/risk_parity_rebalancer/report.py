from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from typing import TextIO

from .models import RebalanceRecord, RecordStatus


def _fmt_pct(val: float) -> str:
    return f"{val * 100:.2f}%"


def _fmt_vol(val: float) -> str:
    return f"{val * 100:.4f}%"


def _record_header(record: RebalanceRecord) -> list[str]:
    lines = [
        "=" * 72,
        f"  风险平价再平衡报告  |  记录ID: {record.record_id}",
        f"  状态: {record.status.value}  |  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "=" * 72,
        "",
    ]
    return lines


def _data_source_section(record: RebalanceRecord) -> list[str]:
    lines = ["── 数据来源 ──"]
    if record.asset_return is not None:
        lines.append(f"  资产收益: {record.asset_return.source or '未标注来源'}")
    else:
        lines.append("  资产收益: [缺失]")
    if record.covariance is not None:
        lines.append(f"  协方差矩阵: {record.covariance.source or '未标注来源'}")
    else:
        lines.append("  协方差矩阵: [缺失]")
    if record.current_position is not None:
        lines.append(f"  当前持仓: {record.current_position.source or '未标注来源'}")
    else:
        lines.append("  当前持仓: [缺失]")
    if record.transaction_cost is not None:
        lines.append(f"  交易成本: {record.transaction_cost.source or '未标注来源'}")
    else:
        lines.append("  交易成本: [缺失]")
    if record.risk_constraint is not None:
        lines.append(f"  风控限制: {record.risk_constraint.source or '未标注来源'}")
    else:
        lines.append("  风控限制: [缺失]")
    lines.append("")
    return lines


def _validation_section(record: RebalanceRecord) -> list[str]:
    lines = ["── 校验结果 ──"]
    if not record.validation_issues:
        lines.append("  无校验问题")
    else:
        errors = [i for i in record.validation_issues if i.severity == "error"]
        warnings = [i for i in record.validation_issues if i.severity == "warning"]
        if errors:
            lines.append(f"  严重问题 ({len(errors)}):")
            for e in errors:
                lines.append(f"    ✗ [{e.flag.value}] {e.message}")
        if warnings:
            lines.append(f"  警告 ({len(warnings)}):")
            for w in warnings:
                lines.append(f"    ⚠ [{w.flag.value}] {w.message}")

    if record.status == RecordStatus.REJECTED:
        lines.append("")
        lines.append("  ⛔ 此记录已被退回，需补齐以下材料后方可继续：")
        for r in record.rejection_reasons:
            lines.append(f"    - {r}")
    lines.append("")
    return lines


def _risk_contribution_section(record: RebalanceRecord) -> list[str]:
    if record.optimization_result is None:
        return []
    rc = record.optimization_result.risk_contributions
    lines = [
        "── 风险贡献 ──",
        f"  组合波动率: {_fmt_vol(rc.portfolio_volatility)}",
        "",
        f"  {'资产':<12} {'目标权重':>10} {'风险贡献':>12} {'风险贡献占比':>14} {'边际风险贡献':>14}",
        f"  {'-'*12} {'-'*10} {'-'*12} {'-'*14} {'-'*14}",
    ]

    rc_total = rc.risk_contributions.sum()
    for i, asset in enumerate(rc.assets):
        rc_pct = rc.risk_contributions[i] / rc_total if rc_total > 0 else 0
        lines.append(
            f"  {asset:<12} {_fmt_pct(rc.weights_used[i]):>10} "
            f"{_fmt_vol(rc.risk_contributions[i]):>12} "
            f"{_fmt_pct(rc_pct):>14} "
            f"{_fmt_vol(rc.marginal_risk_contributions[i]):>14}"
        )
    lines.append("")
    return lines


def _optimization_section(record: RebalanceRecord) -> list[str]:
    if record.optimization_result is None:
        return []
    opt = record.optimization_result
    lines = [
        "── 优化结果 ──",
        f"  收敛: {'是' if opt.converged else '否'}  |  迭代次数: {opt.iterations}",
    ]
    if opt.active_constraints:
        lines.append(f"  激活约束: {', '.join(opt.active_constraints)}")
    else:
        lines.append("  激活约束: 无")
    lines.append("")
    return lines


def _rebalance_diff_section(record: RebalanceRecord) -> list[str]:
    if record.rebalance_diff is None:
        return []
    diff = record.rebalance_diff
    lines = [
        "── 调仓差异 ──",
        f"  总换手率: {_fmt_pct(diff.turnover)}  |  总交易成本: {_fmt_pct(diff.total_cost)}",
        "",
        f"  {'资产':<12} {'当前权重':>10} {'目标权重':>10} {'权重变动':>10} {'交易成本':>10} {'净变动':>10}",
        f"  {'-'*12} {'-'*10} {'-'*10} {'-'*10} {'-'*10} {'-'*10}",
    ]
    for i, asset in enumerate(diff.assets):
        lines.append(
            f"  {asset:<12} {_fmt_pct(diff.current_weights[i]):>10} "
            f"{_fmt_pct(diff.target_weights[i]):>10} "
            f"{diff.weight_changes[i]*100:>+9.2f}% "
            f"{_fmt_pct(diff.transaction_costs[i]):>10} "
            f"{diff.net_weight_changes[i]*100:>+9.2f}%"
        )
    lines.append("")
    return lines


def _boundary_section(record: RebalanceRecord) -> list[str]:
    lines = ["── 边界解释 ──"]
    if record.optimization_result and record.optimization_result.active_constraints:
        for c in record.optimization_result.active_constraints:
            if c.startswith("lower_bound_"):
                asset = c.replace("lower_bound_", "")
                lines.append(f"  ▸ {asset} 触及下限约束，优化器无法继续降低该资产权重")
            elif c.startswith("upper_bound_"):
                asset = c.replace("upper_bound_", "")
                lines.append(f"  ▸ {asset} 触及上限约束，优化器无法继续增加该资产权重")
            elif c == "turnover_limit":
                lines.append(f"  ▸ 换手率触及上限约束，调仓幅度被限制")
    else:
        lines.append("  无边界约束被激活")

    warnings = [i for i in record.validation_issues if i.severity == "warning"]
    if warnings:
        lines.append("")
        lines.append("  数据质量警告（不影响结果但需关注）：")
        for w in warnings:
            lines.append(f"    ▸ [{w.flag.value}] {w.message}")
    lines.append("")
    return lines


def _audit_trail_section(record: RebalanceRecord) -> list[str]:
    lines = ["── 审计追踪 ──"]
    if not record.audit_trail:
        lines.append("  无记录")
    else:
        for entry in record.audit_trail:
            lines.append(f"  [{entry.get('status', '?')}] {entry.get('step', '?')}: {entry.get('detail', '')}")
    lines.append("")
    return lines


def format_report_text(record: RebalanceRecord) -> str:
    sections = []
    sections.extend(_record_header(record))
    sections.extend(_data_source_section(record))
    sections.extend(_validation_section(record))
    sections.extend(_risk_contribution_section(record))
    sections.extend(_optimization_section(record))
    sections.extend(_rebalance_diff_section(record))
    sections.extend(_boundary_section(record))
    sections.extend(_audit_trail_section(record))
    return "\n".join(sections)


def export_report(
    records: list[RebalanceRecord],
    output_path: str,
    format: str = "text",
) -> str:
    if format == "text":
        content = "\n\n".join(format_report_text(r) for r in records)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
    elif format == "json":
        data = [_record_to_dict(r) for r in records]
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    elif format == "csv":
        rows = []
        for r in records:
            rows.extend(_record_to_csv_rows(r))
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            if rows:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)
    else:
        raise ValueError(f"不支持的导出格式: {format}")

    return output_path


def _record_to_dict(record: RebalanceRecord) -> dict:
    d = {
        "record_id": record.record_id,
        "status": record.status.value,
        "validation_issues": [
            {"flag": i.flag.value, "message": i.message, "severity": i.severity}
            for i in record.validation_issues
        ],
        "rejection_reasons": record.rejection_reasons,
        "audit_trail": record.audit_trail,
    }
    if record.optimization_result:
        opt = record.optimization_result
        rc = opt.risk_contributions
        d["optimization"] = {
            "converged": opt.converged,
            "iterations": opt.iterations,
            "active_constraints": opt.active_constraints,
            "portfolio_volatility": rc.portfolio_volatility,
            "risk_contributions": {
                a: {
                    "weight": float(rc.weights_used[i]),
                    "risk_contribution": float(rc.risk_contributions[i]),
                    "marginal_risk_contribution": float(rc.marginal_risk_contributions[i]),
                }
                for i, a in enumerate(rc.assets)
            },
        }
    if record.rebalance_diff:
        diff = record.rebalance_diff
        d["rebalance_diff"] = {
            "turnover": diff.turnover,
            "total_cost": diff.total_cost,
            "assets": {
                a: {
                    "current_weight": float(diff.current_weights[i]),
                    "target_weight": float(diff.target_weights[i]),
                    "weight_change": float(diff.weight_changes[i]),
                    "transaction_cost": float(diff.transaction_costs[i]),
                    "net_weight_change": float(diff.net_weight_changes[i]),
                }
                for i, a in enumerate(diff.assets)
            },
        }
    return d


def _record_to_csv_rows(record: RebalanceRecord) -> list[dict]:
    rows = []
    if record.optimization_result is None or record.rebalance_diff is None:
        return rows

    opt = record.optimization_result
    rc = opt.risk_contributions
    diff = record.rebalance_diff
    all_assets = diff.assets

    for i, asset in enumerate(all_assets):
        row = {
            "record_id": record.record_id,
            "status": record.status.value,
            "asset": asset,
        }
        if asset in rc.assets:
            j = rc.assets.index(asset)
            row["target_weight"] = float(rc.weights_used[j])
            row["risk_contribution"] = float(rc.risk_contributions[j])
            row["rc_pct"] = float(rc.risk_contributions[j] / rc.risk_contributions.sum()) if rc.risk_contributions.sum() > 0 else 0
        row["current_weight"] = float(diff.current_weights[i])
        row["target_weight_diff"] = float(diff.target_weights[i])
        row["weight_change"] = float(diff.weight_changes[i])
        row["transaction_cost"] = float(diff.transaction_costs[i])
        row["net_weight_change"] = float(diff.net_weight_changes[i])
        rows.append(row)

    return rows
