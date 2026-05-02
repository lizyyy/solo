"""计算算法模块 - 中垂线法、梯形规则、不确定度计算"""

from typing import List, Optional, Tuple

import numpy as np

from .models import (
    CalibrationRecord,
    FlowMethod,
    FlowResult,
    MeasuringPoint,
    SectionData,
    SegmentResult,
    SourceUncertainty,
    UncertaintyResult,
    UnitType,
)
from .parser_validator import UnitConverter


class FlowCalculator:
    """流量计算器"""

    def __init__(
        self,
        method: FlowMethod = FlowMethod.MIDPOINT,
        edge_extrapolation: bool = True,
        zero_velocity_at_edge: bool = True,
    ):
        """
        初始化流量计算器

        Args:
            method: 计算方法（中垂线法或梯形法）
            edge_extrapolation: 是否对边缘进行外推
            zero_velocity_at_edge: 边缘点流速是否为零
        """
        self.method = method
        self.edge_extrapolation = edge_extrapolation
        self.zero_velocity_at_edge = zero_velocity_at_edge

    def calculate(
        self,
        section: SectionData,
        calibration: Optional[CalibrationRecord] = None,
        include_uncertainty: bool = True,
    ) -> FlowResult:
        """
        计算断面流量

        Args:
            section: 断面数据
            calibration: 校准记录（用于应用校准系数）
            include_uncertainty: 是否计算不确定度

        Returns:
            FlowResult: 流量计算结果
        """
        # 1. 预处理数据
        points = self._prepare_points(section, calibration)

        # 2. 根据方法计算
        if self.method == FlowMethod.MIDPOINT:
            segment_results, total_discharge, total_area = self._calculate_midpoint(points)
        else:
            segment_results, total_discharge, total_area = self._calculate_trapezoidal(points)

        # 3. 计算辅助参数
        river_width = section.river_width
        max_depth = section.max_depth

        # 平均流速
        average_velocity = total_discharge / total_area if total_area > 0 else 0.0

        # 最大流速
        velocities = [p.velocity for p in points if p.velocity > 0]
        max_velocity = max(velocities) if velocities else None

        # 4. 计算不确定度
        uncertainty = None
        if include_uncertainty:
            uncertainty = self._calculate_uncertainty(
                section, segment_results, calibration
            )

        # 5. 构建结果
        return FlowResult(
            section_id=section.section_id,
            method=self.method,
            total_discharge=round(total_discharge, 4),
            total_area=round(total_area, 4),
            average_velocity=round(average_velocity, 4),
            max_velocity=round(max_velocity, 4) if max_velocity else None,
            river_width=round(river_width, 4),
            max_depth=round(max_depth, 4),
            segment_results=segment_results,
            uncertainty=uncertainty,
        )

    def _prepare_points(
        self,
        section: SectionData,
        calibration: Optional[CalibrationRecord],
    ) -> List[MeasuringPoint]:
        """
        准备测点数据：统一单位、应用校准

        Args:
            section: 断面数据
            calibration: 校准记录

        Returns:
            List[MeasuringPoint]: 处理后的测点列表
        """
        points = section.measuring_points.copy()

        # 1. 统一转换为公制单位
        if section.unit == UnitType.IMPERIAL:
            for p in points:
                p.distance_from_left = UnitConverter.feet_to_meters(p.distance_from_left)
                p.water_depth = UnitConverter.feet_to_meters(p.water_depth)
                p.velocity = UnitConverter.fps_to_mps(p.velocity)

        # 2. 应用校准系数
        if calibration:
            for p in points:
                if p.velocity > 0:
                    p.velocity = calibration.apply_calibration(p.velocity)

        # 3. 设置边缘点流速为零（如果启用）
        if self.zero_velocity_at_edge and len(points) >= 2:
            # 找到最左和最右的点
            leftmost_idx = min(range(len(points)), key=lambda i: points[i].distance_from_left)
            rightmost_idx = max(range(len(points)), key=lambda i: points[i].distance_from_left)

            points[leftmost_idx].velocity = 0.0
            points[leftmost_idx].is_edge = True
            points[rightmost_idx].velocity = 0.0
            points[rightmost_idx].is_edge = True

        # 按距离排序
        points.sort(key=lambda p: p.distance_from_left)

        return points

    def _calculate_midpoint(
        self,
        points: List[MeasuringPoint],
    ) -> Tuple[List[SegmentResult], float, float]:
        """
        中垂线法计算流量

        中垂线法原理：
        - 每个分段的代表流速取两个相邻测点流速的平均值
        - 每个分段的宽度是到相邻两点中垂线的距离
        - 分段面积 = 分段宽度 × 平均水深
        - 分段流量 = 分段面积 × 平均流速

        Args:
            points: 测点列表

        Returns:
            Tuple[List[SegmentResult], float, float]: (分段结果, 总流量, 总面积)
        """
        if len(points) < 2:
            return [], 0.0, 0.0

        segment_results: List[SegmentResult] = []
        total_discharge = 0.0
        total_area = 0.0

        # 计算各点的中垂线位置
        # 对于n个点，有n-1个中垂线位置
        midpoints = []
        for i in range(len(points) - 1):
            mid_dist = (points[i].distance_from_left + points[i + 1].distance_from_left) / 2
            midpoints.append(mid_dist)

        # 计算每个测点对应的分段宽度
        # 第一个点：从左岸到第一个中垂线
        # 中间点：从上一个中垂线到下一个中垂线
        # 最后一个点：从最后一个中垂线到右岸
        for i in range(len(points)):
            if i == 0:
                # 第一个点的分段宽度
                if len(midpoints) > 0:
                    start_dist = points[i].distance_from_left
                    end_dist = midpoints[0]
                else:
                    start_dist = points[i].distance_from_left
                    end_dist = points[i].distance_from_left
            elif i == len(points) - 1:
                # 最后一个点的分段宽度
                start_dist = midpoints[-1] if len(midpoints) > 0 else points[i].distance_from_left
                end_dist = points[i].distance_from_left
            else:
                # 中间点的分段宽度
                start_dist = midpoints[i - 1]
                end_dist = midpoints[i]

            width = end_dist - start_dist

            if width <= 0:
                continue

            # 计算该测点的水深和流速
            depth = points[i].water_depth
            velocity = points[i].velocity

            # 计算分段面积和流量
            area = width * depth
            discharge = area * velocity

            # 确定相邻测点编号
            left_point_id = points[i - 1].id if i > 0 else None
            right_point_id = points[i + 1].id if i < len(points) - 1 else None

            segment_results.append(SegmentResult(
                segment_id=len(segment_results) + 1,
                start_distance=round(start_dist, 4),
                end_distance=round(end_dist, 4),
                width=round(width, 4),
                average_depth=round(depth, 4),
                average_velocity=round(velocity, 4),
                area=round(area, 4),
                discharge=round(discharge, 4),
                left_point_id=left_point_id,
                right_point_id=right_point_id,
            ))

            total_discharge += discharge
            total_area += area

        return segment_results, total_discharge, total_area

    def _calculate_trapezoidal(
        self,
        points: List[MeasuringPoint],
    ) -> Tuple[List[SegmentResult], float, float]:
        """
        梯形法计算流量

        梯形法原理：
        - 将相邻两个测点之间的区域视为梯形
        - 梯形的两个平行边是两个测点的水深
        - 梯形的高是两个测点之间的距离
        - 分段面积 = (左水深 + 右水深) / 2 × 间距
        - 平均流速 = (左流速 + 右流速) / 2
        - 分段流量 = 分段面积 × 平均流速

        Args:
            points: 测点列表

        Returns:
            Tuple[List[SegmentResult], float, float]: (分段结果, 总流量, 总面积)
        """
        if len(points) < 2:
            return [], 0.0, 0.0

        segment_results: List[SegmentResult] = []
        total_discharge = 0.0
        total_area = 0.0

        for i in range(len(points) - 1):
            left_point = points[i]
            right_point = points[i + 1]

            start_dist = left_point.distance_from_left
            end_dist = right_point.distance_from_left
            width = end_dist - start_dist

            if width <= 0:
                continue

            # 梯形法：平均水深和平均流速
            avg_depth = (left_point.water_depth + right_point.water_depth) / 2
            avg_velocity = (left_point.velocity + right_point.velocity) / 2

            # 计算面积和流量
            area = width * avg_depth
            discharge = area * avg_velocity

            segment_results.append(SegmentResult(
                segment_id=len(segment_results) + 1,
                start_distance=round(start_dist, 4),
                end_distance=round(end_dist, 4),
                width=round(width, 4),
                average_depth=round(avg_depth, 4),
                average_velocity=round(avg_velocity, 4),
                area=round(area, 4),
                discharge=round(discharge, 4),
                left_point_id=left_point.id,
                right_point_id=right_point.id,
            ))

            total_discharge += discharge
            total_area += area

        return segment_results, total_discharge, total_area

    def _calculate_uncertainty(
        self,
        section: SectionData,
        segment_results: List[SegmentResult],
        calibration: Optional[CalibrationRecord],
    ) -> UncertaintyResult:
        """
        计算不确定度

        不确定度来源：
        1. 水深测量不确定度 (u_h)
        2. 流速测量不确定度 (u_v)
        3. 间距测量不确定度 (u_b)
        4. 仪器校准不确定度 (u_cal)
        5. 方法不确定度 (u_method)

        合成不确定度：u_c = sqrt(u_h² + u_v² + u_b² + u_cal² + u_method²)
        相对不确定度：u_rel = u_c / Q × 100%
        扩展不确定度：U = k × u_c (k=2, 置信概率约95%)

        Args:
            section: 断面数据
            segment_results: 分段计算结果
            calibration: 校准记录

        Returns:
            UncertaintyResult: 不确定度结果
        """
        if not segment_results:
            return UncertaintyResult(
                combined_uncertainty=0.0,
                relative_uncertainty=0.0,
                expanded_uncertainty=0.0,
                coverage_factor=2.0,
                source_uncertainties=[],
            )

        total_discharge = sum(s.discharge for s in segment_results)

        if total_discharge <= 0:
            return UncertaintyResult(
                combined_uncertainty=0.0,
                relative_uncertainty=0.0,
                expanded_uncertainty=0.0,
                coverage_factor=2.0,
                source_uncertainties=[],
            )

        source_uncertainties: List[SourceUncertainty] = []
        variances = {}

        # 1. 水深测量不确定度
        # 假设水深测量的相对标准不确定度为 2%
        # 或基于实际测量精度（如超声波测深仪精度）
        u_h_rel = 0.02  # 2% 相对不确定度
        u_h = total_discharge * u_h_rel  # 标准不确定度
        c_h = 1.0  # 灵敏系数
        var_h = (c_h * u_h) ** 2
        variances["depth"] = var_h

        source_uncertainties.append(SourceUncertainty(
            source="水深测量",
            standard_uncertainty=round(u_h, 4),
            sensitivity_coefficient=round(c_h, 4),
            contribution=round(var_h, 4),
            relative_contribution=0.0,
        ))

        # 2. 流速测量不确定度
        # 假设流速测量的相对标准不确定度为 3%
        # 或基于仪器精度（如ADCP精度）
        u_v_rel = 0.03  # 3% 相对不确定度
        u_v = total_discharge * u_v_rel
        c_v = 1.0
        var_v = (c_v * u_v) ** 2
        variances["velocity"] = var_v

        source_uncertainties.append(SourceUncertainty(
            source="流速测量",
            standard_uncertainty=round(u_v, 4),
            sensitivity_coefficient=round(c_v, 4),
            contribution=round(var_v, 4),
            relative_contribution=0.0,
        ))

        # 3. 间距测量不确定度
        # 假设间距测量的相对标准不确定度为 1%
        u_b_rel = 0.01  # 1% 相对不确定度
        u_b = total_discharge * u_b_rel
        c_b = 1.0
        var_b = (c_b * u_b) ** 2
        variances["spacing"] = var_b

        source_uncertainties.append(SourceUncertainty(
            source="间距测量",
            standard_uncertainty=round(u_b, 4),
            sensitivity_coefficient=round(c_b, 4),
            contribution=round(var_b, 4),
            relative_contribution=0.0,
        ))

        # 4. 仪器校准不确定度
        if calibration and calibration.uncertainty > 0:
            u_cal_rel = calibration.uncertainty
        else:
            u_cal_rel = 0.02  # 默认 2%

        u_cal = total_discharge * u_cal_rel
        c_cal = 1.0
        var_cal = (c_cal * u_cal) ** 2
        variances["calibration"] = var_cal

        source_uncertainties.append(SourceUncertainty(
            source="仪器校准",
            standard_uncertainty=round(u_cal, 4),
            sensitivity_coefficient=round(c_cal, 4),
            contribution=round(var_cal, 4),
            relative_contribution=0.0,
        ))

        # 5. 方法不确定度
        # 中垂线法和梯形法的方法不确定度
        if self.method == FlowMethod.MIDPOINT:
            u_method_rel = 0.015  # 1.5%
        else:
            u_method_rel = 0.02  # 2%

        u_method = total_discharge * u_method_rel
        c_method = 1.0
        var_method = (c_method * u_method) ** 2
        variances["method"] = var_method

        source_uncertainties.append(SourceUncertainty(
            source="计算方法",
            standard_uncertainty=round(u_method, 4),
            sensitivity_coefficient=round(c_method, 4),
            contribution=round(var_method, 4),
            relative_contribution=0.0,
        ))

        # 计算合成不确定度
        total_variance = sum(variances.values())
        combined_uncertainty = np.sqrt(total_variance)

        # 相对不确定度
        relative_uncertainty = (combined_uncertainty / total_discharge) * 100 if total_discharge > 0 else 0

        # 扩展不确定度 (k=2)
        coverage_factor = 2.0
        expanded_uncertainty = combined_uncertainty * coverage_factor

        # 计算各分量的相对贡献
        if total_variance > 0:
            for su in source_uncertainties:
                su.relative_contribution = round((su.contribution / total_variance) * 100, 2)

        return UncertaintyResult(
            combined_uncertainty=round(combined_uncertainty, 4),
            relative_uncertainty=round(relative_uncertainty, 2),
            expanded_uncertainty=round(expanded_uncertainty, 4),
            coverage_factor=coverage_factor,
            source_uncertainties=source_uncertainties,
        )


class MethodComparison:
    """方法比较器 - 比较中垂线法和梯形法的计算结果"""

    @staticmethod
    def compare_methods(
        section: SectionData,
        calibration: Optional[CalibrationRecord] = None,
    ) -> Tuple[FlowResult, FlowResult, dict]:
        """
        比较两种计算方法的结果

        Args:
            section: 断面数据
            calibration: 校准记录

        Returns:
            Tuple[FlowResult, FlowResult, dict]: (中垂线法结果, 梯形法结果, 比较统计)
        """
        # 中垂线法
        calc_midpoint = FlowCalculator(method=FlowMethod.MIDPOINT)
        result_midpoint = calc_midpoint.calculate(section, calibration)

        # 梯形法
        calc_trapezoidal = FlowCalculator(method=FlowMethod.TRAPEZOIDAL)
        result_trapezoidal = calc_trapezoidal.calculate(section, calibration)

        # 计算差异
        q_diff = abs(result_midpoint.total_discharge - result_trapezoidal.total_discharge)
        q_rel_diff = (q_diff / result_midpoint.total_discharge * 100) if result_midpoint.total_discharge > 0 else 0

        area_diff = abs(result_midpoint.total_area - result_trapezoidal.total_area)
        area_rel_diff = (area_diff / result_midpoint.total_area * 100) if result_midpoint.total_area > 0 else 0

        comparison = {
            "discharge_difference": q_diff,
            "discharge_relative_difference_percent": q_rel_diff,
            "area_difference": area_diff,
            "area_relative_difference_percent": area_rel_diff,
            "midpoint_segment_count": len(result_midpoint.segment_results),
            "trapezoidal_segment_count": len(result_trapezoidal.segment_results),
        }

        return result_midpoint, result_trapezoidal, comparison
