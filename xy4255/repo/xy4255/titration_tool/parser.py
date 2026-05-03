"""CSV数据解析和校验模块"""

import csv
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any

from .models import (
    TitrationPoint,
    TitrationCurve,
    SampleType,
    ImportResult,
)


VOLUME_COLUMNS = ['体积(mL)', '体积', 'Volume (mL)', 'Volume', 'V (mL)', 'V']
PH_COLUMNS = ['pH', 'ph', 'PH', 'Ph']
TEMPERATURE_COLUMNS = ['温度(°C)', '温度', 'Temperature (°C)', 'Temperature', 'T (°C)', 'T']
SAMPLE_ID_COLUMNS = ['样品编号', 'Sample ID', 'SampleID', '样品ID']


def normalize_column_name(name: str) -> str:
    """标准化列名"""
    return name.strip().lower()


def try_parse_float(value: str) -> Optional[float]:
    """尝试解析浮点数"""
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


@dataclass
class CSVHeaderInfo:
    """CSV文件头部信息"""
    sample_id: Optional[str] = None
    temperature: Optional[float] = None
    has_header_row: bool = False
    column_indices: Dict[str, int] = field(default_factory=dict)


def detect_csv_format(file_path: str) -> CSVHeaderInfo:
    """检测CSV文件格式并提取头部信息"""
    info = CSVHeaderInfo()
    
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
    
    if not lines:
        return info
    
    for i, line in enumerate(lines[:5]):
        line = line.strip()
        if not line:
            continue
        
        parts = line.split(',')
        if len(parts) >= 2:
            key = normalize_column_name(parts[0].strip().strip('"'))
            value = parts[1].strip().strip('"') if len(parts) > 1 else ""
            
            for col in SAMPLE_ID_COLUMNS:
                if key == normalize_column_name(col):
                    info.sample_id = value
                    break
            
            for col in TEMPERATURE_COLUMNS:
                if key == normalize_column_name(col):
                    temp = try_parse_float(value)
                    if temp is not None:
                        info.temperature = temp
                    break
    
    for i, line in enumerate(lines[:10]):
        line = line.strip()
        if not line:
            continue
        
        parts = [p.strip().strip('"') for p in line.split(',')]
        
        has_volume = any(normalize_column_name(c) in [normalize_column_name(v) for v in VOLUME_COLUMNS] for c in parts)
        has_ph = any(normalize_column_name(c) in [normalize_column_name(p) for p in PH_COLUMNS] for c in parts)
        
        if has_volume and has_ph:
            info.has_header_row = True
            for idx, col in enumerate(parts):
                col_norm = normalize_column_name(col)
                
                for v_col in VOLUME_COLUMNS:
                    if col_norm == normalize_column_name(v_col):
                        info.column_indices['volume'] = idx
                        break
                
                for p_col in PH_COLUMNS:
                    if col_norm == normalize_column_name(p_col):
                        info.column_indices['ph'] = idx
                        break
                
                for t_col in TEMPERATURE_COLUMNS:
                    if col_norm == normalize_column_name(t_col):
                        info.column_indices['temperature'] = idx
                        break
                
                for s_col in SAMPLE_ID_COLUMNS:
                    if col_norm == normalize_column_name(s_col):
                        info.column_indices['sample_id'] = idx
                        break
            break
    
    return info


def validate_point(volume: Optional[float], ph: Optional[float], 
                   temperature: Optional[float] = None,
                   min_volume: float = 0.0, max_volume: float = 1000.0,
                   min_ph: float = 0.0, max_ph: float = 14.0) -> List[str]:
    """验证单个滴定点的数据有效性"""
    errors = []
    
    if volume is None:
        errors.append("体积数据缺失")
    else:
        if volume < min_volume:
            errors.append(f"体积值过小: {volume} mL (最小值: {min_volume} mL)")
        if volume > max_volume:
            errors.append(f"体积值过大: {volume} mL (最大值: {max_volume} mL)")
    
    if ph is None:
        errors.append("pH数据缺失")
    else:
        if ph < min_ph:
            errors.append(f"pH值过小: {ph} (最小值: {min_ph})")
        if ph > max_ph:
            errors.append(f"pH值过大: {ph} (最大值: {max_ph})")
    
    if temperature is not None:
        if temperature < -10.0 or temperature > 100.0:
            errors.append(f"温度值异常: {temperature}°C")
    
    return errors


def parse_titration_csv(file_path: str) -> ImportResult:
    """解析滴定CSV文件"""
    result = ImportResult(
        file_path=file_path,
        sample_id=os.path.splitext(os.path.basename(file_path))[0],
        success=False,
        errors=[],
        warnings=[],
    )
    
    if not os.path.exists(file_path):
        result.errors.append(f"文件不存在: {file_path}")
        return result
    
    try:
        header_info = detect_csv_format(file_path)
        
        if header_info.sample_id:
            result.sample_id = header_info.sample_id
        
        points: List[TitrationPoint] = []
        errors: List[str] = []
        warnings: List[str] = []
        
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        data_start_row = 0
        if header_info.has_header_row:
            for i, row in enumerate(rows[:10]):
                if len(row) >= 2:
                    has_volume = any(normalize_column_name(col.strip()) in 
                                   [normalize_column_name(v) for v in VOLUME_COLUMNS] 
                                   for col in row)
                    has_ph = any(normalize_column_name(col.strip()) in 
                               [normalize_column_name(p) for p in PH_COLUMNS] 
                               for col in row)
                    if has_volume and has_ph:
                        data_start_row = i + 1
                        break
        
        point_index = 0
        for row_idx in range(data_start_row, len(rows)):
            row = rows[row_idx]
            if not row or all(cell.strip() == '' for cell in row):
                continue
            
            volume: Optional[float] = None
            ph: Optional[float] = None
            temperature: Optional[float] = header_info.temperature
            row_sample_id: Optional[str] = None
            
            if header_info.column_indices:
                if 'volume' in header_info.column_indices:
                    idx = header_info.column_indices['volume']
                    if idx < len(row):
                        volume = try_parse_float(row[idx])
                
                if 'ph' in header_info.column_indices:
                    idx = header_info.column_indices['ph']
                    if idx < len(row):
                        ph = try_parse_float(row[idx])
                
                if 'temperature' in header_info.column_indices:
                    idx = header_info.column_indices['temperature']
                    if idx < len(row):
                        temp_val = try_parse_float(row[idx])
                        if temp_val is not None:
                            temperature = temp_val
                
                if 'sample_id' in header_info.column_indices:
                    idx = header_info.column_indices['sample_id']
                    if idx < len(row):
                        row_sample_id = row[idx].strip()
            else:
                if len(row) >= 2:
                    volume = try_parse_float(row[0])
                    ph = try_parse_float(row[1])
                if len(row) >= 3:
                    temp_val = try_parse_float(row[2])
                    if temp_val is not None:
                        temperature = temp_val
            
            point_errors = validate_point(volume, ph, temperature)
            
            if point_errors:
                for err in point_errors:
                    errors.append(f"第 {row_idx + 1} 行: {err}")
                continue
            
            if volume is None or ph is None:
                continue
            
            point = TitrationPoint(
                volume=volume,
                ph=ph,
                temperature=temperature,
                index=point_index,
            )
            points.append(point)
            point_index += 1
            
            if row_sample_id and result.sample_id != row_sample_id:
                if result.sample_id == os.path.splitext(os.path.basename(file_path))[0]:
                    result.sample_id = row_sample_id
        
        if len(points) < 3:
            errors.append(f"有效数据点过少: {len(points)} 个 (至少需要 3 个)")
        
        if len(points) >= 2:
            volumes = [p.volume for p in points]
            if volumes != sorted(volumes):
                warnings.append("体积数据不是按递增顺序排列")
            
            for i in range(len(points) - 1):
                if abs(points[i].ph - points[i + 1].ph) > 4.0:
                    warnings.append(f"第 {i} 和 {i+1} 点之间pH变化过大 (>4.0)，可能存在异常")
        
        result.errors = errors
        result.warnings = warnings
        result.point_count = len(points)
        
        if not errors and len(points) >= 3:
            result.success = True
            
            sample_type = SampleType.UNKNOWN
            sample_lower = result.sample_id.lower()
            if 'blank' in sample_lower or '空白' in sample_lower:
                sample_type = SampleType.BLANK
            elif 'std' in sample_lower or 'standard' in sample_lower or '标准' in sample_lower:
                sample_type = SampleType.STANDARD
            elif 'qc' in sample_lower or 'quality' in sample_lower or '质控' in sample_lower:
                sample_type = SampleType.QUALITY_CONTROL
            
            curve = TitrationCurve(
                sample_id=result.sample_id,
                sample_type=sample_type,
                points=points,
                temperature=header_info.temperature,
                source_file=file_path,
            )
            result.curve = curve
        
        return result
        
    except Exception as e:
        result.errors.append(f"解析CSV文件时发生错误: {str(e)}")
        return result


def validate_multiple_curves(curves: List[TitrationCurve]) -> Dict[str, Any]:
    """校验多条曲线的一致性"""
    validation = {
        'valid': True,
        'errors': [],
        'warnings': [],
        'statistics': {},
    }
    
    if not curves:
        validation['valid'] = False
        validation['errors'].append("没有有效的滴定曲线")
        return validation
    
    point_counts = [len(c.points) for c in curves]
    validation['statistics']['total_curves'] = len(curves)
    validation['statistics']['min_points'] = min(point_counts)
    validation['statistics']['max_points'] = max(point_counts)
    validation['statistics']['avg_points'] = sum(point_counts) / len(point_counts)
    
    if max(point_counts) - min(point_counts) > 10:
        validation['warnings'].append(
            f"曲线数据点数量差异较大 (最少{min(point_counts)}, 最多{max(point_counts)})"
        )
    
    sample_ids = [c.sample_id for c in curves]
    if len(sample_ids) != len(set(sample_ids)):
        validation['errors'].append(f"存在重复的样品编号: {sample_ids}")
        validation['valid'] = False
    
    temperatures = [c.temperature for c in curves if c.temperature is not None]
    if temperatures:
        temp_range = max(temperatures) - min(temperatures)
        if temp_range > 5.0:
            validation['warnings'].append(
                f"实验温度差异较大 ({min(temperatures):.1f}°C - {max(temperatures):.1f}°C)"
            )
    
    return validation
