"""P波拾取模块 - 实现STA/LTA和简化阈值两种拾取方法"""

from typing import Dict, List, Optional, Tuple, Union
from dataclasses import dataclass, field

import numpy as np
from scipy import signal

from config import (
    DEFAULT_STA_WINDOW,
    DEFAULT_LTA_WINDOW,
    DEFAULT_STA_LTA_THRESHOLD,
    DEFAULT_THRESHOLD_MULTIPLIER
)
from data_loader import Waveform


@dataclass
class PickResult:
    """拾取结果类"""
    
    station_id: str
    method: str  # 'sta_lta' 或 'threshold'
    pick_idx: Optional[int] = None
    pick_time: Optional[float] = None  # 相对于波形起始时间的秒数
    pick_quality: float = 0.0  # 0.0 ~ 1.0
    confidence: float = 0.0  # 置信度
    
    # 辅助信息
    pre_noise_level: float = 0.0  # 拾取前噪声水平
    post_signal_level: float = 0.0  # 拾取后信号水平
    snr: float = 0.0  # 信噪比
    
    # 可选：原始拾取曲线数据
    sta_lta_curve: Optional[np.ndarray] = field(default=None, repr=False)
    threshold_curve: Optional[np.ndarray] = field(default=None, repr=False)
    
    def is_valid(self) -> bool:
        """检查拾取是否有效"""
        return self.pick_idx is not None and self.pick_idx >= 0
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'station_id': self.station_id,
            'method': self.method,
            'pick_idx': self.pick_idx,
            'pick_time': self.pick_time,
            'pick_quality': self.pick_quality,
            'confidence': self.confidence,
            'pre_noise_level': self.pre_noise_level,
            'post_signal_level': self.post_signal_level,
            'snr': self.snr,
            'is_valid': self.is_valid()
        }


class STALTAPicker:
    """STA/LTA 拾取器"""
    
    def __init__(self,
                 sta_window: float = DEFAULT_STA_WINDOW,
                 lta_window: float = DEFAULT_LTA_WINDOW,
                 threshold: float = DEFAULT_STA_LTA_THRESHOLD,
                 trigger_on: float = None,
                 trigger_off: float = None):
        """
        初始化STA/LTA拾取器
        
        Args:
            sta_window: STA窗口长度（秒）
            lta_window: LTA窗口长度（秒）
            threshold: 触发阈值（STA/LTA比值）
            trigger_on: 触发上线（默认等于threshold）
            trigger_off: 触发下线（默认等于threshold * 0.5）
        """
        self.sta_window = sta_window
        self.lta_window = lta_window
        self.threshold = threshold
        self.trigger_on = trigger_on if trigger_on is not None else threshold
        self.trigger_off = trigger_off if trigger_off is not None else threshold * 0.5
    
    def _compute_envelope(self, data: np.ndarray) -> np.ndarray:
        """
        计算信号包络（使用绝对值）
        
        Args:
            data: 输入数据
            
        Returns:
            包络数据
        """
        return np.abs(data)
    
    def _compute_sta_lta(self, data: np.ndarray, dt: float) -> np.ndarray:
        """
        计算STA/LTA比值曲线
        
        Args:
            data: 输入数据
            dt: 采样间隔（秒）
            
        Returns:
            STA/LTA比值数组
        """
        n_samples = len(data)
        sta_samples = int(self.sta_window / dt)
        lta_samples = int(self.lta_window / dt)
        
        # 确保窗口大小合理
        sta_samples = max(1, sta_samples)
        lta_samples = max(sta_samples + 1, lta_samples)
        
        # 计算包络
        envelope = self._compute_envelope(data)
        
        # 计算累计和用于高效计算移动平均
        cumsum = np.cumsum(envelope)
        
        # 计算STA
        sta = np.zeros(n_samples)
        if sta_samples > 0:
            sta[sta_samples:] = (cumsum[sta_samples:] - cumsum[:-sta_samples]) / sta_samples
            # 前几个样本使用可用数据
            for i in range(sta_samples):
                if i > 0:
                    sta[i] = cumsum[i] / (i + 1)
                else:
                    sta[i] = envelope[0]
        
        # 计算LTA
        lta = np.zeros(n_samples)
        if lta_samples > 0:
            lta[lta_samples:] = (cumsum[lta_samples:] - cumsum[:-lta_samples]) / lta_samples
            for i in range(lta_samples):
                if i > 0:
                    lta[i] = cumsum[i] / (i + 1)
                else:
                    lta[i] = envelope[0]
        
        # 避免除以零
        lta_safe = np.where(lta > 0, lta, np.finfo(float).eps)
        
        # 计算STA/LTA比值
        sta_lta = sta / lta_safe
        
        # 平滑处理
        sta_lta = signal.medfilt(sta_lta, kernel_size=3)
        
        return sta_lta
    
    def pick(self, waveform: Waveform) -> PickResult:
        """
        对波形进行P波拾取
        
        Args:
            waveform: 波形对象
            
        Returns:
            拾取结果
        """
        result = PickResult(
            station_id=waveform.station_id,
            method='sta_lta'
        )
        
        if len(waveform.data) == 0 or waveform.dt <= 0:
            result.pick_quality = 0.0
            result.confidence = 0.0
            return result
        
        data = waveform.data
        dt = waveform.dt
        n_samples = len(data)
        
        # 计算STA/LTA曲线
        sta_lta = self._compute_sta_lta(data, dt)
        result.sta_lta_curve = sta_lta
        
        # 查找第一次超过阈值的位置
        # 跳过开头不稳定的部分
        lta_samples = int(self.lta_window / dt)
        start_idx = lta_samples + 1
        
        if start_idx >= n_samples:
            result.pick_quality = 0.0
            result.confidence = 0.0
            return result
        
        # 查找触发点
        trigger_indices = np.where(sta_lta[start_idx:] >= self.trigger_on)[0]
        
        if len(trigger_indices) == 0:
            # 没有找到明显的触发点，尝试查找最大值
            max_idx = np.argmax(sta_lta[start_idx:])
            pick_idx = start_idx + max_idx
            
            # 如果最大值也很低，认为拾取质量差
            if sta_lta[pick_idx] < self.trigger_on * 0.5:
                result.pick_idx = None
                result.pick_quality = 0.0
                result.confidence = 0.0
                return result
        else:
            # 找到第一个触发点，然后向前查找更精确的起点
            first_trigger = start_idx + trigger_indices[0]
            
            # 向前查找，直到STA/LTA下降到trigger_off以下
            # 找到精确的起点位置
            pick_idx = first_trigger
            for i in range(first_trigger, max(0, first_trigger - 50), -1):
                if sta_lta[i] < self.trigger_off:
                    pick_idx = i + 1
                    break
                pick_idx = i
        
        # 确定最终拾取位置
        result.pick_idx = pick_idx
        result.pick_time = pick_idx * dt
        
        # 计算拾取质量和置信度
        # 使用STA/LTA峰值和SNR来评估
        
        # 1. 计算噪声水平（拾取前）
        noise_end_idx = max(0, pick_idx - int(0.1 / dt))
        noise_start_idx = max(0, noise_end_idx - int(0.5 / dt))
        
        if noise_start_idx < noise_end_idx:
            noise_data = data[noise_start_idx:noise_end_idx]
            result.pre_noise_level = np.std(noise_data) if len(noise_data) > 0 else 0.0
        
        # 2. 计算信号水平（拾取后）
        signal_start_idx = pick_idx
        signal_end_idx = min(n_samples, pick_idx + int(0.3 / dt))
        
        if signal_start_idx < signal_end_idx:
            signal_data = data[signal_start_idx:signal_end_idx]
            result.post_signal_level = np.std(signal_data) if len(signal_data) > 0 else 0.0
        
        # 3. 计算SNR
        if result.pre_noise_level > 0:
            result.snr = result.post_signal_level / result.pre_noise_level
        else:
            result.snr = 10.0 if result.post_signal_level > 0 else 0.0
        
        # 4. 计算质量指标（综合STA/LTA峰值和SNR）
        sta_lta_peak = np.max(sta_lta[pick_idx:min(n_samples, pick_idx + 100)])
        
        # 归一化STA/LTA质量
        sta_lta_quality = min(1.0, sta_lta_peak / (self.threshold * 2))
        
        # 归一化SNR质量
        snr_quality = min(1.0, result.snr / 10.0)
        
        # 综合质量
        result.pick_quality = (sta_lta_quality * 0.6 + snr_quality * 0.4)
        
        # 置信度
        confidence_factors = []
        
        # 拾取位置不能太靠近边缘
        if pick_idx > lta_samples and pick_idx < n_samples - 100:
            confidence_factors.append(1.0)
        else:
            confidence_factors.append(0.5)
        
        # STA/LTA峰值
        if sta_lta_peak >= self.threshold * 1.5:
            confidence_factors.append(1.0)
        elif sta_lta_peak >= self.threshold:
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.3)
        
        # SNR
        if result.snr >= 10:
            confidence_factors.append(1.0)
        elif result.snr >= 3:
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.3)
        
        result.confidence = np.mean(confidence_factors)
        
        return result


class ThresholdPicker:
    """简化阈值拾取器"""
    
    def __init__(self,
                 threshold_multiplier: float = DEFAULT_THRESHOLD_MULTIPLIER,
                 noise_window: float = 0.5,  # 噪声估计窗口（秒）
                 min_signal_duration: float = 0.01):  # 最小信号持续时间（秒）
        """
        初始化阈值拾取器
        
        Args:
            threshold_multiplier: 阈值倍数（相对于噪声水平）
            noise_window: 用于估计噪声的窗口长度（秒）
            min_signal_duration: 最小信号持续时间（秒）
        """
        self.threshold_multiplier = threshold_multiplier
        self.noise_window = noise_window
        self.min_signal_duration = min_signal_duration
    
    def pick(self, waveform: Waveform) -> PickResult:
        """
        对波形进行P波拾取
        
        Args:
            waveform: 波形对象
            
        Returns:
            拾取结果
        """
        result = PickResult(
            station_id=waveform.station_id,
            method='threshold'
        )
        
        if len(waveform.data) == 0 or waveform.dt <= 0:
            result.pick_quality = 0.0
            result.confidence = 0.0
            return result
        
        data = waveform.data
        dt = waveform.dt
        n_samples = len(data)
        
        # 1. 估计噪声水平（使用前noise_window秒的数据）
        noise_samples = int(self.noise_window / dt)
        noise_samples = min(noise_samples, n_samples // 4)  # 最多使用1/4的数据
        noise_samples = max(10, noise_samples)
        
        if noise_samples < n_samples:
            noise_data = data[:noise_samples]
            noise_level = np.std(noise_data)
        else:
            noise_level = np.std(data) * 0.5
        
        result.pre_noise_level = noise_level
        
        # 2. 计算阈值
        threshold = noise_level * self.threshold_multiplier
        
        # 3. 计算包络
        envelope = np.abs(data)
        
        # 4. 平滑包络
        smooth_samples = max(1, int(0.01 / dt))  # 10ms平滑
        # 确保 kernel_size 是奇数（medfilt要求）
        if smooth_samples % 2 == 0:
            smooth_samples += 1
        if smooth_samples > 1:
            envelope = signal.medfilt(envelope, kernel_size=smooth_samples)
        
        result.threshold_curve = envelope
        
        # 5. 查找超过阈值的位置
        # 跳过开头的噪声估计窗口
        start_idx = noise_samples
        
        if start_idx >= n_samples:
            result.pick_quality = 0.0
            result.confidence = 0.0
            return result
        
        # 查找所有超过阈值的点
        above_threshold = envelope[start_idx:] >= threshold
        trigger_indices = np.where(above_threshold)[0]
        
        if len(trigger_indices) == 0:
            # 没有找到超过阈值的点，使用最大值
            max_idx = np.argmax(envelope[start_idx:])
            pick_idx = start_idx + max_idx
            
            if envelope[pick_idx] < threshold * 0.5:
                result.pick_idx = None
                result.pick_quality = 0.0
                result.confidence = 0.0
                return result
        else:
            # 验证信号持续时间
            min_duration_samples = int(self.min_signal_duration / dt)
            
            # 找到第一个有效的触发（持续时间足够长）
            pick_idx = None
            for trigger_start in trigger_indices:
                abs_idx = start_idx + trigger_start
                
                # 检查后续是否有足够多的点也超过阈值
                end_check = min(n_samples, abs_idx + min_duration_samples)
                if end_check - abs_idx < min_duration_samples:
                    continue
                
                consecutive_above = np.sum(envelope[abs_idx:end_check] >= threshold)
                if consecutive_above >= min_duration_samples * 0.7:
                    # 向前查找更精确的起点
                    for i in range(abs_idx, max(0, abs_idx - 50), -1):
                        if envelope[i] < threshold * 0.5:
                            pick_idx = i + 1
                            break
                        pick_idx = i
                    break
            
            if pick_idx is None:
                # 没有找到持续足够长的信号，使用第一个触发点
                pick_idx = start_idx + trigger_indices[0]
        
        result.pick_idx = pick_idx
        result.pick_time = pick_idx * dt
        
        # 6. 计算信号水平和SNR
        signal_start_idx = pick_idx
        signal_end_idx = min(n_samples, pick_idx + int(0.3 / dt))
        
        if signal_start_idx < signal_end_idx:
            signal_data = data[signal_start_idx:signal_end_idx]
            result.post_signal_level = np.std(signal_data) if len(signal_data) > 0 else 0.0
        
        if result.pre_noise_level > 0:
            result.snr = result.post_signal_level / result.pre_noise_level
        else:
            result.snr = 10.0 if result.post_signal_level > 0 else 0.0
        
        # 7. 计算质量指标
        # 峰值与阈值的比值
        peak_envelope = np.max(envelope[pick_idx:min(n_samples, pick_idx + 100)])
        threshold_ratio = peak_envelope / threshold if threshold > 0 else 0.0
        
        # 归一化质量
        threshold_quality = min(1.0, threshold_ratio / 5.0)
        snr_quality = min(1.0, result.snr / 10.0)
        
        result.pick_quality = (threshold_quality * 0.6 + snr_quality * 0.4)
        
        # 8. 计算置信度
        confidence_factors = []
        
        # 拾取位置
        if pick_idx > noise_samples and pick_idx < n_samples - 100:
            confidence_factors.append(1.0)
        else:
            confidence_factors.append(0.5)
        
        # 阈值比值
        if threshold_ratio >= 5.0:
            confidence_factors.append(1.0)
        elif threshold_ratio >= self.threshold_multiplier:
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.3)
        
        # SNR
        if result.snr >= 10:
            confidence_factors.append(1.0)
        elif result.snr >= 3:
            confidence_factors.append(0.7)
        else:
            confidence_factors.append(0.3)
        
        result.confidence = np.mean(confidence_factors)
        
        return result


class PWavePicker:
    """综合P波拾取器 - 支持多种方法"""
    
    PICK_METHODS = ['sta_lta', 'threshold']
    
    def __init__(self,
                 method: str = 'sta_lta',
                 sta_window: float = DEFAULT_STA_WINDOW,
                 lta_window: float = DEFAULT_LTA_WINDOW,
                 sta_lta_threshold: float = DEFAULT_STA_LTA_THRESHOLD,
                 threshold_multiplier: float = DEFAULT_THRESHOLD_MULTIPLIER):
        """
        初始化P波拾取器
        
        Args:
            method: 拾取方法 ('sta_lta' 或 'threshold')
            sta_window: STA窗口长度（秒）
            lta_window: LTA窗口长度（秒）
            sta_lta_threshold: STA/LTA触发阈值
            threshold_multiplier: 阈值方法的倍数
        """
        self.method = method.lower()
        
        if self.method not in self.PICK_METHODS:
            raise ValueError(f"不支持的拾取方法: {method}，可用方法: {self.PICK_METHODS}")
        
        # 初始化具体的拾取器
        self.sta_lta_picker = STALTAPicker(
            sta_window=sta_window,
            lta_window=lta_window,
            threshold=sta_lta_threshold
        )
        
        self.threshold_picker = ThresholdPicker(
            threshold_multiplier=threshold_multiplier
        )
    
    def pick(self, waveform: Waveform, method: Optional[str] = None) -> PickResult:
        """
        对波形进行P波拾取
        
        Args:
            waveform: 波形对象
            method: 可选，覆盖初始化时的方法
            
        Returns:
            拾取结果
        """
        pick_method = method.lower() if method else self.method
        
        if pick_method == 'sta_lta':
            return self.sta_lta_picker.pick(waveform)
        elif pick_method == 'threshold':
            return self.threshold_picker.pick(waveform)
        else:
            raise ValueError(f"不支持的拾取方法: {pick_method}")
    
    def pick_all(self, waveforms: Dict[str, Waveform],
                 method: Optional[str] = None) -> Dict[str, PickResult]:
        """
        对多个波形进行批量拾取
        
        Args:
            waveforms: 波形字典 {station_id: Waveform}
            method: 可选，覆盖初始化时的方法
            
        Returns:
            拾取结果字典 {station_id: PickResult}
        """
        results = {}
        for station_id, waveform in waveforms.items():
            if waveform.is_valid:
                results[station_id] = self.pick(waveform, method)
            else:
                # 创建无效结果
                results[station_id] = PickResult(
                    station_id=station_id,
                    method=method or self.method,
                    pick_quality=0.0,
                    confidence=0.0
                )
        return results


def auto_pick(waveform: Waveform, 
              preferred_method: str = 'sta_lta') -> PickResult:
    """
    自动拾取函数 - 便捷接口
    
    Args:
        waveform: 波形对象
        preferred_method: 首选方法
        
    Returns:
        拾取结果
    """
    picker = PWavePicker(method=preferred_method)
    return picker.pick(waveform)
