from typing import Dict, Tuple, Optional


UNIT_FACTORS = {
    "Hz": 1.0,
    "kHz": 1000.0,
    "mHz": 0.001,
    "cHz": 0.01,
}

CENTS_PER_OCTAVE = 1200.0


class UnitConverter:
    """
    单位换算器: 支持 Hz / kHz / mHz / cHz 之间的换算，以及频率到音分偏差的转换

    每次换算都会生成可读提示，确保不会"闪一下就没了"。
    """

    def __init__(self, factors: Optional[Dict[str, float]] = None):
        self._factors = factors or UNIT_FACTORS

    def factor(self, unit: str) -> float:
        return self._factors.get(unit, 1.0)

    def to_hz(self, value: float, unit: str) -> float:
        f = self.factor(unit)
        return value * f

    def from_hz(self, value_hz: float, target_unit: str) -> float:
        f = self.factor(target_unit)
        if f == 0:
            return 0.0
        return value_hz / f

    def hz_to_cents(self, freq: float, ref_freq: float) -> float:
        if ref_freq <= 0 or freq <= 0:
            return 0.0
        return CENTS_PER_OCTAVE * (math_log2(freq / ref_freq))

    def cents_to_hz(self, cents: float, ref_freq: float) -> float:
        return ref_freq * (2.0 ** (cents / CENTS_PER_OCTAVE))

    def convert_with_note(
        self, value: float, from_unit: str, to_unit: str
    ) -> Tuple[float, str]:
        if from_unit == to_unit:
            return value, f"✓ 单位相同({from_unit})，无需换算"

        value_hz = self.to_hz(value, from_unit)
        result = self.from_hz(value_hz, to_unit)
        note = (
            f"单位换算: {value} {from_unit} → {result:.6f} {to_unit} "
            f"(经 Hz 中转: {value_hz:.6f} Hz, "
            f"系数 {from_unit}→Hz={self.factor(from_unit)}, "
            f"Hz→{to_unit}=1/{self.factor(to_unit)})"
        )
        return result, note

    def cents_deviation_note(
        self, observed: float, expected: float, unit: str = "Hz"
    ) -> Tuple[float, str]:
        obs_hz = self.to_hz(observed, unit)
        exp_hz = self.to_hz(expected, unit)
        cents = self.hz_to_cents(obs_hz, exp_hz)
        note = (
            f"音分偏差: 观测={obs_hz:.4f} Hz, 预期={exp_hz:.4f} Hz, "
            f"偏差={cents:+.2f} cents "
            f"(1 cent = 1/1200 oct, 正值=偏高, 负值=偏低)"
        )
        return cents, note


def math_log2(x):
    import math
    return math.log2(x)
