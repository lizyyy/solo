import pandas as pd
import numpy as np
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json

from models import TimingLog, TimingMeasurement


class TimingLogImporter:
    """校表仪日志导入器"""
    
    SUPPORTED_FORMATS = ['csv', 'json', 'excel']
    
    STANDARD_POSITIONS = ['12上', '3上', '6上', '9上', '面上', '面下']
    
    def __init__(self):
        self.logs: List[TimingLog] = []
        self.errors: List[str] = []
    
    def import_from_file(self, file_path: str, format_type: Optional[str] = None,
                         work_order_id: Optional[str] = None,
                         position_column: str = 'position',
                         rate_column: str = 'rate',
                         amplitude_column: str = 'amplitude',
                         beat_error_column: str = 'beat_error',
                         temperature_column: Optional[str] = None,
                         test_date: Optional[datetime] = None,
                         instrument_model: Optional[str] = None) -> List[TimingLog]:
        """
        从文件导入校表仪日志
        
        Args:
            file_path: 文件路径
            format_type: 文件格式，默认自动检测
            work_order_id: 关联工单ID
            position_column: 方位列名
            rate_column: 日差列名
            amplitude_column: 摆幅列名
            beat_error_column: 偏振列名
            temperature_column: 温度列名（可选）
            test_date: 测试日期
            instrument_model: 校表仪型号
        
        Returns:
            校表仪日志列表
        """
        self.logs = []
        self.errors = []
        
        if format_type is None:
            format_type = self._detect_format(file_path)
        
        if format_type not in self.SUPPORTED_FORMATS:
            raise ValueError(f"不支持的文件格式: {format_type}")
        
        try:
            df = self._read_file(file_path, format_type)
            self._parse_dataframe(
                df, work_order_id, position_column, rate_column,
                amplitude_column, beat_error_column, temperature_column,
                test_date, instrument_model
            )
        except Exception as e:
            self.errors.append(f"导入文件失败: {str(e)}")
            raise
        
        return self.logs
    
    def _detect_format(self, file_path: str) -> str:
        """检测文件格式"""
        if file_path.endswith('.csv'):
            return 'csv'
        elif file_path.endswith('.json'):
            return 'json'
        elif file_path.endswith(('.xlsx', '.xls')):
            return 'excel'
        else:
            raise ValueError(f"无法检测文件格式: {file_path}")
    
    def _read_file(self, file_path: str, format_type: str) -> pd.DataFrame:
        """读取文件为DataFrame"""
        if format_type == 'csv':
            return pd.read_csv(file_path)
        elif format_type == 'json':
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, list):
                return pd.DataFrame(data)
            elif isinstance(data, dict):
                if 'measurements' in data:
                    return pd.DataFrame(data['measurements'])
                elif 'logs' in data:
                    if isinstance(data['logs'], list) and len(data['logs']) > 0:
                        if 'measurements' in data['logs'][0]:
                            all_measurements = []
                            for log in data['logs']:
                                for m in log.get('measurements', []):
                                    m_copy = dict(m)
                                    m_copy['_log_index'] = data['logs'].index(log)
                                    all_measurements.append(m_copy)
                            return pd.DataFrame(all_measurements)
                    return pd.DataFrame(data['logs'])
            raise ValueError("JSON格式不正确")
        elif format_type == 'excel':
            return pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的格式: {format_type}")
    
    def _parse_dataframe(self, df: pd.DataFrame,
                         work_order_id: Optional[str],
                         position_column: str,
                         rate_column: str,
                         amplitude_column: str,
                         beat_error_column: str,
                         temperature_column: Optional[str],
                         test_date: Optional[datetime],
                         instrument_model: Optional[str]):
        """解析DataFrame为校表仪日志"""
        
        required_columns = [position_column, rate_column, amplitude_column, beat_error_column]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必要列 '{col}' 不存在于数据中")
        
        log_index_column = '_log_index'
        if log_index_column in df.columns:
            grouped = df.groupby(log_index_column)
            for log_idx, group in grouped:
                measurements = self._parse_measurements_from_group(
                    group, position_column, rate_column, amplitude_column,
                    beat_error_column, temperature_column
                )
                if measurements:
                    log = TimingLog(
                        id=str(uuid.uuid4()),
                        work_order_id=work_order_id or "",
                        test_date=test_date or datetime.now(),
                        instrument_model=instrument_model,
                        measurements=measurements
                    )
                    self.logs.append(log)
        else:
            measurements = self._parse_measurements_from_group(
                df, position_column, rate_column, amplitude_column,
                beat_error_column, temperature_column
            )
            if measurements:
                log = TimingLog(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id or "",
                    test_date=test_date or datetime.now(),
                    instrument_model=instrument_model,
                    measurements=measurements
                )
                self.logs.append(log)
    
    def _parse_measurements_from_group(self,
                                        group: pd.DataFrame,
                                        position_column: str,
                                        rate_column: str,
                                        amplitude_column: str,
                                        beat_error_column: str,
                                        temperature_column: Optional[str]) -> List[TimingMeasurement]:
        """从DataFrame组解析测量记录"""
        measurements: List[TimingMeasurement] = []
        
        for idx, row in group.iterrows():
            try:
                position = str(row[position_column]) if not pd.isna(row[position_column]) else ""
                rate = float(row[rate_column]) if not pd.isna(row[rate_column]) else 0.0
                amplitude = float(row[amplitude_column]) if not pd.isna(row[amplitude_column]) else 0.0
                beat_error = float(row[beat_error_column]) if not pd.isna(row[beat_error_column]) else 0.0
                
                temperature = None
                if temperature_column and temperature_column in row.index:
                    if not pd.isna(row[temperature_column]):
                        temperature = float(row[temperature_column])
                
                measurement_time = None
                if 'measurement_time' in row.index and not pd.isna(row['measurement_time']):
                    if isinstance(row['measurement_time'], datetime):
                        measurement_time = row['measurement_time']
                    else:
                        try:
                            measurement_time = pd.to_datetime(row['measurement_time']).to_pydatetime()
                        except:
                            pass
                
                if position:
                    measurement = TimingMeasurement(
                        id=str(uuid.uuid4()),
                        position=position,
                        rate=rate,
                        amplitude=amplitude,
                        beat_error=beat_error,
                        temperature=temperature,
                        measurement_time=measurement_time
                    )
                    measurements.append(measurement)
                    
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 行测量记录失败: {str(e)}")
        
        return measurements
    
    def import_from_list(self, data: List[Dict[str, Any]],
                         work_order_id: Optional[str] = None,
                         test_date: Optional[datetime] = None,
                         instrument_model: Optional[str] = None) -> List[TimingLog]:
        """从字典列表导入校表仪日志"""
        self.logs = []
        self.errors = []
        
        measurements: List[TimingMeasurement] = []
        
        for idx, item in enumerate(data):
            try:
                position = str(item.get('position', ''))
                rate = float(item.get('rate', 0.0))
                amplitude = float(item.get('amplitude', 0.0))
                beat_error = float(item.get('beat_error', 0.0))
                
                temperature = item.get('temperature')
                if temperature is not None:
                    temperature = float(temperature)
                
                measurement_time = item.get('measurement_time')
                if measurement_time and isinstance(measurement_time, str):
                    try:
                        measurement_time = datetime.fromisoformat(measurement_time)
                    except:
                        measurement_time = None
                
                if position:
                    measurement = TimingMeasurement(
                        id=str(uuid.uuid4()),
                        position=position,
                        rate=rate,
                        amplitude=amplitude,
                        beat_error=beat_error,
                        temperature=temperature,
                        measurement_time=measurement_time
                    )
                    measurements.append(measurement)
                    
            except Exception as e:
                self.errors.append(f"解析第 {idx+1} 项测量记录失败: {str(e)}")
        
        if measurements:
            log = TimingLog(
                id=str(uuid.uuid4()),
                work_order_id=work_order_id or "",
                test_date=test_date or datetime.now(),
                instrument_model=instrument_model,
                measurements=measurements
            )
            self.logs.append(log)
        
        return self.logs
    
    def get_errors(self) -> List[str]:
        """获取导入错误"""
        return self.errors
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取校表仪日志统计信息"""
        if not self.logs:
            return {
                'log_count': 0,
                'measurement_count': 0,
                'positions': [],
                'avg_rate': None,
                'avg_amplitude': None,
                'avg_beat_error': None
            }
        
        all_measurements: List[TimingMeasurement] = []
        for log in self.logs:
            all_measurements.extend(log.measurements)
        
        if not all_measurements:
            return {
                'log_count': len(self.logs),
                'measurement_count': 0,
                'positions': [],
                'avg_rate': None,
                'avg_amplitude': None,
                'avg_beat_error': None
            }
        
        positions = list(set(m.position for m in all_measurements))
        rates = [m.rate for m in all_measurements]
        amplitudes = [m.amplitude for m in all_measurements]
        beat_errors = [m.beat_error for m in all_measurements]
        
        return {
            'log_count': len(self.logs),
            'measurement_count': len(all_measurements),
            'positions': sorted(positions),
            'avg_rate': sum(rates) / len(rates),
            'min_rate': min(rates),
            'max_rate': max(rates),
            'avg_amplitude': sum(amplitudes) / len(amplitudes),
            'min_amplitude': min(amplitudes),
            'max_amplitude': max(amplitudes),
            'avg_beat_error': sum(beat_errors) / len(beat_errors)
        }
