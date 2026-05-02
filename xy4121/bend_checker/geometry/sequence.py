from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from enum import Enum

from bend_checker.models.part import Part, Bend, BendDirection


class BendGroup(Enum):
    OUTSIDE = "outside"  
    INSIDE = "inside"    
    ALTERNATING = "alternating"


@dataclass
class SequenceStep:
    step_number: int
    bend_id: str
    bend_angle: float
    bend_radius: float
    direction: BendDirection
    flange_length: float
    risk_level: str  
    interference_risk: bool
    notes: List[str]


@dataclass
class SequenceResult:
    part_number: str
    bend_ids: List[str]
    steps: List[SequenceStep]
    total_steps: int
    risks: List[Dict]
    recommended_sequence: List[str]
    alternative_sequences: List[List[str]]


class BendSequencePlanner:
    
    @staticmethod
    def plan_sequence(
        part: Part,
        die_set=None,
        machine_library=None
    ) -> SequenceResult:
        if not part.bends:
            return SequenceResult(
                part_number=part.part_number,
                bend_ids=[],
                steps=[],
                total_steps=0,
                risks=[],
                recommended_sequence=[],
                alternative_sequences=[]
            )
        
        bends_with_info = []
        for bend in part.bends:
            group = BendSequencePlanner._classify_bend(bend, part.bends)
            priority = BendSequencePlanner._calculate_priority(bend, group)
            bends_with_info.append({
                'bend': bend,
                'group': group,
                'priority': priority,
            })
        
        bends_with_info.sort(key=lambda x: x['priority'], reverse=True)
        
        recommended_sequence = [info['bend'].id for info in bends_with_info]
        
        steps = []
        risks = []
        
        for step_num, info in enumerate(bends_with_info, 1):
            bend = info['bend']
            interference_risk = BendSequencePlanner._check_interference_risk(
                bend, 
                part.bends,
                step_num,
                recommended_sequence
            )
            
            risk_level = "low"
            step_notes = []
            
            if bend.flange_length < part.material_thickness * 3:
                risk_level = "high"
                step_notes.append(f"法兰长度 {bend.flange_length}mm 过短，可能导致折弯困难")
            
            if interference_risk:
                risk_level = "high" if risk_level == "low" else risk_level
                step_notes.append("存在干涉风险，建议调整折弯顺序")
            
            if info['group'] == BendGroup.ALTERNATING:
                step_notes.append("交替折弯，需注意翻面操作")
            
            step = SequenceStep(
                step_number=step_num,
                bend_id=bend.id,
                bend_angle=bend.bend_angle,
                bend_radius=bend.bend_radius,
                direction=bend.direction,
                flange_length=bend.flange_length,
                risk_level=risk_level,
                interference_risk=interference_risk,
                notes=step_notes
            )
            steps.append(step)
            
            if risk_level in ["medium", "high"]:
                risks.append({
                    'step': step_num,
                    'bend_id': bend.id,
                    'risk_level': risk_level,
                    'description': step_notes
                })
        
        alternative_sequences = BendSequencePlanner._generate_alternatives(
            bends_with_info,
            recommended_sequence
        )
        
        return SequenceResult(
            part_number=part.part_number,
            bend_ids=[b.id for b in part.bends],
            steps=steps,
            total_steps=len(steps),
            risks=risks,
            recommended_sequence=recommended_sequence,
            alternative_sequences=alternative_sequences
        )
    
    @staticmethod
    def _classify_bend(bend: Bend, all_bends: List[Bend]) -> BendGroup:
        directions = [b.direction for b in all_bends]
        
        if len(directions) <= 1:
            return BendGroup.OUTSIDE
        
        up_count = sum(1 for d in directions if d == BendDirection.UP)
        down_count = len(directions) - up_count
        
        if up_count == 0 or down_count == 0:
            if bend.flange_length < max(b.flange_length for b in all_bends):
                return BendGroup.INSIDE
            return BendGroup.OUTSIDE
        
        return BendGroup.ALTERNATING
    
    @staticmethod
    def _calculate_priority(bend: Bend, group: BendGroup) -> int:
        priority = 0
        
        if group == BendGroup.OUTSIDE:
            priority += 100
        elif group == BendGroup.INSIDE:
            priority += 80
        else:
            priority += 50
        
        priority += int(bend.flange_length)
        
        if bend.bend_angle == 90.0:
            priority += 10
        elif bend.bend_angle > 90.0:
            priority += 5
        
        return priority
    
    @staticmethod
    def _check_interference_risk(
        bend: Bend,
        all_bends: List[Bend],
        current_step: int,
        sequence: List[str]
    ) -> bool:
        bend_idx = sequence.index(bend.id)
        subsequent_bends = sequence[bend_idx + 1:]
        
        for sub_bend_id in subsequent_bends:
            sub_bend = next((b for b in all_bends if b.id == sub_bend_id), None)
            if sub_bend:
                if sub_bend.direction != bend.direction:
                    if sub_bend.flange_length > bend.flange_length * 0.5:
                        return True
        
        return False
    
    @staticmethod
    def _generate_alternatives(
        bends_with_info: List[Dict],
        primary_sequence: List[str]
    ) -> List[List[str]]:
        alternatives = []
        
        if len(primary_sequence) >= 3:
            alt1 = primary_sequence[:]
            if len(alt1) >= 2:
                alt1[0], alt1[1] = alt1[1], alt1[0]
                alternatives.append(alt1)
        
        up_bends = [info['bend'].id for info in bends_with_info 
                    if info['bend'].direction == BendDirection.UP]
        down_bends = [info['bend'].id for info in bends_with_info 
                      if info['bend'].direction == BendDirection.DOWN]
        
        if up_bends and down_bends:
            alternatives.append(up_bends + down_bends)
            alternatives.append(down_bends + up_bends)
        
        unique_alternatives = []
        seen = set()
        for seq in [primary_sequence] + alternatives:
            seq_tuple = tuple(seq)
            if seq_tuple not in seen and seq_tuple != tuple(primary_sequence):
                seen.add(seq_tuple)
                unique_alternatives.append(seq)
        
        return unique_alternatives[:3]
    
    @staticmethod
    def validate_sequence(
        sequence: List[str],
        part: Part
    ) -> Tuple[bool, List[str]]:
        issues = []
        
        bend_ids = [b.id for b in part.bends]
        for bend_id in sequence:
            if bend_id not in bend_ids:
                issues.append(f"折弯ID {bend_id} 不存在于零件中")
        
        for bend_id in bend_ids:
            if bend_id not in sequence:
                issues.append(f"折弯ID {bend_id} 未包含在折弯顺序中")
        
        return (len(issues) == 0, issues)
    
    @staticmethod
    def get_flange_order_heuristic(
        part: Part
    ) -> List[Tuple[str, str]]:
        if not part.bends:
            return []
        
        sorted_bends = sorted(part.bends, key=lambda b: b.flange_length, reverse=True)
        
        order = []
        for i, bend in enumerate(sorted_bends, 1):
            order.append((bend.id, f"第{i}步 - 法兰长度: {bend.flange_length}mm"))
        
        return order
