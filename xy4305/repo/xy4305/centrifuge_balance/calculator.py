"""配平计算引擎"""

from typing import List, Dict, Tuple, Optional
from datetime import datetime

from .models import (
    Rotor, TubeType, Sample, HoleResult, ImbalanceInfo,
    AdjustmentSuggestion, ValidationError, BalanceResult, BalanceConfig
)


class BalanceCalculator:
    """配平计算器"""
    
    def __init__(self, config: Optional[BalanceConfig] = None):
        self.config = config or BalanceConfig()
    
    def calculate_hole_result(
        self,
        sample: Sample,
        tube_type: TubeType,
        rotor: Rotor
    ) -> HoleResult:
        """计算单个孔位的结果"""
        total_mass_g = sample.total_mass_g(tube_type)
        mass_moment_gcm = total_mass_g * rotor.radius_cm
        
        return HoleResult(
            hole_position=sample.hole_position,
            tube_type_id=sample.tube_type_id,
            total_mass_g=total_mass_g,
            mass_moment_gcm=mass_moment_gcm,
            sample_volume_ml=sample.sample_volume_ml,
            sample_density_gml=sample.sample_density_gml,
            label=sample.label
        )
    
    def calculate_imbalance(
        self,
        hole1: HoleResult,
        hole2: HoleResult,
        hole_pair: Tuple[int, int]
    ) -> ImbalanceInfo:
        """计算一对孔位的不平衡量"""
        mass_difference_g = abs(hole1.total_mass_g - hole2.total_mass_g)
        moment_difference_gcm = abs(hole1.mass_moment_gcm - hole2.mass_moment_gcm)
        
        if hole1.total_mass_g > hole2.total_mass_g:
            mass_direction = f"孔位{hole1.hole_position}较重"
        else:
            mass_direction = f"孔位{hole2.hole_position}较重"
        
        return ImbalanceInfo(
            hole_pair=hole_pair,
            hole1_position=hole1.hole_position,
            hole2_position=hole2.hole_position,
            hole1_mass_g=hole1.total_mass_g,
            hole2_mass_g=hole2.total_mass_g,
            mass_difference_g=mass_difference_g,
            mass_direction=mass_direction,
            hole1_moment_gcm=hole1.mass_moment_gcm,
            hole2_moment_gcm=hole2.mass_moment_gcm,
            moment_difference_gcm=moment_difference_gcm
        )
    
    def generate_adjustment_suggestions(
        self,
        imbalance_infos: List[ImbalanceInfo],
        hole_results: List[HoleResult],
        tube_types: Dict[str, TubeType],
        rotor: Rotor
    ) -> List[AdjustmentSuggestion]:
        """生成调整建议"""
        suggestions = []
        hole_result_map = {hr.hole_position: hr for hr in hole_results}
        
        for imbalance in imbalance_infos:
            hole1 = hole_result_map[imbalance.hole1_position]
            hole2 = hole_result_map[imbalance.hole2_position]
            
            if imbalance.mass_difference_g > self.config.mass_imbalance_threshold_g:
                tube_type1 = tube_types.get(hole1.tube_type_id)
                tube_type2 = tube_types.get(hole2.tube_type_id)
                
                if tube_type1 and tube_type2:
                    if imbalance.hole1_mass_g > imbalance.hole2_mass_g:
                        heavier_hole = hole1
                        lighter_hole = hole2
                        heavier_tube = tube_type1
                        lighter_tube = tube_type2
                    else:
                        heavier_hole = hole2
                        lighter_hole = hole1
                        heavier_tube = tube_type2
                        lighter_tube = tube_type1
                    
                    mass_diff = abs(imbalance.hole1_mass_g - imbalance.hole2_mass_g)
                    
                    density = lighter_hole.sample_density_gml
                    adjustment_ml = mass_diff / density
                    
                    adjustment_ml = round(adjustment_ml, 2)
                    
                    available_volume = lighter_tube.max_volume_ml - lighter_hole.sample_volume_ml
                    
                    if available_volume >= adjustment_ml:
                        suggestions.append(AdjustmentSuggestion(
                            suggestion_type="补液",
                            description=f"在孔位{lighter_hole.hole_position}补充{adjustment_ml}ml溶剂（密度{density}g/ml）",
                            hole_position=lighter_hole.hole_position,
                            adjustment_ml=adjustment_ml,
                            priority="high" if imbalance.mass_difference_g > 0.5 else "medium"
                        ))
                    else:
                        suggestions.append(AdjustmentSuggestion(
                            suggestion_type="补液警告",
                            description=f"孔位{lighter_hole.hole_position}容量不足，建议检查管型或减少孔位{heavier_hole.hole_position}的样品量",
                            hole_position=lighter_hole.hole_position,
                            target_hole=heavier_hole.hole_position,
                            priority="high"
                        ))
                    
                    if hole1.tube_type_id != hole2.tube_type_id:
                        suggestions.append(AdjustmentSuggestion(
                            suggestion_type="管型不匹配",
                            description=f"孔位{hole1.hole_position}和{hole2.hole_position}使用了不同管型，建议统一使用相同管型",
                            hole_position=hole1.hole_position,
                            target_hole=hole2.hole_position,
                            priority="high"
                        ))
        
        swap_suggestions = self._generate_swap_suggestions(hole_results, imbalance_infos)
        suggestions.extend(swap_suggestions)
        
        suggestions.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}.get(x.priority, 1))
        
        seen = set()
        unique_suggestions = []
        for s in suggestions:
            key = (s.suggestion_type, s.description)
            if key not in seen:
                seen.add(key)
                unique_suggestions.append(s)
        
        return unique_suggestions
    
    def _generate_swap_suggestions(
        self,
        hole_results: List[HoleResult],
        imbalance_infos: List[ImbalanceInfo]
    ) -> List[AdjustmentSuggestion]:
        """生成换位建议"""
        suggestions = []
        
        if len(imbalance_infos) >= 2:
            hole_result_map = {hr.hole_position: hr for hr in hole_results}
            
            heavy_holes = []
            light_holes = []
            
            for imbalance in imbalance_infos:
                if imbalance.mass_difference_g > self.config.mass_imbalance_threshold_g:
                    if imbalance.hole1_mass_g > imbalance.hole2_mass_g:
                        heavy_holes.append(imbalance.hole1_position)
                        light_holes.append(imbalance.hole2_position)
                    else:
                        heavy_holes.append(imbalance.hole2_position)
                        light_holes.append(imbalance.hole1_position)
            
            if heavy_holes and light_holes:
                for i, (heavy_pos, light_pos) in enumerate(zip(heavy_holes[:2], light_holes[:2])):
                    heavy_hr = hole_result_map[heavy_pos]
                    light_hr = hole_result_map[light_pos]
                    
                    suggestions.append(AdjustmentSuggestion(
                        suggestion_type="换位",
                        description=f"考虑将孔位{heavy_pos}（质量{heavy_hr.total_mass_g:.2f}g）与孔位{light_pos}（质量{light_hr.total_mass_g:.2f}g）的样品交换位置",
                        hole_position=heavy_pos,
                        target_hole=light_pos,
                        priority="medium"
                    ))
        
        return suggestions
    
    def validate_inputs(
        self,
        rotor: Rotor,
        samples: List[Sample],
        tube_types: Dict[str, TubeType],
        run_rpm: int
    ) -> List[ValidationError]:
        """验证输入数据"""
        errors = []
        
        if run_rpm > rotor.max_rpm:
            errors.append(ValidationError(
                error_type="转速超限",
                message=f"设定转速 {run_rpm} RPM 超过转子最大转速 {rotor.max_rpm} RPM",
                details={"set_rpm": run_rpm, "max_rpm": rotor.max_rpm}
            ))
        
        if run_rpm <= 0:
            errors.append(ValidationError(
                error_type="转速无效",
                message=f"转速 {run_rpm} RPM 无效，必须大于0",
                details={"set_rpm": run_rpm}
            ))
        
        used_positions = set()
        for sample in samples:
            if sample.hole_position in used_positions:
                errors.append(ValidationError(
                    error_type="孔位重复",
                    message=f"孔位 {sample.hole_position} 被重复使用",
                    details={"position": sample.hole_position}
                ))
            used_positions.add(sample.hole_position)
            
            if sample.hole_position < 1 or sample.hole_position > rotor.hole_count:
                errors.append(ValidationError(
                    error_type="孔位无效",
                    message=f"孔位 {sample.hole_position} 超出有效范围 [1, {rotor.hole_count}]",
                    details={"position": sample.hole_position, "max_position": rotor.hole_count}
                ))
            
            if sample.tube_type_id not in tube_types:
                errors.append(ValidationError(
                    error_type="管型不存在",
                    message=f"孔位 {sample.hole_position} 使用的管型 '{sample.tube_type_id}' 未定义",
                    details={"position": sample.hole_position, "tube_type_id": sample.tube_type_id}
                ))
            else:
                tube_type = tube_types[sample.tube_type_id]
                if sample.sample_volume_ml < 0:
                    errors.append(ValidationError(
                        error_type="体积无效",
                        message=f"孔位 {sample.hole_position} 的样品体积 {sample.sample_volume_ml} ml 不能为负数",
                        details={"position": sample.hole_position, "volume": sample.sample_volume_ml}
                    ))
                elif sample.sample_volume_ml > tube_type.max_volume_ml:
                    errors.append(ValidationError(
                        error_type="体积超限",
                        message=f"孔位 {sample.hole_position} 的样品体积 {sample.sample_volume_ml} ml 超过管型最大容量 {tube_type.max_volume_ml} ml",
                        details={
                            "position": sample.hole_position,
                            "volume": sample.sample_volume_ml,
                            "max_volume": tube_type.max_volume_ml
                        }
                    ))
            
            if sample.sample_density_gml <= 0:
                errors.append(ValidationError(
                    error_type="密度无效",
                    message=f"孔位 {sample.hole_position} 的样品密度 {sample.sample_density_gml} g/ml 必须大于0",
                    details={"position": sample.hole_position, "density": sample.sample_density_gml}
                ))
        
        if not self.config.allow_partial_loading:
            hole_pairs = rotor.get_hole_pairs()
            for pair in hole_pairs:
                pos1, pos2 = pair
                has_pos1 = any(s.hole_position == pos1 for s in samples)
                has_pos2 = any(s.hole_position == pos2 for s in samples)
                
                if has_pos1 != has_pos2:
                    if has_pos1:
                        missing_pos = pos2
                        present_pos = pos1
                    else:
                        missing_pos = pos1
                        present_pos = pos2
                    
                    errors.append(ValidationError(
                        error_type="缺孔",
                        message=f"孔位对 ({pos1}, {pos2}) 不完整：孔位{present_pos}有样品，但孔位{missing_pos}为空",
                        details={"hole_pair": pair, "missing": missing_pos, "present": present_pos}
                    ))
        
        return errors
    
    def calculate(
        self,
        rotor: Rotor,
        samples: List[Sample],
        tube_types: Dict[str, TubeType],
        run_rpm: int,
        notes: str = ""
    ) -> BalanceResult:
        """执行配平计算"""
        validation_errors = self.validate_inputs(rotor, samples, tube_types, run_rpm)
        
        if validation_errors:
            return BalanceResult(
                rotor_id=rotor.id,
                run_rpm=run_rpm,
                hole_results=[],
                imbalance_infos=[],
                adjustment_suggestions=[],
                validation_errors=validation_errors,
                is_balanced=False,
                max_mass_imbalance_g=0,
                max_moment_imbalance_gcm=0,
                notes=notes
            )
        
        hole_results = []
        for sample in samples:
            tube_type = tube_types[sample.tube_type_id]
            hole_result = self.calculate_hole_result(sample, tube_type, rotor)
            hole_results.append(hole_result)
        
        hole_result_map = {hr.hole_position: hr for hr in hole_results}
        
        imbalance_infos = []
        hole_pairs = rotor.get_hole_pairs()
        
        for pair in hole_pairs:
            pos1, pos2 = pair
            if pos1 in hole_result_map and pos2 in hole_result_map:
                hole1 = hole_result_map[pos1]
                hole2 = hole_result_map[pos2]
                imbalance = self.calculate_imbalance(hole1, hole2, pair)
                imbalance_infos.append(imbalance)
        
        adjustment_suggestions = self.generate_adjustment_suggestions(
            imbalance_infos, hole_results, tube_types, rotor
        )
        
        if imbalance_infos:
            max_mass_imbalance_g = max(ii.mass_difference_g for ii in imbalance_infos)
            max_moment_imbalance_gcm = max(ii.moment_difference_gcm for ii in imbalance_infos)
        else:
            max_mass_imbalance_g = 0
            max_moment_imbalance_gcm = 0
        
        is_balanced = (
            max_mass_imbalance_g <= self.config.mass_imbalance_threshold_g and
            max_moment_imbalance_gcm <= self.config.moment_imbalance_threshold_gcm and
            not validation_errors
        )
        
        return BalanceResult(
            rotor_id=rotor.id,
            run_rpm=run_rpm,
            hole_results=hole_results,
            imbalance_infos=imbalance_infos,
            adjustment_suggestions=adjustment_suggestions,
            validation_errors=validation_errors,
            is_balanced=is_balanced,
            max_mass_imbalance_g=max_mass_imbalance_g,
            max_moment_imbalance_gcm=max_moment_imbalance_gcm,
            notes=notes
        )
