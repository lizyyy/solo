from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from enum import Enum

from bend_checker.models.part import Part, Bend, BendDirection


class InterferenceType(Enum):
    FLANGE_COLLISION = "flange_collision"
    TOOL_INTERFERENCE = "tool_interference"
    SEQUENCE_CONFLICT = "sequence_conflict"
    MATERIAL_SPRINGBACK = "material_springback"


@dataclass
class InterferenceIssue:
    issue_type: InterferenceType
    severity: str  
    description: str
    affected_bends: List[str]
    suggested_fix: str


@dataclass
class InterferenceResult:
    part_number: str
    has_issues: bool
    issues: List[InterferenceIssue]
    warnings: List[str]
    safe_operations: int
    risky_operations: int


class InterferenceChecker:
    
    @staticmethod
    def check_all(
        part: Part,
        bend_sequence: Optional[List[str]] = None,
        die_set=None
    ) -> InterferenceResult:
        issues: List[InterferenceIssue] = []
        warnings: List[str] = []
        
        if bend_sequence is None:
            bend_sequence = [b.id for b in part.bends]
        
        flange_issues = InterferenceChecker._check_flange_collision(part, bend_sequence)
        issues.extend(flange_issues)
        
        if die_set:
            tool_issues = InterferenceChecker._check_tool_interference(part, die_set)
            issues.extend(tool_issues)
        
        sequence_issues = InterferenceChecker._check_sequence_conflict(part, bend_sequence)
        issues.extend(sequence_issues)
        
        springback_warnings = InterferenceChecker._check_springback_risk(part)
        warnings.extend(springback_warnings)
        
        risky_count = sum(1 for i in issues if i.severity in ["high", "medium"])
        safe_count = len(part.bends) - risky_count
        
        return InterferenceResult(
            part_number=part.part_number,
            has_issues=len(issues) > 0,
            issues=issues,
            warnings=warnings,
            safe_operations=max(0, safe_count),
            risky_operations=risky_count
        )
    
    @staticmethod
    def _check_flange_collision(
        part: Part,
        bend_sequence: List[str]
    ) -> List[InterferenceIssue]:
        issues: List[InterferenceIssue] = []
        
        bends_by_id = {b.id: b for b in part.bends}
        
        for i, bend_id in enumerate(bend_sequence):
            current_bend = bends_by_id.get(bend_id)
            if not current_bend:
                continue
            
            subsequent_bends = bend_sequence[i + 1:]
            
            for sub_bend_id in subsequent_bends:
                sub_bend = bends_by_id.get(sub_bend_id)
                if not sub_bend:
                    continue
                
                collision_risk = InterferenceChecker._evaluate_flange_risk(
                    current_bend, sub_bend, part.material_thickness
                )
                
                if collision_risk:
                    issues.append(InterferenceIssue(
                        issue_type=InterferenceType.FLANGE_COLLISION,
                        severity=collision_risk['severity'],
                        description=f"折弯 {bend_id} 与后续折弯 {sub_bend_id} 存在法兰碰撞风险",
                        affected_bends=[bend_id, sub_bend_id],
                        suggested_fix=collision_risk['suggestion']
                    ))
        
        return issues
    
    @staticmethod
    def _evaluate_flange_risk(
        bend1: Bend,
        bend2: Bend,
        material_thickness: float
    ) -> Optional[Dict]:
        if bend1.direction == bend2.direction:
            return None
        
        combined_flange = bend1.flange_length + bend2.flange_length
        min_safe_distance = material_thickness * 5
        
        if bend1.flange_length < material_thickness * 2 or bend2.flange_length < material_thickness * 2:
            return {
                'severity': 'high',
                'suggestion': '建议调整折弯顺序，先折短法兰，或使用特殊模具'
            }
        
        if bend1.flange_length > bend2.flange_length * 1.5:
            return {
                'severity': 'medium',
                'suggestion': '建议先折短法兰，再折长法兰'
            }
        
        if bend1.bend_angle != 90.0 or bend2.bend_angle != 90.0:
            return {
                'severity': 'low',
                'suggestion': '非90度折弯，建议实际试折验证'
            }
        
        return None
    
    @staticmethod
    def _check_tool_interference(
        part: Part,
        die_set
    ) -> List[InterferenceIssue]:
        issues: List[InterferenceIssue] = []
        
        if not die_set:
            return issues
        
        for bend in part.bends:
            suitable_dies = die_set.find_suitable_dies(
                part.material_thickness,
                bend.bend_radius,
                bend.bend_angle
            )
            
            if not suitable_dies:
                issues.append(InterferenceIssue(
                    issue_type=InterferenceType.TOOL_INTERFERENCE,
                    severity='high',
                    description=f"折弯 {bend.id} 未找到合适的模具",
                    affected_bends=[bend.id],
                    suggested_fix='检查模具配置，或调整折弯半径/角度'
                ))
            else:
                recommended_v = part.material_thickness * 8
                best_die = suitable_dies[0]
                if abs(best_die.v_width - recommended_v) > recommended_v * 0.2:
                    issues.append(InterferenceIssue(
                        issue_type=InterferenceType.TOOL_INTERFERENCE,
                        severity='low',
                        description=f"折弯 {bend.id} 推荐V槽宽度 {recommended_v}mm，当前最佳匹配 {best_die.v_width}mm",
                        affected_bends=[bend.id],
                        suggested_fix='如条件允许，考虑使用更匹配的模具'
                    ))
        
        return issues
    
    @staticmethod
    def _check_sequence_conflict(
        part: Part,
        bend_sequence: List[str]
    ) -> List[InterferenceIssue]:
        issues: List[InterferenceIssue] = []
        
        bends_by_id = {b.id: b for b in part.bends}
        
        if len(bend_sequence) < 2:
            return issues
        
        direction_changes = 0
        for i in range(len(bend_sequence) - 1):
            bend1 = bends_by_id.get(bend_sequence[i])
            bend2 = bends_by_id.get(bend_sequence[i + 1])
            
            if not bend1 or not bend2:
                continue
            
            if bend1.direction != bend2.direction:
                direction_changes += 1
        
        if direction_changes > 2:
            issues.append(InterferenceIssue(
                issue_type=InterferenceType.SEQUENCE_CONFLICT,
                severity='low',
                description=f"折弯顺序需要 {direction_changes} 次翻面，效率较低",
                affected_bends=bend_sequence,
                suggested_fix='考虑重新排序以减少翻面次数'
            ))
        
        return issues
    
    @staticmethod
    def _check_springback_risk(part: Part) -> List[str]:
        warnings: List[str] = []
        
        for bend in part.bends:
            if bend.bend_angle < 90.0:
                warnings.append(f"折弯 {bend.id}: 锐角折弯 ({bend.bend_angle}°)，回弹风险较高")
            
            if bend.bend_radius < part.material_thickness:
                warnings.append(f"折弯 {bend.id}: 小半径折弯 (R={bend.bend_radius})，材料有开裂风险")
        
        return warnings
    
    @staticmethod
    def check_single_bend_interference(
        bend: Bend,
        other_bends: List[Bend],
        material_thickness: float
    ) -> Dict:
        risks = {
            'collision_risk': False,
            'severity': 'none',
            'details': []
        }
        
        for other in other_bends:
            if other.id == bend.id:
                continue
            
            risk = InterferenceChecker._evaluate_flange_risk(bend, other, material_thickness)
            if risk:
                risks['collision_risk'] = True
                if risk['severity'] == 'high' or risks['severity'] == 'none':
                    risks['severity'] = risk['severity']
                risks['details'].append({
                    'with_bend': other.id,
                    'severity': risk['severity'],
                    'suggestion': risk['suggestion']
                })
        
        return risks
