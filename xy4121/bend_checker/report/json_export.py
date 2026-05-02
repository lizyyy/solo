import json
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime

from bend_checker.models.part import Part, Bend, Hole
from bend_checker.geometry.unfold import UnfoldResult
from bend_checker.geometry.sequence import SequenceResult
from bend_checker.rules.interference import InterferenceResult
from bend_checker.rules.tonnage import TonnageResult
from bend_checker.rules.hole_distance import HoleDistanceResult
from bend_checker.rules.duplicate import DuplicateResult


class JSONExporter:
    
    @staticmethod
    def export_full_report(
        output_path: str,
        parts: List[Part],
        unfold_results: Dict[str, UnfoldResult],
        sequence_results: Dict[str, SequenceResult],
        interference_results: Dict[str, InterferenceResult],
        tonnage_results: Dict[str, TonnageResult],
        hole_results: Dict[str, HoleDistanceResult],
        duplicate_result: Optional[DuplicateResult] = None,
        workshop_info: Optional[Dict] = None
    ) -> bool:
        try:
            report = {
                'report_metadata': {
                    'generated_at': datetime.now().isoformat(),
                    'version': '1.0.0'
                },
                'workshop_info': workshop_info or {},
                'summary': {
                    'total_parts': len(parts),
                    'parts_with_issues': 0,
                    'parts_ok': 0
                },
                'parts': [],
                'duplicates': {}
            }
            
            parts_with_issues = 0
            
            for part in parts:
                part_data = {
                    'part_number': part.part_number,
                    'part_name': part.part_name,
                    'material_grade': part.material_grade,
                    'material_thickness': part.material_thickness,
                    'quantity': part.quantity,
                    'overall_length': part.overall_length,
                    'overall_width': part.overall_width,
                    'bends': [JSONExporter._bend_to_dict(b) for b in part.bends],
                    'holes': [JSONExporter._hole_to_dict(h) for h in part.holes],
                    'unfold_result': None,
                    'sequence_result': None,
                    'tonnage_result': None,
                    'interference_result': None,
                    'hole_distance_result': None,
                    'has_issues': False
                }
                
                unfold_result = unfold_results.get(part.part_number)
                if unfold_result:
                    part_data['unfold_result'] = {
                        'unfolded_length': unfold_result.unfolded_length,
                        'unfolded_width': unfold_result.unfolded_width,
                        'total_bend_deduction': unfold_result.total_bend_deduction,
                        'k_factors_used': unfold_result.k_factors_used,
                        'bend_details': unfold_result.bend_details,
                        'warnings': unfold_result.warnings
                    }
                
                sequence_result = sequence_results.get(part.part_number)
                if sequence_result:
                    part_data['sequence_result'] = {
                        'recommended_sequence': sequence_result.recommended_sequence,
                        'alternative_sequences': sequence_result.alternative_sequences,
                        'total_steps': sequence_result.total_steps,
                        'risks': sequence_result.risks
                    }
                
                tonnage_result = tonnage_results.get(part.part_number)
                if tonnage_result:
                    part_data['tonnage_result'] = {
                        'total_tonnage': tonnage_result.total_tonnage,
                        'per_bend_tonnage': tonnage_result.per_bend_tonnage,
                        'suitable_machines': tonnage_result.suitable_machines,
                        'warnings': tonnage_result.warnings,
                        'safety_factor_used': tonnage_result.safety_factor_used
                    }
                
                interference_result = interference_results.get(part.part_number)
                if interference_result:
                    part_data['interference_result'] = {
                        'has_issues': interference_result.has_issues,
                        'issues': [JSONExporter._interference_issue_to_dict(i) for i in interference_result.issues],
                        'warnings': interference_result.warnings,
                        'safe_operations': interference_result.safe_operations,
                        'risky_operations': interference_result.risky_operations
                    }
                    if interference_result.has_issues:
                        part_data['has_issues'] = True
                
                hole_result = hole_results.get(part.part_number)
                if hole_result:
                    part_data['hole_distance_result'] = {
                        'has_risks': hole_result.has_risks,
                        'issues': [JSONExporter._hole_issue_to_dict(i) for i in hole_result.issues],
                        'safe_holes': hole_result.safe_holes,
                        'at_risk_holes': hole_result.at_risk_holes,
                        'recommendations': hole_result.recommendations
                    }
                    if hole_result.has_risks:
                        part_data['has_issues'] = True
                
                if part_data['has_issues']:
                    parts_with_issues += 1
                
                report['parts'].append(part_data)
            
            report['summary']['parts_with_issues'] = parts_with_issues
            report['summary']['parts_ok'] = len(parts) - parts_with_issues
            
            if duplicate_result:
                report['duplicates'] = {
                    'total_parts': duplicate_result.total_parts,
                    'unique_groups': duplicate_result.unique_groups,
                    'duplicates_found': duplicate_result.duplicates_found,
                    'groups': [JSONExporter._duplicate_group_to_dict(g) for g in duplicate_result.duplicate_groups],
                    'potential_savings': duplicate_result.potential_savings
                }
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False, default=str)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def _bend_to_dict(bend: Bend) -> Dict:
        return {
            'id': bend.id,
            'bend_angle': bend.bend_angle,
            'bend_radius': bend.bend_radius,
            'flange_length': bend.flange_length,
            'inside_length': bend.inside_length,
            'direction': bend.direction.value,
            'k_factor_override': bend.k_factor_override,
            'die_v_width': bend.die_v_width,
            'notes': bend.notes
        }
    
    @staticmethod
    def _hole_to_dict(hole: Hole) -> Dict:
        return {
            'id': hole.id,
            'hole_type': hole.hole_type.value,
            'diameter': hole.diameter,
            'width': hole.width,
            'height': hole.height,
            'x_position': hole.x_position,
            'y_position': hole.y_position,
            'distance_to_nearest_bend': hole.distance_to_nearest_bend,
            'notes': hole.notes
        }
    
    @staticmethod
    def _interference_issue_to_dict(issue) -> Dict:
        return {
            'issue_type': issue.issue_type.value,
            'severity': issue.severity,
            'description': issue.description,
            'affected_bends': issue.affected_bends,
            'suggested_fix': issue.suggested_fix
        }
    
    @staticmethod
    def _hole_issue_to_dict(issue) -> Dict:
        return {
            'hole_id': issue.hole_id,
            'risk_level': issue.risk_level.value,
            'description': issue.description,
            'distance_to_bend': issue.distance_to_bend,
            'minimum_required': issue.minimum_required,
            'bend_id': issue.bend_id,
            'suggestion': issue.suggestion
        }
    
    @staticmethod
    def _duplicate_group_to_dict(group) -> Dict:
        return {
            'group_id': group.group_id,
            'representative_part': group.representative_part,
            'duplicate_parts': group.duplicate_parts,
            'quantity': group.quantity,
            'total_quantity': group.total_quantity,
            'similarity_score': group.similarity_score,
            'key_differences': group.key_differences
        }
    
    @staticmethod
    def export_parts_data(output_path: str, parts: List[Part]) -> bool:
        try:
            parts_data = []
            for part in parts:
                parts_data.append({
                    'part_number': part.part_number,
                    'part_name': part.part_name,
                    'material_grade': part.material_grade,
                    'material_thickness': part.material_thickness,
                    'quantity': part.quantity,
                    'overall_length': part.overall_length,
                    'overall_width': part.overall_width,
                    'bends': [JSONExporter._bend_to_dict(b) for b in part.bends],
                    'holes': [JSONExporter._hole_to_dict(h) for h in part.holes],
                    'notes': part.notes
                })
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump({'parts': parts_data}, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def export_workshop_config(output_path: str, config_manager) -> bool:
        try:
            config = config_manager.load_config()
            materials = config_manager.load_material_library()
            machines = config_manager.load_machine_library()
            dies = config_manager.load_die_set()
            
            config_data = {
                'workshop_config': config.to_dict(),
                'materials': [
                    {
                        'name': m.name,
                        'grade': m.grade,
                        'thickness': m.thickness,
                        'tensile_strength': m.tensile_strength,
                        'k_factor': m.k_factor,
                        'min_bend_radius': m.min_bend_radius,
                        'description': m.description
                    }
                    for m in materials.materials.values()
                ],
                'machines': [
                    {
                        'id': m.id,
                        'name': m.name,
                        'machine_type': m.machine_type,
                        'max_tonnage': m.max_tonnage,
                        'bed_length': m.bed_length,
                        'stroke': m.stroke,
                        'daylight': m.daylight,
                        'min_thickness': m.min_thickness,
                        'max_thickness': m.max_thickness,
                        'compatible_dies': m.compatible_dies,
                        'description': m.description
                    }
                    for m in machines.machines.values()
                ],
                'dies': [
                    {
                        'id': d.id,
                        'die_type': d.die_type,
                        'v_width': d.v_width,
                        'v_angle': d.v_angle,
                        'punch_radius': d.punch_radius,
                        'die_radius': d.die_radius,
                        'min_thickness': d.min_thickness,
                        'max_thickness': d.max_thickness,
                        'min_bend_radius': d.min_bend_radius,
                        'max_bend_radius': d.max_bend_radius,
                        'min_bend_length': d.min_bend_length,
                        'description': d.description
                    }
                    for d in dies.dies.values()
                ]
            }
            
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, indent=2, ensure_ascii=False)
            
            return True
        except Exception:
            return False
