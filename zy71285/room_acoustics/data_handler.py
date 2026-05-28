"""
批量文件处理、数据验证和冲突标记模块
"""
import os
import json
import yaml
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Any
from enum import Enum
import pandas as pd

from .mode_calculator import RoomDimensions, ListeningPoint


class DataIssueType(Enum):
    UNIT_MISMATCH = "unit_mismatch"
    INVALID_VALUE = "invalid_value"
    MISSING_FIELD = "missing_field"
    CONFLICT = "conflict"
    DUPLICATE = "duplicate"
    OUT_OF_RANGE = "out_of_range"
    FORMAT_ERROR = "format_error"


@dataclass
class DataIssue:
    issue_type: DataIssueType
    field: str
    message: str
    original_value: Any = None
    suggested_value: Any = None
    severity: str = "warning"

    def to_dict(self):
        return {
            'issue_type': self.issue_type.value,
            'field': self.field,
            'message': self.message,
            'original_value': str(self.original_value),
            'suggested_value': str(self.suggested_value) if self.suggested_value else None,
            'severity': self.severity
        }


@dataclass
class RoomConfig:
    project_id: str
    room_dimensions: RoomDimensions
    sound_speed: float = 343.0
    min_frequency: float = 20.0
    max_frequency: float = 200.0
    listening_points: List[ListeningPoint] = field(default_factory=list)
    absorption_materials: Dict[str, Dict[str, float]] = field(default_factory=dict)
    notes: str = ""
    issues: List[DataIssue] = field(default_factory=list)
    is_valid: bool = True

    def to_dict(self):
        return {
            'project_id': self.project_id,
            'room_dimensions': self.room_dimensions.to_dict(),
            'sound_speed': self.sound_speed,
            'min_frequency': self.min_frequency,
            'max_frequency': self.max_frequency,
            'listening_points': [lp.to_dict() for lp in self.listening_points],
            'absorption_materials': self.absorption_materials,
            'notes': self.notes,
            'issues': [issue.to_dict() for issue in self.issues],
            'is_valid': self.is_valid
        }


class DataValidator:
    def __init__(self):
        self.valid_units = {'m', 'meter', 'meters', 'ft', 'feet', 'cm', 'centimeters'}
        self.unit_conversions = {
            'm': 1.0,
            'meter': 1.0,
            'meters': 1.0,
            'ft': 0.3048,
            'feet': 0.3048,
            'cm': 0.01,
            'centimeters': 0.01
        }

    def validate_unit(self, unit: str, field: str) -> Tuple[Optional[float], List[DataIssue]]:
        issues = []
        if not unit:
            issues.append(DataIssue(
                issue_type=DataIssueType.MISSING_FIELD,
                field=field,
                message="缺少单位，默认使用米(m)",
                suggested_value="m",
                severity="warning"
            ))
            return 1.0, issues

        unit_lower = unit.lower()
        if unit_lower not in self.valid_units:
            issues.append(DataIssue(
                issue_type=DataIssueType.UNIT_MISMATCH,
                field=field,
                message=f"未知单位 '{unit}'，默认使用米(m)",
                original_value=unit,
                suggested_value="m",
                severity="error"
            ))
            return 1.0, issues

        return self.unit_conversions[unit_lower], issues

    def validate_numeric(
        self,
        value: Any,
        field: str,
        min_val: Optional[float] = None,
        max_val: Optional[float] = None
    ) -> Tuple[Optional[float], List[DataIssue]]:
        issues = []

        if value is None:
            issues.append(DataIssue(
                issue_type=DataIssueType.MISSING_FIELD,
                field=field,
                message=f"缺少字段 '{field}'",
                severity="error"
            ))
            return None, issues

        try:
            num_val = float(value)
        except (ValueError, TypeError):
            issues.append(DataIssue(
                issue_type=DataIssueType.INVALID_VALUE,
                field=field,
                message=f"'{value}' 不是有效的数值",
                original_value=value,
                severity="error"
            ))
            return None, issues

        if min_val is not None and num_val < min_val:
            issues.append(DataIssue(
                issue_type=DataIssueType.OUT_OF_RANGE,
                field=field,
                message=f"数值 {num_val} 小于最小值 {min_val}",
                original_value=num_val,
                severity="warning"
            ))

        if max_val is not None and num_val > max_val:
            issues.append(DataIssue(
                issue_type=DataIssueType.OUT_OF_RANGE,
                field=field,
                message=f"数值 {num_val} 大于最大值 {max_val}",
                original_value=num_val,
                severity="warning"
            ))

        return num_val, issues

    def validate_room_dimensions(
        self,
        data: Dict[str, Any]
    ) -> Tuple[Optional[RoomDimensions], List[DataIssue]]:
        issues = []
        dims_data = data.get('room_dimensions', {})

        unit = dims_data.get('unit', 'm')
        unit_factor, unit_issues = self.validate_unit(unit, 'room_dimensions.unit')
        issues.extend(unit_issues)

        length, len_issues = self.validate_numeric(
            dims_data.get('length'), 'room_dimensions.length', min_val=0.1
        )
        issues.extend(len_issues)

        width, width_issues = self.validate_numeric(
            dims_data.get('width'), 'room_dimensions.width', min_val=0.1
        )
        issues.extend(width_issues)

        height, height_issues = self.validate_numeric(
            dims_data.get('height'), 'room_dimensions.height', min_val=0.1
        )
        issues.extend(height_issues)

        if length is None or width is None or height is None:
            return None, issues

        dims = RoomDimensions(
            length=length * unit_factor,
            width=width * unit_factor,
            height=height * unit_factor,
            unit='m'
        )

        if abs(length - width) < 0.01 or abs(width - height) < 0.01 or abs(length - height) < 0.01:
            issues.append(DataIssue(
                issue_type=DataIssueType.CONFLICT,
                field='room_dimensions',
                message="房间尺寸接近正方体或有两个维度相等，可能导致模式简并风险",
                severity="warning"
            ))

        return dims, issues

    def validate_listening_points(
        self,
        data: Dict[str, Any],
        room_dims: Optional[RoomDimensions]
    ) -> Tuple[List[ListeningPoint], List[DataIssue]]:
        issues = []
        points = []
        lp_data_list = data.get('listening_points', [])

        if not lp_data_list:
            issues.append(DataIssue(
                issue_type=DataIssueType.MISSING_FIELD,
                field='listening_points',
                message="未配置监听点",
                severity="info"
            ))
            return points, issues

        unit = data.get('listening_points_unit', 'm')
        unit_factor, unit_issues = self.validate_unit(unit, 'listening_points_unit')
        issues.extend(unit_issues)

        seen_points = set()

        for i, lp_data in enumerate(lp_data_list):
            field_prefix = f'listening_points[{i}]'

            x, x_issues = self.validate_numeric(
                lp_data.get('x'), f'{field_prefix}.x', min_val=0
            )
            issues.extend(x_issues)

            y, y_issues = self.validate_numeric(
                lp_data.get('y'), f'{field_prefix}.y', min_val=0
            )
            issues.extend(y_issues)

            z, z_issues = self.validate_numeric(
                lp_data.get('z'), f'{field_prefix}.z', min_val=0
            )
            issues.extend(z_issues)

            if x is None or y is None or z is None:
                continue

            point_key = (round(x, 3), round(y, 3), round(z, 3))
            if point_key in seen_points:
                issues.append(DataIssue(
                    issue_type=DataIssueType.DUPLICATE,
                    field=field_prefix,
                    message=f"监听点 ({x}, {y}, {z}) 重复",
                    severity="warning"
                ))
                continue
            seen_points.add(point_key)

            lp = ListeningPoint(
                x=x * unit_factor,
                y=y * unit_factor,
                z=z * unit_factor,
                unit='m'
            )

            if room_dims and not lp.is_within_room(room_dims):
                issues.append(DataIssue(
                    issue_type=DataIssueType.OUT_OF_RANGE,
                    field=field_prefix,
                    message=f"监听点 ({lp.x}, {lp.y}, {lp.z}) 超出房间范围",
                    original_value=f"({x}, {y}, {z})",
                    severity="error"
                ))

            points.append(lp)

        return points, issues

    def validate_absorption_materials(
        self,
        data: Dict[str, Any]
    ) -> Tuple[Dict[str, Dict[str, float]], List[DataIssue]]:
        issues = []
        materials = data.get('absorption_materials', {})

        for material_name, material_data in materials.items():
            if isinstance(material_data, dict):
                for freq_band, coeff in material_data.items():
                    coeff_val, val_issues = self.validate_numeric(
                        coeff,
                        f'absorption_materials.{material_name}.{freq_band}',
                        min_val=0,
                        max_val=1
                    )
                    issues.extend(val_issues)
            else:
                issues.append(DataIssue(
                    issue_type=DataIssueType.FORMAT_ERROR,
                    field=f'absorption_materials.{material_name}',
                    message="吸声材料数据格式错误，应为频段-系数字典",
                    severity="warning"
                ))

        return materials, issues


class FileHandler:
    def __init__(self, validator: Optional[DataValidator] = None):
        self.validator = validator or DataValidator()

    def load_json(self, file_path: str) -> Tuple[Optional[Dict], List[DataIssue]]:
        issues = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data, issues
        except json.JSONDecodeError as e:
            issues.append(DataIssue(
                issue_type=DataIssueType.FORMAT_ERROR,
                field='__file__',
                message=f"JSON解析错误: {str(e)}",
                severity="error"
            ))
            return None, issues
        except Exception as e:
            issues.append(DataIssue(
                issue_type=DataIssueType.FORMAT_ERROR,
                field='__file__',
                message=f"文件读取错误: {str(e)}",
                severity="error"
            ))
            return None, issues

    def load_yaml(self, file_path: str) -> Tuple[Optional[Dict], List[DataIssue]]:
        issues = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            return data, issues
        except yaml.YAMLError as e:
            issues.append(DataIssue(
                issue_type=DataIssueType.FORMAT_ERROR,
                field='__file__',
                message=f"YAML解析错误: {str(e)}",
                severity="error"
            ))
            return None, issues
        except Exception as e:
            issues.append(DataIssue(
                issue_type=DataIssueType.FORMAT_ERROR,
                field='__file__',
                message=f"文件读取错误: {str(e)}",
                severity="error"
            ))
            return None, issues

    def load_csv(self, file_path: str) -> Tuple[List[Dict], List[DataIssue]]:
        issues = []
        configs = []
        try:
            df = pd.read_csv(file_path)
            for _, row in df.iterrows():
                configs.append(row.to_dict())
            return configs, issues
        except Exception as e:
            issues.append(DataIssue(
                issue_type=DataIssueType.FORMAT_ERROR,
                field='__file__',
                message=f"CSV读取错误: {str(e)}",
                severity="error"
            ))
            return [], issues

    def parse_config(self, data: Dict[str, Any]) -> RoomConfig:
        all_issues = []

        project_id = data.get('project_id', f'project_{id(data)}')

        room_dims, dim_issues = self.validator.validate_room_dimensions(data)
        all_issues.extend(dim_issues)

        sound_speed, ss_issues = self.validator.validate_numeric(
            data.get('sound_speed', 343.0), 'sound_speed', min_val=300, max_val=400
        )
        all_issues.extend(ss_issues)

        min_freq, minf_issues = self.validator.validate_numeric(
            data.get('min_frequency', 20.0), 'min_frequency', min_val=10, max_val=100
        )
        all_issues.extend(minf_issues)

        max_freq, maxf_issues = self.validator.validate_numeric(
            data.get('max_frequency', 200.0), 'max_frequency', min_val=100, max_val=500
        )
        all_issues.extend(maxf_issues)

        listening_points, lp_issues = self.validator.validate_listening_points(
            data, room_dims
        )
        all_issues.extend(lp_issues)

        absorption_materials, abs_issues = self.validator.validate_absorption_materials(data)
        all_issues.extend(abs_issues)

        is_valid = not any(
            issue.severity == 'error' for issue in all_issues
        ) and room_dims is not None

        if room_dims is None:
            room_dims = RoomDimensions(0, 0, 0)

        return RoomConfig(
            project_id=project_id,
            room_dimensions=room_dims,
            sound_speed=sound_speed or 343.0,
            min_frequency=min_freq or 20.0,
            max_frequency=max_freq or 200.0,
            listening_points=listening_points,
            absorption_materials=absorption_materials,
            notes=data.get('notes', ''),
            issues=all_issues,
            is_valid=is_valid
        )

    def load_batch_files(
        self,
        directory: str,
        file_types: List[str] = None
    ) -> Dict[str, Tuple[Optional[RoomConfig], List[DataIssue]]]:
        if file_types is None:
            file_types = ['.json', '.yaml', '.yml', '.csv']

        results = {}

        for filename in os.listdir(directory):
            filepath = os.path.join(directory, filename)
            if not os.path.isfile(filepath):
                continue

            ext = os.path.splitext(filename)[1].lower()
            if ext not in file_types:
                continue

            if ext == '.json':
                data, issues = self.load_json(filepath)
                if data is not None:
                    config = self.parse_config(data)
                    results[filename] = (config, issues)
                else:
                    results[filename] = (None, issues)
            elif ext in ['.yaml', '.yml']:
                data, issues = self.load_yaml(filepath)
                if data is not None:
                    config = self.parse_config(data)
                    results[filename] = (config, issues)
                else:
                    results[filename] = (None, issues)
            elif ext == '.csv':
                rows, issues = self.load_csv(filepath)
                for i, row in enumerate(rows):
                    config = self.parse_config(row)
                    results[f"{filename}#row{i}"] = (config, [])

        return results

    def separate_valid_dirty(
        self,
        results: Dict[str, Tuple[Optional[RoomConfig], List[DataIssue]]]
    ) -> Tuple[Dict[str, RoomConfig], Dict[str, Tuple[Optional[RoomConfig], List[DataIssue]]]]:
        valid = {}
        dirty = {}

        for filename, (config, issues) in results.items():
            if config is not None and config.is_valid:
                valid[filename] = config
            else:
                dirty[filename] = (config, issues)

        return valid, dirty
