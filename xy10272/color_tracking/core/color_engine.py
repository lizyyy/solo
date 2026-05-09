import math
from typing import Tuple, Optional
from ..models import ColorSample, ColorDelta


DEFAULT_TOLERANCE = {
    "delta_e2000_warning": 2.0,
    "delta_e2000_critical": 4.0,
    "delta_e76_warning": 3.0,
    "delta_e76_critical": 6.0,
}


class ColorEngine:
    @staticmethod
    def _to_radians(degrees: float) -> float:
        return degrees * math.pi / 180.0

    @staticmethod
    def _to_degrees(radians: float) -> float:
        return radians * 180.0 / math.pi

    @staticmethod
    def calculate_delta_e76(
        sample1: ColorSample,
        sample2: ColorSample
    ) -> float:
        delta_l = sample2.lab_l - sample1.lab_l
        delta_a = sample2.lab_a - sample1.lab_a
        delta_b = sample2.lab_b - sample1.lab_b
        return math.sqrt(delta_l ** 2 + delta_a ** 2 + delta_b ** 2)

    @staticmethod
    def calculate_delta_e2000(
        sample1: ColorSample,
        sample2: ColorSample,
        kL: float = 1.0,
        kC: float = 1.0,
        kH: float = 1.0
    ) -> float:
        L1, a1, b1 = sample1.lab_l, sample1.lab_a, sample1.lab_b
        L2, a2, b2 = sample2.lab_l, sample2.lab_a, sample2.lab_b

        C1 = math.sqrt(a1 ** 2 + b1 ** 2)
        C2 = math.sqrt(a2 ** 2 + b2 ** 2)
        C_ = (C1 + C2) / 2.0

        G = 0.5 * (1.0 - math.sqrt((C_ ** 7) / (C_ ** 7 + 25.0 ** 7)))

        a1_prime = a1 * (1.0 + G)
        a2_prime = a2 * (1.0 + G)

        C1_prime = math.sqrt(a1_prime ** 2 + b1 ** 2)
        C2_prime = math.sqrt(a2_prime ** 2 + b2 ** 2)

        h1_prime = math.atan2(b1, a1_prime)
        if h1_prime < 0:
            h1_prime += 2.0 * math.pi

        h2_prime = math.atan2(b2, a2_prime)
        if h2_prime < 0:
            h2_prime += 2.0 * math.pi

        delta_L_prime = L2 - L1
        delta_C_prime = C2_prime - C1_prime

        delta_h_prime = 0.0
        if C1_prime * C2_prime != 0:
            delta_h = h2_prime - h1_prime
            if abs(delta_h) <= math.pi:
                delta_h_prime = delta_h
            elif delta_h > math.pi:
                delta_h_prime = delta_h - 2.0 * math.pi
            else:
                delta_h_prime = delta_h + 2.0 * math.pi

        delta_H_prime = 2.0 * math.sqrt(C1_prime * C2_prime) * math.sin(delta_h_prime / 2.0)

        L_prime = (L1 + L2) / 2.0
        C_prime = (C1_prime + C2_prime) / 2.0

        h_prime = 0.0
        if C1_prime * C2_prime != 0:
            if abs(h1_prime - h2_prime) <= math.pi:
                h_prime = (h1_prime + h2_prime) / 2.0
            elif (h1_prime + h2_prime) < 2.0 * math.pi:
                h_prime = (h1_prime + h2_prime) / 2.0 + math.pi
            else:
                h_prime = (h1_prime + h2_prime) / 2.0 - math.pi

        T = 1.0 - 0.17 * math.cos(h_prime - ColorEngine._to_radians(30)) + \
            0.24 * math.cos(2.0 * h_prime) + \
            0.32 * math.cos(3.0 * h_prime + ColorEngine._to_radians(6)) - \
            0.20 * math.cos(4.0 * h_prime - ColorEngine._to_radians(63))

        delta_theta = ColorEngine._to_radians(30) * math.exp(-((ColorEngine._to_degrees(h_prime) - 275) / 25.0) ** 2)
        R_C = 2.0 * math.sqrt((C_prime ** 7) / (C_prime ** 7 + 25.0 ** 7))
        S_L = 1.0 + (0.015 * (L_prime - 50.0) ** 2) / math.sqrt(20.0 + (L_prime - 50.0) ** 2)
        S_C = 1.0 + 0.045 * C_prime
        S_H = 1.0 + 0.015 * C_prime * T
        R_T = -math.sin(2.0 * delta_theta) * R_C

        term_L = delta_L_prime / (kL * S_L)
        term_C = delta_C_prime / (kC * S_C)
        term_H = delta_H_prime / (kH * S_H)

        return math.sqrt(term_L ** 2 + term_C ** 2 + term_H ** 2 + R_T * term_C * term_H)

    @staticmethod
    def calculate_color_delta(
        reference: ColorSample,
        measured: ColorSample
    ) -> ColorDelta:
        delta_e76 = ColorEngine.calculate_delta_e76(reference, measured)
        delta_e2000 = ColorEngine.calculate_delta_e2000(reference, measured)

        delta_l = measured.lab_l - reference.lab_l
        delta_a = measured.lab_a - reference.lab_a
        delta_b = measured.lab_b - reference.lab_b

        C1 = math.sqrt(reference.lab_a ** 2 + reference.lab_b ** 2)
        C2 = math.sqrt(measured.lab_a ** 2 + measured.lab_b ** 2)
        delta_c = C2 - C1

        h1 = math.atan2(reference.lab_b, reference.lab_a)
        h2 = math.atan2(measured.lab_b, measured.lab_a)
        delta_h = h2 - h1
        if delta_h > math.pi:
            delta_h -= 2.0 * math.pi
        elif delta_h < -math.pi:
            delta_h += 2.0 * math.pi

        return ColorDelta(
            delta_e76=delta_e76,
            delta_e2000=delta_e2000,
            delta_l=delta_l,
            delta_a=delta_a,
            delta_b=delta_b,
            delta_c=delta_c,
            delta_h=ColorEngine._to_degrees(delta_h),
        )

    @staticmethod
    def check_tolerance(
        delta_e2000: float,
        tolerance: dict = None
    ) -> Tuple[str, str]:
        tol = tolerance or DEFAULT_TOLERANCE
        if delta_e2000 >= tol["delta_e2000_critical"]:
            return "CRITICAL", f"ΔE2000 = {delta_e2000:.2f} 超过临界值 {tol['delta_e2000_critical']}"
        elif delta_e2000 >= tol["delta_e2000_warning"]:
            return "WARNING", f"ΔE2000 = {delta_e2000:.2f} 接近警戒值 {tol['delta_e2000_warning']}"
        else:
            return "NORMAL", f"ΔE2000 = {delta_e2000:.2f} 在容差范围内"

    @staticmethod
    def interpret_delta(color_delta: ColorDelta) -> dict:
        interpretations = []

        if abs(color_delta.delta_l) > 0.5:
            if color_delta.delta_l > 0:
                interpretations.append(f"偏亮 +{color_delta.delta_l:.2f}")
            else:
                interpretations.append(f"偏暗 {color_delta.delta_l:.2f}")

        if abs(color_delta.delta_a) > 0.5:
            if color_delta.delta_a > 0:
                interpretations.append(f"偏红 +{color_delta.delta_a:.2f}")
            else:
                interpretations.append(f"偏绿 {color_delta.delta_a:.2f}")

        if abs(color_delta.delta_b) > 0.5:
            if color_delta.delta_b > 0:
                interpretations.append(f"偏黄 +{color_delta.delta_b:.2f}")
            else:
                interpretations.append(f"偏蓝 {color_delta.delta_b:.2f}")

        return {
            "interpretations": interpretations,
            "recommendation": ColorEngine._generate_recommendation(color_delta),
        }

    @staticmethod
    def _generate_recommendation(color_delta: ColorDelta) -> str:
        recommendations = []

        if color_delta.delta_l > 0.3:
            recommendations.append("降低墨层厚度")
        elif color_delta.delta_l < -0.3:
            recommendations.append("增加墨层厚度")

        if color_delta.delta_a > 0.3:
            recommendations.append("减少品红墨量")
        elif color_delta.delta_a < -0.3:
            recommendations.append("增加品红墨量")

        if color_delta.delta_b > 0.3:
            recommendations.append("减少黄墨量")
        elif color_delta.delta_b < -0.3:
            recommendations.append("增加黄墨量")

        return ", ".join(recommendations) if recommendations else "无需调整"
