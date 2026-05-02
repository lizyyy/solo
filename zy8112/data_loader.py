"""数据导入模块 - 用于导入台站数据、波形数据和速度模型"""

import os
import glob
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta

import pandas as pd
import numpy as np
import yaml


class Station:
    """台站类 - 存储单台站信息"""
    
    def __init__(self, station_id: str, x: float, y: float, z: float, 
                 sampling_rate: float = 1000.0, channel: str = "Z"):
        """
        初始化台站
        
        Args:
            station_id: 台站ID
            x: X坐标 (m)
            y: Y坐标 (m)
            z: Z坐标 (m，通常向下为正或负)
            sampling_rate: 采样率 (Hz)
            channel: 通道类型 (Z, N, E等)
        """
        self.station_id = station_id
        self.x = x
        self.y = y
        self.z = z
        self.sampling_rate = sampling_rate
        self.channel = channel
        self.is_valid = True
        self.validation_errors: List[str] = []
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'station_id': self.station_id,
            'x': self.x,
            'y': self.y,
            'z': self.z,
            'sampling_rate': self.sampling_rate,
            'channel': self.channel,
            'is_valid': self.is_valid,
            'validation_errors': '; '.join(self.validation_errors) if self.validation_errors else ''
        }
    
    def __repr__(self) -> str:
        return f"Station({self.station_id}, x={self.x}, y={self.y}, z={self.z})"


class Waveform:
    """波形类 - 存储单台站波形数据"""
    
    def __init__(self, station_id: str, data: np.ndarray, sampling_rate: float,
                 start_time: Optional[datetime] = None, channel: str = "Z"):
        """
        初始化波形
        
        Args:
            station_id: 台站ID
            data: 波形数据数组
            sampling_rate: 采样率 (Hz)
            start_time: 起始时间
            channel: 通道类型
        """
        self.station_id = station_id
        self.data = data
        self.sampling_rate = sampling_rate
        self.dt = 1.0 / sampling_rate if sampling_rate > 0 else 0.0
        self.start_time = start_time
        self.end_time = start_time + timedelta(seconds=len(data) * self.dt) if start_time and len(data) > 0 else None
        self.channel = channel
        self.is_valid = True
        self.validation_errors: List[str] = []
        
        # 预处理后的属性
        self.filtered_data: Optional[np.ndarray] = None
        self.p_pick_idx: Optional[int] = None
        self.p_pick_time: Optional[float] = None
        self.p_pick_quality: float = 0.0
    
    def get_time_axis(self) -> np.ndarray:
        """获取时间轴数组（相对于起始时间的秒数）"""
        return np.arange(len(self.data)) * self.dt
    
    def get_absolute_time_axis(self) -> List[datetime]:
        """获取绝对时间轴"""
        if self.start_time is None:
            return []
        return [self.start_time + timedelta(seconds=i * self.dt) for i in range(len(self.data))]
    
    def check_cross_midnight(self) -> bool:
        """检查是否跨午夜"""
        if self.start_time is None or self.end_time is None:
            return False
        # 检查日期是否不同
        return self.start_time.date() != self.end_time.date()
    
    def split_at_midnight(self) -> Tuple['Waveform', 'Waveform']:
        """
        在午夜处分割波形
        
        Returns:
            (before_midnight, after_midnight): 分割后的两个波形
        """
        if not self.check_cross_midnight():
            return self, None
        
        # 计算午夜位置
        next_day = self.start_time.date() + timedelta(days=1)
        midnight = datetime.combine(next_day, datetime.min.time())
        seconds_to_midnight = (midnight - self.start_time).total_seconds()
        samples_to_midnight = int(seconds_to_midnight / self.dt)
        
        # 分割数据
        data_before = self.data[:samples_to_midnight]
        data_after = self.data[samples_to_midnight:]
        
        # 创建两个新波形
        waveform_before = Waveform(
            station_id=self.station_id,
            data=data_before,
            sampling_rate=self.sampling_rate,
            start_time=self.start_time,
            channel=self.channel
        )
        
        waveform_after = Waveform(
            station_id=self.station_id,
            data=data_after,
            sampling_rate=self.sampling_rate,
            start_time=midnight,
            channel=self.channel
        )
        
        return waveform_before, waveform_after
    
    def to_dict(self, include_data: bool = False) -> Dict:
        """转换为字典"""
        result = {
            'station_id': self.station_id,
            'sampling_rate': self.sampling_rate,
            'n_samples': len(self.data),
            'duration': len(self.data) * self.dt if self.dt > 0 else 0,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'channel': self.channel,
            'is_valid': self.is_valid,
            'p_pick_idx': self.p_pick_idx,
            'p_pick_time': self.p_pick_time,
            'p_pick_quality': self.p_pick_quality,
            'cross_midnight': self.check_cross_midnight()
        }
        if include_data:
            result['data'] = self.data.tolist()
        return result


class VelocityModel:
    """速度模型类"""
    
    def __init__(self, p_velocity: float = 5000.0, s_velocity: Optional[float] = None,
                 layers: Optional[List[Dict]] = None):
        """
        初始化速度模型
        
        Args:
            p_velocity: P波速度 (m/s)
            s_velocity: S波速度 (m/s)
            layers: 分层速度模型 [{'depth': 0, 'vp': 5000, 'vs': 2800}, ...]
        """
        self.p_velocity = p_velocity
        self.s_velocity = s_velocity if s_velocity else p_velocity / 1.73
        self.layers = layers if layers else []
        self.is_layered = len(self.layers) > 0
    
    def get_p_velocity(self, depth: float = 0.0) -> float:
        """
        获取指定深度的P波速度
        
        Args:
            depth: 深度 (m)
            
        Returns:
            P波速度 (m/s)
        """
        if not self.is_layered:
            return self.p_velocity
        
        # 从分层模型中查找速度
        velocity = self.p_velocity
        for layer in sorted(self.layers, key=lambda x: x.get('depth', 0)):
            if depth >= layer.get('depth', 0):
                velocity = layer.get('vp', self.p_velocity)
            else:
                break
        return velocity
    
    def get_s_velocity(self, depth: float = 0.0) -> float:
        """
        获取指定深度的S波速度
        
        Args:
            depth: 深度 (m)
            
        Returns:
            S波速度 (m/s)
        """
        if not self.is_layered:
            return self.s_velocity
        
        velocity = self.s_velocity
        for layer in sorted(self.layers, key=lambda x: x.get('depth', 0)):
            if depth >= layer.get('depth', 0):
                velocity = layer.get('vs', self.s_velocity)
            else:
                break
        return velocity
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'p_velocity': self.p_velocity,
            's_velocity': self.s_velocity,
            'is_layered': self.is_layered,
            'n_layers': len(self.layers),
            'layers': self.layers
        }


class DataLoader:
    """数据加载器 - 用于加载各类数据文件"""
    
    def __init__(self, stations_path: Optional[str] = None,
                 waveforms_dir: Optional[str] = None,
                 velocity_model_path: Optional[str] = None):
        """
        初始化数据加载器
        
        Args:
            stations_path: 台站CSV文件路径
            waveforms_dir: 波形数据目录路径
            velocity_model_path: 速度模型YAML文件路径
        """
        self.stations_path = stations_path
        self.waveforms_dir = waveforms_dir
        self.velocity_model_path = velocity_model_path
        
        # 加载的数据
        self.stations: Dict[str, Station] = {}
        self.waveforms: Dict[str, Waveform] = {}
        self.velocity_model: Optional[VelocityModel] = None
        
        # 加载状态
        self.load_errors: List[str] = []
        self.load_warnings: List[str] = []
    
    def load_stations(self, filepath: Optional[str] = None) -> Dict[str, Station]:
        """
        加载台站数据
        
        Args:
            filepath: CSV文件路径，默认使用初始化时的路径
            
        Returns:
            台站字典 {station_id: Station}
        """
        filepath = filepath or self.stations_path
        if not filepath:
            raise ValueError("未提供台站数据文件路径")
        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"台站文件不存在: {filepath}")
        
        try:
            df = pd.read_csv(filepath)
            required_columns = ['station_id', 'x', 'y', 'z']
            
            # 检查必需列
            for col in required_columns:
                if col not in df.columns:
                    self.load_errors.append(f"台站文件缺少必需列: {col}")
            
            if self.load_errors:
                raise ValueError(f"台站文件格式错误: {'; '.join(self.load_errors)}")
            
            # 解析台站数据
            for _, row in df.iterrows():
                station_id = str(row['station_id']).strip()
                
                # 处理可选列
                sampling_rate = float(row.get('sampling_rate', 1000.0))
                channel = str(row.get('channel', 'Z')).strip()
                
                station = Station(
                    station_id=station_id,
                    x=float(row['x']),
                    y=float(row['y']),
                    z=float(row['z']),
                    sampling_rate=sampling_rate,
                    channel=channel
                )
                self.stations[station_id] = station
            
            self.stations_path = filepath
            return self.stations
            
        except Exception as e:
            self.load_errors.append(f"加载台站数据失败: {str(e)}")
            raise
    
    def load_waveforms(self, directory: Optional[str] = None,
                        file_pattern: str = "*.csv") -> Dict[str, Waveform]:
        """
        加载波形数据
        
        Args:
            directory: 波形数据目录，默认使用初始化时的目录
            file_pattern: 文件名模式
            
        Returns:
            波形字典 {station_id: Waveform}
        """
        directory = directory or self.waveforms_dir
        if not directory:
            raise ValueError("未提供波形数据目录路径")
        
        if not os.path.exists(directory):
            raise FileNotFoundError(f"波形目录不存在: {directory}")
        
        # 查找所有匹配的文件
        search_pattern = os.path.join(directory, file_pattern)
        waveform_files = glob.glob(search_pattern)
        
        if not waveform_files:
            self.load_warnings.append(f"在 {directory} 中未找到波形文件 (模式: {file_pattern})")
            return self.waveforms
        
        for filepath in sorted(waveform_files):
            try:
                waveform = self._load_single_waveform(filepath)
                if waveform:
                    # 处理跨午夜情况
                    if waveform.check_cross_midnight():
                        self.load_warnings.append(
                            f"波形 {waveform.station_id} 跨午夜，已自动分割"
                        )
                    
                    # 保存波形（按台站ID）
                    if waveform.station_id in self.waveforms:
                        self.load_warnings.append(
                            f"台站 {waveform.station_id} 存在多个波形文件，将覆盖旧数据"
                        )
                    self.waveforms[waveform.station_id] = waveform
                    
            except Exception as e:
                self.load_errors.append(f"加载波形文件 {filepath} 失败: {str(e)}")
        
        self.waveforms_dir = directory
        return self.waveforms
    
    def _load_single_waveform(self, filepath: str) -> Optional[Waveform]:
        """
        加载单个波形文件
        
        Args:
            filepath: 文件路径
            
        Returns:
            Waveform对象或None
        """
        filename = os.path.basename(filepath)
        station_id = os.path.splitext(filename)[0]
        
        # 尝试从文件名提取台站ID（格式可能为 STA_20240101_000000.csv）
        if '_' in station_id:
            parts = station_id.split('_')
            if len(parts) >= 1:
                station_id = parts[0]
        
        # 读取CSV
        df = pd.read_csv(filepath)
        
        # 确定数据列
        data_cols = []
        time_col = None
        sampling_rate = 1000.0  # 默认采样率
        start_time = None
        
        # 检查是否有时间列
        for col in df.columns:
            col_lower = col.lower()
            if 'time' in col_lower or 'timestamp' in col_lower:
                time_col = col
            elif col_lower in ['x', 'y', 'z', 'n', 'e', 'data', 'value', 'amplitude', 'velocity']:
                data_cols.append(col)
        
        # 如果没有明确的数据列，尝试使用数值列
        if not data_cols:
            for col in df.columns:
                if pd.api.types.is_numeric_dtype(df[col]):
                    data_cols.append(col)
        
        if not data_cols:
            raise ValueError(f"波形文件 {filepath} 中未找到有效数据列")
        
        # 使用第一个数据列
        data = df[data_cols[0]].values.astype(float)
        
        # 尝试从时间列解析采样率和起始时间
        if time_col is not None and len(df) > 1:
            try:
                # 尝试解析时间
                time_values = df[time_col]
                
                # 检查是否是datetime类型
                if pd.api.types.is_datetime64_any_dtype(time_values):
                    times = pd.to_datetime(time_values)
                else:
                    # 尝试解析字符串
                    times = pd.to_datetime(time_values, errors='coerce')
                
                if not times.isna().all():
                    # 计算采样率
                    valid_times = times.dropna()
                    if len(valid_times) > 1:
                        dt = (valid_times.iloc[1] - valid_times.iloc[0]).total_seconds()
                        if dt > 0:
                            sampling_rate = 1.0 / dt
                    
                    # 设置起始时间
                    start_time = valid_times.iloc[0] if len(valid_times) > 0 else None
                    
            except Exception as e:
                self.load_warnings.append(f"解析时间列失败: {str(e)}，使用默认采样率")
        
        # 尝试从文件名解析起始时间
        if start_time is None:
            try:
                # 尝试从文件名解析时间 (如 STA_20240101_000000.csv)
                filename_parts = os.path.splitext(os.path.basename(filepath))[0].split('_')
                if len(filename_parts) >= 3:
                    date_str = filename_parts[1]  # 20240101
                    time_str = filename_parts[2]  # 000000
                    if len(date_str) == 8 and len(time_str) == 6:
                        start_time = datetime.strptime(
                            f"{date_str}{time_str}", "%Y%m%d%H%M%S"
                        )
            except Exception:
                pass  # 解析失败，忽略
        
        # 检查台站配置
        channel = "Z"
        if station_id in self.stations:
            # 使用台站配置的采样率（如果文件中未确定）
            if sampling_rate == 1000.0 and self.stations[station_id].sampling_rate > 0:
                sampling_rate = self.stations[station_id].sampling_rate
            channel = self.stations[station_id].channel
        
        return Waveform(
            station_id=station_id,
            data=data,
            sampling_rate=sampling_rate,
            start_time=start_time,
            channel=channel
        )
    
    def load_velocity_model(self, filepath: Optional[str] = None) -> VelocityModel:
        """
        加载速度模型
        
        Args:
            filepath: YAML文件路径，默认使用初始化时的路径
            
        Returns:
            VelocityModel对象
        """
        filepath = filepath or self.velocity_model_path
        
        if not filepath:
            # 使用默认速度模型
            self.velocity_model = VelocityModel()
            return self.velocity_model
        
        if not os.path.exists(filepath):
            self.load_warnings.append(f"速度模型文件不存在: {filepath}，使用默认速度模型")
            self.velocity_model = VelocityModel()
            return self.velocity_model
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
            
            if config is None:
                config = {}
            
            # 解析速度模型
            p_velocity = config.get('p_velocity', 5000.0)
            s_velocity = config.get('s_velocity')
            layers = config.get('layers', [])
            
            self.velocity_model = VelocityModel(
                p_velocity=p_velocity,
                s_velocity=s_velocity,
                layers=layers
            )
            
            self.velocity_model_path = filepath
            return self.velocity_model
            
        except Exception as e:
            self.load_errors.append(f"加载速度模型失败: {str(e)}，使用默认速度模型")
            self.velocity_model = VelocityModel()
            return self.velocity_model
    
    def load_all(self) -> Tuple[Dict[str, Station], Dict[str, Waveform], VelocityModel]:
        """
        加载所有数据
        
        Returns:
            (stations, waveforms, velocity_model)
        """
        # 先加载台站数据（用于解析波形）
        if self.stations_path:
            self.load_stations()
        
        # 加载波形数据
        if self.waveforms_dir:
            self.load_waveforms()
        
        # 加载速度模型
        self.load_velocity_model()
        
        return self.stations, self.waveforms, self.velocity_model
    
    def get_load_summary(self) -> Dict:
        """获取加载摘要"""
        return {
            'n_stations': len(self.stations),
            'n_valid_stations': sum(1 for s in self.stations.values() if s.is_valid),
            'n_waveforms': len(self.waveforms),
            'n_valid_waveforms': sum(1 for w in self.waveforms.values() if w.is_valid),
            'has_velocity_model': self.velocity_model is not None,
            'errors': self.load_errors,
            'warnings': self.load_warnings
        }
