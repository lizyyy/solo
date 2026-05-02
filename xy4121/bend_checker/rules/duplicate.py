from dataclasses import dataclass
from typing import List, Dict, Optional, Set, Tuple
from collections import defaultdict

from bend_checker.models.part import Part


@dataclass
class DuplicateGroup:
    group_id: str
    representative_part: str
    duplicate_parts: List[str]
    quantity: int
    total_quantity: int
    similarity_score: float
    key_differences: List[str]


@dataclass
class DuplicateResult:
    total_parts: int
    unique_groups: int
    duplicate_groups: List[DuplicateGroup]
    duplicates_found: int
    potential_savings: Dict[str, float]


class DuplicateChecker:
    
    @staticmethod
    def check_all(
        parts: List[Part],
        tolerance: float = 0.01,
        check_attributes: bool = True
    ) -> DuplicateResult:
        if not parts:
            return DuplicateResult(
                total_parts=0,
                unique_groups=0,
                duplicate_groups=[],
                duplicates_found=0,
                potential_savings={}
            )
        
        groups = defaultdict(list)
        
        for part in parts:
            key = DuplicateChecker._generate_part_key(part, tolerance)
            groups[key].append(part)
        
        duplicate_groups: List[DuplicateGroup] = []
        
        for key, group_parts in groups.items():
            if len(group_parts) > 1:
                group_parts.sort(key=lambda p: p.quantity, reverse=True)
                representative = group_parts[0]
                duplicates = group_parts[1:]
                
                total_qty = sum(p.quantity for p in group_parts)
                
                differences = DuplicateChecker._find_differences(group_parts, check_attributes)
                
                duplicate_groups.append(DuplicateGroup(
                    group_id=key[:20],
                    representative_part=representative.part_number,
                    duplicate_parts=[p.part_number for p in duplicates],
                    quantity=len(duplicates),
                    total_quantity=total_qty,
                    similarity_score=1.0 - (len(differences) * 0.05),
                    key_differences=differences
                ))
        
        total_duplicates = sum(g.quantity for g in duplicate_groups)
        
        savings = DuplicateChecker._calculate_savings(duplicate_groups)
        
        return DuplicateResult(
            total_parts=len(parts),
            unique_groups=len(groups),
            duplicate_groups=duplicate_groups,
            duplicates_found=total_duplicates,
            potential_savings=savings
        )
    
    @staticmethod
    def _generate_part_key(part: Part, tolerance: float) -> str:
        key_parts = [
            f"mat_{part.material_grade}",
            f"t_{round(part.material_thickness / tolerance) * tolerance:.3f}",
        ]
        
        bend_signatures = []
        for bend in sorted(part.bends, key=lambda b: (b.bend_angle, b.bend_radius, b.flange_length)):
            bend_sig = (
                f"a_{round(bend.bend_angle / tolerance) * tolerance:.1f}_"
                f"r_{round(bend.bend_radius / tolerance) * tolerance:.2f}_"
                f"f_{round(bend.flange_length / tolerance) * tolerance:.2f}_"
                f"d_{bend.direction.value}"
            )
            bend_signatures.append(bend_sig)
        key_parts.append(f"bends_{'|'.join(sorted(bend_signatures))}")
        
        hole_signatures = []
        for hole in sorted(part.holes, key=lambda h: (h.hole_type.value, h.diameter or h.width or 0)):
            if hole.hole_type.value == 'circular' and hole.diameter:
                hole_sig = f"c_d_{round(hole.diameter / tolerance) * tolerance:.2f}"
            elif hole.width and hole.height:
                hole_sig = f"r_w_{round(hole.width / tolerance) * tolerance:.2f}_h_{round(hole.height / tolerance) * tolerance:.2f}"
            else:
                hole_sig = f"{hole.hole_type.value}"
            hole_signatures.append(hole_sig)
        
        if hole_signatures:
            key_parts.append(f"holes_{'|'.join(sorted(hole_signatures))}")
        
        return "|".join(key_parts)
    
    @staticmethod
    def _find_differences(
        parts: List[Part],
        check_attributes: bool
    ) -> List[str]:
        differences = []
        
        if not check_attributes or len(parts) < 2:
            return differences
        
        reference = parts[0]
        
        for part in parts[1:]:
            if part.quantity != reference.quantity:
                differences.append(f"数量不同: {reference.quantity} vs {part.quantity}")
            
            if part.part_name != reference.part_name:
                differences.append(f"名称不同: {reference.part_name} vs {part.part_name}")
            
            if abs(part.overall_length - reference.overall_length) > 0.1:
                differences.append(
                    f"外形长度不同: {reference.overall_length} vs {part.overall_length}"
                )
        
        return list(set(differences))
    
    @staticmethod
    def _calculate_savings(
        duplicate_groups: List[DuplicateGroup]
    ) -> Dict[str, float]:
        savings = {
            'setup_time_savings_min': 0.0,
            'material_savings_potential': 0.0,
            'total_groups_consolidated': 0
        }
        
        for group in duplicate_groups:
            savings['setup_time_savings_min'] += group.quantity * 15
            savings['total_groups_consolidated'] += 1
        
        return savings
    
    @staticmethod
    def check_pair(
        part1: Part,
        part2: Part,
        tolerance: float = 0.01
    ) -> Dict:
        key1 = DuplicateChecker._generate_part_key(part1, tolerance)
        key2 = DuplicateChecker._generate_part_key(part2, tolerance)
        
        is_duplicate = key1 == key2
        
        differences = []
        if part1.material_grade != part2.material_grade:
            differences.append(f"材料牌号: {part1.material_grade} vs {part2.material_grade}")
        
        if abs(part1.material_thickness - part2.material_thickness) > tolerance:
            differences.append(
                f"材料厚度: {part1.material_thickness} vs {part2.material_thickness}"
            )
        
        if len(part1.bends) != len(part2.bends):
            differences.append(
                f"折弯数量: {len(part1.bends)} vs {len(part2.bends)}"
            )
        
        if len(part1.holes) != len(part2.holes):
            differences.append(
                f"孔数量: {len(part1.holes)} vs {len(part2.holes)}"
            )
        
        similarity = 1.0 - (len(differences) * 0.1)
        similarity = max(0.0, min(1.0, similarity))
        
        return {
            'part1': part1.part_number,
            'part2': part2.part_number,
            'is_duplicate': is_duplicate,
            'similarity_score': round(similarity, 2),
            'differences': differences,
            'key1': key1,
            'key2': key2
        }
    
    @staticmethod
    def find_duplicates_of(
        target_part: Part,
        parts_list: List[Part],
        tolerance: float = 0.01
    ) -> List[Dict]:
        duplicates = []
        target_key = DuplicateChecker._generate_part_key(target_part, tolerance)
        
        for part in parts_list:
            if part.part_number == target_part.part_number:
                continue
            
            part_key = DuplicateChecker._generate_part_key(part, tolerance)
            
            if part_key == target_key:
                duplicates.append({
                    'part_number': part.part_number,
                    'part_name': part.part_name,
                    'quantity': part.quantity,
                    'is_exact_match': True
                })
        
        return duplicates
