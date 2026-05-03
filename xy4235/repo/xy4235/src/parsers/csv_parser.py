import os
import csv
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import pandas as pd

from .base_parser import BaseParser, ParseResult
from models.vital_signs import VitalSigns, VitalSignsRecord


class CSVParser(BaseParser):
    """
    监护仪CSV数据解析器
    支持多种常见的监护仪CSV格式
    """
    
    # 支持的时间格式
    TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%H:%M:%S",
        "%H:%M",
    ]
    
    # 列名映射 (目标列名 -> 可能的源列名列表)
    COLUMN_MAPPING = {
        'timestamp': ['时间', 'Time', '时间戳', 'Timestamp', 'Date/Time', 'DateTime'],
        'heart_rate': ['心率', 'Heart Rate', 'HR', '脉率', 'Pulse', 'PR'],
        'systolic_bp': ['收缩压', 'Systolic', 'SBP', '高压'],
        'diastolic_bp': ['舒张压', 'Diastolic', 'DBP', '低压'],
        'mean_bp': ['平均压', 'Mean BP', 'MAP', '平均动脉压'],
        'spo2': ['血氧', 'SpO2', 'SPO2', '血氧饱和度', 'SaO2'],
        'temperature': ['体温', 'Temperature', 'Temp', 'T'],
        'respiratory_rate': ['呼吸', 'Resp Rate', 'RR', '呼吸频率'],
        'etco2': ['EtCO2', 'ETCO2', '呼气末CO2', 'PetCO2'],
    }
    
    def __init__(self):
        super().__init__()
        self.column_mapping_actual = {}  # 实际的列映射
    
    def can_parse(self, file_path: str) -> bool:
        """
        检查是否能解析该文件
        """
        if not file_path.lower().endswith('.csv'):
            return False
        
        if not os.path.exists(file_path):
            return False
        
        # 检查文件是否可读
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                # 尝试读取前几行
                for i, line in enumerate(f):
                    if i > 5:
                        break
                return True
        except:
            pass
        
        # 尝试用其他编码
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                for i, line in enumerate(f):
                    if i > 5:
                        break
                return True
        except:
            return False
    
    def parse(self, file_path: str) -> ParseResult:
        """
        解析CSV文件
        """
        self.result = ParseResult()
        
        if not self.can_parse(file_path):
            self.result.add_error(f"无法解析文件: {file_path}")
            return self.result
        
        try:
            # 尝试多种编码读取
            df = self._read_csv_with_encoding(file_path)
            
            if df is None or df.empty:
                self.result.add_error("CSV文件为空或无法读取")
                return self.result
            
            # 自动检测列映射
            self._detect_columns(df)
            
            # 创建VitalSigns对象
            case_id = os.path.splitext(os.path.basename(file_path))[0]
            vital_signs = VitalSigns(case_id=case_id)
            
            # 解析每一行
            for idx, row in df.iterrows():
                try:
                    record = self._parse_row(row, idx)
                    if record:
                        vital_signs.add_record(record)
                except Exception as e:
                    self.result.add_warning(f"解析第 {idx+1} 行时出错: {str(e)}")
            
            if not vital_signs.records:
                self.result.add_error("未能解析任何有效的生命体征记录")
                return self.result
            
            self.result.data = vital_signs
            self.result.add_warning(f"成功解析 {len(vital_signs.records)} 条记录")
            
        except Exception as e:
            self.result.add_error(f"解析CSV文件时出错: {str(e)}")
        
        return self.result
    
    def _read_csv_with_encoding(self, file_path: str) -> Optional[pd.DataFrame]:
        """
        尝试用多种编码读取CSV
        """
        encodings = ['utf-8', 'gbk', 'gb2312', 'gb18030', 'latin1']
        
        for encoding in encodings:
            try:
                # 首先尝试用pandas读取
                df = pd.read_csv(file_path, encoding=encoding)
                return df
            except:
                pass
        
        # 如果pandas读取失败，尝试手动读取
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    lines = f.readlines()
                
                # 尝试找到数据开始的行
                data_start = 0
                for i, line in enumerate(lines):
                    if ',' in line and len(line.strip()) > 0:
                        data_start = i
                        break
                
                # 用csv模块解析
                import io
                csv_content = ''.join(lines[data_start:])
                df = pd.read_csv(io.StringIO(csv_content))
                return df
            except:
                pass
        
        return None
    
    def _detect_columns(self, df: pd.DataFrame):
        """
        自动检测列映射
        """
        self.column_mapping_actual = {}
        
        df_columns = [str(col).strip() for col in df.columns]
        
        for target_col, possible_names in self.COLUMN_MAPPING.items():
            # 转换为小写进行比较
            possible_names_lower = [name.lower() for name in possible_names]
            
            for idx, df_col in enumerate(df_columns):
                df_col_lower = df_col.lower()
                
                # 精确匹配
                if df_col_lower in possible_names_lower:
                    self.column_mapping_actual[target_col] = df_col
                    break
                
                # 部分匹配
                for possible_name in possible_names:
                    if possible_name.lower() in df_col_lower or df_col_lower in possible_name.lower():
                        if len(df_col_lower) > 2:  # 避免太短的列名误匹配
                            self.column_mapping_actual[target_col] = df_col
                            break
                
                if target_col in self.column_mapping_actual:
                    break
    
    def _parse_row(self, row: pd.Series, row_idx: int) -> Optional[VitalSignsRecord]:
        """
        解析单行数据
        """
        # 解析时间戳
        timestamp = self._parse_timestamp(row, row_idx)
        if timestamp is None:
            return None
        
        # 解析各项生命体征
        record = VitalSignsRecord(timestamp=timestamp)
        
        # 心率
        if 'heart_rate' in self.column_mapping_actual:
            col = self.column_mapping_actual['heart_rate']
            record.heart_rate = self._parse_numeric(row.get(col))
        
        # 收缩压
        if 'systolic_bp' in self.column_mapping_actual:
            col = self.column_mapping_actual['systolic_bp']
            record.systolic_bp = self._parse_numeric(row.get(col))
        
        # 舒张压
        if 'diastolic_bp' in self.column_mapping_actual:
            col = self.column_mapping_actual['diastolic_bp']
            record.diastolic_bp = self._parse_numeric(row.get(col))
        
        # 平均压
        if 'mean_bp' in self.column_mapping_actual:
            col = self.column_mapping_actual['mean_bp']
            record.mean_bp = self._parse_numeric(row.get(col))
        
        # 血氧
        if 'spo2' in self.column_mapping_actual:
            col = self.column_mapping_actual['spo2']
            record.spo2 = self._parse_numeric(row.get(col))
        
        # 体温
        if 'temperature' in self.column_mapping_actual:
            col = self.column_mapping_actual['temperature']
            record.temperature = self._parse_numeric(row.get(col))
        
        # 呼吸频率
        if 'respiratory_rate' in self.column_mapping_actual:
            col = self.column_mapping_actual['respiratory_rate']
            record.respiratory_rate = self._parse_numeric(row.get(col))
        
        # EtCO2
        if 'etco2' in self.column_mapping_actual:
            col = self.column_mapping_actual['etco2']
            record.etco2 = self._parse_numeric(row.get(col))
        
        return record
    
    def _parse_timestamp(self, row: pd.Series, row_idx: int) -> Optional[datetime]:
        """
        解析时间戳
        """
        if 'timestamp' not in self.column_mapping_actual:
            # 如果没有时间列，尝试使用行索引创建相对时间
            base_time = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            return base_time + timedelta(minutes=row_idx * 5)
        
        col = self.column_mapping_actual['timestamp']
        value = row.get(col)
        
        if pd.isna(value):
            return None
        
        # 转换为字符串
        time_str = str(value).strip()
        
        # 尝试各种时间格式
        for fmt in self.TIME_FORMATS:
            try:
                dt = datetime.strptime(time_str, fmt)
                
                # 如果只有时间没有日期，使用今天的日期
                if '%Y' not in fmt and '%y' not in fmt:
                    today = datetime.now().date()
                    dt = datetime.combine(today, dt.time())
                
                return dt
            except:
                continue
        
        # 尝试pandas的to_datetime
        try:
            dt = pd.to_datetime(value)
            if pd.notna(dt):
                return dt.to_pydatetime()
        except:
            pass
        
        return None
    
    def _parse_numeric(self, value) -> Optional[float]:
        """
        解析数值
        """
        if pd.isna(value):
            return None
        
        if isinstance(value, (int, float)):
            return float(value)
        
        # 尝试转换为字符串并清理
        try:
            str_value = str(value).strip()
            
            # 移除单位
            str_value = str_value.replace('bpm', '').replace('mmHg', '').replace('%', '')
            str_value = str_value.replace('℃', '').replace('°C', '').replace('°F', '')
            
            # 处理范围值 (如 "120/80")
            if '/' in str_value:
                # 对于血压，可能是收缩压/舒张压，取第一个
                parts = str_value.split('/')
                if parts:
                    str_value = parts[0].strip()
            
            # 尝试转换为浮点数
            return float(str_value)
        except:
            return None
