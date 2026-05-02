"""数据校验模块 - 用于校验台站数据、波形数据的有效性"""

from typing import Dict, List, Optional, Tuple
from datetime import datetime

import numpy as np

from config import (
    MIN_VALID_SAMPLING_RATE,
    MAX_VALID_SAMPLING_RATE,
    MIN_COORDINATE_RANGE,
    MAX_COORDINATE_RANGE,
    MIN_STATIONS_FOR_LOCATION
)
from data_loader import Station, Waveform, VelocityModel


class ValidationResult:
    """校验结果类"""
    
    def __init__(self):
        self.is_valid: bool = True
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.info: List[str] = []
        
        # 统计信息
        self.n_valid_stations: int = 0
        self.n_invalid_stations: int = 0
        self.n_valid_waveforms: int = 0
        self.n_invalid_waveforms: int = 0
        self.n_missing_stations: int = 0
        self.n_missing_waveforms: int = 0
        self.stations_with_cross_midnight: List[str] = []
    
    def add_error(self, message: str):
        """添加错误"""
        self.errors.append(message)
        self.is_valid = False
    
    def add_warning(self, message: str):
        """添加警告"""
        self.warnings.append(message)
    
    def add_info(self, message: str):
        """添加信息"""
        self.info.append(message)
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'is_valid': self.is_valid,
            'n_valid_stations': self.n_valid_stations,
            'n_invalid_stations': self.n_invalid_stations,
            'n_valid_waveforms': self.n_valid_waveforms,
            'n_invalid_waveforms': self.n_invalid_waveforms,
            'n_missing_stations': self.n_missing_stations,
            'n_missing_waveforms': self.n_missing_waveforms,
            'stations_with_cross_midnight': self.stations_with_cross_midnight,
            'errors': self.errors,
            'warnings': self.warnings,
            'info': self.info,
            'n_errors': len(self.errors),
            'n_warnings': len(self.warnings),
            'n_info': len(self.info)
        }
    
    def __repr__(self) -> str:
        status = "有效" if self.is_valid else "无效"
        return (f"ValidationResult({status}, errors={len(self.errors)}, "
                f"warnings={len(self.warnings)})")


class DataValidator:
    """数据校验器 - 用于校验各类数据的有效性"""
    
    def __init__(self, 
                 min_sampling_rate: float = MIN_VALID_SAMPLING_RATE,
                 max_sampling_rate: float = MAX_VALID_SAMPLING_RATE,
                 min_coordinate: float = MIN_COORDINATE_RANGE,
                 max_coordinate: float = MAX_COORDINATE_RANGE):
        """
        初始化校验器
        
        Args:
            min_sampling_rate: 最小有效采样率 (Hz)
            max_sampling_rate: 最大有效采样率 (Hz)
            min_coordinate: 坐标最小值 (m)
            max_coordinate: 坐标最大值 (m)
        """
        self.min_sampling_rate = min_sampling_rate
        self.max_sampling_rate = max_sampling_rate
        self.min_coordinate = min_coordinate
        self.max_coordinate = max_coordinate
    
    def validate_station(self, station: Station) -> Tuple[bool, List[str], List[str]]:
        """
        校验单个台站
        
        Args:
            station: 台站对象
            
        Returns:
            (is_valid, errors, warnings)
        """
        errors = []
        warnings = []
        
        # 校验台站ID
        if not station.station_id or station.station_id.strip() == "":
            errors.append("台站ID为空")
        
        # 校验坐标
        for coord_name, coord_value in [('x', station.x), ('y', station.y), ('z', station.z)]:
            if np.isnan(coord_value) or np.isinf(coord_value):
                errors.append(f"台站{coord_name.upper()}坐标无效: {coord_value}")
            elif coord_value < self.min_coordinate or coord_value > self.max_coordinate:
                warnings.append(
                    f"台站{coord_name.upper()}坐标超出常规范围: {coord_value} "
                    f"(范围: {self.min_coordinate} ~ {self.max_coordinate})"
                )
        
        # 校验采样率
        if station.sampling_rate <= 0:
            errors.append(f"台站采样率无效: {station.sampling_rate} Hz")
        elif station.sampling_rate < self.min_sampling_rate:
            warnings.append(
                f"台站采样率较低: {station.sampling_rate} Hz "
                f"(建议最小: {self.min_sampling_rate} Hz)"
            )
        elif station.sampling_rate > self.max_sampling_rate:
            warnings.append(
                f"台站采样率较高: {station.sampling_rate} Hz "
                f"(建议最大: {self.max_sampling_rate} Hz)"
            )
        
        # 检查是否所有坐标相同（可能是配置错误）
        if station.x == station.y == station.z == 0:
            warnings.append("台站所有坐标均为0，可能是配置错误")
        
        is_valid = len(errors) == 0
        return is_valid, errors, warnings
    
    def validate_waveform(self, waveform: Waveform) -> Tuple[bool, List[str], List[str]]:
        """
        校验单个波形
        
        Args:
            waveform: 波形对象
            
        Returns:
            (is_valid, errors, warnings)
        """
        errors = []
        warnings = []
        
        # 校验数据长度
        if len(waveform.data) == 0:
            errors.append("波形数据为空")
        elif len(waveform.data) < 100:
            warnings.append(f"波形数据长度较短: {len(waveform.data)} 个采样点")
        
        # 校验采样率
        if waveform.sampling_rate <= 0:
            errors.append(f"波形采样率无效: {waveform.sampling_rate} Hz")
        elif waveform.dt <= 0:
            errors.append(f"波形采样间隔无效: dt={waveform.dt} s")
        
        # 校验数据有效性
        if len(waveform.data) > 0:
            if np.all(np.isnan(waveform.data)):
                errors.append("波形数据全部为NaN")
            elif np.all(np.isinf(waveform.data)):
                errors.append("波形数据全部为无穷大")
            
            # 检查数据范围（是否有异常大的值）
            max_abs = np.max(np.abs(waveform.data))
            if max_abs > 1e10:
                warnings.append(f"波形数据绝对值异常大: {max_abs}")
            
            # 检查是否全零
            if np.all(waveform.data == 0):
                warnings.append("波形数据全部为0")
            
            # 检查是否为常数信号
            if len(waveform.data) > 1 and np.all(waveform.data == waveform.data[0]):
                warnings.append("波形数据为常数值")
        
        # 检查跨午夜
        if waveform.check_cross_midnight():
            warnings.append("波形跨越午夜，建议检查或分割")
        
        is_valid = len(errors) == 0
        return is_valid, errors, warnings
    
    def validate_all(self,
                     stations: Dict[str, Station],
                     waveforms: Dict[str, Waveform],
                     velocity_model: Optional[VelocityModel] = None) -> ValidationResult:
        """
        校验所有数据
        
        Args:
            stations: 台站字典
            waveforms: 波形字典
            velocity_model: 速度模型（可选）
            
        Returns:
            校验结果
        """
        result = ValidationResult()
        
        # 检查是否有数据
        if not stations:
            result.add_error("未加载任何台站数据")
        
        if not waveforms:
            result.add_error("未加载任何波形数据")
        
        # 校验每个台站
        for station_id, station in stations.items():
            is_valid, errors, warnings = self.validate_station(station)
            
            # 更新台站对象
            station.is_valid = is_valid
            station.validation_errors = errors.copy()
            
            # 更新统计
            if is_valid:
                result.n_valid_stations += 1
            else:
                result.n_invalid_stations += 1
            
            # 记录错误和警告
            for error in errors:
                result.add_error(f"台站 [{station_id}]: {error}")
            for warning in warnings:
                result.add_warning(f"台站 [{station_id}]: {warning}")
        
        # 校验每个波形
        for station_id, waveform in waveforms.items():
            is_valid, errors, warnings = self.validate_waveform(waveform)
            
            # 更新波形对象
            waveform.is_valid = is_valid
            waveform.validation_errors = errors.copy()
            
            # 更新统计
            if is_valid:
                result.n_valid_waveforms += 1
            else:
                result.n_invalid_waveforms += 1
            
            # 记录错误和警告
            for error in errors:
                result.add_error(f"波形 [{station_id}]: {error}")
            for warning in warnings:
                result.add_warning(f"波形 [{station_id}]: {warning}")
            
            # 记录跨午夜的台站
            if waveform.check_cross_midnight():
                result.stations_with_cross_midnight.append(station_id)
        
        # 检查台站和波形的匹配性
        station_ids = set(stations.keys())
        waveform_ids = set(waveforms.keys())
        
        # 有台站但无波形的
        stations_without_waveform = station_ids - waveform_ids
        if stations_without_waveform:
            result.n_missing_waveforms = len(stations_without_waveform)
            result.add_warning(
                f"有 {len(stations_without_waveform)} 个台站没有对应的波形数据: "
                f"{', '.join(sorted(stations_without_waveform))}"
            )
        
        # 有波形但无台站的
        waveforms_without_station = waveform_ids - station_ids
        if waveforms_without_station:
            result.n_missing_stations = len(waveforms_without_station)
            result.add_warning(
                f"有 {len(waveforms_without_station)} 个波形没有对应的台站配置: "
                f"{', '.join(sorted(waveforms_without_station))}"
            )
        
        # 检查有效台站数量是否足够定位
        valid_station_ids = [sid for sid, s in stations.items() if s.is_valid]
        valid_waveform_ids = [sid for sid, w in waveforms.items() if w.is_valid]
        common_valid = set(valid_station_ids) & set(valid_waveform_ids)
        
        if len(common_valid) < MIN_STATIONS_FOR_LOCATION:
            result.add_warning(
                f"有效台站数量不足 (当前: {len(common_valid)}, "
                f"定位需要至少 {MIN_STATIONS_FOR_LOCATION} 个)"
            )
        
        # 校验速度模型（如果提供）
        if velocity_model:
            if velocity_model.p_velocity <= 0:
                result.add_error(f"速度模型P波速度无效: {velocity_model.p_velocity} m/s")
            if velocity_model.s_velocity and velocity_model.s_velocity <= 0:
                result.add_error(f"速度模型S波速度无效: {velocity_model.s_velocity} m/s")
            
            if velocity_model.is_layered:
                for i, layer in enumerate(velocity_model.layers):
                    if 'vp' not in layer or layer['vp'] <= 0:
                        result.add_warning(f"速度模型第 {i+1} 层P波速度无效")
                    if 'vs' in layer and layer['vs'] <= 0:
                        result.add_warning(f"速度模型第 {i+1} 层S波速度无效")
        
        # 添加信息
        result.add_info(f"总台站数: {len(stations)}，有效: {result.n_valid_stations}")
        result.add_info(f"总波形数: {len(waveforms)}，有效: {result.n_valid_waveforms}")
        result.add_info(f"可用于定位的台站数: {len(common_valid)}")
        
        return result
    
    def check_station_consistency(self,
                                   station: Station,
                                   waveform: Waveform) -> Tuple[bool, List[str], List[str]]:
        """
        检查台站和波形的一致性
        
        Args:
            station: 台站对象
            waveform: 波形对象
            
        Returns:
            (is_consistent, errors, warnings)
        """
        errors = []
        warnings = []
        
        # 检查采样率一致性
        if abs(station.sampling_rate - waveform.sampling_rate) > 1e-6:
            if station.sampling_rate > 0 and waveform.sampling_rate > 0:
                warnings.append(
                    f"台站配置采样率 ({station.sampling_rate} Hz) 与 "
                    f"波形采样率 ({waveform.sampling_rate} Hz) 不一致"
                )
        
        # 检查通道一致性
        if station.channel != waveform.channel:
            warnings.append(
                f"台站配置通道 ({station.channel}) 与 "
                f"波形通道 ({waveform.channel}) 不一致"
            )
        
        is_consistent = len(errors) == 0
        return is_consistent, errors, warnings


def quick_validate(stations: Dict[str, Station],
                   waveforms: Dict[str, Waveform],
                   velocity_model: Optional[VelocityModel] = None) -> ValidationResult:
    """
    快速校验函数 - 便捷接口
    
    Args:
        stations: 台站字典
        waveforms: 波形字典
        velocity_model: 速度模型（可选）
        
    Returns:
        校验结果
    """
    validator = DataValidator()
    return validator.validate_all(stations, waveforms, velocity_model)
