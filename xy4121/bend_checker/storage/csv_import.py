import csv
from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from pathlib import Path

from bend_checker.models.part import Part, Bend, Hole, BendDirection, HoleType


@dataclass
class ImportResult:
    success: bool
    parts: List[Part]
    errors: List[str]
    warnings: List[str]
    total_parts: int
    valid_parts: int


class CSVImporter:
    
    REQUIRED_COLUMNS = [
        'part_number',
        'material_grade',
        'material_thickness'
    ]
    
    BEND_COLUMNS = [
        'bend_id',
        'bend_angle',
        'bend_radius',
        'flange_length',
        'inside_length',
        'direction'
    ]
    
    HOLE_COLUMNS = [
        'hole_id',
        'hole_type',
        'diameter',
        'width',
        'height',
        'distance_to_bend'
    ]
    
    @staticmethod
    def import_parts(file_path: str, multiple_bends_per_row: bool = False) -> ImportResult:
        errors = []
        warnings = []
        parts_dict: Dict[str, Part] = {}
        
        try:
            file_path = Path(file_path)
            if not file_path.exists():
                return ImportResult(
                    success=False,
                    parts=[],
                    errors=[f"文件不存在: {file_path}"],
                    warnings=[],
                    total_parts=0,
                    valid_parts=0
                )
            
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                headers = reader.fieldnames or []
                missing_cols = [col for col in CSVImporter.REQUIRED_COLUMNS if col not in headers]
                if missing_cols:
                    errors.append(f"缺少必要列: {', '.join(missing_cols)}")
                    return ImportResult(
                        success=False,
                        parts=[],
                        errors=errors,
                        warnings=[],
                        total_parts=0,
                        valid_parts=0
                    )
                
                for row_num, row in enumerate(reader, 2):
                    try:
                        part = CSVImporter._parse_row(row, row_num, warnings)
                        if part:
                            if part.part_number in parts_dict:
                                existing = parts_dict[part.part_number]
                                CSVImporter._merge_part_data(existing, part, warnings)
                            else:
                                parts_dict[part.part_number] = part
                    except Exception as e:
                        errors.append(f"第 {row_num} 行解析错误: {str(e)}")
        
        except Exception as e:
            errors.append(f"文件读取错误: {str(e)}")
            return ImportResult(
                success=False,
                parts=[],
                errors=errors,
                warnings=[],
                total_parts=0,
                valid_parts=0
            )
        
        parts = list(parts_dict.values())
        
        return ImportResult(
            success=len(errors) == 0,
            parts=parts,
            errors=errors,
            warnings=warnings,
            total_parts=len(parts),
            valid_parts=len(parts)
        )
    
    @staticmethod
    def _parse_row(row: Dict, row_num: int, warnings: List[str]) -> Optional[Part]:
        part_number = row.get('part_number', '').strip()
        if not part_number:
            warnings.append(f"第 {row_num} 行: part_number 为空，跳过")
            return None
        
        material_grade = row.get('material_grade', '').strip() or 'SPCC'
        material_thickness = CSVImporter._safe_float(row.get('material_thickness', '0'), 1.0)
        quantity = CSVImporter._safe_int(row.get('quantity', '1'), 1)
        part_name = row.get('part_name', part_number)
        
        part = Part(
            part_number=part_number,
            part_name=part_name,
            material_grade=material_grade,
            material_thickness=material_thickness,
            quantity=quantity
        )
        
        part.overall_length = CSVImporter._safe_float(row.get('overall_length', '0'), 0.0)
        part.overall_width = CSVImporter._safe_float(row.get('overall_width', '0'), 0.0)
        part.notes = row.get('notes')
        
        bend = CSVImporter._parse_bend_from_row(row, row_num, warnings)
        if bend:
            part.add_bend(bend)
        
        hole = CSVImporter._parse_hole_from_row(row, row_num, warnings)
        if hole:
            part.add_hole(hole)
        
        multi_bend = CSVImporter._parse_multiple_bends(row, row_num, warnings)
        for b in multi_bend:
            part.add_bend(b)
        
        multi_hole = CSVImporter._parse_multiple_holes(row, row_num, warnings)
        for h in multi_hole:
            part.add_hole(h)
        
        return part
    
    @staticmethod
    def _parse_bend_from_row(row: Dict, row_num: int, warnings: List[str]) -> Optional[Bend]:
        bend_id = row.get('bend_id', '').strip()
        if not bend_id:
            return None
        
        try:
            bend_angle = CSVImporter._safe_float(row.get('bend_angle', '90'), 90.0)
            bend_radius = CSVImporter._safe_float(row.get('bend_radius', '1'), 1.0)
            flange_length = CSVImporter._safe_float(row.get('flange_length', '0'), 0.0)
            inside_length = CSVImporter._safe_float(row.get('inside_length', '0'), 0.0)
            
            direction_str = row.get('direction', 'up').lower()
            direction = BendDirection.UP if direction_str == 'up' else BendDirection.DOWN
            
            k_factor_override = CSVImporter._safe_float(row.get('k_factor_override', ''), None)
            die_v_width = CSVImporter._safe_float(row.get('die_v_width', ''), None)
            
            return Bend(
                id=bend_id,
                bend_angle=bend_angle,
                bend_radius=bend_radius,
                flange_length=flange_length,
                inside_length=inside_length,
                direction=direction,
                k_factor_override=k_factor_override,
                die_v_width=die_v_width,
                notes=row.get('bend_notes')
            )
        except Exception as e:
            warnings.append(f"第 {row_num} 行折弯 {bend_id} 解析警告: {str(e)}")
            return None
    
    @staticmethod
    def _parse_hole_from_row(row: Dict, row_num: int, warnings: List[str]) -> Optional[Hole]:
        hole_id = row.get('hole_id', '').strip()
        if not hole_id:
            return None
        
        try:
            hole_type_str = row.get('hole_type', 'circular').lower()
            if hole_type_str == 'rectangular':
                hole_type = HoleType.RECTANGULAR
            elif hole_type_str == 'slotted':
                hole_type = HoleType.SLOTTED
            else:
                hole_type = HoleType.CIRCULAR
            
            diameter = CSVImporter._safe_float(row.get('diameter', ''), None)
            width = CSVImporter._safe_float(row.get('width', ''), None)
            height = CSVImporter._safe_float(row.get('height', ''), None)
            x_position = CSVImporter._safe_float(row.get('x_position', '0'), 0.0)
            y_position = CSVImporter._safe_float(row.get('y_position', '0'), 0.0)
            distance_to_bend = CSVImporter._safe_float(row.get('distance_to_bend', ''), None)
            
            return Hole(
                id=hole_id,
                hole_type=hole_type,
                diameter=diameter,
                width=width,
                height=height,
                x_position=x_position,
                y_position=y_position,
                distance_to_nearest_bend=distance_to_bend,
                notes=row.get('hole_notes')
            )
        except Exception as e:
            warnings.append(f"第 {row_num} 行孔 {hole_id} 解析警告: {str(e)}")
            return None
    
    @staticmethod
    def _parse_multiple_bends(row: Dict, row_num: int, warnings: List[str]) -> List[Bend]:
        bends = []
        
        for i in range(2, 11):
            bend_id = row.get(f'bend_id_{i}', '').strip()
            if not bend_id:
                continue
            
            try:
                bend_angle = CSVImporter._safe_float(row.get(f'bend_angle_{i}', '90'), 90.0)
                bend_radius = CSVImporter._safe_float(row.get(f'bend_radius_{i}', '1'), 1.0)
                flange_length = CSVImporter._safe_float(row.get(f'flange_length_{i}', '0'), 0.0)
                inside_length = CSVImporter._safe_float(row.get(f'inside_length_{i}', '0'), 0.0)
                
                direction_str = row.get(f'direction_{i}', 'up').lower()
                direction = BendDirection.UP if direction_str == 'up' else BendDirection.DOWN
                
                bends.append(Bend(
                    id=bend_id,
                    bend_angle=bend_angle,
                    bend_radius=bend_radius,
                    flange_length=flange_length,
                    inside_length=inside_length,
                    direction=direction
                ))
            except Exception as e:
                warnings.append(f"第 {row_num} 行折弯 {bend_id} 解析警告: {str(e)}")
        
        return bends
    
    @staticmethod
    def _parse_multiple_holes(row: Dict, row_num: int, warnings: List[str]) -> List[Hole]:
        holes = []
        
        for i in range(2, 11):
            hole_id = row.get(f'hole_id_{i}', '').strip()
            if not hole_id:
                continue
            
            try:
                hole_type_str = row.get(f'hole_type_{i}', 'circular').lower()
                if hole_type_str == 'rectangular':
                    hole_type = HoleType.RECTANGULAR
                elif hole_type_str == 'slotted':
                    hole_type = HoleType.SLOTTED
                else:
                    hole_type = HoleType.CIRCULAR
                
                diameter = CSVImporter._safe_float(row.get(f'diameter_{i}', ''), None)
                width = CSVImporter._safe_float(row.get(f'width_{i}', ''), None)
                height = CSVImporter._safe_float(row.get(f'height_{i}', ''), None)
                distance_to_bend = CSVImporter._safe_float(row.get(f'distance_to_bend_{i}', ''), None)
                
                holes.append(Hole(
                    id=hole_id,
                    hole_type=hole_type,
                    diameter=diameter,
                    width=width,
                    height=height,
                    distance_to_nearest_bend=distance_to_bend
                ))
            except Exception as e:
                warnings.append(f"第 {row_num} 行孔 {hole_id} 解析警告: {str(e)}")
        
        return holes
    
    @staticmethod
    def _merge_part_data(existing: Part, new: Part, warnings: List[str]) -> None:
        for bend in new.bends:
            if not existing.get_bend_by_id(bend.id):
                existing.add_bend(bend)
            else:
                warnings.append(f"零件 {existing.part_number}: 折弯 {bend.id} 已存在，跳过重复")
        
        existing_hole_ids = {h.id for h in existing.holes}
        for hole in new.holes:
            if hole.id not in existing_hole_ids:
                existing.add_hole(hole)
            else:
                warnings.append(f"零件 {existing.part_number}: 孔 {hole.id} 已存在，跳过重复")
        
        existing.quantity += new.quantity
    
    @staticmethod
    def _safe_float(value: str, default: Optional[float]) -> Optional[float]:
        if value is None or value.strip() == '':
            return default
        try:
            return float(value.strip())
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def _safe_int(value: str, default: int) -> int:
        if value is None or value.strip() == '':
            return default
        try:
            return int(value.strip())
        except (ValueError, TypeError):
            return default
    
    @staticmethod
    def generate_template(file_path: str, include_multi_row: bool = True) -> bool:
        try:
            headers = [
                'part_number', 'part_name', 'material_grade', 'material_thickness',
                'quantity', 'overall_length', 'overall_width', 'notes',
                'bend_id', 'bend_angle', 'bend_radius', 'flange_length',
                'inside_length', 'direction', 'k_factor_override', 'die_v_width', 'bend_notes',
                'hole_id', 'hole_type', 'diameter', 'width', 'height',
                'x_position', 'y_position', 'distance_to_bend', 'hole_notes'
            ]
            
            if include_multi_row:
                for i in range(2, 6):
                    headers.extend([
                        f'bend_id_{i}', f'bend_angle_{i}', f'bend_radius_{i}',
                        f'flange_length_{i}', f'inside_length_{i}', f'direction_{i}'
                    ])
                for i in range(2, 6):
                    headers.extend([
                        f'hole_id_{i}', f'hole_type_{i}', f'diameter_{i}',
                        f'width_{i}', f'height_{i}', f'distance_to_bend_{i}'
                    ])
            
            sample_rows = [
                {
                    'part_number': 'P-001',
                    'part_name': '左侧板',
                    'material_grade': 'SPCC',
                    'material_thickness': '1.5',
                    'quantity': '10',
                    'overall_length': '150',
                    'overall_width': '80',
                    'notes': '示例零件',
                    'bend_id': 'B1',
                    'bend_angle': '90',
                    'bend_radius': '1.5',
                    'flange_length': '25',
                    'inside_length': '100',
                    'direction': 'up',
                    'hole_id': 'H1',
                    'hole_type': 'circular',
                    'diameter': '8',
                    'distance_to_bend': '15',
                }
            ]
            
            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                for row in sample_rows:
                    writer.writerow(row)
            
            return True
        except Exception:
            return False
