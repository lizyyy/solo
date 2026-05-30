"""
声呐测距核心算法模块

包含声速修正公式、测距计算、物理边界定义。

公式参考：
- 水中声速与温度的经验公式（UNESCO标准，适用于淡水/海水常压环境）：
  c(T) = 1449.2 + 4.6*T - 0.055*T² + 0.00029*T³
  其中：c 为声速 (m/s)，T 为水温 (℃)

- 声呐测距原理（回波法）：
  d = c * t / 2
  其中：d 为目标距离 (m)，c 为声速 (m/s)，t 为回波时间 (s)
  除以 2 是因为声波往返传播

物理边界：
- 水温合理范围：-2℃ ~ 40℃（海水冰点约-2℃，实验环境极少超过40℃）
- 回波时间合理范围：0.001s ~ 10s（对应距离约0.7m ~ 7km）
- 声速合理范围：约1400 m/s ~ 1550 m/s（水温-2~40℃对应的理论范围）
- 目标距离合理范围：≥ 0 m（距离不能为负）
- 声速单位识别阈值：若计算值 < 200 且单位标记为 m/s，大概率是 km/h 单位填错
"""

from dataclasses import dataclass, field
from typing import Optional, List, Tuple
import math


# ===== 物理常量与边界 =====
class PhysicsBounds:
    """物理边界常量定义"""
    TEMP_MIN = -2.0
    TEMP_MAX = 40.0
    TIME_MIN = 0.001
    TIME_MAX = 10.0
    VELOCITY_MIN = 1400.0
    VELOCITY_MAX = 1550.0
    DISTANCE_MIN = 0.0
    VELOCITY_UNIT_THRESHOLD = 200.0
    FIELD_SWAP_THRESHOLD = 3.0


# ===== 声速计算 =====
def calculate_velocity(temperature: float) -> float:
    """
    根据水温计算水中声速
    
    公式：c(T) = 1449.2 + 4.6*T - 0.055*T² + 0.00029*T³
    
    Args:
        temperature: 水温 (℃)
        
    Returns:
        声速 (m/s)
        
    Raises:
        ValueError: 水温超出合理范围时提示（但仍计算）
    """
    if not (PhysicsBounds.TEMP_MIN <= temperature <= PhysicsBounds.TEMP_MAX):
        raise ValueError(
            f"水温 {temperature}℃ 超出合理范围 [{PhysicsBounds.TEMP_MIN}, {PhysicsBounds.TEMP_MAX}]℃，"
            f"声速计算结果可能不可靠"
        )
    
    velocity = 1449.2 + 4.6 * temperature - 0.055 * (temperature ** 2) + 0.00029 * (temperature ** 3)
    return round(velocity, 4)


# ===== 测距计算 =====
def calculate_distance(velocity: float, echo_time: float) -> float:
    """
    根据声速和回波时间计算目标距离
    
    公式：d = c * t / 2
    
    Args:
        velocity: 声速 (m/s)
        echo_time: 回波时间 (s)
        
    Returns:
        目标距离 (m)
        
    Raises:
        ValueError: 参数为负时抛出
    """
    if velocity <= 0:
        raise ValueError(f"声速必须为正值，当前值: {velocity} m/s")
    if echo_time <= 0:
        raise ValueError(f"回波时间必须为正值，当前值: {echo_time} s")
    
    distance = velocity * echo_time / 2.0
    return round(distance, 4)


# ===== 反向计算：根据距离和声速推算回波时间 =====
def calculate_echo_time(velocity: float, distance: float) -> float:
    """
    根据声速和目标距离反推回波时间（用于交叉验证）
    
    公式：t = 2*d / c
    
    Args:
        velocity: 声速 (m/s)
        distance: 目标距离 (m)
        
    Returns:
        回波时间 (s)
    """
    if velocity <= 0:
        raise ValueError(f"声速必须为正值，当前值: {velocity} m/s")
    if distance < 0:
        raise ValueError(f"目标距离不能为负，当前值: {distance} m")
    
    echo_time = 2.0 * distance / velocity
    return round(echo_time, 6)


# ===== 单位转换辅助 =====
def kmh_to_ms(kmh: float) -> float:
    """km/h 转 m/s"""
    return kmh * 1000.0 / 3600.0


def ms_to_kmh(ms: float) -> float:
    """m/s 转 km/h"""
    return ms * 3600.0 / 1000.0


# ===== 数据模型 =====
@dataclass
class SonarRecord:
    """单条声呐实验记录"""
    record_id: str
    source: str
    device_id: Optional[str] = None
    team: Optional[str] = None
    temperature: Optional[float] = None
    echo_time: Optional[float] = None
    measured_distance: Optional[float] = None
    raw_notes: Optional[str] = None
    
    # 计算字段
    calculated_velocity: Optional[float] = None
    calculated_distance: Optional[float] = None
    expected_echo_time: Optional[float] = None
    
    # 处理状态
    processing_steps: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    is_valid: bool = True
    
    def add_step(self, step: str) -> None:
        """记录处理步骤"""
        self.processing_steps.append(step)
    
    def add_error(self, error: str) -> None:
        """添加错误并标记为无效"""
        self.errors.append(error)
        self.is_valid = False
    
    def add_warning(self, warning: str) -> None:
        """添加警告（不影响有效性）"""
        self.warnings.append(warning)
    
    def to_dict(self) -> dict:
        """转换为字典用于导出"""
        return {
            "record_id": self.record_id,
            "source": self.source,
            "device_id": self.device_id,
            "team": self.team,
            "temperature": self.temperature,
            "echo_time": self.echo_time,
            "measured_distance": self.measured_distance,
            "raw_notes": self.raw_notes,
            "calculated_velocity": self.calculated_velocity,
            "calculated_distance": self.calculated_distance,
            "expected_echo_time": self.expected_echo_time,
            "processing_steps": self.processing_steps,
            "errors": self.errors,
            "warnings": self.warnings,
            "is_valid": self.is_valid
        }
