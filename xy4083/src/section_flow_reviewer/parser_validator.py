"""解析校验模块 - CSV解析、单位转换、数据验证"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

from .models import (
    CalibrationRecord,
    ManualNote,
    MeasuringPoint,
    SectionData,
    UnitType,
    ValidationIssue,
)


class UnitConverter:
    """单位转换器"""

    # 英尺到米的转换系数
    FEET_TO_METERS = 0.3048
    # 英尺/秒到米/秒的转换系数
    FPS_TO_MPS = 0.3048

    @staticmethod
    def feet_to_meters(feet: float) -> float:
        """将英尺转换为米"""
        return feet * UnitConverter.FEET_TO_METERS

    @staticmethod
    def meters_to_feet(meters: float) -> float:
        """将米转换为英尺"""
        return meters / UnitConverter.FEET_TO_METERS

    @staticmethod
    def fps_to_mps(fps: float) -> float:
        """将英尺/秒转换为米/秒"""
        return fps * UnitConverter.FPS_TO_MPS

    @staticmethod
    def mps_to_fps(mps: float) -> float:
        """将米/秒转换为英尺/秒"""
        return mps / UnitConverter.FPS_TO_MPS

    @staticmethod
    def convert_distance(value: float, from_unit: UnitType, to_unit: UnitType) -> float:
        """转换距离单位"""
        if from_unit == to_unit:
            return value
        if from_unit == UnitType.IMPERIAL and to_unit == UnitType.METRIC:
            return UnitConverter.feet_to_meters(value)
        else:
            return UnitConverter.meters_to_feet(value)

    @staticmethod
    def convert_velocity(value: float, from_unit: UnitType, to_unit: UnitType) -> float:
        """转换速度单位"""
        if from_unit == to_unit:
            return value
        if from_unit == UnitType.IMPERIAL and to_unit == UnitType.METRIC:
            return UnitConverter.fps_to_mps(value)
        else:
            return UnitConverter.mps_to_fps(value)


class CSVParser:
    """CSV文件解析器"""

    def __init__(self, encoding: str = "utf-8"):
        """
        初始化CSV解析器

        Args:
            encoding: 文件编码
        """
        self.encoding = encoding

    def parse_section_data(self, csv_path: Path) -> Tuple[SectionData, List[Dict[str, Any]]]:
        """
        解析断面数据CSV文件

        期望的CSV格式:
        - 前几行是断面元数据（键值对形式）
        - 然后是测点数据，包含列：测点编号, 距左岸距离, 水深, 流速, [可选列]

        Args:
            csv_path: CSV文件路径

        Returns:
            Tuple[SectionData, List[Dict]]: (断面数据, 原始行数据)
        """
        with open(csv_path, "r", encoding=self.encoding) as f:
            lines = f.readlines()

        # 分离元数据和测点数据
        metadata_lines = []
        data_lines = []
        header_line = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 检查是否是元数据行（键值对，不含逗号或逗号分隔的键值）
            if "=" in line or ":" in line:
                metadata_lines.append(line)
            elif "测点编号" in line or "距左岸距离" in line or "距离" in line:
                header_line = line
            else:
                if header_line:
                    data_lines.append(line)

        # 解析元数据
        metadata = self._parse_metadata(metadata_lines)

        # 解析测点数据
        points = []
        raw_rows = []
        if header_line and data_lines:
            # 处理可能的BOM
            header_line = header_line.lstrip('\ufeff')
            headers = [h.strip() for h in header_line.split(",")]
            
            for line_num, data_line in enumerate(data_lines, 1):
                values = [v.strip() for v in data_line.split(",")]
                if len(values) < len(headers):
                    values.extend([""] * (len(headers) - len(values)))
                
                row_dict = dict(zip(headers, values))
                raw_rows.append(row_dict)
                
                point = self._parse_measuring_point(row_dict, line_num)
                if point:
                    points.append(point)

        # 确定单位制
        unit_str = metadata.get("单位", metadata.get("unit", "metric")).lower()
        unit = UnitType.METRIC if unit_str == "metric" or unit_str == "公制" else UnitType.IMPERIAL

        # 解析日期时间
        date_str = metadata.get("测量日期", metadata.get("measurement_date", ""))
        try:
            if date_str:
                measurement_date = datetime.fromisoformat(date_str.replace("/", "-"))
            else:
                measurement_date = datetime.now()
        except ValueError:
            measurement_date = datetime.now()

        # 创建断面数据
        section = SectionData(
            section_id=metadata.get("断面编号", metadata.get("section_id", "UNKNOWN")),
            section_name=metadata.get("断面名称", metadata.get("section_name")),
            measurement_date=measurement_date,
            measuring_points=points,
            temperature=float(metadata["水温"]) if metadata.get("水温") else None,
            weather=metadata.get("天气"),
            operator=metadata.get("操作员", metadata.get("operator")),
            instrument_id=metadata.get("仪器编号", metadata.get("instrument_id")),
            notes=metadata.get("备注", metadata.get("notes")),
            unit=unit,
        )

        return section, raw_rows

    def parse_calibration_record(self, csv_path: Path) -> CalibrationRecord:
        """
        解析仪器校准记录CSV文件

        Args:
            csv_path: CSV文件路径

        Returns:
            CalibrationRecord: 校准记录
        """
        df = pd.read_csv(csv_path, encoding=self.encoding)
        
        # 如果是多行，取第一行
        if len(df) > 0:
            row = df.iloc[0].to_dict()
        else:
            row = {}

        # 解析日期
        def parse_date(date_str: Optional[str]) -> Optional[datetime]:
            if not date_str or pd.isna(date_str):
                return None
            try:
                return datetime.fromisoformat(str(date_str).replace("/", "-"))
            except ValueError:
                return None

        return CalibrationRecord(
            instrument_id=str(row.get("仪器编号", row.get("instrument_id", "UNKNOWN"))),
            instrument_type=str(row.get("仪器类型", row.get("instrument_type", "UNKNOWN"))),
            calibration_date=parse_date(row.get("校准日期", row.get("calibration_date"))) or datetime.now(),
            next_calibration_date=parse_date(row.get("下次校准日期", row.get("next_calibration_date"))),
            calibration_factor=float(row.get("校准系数", row.get("calibration_factor", 1.0))),
            offset=float(row.get("偏移量", row.get("offset", 0.0))),
            uncertainty=float(row.get("不确定度", row.get("uncertainty", 0.0))),
            standard_used=str(row.get("标准器", row.get("standard_used", ""))) if row.get("标准器") or row.get("standard_used") else None,
            calibration_agency=str(row.get("校准机构", row.get("calibration_agency", ""))) if row.get("校准机构") or row.get("calibration_agency") else None,
            certificate_number=str(row.get("证书编号", row.get("certificate_number", ""))) if row.get("证书编号") or row.get("certificate_number") else None,
            notes=str(row.get("备注", row.get("notes", ""))) if row.get("备注") or row.get("notes") else None,
            is_valid=bool(row.get("是否有效", row.get("is_valid", True))),
        )

    def parse_manual_notes(self, csv_path: Path) -> List[ManualNote]:
        """
        解析人工备注CSV文件

        Args:
            csv_path: CSV文件路径

        Returns:
            List[ManualNote]: 备注列表
        """
        df = pd.read_csv(csv_path, encoding=self.encoding)
        notes = []

        for _, row in df.iterrows():
            def parse_date(date_str: Any) -> datetime:
                if pd.isna(date_str):
                    return datetime.now()
                try:
                    return datetime.fromisoformat(str(date_str).replace("/", "-"))
                except ValueError:
                    return datetime.now()

            note = ManualNote(
                id=str(row.get("备注编号", row.get("id", f"N{len(notes)+1:03d}"))),
                section_id=str(row.get("断面编号", row.get("section_id", "UNKNOWN"))),
                note_date=parse_date(row.get("记录日期", row.get("note_date"))),
                author=str(row.get("记录人", row.get("author", "未知"))),
                category=str(row.get("类别", row.get("category", "备注"))),
                content=str(row.get("内容", row.get("content", ""))),
                related_point_id=int(row["关联测点"]) if pd.notna(row.get("关联测点", row.get("related_point_id"))) else None,
                severity=str(row.get("严重程度", row.get("severity", "info"))).lower(),
            )
            notes.append(note)

        return notes

    def _parse_metadata(self, lines: List[str]) -> Dict[str, str]:
        """解析元数据行"""
        metadata = {}
        for line in lines:
            line = line.strip()
            if "=" in line:
                key, value = line.split("=", 1)
                metadata[key.strip()] = value.strip()
            elif ":" in line:
                key, value = line.split(":", 1)
                metadata[key.strip()] = value.strip()
        return metadata

    def _parse_measuring_point(self, row: Dict[str, str], line_num: int) -> Optional[MeasuringPoint]:
        """
        解析单个测点数据

        支持的列名别名：
        - 测点编号: id, point_id, 测点号
        - 距左岸距离: 距离, distance, distance_from_left, 起点距
        - 水深: depth, water_depth, h
        - 流速: velocity, v, 流速值
        - 流速测量相对水深: depth_ratio, velocity_depth_ratio
        - 是否边缘: is_edge, 边缘点
        """
        try:
            # 测点编号
            id_val = row.get("测点编号") or row.get("id") or row.get("point_id") or row.get("测点号") or str(line_num)
            point_id = int(float(id_val)) if id_val else line_num

            # 距左岸距离（必须字段）
            distance_str = (
                row.get("距左岸距离") 
                or row.get("距离") 
                or row.get("distance") 
                or row.get("distance_from_left") 
                or row.get("起点距")
            )
            if not distance_str:
                return None
            distance = float(distance_str)

            # 水深（必须字段）
            depth_str = row.get("水深") or row.get("depth") or row.get("water_depth") or row.get("h")
            if not depth_str:
                return None
            depth = float(depth_str)

            # 流速（必须字段）
            velocity_str = row.get("流速") or row.get("velocity") or row.get("v") or row.get("流速值")
            if not velocity_str:
                velocity = 0.0
            else:
                velocity = float(velocity_str)

            # 可选字段
            depth_ratio_str = row.get("流速测量相对水深") or row.get("depth_ratio") or row.get("velocity_depth_ratio")
            depth_ratio = float(depth_ratio_str) if depth_ratio_str else 0.6

            is_edge_str = row.get("是否边缘") or row.get("is_edge") or row.get("边缘点")
            is_edge = str(is_edge_str).lower() in ["true", "1", "是", "yes"] if is_edge_str else False

            notes = row.get("备注") or row.get("notes")

            return MeasuringPoint(
                id=point_id,
                distance_from_left=distance,
                water_depth=depth,
                velocity=velocity,
                velocity_depth_ratio=depth_ratio,
                is_edge=is_edge,
                notes=notes,
            )

        except (ValueError, TypeError) as e:
            return None


class DataValidator:
    """数据验证器"""

    def __init__(
        self,
        max_spacing_ratio: float = 2.0,
        velocity_anomaly_std: float = 3.0,
        depth_anomaly_std: float = 3.0,
        max_allowed_drift: float = 0.05,
    ):
        """
        初始化数据验证器

        Args:
            max_spacing_ratio: 最大测点间距比例（相对于平均间距）
            velocity_anomaly_std: 流速异常标准差倍数
            depth_anomaly_std: 水深异常标准差倍数
            max_allowed_drift: 最大允许仪器漂移比例
        """
        self.max_spacing_ratio = max_spacing_ratio
        self.velocity_anomaly_std = velocity_anomaly_std
        self.depth_anomaly_std = depth_anomaly_std
        self.max_allowed_drift = max_allowed_drift

    def validate_all(
        self,
        section: SectionData,
        calibration: Optional[CalibrationRecord] = None,
        notes: Optional[List[ManualNote]] = None,
    ) -> List[ValidationIssue]:
        """
        执行所有数据验证

        Args:
            section: 断面数据
            calibration: 校准记录
            notes: 人工备注

        Returns:
            List[ValidationIssue]: 验证问题列表
        """
        issues: List[ValidationIssue] = []

        # 1. 单位检查
        issues.extend(self._check_units(section))

        # 2. 测点间距检查
        issues.extend(self._check_point_spacing(section))

        # 3. 仪器漂移检查
        if calibration:
            issues.extend(self._check_instrument_drift(section, calibration))

        # 4. 异常值检测
        issues.extend(self._check_anomalies(section))

        # 5. 缺失数据检查
        issues.extend(self._check_missing_data(section))

        # 6. 结合人工备注检查
        if notes:
            issues.extend(self._check_notes(section, notes))

        return issues

    def _check_units(self, section: SectionData) -> List[ValidationIssue]:
        """检查单位一致性"""
        issues: List[ValidationIssue] = []
        issue_count = 0

        # 检查是否有不合理的数值（可能是单位错误）
        for point in section.measuring_points:
            # 如果是公制单位，检查数值是否过大
            if section.unit == UnitType.METRIC:
                # 水深大于50米可能是单位错误（英尺转米）
                if point.water_depth > 50:
                    issue_count += 1
                    issues.append(ValidationIssue(
                        issue_id=f"U{issue_count:03d}",
                        section_id=section.section_id,
                        issue_type="unit",
                        severity="warning",
                        message=f"测点{point.id}水深{point.water_depth:.2f}米过大，可能是单位错误（应为英尺？）",
                        related_point_id=point.id,
                        related_field="water_depth",
                        expected_value=point.water_depth * UnitConverter.FEET_TO_METERS,
                        actual_value=point.water_depth,
                        suggestion="建议检查单位设置或转换为正确的单位",
                    ))

                # 流速大于10m/s可能是单位错误
                if point.velocity > 10:
                    issue_count += 1
                    issues.append(ValidationIssue(
                        issue_id=f"U{issue_count:03d}",
                        section_id=section.section_id,
                        issue_type="unit",
                        severity="warning",
                        message=f"测点{point.id}流速{point.velocity:.2f}m/s过大，可能是单位错误",
                        related_point_id=point.id,
                        related_field="velocity",
                        suggestion="建议检查流速单位是否正确",
                    ))

            # 如果是英制单位，检查数值是否过小
            elif section.unit == UnitType.IMPERIAL:
                # 水深小于1英尺可能是单位错误
                if point.water_depth < 1 and point.water_depth > 0:
                    issue_count += 1
                    issues.append(ValidationIssue(
                        issue_id=f"U{issue_count:03d}",
                        section_id=section.section_id,
                        issue_type="unit",
                        severity="warning",
                        message=f"测点{point.id}水深{point.water_depth:.2f}英尺过小，可能是单位错误（应为米？）",
                        related_point_id=point.id,
                        related_field="water_depth",
                        expected_value=point.water_depth / UnitConverter.FEET_TO_METERS,
                        actual_value=point.water_depth,
                        suggestion="建议检查单位设置",
                    ))

        return issues

    def _check_point_spacing(self, section: SectionData) -> List[ValidationIssue]:
        """检查测点间距是否合理"""
        issues: List[ValidationIssue] = []
        issue_count = 0
        points = section.measuring_points

        if len(points) < 2:
            return issues

        # 计算间距
        spacings = []
        for i in range(1, len(points)):
            spacing = points[i].distance_from_left - points[i-1].distance_from_left
            spacings.append(spacing)

        if not spacings:
            return issues

        avg_spacing = np.mean(spacings)
        std_spacing = np.std(spacings)

        for i, spacing in enumerate(spacings):
            # 检查间距是否过大
            if avg_spacing > 0 and spacing > avg_spacing * self.max_spacing_ratio:
                issue_count += 1
                left_point = points[i]
                right_point = points[i+1]
                issues.append(ValidationIssue(
                    issue_id=f"S{issue_count:03d}",
                    section_id=section.section_id,
                    issue_type="spacing",
                    severity="warning",
                    message=f"测点{left_point.id}和{right_point.id}之间间距{spacing:.2f}米过大，"
                            f"是平均间距{avg_spacing:.2f}米的{spacing/avg_spacing:.1f}倍",
                    related_point_id=left_point.id,
                    related_field="distance_from_left",
                    expected_value=avg_spacing,
                    actual_value=spacing,
                    suggestion="建议在该区间增加测点以提高计算精度",
                ))

            # 检查间距是否为零或负值
            if spacing <= 0:
                issue_count += 1
                left_point = points[i]
                right_point = points[i+1]
                issues.append(ValidationIssue(
                    issue_id=f"S{issue_count:03d}",
                    section_id=section.section_id,
                    issue_type="spacing",
                    severity="error",
                    message=f"测点{left_point.id}和{right_point.id}间距为{spacing:.2f}米，"
                            f"存在重复或顺序错误",
                    related_point_id=left_point.id,
                    related_field="distance_from_left",
                    expected_value=avg_spacing if avg_spacing > 0 else 1.0,
                    actual_value=spacing,
                    suggestion="请检查测点距离数据，确保顺序正确且无重复",
                ))

        return issues

    def _check_instrument_drift(
        self,
        section: SectionData,
        calibration: CalibrationRecord,
    ) -> List[ValidationIssue]:
        """检查仪器漂移"""
        issues: List[ValidationIssue] = []
        issue_count = 0

        # 1. 检查校准是否过期
        if calibration.is_expired(section.measurement_date):
            issue_count += 1
            issues.append(ValidationIssue(
                issue_id=f"D{issue_count:03d}",
                section_id=section.section_id,
                issue_type="drift",
                severity="error",
                message=f"仪器{calibration.instrument_id}校准已过期，"
                        f"下次校准日期为{calibration.next_calibration_date}",
                related_field="instrument_id",
                suggestion="请重新校准仪器后再进行测量",
            ))

        # 2. 检查校准系数是否在合理范围内
        if abs(calibration.calibration_factor - 1.0) > self.max_allowed_drift:
            issue_count += 1
            issues.append(ValidationIssue(
                issue_id=f"D{issue_count:03d}",
                section_id=section.section_id,
                issue_type="drift",
                severity="warning",
                message=f"仪器{calibration.instrument_id}校准系数{calibration.calibration_factor:.4f}偏离1.0较大，"
                        f"可能存在仪器漂移",
                related_field="instrument_id",
                expected_value=1.0,
                actual_value=calibration.calibration_factor,
                suggestion="建议检查仪器状态，必要时重新校准",
            ))

        # 3. 检查校准不确定度
        if calibration.uncertainty > 0.05:
            issue_count += 1
            issues.append(ValidationIssue(
                issue_id=f"D{issue_count:03d}",
                section_id=section.section_id,
                issue_type="drift",
                severity="warning",
                message=f"仪器{calibration.instrument_id}校准不确定度{calibration.uncertainty*100:.1f}%较大",
                related_field="instrument_id",
                expected_value=0.02,
                actual_value=calibration.uncertainty,
                suggestion="建议考虑校准不确定度对结果的影响",
            ))

        return issues

    def _check_anomalies(self, section: SectionData) -> List[ValidationIssue]:
        """检查异常值"""
        issues: List[ValidationIssue] = []
        issue_count = 0
        points = section.measuring_points

        if len(points) < 3:
            return issues

        # 提取数值数组
        velocities = np.array([p.velocity for p in points if p.velocity > 0])
        depths = np.array([p.water_depth for p in points if p.water_depth > 0])

        if len(velocities) > 0:
            vel_mean = np.mean(velocities)
            vel_std = np.std(velocities)

            if vel_std > 0:
                for point in points:
                    # 检查流速异常
                    if point.velocity > 0:
                        z_score = abs(point.velocity - vel_mean) / vel_std
                        if z_score > self.velocity_anomaly_std:
                            issue_count += 1
                            issues.append(ValidationIssue(
                                issue_id=f"A{issue_count:03d}",
                                section_id=section.section_id,
                                issue_type="anomaly",
                                severity="warning",
                                message=f"测点{point.id}流速{point.velocity:.3f}m/s异常，"
                                        f"超出均值{vel_mean:.3f}m/s的{self.velocity_anomaly_std}倍标准差",
                                related_point_id=point.id,
                                related_field="velocity",
                                expected_value=vel_mean,
                                actual_value=point.velocity,
                                suggestion=f"建议检查该测点，z-score={z_score:.2f}，可能受水草、漩涡或测量误差影响",
                            ))

        if len(depths) > 0:
            depth_mean = np.mean(depths)
            depth_std = np.std(depths)

            if depth_std > 0:
                for point in points:
                    # 检查水深异常
                    if point.water_depth > 0:
                        z_score = abs(point.water_depth - depth_mean) / depth_std
                        if z_score > self.depth_anomaly_std:
                            issue_count += 1
                            issues.append(ValidationIssue(
                                issue_id=f"A{issue_count:03d}",
                                section_id=section.section_id,
                                issue_type="anomaly",
                                severity="warning",
                                message=f"测点{point.id}水深{point.water_depth:.2f}米异常，"
                                        f"超出均值{depth_mean:.2f}米的{self.depth_anomaly_std}倍标准差",
                                related_point_id=point.id,
                                related_field="water_depth",
                                expected_value=depth_mean,
                                actual_value=point.water_depth,
                                suggestion=f"建议检查该测点水深测量，z-score={z_score:.2f}",
                            ))

        # 检查零流速但非边缘点
        for point in points:
            if point.velocity == 0 and not point.is_edge:
                issue_count += 1
                issues.append(ValidationIssue(
                    issue_id=f"A{issue_count:03d}",
                    section_id=section.section_id,
                    issue_type="anomaly",
                    severity="info",
                    message=f"测点{point.id}流速为零但非边缘点",
                    related_point_id=point.id,
                    related_field="velocity",
                    actual_value=0.0,
                    suggestion="如果是静水区可忽略，否则建议检查测量",
                ))

        return issues

    def _check_missing_data(self, section: SectionData) -> List[ValidationIssue]:
        """检查缺失数据"""
        issues: List[ValidationIssue] = []
        issue_count = 0
        points = section.measuring_points

        if len(points) == 0:
            issue_count += 1
            issues.append(ValidationIssue(
                issue_id=f"M{issue_count:03d}",
                section_id=section.section_id,
                issue_type="missing",
                severity="error",
                message="没有测点数据",
                suggestion="请检查数据文件格式，确保包含测点数据",
            ))
            return issues

        # 检查各测点关键数据
        for point in points:
            # 检查水深为零
            if point.water_depth <= 0:
                issue_count += 1
                issues.append(ValidationIssue(
                    issue_id=f"M{issue_count:03d}",
                    section_id=section.section_id,
                    issue_type="missing",
                    severity="warning",
                    message=f"测点{point.id}水深为{point.water_depth}，数据异常",
                    related_point_id=point.id,
                    related_field="water_depth",
                    actual_value=point.water_depth,
                    suggestion="请检查水深数据",
                ))

        # 检查是否有左岸和右岸边缘点
        leftmost = min(p.distance_from_left for p in points)
        rightmost = max(p.distance_from_left for p in points)

        # 检查左岸是否在起点
        if leftmost > 0:
            issue_count += 1
            issues.append(ValidationIssue(
                issue_id=f"M{issue_count:03d}",
                section_id=section.section_id,
                issue_type="missing",
                severity="info",
                message=f"最左侧测点距离左岸{leftmost:.2f}米，建议从左岸起点开始测量",
                related_field="distance_from_left",
                expected_value=0.0,
                actual_value=leftmost,
                suggestion="如果确实未到岸边，可在计算时使用外推法",
            ))

        # 检查是否只有一个测点
        if len(points) == 1:
            issue_count += 1
            issues.append(ValidationIssue(
                issue_id=f"M{issue_count:03d}",
                section_id=section.section_id,
                issue_type="missing",
                severity="warning",
                message="只有一个测点，无法进行流量计算",
                suggestion="请提供至少两个测点数据",
            ))

        return issues

    def _check_notes(
        self,
        section: SectionData,
        notes: List[ManualNote],
    ) -> List[ValidationIssue]:
        """结合人工备注检查"""
        issues: List[ValidationIssue] = []
        issue_count = 0

        # 筛选与此断面相关的备注
        section_notes = [n for n in notes if n.section_id == section.section_id]

        for note in section_notes:
            # 将高严重程度的备注转为验证问题
            if note.severity in ["warning", "error"]:
                issue_count += 1
                issues.append(ValidationIssue(
                    issue_id=f"N{issue_count:03d}",
                    section_id=section.section_id,
                    issue_type="note",
                    severity=note.severity,
                    message=f"人工备注: {note.content} (记录人: {note.author})",
                    related_point_id=note.related_point_id,
                    suggestion="请参考人工备注进行数据复核",
                ))

        return issues
