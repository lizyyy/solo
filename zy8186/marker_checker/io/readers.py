import csv
import json
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from ..core.units import UnitConverter
from ..core.rotation import Piece, FabricRule, GrainDirection, RotationConstraint
from ..core.defects import DefectZone, DefectSeverity


@dataclass
class InputData:
    pieces: List[Piece]
    fabric_rules: Dict[str, FabricRule]
    size_ratio: Dict[str, int]
    defects: List[DefectZone]
    issues: List[Dict[str, Any]]


class DataReader:
    def __init__(self, default_unit: str = 'mm'):
        self.default_unit = default_unit
        self.converter = UnitConverter()
        self.issues = []
    
    def read_pieces_csv(self, filepath: str) -> List[Piece]:
        pieces = []
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    piece = self._parse_piece(row)
                    pieces.append(piece)
                except Exception as e:
                    self.issues.append({
                        'type': 'parsing_error',
                        'severity': 'error',
                        'file': 'pieces.csv',
                        'row': row.get('id', 'unknown'),
                        'message': str(e)
                    })
        return pieces
    
    def _parse_piece(self, row: Dict[str, str]) -> Piece:
        piece_id = row.get('id', row.get('piece_id', ''))
        name = row.get('name', row.get('piece_name', piece_id))
        
        width = float(row.get('width', row.get('width_mm', 0)))
        height = float(row.get('height', row.get('height_mm', 0)))
        
        unit = row.get('unit', self.default_unit).lower()
        width_mm = self.converter.to_mm(width, unit)
        height_mm = self.converter.to_mm(height, unit)
        
        grain_str = row.get('grain_direction', row.get('grain', 'none')).lower()
        grain_direction = self._parse_grain_direction(grain_str)
        
        fabric_name = row.get('fabric', row.get('fabric_name', 'default'))
        
        is_mirror = row.get('is_mirror', row.get('mirror', 'false')).lower() == 'true'
        quantity = int(row.get('quantity', row.get('qty', '1')))
        
        return Piece(
            id=piece_id,
            name=name,
            width_mm=width_mm,
            height_mm=height_mm,
            grain_direction=grain_direction,
            fabric_name=fabric_name,
            is_mirror=is_mirror,
            quantity=quantity
        )
    
    def read_fabric_rules_yaml(self, filepath: str) -> Dict[str, FabricRule]:
        try:
            import yaml
        except ImportError:
            raise ImportError("请安装PyYAML: pip install pyyaml")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        rules = {}
        fabric_list = data.get('fabrics', data) if isinstance(data, dict) else data
        
        if isinstance(fabric_list, dict):
            fabric_list = [fabric_list]
        
        for fabric_data in fabric_list:
            if not isinstance(fabric_data, dict):
                continue
            
            try:
                rule = self._parse_fabric_rule(fabric_data)
                rules[rule.name] = rule
            except Exception as e:
                self.issues.append({
                    'type': 'parsing_error',
                    'severity': 'error',
                    'file': 'fabric_rules.yaml',
                    'row': fabric_data.get('name', 'unknown'),
                    'message': str(e)
                })
        
        return rules
    
    def _parse_fabric_rule(self, data: Dict[str, Any]) -> FabricRule:
        name = data.get('name', data.get('fabric_name', 'default'))
        
        width = float(data.get('width', data.get('width_mm', 1500)))
        unit = data.get('unit', self.default_unit).lower()
        width_mm = self.converter.to_mm(width, unit)
        
        grain_str = data.get('grain_direction', data.get('grain', 'straight')).lower()
        grain_direction = self._parse_grain_direction(grain_str)
        
        rotation_str = data.get('rotation_constraint', data.get('rotation', 'free')).lower()
        rotation_constraint = self._parse_rotation_constraint(rotation_str)
        
        allowed_pieces = data.get('allowed_pieces', data.get('pieces', []))
        if isinstance(allowed_pieces, str):
            allowed_pieces = [p.strip() for p in allowed_pieces.split(',')]
        
        shrinkage_warp = float(data.get('shrinkage_warp', data.get('shrinkage', 0)))
        shrinkage_weft = float(data.get('shrinkage_weft', shrinkage_warp))
        
        return FabricRule(
            name=name,
            width_mm=width_mm,
            grain_direction=grain_direction,
            rotation_constraint=rotation_constraint,
            allowed_pieces=allowed_pieces,
            shrinkage_warp=shrinkage_warp,
            shrinkage_weft=shrinkage_weft
        )
    
    def read_size_ratio_json(self, filepath: str) -> Dict[str, int]:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, dict):
            return {str(k): int(v) for k, v in data.items()}
        elif isinstance(data, list):
            result = {}
            for item in data:
                if isinstance(item, dict) and 'size' in item and 'quantity' in item:
                    result[str(item['size'])] = int(item['quantity'])
            return result
        
        return {}
    
    def read_defects_csv(self, filepath: str) -> List[DefectZone]:
        defects = []
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        defect = self._parse_defect(row)
                        defects.append(defect)
                    except Exception as e:
                        self.issues.append({
                            'type': 'parsing_error',
                            'severity': 'warning',
                            'file': 'defects.csv',
                            'row': row.get('id', 'unknown'),
                            'message': str(e)
                        })
        except FileNotFoundError:
            self.issues.append({
                'type': 'file_not_found',
                'severity': 'info',
                'file': 'defects.csv',
                'row': '',
                'message': '瑕疵区文件未找到，将不进行瑕疵避让'
            })
        
        return defects
    
    def _parse_defect(self, row: Dict[str, str]) -> DefectZone:
        defect_id = row.get('id', row.get('defect_id', ''))
        
        x = float(row.get('x', row.get('x_mm', 0)))
        y = float(row.get('y', row.get('y_mm', 0)))
        width = float(row.get('width', row.get('width_mm', 10)))
        height = float(row.get('height', row.get('height_mm', 10)))
        
        unit = row.get('unit', self.default_unit).lower()
        x_mm = self.converter.to_mm(x, unit)
        y_mm = self.converter.to_mm(y, unit)
        width_mm = self.converter.to_mm(width, unit)
        height_mm = self.converter.to_mm(height, unit)
        
        severity_str = row.get('severity', 'medium').lower()
        severity = self._parse_severity(severity_str)
        
        description = row.get('description', row.get('desc', ''))
        
        return DefectZone(
            id=defect_id,
            x_mm=x_mm,
            y_mm=y_mm,
            width_mm=width_mm,
            height_mm=height_mm,
            severity=severity,
            description=description
        )
    
    def _parse_grain_direction(self, s: str) -> GrainDirection:
        mapping = {
            'straight': GrainDirection.STRAIGHT,
            '经向': GrainDirection.STRAIGHT,
            '直丝': GrainDirection.STRAIGHT,
            'cross': GrainDirection.CROSS,
            '纬向': GrainDirection.CROSS,
            '横丝': GrainDirection.CROSS,
            'bias': GrainDirection.BIAS,
            '斜向': GrainDirection.BIAS,
            '斜丝': GrainDirection.BIAS,
            'none': GrainDirection.NONE,
            '无': GrainDirection.NONE,
        }
        return mapping.get(s.lower(), GrainDirection.NONE)
    
    def _parse_rotation_constraint(self, s: str) -> RotationConstraint:
        mapping = {
            'free': RotationConstraint.FREE,
            '自由': RotationConstraint.FREE,
            'ninety': RotationConstraint.NINETY,
            '90': RotationConstraint.NINETY,
            '九十': RotationConstraint.NINETY,
            'eighteen': RotationConstraint.EIGHTEEN,
            '180': RotationConstraint.EIGHTEEN,
            '一百八十': RotationConstraint.EIGHTEEN,
            'none': RotationConstraint.NONE,
            '禁止': RotationConstraint.NONE,
            'fixed': RotationConstraint.NONE,
        }
        return mapping.get(s.lower(), RotationConstraint.FREE)
    
    def _parse_severity(self, s: str) -> DefectSeverity:
        mapping = {
            'minor': DefectSeverity.MINOR,
            '轻微': DefectSeverity.MINOR,
            'medium': DefectSeverity.MEDIUM,
            '中等': DefectSeverity.MEDIUM,
            'major': DefectSeverity.MAJOR,
            '严重': DefectSeverity.MAJOR,
            'critical': DefectSeverity.CRITICAL,
            '致命': DefectSeverity.CRITICAL,
        }
        return mapping.get(s.lower(), DefectSeverity.MEDIUM)
    
    def read_all(self, pieces_file: str, fabric_file: str, 
                 size_ratio_file: str, defects_file: str = None) -> InputData:
        pieces = self.read_pieces_csv(pieces_file)
        fabric_rules = self.read_fabric_rules_yaml(fabric_file)
        size_ratio = self.read_size_ratio_json(size_ratio_file)
        defects = self.read_defects_csv(defects_file) if defects_file else []
        
        return InputData(
            pieces=pieces,
            fabric_rules=fabric_rules,
            size_ratio=size_ratio,
            defects=defects,
            issues=self.issues.copy()
        )
