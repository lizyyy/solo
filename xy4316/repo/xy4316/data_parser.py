import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import re


@dataclass
class FlowmeterData:
    pump_speed: np.ndarray
    flow_rate: np.ndarray
    timestamps: Optional[np.ndarray] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    raw_data: pd.DataFrame = None
    
    @property
    def n_points(self) -> int:
        return len(self.pump_speed)
    
    def validate(self) -> List[str]:
        errors = []
        if len(self.pump_speed) != len(self.flow_rate):
            errors.append(f"泵速数据长度({len(self.pump_speed)})与流量数据长度({len(self.flow_rate)})不一致")
        
        if np.any(self.pump_speed < 0):
            errors.append(f"泵速数据包含负值: {self.pump_speed[self.pump_speed < 0]}")
        
        if np.any(self.flow_rate < 0):
            errors.append(f"流量数据包含负值: {self.flow_rate[self.flow_rate < 0]}")
        
        if len(self.pump_speed) < 3:
            errors.append(f"数据点数量不足: {len(self.pump_speed)}，至少需要3个点")
        
        return errors


@dataclass
class ConcentrationRecord:
    stock_concentration: float
    stock_concentration_unit: str
    target_concentration: Optional[float] = None
    target_concentration_unit: str = ""
    flow_rate_unit: str = "L/h"
    solution_volume: Optional[float] = None
    solution_volume_unit: str = "L"


@dataclass
class TitrationResult:
    pump_speed: float
    measured_concentration: float
    measured_volume: Optional[float] = None
    titrant_volume: Optional[float] = None
    notes: str = ""


@dataclass
class CalibrationDataset:
    flowmeter_data: Optional[FlowmeterData] = None
    concentration_record: Optional[ConcentrationRecord] = None
    titration_results: List[TitrationResult] = field(default_factory=list)
    
    def validate(self) -> List[str]:
        errors = []
        if self.flowmeter_data is None:
            errors.append("缺少流量计数据")
        else:
            errors.extend(self.flowmeter_data.validate())
        
        if self.concentration_record is None:
            errors.append("缺少浓度记录")
        
        if len(self.titration_results) < 1:
            errors.append("缺少滴定结果数据")
        
        return errors


class DataParser:
    def __init__(self):
        self.possible_columns = {
            'pump_speed': ['泵速', 'pump_speed', 'pump rate', 'frequency', '转速', '频率', 'speed', 'rpm'],
            'flow_rate': ['流量', 'flow_rate', 'flow rate', '流量值', 'flux', 'Q'],
            'timestamp': ['时间', 'timestamp', 'time', '日期', 'datetime'],
            'concentration': ['浓度', 'concentration', '浓度值', 'conc', 'C'],
            'measured_concentration': ['实测浓度', 'measured_concentration', '滴定浓度', '分析浓度'],
            'stock_concentration': ['母液浓度', 'stock_concentration', '原液浓度'],
            'target_concentration': ['目标浓度', 'target_concentration', '设定浓度'],
            'measured_volume': ['取样体积', 'measured_volume', '体积'],
            'titrant_volume': ['滴定液体积', 'titrant_volume', '滴定体积', '标液体积'],
        }
    
    def _match_column(self, column_name: str, category: str) -> bool:
        column_lower = column_name.lower().strip()
        for alias in self.possible_columns.get(category, []):
            if alias.lower() in column_lower or column_lower in alias.lower():
                return True
        return False
    
    def _find_column(self, df: pd.DataFrame, category: str) -> Optional[str]:
        for col in df.columns:
            if self._match_column(col, category):
                return col
        return None
    
    def parse_flowmeter_csv(self, filepath: str, encoding: str = 'utf-8') -> FlowmeterData:
        try:
            df = pd.read_csv(filepath, encoding=encoding)
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding='gbk')
        
        pump_speed_col = self._find_column(df, 'pump_speed')
        flow_rate_col = self._find_column(df, 'flow_rate')
        timestamp_col = self._find_column(df, 'timestamp')
        
        if pump_speed_col is None:
            pump_speed_col = df.columns[0] if len(df.columns) > 0 else None
        
        if flow_rate_col is None:
            flow_rate_col = df.columns[1] if len(df.columns) > 1 else None
        
        if pump_speed_col is None or flow_rate_col is None:
            raise ValueError(f"无法识别数据列，请确保CSV包含泵速和流量数据。列名: {list(df.columns)}")
        
        pump_speed = pd.to_numeric(df[pump_speed_col], errors='coerce').values
        flow_rate = pd.to_numeric(df[flow_rate_col], errors='coerce').values
        
        valid_mask = ~np.isnan(pump_speed) & ~np.isnan(flow_rate)
        pump_speed = pump_speed[valid_mask]
        flow_rate = flow_rate[valid_mask]
        
        timestamps = None
        if timestamp_col is not None:
            try:
                timestamps = pd.to_datetime(df[timestamp_col], errors='coerce').values
                timestamps = timestamps[valid_mask]
            except:
                pass
        
        return FlowmeterData(
            pump_speed=pump_speed,
            flow_rate=flow_rate,
            timestamps=timestamps,
            raw_data=df,
            metadata={
                'source_file': filepath,
                'total_rows': len(df),
                'valid_rows': len(pump_speed),
                'columns': list(df.columns)
            }
        )
    
    def parse_concentration_record(self, filepath: str, encoding: str = 'utf-8') -> ConcentrationRecord:
        ext = filepath.lower()
        if ext.endswith('.csv'):
            return self._parse_concentration_csv(filepath, encoding)
        elif ext.endswith(('.txt', '.text')):
            return self._parse_concentration_text(filepath, encoding)
        else:
            raise ValueError(f"不支持的文件格式: {filepath}")
    
    def _parse_concentration_csv(self, filepath: str, encoding: str) -> ConcentrationRecord:
        try:
            df = pd.read_csv(filepath, encoding=encoding)
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding='gbk')
        
        if len(df.columns) >= 2:
            records = dict(zip(df.iloc[:, 0].astype(str), df.iloc[:, 1].astype(str)))
        else:
            records = {}
        
        return self._extract_concentration_from_dict(records)
    
    def _parse_concentration_text(self, filepath: str, encoding: str) -> ConcentrationRecord:
        try:
            with open(filepath, 'r', encoding=encoding) as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(filepath, 'r', encoding='gbk') as f:
                content = f.read()
        
        records = {}
        for line in content.split('\n'):
            line = line.strip()
            if not line:
                continue
            if ':' in line:
                key, value = line.split(':', 1)
                records[key.strip()] = value.strip()
            elif '=' in line:
                key, value = line.split('=', 1)
                records[key.strip()] = value.strip()
        
        return self._extract_concentration_from_dict(records)
    
    def _extract_concentration_from_dict(self, records: Dict[str, str]) -> ConcentrationRecord:
        def extract_value(text: str) -> tuple:
            if not text:
                return None, ""
            match = re.match(r'([\d.]+)\s*([a-zA-Z%/]+)?', str(text).strip())
            if match:
                value = float(match.group(1))
                unit = match.group(2) or ""
                return value, unit
            return None, ""
        
        stock_concentration = None
        stock_concentration_unit = ""
        target_concentration = None
        target_concentration_unit = ""
        flow_rate_unit = "L/h"
        solution_volume = None
        solution_volume_unit = "L"
        
        for key, value in records.items():
            key_lower = key.lower()
            if self._match_column(key, 'stock_concentration') or '母液' in key_lower or 'stock' in key_lower:
                stock_concentration, stock_concentration_unit = extract_value(value)
            elif self._match_column(key, 'target_concentration') or '目标' in key_lower or 'target' in key_lower:
                target_concentration, target_concentration_unit = extract_value(value)
            elif '流量' in key_lower or 'flow' in key_lower or '单位' in key_lower:
                if any(u in value.lower() for u in ['l/h', 'ml/min', 'm3/h']):
                    flow_rate_unit = value.strip()
            elif '溶液体积' in key_lower or '水样体积' in key_lower or 'volume' in key_lower:
                solution_volume, solution_volume_unit = extract_value(value)
        
        if stock_concentration is None:
            raise ValueError("无法解析母液浓度，请检查数据格式")
        
        return ConcentrationRecord(
            stock_concentration=stock_concentration,
            stock_concentration_unit=stock_concentration_unit,
            target_concentration=target_concentration,
            target_concentration_unit=target_concentration_unit,
            flow_rate_unit=flow_rate_unit,
            solution_volume=solution_volume,
            solution_volume_unit=solution_volume_unit
        )
    
    def parse_titration_results(self, filepath: str, encoding: str = 'utf-8') -> List[TitrationResult]:
        try:
            df = pd.read_csv(filepath, encoding=encoding)
        except UnicodeDecodeError:
            df = pd.read_csv(filepath, encoding='gbk')
        
        pump_speed_col = self._find_column(df, 'pump_speed')
        measured_conc_col = self._find_column(df, 'measured_concentration')
        measured_vol_col = self._find_column(df, 'measured_volume')
        titrant_vol_col = self._find_column(df, 'titrant_volume')
        
        results = []
        for idx, row in df.iterrows():
            pump_speed = None
            if pump_speed_col is not None:
                val = row[pump_speed_col]
                if pd.notna(val):
                    pump_speed = float(val)
            
            measured_concentration = None
            if measured_conc_col is not None:
                val = row[measured_conc_col]
                if pd.notna(val):
                    measured_concentration = float(val)
            
            measured_volume = None
            if measured_vol_col is not None:
                val = row[measured_vol_col]
                if pd.notna(val):
                    measured_volume = float(val)
            
            titrant_volume = None
            if titrant_vol_col is not None:
                val = row[titrant_vol_col]
                if pd.notna(val):
                    titrant_volume = float(val)
            
            if pump_speed is not None and measured_concentration is not None:
                results.append(TitrationResult(
                    pump_speed=pump_speed,
                    measured_concentration=measured_concentration,
                    measured_volume=measured_volume,
                    titrant_volume=titrant_volume,
                    notes=f"行 {idx+1}"
                ))
        
        if not results:
            raise ValueError(f"无法解析滴定结果，列名: {list(df.columns)}")
        
        return results
