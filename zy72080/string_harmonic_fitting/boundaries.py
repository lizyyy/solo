from typing import Dict, List, Tuple, Optional


DEFAULT_RANGES = {
    "violin": {
        1: (196.0, 300.0),
        2: (293.0, 450.0),
        3: (440.0, 600.0),
        4: (659.0, 900.0),
    },
    "viola": {
        1: (130.0, 220.0),
        2: (196.0, 300.0),
        3: (293.0, 450.0),
        4: (440.0, 600.0),
    },
    "cello": {
        1: (65.0, 130.0),
        2: (98.0, 196.0),
        3: (130.0, 262.0),
        4: (196.0, 350.0),
    },
    "double_bass": {
        1: (31.0, 73.0),
        2: (41.0, 98.0),
        3: (55.0, 130.0),
        4: (73.0, 165.0),
        5: (98.0, 196.0),
    },
}

DEFAULT_B_RANGES = {
    "violin": (-0.001, 0.05),
    "viola": (-0.001, 0.05),
    "cello": (-0.0005, 0.03),
    "double_bass": (-0.0005, 0.02),
}

DEVIATION_THRESHOLD_PCT = 5.0


class BoundaryChecker:
    """
    边界阈值检查器: 检查拟合参数和观测频率是否在合理范围内

    每条告警都包含具体的阈值、实际值和判断依据，方便追溯。
    """

    def __init__(
        self,
        freq_ranges: Optional[Dict[str, Dict[int, Tuple[float, float]]]] = None,
        b_ranges: Optional[Dict[str, Tuple[float, float]]] = None,
        deviation_pct: float = DEVIATION_THRESHOLD_PCT,
    ):
        self.freq_ranges = freq_ranges or DEFAULT_RANGES
        self.b_ranges = b_ranges or DEFAULT_B_RANGES
        self.deviation_pct = deviation_pct

    def check_fitted_params(
        self,
        instrument: str,
        string_index: int,
        fitted_f1: float,
        fitted_B: float,
    ) -> List[str]:
        alerts = []

        inst_range = self.freq_ranges.get(instrument)
        if inst_range and string_index in inst_range:
            low, high = inst_range[string_index]
            if fitted_f1 < low or fitted_f1 > high:
                alerts.append(
                    f"⚠ 拟合基频 f1={fitted_f1:.4f} Hz 超出 {instrument} 第{string_index}弦"
                    f" 参考范围 [{low}, {high}] Hz，"
                    f"阈值来源=DEFAULT_RANGES[{instrument}][{string_index}]"
                )
            else:
                alerts.append(
                    f"✓ 拟合基频 f1={fitted_f1:.4f} Hz 在 {instrument} 第{string_index}弦"
                    f" 参考范围 [{low}, {high}] Hz 内"
                )
        else:
            alerts.append(
                f"ℹ 未找到 {instrument} 第{string_index}弦 的基频参考范围，跳过基频阈值检查"
            )

        b_range = self.b_ranges.get(instrument)
        if b_range:
            b_low, b_high = b_range
            if fitted_B < b_low or fitted_B > b_high:
                alerts.append(
                    f"⚠ 非谐性系数 B={fitted_B:.8f} 超出 {instrument} 参考范围"
                    f" [{b_low}, {b_high}]，"
                    f"阈值来源=DEFAULT_B_RANGES[{instrument}]"
                )
            else:
                alerts.append(
                    f"✓ 非谐性系数 B={fitted_B:.8f} 在 {instrument} 参考范围"
                    f" [{b_low}, {b_high}] 内"
                )
        else:
            alerts.append(f"ℹ 未找到 {instrument} 的 B 系数参考范围，跳过 B 阈值检查")

        return alerts

    def check_observed_freqs(
        self,
        instrument: str,
        string_index: int,
        harmonics: Dict[int, float],
    ) -> List[str]:
        alerts = []
        inst_range = self.freq_ranges.get(instrument)

        for n, freq in sorted(harmonics.items()):
            if inst_range and string_index in inst_range:
                low, high = inst_range[string_index]
                expected_low = n * low
                expected_high = n * high
                if freq < expected_low * (1 - self.deviation_pct / 100):
                    dev = (freq - expected_low) / expected_low * 100
                    alerts.append(
                        f"⚠ 泛音 n={n}, 观测频率 {freq:.4f} Hz 低于预期下限 "
                        f"{expected_low:.4f} Hz 超过 {self.deviation_pct}% "
                        f"(偏差={dev:.2f}%)，阈值来源=弦基频范围×泛音序号"
                    )
                elif freq > expected_high * (1 + self.deviation_pct / 100):
                    dev = (freq - expected_high) / expected_high * 100
                    alerts.append(
                        f"⚠ 泛音 n={n}, 观测频率 {freq:.4f} Hz 高于预期上限 "
                        f"{expected_high:.4f} Hz 超过 {self.deviation_pct}% "
                        f"(偏差={dev:.2f}%)，阈值来源=弦基频范围×泛音序号"
                    )

        return alerts

    def check_out_of_bounds(
        self,
        sample_freq: float,
        expected_low: float,
        expected_high: float,
    ) -> Tuple[bool, str]:
        if sample_freq < expected_low:
            dev = (sample_freq - expected_low) / expected_low * 100
            msg = (
                f"⚠ 频率 {sample_freq:.4f} Hz 低于下限 {expected_low:.4f} Hz "
                f"(偏差={dev:.2f}%)"
            )
            return True, msg
        elif sample_freq > expected_high:
            dev = (sample_freq - expected_high) / expected_high * 100
            msg = (
                f"⚠ 频率 {sample_freq:.4f} Hz 高于上限 {expected_high:.4f} Hz "
                f"(偏差={dev:.2f}%)"
            )
            return True, msg
        return False, f"✓ 频率 {sample_freq:.4f} Hz 在 [{expected_low:.4f}, {expected_high:.4f}] Hz 内"
