import math
import time
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from ..models import (
    SupportEstimation,
    EstimationTask,
    MeshAnalysisResult,
    Material,
    TaskStatus,
)
from ..schemas import (
    SupportEstimationRequest,
    SupportEstimationResponse,
    CalculationStep,
    TimeBreakdown,
)
from ..config import settings
from .status_service import StatusService
from .anomaly_service import AnomalyService
from .params_service import ParamsService
from ..models.enums import AnomalyType, AnomalySeverity


class EstimationService:
    @staticmethod
    def _get_or_create_default_material(db: Session) -> Material:
        material = db.query(Material).filter(Material.is_active == True).first()
        if not material:
            material = Material(
                material_type="PLA",
                name="默认 PLA 材料",
                density=settings.default_material_density,
                filament_diameter=1.75,
                is_active=True,
                notes="系统默认创建的PLA材料",
            )
            db.add(material)
            db.flush()
        return material

    @staticmethod
    def estimate_support(
        db: Session,
        task: EstimationTask,
        request: SupportEstimationRequest,
    ) -> Tuple[SupportEstimation, SupportEstimationResponse]:
        start_time = time.time()

        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.ESTIMATING.value,
            message="开始支撑估算",
            triggered_by="estimation_service",
        )

        params_version = request.params_version or task.current_params_version or 1
        params = ParamsService.get_effective_params(db, task.id, params_version)

        if request.analysis_result_id:
            analysis = db.query(MeshAnalysisResult).filter(
                MeshAnalysisResult.id == request.analysis_result_id
            ).first()
        else:
            analysis = (
                db.query(MeshAnalysisResult)
                .filter(MeshAnalysisResult.task_id == task.id)
                .order_by(MeshAnalysisResult.created_at.desc())
                .first()
            )

        if not analysis:
            raise ValueError("未找到网格分析结果，请先进行网格分析")

        if request.material_id:
            material = db.query(Material).filter(Material.id == request.material_id).first()
            if not material:
                raise ValueError(f"未找到ID为 {request.material_id} 的材料")
        elif params.get("material_id"):
            material = db.query(Material).filter(Material.id == params["material_id"]).first()
            if not material:
                material = EstimationService._get_or_create_default_material(db)
        else:
            material = EstimationService._get_or_create_default_material(db)

        calculation_steps: List[CalculationStep] = []

        layer_height = params["layer_height"]
        nozzle_diameter = params["nozzle_diameter"]
        print_speed = params["print_speed"]
        infill_density = params["infill_density"]
        support_density = params.get("support_density", 15.0)
        support_enabled = params.get("support_enabled", True)

        part_volume_mm3 = (analysis.part_volume or analysis.total_volume or 0) * 1000
        support_volume_mm3 = (analysis.support_material_volume or 0) * 1000

        if not support_enabled:
            support_volume_mm3 = 0

        step1 = CalculationStep(
            step="1. 零件体积换算",
            formula="part_volume_cm3 = part_volume_mm3 / 1000",
            inputs={"part_volume_mm3": part_volume_mm3},
            result=part_volume_mm3 / 1000,
            unit="cm³",
            explanation="将模型体积从 mm³ 转换为 cm³，用于计算材料重量",
        )
        calculation_steps.append(step1)

        step2 = CalculationStep(
            step="2. 零件重量计算",
            formula="part_mass_g = part_volume_cm3 × density × (infill_density / 100 × 0.8 + 0.2)",
            inputs={
                "part_volume_cm3": part_volume_mm3 / 1000,
                "density": material.density,
                "infill_density": infill_density,
            },
            result=(part_volume_mm3 / 1000) * material.density * (infill_density / 100 * 0.8 + 0.2),
            unit="g",
            explanation="考虑填充密度计算零件实际重量，外壳按实心计算(20%)，内部按填充比例计算",
        )
        calculation_steps.append(step2)

        part_mass_g = step2.result

        step3 = CalculationStep(
            step="3. 支撑体积换算",
            formula="support_volume_cm3 = support_volume_mm3 / 1000 × (support_density / 100)",
            inputs={
                "support_volume_mm3": support_volume_mm3,
                "support_density": support_density,
            },
            result=support_volume_mm3 / 1000 * (support_density / 100),
            unit="cm³",
            explanation="根据支撑密度计算实际支撑材料体积",
        )
        calculation_steps.append(step3)

        step4 = CalculationStep(
            step="4. 支撑重量计算",
            formula="support_mass_g = support_volume_cm3 × density",
            inputs={
                "support_volume_cm3": step3.result,
                "density": material.density,
            },
            result=step3.result * material.density,
            unit="g",
            explanation="根据材料密度计算支撑材料重量",
        )
        calculation_steps.append(step4)

        support_mass_g = step4.result
        support_volume_cm3 = step3.result

        step5 = CalculationStep(
            step="5. 支撑材料比例",
            formula="support_ratio = support_mass_g / (part_mass_g + support_mass_g) × 100",
            inputs={
                "support_mass_g": support_mass_g,
                "part_mass_g": part_mass_g,
            },
            result=support_mass_g / (part_mass_g + support_mass_g) * 100 if (part_mass_g + support_mass_g) > 0 else 0,
            unit="%",
            explanation="支撑材料占总材料用量的比例",
        )
        calculation_steps.append(step5)

        total_mass_g = part_mass_g + support_mass_g
        total_volume_cm3 = part_volume_mm3 / 1000 + support_volume_cm3

        step6 = CalculationStep(
            step="6. 耗材长度计算",
            formula="filament_length_m = total_mass_g / (density × π × (filament_diameter/2)²) / 10",
            inputs={
                "total_mass_g": total_mass_g,
                "density": material.density,
                "filament_diameter_mm": material.filament_diameter,
            },
            result=total_mass_g / (material.density * math.pi * (material.filament_diameter / 2) ** 2) / 10,
            unit="m",
            explanation="根据丝材直径和密度计算所需耗材长度",
        )
        calculation_steps.append(step6)

        filament_length_m = step6.result

        bounding_box_z = analysis.max_support_height or 10
        layer_count = math.ceil(bounding_box_z / layer_height) if layer_height > 0 else 0

        step7 = CalculationStep(
            step="7. 层数计算",
            formula="layer_count = ceil(bounding_box_z / layer_height)",
            inputs={
                "bounding_box_z_mm": bounding_box_z,
                "layer_height_mm": layer_height,
            },
            result=layer_count,
            unit="层",
            explanation="根据模型高度和层高计算总层数",
        )
        calculation_steps.append(step7)

        if analysis.overhang_area and analysis.overhang_area > 0:
            complexity_factor = min(1.0 + analysis.overhang_area / 1000, 2.5)
        else:
            complexity_factor = 1.0

        total_lines = layer_count * 50

        perimeter_speed = print_speed * 0.8
        infill_speed = print_speed * 1.2
        support_speed = print_speed * 0.9

        print_volume_mm3 = total_volume_cm3 * 1000
        cross_section_area = nozzle_diameter * layer_height * 0.85

        step8 = CalculationStep(
            step="8. 纯打印时间",
            formula="print_time_min = print_volume_mm3 / (cross_section_area × print_speed_mm/s) / 60",
            inputs={
                "print_volume_mm3": print_volume_mm3,
                "cross_section_area_mm2": cross_section_area,
                "print_speed_mm_s": print_speed,
            },
            result=print_volume_mm3 / (cross_section_area * print_speed) / 60 if cross_section_area > 0 else 0,
            unit="min",
            explanation="根据挤出量和打印速度估算纯打印时间",
        )
        calculation_steps.append(step8)

        base_print_time = step8.result

        travel_distance = total_lines * 2
        travel_speed = print_speed * 3
        travel_time_min = travel_distance / travel_speed / 60 if travel_speed > 0 else 0

        retraction_count = layer_count * 5
        retraction_time_min = retraction_count * 0.5 / 60

        cooling_time_min = layer_count * 2 / 60

        setup_time_min = 10.0

        time_breakdown = TimeBreakdown(
            travel_time_min=round(travel_time_min, 1),
            print_time_min=round(base_print_time, 1),
            retraction_time_min=round(retraction_time_min, 1),
            cooling_time_min=round(cooling_time_min, 1),
            setup_time_min=round(setup_time_min, 1),
        )

        total_time_min = (
            base_print_time * complexity_factor
            + travel_time_min
            + retraction_time_min
            + cooling_time_min
            + setup_time_min
        )

        time_correction_factor = 1.0
        is_time_underestimated = False

        if complexity_factor > 1.3:
            time_correction_factor = 1.2
            is_time_underestimated = True
            AnomalyService.create_anomaly(
                db=db,
                task_id=task.id,
                anomaly_type=AnomalyType.TIME_UNDERESTIMATED,
                severity=AnomalySeverity.WARNING,
                format_params={
                    "percent": (time_correction_factor - 1) * 100,
                    "extra_min": total_time_min * (time_correction_factor - 1),
                },
                data_source="estimation_service:time_analysis",
                params_version=params_version,
            )

        corrected_time_min = total_time_min * time_correction_factor
        print_time_hours = corrected_time_min / 60
        print_time_minutes = corrected_time_min

        step9 = CalculationStep(
            step="9. 总打印时间",
            formula="total_time_min = (print_time × complexity_factor) + travel + retraction + cooling + setup",
            inputs={
                "print_time_min": base_print_time,
                "complexity_factor": complexity_factor,
                "travel_time_min": travel_time_min,
                "retraction_time_min": retraction_time_min,
                "cooling_time_min": cooling_time_min,
                "setup_time_min": setup_time_min,
            },
            result=total_time_min,
            unit="min",
            explanation=f"考虑模型复杂度(系数{complexity_factor:.2f})计算总打印时间",
        )
        calculation_steps.append(step9)

        if is_time_underestimated:
            step10 = CalculationStep(
                step="10. 时间校正",
                formula="corrected_time = total_time × time_correction_factor",
                inputs={
                    "total_time_min": total_time_min,
                    "time_correction_factor": time_correction_factor,
                },
                result=corrected_time_min,
                unit="min",
                explanation=f"因模型复杂度较高，应用{time_correction_factor:.1f}倍校正系数",
            )
            calculation_steps.append(step10)

        filament_cost = filament_length_m * 0.05

        confidence_score = 100.0
        if not analysis.is_watertight:
            confidence_score -= 30
        if analysis.broken_face_count and analysis.broken_face_count > 0:
            confidence_score -= min(analysis.broken_face_count * 2, 20)
        if analysis.overhang_area and analysis.overhang_area > 1000:
            confidence_score -= 15
        confidence_score = max(0, confidence_score)

        calculation_details = {
            "params_used": params,
            "material": {
                "id": material.id,
                "name": material.name,
                "type": material.material_type,
                "density": material.density,
                "filament_diameter": material.filament_diameter,
            },
            "complexity_analysis": {
                "overhang_area": analysis.overhang_area,
                "complexity_factor": complexity_factor,
                "time_correction_factor": time_correction_factor,
            },
            "time_breakdown": time_breakdown.model_dump(),
        }

        estimation = SupportEstimation(
            task_id=task.id,
            params_version=params_version,
            material_id=material.id,
            analysis_result_id=analysis.id,
            part_mass_g=round(part_mass_g, 2),
            part_volume_cm3=round(part_volume_mm3 / 1000, 4),
            support_mass_g=round(support_mass_g, 2),
            support_volume_cm3=round(support_volume_cm3, 4),
            support_material_ratio=round(step5.result, 2),
            total_mass_g=round(total_mass_g, 2),
            total_volume_cm3=round(total_volume_cm3, 4),
            filament_length_m=round(filament_length_m, 2),
            filament_cost_estimate=round(filament_cost, 2),
            print_time_hours=round(print_time_hours, 2),
            print_time_minutes=round(print_time_minutes, 1),
            time_breakdown=time_breakdown.model_dump(),
            layer_count=layer_count,
            total_lines=total_lines,
            time_correction_factor=time_correction_factor,
            is_time_underestimated=is_time_underestimated,
            calculation_details=calculation_details,
            confidence_score=round(confidence_score, 1),
            notes="支撑估算完成",
        )
        db.add(estimation)
        db.flush()

        task.active_estimation_id = estimation.id

        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.ESTIMATED.value,
            message=f"估算完成: {total_mass_g:.1f}g, {print_time_hours:.1f}h",
            triggered_by="estimation_service",
            metadata={
                "total_mass_g": total_mass_g,
                "print_time_hours": print_time_hours,
                "confidence_score": confidence_score,
                "processing_time_ms": int((time.time() - start_time) * 1000),
            },
        )

        response = SupportEstimationResponse(
            id=estimation.id,
            task_id=estimation.task_id,
            params_version=estimation.params_version,
            material_id=estimation.material_id,
            analysis_result_id=estimation.analysis_result_id,
            part_mass_g=estimation.part_mass_g,
            part_volume_cm3=estimation.part_volume_cm3,
            support_mass_g=estimation.support_mass_g,
            support_volume_cm3=estimation.support_volume_cm3,
            support_material_ratio=estimation.support_material_ratio,
            total_mass_g=estimation.total_mass_g,
            total_volume_cm3=estimation.total_volume_cm3,
            filament_length_m=estimation.filament_length_m,
            filament_cost_estimate=estimation.filament_cost_estimate,
            print_time_hours=estimation.print_time_hours,
            print_time_minutes=estimation.print_time_minutes,
            time_breakdown=time_breakdown,
            layer_count=estimation.layer_count,
            total_lines=estimation.total_lines,
            time_correction_factor=estimation.time_correction_factor,
            is_time_underestimated=estimation.is_time_underestimated,
            confidence_score=estimation.confidence_score,
            calculation_steps=calculation_steps,
            calculation_details=calculation_details,
            notes=estimation.notes,
            created_at=estimation.created_at,
            updated_at=estimation.updated_at,
        )

        return estimation, response
