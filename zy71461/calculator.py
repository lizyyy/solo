from typing import Dict, List, Tuple
from datetime import datetime
import uuid

from models import (
    Room, Material, CalculationResult, ValidationIssue,
    HistoryEntry, STANDARD_FREQUENCIES, FREQUENCY_LABELS, VALID_UNITS
)


class SabineCalculator:
    SABINE_CONSTANT = 0.161

    @classmethod
    def calculate_total_absorption(cls, materials: List[Material]) -> Dict[int, float]:
        absorption_by_freq = {freq: 0.0 for freq in STANDARD_FREQUENCIES}

        for material in materials:
            for freq in STANDARD_FREQUENCIES:
                if freq in material.absorption_coefficients:
                    alpha = material.absorption_coefficients[freq]
                    area = cls._normalize_area(material.area, material.unit)
                    absorption_by_freq[freq] += area * alpha

        return absorption_by_freq

    @classmethod
    def _normalize_area(cls, area: float, unit: str) -> float:
        unit_lower = unit.lower().strip()
        if unit_lower in ["m2", "m²", "sqm", "square meter", "square meters"]:
            return area
        elif unit_lower in ["cm2", "cm²", "sqcm"]:
            return area / 10000.0
        elif unit_lower in ["ft2", "ft²", "sqft"]:
            return area * 0.092903
        return area

    @classmethod
    def calculate_t60(cls, volume: float, total_absorption: Dict[int, float]) -> Dict[int, float]:
        t60_by_freq = {}
        for freq, absorption in total_absorption.items():
            if absorption > 0:
                t60_by_freq[freq] = cls.SABINE_CONSTANT * volume / absorption
            else:
                t60_by_freq[freq] = float('inf')
        return t60_by_freq

    @classmethod
    def calculate_material_contributions(cls, materials: List[Material]) -> Dict[str, Dict[int, float]]:
        contributions = {}
        for material in materials:
            contrib = {}
            for freq in STANDARD_FREQUENCIES:
                if freq in material.absorption_coefficients:
                    alpha = material.absorption_coefficients[freq]
                    area = cls._normalize_area(material.area, material.unit)
                    contrib[freq] = area * alpha
                else:
                    contrib[freq] = 0.0
            contributions[material.id] = contrib
        return contributions

    @classmethod
    def calculate_room(cls, room: Room, issues: List[ValidationIssue]) -> CalculationResult:
        sabine_applicable = cls._check_sabine_applicability(room, issues)

        total_absorption = cls.calculate_total_absorption(room.materials)
        t60_by_freq = cls.calculate_t60(room.volume, total_absorption)
        material_contributions = cls.calculate_material_contributions(room.materials)

        valid_t60 = [v for v in t60_by_freq.values() if v != float('inf')]
        average_t60 = sum(valid_t60) / len(valid_t60) if valid_t60 else 0.0

        return CalculationResult(
            room_id=room.id,
            room_name=room.name,
            t60_by_frequency=t60_by_freq,
            average_t60=average_t60,
            total_absorption_by_frequency=total_absorption,
            sabine_formula_applied=sabine_applicable,
            calculation_timestamp=datetime.now(),
            issues=issues,
            material_contributions=material_contributions
        )

    @classmethod
    def _check_sabine_applicability(cls, room: Room, issues: List[ValidationIssue]) -> bool:
        applicable = True
        warnings = []

        if room.volume < 10:
            warnings.append(f"房间体积({room.volume:.1f}m³)过小，Sabine公式适用于体积较大的房间")
            applicable = False

        surface_coverage = sum(m.area for m in room.materials) / max(room.surface_area, 1)
        if surface_coverage < 0.3:
            warnings.append(f"材料覆盖率仅{surface_coverage*100:.0f}%，建议覆盖至少30%的表面")

        if surface_coverage > 0.95:
            warnings.append(f"材料覆盖率{surface_coverage*100:.0f}%过高，Sabine公式假设吸声均匀分布")

        for freq in STANDARD_FREQUENCIES:
            total_alpha = 0
            for m in room.materials:
                if freq in m.absorption_coefficients:
                    total_alpha += m.absorption_coefficients[freq] * cls._normalize_area(m.area, m.unit)
            avg_alpha = total_alpha / max(room.surface_area, 1)
            if avg_alpha > 0.3:
                warnings.append(
                    f"{FREQUENCY_LABELS[freq]}频段平均吸声系数({avg_alpha:.2f})过高，"
                    f"Sabine公式在吸声较强时误差增大"
                )
                applicable = False
                break

        for warning in warnings:
            issues.append(ValidationIssue(
                type="sabine_applicability",
                severity="warning",
                message=warning,
                related_object=room.name,
                details={"room_volume": room.volume, "surface_coverage": surface_coverage}
            ))

        return applicable


class ValidationEngine:
    @classmethod
    def validate_room(cls, room: Room) -> List[ValidationIssue]:
        issues = []
        issues.extend(cls._validate_room_dimensions(room))
        issues.extend(cls._validate_materials(room))
        issues.extend(cls._validate_frequency_coverage(room))
        issues.extend(cls._validate_unit_consistency(room))
        issues.extend(cls._check_duplicate_materials(room))
        return issues

    @classmethod
    def _validate_room_dimensions(cls, room: Room) -> List[ValidationIssue]:
        issues = []

        if room.length <= 0 or room.width <= 0 or room.height <= 0:
            issues.append(ValidationIssue(
                type="dimension_error",
                severity="error",
                message=f"房间尺寸必须为正数: 长={room.length}, 宽={room.width}, 高={room.height}",
                related_object=room.name,
                details={"length": room.length, "width": room.width, "height": room.height}
            ))

        expected_volume = room.length * room.width * room.height
        if abs(room.volume - expected_volume) > 0.01:
            issues.append(ValidationIssue(
                type="volume_mismatch",
                severity="warning",
                message=f"房间体积({room.volume:.2f})与尺寸计算值({expected_volume:.2f})不一致",
                related_object=room.name,
                details={"stored_volume": room.volume, "calculated_volume": expected_volume}
            ))

        expected_surface = 2 * (room.length * room.width + room.length * room.height + room.width * room.height)
        if abs(room.surface_area - expected_surface) > 0.01:
            issues.append(ValidationIssue(
                type="surface_mismatch",
                severity="warning",
                message=f"表面积({room.surface_area:.2f})与尺寸计算值({expected_surface:.2f})不一致",
                related_object=room.name,
                details={"stored_surface": room.surface_area, "calculated_surface": expected_surface}
            ))

        return issues

    @classmethod
    def _validate_materials(cls, room: Room) -> List[ValidationIssue]:
        issues = []

        for material in room.materials:
            if material.area <= 0:
                issues.append(ValidationIssue(
                    type="area_error",
                    severity="error",
                    message=f"材料'{material.name}'的面积必须为正数，当前值: {material.area}",
                    related_object=material.name,
                    details={"material_id": material.id, "area": material.area}
                ))

            for freq, alpha in material.absorption_coefficients.items():
                if alpha < 0 or alpha > 1:
                    issues.append(ValidationIssue(
                        type="absorption_error",
                        severity="error",
                        message=f"材料'{material.name}'在{FREQUENCY_LABELS.get(freq, f'{freq}Hz')}"
                                f"的吸声系数({alpha})必须在0-1之间",
                        related_object=material.name,
                        details={"material_id": material.id, "frequency": freq, "alpha": alpha}
                    ))

        return issues

    @classmethod
    def _validate_frequency_coverage(cls, room: Room) -> List[ValidationIssue]:
        issues = []

        for material in room.materials:
            missing_freqs = []
            for freq in STANDARD_FREQUENCIES:
                if freq not in material.absorption_coefficients:
                    missing_freqs.append(FREQUENCY_LABELS[freq])

            if missing_freqs:
                issues.append(ValidationIssue(
                    type="missing_frequency",
                    severity="warning",
                    message=f"材料'{material.name}'缺少以下频段的吸声系数: {', '.join(missing_freqs)}",
                    related_object=material.name,
                    details={"material_id": material.id, "missing_frequencies": missing_freqs}
                ))

        return issues

    @classmethod
    def _validate_unit_consistency(cls, room: Room) -> List[ValidationIssue]:
        issues = []

        for material in room.materials:
            unit_lower = material.unit.lower().strip()
            valid_m2 = ["m2", "m²", "sqm", "square meter", "square meters"]
            valid_cm2 = ["cm2", "cm²", "sqcm"]
            valid_ft2 = ["ft2", "ft²", "sqft"]

            if unit_lower not in valid_m2 + valid_cm2 + valid_ft2:
                issues.append(ValidationIssue(
                    type="unit_error",
                    severity="error",
                    message=f"材料'{material.name}'使用了未知面积单位: '{material.unit}'。"
                            f"支持的单位: m2, m², cm2, ft2",
                    related_object=material.name,
                    details={"material_id": material.id, "unit": material.unit}
                ))
            elif unit_lower in valid_cm2 and material.area > 100000:
                issues.append(ValidationIssue(
                    type="unit_suspicious",
                    severity="warning",
                    message=f"材料'{material.name}'面积({material.area} cm²)过大，"
                            f"确认是平方厘米而非平方米？",
                    related_object=material.name,
                    details={"material_id": material.id, "area": material.area, "unit": material.unit}
                ))

        return issues

    @classmethod
    def _check_duplicate_materials(cls, room: Room) -> List[ValidationIssue]:
        issues = []
        seen_names = {}

        for material in room.materials:
            name_lower = material.name.lower().strip()
            if name_lower in seen_names:
                existing_id = seen_names[name_lower]
                issues.append(ValidationIssue(
                    type="duplicate_material",
                    severity="warning",
                    message=f"材料名称重复: '{material.name}'已存在。"
                            f"考虑合并或重命名以避免混淆",
                    related_object=material.name,
                    details={"existing_material_id": existing_id, "duplicate_material_id": material.id}
                ))
            else:
                seen_names[name_lower] = material.id

        return issues
