"""核心计算模块 - 包含铁路货运预检的主要计算逻辑"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
from enum import Enum

from .utils import parse_weight, parse_length, safe_float, validate_required_fields


class IssueLevel(Enum):
    """问题级别枚举"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class Issue:
    """问题数据类"""
    level: IssueLevel
    category: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Cargo:
    """货物数据类"""
    id: str
    name: str
    weight: float  # 单位：kg
    length: float = 0.0  # 单位：mm
    width: float = 0.0  # 单位：mm
    height: float = 0.0  # 单位：mm
    x_position: float = 0.0  # 纵向位置（从车辆前端，单位：mm）
    y_position: float = 0.0  # 横向位置（从车辆中心线，单位：mm，正值为右侧）
    z_position: float = 0.0  # 垂向位置（从车辆地板，单位：mm）
    is_dangerous: bool = False
    dangerous_category: Optional[str] = None
    dangerous_class: Optional[str] = None


@dataclass
class Vehicle:
    """车辆数据类"""
    id: str
    type: str
    tare_weight: float  # 自重，单位：kg
    max_load_weight: float  # 最大载重，单位：kg
    length: float  # 车辆长度，单位：mm
    width: float  # 车辆宽度，单位：mm
    height_limit: float  # 高度限制，单位：mm
    axle_count: int  # 轴数
    wheelbase: float  # 轴距，单位：mm
    center_of_gravity_x: float = 0.0  # 车辆自身纵向重心，单位：mm（从前端）


@dataclass
class LoadingPlan:
    """装载方案数据类"""
    vehicle_id: str
    cargo_items: List[Dict[str, Any]]
    total_weight: float = 0.0  # 单位：kg


@dataclass
class RuleConfig:
    """规则配置数据类"""
    max_longitudinal_offset: float  # 最大纵向重心偏移，单位：mm
    max_lateral_offset: float  # 最大横向重心偏移，单位：mm
    min_dangerous_goods_distance: float  # 危险品最小隔离距离，单位：mm
    axle_weight_tolerance: float  # 轴重容差比例，如 0.05 表示 5%
    over_weight_warning_threshold: float  # 超重警告阈值比例，如 0.9 表示 90%
    over_weight_error_threshold: float  # 超重错误阈值比例，如 1.0 表示 100%
    height_limit_tolerance: float  # 高度限制容差，单位：mm
    width_limit_tolerance: float  # 宽度限制容差，单位：mm


@dataclass
class CalculationResult:
    """计算结果数据类"""
    total_weight: float  # 总重量（车辆自重+货物），单位：kg
    cargo_weight: float  # 货物总重量，单位：kg
    weight_utilization: float  # 重量利用率（百分比）
    longitudinal_center_of_gravity: float  # 纵向重心位置，单位：mm（从车辆前端）
    lateral_center_of_gravity: float  # 横向重心位置，单位：mm（从车辆中心线）
    longitudinal_offset: float  # 纵向重心偏移，单位：mm
    lateral_offset: float  # 横向重心偏移，单位：mm
    estimated_axle_weights: List[float]  # 估算的轴重，单位：kg
    max_height: float  # 最大装载高度，单位：mm
    max_width: float  # 最大装载宽度，单位：mm
    issues: List[Issue]  # 发现的问题列表


class LoadingCalculator:
    """装载计算类"""
    
    def __init__(self, 
                 vehicle: Vehicle, 
                 cargos: List[Cargo], 
                 rules: RuleConfig):
        """
        初始化装载计算器
        
        Args:
            vehicle: 车辆数据
            cargos: 货物列表
            rules: 规则配置
        """
        self.vehicle = vehicle
        self.cargos = cargos
        self.rules = rules
        self.issues: List[Issue] = []
    
    def calculate(self) -> CalculationResult:
        """
        执行所有计算并返回结果
        
        Returns:
            CalculationResult: 计算结果
        """
        # 计算重量
        cargo_weight = self._calculate_cargo_weight()
        total_weight = self.vehicle.tare_weight + cargo_weight
        weight_utilization = (cargo_weight / self.vehicle.max_load_weight) * 100
        
        # 计算重心
        longitudinal_cg, lateral_cg = self._calculate_center_of_gravity(cargo_weight)
        
        # 计算重心偏移
        longitudinal_offset, lateral_offset = self._calculate_offset(
            longitudinal_cg, lateral_cg
        )
        
        # 估算轴重
        estimated_axle_weights = self._estimate_axle_weights(
            total_weight, longitudinal_cg
        )
        
        # 计算尺寸限制
        max_height, max_width = self._calculate_max_dimensions()
        
        # 检查各种限制
        self._check_weight(cargo_weight)
        self._check_center_of_gravity_offset(longitudinal_offset, lateral_offset)
        self._check_dangerous_goods_isolation()
        self._check_clearance(max_height, max_width)
        self._check_missing_cargo_dimensions()
        
        return CalculationResult(
            total_weight=total_weight,
            cargo_weight=cargo_weight,
            weight_utilization=weight_utilization,
            longitudinal_center_of_gravity=longitudinal_cg,
            lateral_center_of_gravity=lateral_cg,
            longitudinal_offset=longitudinal_offset,
            lateral_offset=lateral_offset,
            estimated_axle_weights=estimated_axle_weights,
            max_height=max_height,
            max_width=max_width,
            issues=self.issues
        )
    
    def _calculate_cargo_weight(self) -> float:
        """计算货物总重量"""
        return sum(cargo.weight for cargo in self.cargos)
    
    def _calculate_center_of_gravity(self, total_cargo_weight: float) -> Tuple[float, float]:
        """
        计算综合重心位置
        
        Args:
            total_cargo_weight: 货物总重量
            
        Returns:
            Tuple[float, float]: (纵向重心, 横向重心)，单位：mm
        """
        if total_cargo_weight == 0:
            # 没有货物时，使用车辆自身重心
            return self.vehicle.center_of_gravity_x, 0.0
        
        # 计算货物重心
        longitudinal_moment = sum(
            cargo.weight * (cargo.x_position + cargo.length / 2)
            for cargo in self.cargos
        )
        lateral_moment = sum(
            cargo.weight * cargo.y_position
            for cargo in self.cargos
        )
        
        cargo_longitudinal_cg = longitudinal_moment / total_cargo_weight
        cargo_lateral_cg = lateral_moment / total_cargo_weight
        
        # 综合车辆和货物的重心
        total_weight = self.vehicle.tare_weight + total_cargo_weight
        
        total_longitudinal_moment = (
            self.vehicle.tare_weight * self.vehicle.center_of_gravity_x +
            total_cargo_weight * cargo_longitudinal_cg
        )
        
        # 车辆横向重心默认在中心线（0）
        total_lateral_moment = total_cargo_weight * cargo_lateral_cg
        
        total_longitudinal_cg = total_longitudinal_moment / total_weight
        total_lateral_cg = total_lateral_moment / total_weight
        
        return total_longitudinal_cg, total_lateral_cg
    
    def _calculate_offset(self, 
                          longitudinal_cg: float, 
                          lateral_cg: float) -> Tuple[float, float]:
        """
        计算重心偏移
        
        Args:
            longitudinal_cg: 纵向重心位置
            lateral_cg: 横向重心位置
            
        Returns:
            Tuple[float, float]: (纵向偏移, 横向偏移)，单位：mm
        """
        # 车辆纵向中心位置
        vehicle_longitudinal_center = self.vehicle.length / 2
        
        # 计算偏移（相对于中心）
        longitudinal_offset = longitudinal_cg - vehicle_longitudinal_center
        lateral_offset = lateral_cg  # 横向偏移已经是相对于中心线的
        
        return longitudinal_offset, lateral_offset
    
    def _estimate_axle_weights(self, 
                                total_weight: float, 
                                longitudinal_cg: float) -> List[float]:
        """
        估算轴重（简化模型）
        
        Args:
            total_weight: 总重量
            longitudinal_cg: 纵向重心位置
            
        Returns:
            List[float]: 各轴的估算重量
        """
        if self.vehicle.axle_count < 2:
            return [total_weight]
        
        # 简化的轴重估算模型
        # 假设轴均匀分布，根据重心位置计算各轴载重
        
        axle_weights = []
        total_axle_length = self.vehicle.wheelbase * (self.vehicle.axle_count - 1)
        
        # 计算各轴位置（从车辆前端开始）
        axle_positions = [
            (self.vehicle.length - total_axle_length) / 2 + i * self.vehicle.wheelbase
            for i in range(self.vehicle.axle_count)
        ]
        
        # 使用简化的杠杆原理计算轴重
        # 这是一个近似模型，实际情况需要更复杂的计算
        
        # 计算距离重心的距离
        distances_from_cg = [abs(pos - longitudinal_cg) for pos in axle_positions]
        total_distance = sum(distances_from_cg)
        
        if total_distance == 0:
            # 重心正好在所有轴的中心（理论上不可能）
            axle_weights = [total_weight / self.vehicle.axle_count] * self.vehicle.axle_count
        else:
            # 距离越远，承担的重量越少（简化模型）
            inverse_distances = [1 / (d + 1) for d in distances_from_cg]
            total_inverse = sum(inverse_distances)
            
            axle_weights = [
                total_weight * (inv / total_inverse)
                for inv in inverse_distances
            ]
        
        return axle_weights
    
    def _calculate_max_dimensions(self) -> Tuple[float, float]:
        """
        计算最大装载尺寸
        
        Returns:
            Tuple[float, float]: (最大高度, 最大宽度)，单位：mm
        """
        if not self.cargos:
            return 0.0, 0.0
        
        max_height = max(
            cargo.z_position + cargo.height
            for cargo in self.cargos
        )
        
        max_width = max(
            abs(cargo.y_position) + cargo.width / 2
            for cargo in self.cargos
        )
        
        return max_height, max_width
    
    def _check_weight(self, cargo_weight: float):
        """检查重量限制"""
        max_load = self.vehicle.max_load_weight
        
        # 检查超重
        if cargo_weight > max_load * self.rules.over_weight_error_threshold:
            self.issues.append(Issue(
                level=IssueLevel.ERROR,
                category="weight",
                message=f"货物超重：{cargo_weight:.2f}kg > 限重 {max_load:.2f}kg",
                details={
                    "cargo_weight": cargo_weight,
                    "max_load": max_load,
                    "over_weight": cargo_weight - max_load
                }
            ))
        elif cargo_weight > max_load * self.rules.over_weight_warning_threshold:
            self.issues.append(Issue(
                level=IssueLevel.WARNING,
                category="weight",
                message=f"货物重量接近限重：{cargo_weight:.2f}kg (已达 {(cargo_weight/max_load*100):.1f}%)",
                details={
                    "cargo_weight": cargo_weight,
                    "max_load": max_load,
                    "utilization": cargo_weight / max_load * 100
                }
            ))
    
    def _check_center_of_gravity_offset(self, 
                                          longitudinal_offset: float, 
                                          lateral_offset: float):
        """检查重心偏移"""
        # 检查纵向偏移
        if abs(longitudinal_offset) > self.rules.max_longitudinal_offset:
            self.issues.append(Issue(
                level=IssueLevel.ERROR,
                category="center_of_gravity",
                message=f"纵向重心偏移超标：{longitudinal_offset:.2f}mm > 允许值 {self.rules.max_longitudinal_offset:.2f}mm",
                details={
                    "actual_offset": longitudinal_offset,
                    "allowed_offset": self.rules.max_longitudinal_offset
                }
            ))
        
        # 检查横向偏移
        if abs(lateral_offset) > self.rules.max_lateral_offset:
            self.issues.append(Issue(
                level=IssueLevel.ERROR,
                category="center_of_gravity",
                message=f"横向重心偏移超标：{lateral_offset:.2f}mm > 允许值 {self.rules.max_lateral_offset:.2f}mm",
                details={
                    "actual_offset": lateral_offset,
                    "allowed_offset": self.rules.max_lateral_offset
                }
            ))
    
    def _check_dangerous_goods_isolation(self):
        """检查危险品隔离"""
        dangerous_cargos = [
            cargo for cargo in self.cargos 
            if cargo.is_dangerous
        ]
        
        if len(dangerous_cargos) < 2:
            return  # 少于2件危险品，不需要检查隔离
        
        # 检查每对危险品之间的距离
        for i, cargo1 in enumerate(dangerous_cargos):
            for cargo2 in dangerous_cargos[i+1:]:
                # 计算中心距离（简化为纵向距离）
                distance = abs(
                    (cargo1.x_position + cargo1.length / 2) - 
                    (cargo2.x_position + cargo2.length / 2)
                )
                
                # 检查是否是不同类别的危险品（简化判断）
                different_category = (
                    cargo1.dangerous_category != cargo2.dangerous_category
                    if cargo1.dangerous_category and cargo2.dangerous_category
                    else True
                )
                
                if different_category and distance < self.rules.min_dangerous_goods_distance:
                    self.issues.append(Issue(
                        level=IssueLevel.ERROR,
                        category="dangerous_goods",
                        message=f"危险品 '{cargo1.name}' 和 '{cargo2.name}' 隔离距离不足：{distance:.2f}mm < 要求 {self.rules.min_dangerous_goods_distance:.2f}mm",
                        details={
                            "cargo1": cargo1.id,
                            "cargo2": cargo2.id,
                            "actual_distance": distance,
                            "required_distance": self.rules.min_dangerous_goods_distance
                        }
                    ))
    
    def _check_clearance(self, max_height: float, max_width: float):
        """检查限界"""
        # 检查高度
        if max_height > self.vehicle.height_limit + self.rules.height_limit_tolerance:
            self.issues.append(Issue(
                level=IssueLevel.ERROR,
                category="clearance",
                message=f"装载高度超标：{max_height:.2f}mm > 限高 {self.vehicle.height_limit:.2f}mm",
                details={
                    "actual_height": max_height,
                    "limit_height": self.vehicle.height_limit,
                    "over_height": max_height - self.vehicle.height_limit
                }
            ))
        
        # 检查宽度
        if max_width > self.vehicle.width / 2 + self.rules.width_limit_tolerance:
            self.issues.append(Issue(
                level=IssueLevel.ERROR,
                category="clearance",
                message=f"装载宽度超标：{max_width * 2:.2f}mm > 限宽 {self.vehicle.width:.2f}mm",
                details={
                    "actual_width": max_width * 2,
                    "limit_width": self.vehicle.width,
                    "over_width": max_width * 2 - self.vehicle.width
                }
            ))
    
    def _check_missing_cargo_dimensions(self):
        """检查缺少货物尺寸的情况"""
        for cargo in self.cargos:
            missing_fields = []
            
            if cargo.length <= 0:
                missing_fields.append("长度")
            if cargo.width <= 0:
                missing_fields.append("宽度")
            if cargo.height <= 0:
                missing_fields.append("高度")
            
            if missing_fields:
                self.issues.append(Issue(
                    level=IssueLevel.WARNING,
                    category="cargo_data",
                    message=f"货物 '{cargo.name}' 缺少尺寸信息：{', '.join(missing_fields)}",
                    details={
                        "cargo_id": cargo.id,
                        "missing_fields": missing_fields
                    }
                ))
