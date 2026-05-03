from typing import List, Dict, Any, Tuple
from .core.units import UnitConverter
from .core.rotation import Piece, FabricRule, GrainDirection, RotationConstraint, RotationManager
from .core.defects import DefectZone, DefectAvoider
from .core.packing import PackingAlgorithm, WasteCalculator, LayoutResult
from .io.readers import DataReader, InputData
from .io.writers import OutputWriter


class MarkerChecker:
    def __init__(self, input_unit: str = 'mm', output_unit: str = 'mm'):
        self.input_unit = input_unit
        self.output_unit = output_unit
        self.reader = DataReader(default_unit=input_unit)
        self.writer = OutputWriter(output_unit=output_unit)
        self.rotation_manager = RotationManager()
    
    def run(self, pieces_file: str, fabric_file: str, 
            size_ratio_file: str, defects_file: str = None,
            output_dir: str = '.') -> Dict[str, Any]:
        
        input_data = self.reader.read_all(
            pieces_file=pieces_file,
            fabric_file=fabric_file,
            size_ratio_file=size_ratio_file,
            defects_file=defects_file
        )
        
        all_issues = input_data.issues.copy()
        
        expanded_pieces = self._expand_pieces_by_size_ratio(
            input_data.pieces, 
            input_data.size_ratio
        )
        
        grouped_pieces = self._group_pieces_by_fabric(expanded_pieces)
        
        validation_issues = self._validate_fabric_assignments(
            grouped_pieces, 
            input_data.fabric_rules
        )
        all_issues.extend(validation_issues)
        
        grain_issues = self._check_grain_conflicts(
            grouped_pieces, 
            input_data.fabric_rules
        )
        all_issues.extend(grain_issues)
        
        layouts = []
        defect_avoider = DefectAvoider(input_data.defects) if input_data.defects else None
        
        for fabric_name, pieces in grouped_pieces.items():
            if fabric_name not in input_data.fabric_rules:
                all_issues.append({
                    'type': 'fabric_not_found',
                    'severity': 'error',
                    'file': 'fabric_rules.yaml',
                    'row': fabric_name,
                    'message': f"面料 {fabric_name} 在规则中未定义"
                })
                continue
            
            fabric_rule = input_data.fabric_rules[fabric_name]
            
            packer = PackingAlgorithm(defect_avoider=defect_avoider)
            layout = packer.bottom_left_pack(pieces, fabric_rule)
            
            if layout.warnings:
                for warning in layout.warnings:
                    all_issues.append({
                        'type': 'layout_warning',
                        'severity': 'warning',
                        'file': pieces_file,
                        'row': '',
                        'message': warning
                    })
            
            layouts.append(layout)
        
        waste_stats = WasteCalculator.calculate_batch_waste(layouts)
        
        self.writer.write_issues_csv(all_issues, f"{output_dir}/issues.csv")
        
        input_summary = {
            'total_pieces': len(expanded_pieces),
            'total_fabrics': len(input_data.fabric_rules),
            'size_ratios': input_data.size_ratio,
            'defect_count': len(input_data.defects)
        }
        
        self.writer.write_marker_report(
            layouts=layouts,
            waste_stats=waste_stats,
            input_data=input_summary,
            issues=all_issues,
            filepath=f"{output_dir}/marker_report.md"
        )
        
        self.writer.write_layout_html(
            layouts=layouts,
            defects=input_data.defects,
            filepath=f"{output_dir}/layout.html"
        )
        
        return {
            'layouts': layouts,
            'waste_stats': waste_stats,
            'issues': all_issues,
            'input_summary': input_summary
        }
    
    def _expand_pieces_by_size_ratio(self, pieces: List[Piece], 
                                        size_ratio: Dict[str, int]) -> List[Piece]:
        expanded = []
        
        for piece in pieces:
            if size_ratio:
                for size, qty in size_ratio.items():
                    for _ in range(qty):
                        new_piece = Piece(
                            id=f"{piece.id}_{size}",
                            name=f"{piece.name} ({size})",
                            width_mm=piece.width_mm,
                            height_mm=piece.height_mm,
                            grain_direction=piece.grain_direction,
                            fabric_name=piece.fabric_name,
                            is_mirror=piece.is_mirror,
                            quantity=1
                        )
                        expanded.append(new_piece)
            else:
                for _ in range(piece.quantity):
                    expanded.append(piece)
        
        return expanded
    
    def _group_pieces_by_fabric(self, pieces: List[Piece]) -> Dict[str, List[Piece]]:
        grouped = {}
        for piece in pieces:
            if piece.fabric_name not in grouped:
                grouped[piece.fabric_name] = []
            grouped[piece.fabric_name].append(piece)
        return grouped
    
    def _validate_fabric_assignments(self, grouped_pieces: Dict[str, List[Piece]],
                                       fabric_rules: Dict[str, FabricRule]) -> List[Dict[str, Any]]:
        issues = []
        
        for fabric_name, pieces in grouped_pieces.items():
            if fabric_name not in fabric_rules:
                continue
            
            rule = fabric_rules[fabric_name]
            
            if rule.allowed_pieces:
                for piece in pieces:
                    piece_name = piece.name.split(' ')[0] if ' ' in piece.name else piece.name
                    if piece_name not in rule.allowed_pieces and piece.id not in rule.allowed_pieces:
                        issues.append({
                            'type': 'fabric_mismatch',
                            'severity': 'error',
                            'file': 'pieces.csv',
                            'row': piece.id,
                            'message': f"裁片 {piece.name} 不允许使用面料 {fabric_name}，该面料仅允许: {', '.join(rule.allowed_pieces)}"
                        })
        
        return issues
    
    def _check_grain_conflicts(self, grouped_pieces: Dict[str, List[Piece]],
                                 fabric_rules: Dict[str, FabricRule]) -> List[Dict[str, Any]]:
        issues = []
        
        for fabric_name, pieces in grouped_pieces.items():
            if fabric_name not in fabric_rules:
                continue
            
            rule = fabric_rules[fabric_name]
            
            for piece in pieces:
                valid_rotations = self.rotation_manager.get_valid_rotations(piece, rule)
                
                if not valid_rotations:
                    conflict_msg = piece.check_grain_conflict(rule, 0)
                    if conflict_msg:
                        issues.append({
                            'type': 'grain_conflict',
                            'severity': 'error',
                            'file': 'pieces.csv',
                            'row': piece.id,
                            'message': f"纹向冲突: 裁片 {piece.name} (纹向: {piece.grain_direction.value}) 与面料 {fabric_name} (纹向: {rule.grain_direction.value}) 不匹配，且无法通过旋转解决"
                        })
                    else:
                        issues.append({
                            'type': 'rotation_constraint',
                            'severity': 'error',
                            'file': 'pieces.csv',
                            'row': piece.id,
                            'message': f"裁片 {piece.name} 受旋转约束限制，无法在面料 {fabric_name} 上排布"
                        })
                
                elif len(valid_rotations) == 1 and valid_rotations[0] != 0:
                    issues.append({
                        'type': 'rotation_warning',
                        'severity': 'warning',
                        'file': 'pieces.csv',
                        'row': piece.id,
                        'message': f"裁片 {piece.name} 需要旋转 {valid_rotations[0]}° 才能符合面料 {fabric_name} 的纹向要求"
                    })
        
        return issues
