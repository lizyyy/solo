import math
from typing import List, Tuple, Optional
from dataclasses import dataclass
from .data_models import Charge, ChargeSign


@dataclass
class FieldValue:
    ex: float
    ey: float
    magnitude: float
    angle: float

    def to_dict(self):
        return {
            "ex": self.ex,
            "ey": self.ey,
            "magnitude": self.magnitude,
            "angle": self.angle,
        }


class ElectricFieldCalculator:
    def __init__(self, charges: List[Charge], k: float = 1.0):
        self.charges = charges
        self.k = k

    def calculate_at(self, x: float, y: float, exclude_charge: Optional[str] = None) -> Optional[FieldValue]:
        ex_total = 0.0
        ey_total = 0.0

        for charge in self.charges:
            if exclude_charge and charge.charge_id == exclude_charge:
                continue

            cx, cy = charge.position
            dx = x - cx
            dy = y - cy
            r_squared = dx * dx + dy * dy

            if r_squared < 1e-10:
                return None

            r = math.sqrt(r_squared)
            r_cubed = r_squared * r

            q = charge.sign.value * charge.magnitude

            ex = self.k * q * dx / r_cubed
            ey = self.k * q * dy / r_cubed

            ex_total += ex
            ey_total += ey

        magnitude = math.sqrt(ex_total * ex_total + ey_total * ey_total)

        if magnitude < 1e-10:
            angle = 0.0
        else:
            angle = math.atan2(ey_total, ex_total)

        return FieldValue(
            ex=ex_total,
            ey=ey_total,
            magnitude=magnitude,
            angle=angle,
        )

    def calculate_field_magnitude(self, x: float, y: float) -> float:
        field = self.calculate_at(x, y)
        return field.magnitude if field else float("inf")

    def get_expected_direction_at(self, x: float, y: float) -> Optional[Tuple[float, float]]:
        field = self.calculate_at(x, y)
        if field is None or field.magnitude < 1e-10:
            return None
        return (field.ex / field.magnitude, field.ey / field.magnitude)

    def get_business_explanation(self) -> str:
        return "电场计算基于库仑定律：空间任意点的电场是所有电荷产生电场的矢量叠加。正电荷产生向外辐射的电场，负电荷产生向内汇聚的电场，电场强度与距离平方成反比。"

    def explain_calculation_at(self, x: float, y: float) -> str:
        parts = [f"在点 ({x:.2f}, {y:.2f}) 处的电场计算："]
        for charge in self.charges:
            cx, cy = charge.position
            dx = x - cx
            dy = y - cy
            r = math.sqrt(dx * dx + dy * dy)
            sign_name = "正" if charge.sign == ChargeSign.POSITIVE else "负"
            direction = "向外" if charge.sign == ChargeSign.POSITIVE else "向内"
            parts.append(
                f"  - {sign_name}电荷 (位置: {cx:.2f}, {cy:.2f}, 电量: {charge.magnitude:.1f}): "
                f"距离 r={r:.2f}, 电场方向{direction}, 与x轴夹角 {math.atan2(dy, dx)*180/math.pi:.1f}°"
            )
        parts.append(
            "判断规则：学生绘制的电场线方向箭头应与理论电场方向夹角在合理范围内（通常≤90°），"
            "否则可能存在方向颠倒问题。"
        )
        return "\n".join(parts)
