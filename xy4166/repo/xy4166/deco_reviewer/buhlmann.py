import math
from typing import List, Optional, Tuple

from .models import (
    DiveLog,
    DiveProfilePoint,
    GasMix,
    TissueCompartment,
    CalculationResult,
)


class BuhlmannModel:
    """Bühlmann ZH-L16C 简化减压模型"""

    ZH_L16C_COMPARTMENTS = [
        {"id": 1, "n2_half_time": 5.0, "n2_a": 1.1696, "n2_b": 0.5578, "he_half_time": 1.88, "he_a": 1.6189, "he_b": 0.4770},
        {"id": 2, "n2_half_time": 8.0, "n2_a": 1.0000, "n2_b": 0.6514, "he_half_time": 3.02, "he_a": 1.3830, "he_b": 0.5747},
        {"id": 3, "n2_half_time": 12.5, "n2_a": 0.8618, "n2_b": 0.7222, "he_half_time": 4.72, "he_a": 1.1919, "he_b": 0.6527},
        {"id": 4, "n2_half_time": 18.5, "n2_a": 0.7562, "n2_b": 0.7825, "he_half_time": 6.99, "he_a": 1.0458, "he_b": 0.7223},
        {"id": 5, "n2_half_time": 27.0, "n2_a": 0.6667, "n2_b": 0.8126, "he_half_time": 10.21, "he_a": 0.9220, "he_b": 0.7582},
        {"id": 6, "n2_half_time": 38.3, "n2_a": 0.5933, "n2_b": 0.8434, "he_half_time": 14.48, "he_a": 0.8205, "he_b": 0.7957},
        {"id": 7, "n2_half_time": 54.3, "n2_a": 0.5282, "n2_b": 0.8693, "he_half_time": 20.53, "he_a": 0.7305, "he_b": 0.8279},
        {"id": 8, "n2_half_time": 77.0, "n2_a": 0.4701, "n2_b": 0.8910, "he_half_time": 29.11, "he_a": 0.6502, "he_b": 0.8553},
        {"id": 9, "n2_half_time": 109.0, "n2_a": 0.4187, "n2_b": 0.9092, "he_half_time": 41.20, "he_a": 0.5794, "he_b": 0.8757},
        {"id": 10, "n2_half_time": 146.0, "n2_a": 0.3798, "n2_b": 0.9222, "he_half_time": 55.19, "he_a": 0.5256, "he_b": 0.8903},
        {"id": 11, "n2_half_time": 187.0, "n2_a": 0.3497, "n2_b": 0.9319, "he_half_time": 70.69, "he_a": 0.4840, "he_b": 0.8997},
        {"id": 12, "n2_half_time": 239.0, "n2_a": 0.3223, "n2_b": 0.9403, "he_half_time": 90.34, "he_a": 0.4460, "he_b": 0.9073},
        {"id": 13, "n2_half_time": 305.0, "n2_a": 0.2971, "n2_b": 0.9477, "he_half_time": 115.29, "he_a": 0.4112, "he_b": 0.9122},
        {"id": 14, "n2_half_time": 390.0, "n2_a": 0.2737, "n2_b": 0.9544, "he_half_time": 147.42, "he_a": 0.3788, "he_b": 0.9171},
        {"id": 15, "n2_half_time": 498.0, "n2_a": 0.2523, "n2_b": 0.9602, "he_half_time": 188.24, "he_a": 0.3492, "he_b": 0.9217},
        {"id": 16, "n2_half_time": 635.0, "n2_a": 0.2327, "n2_b": 0.9653, "he_half_time": 240.03, "he_a": 0.3220, "he_b": 0.9267},
    ]

    def __init__(self, gradient_factor_low: float = 0.30, gradient_factor_high: float = 0.85):
        self.gradient_factor_low = gradient_factor_low
        self.gradient_factor_high = gradient_factor_high
        self.compartments: List[TissueCompartment] = self._initialize_compartments()

    def _initialize_compartments(self) -> List[TissueCompartment]:
        """初始化组织隔室"""
        compartments = []
        for comp in self.ZH_L16C_COMPARTMENTS:
            compartments.append(TissueCompartment(
                compartment_id=comp["id"],
                n2_half_time=comp["n2_half_time"],
                n2_a=comp["n2_a"],
                n2_b=comp["n2_b"],
                he_half_time=comp["he_half_time"],
                he_a=comp["he_a"],
                he_b=comp["he_b"],
                current_p_n2=0.79,
                current_p_he=0.0,
            ))
        return compartments

    def apply_surface_interval(self, surface_interval_minutes: int):
        """应用水面间隔（组织脱饱和）"""
        if surface_interval_minutes <= 0:
            return

        surface_p_n2 = 0.79
        surface_p_he = 0.0

        for comp in self.compartments:
            n2_k = math.log(2) / comp.n2_half_time
            he_k = math.log(2) / comp.he_half_time

            comp.current_p_n2 = surface_p_n2 + (comp.current_p_n2 - surface_p_n2) * math.exp(-n2_k * surface_interval_minutes)
            comp.current_p_he = surface_p_he + (comp.current_p_he - surface_p_he) * math.exp(-he_k * surface_interval_minutes)

    def calculate(self, dive_log: DiveLog) -> CalculationResult:
        """计算整个潜水剖面的组织压力"""
        if dive_log.surface_interval_minutes:
            self.apply_surface_interval(dive_log.surface_interval_minutes)

        profile = dive_log.profile
        gas_mix = dive_log.gas_mix

        if not profile:
            return self._create_empty_result()

        cns_accum = 0.0
        otu_accum = 0.0

        for i in range(len(profile) - 1):
            start_point = profile[i]
            end_point = profile[i + 1]
            duration = end_point.time - start_point.time

            if duration <= 0:
                continue

            avg_depth = (start_point.depth + end_point.depth) / 2
            start_p_ambient = self._depth_to_bar(start_point.depth)
            end_p_ambient = self._depth_to_bar(end_point.depth)

            self._update_tissue_pressures(
                start_p_ambient=start_p_ambient,
                end_p_ambient=end_p_ambient,
                gas_mix=gas_mix,
                duration_minutes=duration,
            )

            cns_part, otu_part = self._calculate_oxygen_toxicity(
                avg_depth=avg_depth,
                gas_mix=gas_mix,
                duration_minutes=duration,
            )
            cns_accum += cns_part
            otu_accum += otu_part

        current_ndl = self._calculate_current_ndl(profile[-1].depth, gas_mix)
        max_depth = max(p.depth for p in profile)
        max_ndl = self._calculate_ndl_at_depth(max_depth, gas_mix)

        leading_comp, m_value_ratio = self._get_leading_compartment(self._depth_to_bar(0))

        return CalculationResult(
            tissue_compartments=self.compartments.copy(),
            current_ndl=current_ndl,
            max_ndl=max_ndl,
            cns_percentage=cns_accum,
            otu_value=otu_accum,
            leading_compartment=leading_comp,
            m_value_ratio=m_value_ratio,
        )

    def _update_tissue_pressures(
        self,
        start_p_ambient: float,
        end_p_ambient: float,
        gas_mix: GasMix,
        duration_minutes: float,
    ):
        """更新组织压力（使用Schreiner方程）"""
        p_inert_n2 = gas_mix.p_n2
        p_inert_he = gas_mix.p_he

        rate_of_change_n2 = (p_inert_n2 * (end_p_ambient - start_p_ambient)) / duration_minutes if duration_minutes > 0 else 0
        rate_of_change_he = (p_inert_he * (end_p_ambient - start_p_ambient)) / duration_minutes if duration_minutes > 0 else 0

        for comp in self.compartments:
            n2_k = math.log(2) / comp.n2_half_time
            he_k = math.log(2) / comp.he_half_time

            initial_p_i_n2 = p_inert_n2 * start_p_ambient
            initial_p_i_he = p_inert_he * start_p_ambient

            comp.current_p_n2 = self._schreiner_equation(
                p_tissue=comp.current_p_n2,
                p_i=initial_p_i_n2,
                rate=rate_of_change_n2,
                k=n2_k,
                time=duration_minutes,
            )

            comp.current_p_he = self._schreiner_equation(
                p_tissue=comp.current_p_he,
                p_i=initial_p_i_he,
                rate=rate_of_change_he,
                k=he_k,
                time=duration_minutes,
            )

    def _schreiner_equation(
        self,
        p_tissue: float,
        p_i: float,
        rate: float,
        k: float,
        time: float,
    ) -> float:
        """Schreiner方程用于计算组织压力变化"""
        exp_kt = math.exp(-k * time)
        return p_i + rate * (time - 1.0 / k) - (p_i - p_tissue - rate / k) * exp_kt

    def _calculate_current_ndl(self, current_depth: float, gas_mix: GasMix) -> Optional[int]:
        """计算当前深度下剩余的无减压极限"""
        return self._calculate_ndl_at_depth(current_depth, gas_mix)

    def _calculate_ndl_at_depth(self, depth: float, gas_mix: GasMix) -> int:
        """计算给定深度的无减压极限（NDL）"""
        p_ambient = self._depth_to_bar(depth)
        p_inert_n2 = gas_mix.p_n2 * p_ambient
        p_inert_he = gas_mix.p_he * p_ambient

        surface_p = 1.0

        max_time = 0
        time_increment = 1

        while max_time < 300:
            test_compartments = []
            for comp in self.compartments:
                n2_k = math.log(2) / comp.n2_half_time
                he_k = math.log(2) / comp.he_half_time

                test_p_n2 = p_inert_n2 + (comp.current_p_n2 - p_inert_n2) * math.exp(-n2_k * max_time)
                test_p_he = p_inert_he + (comp.current_p_he - p_inert_he) * math.exp(-he_k * max_time)

                test_compartment = TissueCompartment(
                    compartment_id=comp.compartment_id,
                    n2_half_time=comp.n2_half_time,
                    n2_a=comp.n2_a,
                    n2_b=comp.n2_b,
                    he_half_time=comp.he_half_time,
                    he_a=comp.he_a,
                    he_b=comp.he_b,
                    current_p_n2=test_p_n2,
                    current_p_he=test_p_he,
                )
                test_compartments.append(test_compartment)

            for tc in test_compartments:
                m_value = self._calculate_m_value(tc, surface_p, use_gf=True)
                total_p_inert = tc.current_p_n2 + tc.current_p_he

                if total_p_inert >= m_value:
                    return max(max_time - time_increment, 0)

            max_time += time_increment

        return max_time

    def _get_leading_compartment(self, target_p_ambient: float) -> Tuple[int, float]:
        """获取领先隔室（M值比值最高的隔室）"""
        max_ratio = 0.0
        leading_comp_id = 1

        for comp in self.compartments:
            m_value = self._calculate_m_value(comp, target_p_ambient, use_gf=True)
            total_p_inert = comp.current_p_n2 + comp.current_p_he
            ratio = total_p_inert / m_value if m_value > 0 else 0

            if ratio > max_ratio:
                max_ratio = ratio
                leading_comp_id = comp.compartment_id

        return leading_comp_id, max_ratio

    def _calculate_m_value(
        self,
        compartment: TissueCompartment,
        p_ambient: float,
        use_gf: bool = True,
    ) -> float:
        """计算M值（最大允许过饱和度）"""
        m_value_n2 = compartment.n2_a + p_ambient / compartment.n2_b
        m_value_he = compartment.he_a + p_ambient / compartment.he_b

        total_p_n2 = compartment.current_p_n2
        total_p_he = compartment.current_p_he
        total_p_inert = total_p_n2 + total_p_he

        if total_p_inert > 0:
            weighted_m = (total_p_n2 * m_value_n2 + total_p_he * m_value_he) / total_p_inert
        else:
            weighted_m = m_value_n2

        if use_gf:
            gf = self._get_gradient_factor(p_ambient)
            return p_ambient + (weighted_m - p_ambient) * gf

        return weighted_m

    def _get_gradient_factor(self, p_ambient: float) -> float:
        """根据深度获取梯度因子"""
        max_depth_p = self._depth_to_bar(40)
        surface_p = 1.0

        if p_ambient <= surface_p:
            return self.gradient_factor_high
        elif p_ambient >= max_depth_p:
            return self.gradient_factor_low
        else:
            depth_ratio = (p_ambient - surface_p) / (max_depth_p - surface_p)
            return self.gradient_factor_high - depth_ratio * (self.gradient_factor_high - self.gradient_factor_low)

    def _calculate_oxygen_toxicity(
        self,
        avg_depth: float,
        gas_mix: GasMix,
        duration_minutes: float,
    ) -> Tuple[float, float]:
        """计算氧中毒风险（CNS%和OTU）"""
        p_ambient = self._depth_to_bar(avg_depth)
        p_o2 = gas_mix.p_o2 * p_ambient

        if p_o2 <= 0.5:
            return 0.0, 0.0

        cns_per_minute = self._get_cns_rate(p_o2)
        cns = cns_per_minute * duration_minutes

        otu_per_minute = self._get_otu_rate(p_o2)
        otu = otu_per_minute * duration_minutes

        return cns, otu

    def _get_cns_rate(self, p_o2: float) -> float:
        """获取CNS氧中毒速率（每分钟百分比）"""
        if p_o2 <= 0.5:
            return 0.0
        elif p_o2 <= 0.6:
            return 1.0 / 720
        elif p_o2 <= 0.7:
            return 1.0 / 480
        elif p_o2 <= 0.8:
            return 1.0 / 300
        elif p_o2 <= 0.9:
            return 1.0 / 240
        elif p_o2 <= 1.0:
            return 1.0 / 180
        elif p_o2 <= 1.1:
            return 1.0 / 120
        elif p_o2 <= 1.2:
            return 1.0 / 90
        elif p_o2 <= 1.3:
            return 1.0 / 60
        elif p_o2 <= 1.4:
            return 1.0 / 45
        elif p_o2 <= 1.5:
            return 1.0 / 30
        else:
            return 1.0 / 15

    def _get_otu_rate(self, p_o2: float) -> float:
        """获取OTU（氧毒性单位）速率"""
        if p_o2 <= 0.5:
            return 0.0
        return ((p_o2 - 0.5) / 0.5) ** (5.0 / 6.0)

    def _depth_to_bar(self, depth_meters: float) -> float:
        """将深度（米）转换为绝对压力（巴）"""
        return 1.0 + depth_meters / 10.0

    def _create_empty_result(self) -> CalculationResult:
        """创建空的计算结果"""
        return CalculationResult(
            tissue_compartments=self.compartments.copy(),
            current_ndl=0,
            max_ndl=0,
            cns_percentage=0.0,
            otu_value=0.0,
            leading_compartment=1,
            m_value_ratio=0.0,
        )
