import json
from datetime import datetime
from typing import Dict, List, Optional, Iterable


class WeightManager:
    """
    权重管理器: 管理泛音拟合中的权重分配、闭合校验和变更记录

    权重闭合: 同一乐器同一弦上所有泛音权重之和应为 1.0（允许小误差）
    变更记录: 每次权重修改都留下 who/when/why
    """

    TOLERANCE = 0.02

    def __init__(self):
        self._weights: Dict[str, Dict[int, float]] = {}
        self._change_log: Dict[str, List[str]] = {}

    def _key(self, instrument: str, string_index: int) -> str:
        return f"{instrument}_s{string_index}"

    def set_weights(
        self,
        instrument: str,
        string_index: int,
        weights: Dict[int, float],
        operator: str = "",
        reason: str = "",
    ):
        k = self._key(instrument, string_index)
        old = self._weights.get(k, {})
        self._weights[k] = dict(weights)
        ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        log_entry = (
            f"[{ts}] {operator or 'system'}: "
            f"权重变更 {self._fmt(old)} → {self._fmt(weights)}"
            f"{'; 原因: ' + reason if reason else ''}"
        )
        if k not in self._change_log:
            self._change_log[k] = []
        self._change_log[k].append(log_entry)

    def get_weights(
        self,
        instrument: str,
        string_index: int,
        harmonic_numbers: Iterable[int],
    ) -> Dict[int, float]:
        k = self._key(instrument, string_index)
        stored = self._weights.get(k)
        if stored:
            return {n: stored.get(n, 1.0) for n in harmonic_numbers}
        n_list = sorted(harmonic_numbers)
        total = len(n_list)
        w = 1.0 / total if total > 0 else 1.0
        return {n: round(w, 4) for n in n_list}

    def check_closure(self, weights: Dict[int, float]) -> List[str]:
        warnings = []
        total = sum(weights.values())
        if abs(total - 1.0) > self.TOLERANCE:
            warnings.append(
                f"⚠ 权重闭合检查: 当前权重之和 = {total:.4f}，"
                f"偏离 1.0 超过容差 {self.TOLERANCE}，建议调整权重使其闭合"
            )
        else:
            warnings.append(
                f"✓ 权重闭合检查通过: 权重之和 = {total:.4f}（容差 ±{self.TOLERANCE}）"
            )
        for n, w in weights.items():
            if w < 0:
                warnings.append(f"⚠ 泛音 {n} 权重为负 ({w})，可能导致拟合结果不可靠")
            if w == 0:
                warnings.append(f"⚠ 泛音 {n} 权重为零，该数据点将被忽略")
        return warnings

    def get_change_log(self, instrument: str, string_index: int) -> List[str]:
        k = self._key(instrument, string_index)
        return self._change_log.get(k, [])

    def normalize(self, weights: Dict[int, float]) -> Dict[int, float]:
        total = sum(weights.values())
        if total == 0:
            return weights
        return {n: round(w / total, 4) for n, w in weights.items()}

    def _fmt(self, weights: Dict[int, float]) -> str:
        pairs = sorted(weights.items())
        return "{" + ", ".join(f"{n}:{w:.4f}" for n, w in pairs) + "}"

    def save(self, path: str):
        data = {
            "weights": {k: {str(nk): nv for nk, nv in v.items()} for k, v in self._weights.items()},
            "change_log": self._change_log,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, path: str):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self._weights = {
            k: {int(nk): nv for nk, nv in v.items()}
            for k, v in data.get("weights", {}).items()
        }
        self._change_log = data.get("change_log", {})
