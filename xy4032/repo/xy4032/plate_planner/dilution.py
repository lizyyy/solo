"""
稀释计算模块 - 计算样品稀释步骤，验证移液体积范围
"""

from typing import List, Optional, Tuple
from dataclasses import dataclass

from .models import Sample, DilutionStep
from .units import parse_concentration, to_ul
from .config import PipetteConfig


@dataclass
class DilutionError:
    sample_id: str
    error_type: str
    message: str


class DilutionCalculator:
    def __init__(self, pipette_config: PipetteConfig):
        self.pipette_config = pipette_config
        self.min_volume = pipette_config.min_volume_ul
        self.max_volume = pipette_config.max_volume_ul
        self.dead_volume = pipette_config.dead_volume_ul

    def calculate_dilution_steps(
        self,
        sample: Sample,
        final_volume_per_well_ul: float = 20.0,
    ) -> Tuple[Optional[List[DilutionStep]], List[DilutionError]]:
        errors: List[DilutionError] = []

        target_unit = sample.target_concentration_unit or sample.concentration_unit
        mw = sample.molecular_weight or 1000.0

        try:
            initial_conc_target_unit = parse_concentration(
                sample.initial_concentration,
                sample.concentration_unit,
                target_unit,
                mw
            )
        except ValueError as e:
            errors.append(DilutionError(
                sample_id=sample.sample_id,
                error_type="unit_conversion_error",
                message=f"浓度单位转换失败: {str(e)}"
            ))
            return None, errors

        target_conc = sample.target_concentration

        if target_conc > initial_conc_target_unit:
            errors.append(DilutionError(
                sample_id=sample.sample_id,
                error_type="target_higher_than_initial",
                message=f"目标浓度 ({target_conc} {target_unit}) 高于原液浓度 ({initial_conc_target_unit} {target_unit})，无法稀释"
            ))
            return None, errors

        if target_conc == initial_conc_target_unit:
            return self._create_no_dilution_step(sample, target_unit, target_conc, final_volume_per_well_ul), errors

        total_required_volume_ul = self._calculate_total_required_volume(
            sample.replicate_count, final_volume_per_well_ul
        )

        steps, step_errors = self._calculate_dilution_steps_optimized(
            sample_id=sample.sample_id,
            initial_concentration=initial_conc_target_unit,
            target_concentration=target_conc,
            target_unit=target_unit,
            total_required_volume_ul=total_required_volume_ul,
        )

        if step_errors:
            errors.extend(step_errors)
            return None, errors

        if steps:
            total_sample_needed = steps[0].sample_volume_ul + self.dead_volume
            if total_sample_needed > sample.available_volume:
                errors.append(DilutionError(
                    sample_id=sample.sample_id,
                    error_type="insufficient_volume",
                    message=f"可用体积 ({sample.available_volume} ul) 不足，需要 {total_sample_needed:.2f} ul (含死体积)"
                ))
                return None, errors

        return steps, errors

    def _create_no_dilution_step(
        self,
        sample: Sample,
        target_unit: str,
        target_conc: float,
        final_volume_per_well_ul: float,
    ) -> List[DilutionStep]:
        total_volume = self._calculate_total_required_volume(
            sample.replicate_count, final_volume_per_well_ul
        )
        return [
            DilutionStep(
                step_number=1,
                source_concentration=target_conc,
                target_concentration=target_conc,
                dilution_factor=1.0,
                sample_volume_ul=total_volume,
                diluent_volume_ul=0.0,
                total_volume_ul=total_volume,
                unit=target_unit,
            )
        ]

    def _calculate_total_required_volume(
        self,
        replicate_count: int,
        per_well_volume_ul: float,
    ) -> float:
        return replicate_count * per_well_volume_ul + self.dead_volume

    def _calculate_dilution_steps_optimized(
        self,
        sample_id: str,
        initial_concentration: float,
        target_concentration: float,
        target_unit: str,
        total_required_volume_ul: float,
    ) -> Tuple[Optional[List[DilutionStep]], List[DilutionError]]:
        errors: List[DilutionError] = []

        total_dilution_factor = initial_concentration / target_concentration

        if total_dilution_factor <= 1.0:
            return self._create_single_step(
                initial_concentration, target_concentration, target_unit, total_required_volume_ul
            ), errors

        steps = []
        current_conc = initial_concentration
        remaining_factor = total_dilution_factor
        step_number = 1

        while remaining_factor > 1.0:
            max_single_step_factor = self.max_volume / self.min_volume

            if remaining_factor <= max_single_step_factor:
                step, step_errors = self._create_single_dilution_step(
                    sample_id=sample_id,
                    source_conc=current_conc,
                    target_conc=current_conc / remaining_factor,
                    target_volume_ul=total_required_volume_ul if not steps else max(
                        total_required_volume_ul,
                        self.min_volume * 10
                    ),
                    unit=target_unit,
                    step_number=step_number,
                )

                if step_errors:
                    return None, step_errors

                steps.append(step)
                break
            else:
                step_factor = min(max_single_step_factor, remaining_factor)
                target_conc_step = current_conc / step_factor

                step_volume = max(
                    total_required_volume_ul,
                    self.min_volume * 10
                )

                step, step_errors = self._create_single_dilution_step(
                    sample_id=sample_id,
                    source_conc=current_conc,
                    target_conc=target_conc_step,
                    target_volume_ul=step_volume,
                    unit=target_unit,
                    step_number=step_number,
                )

                if step_errors:
                    return None, step_errors

                steps.append(step)
                current_conc = target_conc_step
                remaining_factor = remaining_factor / step_factor
                step_number += 1

        return steps, errors

    def _create_single_dilution_step(
        self,
        sample_id: str,
        source_conc: float,
        target_conc: float,
        target_volume_ul: float,
        unit: str,
        step_number: int,
    ) -> Tuple[Optional[DilutionStep], List[DilutionError]]:
        errors: List[DilutionError] = []
        dilution_factor = source_conc / target_conc

        sample_volume_ul = target_volume_ul / dilution_factor

        if sample_volume_ul < self.min_volume:
            errors.append(DilutionError(
                sample_id=sample_id,
                error_type="volume_too_small",
                message=f"移液体积 {sample_volume_ul:.4f} ul 小于最小移液体积 {self.min_volume} ul"
            ))
            return None, errors

        if sample_volume_ul > self.max_volume:
            errors.append(DilutionError(
                sample_id=sample_id,
                error_type="volume_too_large",
                message=f"移液体积 {sample_volume_ul:.2f} ul 大于最大移液体积 {self.max_volume} ul"
            ))
            return None, errors

        diluent_volume_ul = target_volume_ul - sample_volume_ul

        if diluent_volume_ul < self.min_volume and diluent_volume_ul > 0:
            errors.append(DilutionError(
                sample_id=sample_id,
                error_type="diluent_volume_too_small",
                message=f"稀释液体积 {diluent_volume_ul:.4f} ul 小于最小移液体积 {self.min_volume} ul"
            ))
            return None, errors

        return DilutionStep(
            step_number=step_number,
            source_concentration=source_conc,
            target_concentration=target_conc,
            dilution_factor=dilution_factor,
            sample_volume_ul=sample_volume_ul,
            diluent_volume_ul=diluent_volume_ul,
            total_volume_ul=target_volume_ul,
            unit=unit,
        ), errors

    def _create_single_step(
        self,
        initial_conc: float,
        target_conc: float,
        unit: str,
        total_volume_ul: float,
    ) -> List[DilutionStep]:
        return [
            DilutionStep(
                step_number=1,
                source_concentration=initial_conc,
                target_concentration=target_conc,
                dilution_factor=initial_conc / target_conc if target_conc > 0 else 1.0,
                sample_volume_ul=total_volume_ul,
                diluent_volume_ul=0.0,
                total_volume_ul=total_volume_ul,
                unit=unit,
            )
        ]
