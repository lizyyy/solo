from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from typing import Optional

import numpy as np

from .models import (
    AssetReturn,
    CovarianceMatrix,
    PositionWeight,
    RecordStatus,
    RebalanceRecord,
    RiskConstraint,
    TransactionCost,
)
from .optimizer import risk_parity_optimize
from .rebalance import compute_rebalance_diff
from .report import export_report, format_report_text
from .state import StateStore
from .validation import isolate_anomalies, validate_record


def _load_csv(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def _load_json(path: str) -> dict | list:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _build_covariance_from_csv(path: str) -> CovarianceMatrix:
    rows = _load_csv(path)
    if not rows:
        raise ValueError(f"协方差文件为空: {path}")
    assets = [k for k in rows[0].keys() if k.lower() not in ("asset", "name", "资产")]
    asset_col = None
    for k in rows[0].keys():
        if k.lower() in ("asset", "name", "资产"):
            asset_col = k
            break
    if asset_col:
        assets = [r[asset_col] for r in rows]
        n = len(assets)
        matrix = np.zeros((n, n))
        for i, r in enumerate(rows):
            vals = [float(v) for k, v in r.items() if k != asset_col]
            matrix[i, :len(vals)] = vals
    else:
        n = len(rows)
        keys = list(rows[0].keys())
        assets = keys
        matrix = np.zeros((n, n))
        for i, r in enumerate(rows):
            for j, k in enumerate(keys):
                matrix[i, j] = float(r[k])

    return CovarianceMatrix(assets=assets, matrix=matrix, source=path)


def _build_covariance_from_json(data: dict) -> CovarianceMatrix:
    if "covariance" in data and isinstance(data["covariance"], dict):
        data = data["covariance"]
    if "assets" not in data and "matrix" not in data:
        raise ValueError("JSON文件中未找到协方差矩阵数据(需含 assets + matrix)")
    return CovarianceMatrix(
        assets=data["assets"],
        matrix=data["matrix"],
        source=data.get("source", ""),
    )


def _build_position_from_csv(path: str) -> PositionWeight:
    rows = _load_csv(path)
    asset_col = None
    weight_col = None
    for k in rows[0].keys():
        kl = k.lower()
        if kl in ("asset", "name", "资产"):
            asset_col = k
        if kl in ("weight", "权重", "w"):
            weight_col = k
    if asset_col is None or weight_col is None:
        keys = list(rows[0].keys())
        asset_col = keys[0]
        weight_col = keys[1]

    assets = [r[asset_col] for r in rows]
    weights = np.array([float(r[weight_col]) for r in rows])
    return PositionWeight(assets=assets, weights=weights, source=path)


def _build_position_from_json(data: dict) -> PositionWeight:
    if "current_position" in data and isinstance(data["current_position"], dict):
        data = data["current_position"]
    return PositionWeight(
        assets=data["assets"],
        weights=data["weights"],
        source=data.get("source", ""),
    )


def _build_cost_from_csv(path: str) -> TransactionCost:
    rows = _load_csv(path)
    asset_col = None
    cost_col = None
    for k in rows[0].keys():
        kl = k.lower()
        if kl in ("asset", "name", "资产"):
            asset_col = k
        if kl in ("cost", "cost_rate", "rate", "交易成本", "费率"):
            cost_col = k
    if asset_col is None or cost_col is None:
        keys = list(rows[0].keys())
        asset_col = keys[0]
        cost_col = keys[1]

    assets = [r[asset_col] for r in rows]
    cost_rate = np.array([float(r[cost_col]) for r in rows])
    return TransactionCost(assets=assets, cost_rate=cost_rate, source=path)


def _build_cost_from_json(data: dict) -> TransactionCost:
    if "transaction_cost" in data and isinstance(data["transaction_cost"], dict):
        data = data["transaction_cost"]
    return TransactionCost(
        assets=data["assets"],
        cost_rate=data["cost_rate"],
        source=data.get("source", ""),
    )


def _build_returns_from_csv(path: str) -> AssetReturn:
    rows = _load_csv(path)
    asset_col = None
    ret_col = None
    for k in rows[0].keys():
        kl = k.lower()
        if kl in ("asset", "name", "资产"):
            asset_col = k
        if kl in ("return", "expected_return", "收益", "预期收益"):
            ret_col = k
    if asset_col is None or ret_col is None:
        keys = list(rows[0].keys())
        asset_col = keys[0]
        ret_col = keys[1]

    assets = [r[asset_col] for r in rows]
    returns = np.array([float(r[ret_col]) for r in rows])
    return AssetReturn(assets=assets, expected_returns=returns, source=path)


def _build_constraint_from_json(path: str) -> RiskConstraint:
    data = _load_json(path)
    return RiskConstraint(
        max_single_weight=data.get("max_single_weight", 0.40),
        min_single_weight=data.get("min_single_weight", 0.02),
        turnover_limit=data.get("turnover_limit"),
        source=path,
        weight_lower=np.array(data["weight_lower"]) if "weight_lower" in data else None,
        weight_upper=np.array(data["weight_upper"]) if "weight_upper" in data else None,
    )


def _load_data_file(path: str):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".csv":
        return _load_csv(path)
    elif ext == ".json":
        return _load_json(path)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def _build_record_from_args(args) -> RebalanceRecord:
    record = RebalanceRecord(record_id=args.record_id)

    if args.covariance:
        ext = os.path.splitext(args.covariance)[1].lower()
        if ext == ".csv":
            record.covariance = _build_covariance_from_csv(args.covariance)
        else:
            record.covariance = _build_covariance_from_json(_load_json(args.covariance))

    if args.position:
        ext = os.path.splitext(args.position)[1].lower()
        if ext == ".csv":
            record.current_position = _build_position_from_csv(args.position)
        else:
            record.current_position = _build_position_from_json(_load_json(args.position))

    if args.cost:
        ext = os.path.splitext(args.cost)[1].lower()
        if ext == ".csv":
            record.transaction_cost = _build_cost_from_csv(args.cost)
        else:
            record.transaction_cost = _build_cost_from_json(_load_json(args.cost))

    if args.returns:
        ext = os.path.splitext(args.returns)[1].lower()
        if ext == ".csv":
            record.asset_return = _build_returns_from_csv(args.returns)
        else:
            data = _load_json(args.returns)
            record.asset_return = AssetReturn(
                assets=data["assets"],
                expected_returns=data["expected_returns"],
                source=args.returns,
            )

    if args.constraint:
        record.risk_constraint = _build_constraint_from_json(args.constraint)

    if record.risk_constraint is None:
        record.risk_constraint = RiskConstraint(
            max_single_weight=getattr(args, "max_weight", 0.40),
            min_single_weight=getattr(args, "min_weight", 0.02),
            turnover_limit=getattr(args, "turnover_limit", None),
            source="cli_defaults",
        )

    record.add_audit("created", "记录创建")
    return record


def _run_pipeline(record: RebalanceRecord) -> RebalanceRecord:
    record.add_audit("pipeline_start", "开始再平衡流水线")

    issues = validate_record(record)
    record.validation_issues = issues

    has_error = any(i.severity == "error" for i in issues)
    if has_error:
        record.status = RecordStatus.REJECTED
        record.rejection_reasons = [
            f"[{i.flag.value}] {i.message}" for i in issues if i.severity == "error"
        ]
        record.add_audit("validation", f"退回：{len(record.rejection_reasons)} 项严重问题")
        return record

    record.status = RecordStatus.OPTIMIZING
    record.add_audit("validation", f"通过，{len([i for i in issues if i.severity == 'warning'])} 项警告")

    opt_result = risk_parity_optimize(
        covariance=record.covariance,
        risk_constraint=record.risk_constraint,
        current_weights=record.current_position.weights if record.current_position else None,
    )
    record.optimization_result = opt_result
    record.add_audit("optimization", f"优化完成，收敛={opt_result.converged}，迭代={opt_result.iterations}")

    if record.current_position is not None:
        record.status = RecordStatus.REBALANCING
        diff = compute_rebalance_diff(
            optimization_result=opt_result,
            current_position=record.current_position,
            transaction_cost=record.transaction_cost,
        )
        record.rebalance_diff = diff
        record.add_audit("rebalance", f"调仓差异计算完成，换手率={diff.turnover:.4f}，成本={diff.total_cost:.6f}")

    record.status = RecordStatus.COMPLETED
    record.add_audit("pipeline_end", "流水线完成")
    return record


def cmd_run(args):
    store = StateStore()

    existing = store.load(args.record_id)
    if existing and existing.status == RecordStatus.REJECTED:
        print(f"记录 {args.record_id} 之前被退回，尝试补材料后继续...")
        updates = {}
        if args.covariance:
            ext = os.path.splitext(args.covariance)[1].lower()
            if ext == ".csv":
                updates["covariance"] = _build_covariance_from_csv(args.covariance)
            else:
                updates["covariance"] = _build_covariance_from_json(_load_json(args.covariance))
        if args.position:
            ext = os.path.splitext(args.position)[1].lower()
            if ext == ".csv":
                updates["current_position"] = _build_position_from_csv(args.position)
            else:
                updates["current_position"] = _build_position_from_json(_load_json(args.position))
        if args.cost:
            ext = os.path.splitext(args.cost)[1].lower()
            if ext == ".csv":
                updates["transaction_cost"] = _build_cost_from_csv(args.cost)
            else:
                updates["transaction_cost"] = _build_cost_from_json(_load_json(args.cost))
        if args.returns:
            ext = os.path.splitext(args.returns)[1].lower()
            if ext == ".csv":
                updates["asset_return"] = _build_returns_from_csv(args.returns)
            else:
                data = _load_json(args.returns)
                updates["asset_return"] = AssetReturn(
                    assets=data["assets"],
                    expected_returns=data["expected_returns"],
                    source=args.returns,
                )
        if args.constraint:
            updates["risk_constraint"] = _build_constraint_from_json(args.constraint)

        if updates:
            record = store.update_materials(args.record_id, **updates)
            if record:
                record.validation_issues = []
                record.rejection_reasons = []
                record.status = RecordStatus.PENDING
        else:
            record = existing
    elif existing and existing.status == RecordStatus.COMPLETED:
        print(f"记录 {args.record_id} 已完成，如需重跑请先删除")
        record = existing
    else:
        record = _build_record_from_args(args)

    record = _run_pipeline(record)
    store.save(record)

    print(format_report_text(record))

    if args.output:
        fmt = args.format or "text"
        path = export_report([record], args.output, format=fmt)
        print(f"\n报告已导出: {path}")


def cmd_batch(args):
    store = StateStore()

    if not os.path.isdir(args.input_dir):
        print(f"目录不存在: {args.input_dir}")
        sys.exit(1)

    records = []
    for fname in sorted(os.listdir(args.input_dir)):
        fpath = os.path.join(args.input_dir, fname)
        if not os.path.isfile(fpath):
            continue
        try:
            data = _load_json(fpath)
        except Exception:
            continue

        record_id = data.get("record_id", os.path.splitext(fname)[0])

        existing = store.load(record_id)
        if existing and existing.status == RecordStatus.COMPLETED:
            records.append(existing)
            continue

        record = RebalanceRecord(record_id=record_id)

        if "covariance" in data:
            record.covariance = _build_covariance_from_json(data["covariance"])
        if "current_position" in data:
            record.current_position = _build_position_from_json(data["current_position"])
        if "transaction_cost" in data:
            record.transaction_cost = _build_cost_from_json(data["transaction_cost"])
        if "asset_return" in data:
            ar = data["asset_return"]
            record.asset_return = AssetReturn(
                assets=ar["assets"],
                expected_returns=ar["expected_returns"],
                source=ar.get("source", ""),
            )
        if "risk_constraint" in data:
            rc = data["risk_constraint"]
            record.risk_constraint = RiskConstraint(
                max_single_weight=rc.get("max_single_weight", 0.40),
                min_single_weight=rc.get("min_single_weight", 0.02),
                turnover_limit=rc.get("turnover_limit"),
                source=rc.get("source", ""),
            )
        else:
            record.risk_constraint = RiskConstraint(source="batch_defaults")

        record.add_audit("created", f"批量加载: {fname}")
        records.append(record)

    normal, anomalous = isolate_anomalies(records)

    print(f"\n批量校验结果: {len(normal)} 条正常, {len(anomalous)} 条异常\n")

    completed = []
    for record in normal:
        record = _run_pipeline(record)
        store.save(record)
        completed.append(record)

    for record in anomalous:
        store.save(record)

    if args.output:
        all_records = completed + anomalous
        fmt = args.format or "text"
        path = export_report(all_records, args.output, format=fmt)
        print(f"\n报告已导出: {path}")
    else:
        for record in completed:
            print(format_report_text(record))
            print()
        if anomalous:
            print("=" * 72)
            print("以下记录因严重问题被退回：")
            print("=" * 72)
            for record in anomalous:
                print(format_report_text(record))
                print()


def cmd_status(args):
    store = StateStore()
    record = store.load(args.record_id)
    if record is None:
        print(f"记录不存在: {args.record_id}")
        sys.exit(1)
    print(format_report_text(record))


def cmd_list(args):
    store = StateStore()
    records = store.list_records()
    if not records:
        print("暂无记录")
        return

    print(f"{'记录ID':<30} {'状态':<15}")
    print("-" * 45)
    for rid in records:
        r = store.load(rid)
        if r:
            print(f"{rid:<30} {r.status.value:<15}")
        else:
            print(f"{rid:<30} {'未知':<15}")


def cmd_delete(args):
    store = StateStore()
    if store.delete(args.record_id):
        print(f"已删除记录: {args.record_id}")
    else:
        print(f"记录不存在: {args.record_id}")


def cmd_sample(args):
    _generate_sample_data(args.output_dir)


def _generate_sample_data(output_dir: str):
    os.makedirs(output_dir, exist_ok=True)

    assets = ["equity_cn", "equity_us", "bond_cn", "commodity", "gold"]

    np.random.seed(42)
    n = len(assets)
    A = np.random.randn(n, n) * 0.01
    cov_normal = A @ A.T + np.eye(n) * 0.001

    cov_data = {
        "assets": assets,
        "matrix": cov_normal.tolist(),
        "source": "sample_normal",
    }
    with open(os.path.join(output_dir, "01_normal.json"), "w", encoding="utf-8") as f:
        json.dump({
            "record_id": "sample_normal",
            "covariance": cov_data,
            "current_position": {
                "assets": assets,
                "weights": [0.30, 0.25, 0.20, 0.15, 0.10],
                "source": "sample_normal",
            },
            "transaction_cost": {
                "assets": assets,
                "cost_rate": [0.001, 0.0015, 0.0005, 0.002, 0.001],
                "source": "sample_normal",
            },
            "risk_constraint": {
                "max_single_weight": 0.40,
                "min_single_weight": 0.02,
                "turnover_limit": 0.50,
                "source": "sample_normal",
            },
        }, f, ensure_ascii=False, indent=2)

    cov_singular = cov_normal.copy()
    cov_singular[2] = cov_singular[1] * 0.999 + cov_singular[2] * 0.001
    cov_singular[:, 2] = cov_singular[:, 1] * 0.999 + cov_singular[:, 2] * 0.001

    with open(os.path.join(output_dir, "02_singular_cov.json"), "w", encoding="utf-8") as f:
        json.dump({
            "record_id": "sample_singular",
            "covariance": {
                "assets": assets,
                "matrix": cov_singular.tolist(),
                "source": "sample_singular",
            },
            "current_position": {
                "assets": assets,
                "weights": [0.30, 0.25, 0.20, 0.15, 0.10],
                "source": "sample_singular",
            },
            "transaction_cost": {
                "assets": assets,
                "cost_rate": [0.001, 0.0015, 0.0005, 0.002, 0.001],
                "source": "sample_singular",
            },
        }, f, ensure_ascii=False, indent=2)

    with open(os.path.join(output_dir, "03_weight_out_of_bounds.json"), "w", encoding="utf-8") as f:
        json.dump({
            "record_id": "sample_weight_oob",
            "covariance": {
                "assets": assets,
                "matrix": cov_normal.tolist(),
                "source": "sample_weight_oob",
            },
            "current_position": {
                "assets": assets,
                "weights": [0.50, 0.25, 0.20, 0.03, 0.02],
                "source": "sample_weight_oob",
            },
            "transaction_cost": {
                "assets": assets,
                "cost_rate": [0.001, 0.0015, 0.0005, 0.002, 0.001],
                "source": "sample_weight_oob",
            },
            "risk_constraint": {
                "max_single_weight": 0.40,
                "min_single_weight": 0.05,
                "source": "sample_weight_oob",
            },
        }, f, ensure_ascii=False, indent=2)

    with open(os.path.join(output_dir, "04_missing_cost.json"), "w", encoding="utf-8") as f:
        json.dump({
            "record_id": "sample_missing_cost",
            "covariance": {
                "assets": assets,
                "matrix": cov_normal.tolist(),
                "source": "sample_missing_cost",
            },
            "current_position": {
                "assets": assets,
                "weights": [0.30, 0.25, 0.20, 0.15, 0.10],
                "source": "sample_missing_cost",
            },
        }, f, ensure_ascii=False, indent=2)

    with open(os.path.join(output_dir, "05_no_covariance.json"), "w", encoding="utf-8") as f:
        json.dump({
            "record_id": "sample_no_cov",
            "current_position": {
                "assets": assets,
                "weights": [0.30, 0.25, 0.20, 0.15, 0.10],
                "source": "sample_no_cov",
            },
        }, f, ensure_ascii=False, indent=2)

    print(f"样例数据已生成到: {output_dir}")
    print("  01_normal.json          - 正常流程")
    print("  02_singular_cov.json    - 协方差奇异")
    print("  03_weight_out_of_bounds.json - 权重越界")
    print("  04_missing_cost.json    - 成本漏扣")
    print("  05_no_covariance.json   - 缺少协方差矩阵")


def main():
    parser = argparse.ArgumentParser(
        prog="risk-parity-rebalancer",
        description="风险平价再平衡CLI - 量化助理周调分析工具",
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    run_parser = sub.add_parser("run", help="执行单条再平衡")
    run_parser.add_argument("--record-id", required=True, help="记录ID")
    run_parser.add_argument("--covariance", help="协方差矩阵文件(CSV/JSON)")
    run_parser.add_argument("--position", help="当前持仓文件(CSV/JSON)")
    run_parser.add_argument("--cost", help="交易成本文件(CSV/JSON)")
    run_parser.add_argument("--returns", help="预期收益文件(CSV/JSON)")
    run_parser.add_argument("--constraint", help="风控约束文件(JSON)")
    run_parser.add_argument("--max-weight", type=float, default=0.40)
    run_parser.add_argument("--min-weight", type=float, default=0.02)
    run_parser.add_argument("--turnover-limit", type=float, default=None)
    run_parser.add_argument("--output", "-o", help="报告输出路径")
    run_parser.add_argument("--format", choices=["text", "json", "csv"], default="text")
    run_parser.set_defaults(func=cmd_run)

    batch_parser = sub.add_parser("batch", help="批量执行再平衡")
    batch_parser.add_argument("--input-dir", required=True, help="批量输入目录")
    batch_parser.add_argument("--output", "-o", help="报告输出路径")
    batch_parser.add_argument("--format", choices=["text", "json", "csv"], default="text")
    batch_parser.set_defaults(func=cmd_batch)

    status_parser = sub.add_parser("status", help="查看记录状态")
    status_parser.add_argument("--record-id", required=True, help="记录ID")
    status_parser.set_defaults(func=cmd_status)

    list_parser = sub.add_parser("list", help="列出所有记录")
    list_parser.set_defaults(func=cmd_list)

    delete_parser = sub.add_parser("delete", help="删除记录")
    delete_parser.add_argument("--record-id", required=True, help="记录ID")
    delete_parser.set_defaults(func=cmd_delete)

    sample_parser = sub.add_parser("sample", help="生成样例数据")
    sample_parser.add_argument("--output-dir", default="sample_data", help="输出目录")
    sample_parser.set_defaults(func=cmd_sample)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
