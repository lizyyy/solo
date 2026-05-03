"""数据加载模块 - 用于读取各种配置文件格式"""

import csv
import json
import os
from typing import Dict, List, Any, Optional
from pathlib import Path

import yaml

from .utils import parse_weight, parse_length, safe_float
from .calculator import (
    Vehicle, Cargo, RuleConfig, LoadingPlan,
    Issue, IssueLevel
)


class DataLoader:
    """数据加载器类"""
    
    def __init__(self):
        """初始化数据加载器"""
        self.issues: List[Issue] = []
    
    def load_vehicles_from_csv(self, file_path: str) -> Dict[str, Vehicle]:
        """
        从CSV文件加载车辆参数
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            Dict[str, Vehicle]: 车辆ID到车辆对象的映射
        """
        vehicles = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    try:
                        # 解析车辆参数
                        vehicle_id = row.get('id', '').strip()
                        if not vehicle_id:
                            self._add_warning(
                                "data_loader",
                                "跳过缺少ID的车辆记录",
                                {"row": row}
                            )
                            continue
                        
                        # 解析重量（支持kg和t单位）
                        tare_weight, _ = parse_weight(row.get('tare_weight', 0))
                        max_load_weight, _ = parse_weight(row.get('max_load_weight', 0))
                        
                        # 解析长度（支持mm、cm、m单位）
                        length, _ = parse_length(row.get('length', 0))
                        width, _ = parse_length(row.get('width', 0))
                        height_limit, _ = parse_length(row.get('height_limit', 0))
                        wheelbase, _ = parse_length(row.get('wheelbase', 0))
                        
                        # 解析其他参数
                        axle_count = int(row.get('axle_count', 4))
                        center_of_gravity_x, _ = parse_length(
                            row.get('center_of_gravity_x', length / 2)
                        )
                        
                        vehicle = Vehicle(
                            id=vehicle_id,
                            type=row.get('type', 'unknown').strip(),
                            tare_weight=tare_weight,
                            max_load_weight=max_load_weight,
                            length=length,
                            width=width,
                            height_limit=height_limit,
                            axle_count=axle_count,
                            wheelbase=wheelbase,
                            center_of_gravity_x=center_of_gravity_x
                        )
                        
                        vehicles[vehicle_id] = vehicle
                        
                    except Exception as e:
                        self._add_error(
                            "data_loader",
                            f"解析车辆记录失败: {str(e)}",
                            {"row": row, "error": str(e)}
                        )
                        
        except FileNotFoundError:
            self._add_error(
                "data_loader",
                f"车辆参数文件不存在: {file_path}",
                {"file_path": file_path}
            )
            raise
        
        except Exception as e:
            self._add_error(
                "data_loader",
                f"读取车辆参数文件失败: {str(e)}",
                {"file_path": file_path, "error": str(e)}
            )
            raise
        
        return vehicles
    
    def load_cargo_from_json(self, file_path: str) -> Dict[str, Cargo]:
        """
        从JSON文件加载货物尺寸重量
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            Dict[str, Cargo]: 货物ID到货物对象的映射
        """
        cargos = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 支持两种格式：直接的列表或包含"cargos"键的对象
            cargo_list = data if isinstance(data, list) else data.get('cargos', [])
            
            for item in cargo_list:
                try:
                    cargo_id = item.get('id', '').strip()
                    if not cargo_id:
                        self._add_warning(
                            "data_loader",
                            "跳过缺少ID的货物记录",
                            {"item": item}
                        )
                        continue
                    
                    # 解析重量（支持kg和t单位）
                    weight, _ = parse_weight(item.get('weight', 0))
                    
                    # 解析尺寸（支持mm、cm、m单位）
                    length, _ = parse_length(item.get('length', 0))
                    width, _ = parse_length(item.get('width', 0))
                    height, _ = parse_length(item.get('height', 0))
                    
                    # 解析危险品信息
                    is_dangerous = item.get('is_dangerous', False)
                    dangerous_category = item.get('dangerous_category')
                    dangerous_class = item.get('dangerous_class')
                    
                    cargo = Cargo(
                        id=cargo_id,
                        name=item.get('name', cargo_id).strip(),
                        weight=weight,
                        length=length,
                        width=width,
                        height=height,
                        is_dangerous=is_dangerous,
                        dangerous_category=dangerous_category,
                        dangerous_class=dangerous_class
                    )
                    
                    cargos[cargo_id] = cargo
                    
                except Exception as e:
                    self._add_error(
                        "data_loader",
                        f"解析货物记录失败: {str(e)}",
                        {"item": item, "error": str(e)}
                    )
                    
        except FileNotFoundError:
            self._add_error(
                "data_loader",
                f"货物数据文件不存在: {file_path}",
                {"file_path": file_path}
            )
            raise
        
        except Exception as e:
            self._add_error(
                "data_loader",
                f"读取货物数据文件失败: {str(e)}",
                {"file_path": file_path, "error": str(e)}
            )
            raise
        
        return cargos
    
    def load_loading_plan_from_yaml(self, file_path: str) -> LoadingPlan:
        """
        从YAML文件加载装载方案
        
        Args:
            file_path: YAML文件路径
            
        Returns:
            LoadingPlan: 装载方案对象
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            # 解析装载方案
            vehicle_id = data.get('vehicle_id', '').strip()
            if not vehicle_id:
                self._add_error(
                    "data_loader",
                    "装载方案中缺少车辆ID",
                    {"file_path": file_path}
                )
                raise ValueError("装载方案中缺少车辆ID")
            
            cargo_items = data.get('cargo_items', [])
            
            # 解析每个货物的装载位置
            parsed_cargo_items = []
            for item in cargo_items:
                try:
                    cargo_id = item.get('cargo_id', '').strip()
                    if not cargo_id:
                        self._add_warning(
                            "data_loader",
                            "跳过缺少货物ID的装载项",
                            {"item": item}
                        )
                        continue
                    
                    # 解析位置（支持mm、cm、m单位）
                    x_position, _ = parse_length(item.get('x_position', 0))
                    y_position, _ = parse_length(item.get('y_position', 0))
                    z_position, _ = parse_length(item.get('z_position', 0))
                    
                    parsed_cargo_items.append({
                        'cargo_id': cargo_id,
                        'x_position': x_position,
                        'y_position': y_position,
                        'z_position': z_position
                    })
                    
                except Exception as e:
                    self._add_error(
                        "data_loader",
                        f"解析装载项失败: {str(e)}",
                        {"item": item, "error": str(e)}
                    )
            
            return LoadingPlan(
                vehicle_id=vehicle_id,
                cargo_items=parsed_cargo_items
            )
            
        except FileNotFoundError:
            self._add_error(
                "data_loader",
                f"装载方案文件不存在: {file_path}",
                {"file_path": file_path}
            )
            raise
        
        except Exception as e:
            self._add_error(
                "data_loader",
                f"读取装载方案文件失败: {str(e)}",
                {"file_path": file_path, "error": str(e)}
            )
            raise
    
    def load_rules_from_yaml(self, file_path: str) -> RuleConfig:
        """
        从YAML文件加载规则配置
        
        Args:
            file_path: YAML文件路径
            
        Returns:
            RuleConfig: 规则配置对象
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            # 解析规则配置（支持mm、cm、m单位）
            max_longitudinal_offset, _ = parse_length(
                data.get('max_longitudinal_offset', 100)  # 默认100mm
            )
            
            max_lateral_offset, _ = parse_length(
                data.get('max_lateral_offset', 50)  # 默认50mm
            )
            
            min_dangerous_goods_distance, _ = parse_length(
                data.get('min_dangerous_goods_distance', 1000)  # 默认1000mm
            )
            
            height_limit_tolerance, _ = parse_length(
                data.get('height_limit_tolerance', 0)
            )
            
            width_limit_tolerance, _ = parse_length(
                data.get('width_limit_tolerance', 0)
            )
            
            # 解析比例参数
            axle_weight_tolerance = safe_float(
                data.get('axle_weight_tolerance', 0.05)  # 默认5%
            )
            
            over_weight_warning_threshold = safe_float(
                data.get('over_weight_warning_threshold', 0.9)  # 默认90%
            )
            
            over_weight_error_threshold = safe_float(
                data.get('over_weight_error_threshold', 1.0)  # 默认100%
            )
            
            return RuleConfig(
                max_longitudinal_offset=max_longitudinal_offset,
                max_lateral_offset=max_lateral_offset,
                min_dangerous_goods_distance=min_dangerous_goods_distance,
                axle_weight_tolerance=axle_weight_tolerance,
                over_weight_warning_threshold=over_weight_warning_threshold,
                over_weight_error_threshold=over_weight_error_threshold,
                height_limit_tolerance=height_limit_tolerance,
                width_limit_tolerance=width_limit_tolerance
            )
            
        except FileNotFoundError:
            # 如果规则文件不存在，使用默认值
            self._add_warning(
                "data_loader",
                f"规则配置文件不存在，使用默认值: {file_path}",
                {"file_path": file_path}
            )
            
            return RuleConfig(
                max_longitudinal_offset=100.0,
                max_lateral_offset=50.0,
                min_dangerous_goods_distance=1000.0,
                axle_weight_tolerance=0.05,
                over_weight_warning_threshold=0.9,
                over_weight_error_threshold=1.0,
                height_limit_tolerance=0.0,
                width_limit_tolerance=0.0
            )
        
        except Exception as e:
            self._add_error(
                "data_loader",
                f"读取规则配置文件失败: {str(e)}",
                {"file_path": file_path, "error": str(e)}
            )
            # 使用默认值
            return RuleConfig(
                max_longitudinal_offset=100.0,
                max_lateral_offset=50.0,
                min_dangerous_goods_distance=1000.0,
                axle_weight_tolerance=0.05,
                over_weight_warning_threshold=0.9,
                over_weight_error_threshold=1.0,
                height_limit_tolerance=0.0,
                width_limit_tolerance=0.0
            )
    
    def _add_warning(self, category: str, message: str, details: Dict = None):
        """添加警告问题"""
        self.issues.append(Issue(
            level=IssueLevel.WARNING,
            category=category,
            message=message,
            details=details or {}
        ))
    
    def _add_error(self, category: str, message: str, details: Dict = None):
        """添加错误问题"""
        self.issues.append(Issue(
            level=IssueLevel.ERROR,
            category=category,
            message=message,
            details=details or {}
        ))
