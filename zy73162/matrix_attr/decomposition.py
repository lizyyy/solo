from __future__ import annotations

import warnings
from typing import Dict, List, Optional, Tuple

import numpy as np

from .models import AttrStatus, AttributionRecord, Influence, ParamVersion, SourceType


class EmptyInputError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(f"空集合输入，已拦截: {detail}")
        self.detail = detail


class ZeroDivisionSuspend(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(f"除零边界，已挂起待人工确认: {detail}")
        self.detail = detail


def _build_matrix(
    param: ParamVersion,
) -> Tuple[np.ndarray, List[str], List[str]]:
    kps = sorted(param.knowledge_points)
    qids = sorted(param.question_ids)
    if not kps or not qids:
        raise EmptyInputError("知识点或题目列表为空")
    W = np.zeros((len(qids), len(kps)), dtype=float)
    for i, q in enumerate(qids):
        for j, k in enumerate(kps):
            W[i, j] = param.weight_matrix.get((q, k), 0.0)
    if np.count_nonzero(W) == 0:
        raise EmptyInputError("权重矩阵全为零")
    return W, kps, qids


class MatrixDecomposer:
    def __init__(self, max_iter: int = 200, tol: float = 1e-4, rank: Optional[int] = None) -> None:
        self.max_iter = max_iter
        self.tol = tol
        self.rank = rank

    def decompose(
        self,
        param: ParamVersion,
        question_id: str,
        error_vector: Optional[Dict[str, float]] = None,
    ) -> Tuple[Dict[str, float], float, List[str]]:
        if param.is_empty():
            raise EmptyInputError(f"参数表 {param.version} 为空集合")

        W, kps, qids = _build_matrix(param)

        if question_id not in qids:
            raise EmptyInputError(f"题目 {question_id} 不在参数表中")

        q_idx = qids.index(question_id)
        row = W[q_idx, :]

        if error_vector is None:
            e_vec = row.copy()
        else:
            e_vec = np.array([error_vector.get(k, 0.0) for k in kps], dtype=float)

        total_err = float(e_vec.sum())
        if abs(total_err) < 1e-12:
            raise ZeroDivisionSuspend(
                f"题目 {question_id} 错误总量接近零，无法归一化归因，需排班同事确认"
            )

        if total_err < 0:
            raise ZeroDivisionSuspend(
                f"题目 {question_id} 错误总量为负（{total_err:.4f}），口径异常，需人工确认"
            )

        denom = float(row.sum())
        if abs(denom) < 1e-12:
            raise ZeroDivisionSuspend(
                f"题目 {question_id} 知识点权重之和为零，除零边界，挂起待确认"
            )

        with warnings.catch_warnings():
            warnings.simplefilter("error", RuntimeWarning)
            try:
                raw_weights = (e_vec * row) / denom
            except RuntimeWarning as exc:
                raise ZeroDivisionSuspend(
                    f"题目 {question_id} 归因乘积计算触发浮点异常（{exc}），挂起待人工确认"
                )

        if not np.all(np.isfinite(raw_weights)):
            nan_kps = [kps[i] for i in np.where(~np.isfinite(raw_weights))[0]]
            raise ZeroDivisionSuspend(
                f"题目 {question_id} 归因乘积出现 NaN/Inf（涉及知识点: {nan_kps}），挂起待人工确认"
            )

        raw_sum = float(raw_weights.sum())
        if abs(raw_sum) < 1e-12:
            row_mask = row > 1e-12
            err_mask = e_vec > 1e-12
            covered = [kps[i] for i in np.where(row_mask)[0]]
            errored = [kps[i] for i in np.where(err_mask)[0]]
            raise ZeroDivisionSuspend(
                f"题目权重与错误向量无有效归因交集，需要排班同事确认材料。"
                f"题目覆盖知识点: {covered}，错误向量落在: {errored}"
            )

        weights = raw_weights / raw_sum

        ordered_idx = np.argsort(-weights)
        ordered_kps = [kps[i] for i in ordered_idx if weights[i] > 1e-6]
        weight_map: Dict[str, float] = {}
        for k, w in zip(kps, weights):
            if w > 1e-6:
                weight_map[k] = float(w)

        top_k = ordered_kps[0] if ordered_kps else (kps[0] if kps else "")
        confidence = float(weights[ordered_idx[0]]) if ordered_kps else 0.0

        return weight_map, confidence, [top_k]

    def apply_to_record(
        self,
        record: AttributionRecord,
        param: ParamVersion,
        source_type: SourceType,
        source_id: str,
        error_vector: Optional[Dict[str, float]] = None,
    ) -> AttributionRecord:
        old_weights = dict(record.knowledge_weights)
        old_cause = record.primary_cause
        old_conf = record.confidence

        try:
            new_weights, conf, tops = self.decompose(
                param, record.question_id, error_vector
            )
        except EmptyInputError as exc:
            record.status = AttrStatus.SUSPENDED
            record.suspend_reason = exc.detail
            record.touch()
            record.influences.append(
                Influence(
                    source_type=source_type,
                    source_id=source_id,
                    delta=0.0,
                    detail=f"空集合拦截: {exc.detail}",
                )
            )
            return record
        except ZeroDivisionSuspend as exc:
            record.status = AttrStatus.SUSPENDED
            record.suspend_reason = exc.detail
            record.touch()
            record.influences.append(
                Influence(
                    source_type=source_type,
                    source_id=source_id,
                    delta=0.0,
                    detail=f"除零挂起: {exc.detail}",
                )
            )
            return record

        delta = 0.0
        for k, v in new_weights.items():
            delta += abs(v - old_weights.get(k, 0.0))
        for k, v in old_weights.items():
            if k not in new_weights:
                delta += v

        record.knowledge_weights = new_weights
        record.primary_cause = tops[0] if tops else old_cause
        record.confidence = conf
        record.status = AttrStatus.NORMAL
        record.suspend_reason = None
        record.revision_count += 1
        record.touch()

        record.influences.append(
            Influence(
                source_type=source_type,
                source_id=source_id,
                delta=delta,
                detail=f"主因从 {old_cause!r} → {record.primary_cause!r}，置信度 {old_conf:.3f} → {conf:.3f}",
            )
        )
        return record
