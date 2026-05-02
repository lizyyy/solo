"""事件定位模块 - 基于到时差的微震事件定位算法"""

from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
from scipy.optimize import least_squares

from config import (
    MIN_STATIONS_FOR_LOCATION,
    DEFAULT_VELOCITY_P,
    DEFAULT_DEPTH_PENALTY
)
from data_loader import Station, Waveform, VelocityModel
from picker import PickResult


@dataclass
class LocationResult:
    """定位结果类"""
    
    event_id: str = ""
    
    # 定位坐标
    x: float = np.nan
    y: float = np.nan
    z: float = np.nan
    origin_time: float = np.nan  # 发震时刻（相对于最早到时的秒数）
    
    # 绝对时间（如果有起始时间）
    absolute_origin_time: Optional[datetime] = None
    
    # 定位质量
    residual: float = np.nan  # 平均残差 (秒)
    rms: float = np.nan       # 均方根残差
    azimuthal_gap: float = np.nan  # 方位角间隙 (度)
    
    # 误差估计
    x_err: float = np.nan
    y_err: float = np.nan
    z_err: float = np.nan
    time_err: float = np.nan
    
    # 不确定性椭圆体
    horizontal_error: float = np.nan  # 水平误差 (m)
    depth_error: float = np.nan       # 深度误差 (m)
    
    # 使用的台站信息
    used_stations: List[str] = field(default_factory=list)
    n_used_stations: int = 0
    
    # 各台站的残差
    station_residuals: Dict[str, float] = field(default_factory=dict)
    station_arrivals: Dict[str, float] = field(default_factory=dict)  # 各台站到时
    
    # 定位状态
    is_valid: bool = False
    location_method: str = ""
    iterations: int = 0
    convergence: bool = False
    
    # 质量评分
    quality_score: float = 0.0  # 0.0 ~ 1.0
    quality_class: str = "D"  # A, B, C, D
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'event_id': self.event_id,
            'x': self.x,
            'y': self.y,
            'z': self.z,
            'origin_time': self.origin_time,
            'absolute_origin_time': self.absolute_origin_time.isoformat() if self.absolute_origin_time else None,
            'residual': self.residual,
            'rms': self.rms,
            'azimuthal_gap': self.azimuthal_gap,
            'x_err': self.x_err,
            'y_err': self.y_err,
            'z_err': self.z_err,
            'time_err': self.time_err,
            'horizontal_error': self.horizontal_error,
            'depth_error': self.depth_error,
            'n_used_stations': self.n_used_stations,
            'used_stations': ', '.join(self.used_stations),
            'is_valid': self.is_valid,
            'location_method': self.location_method,
            'iterations': self.iterations,
            'convergence': self.convergence,
            'quality_score': self.quality_score,
            'quality_class': self.quality_class
        }
    
    def calculate_quality_score(self):
        """计算质量评分"""
        if not self.is_valid:
            self.quality_score = 0.0
            self.quality_class = "D"
            return
        
        # 各因素评分
        scores = []
        
        # 1. 台站数量
        if self.n_used_stations >= 6:
            scores.append(1.0)
        elif self.n_used_stations >= 5:
            scores.append(0.8)
        elif self.n_used_stations >= 4:
            scores.append(0.6)
        else:  # 3台站
            scores.append(0.4)
        
        # 2. RMS残差 (秒)
        if self.rms <= 0.01:  # 10ms
            scores.append(1.0)
        elif self.rms <= 0.02:  # 20ms
            scores.append(0.8)
        elif self.rms <= 0.05:  # 50ms
            scores.append(0.6)
        elif self.rms <= 0.1:  # 100ms
            scores.append(0.4)
        else:
            scores.append(0.2)
        
        # 3. 方位角间隙
        if self.azimuthal_gap <= 90:
            scores.append(1.0)
        elif self.azimuthal_gap <= 180:
            scores.append(0.8)
        elif self.azimuthal_gap <= 270:
            scores.append(0.6)
        else:
            scores.append(0.3)
        
        # 4. 水平误差
        if self.horizontal_error <= 10:
            scores.append(1.0)
        elif self.horizontal_error <= 30:
            scores.append(0.8)
        elif self.horizontal_error <= 100:
            scores.append(0.6)
        else:
            scores.append(0.3)
        
        # 平均评分
        self.quality_score = np.mean(scores)
        
        # 质量等级
        if self.quality_score >= 0.8:
            self.quality_class = "A"
        elif self.quality_score >= 0.6:
            self.quality_class = "B"
        elif self.quality_score >= 0.4:
            self.quality_class = "C"
        else:
            self.quality_class = "D"


class EventLocator:
    """微震事件定位器"""
    
    def __init__(self,
                 velocity_model: Optional[VelocityModel] = None,
                 min_stations: int = MIN_STATIONS_FOR_LOCATION,
                 depth_penalty: float = DEFAULT_DEPTH_PENALTY):
        """
        初始化定位器
        
        Args:
            velocity_model: 速度模型
            min_stations: 最小台站数量
            depth_penalty: 深度惩罚因子（用于约束深度）
        """
        self.velocity_model = velocity_model or VelocityModel()
        self.min_stations = min_stations
        self.depth_penalty = depth_penalty
    
    def _get_velocity(self, x: float, y: float, z: float) -> float:
        """
        获取指定位置的速度
        
        Args:
            x, y, z: 坐标
            
        Returns:
            P波速度 (m/s)
        """
        return self.velocity_model.get_p_velocity(z)
    
    def _calculate_travel_time(self,
                                event_x: float, event_y: float, event_z: float,
                                station: Station) -> float:
        """
        计算从事件位置到台站的走时
        
        Args:
            event_x, event_y, event_z: 事件坐标
            station: 台站对象
            
        Returns:
            走时 (秒)
        """
        # 计算距离
        dx = station.x - event_x
        dy = station.y - event_y
        dz = station.z - event_z
        distance = np.sqrt(dx**2 + dy**2 + dz**2)
        
        # 获取速度（使用事件处的速度，简化为均匀速度）
        velocity = self._get_velocity(event_x, event_y, event_z)
        
        # 走时 = 距离 / 速度
        return distance / velocity if velocity > 0 else 0.0
    
    def _residual_function(self,
                           params: np.ndarray,
                           stations: List[Station],
                           arrival_times: np.ndarray,
                           arrival_weights: np.ndarray) -> np.ndarray:
        """
        计算残差函数（用于最小二乘）
        
        Args:
            params: [x, y, z, t0] 事件坐标和发震时刻
            stations: 台站列表
            arrival_times: 观测到时（相对于最早到时）
            arrival_weights: 各到时的权重
            
        Returns:
            残差数组
        """
        x, y, z, t0 = params
        
        residuals = []
        for i, station in enumerate(stations):
            # 计算理论走时
            tt = self._calculate_travel_time(x, y, z, station)
            
            # 计算到时残差
            # 观测到时 = t0 + 理论走时
            # 残差 = (t0 + tt) - 观测到时
            residual = (t0 + tt) - arrival_times[i]
            
            # 应用权重
            weighted_residual = residual * np.sqrt(arrival_weights[i])
            residuals.append(weighted_residual)
        
        # 添加深度惩罚（如果启用）
        if self.depth_penalty > 0:
            # 惩罚深度过大或过小的解
            # 假设深度应该在合理范围内（相对于台站平均深度）
            avg_station_z = np.mean([s.z for s in stations])
            depth_penalty = self.depth_penalty * (z - avg_station_z) * 0.001  # 缩放
            residuals.append(depth_penalty)
        
        return np.array(residuals)
    
    def _compute_azimuthal_gap(self,
                                event_x: float, event_y: float,
                                stations: List[Station]) -> float:
        """
        计算方位角间隙
        
        Args:
            event_x, event_y: 事件水平坐标
            stations: 使用的台站列表
            
        Returns:
            方位角间隙 (度)
        """
        if len(stations) < 2:
            return 360.0
        
        # 计算每个台站相对于事件的方位角
        azimuths = []
        for station in stations:
            dx = station.x - event_x
            dy = station.y - event_y
            
            # 计算方位角（从x轴正方向逆时针）
            azimuth = np.degrees(np.arctan2(dy, dx))
            # 转换为 0-360 度
            if azimuth < 0:
                azimuth += 360
            azimuths.append(azimuth)
        
        # 排序
        azimuths.sort()
        
        # 计算相邻台站之间的间隙
        gaps = []
        for i in range(len(azimuths)):
            next_i = (i + 1) % len(azimuths)
            if next_i == 0:
                # 最后一个到第一个的间隙，需要考虑360度环绕
                gap = (azimuths[0] + 360) - azimuths[i]
            else:
                gap = azimuths[next_i] - azimuths[i]
            gaps.append(gap)
        
        # 最大间隙即为方位角间隙
        return max(gaps)
    
    def _estimate_errors(self,
                         result: LocationResult,
                         stations: List[Station],
                         arrival_times: np.ndarray,
                         arrival_weights: np.ndarray,
                         params: np.ndarray):
        """
        估计定位误差
        
        Args:
            result: 定位结果（在其中填充误差信息）
            stations: 台站列表
            arrival_times: 观测到时
            arrival_weights: 权重
            params: 最优参数 [x, y, z, t0]
        """
        x, y, z, t0 = params
        
        # 计算雅克比矩阵
        n_stations = len(stations)
        jacobian = np.zeros((n_stations, 4))
        
        velocity = self._get_velocity(x, y, z)
        
        for i, station in enumerate(stations):
            dx = station.x - x
            dy = station.y - y
            dz = station.z - z
            distance = np.sqrt(dx**2 + dy**2 + dz**2)
            
            if distance > 0 and velocity > 0:
                # 偏导数: d(tt)/dx = -dx/(v*r)
                # 残差 = t0 + tt - tobs
                # 所以: d(residual)/dx = d(tt)/dx
                
                jacobian[i, 0] = -dx / (velocity * distance) * np.sqrt(arrival_weights[i])
                jacobian[i, 1] = -dy / (velocity * distance) * np.sqrt(arrival_weights[i])
                jacobian[i, 2] = -dz / (velocity * distance) * np.sqrt(arrival_weights[i])
                jacobian[i, 3] = 1.0 * np.sqrt(arrival_weights[i])
        
        # 添加深度惩罚项的偏导
        if self.depth_penalty > 0:
            penalty_row = np.zeros(4)
            penalty_row[2] = self.depth_penalty * 0.001
            jacobian = np.vstack([jacobian, penalty_row])
        
        # 计算协方差矩阵
        try:
            # 计算 J^T * J 的逆
            jtj = jacobian.T @ jacobian
            
            # 正则化（如果矩阵奇异）
            jtj_reg = jtj + 1e-10 * np.eye(4)
            
            covariance = np.linalg.inv(jtj_reg)
            
            # 计算残差的均方根（用于缩放协方差）
            residuals = self._residual_function(params, stations, arrival_times, arrival_weights)
            n_data = len(residuals)
            n_params = 4
            
            if n_data > n_params:
                # 调整自由度
                rms_adj = np.sqrt(np.sum(residuals**2) / (n_data - n_params))
            else:
                rms_adj = np.sqrt(np.sum(residuals**2) / n_data) if n_data > 0 else 0
            
            # 估计标准误差
            result.x_err = np.sqrt(covariance[0, 0]) * rms_adj if covariance[0, 0] > 0 else np.nan
            result.y_err = np.sqrt(covariance[1, 1]) * rms_adj if covariance[1, 1] > 0 else np.nan
            result.z_err = np.sqrt(covariance[2, 2]) * rms_adj if covariance[2, 2] > 0 else np.nan
            result.time_err = np.sqrt(covariance[3, 3]) * rms_adj if covariance[3, 3] > 0 else np.nan
            
            # 水平误差（误差椭圆的主轴）
            # 简化为 x 和 y 误差的组合
            result.horizontal_error = np.sqrt(result.x_err**2 + result.y_err**2)
            result.depth_error = result.z_err
            
        except Exception:
            # 如果协方差计算失败，使用默认值
            result.x_err = np.nan
            result.y_err = np.nan
            result.z_err = np.nan
            result.time_err = np.nan
            result.horizontal_error = np.nan
            result.depth_error = np.nan
    
    def locate(self,
               stations: Dict[str, Station],
               pick_results: Dict[str, PickResult],
               waveforms: Optional[Dict[str, Waveform]] = None,
               event_id: str = "") -> LocationResult:
        """
        定位微震事件
        
        Args:
            stations: 台站字典
            pick_results: 拾取结果字典
            waveforms: 波形字典（可选，用于获取绝对时间）
            event_id: 事件ID
            
        Returns:
            定位结果
        """
        result = LocationResult(event_id=event_id)
        result.location_method = "Geiger's method (least squares)"
        
        # 筛选有效的拾取结果
        valid_picks = []
        valid_stations = []
        valid_station_ids = []
        
        for station_id, pick_result in pick_results.items():
            if (pick_result.is_valid() and 
                station_id in stations and 
                stations[station_id].is_valid):
                valid_picks.append(pick_result)
                valid_stations.append(stations[station_id])
                valid_station_ids.append(station_id)
        
        result.n_used_stations = len(valid_stations)
        result.used_stations = valid_station_ids
        
        # 检查台站数量
        if len(valid_stations) < self.min_stations:
            result.is_valid = False
            result.additional_info = f"台站数量不足: 需要 {self.min_stations}，实际 {len(valid_stations)}"
            result.calculate_quality_score()
            return result
        
        # 准备到时数据
        # 转换为相对于最早到时的时间
        arrival_times = np.array([p.pick_time for p in valid_picks])
        min_arrival = np.min(arrival_times)
        arrival_times_relative = arrival_times - min_arrival
        
        # 计算权重（基于拾取质量和置信度）
        # 质量越高、置信度越高，权重越大
        arrival_weights = []
        for pick in valid_picks:
            # 综合质量和置信度
            weight = (pick.pick_quality * 0.5 + pick.confidence * 0.5)
            # 确保权重为正
            weight = max(0.1, weight)
            arrival_weights.append(weight)
        arrival_weights = np.array(arrival_weights)
        
        # 计算初始猜测
        # 1. 位置：台站的加权平均
        # 2. 时间：0（因为我们使用相对于最早到时的时间）
        
        # 使用权重计算台站平均位置
        total_weight = np.sum(arrival_weights)
        if total_weight > 0:
            initial_x = np.sum([s.x * w for s, w in zip(valid_stations, arrival_weights)]) / total_weight
            initial_y = np.sum([s.y * w for s, w in zip(valid_stations, arrival_weights)]) / total_weight
            initial_z = np.sum([s.z * w for s, w in zip(valid_stations, arrival_weights)]) / total_weight
        else:
            initial_x = np.mean([s.x for s in valid_stations])
            initial_y = np.mean([s.y for s in valid_stations])
            initial_z = np.mean([s.z for s in valid_stations])
        
        # 初始发震时刻（相对于最早到时）
        # 考虑从平均位置到最早到时台站的走时
        first_pick_idx = np.argmin(arrival_times)
        first_station = valid_stations[first_pick_idx]
        
        distance_to_first = np.sqrt(
            (first_station.x - initial_x)**2 +
            (first_station.y - initial_y)**2 +
            (first_station.z - initial_z)**2
        )
        velocity = self._get_velocity(initial_x, initial_y, initial_z)
        tt_to_first = distance_to_first / velocity if velocity > 0 else 0
        
        # 初始t0: 因为最早到时是0，所以 t0 + tt = 0 => t0 = -tt
        initial_t0 = -tt_to_first
        
        initial_params = np.array([initial_x, initial_y, initial_z, initial_t0])
        
        # 使用最小二乘法求解
        try:
            ls_result = least_squares(
                self._residual_function,
                initial_params,
                args=(valid_stations, arrival_times_relative, arrival_weights),
                method='trf',
                ftol=1e-8,
                xtol=1e-8,
                gtol=1e-8,
                max_nfev=100
            )
            
            # 提取结果
            params = ls_result.x
            result.x, result.y, result.z, result.origin_time = params
            
            # 计算迭代次数和收敛状态
            result.iterations = ls_result.nfev
            result.convergence = ls_result.success
            
            # 计算残差
            final_residuals = self._residual_function(
                params, valid_stations, arrival_times_relative, arrival_weights
            )
            
            # 去除深度惩罚项（如果有）
            if self.depth_penalty > 0 and len(final_residuals) > len(valid_stations):
                final_residuals = final_residuals[:len(valid_stations)]
            
            result.residual = np.mean(np.abs(final_residuals))
            result.rms = np.sqrt(np.mean(final_residuals**2))
            
            # 计算各台站残差
            for i, station_id in enumerate(valid_station_ids):
                tt = self._calculate_travel_time(
                    result.x, result.y, result.z, valid_stations[i]
                )
                # 残差 = (t0 + tt) - 观测到时
                residual = (result.origin_time + tt) - arrival_times_relative[i]
                result.station_residuals[station_id] = residual
                result.station_arrivals[station_id] = arrival_times[i]  # 原始绝对到时
            
            # 计算方位角间隙
            result.azimuthal_gap = self._compute_azimuthal_gap(
                result.x, result.y, valid_stations
            )
            
            # 估计误差
            self._estimate_errors(
                result, valid_stations, arrival_times_relative, arrival_weights, params
            )
            
            # 计算绝对发震时刻（如果有波形信息）
            if waveforms is not None:
                # 找到最早到时的台站
                first_station_id = valid_station_ids[first_pick_idx]
                if first_station_id in waveforms:
                    first_waveform = waveforms[first_station_id]
                    if first_waveform.start_time is not None:
                        # 最早到时的绝对时间 = 波形起始时间 + pick_time
                        first_arrival_absolute = (
                            first_waveform.start_time + 
                            timedelta(seconds=arrival_times[first_pick_idx])
                        )
                        # 发震时刻 = 最早到时 - 走时
                        tt = self._calculate_travel_time(
                            result.x, result.y, result.z, first_station
                        )
                        result.absolute_origin_time = (
                            first_arrival_absolute - timedelta(seconds=tt)
                        )
            
            # 标记为有效
            result.is_valid = True
            
        except Exception as e:
            result.is_valid = False
            result.additional_info = f"定位失败: {str(e)}"
        
        # 计算质量评分
        result.calculate_quality_score()
        
        return result
    
    def locate_with_grid_search(self,
                                  stations: Dict[str, Station],
                                  pick_results: Dict[str, PickResult],
                                  waveforms: Optional[Dict[str, Waveform]] = None,
                                  event_id: str = "",
                                  grid_size: int = 20) -> LocationResult:
        """
        使用网格搜索法定位（用于获取初始解或验证）
        
        Args:
            stations: 台站字典
            pick_results: 拾取结果字典
            waveforms: 波形字典
            event_id: 事件ID
            grid_size: 网格大小
            
        Returns:
            定位结果
        """
        # 此方法作为备选，简单实现
        # 实际中使用 least_squares 更高效
        
        # 首先使用最小二乘法
        return self.locate(stations, pick_results, waveforms, event_id)


def locate_event(stations: Dict[str, Station],
                 pick_results: Dict[str, PickResult],
                 velocity_model: Optional[VelocityModel] = None,
                 waveforms: Optional[Dict[str, Waveform]] = None,
                 event_id: str = "") -> LocationResult:
    """
    便捷函数：定位微震事件
    
    Args:
        stations: 台站字典
        pick_results: 拾取结果字典
        velocity_model: 速度模型
        waveforms: 波形字典
        event_id: 事件ID
        
    Returns:
        定位结果
    """
    locator = EventLocator(velocity_model=velocity_model)
    return locator.locate(stations, pick_results, waveforms, event_id)
