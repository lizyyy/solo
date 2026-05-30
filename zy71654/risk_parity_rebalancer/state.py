from __future__ import annotations

import json
import os
from typing import Optional

from .models import (
    AssetReturn,
    CovarianceMatrix,
    PositionWeight,
    RecordStatus,
    RebalanceRecord,
    RiskConstraint,
    TransactionCost,
)

import numpy as np


_STATE_DIR = os.path.join(os.path.expanduser("~"), ".risk_parity_rebalancer")


def _ensure_dir():
    os.makedirs(_STATE_DIR, exist_ok=True)


def _record_path(record_id: str) -> str:
    _ensure_dir()
    return os.path.join(_STATE_DIR, f"{record_id}.json")


def _ndarray_to_list(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


def _serialize_record(record: RebalanceRecord) -> dict:
    d = {
        "record_id": record.record_id,
        "status": record.status.value,
        "validation_issues": [
            {
                "flag": i.flag.value,
                "message": i.message,
                "asset_indices": i.asset_indices,
                "severity": i.severity,
            }
            for i in record.validation_issues
        ],
        "rejection_reasons": record.rejection_reasons,
        "audit_trail": record.audit_trail,
    }

    if record.asset_return is not None:
        d["asset_return"] = {
            "assets": record.asset_return.assets,
            "expected_returns": _ndarray_to_list(record.asset_return.expected_returns),
            "source": record.asset_return.source,
        }
    if record.covariance is not None:
        d["covariance"] = {
            "assets": record.covariance.assets,
            "matrix": _ndarray_to_list(record.covariance.matrix),
            "source": record.covariance.source,
        }
    if record.current_position is not None:
        d["current_position"] = {
            "assets": record.current_position.assets,
            "weights": _ndarray_to_list(record.current_position.weights),
            "source": record.current_position.source,
        }
    if record.transaction_cost is not None:
        d["transaction_cost"] = {
            "assets": record.transaction_cost.assets,
            "cost_rate": _ndarray_to_list(record.transaction_cost.cost_rate),
            "source": record.transaction_cost.source,
        }
    if record.risk_constraint is not None:
        rc = record.risk_constraint
        d["risk_constraint"] = {
            "max_single_weight": rc.max_single_weight,
            "min_single_weight": rc.min_single_weight,
            "turnover_limit": rc.turnover_limit,
            "source": rc.source,
        }
        if rc.weight_lower is not None:
            d["risk_constraint"]["weight_lower"] = _ndarray_to_list(rc.weight_lower)
        if rc.weight_upper is not None:
            d["risk_constraint"]["weight_upper"] = _ndarray_to_list(rc.weight_upper)

    return d


def _deserialize_record(d: dict) -> RebalanceRecord:
    record = RebalanceRecord(
        record_id=d["record_id"],
        status=RecordStatus(d["status"]),
        rejection_reasons=d.get("rejection_reasons", []),
        audit_trail=d.get("audit_trail", []),
    )

    if "asset_return" in d and d["asset_return"]:
        ar = d["asset_return"]
        record.asset_return = AssetReturn(
            assets=ar["assets"],
            expected_returns=ar["expected_returns"],
            source=ar.get("source", ""),
        )
    if "covariance" in d and d["covariance"]:
        cv = d["covariance"]
        record.covariance = CovarianceMatrix(
            assets=cv["assets"],
            matrix=cv["matrix"],
            source=cv.get("source", ""),
        )
    if "current_position" in d and d["current_position"]:
        cp = d["current_position"]
        record.current_position = PositionWeight(
            assets=cp["assets"],
            weights=cp["weights"],
            source=cp.get("source", ""),
        )
    if "transaction_cost" in d and d["transaction_cost"]:
        tc = d["transaction_cost"]
        record.transaction_cost = TransactionCost(
            assets=tc["assets"],
            cost_rate=tc["cost_rate"],
            source=tc.get("source", ""),
        )
    if "risk_constraint" in d and d["risk_constraint"]:
        rc = d["risk_constraint"]
        record.risk_constraint = RiskConstraint(
            max_single_weight=rc.get("max_single_weight", 0.40),
            min_single_weight=rc.get("min_single_weight", 0.02),
            turnover_limit=rc.get("turnover_limit"),
            source=rc.get("source", ""),
            weight_lower=np.array(rc["weight_lower"]) if "weight_lower" in rc else None,
            weight_upper=np.array(rc["weight_upper"]) if "weight_upper" in rc else None,
        )

    from .models import ValidationFlag, ValidationIssue
    record.validation_issues = []
    for i in d.get("validation_issues", []):
        record.validation_issues.append(ValidationIssue(
            flag=ValidationFlag(i["flag"]),
            message=i["message"],
            asset_indices=i.get("asset_indices"),
            severity=i.get("severity", "error"),
        ))

    return record


class StateStore:
    def save(self, record: RebalanceRecord) -> str:
        path = _record_path(record.record_id)
        data = _serialize_record(record)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        return path

    def load(self, record_id: str) -> Optional[RebalanceRecord]:
        path = _record_path(record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return _deserialize_record(data)

    def list_records(self) -> list[str]:
        _ensure_dir()
        records = []
        for f in os.listdir(_STATE_DIR):
            if f.endswith(".json"):
                records.append(f[:-5])
        return sorted(records)

    def delete(self, record_id: str) -> bool:
        path = _record_path(record_id)
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    def update_materials(self, record_id: str, **kwargs) -> Optional[RebalanceRecord]:
        record = self.load(record_id)
        if record is None:
            return None

        if "covariance" in kwargs and kwargs["covariance"] is not None:
            record.covariance = kwargs["covariance"]
        if "asset_return" in kwargs and kwargs["asset_return"] is not None:
            record.asset_return = kwargs["asset_return"]
        if "current_position" in kwargs and kwargs["current_position"] is not None:
            record.current_position = kwargs["current_position"]
        if "transaction_cost" in kwargs and kwargs["transaction_cost"] is not None:
            record.transaction_cost = kwargs["transaction_cost"]
        if "risk_constraint" in kwargs and kwargs["risk_constraint"] is not None:
            record.risk_constraint = kwargs["risk_constraint"]

        record.add_audit("material_update", f"材料已更新：{list(kwargs.keys())}")
        self.save(record)
        return record
