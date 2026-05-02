import csv
from typing import List, Dict, Optional
from pathlib import Path
from datetime import datetime

from bend_checker.models.part import Part
from bend_checker.geometry.unfold import UnfoldResult
from bend_checker.rules.tonnage import TonnageResult


class CSVExporter:
    
    @staticmethod
    def export_parts_summary(
        output_path: str,
        parts: List[Part],
        unfold_results: Dict[str, UnfoldResult],
        tonnage_results: Dict[str, TonnageResult]
    ) -> bool:
        try:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            rows = []
            
            headers = [
                'part_number',
                'part_name',
                'material_grade',
                'material_thickness',
                'quantity',
                'overall_length',
                'overall_width',
                'number_of_bends',
                'number_of_holes',
                'unfolded_length',
                'unfolded_width',
                'total_bend_deduction',
                'total_tonnage',
                'suitable_machines',
                'export_time'
            ]
            
            export_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            for part in parts:
                unfold_result = unfold_results.get(part.part_number)
                tonnage_result = tonnage_results.get(part.part_number)
                
                row = {
                    'part_number': part.part_number,
                    'part_name': part.part_name,
                    'material_grade': part.material_grade,
                    'material_thickness': part.material_thickness,
                    'quantity': part.quantity,
                    'overall_length': part.overall_length,
                    'overall_width': part.overall_width,
                    'number_of_bends': len(part.bends),
                    'number_of_holes': len(part.holes),
                    'unfolded_length': unfold_result.unfolded_length if unfold_result else None,
                    'unfolded_width': unfold_result.unfolded_width if unfold_result else None,
                    'total_bend_deduction': unfold_result.total_bend_deduction if unfold_result else None,
                    'total_tonnage': tonnage_result.total_tonnage if tonnage_result else None,
                    'suitable_machines': ', '.join(tonnage_result.suitable_machines) if tonnage_result else '',
                    'export_time': export_time
                }
                rows.append(row)
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def export_bend_details(
        output_path: str,
        parts: List[Part],
        unfold_results: Dict[str, UnfoldResult],
        tonnage_results: Dict[str, TonnageResult]
    ) -> bool:
        try:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            rows = []
            
            headers = [
                'part_number',
                'bend_id',
                'bend_angle',
                'bend_radius',
                'flange_length',
                'inside_length',
                'direction',
                'k_factor_used',
                'bend_deduction',
                'tonnage',
                'export_time'
            ]
            
            export_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            for part in parts:
                unfold_result = unfold_results.get(part.part_number)
                tonnage_result = tonnage_results.get(part.part_number)
                
                for bend in part.bends:
                    k_factor = None
                    bend_deduction = None
                    
                    if unfold_result:
                        k_factor = unfold_result.k_factors_used.get(bend.id)
                        for detail in unfold_result.bend_details:
                            if detail.get('bend_id') == bend.id:
                                bend_deduction = detail.get('bend_deduction')
                                break
                    
                    tonnage = None
                    if tonnage_result:
                        tonnage = tonnage_result.per_bend_tonnage.get(bend.id)
                    
                    row = {
                        'part_number': part.part_number,
                        'bend_id': bend.id,
                        'bend_angle': bend.bend_angle,
                        'bend_radius': bend.bend_radius,
                        'flange_length': bend.flange_length,
                        'inside_length': bend.inside_length,
                        'direction': bend.direction.value,
                        'k_factor_used': k_factor,
                        'bend_deduction': bend_deduction,
                        'tonnage': tonnage,
                        'export_time': export_time
                    }
                    rows.append(row)
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def export_issues(
        output_path: str,
        parts: List[Part],
        interference_results: Dict,
        hole_results: Dict,
        tonnage_results: Dict
    ) -> bool:
        try:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            rows = []
            
            headers = [
                'part_number',
                'issue_type',
                'severity',
                'affected_elements',
                'description',
                'suggestion',
                'export_time'
            ]
            
            export_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            for part in parts:
                interference_result = interference_results.get(part.part_number)
                if interference_result and interference_result.issues:
                    for issue in interference_result.issues:
                        rows.append({
                            'part_number': part.part_number,
                            'issue_type': issue.issue_type.value,
                            'severity': issue.severity,
                            'affected_elements': ', '.join(issue.affected_bends),
                            'description': issue.description,
                            'suggestion': issue.suggested_fix,
                            'export_time': export_time
                        })
                
                hole_result = hole_results.get(part.part_number)
                if hole_result and hole_result.issues:
                    for issue in hole_result.issues:
                        rows.append({
                            'part_number': part.part_number,
                            'issue_type': 'hole_distance',
                            'severity': issue.risk_level.value,
                            'affected_elements': f"孔 {issue.hole_id}, 折弯 {issue.bend_id}",
                            'description': issue.description,
                            'suggestion': issue.suggestion,
                            'export_time': export_time
                        })
                
                tonnage_result = tonnage_results.get(part.part_number)
                if tonnage_result and tonnage_result.warnings:
                    for warning in tonnage_result.warnings:
                        rows.append({
                            'part_number': part.part_number,
                            'issue_type': 'tonnage',
                            'severity': 'warning',
                            'affected_elements': '',
                            'description': warning,
                            'suggestion': '',
                            'export_time': export_time
                        })
            
            if not rows:
                rows.append({
                    'part_number': '',
                    'issue_type': 'none',
                    'severity': 'none',
                    'affected_elements': '',
                    'description': '未发现任何问题',
                    'suggestion': '',
                    'export_time': export_time
                })
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        except Exception:
            return False
    
    @staticmethod
    def export_duplicates(
        output_path: str,
        duplicate_result
    ) -> bool:
        try:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            rows = []
            headers = [
                'group_id',
                'representative_part',
                'duplicate_part',
                'total_quantity',
                'similarity_score',
                'differences',
                'export_time'
            ]
            
            export_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            if not duplicate_result or not duplicate_result.duplicate_groups:
                rows.append({
                    'group_id': '',
                    'representative_part': '',
                    'duplicate_part': '',
                    'total_quantity': 0,
                    'similarity_score': 1.0,
                    'differences': '未发现重复零件',
                    'export_time': export_time
                })
            else:
                for group in duplicate_result.duplicate_groups:
                    for dup_part in group.duplicate_parts:
                        rows.append({
                            'group_id': group.group_id,
                            'representative_part': group.representative_part,
                            'duplicate_part': dup_part,
                            'total_quantity': group.total_quantity,
                            'similarity_score': group.similarity_score,
                            'differences': ', '.join(group.key_differences) if group.key_differences else '',
                            'export_time': export_time
                        })
            
            with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)
            
            return True
        except Exception:
            return False
