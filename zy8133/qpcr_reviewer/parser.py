"""解析模块 - 解析输入文件"""
import re
import json
import yaml
import pandas as pd
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


class ParseError(Exception):
    """解析错误"""
    pass


@dataclass
class Well:
    """孔位数据"""
    well_id: str
    row: str
    col: int
    sample_id: Optional[str] = None
    target: Optional[str] = None
    sample_type: str = "unknown"
    ct_value: Optional[float] = None
    ct_missing: bool = False


@dataclass
class ControlConfig:
    """对照配置"""
    positive_controls: List[str] = field(default_factory=list)
    negative_controls: List[str] = field(default_factory=list)
    ntc_controls: List[str] = field(default_factory=list)
    ct_cutoff: float = 38.0
    replicate_tolerance: float = 1.0
    min_ntc_count: int = 1


def validate_well_id(well_id: str) -> bool:
    """
    验证孔位ID格式
    96孔板：A-H行，1-12列
    例如：A1, H12 有效；H13, I1 无效
    """
    pattern = r'^([A-H])(\d{1,2})$'
    match = re.match(pattern, well_id.upper())
    
    if not match:
        return False
    
    row = match.group(1)
    col = int(match.group(2))
    
    if col < 1 or col > 12:
        return False
    
    return True


def parse_well_id(well_id: str) -> tuple:
    """
    解析孔位ID，返回 (行, 列)
    例如：'A1' -> ('A', 1), 'H12' -> ('H', 12)
    """
    well_id = well_id.upper().strip()
    
    if not validate_well_id(well_id):
        raise ParseError(f"无效的孔位ID: '{well_id}'。96孔板应为A-H行，1-12列（如A1、H12）。")
    
    pattern = r'^([A-H])(\d{1,2})$'
    match = re.match(pattern, well_id)
    
    row = match.group(1)
    col = int(match.group(2))
    
    return row, col


def parse_plate_layout(csv_path: Path) -> Dict[str, Well]:
    """
    解析孔板布局CSV文件
    列格式：well_id, sample_id, target, sample_type (可选)
    """
    df = pd.read_csv(csv_path)
    
    required_columns = ['well_id', 'sample_id', 'target']
    for col in required_columns:
        if col not in df.columns:
            raise ParseError(f"plate_layout.csv 缺少必需列: {col}")
    
    wells = {}
    
    for _, row in df.iterrows():
        well_id = str(row['well_id']).strip().upper()
        
        try:
            row_letter, col_num = parse_well_id(well_id)
        except ParseError as e:
            raise ParseError(f"孔板布局文件错误: {e}")
        
        sample_type = str(row.get('sample_type', 'unknown')).strip().lower()
        
        well = Well(
            well_id=well_id,
            row=row_letter,
            col=col_num,
            sample_id=str(row['sample_id']).strip(),
            target=str(row['target']).strip(),
            sample_type=sample_type
        )
        
        if well_id in wells:
            raise ParseError(f"孔板布局中存在重复的孔位: {well_id}")
        
        wells[well_id] = well
    
    return wells


def parse_ct_results(jsonl_path: Path, wells: Dict[str, Well]) -> None:
    """
    解析Ct结果JSONL文件，更新 wells 中的 Ct 值
    每行格式：{"well_id": "A1", "ct_value": 25.3} 或 {"well_id": "A1", "ct_missing": true}
    """
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        
        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            raise ParseError(f"ct_results.jsonl 第 {line_num} 行 JSON 格式错误")
        
        well_id = data.get('well_id', '').strip().upper()
        
        if not well_id:
            raise ParseError(f"ct_results.jsonl 第 {line_num} 行缺少 well_id")
        
        if well_id not in wells:
            raise ParseError(f"ct_results.jsonl 中的孔位 {well_id} 未在 plate_layout.csv 中定义")
        
        well = wells[well_id]
        
        if 'ct_missing' in data and data['ct_missing']:
            well.ct_missing = True
            well.ct_value = None
        elif 'ct_value' in data:
            ct_value = data['ct_value']
            if ct_value is None or (isinstance(ct_value, str) and ct_value.strip().lower() in ['undetermined', 'nan', '']):
                well.ct_missing = True
                well.ct_value = None
            else:
                try:
                    well.ct_value = float(ct_value)
                    well.ct_missing = False
                except (ValueError, TypeError):
                    well.ct_missing = True
                    well.ct_value = None
        else:
            well.ct_missing = True
            well.ct_value = None


def parse_controls(yaml_path: Path) -> ControlConfig:
    """
    解析对照配置YAML文件
    """
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    if data is None:
        data = {}
    
    config = ControlConfig()
    
    config.positive_controls = [
        str(s).strip() for s in data.get('positive_controls', [])
    ]
    config.negative_controls = [
        str(s).strip() for s in data.get('negative_controls', [])
    ]
    config.ntc_controls = [
        str(s).strip() for s in data.get('ntc_controls', [])
    ]
    
    config.ct_cutoff = float(data.get('ct_cutoff', 38.0))
    config.replicate_tolerance = float(data.get('replicate_tolerance', 1.0))
    config.min_ntc_count = int(data.get('min_ntc_count', 1))
    
    return config


def validate_ntc_presence(wells: Dict[str, Well], config: ControlConfig) -> None:
    """
    验证NTC对照是否存在
    """
    ntc_count = 0
    
    for well in wells.values():
        if well.sample_id in config.ntc_controls:
            ntc_count += 1
    
    if ntc_count < config.min_ntc_count:
        ntc_list = "、".join(config.ntc_controls)
        raise ParseError(
            f"缺少必需的NTC（无模板对照）。"
            f"配置中定义的NTC为: {ntc_list}。"
            f"需要至少 {config.min_ntc_count} 个NTC孔，但只找到 {ntc_count} 个。"
        )
