#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
数据解析模块 - Data Parser Module

负责解析各种输入数据格式：
- RoofZoneParser: 解析屋面分区CSV
- ModuleParser: 解析组件参数JSON
- InverterParser: 解析逆变器MPPT表CSV
- ShadingParser: 解析逐小时遮挡系数CSV
"""

import os
import json
import csv
from typing import Dict, List, Optional, Any, Union
from pathlib import Path
from dataclasses import dataclass, asdict
import pandas as pd
import numpy as np

from pvchecker import PVModule, RoofZone, InverterMPPT


class ParseError(Exception):
    """数据解析错误"""
    pass


class DataParser:
    """统一数据解析器基类"""
    
    def __init__(self):
        self._raw_data: Any = None
        self._parsed_data: Any = None
        self._errors: List[str] = []
    
    def parse(self, source: Union[str, Path, Dict]) -> Any:
        """解析数据源"""
        raise NotImplementedError("Subclasses must implement parse method")
    
    def validate(self) -> bool:
        """验证解析后的数据"""
        raise NotImplementedError("Subclasses must implement validate method")
    
    @property
    def errors(self) -> List[str]:
        """获取错误列表"""
        return self._errors
    
    def _add_error(self, message: str):
        """添加错误信息"""
        self._errors.append(message)
    
    def _read_file(self, filepath: Union[str, Path]) -> str:
        """读取文件内容"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            self._add_error(f"文件不存在: {filepath}")
            raise ParseError(f"文件不存在: {filepath}")
        except Exception as e:
            self._add_error(f"读取文件失败: {e}")
            raise ParseError(f"读取文件失败: {e}")
    
    def _parse_csv(self, filepath: Union[str, Path]) -> pd.DataFrame:
        """解析CSV文件为DataFrame"""
        try:
            df = pd.read_csv(filepath, encoding='utf-8')
            return df
        except Exception as e:
            self._add_error(f"CSV解析失败: {e}")
            raise ParseError(f"CSV解析失败: {e}")
    
    def _parse_json(self, filepath: Union[str, Path]) -> Dict:
        """解析JSON文件"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            self._add_error(f"JSON格式错误: {e}")
            raise ParseError(f"JSON格式错误: {e}")
        except Exception as e:
            self._add_error(f"JSON解析失败: {e}")
            raise ParseError(f"JSON解析失败: {e}")


class RoofZoneParser(DataParser):
    """屋面分区数据解析器
    
    解析屋面分区CSV文件，包含以下字段：
    - zone_id: 分区ID
    - area: 面积 (m²)
    - tilt: 倾角 (度)
    - azimuth: 方位角 (度，南为0，西为正)
    - module_count: 可安装组件数量
    - shading_profile: 遮挡特性配置
    - notes: 备注
    """
    
    REQUIRED_FIELDS = ['zone_id', 'area', 'tilt', 'azimuth', 'module_count']
    OPTIONAL_FIELDS = ['shading_profile', 'notes']
    
    def __init__(self):
        super().__init__()
        self._roof_zones: List[RoofZone] = []
    
    def parse(self, source: Union[str, Path, pd.DataFrame]) -> List[RoofZone]:
        """解析屋面分区数据
        
        Args:
            source: 可以是CSV文件路径或pandas DataFrame
            
        Returns:
            RoofZone对象列表
            
        Raises:
            ParseError: 解析失败时抛出
        """
        self._errors = []
        
        if isinstance(source, (str, Path)):
            df = self._parse_csv(source)
        elif isinstance(source, pd.DataFrame):
            df = source
        else:
            raise ParseError(f"不支持的数据源类型: {type(source)}")
        
        self._raw_data = df
        
        # 验证必需字段
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            if field not in df.columns:
                missing_fields.append(field)
        
        if missing_fields:
            self._add_error(f"缺少必需字段: {', '.join(missing_fields)}")
            raise ParseError(f"缺少必需字段: {', '.join(missing_fields)}")
        
        # 解析每一行
        self._roof_zones = []
        for idx, row in df.iterrows():
            try:
                zone = RoofZone(
                    zone_id=str(row['zone_id']),
                    area=float(row['area']),
                    tilt=float(row['tilt']),
                    azimuth=float(row['azimuth']),
                    module_count=int(row['module_count']),
                    shading_profile=str(row.get('shading_profile', 'standard')),
                    notes=str(row.get('notes', ''))
                )
                self._roof_zones.append(zone)
            except Exception as e:
                self._add_error(f"解析第 {idx+1} 行失败: {e}")
        
        self._parsed_data = self._roof_zones
        
        if not self.validate():
            raise ParseError("数据验证失败")
        
        return self._roof_zones
    
    def validate(self) -> bool:
        """验证屋面分区数据
        
        验证规则：
        1. 分区ID不能重复
        2. 面积必须为正数
        3. 倾角范围: 0-90度
        4. 方位角范围: -180到180度
        5. 组件数量必须为正整数
        """
        if not self._roof_zones:
            self._add_error("没有解析到任何屋面分区")
            return False
        
        zone_ids = set()
        valid = True
        
        for zone in self._roof_zones:
            # 检查重复ID
            if zone.zone_id in zone_ids:
                self._add_error(f"重复的分区ID: {zone.zone_id}")
                valid = False
            zone_ids.add(zone.zone_id)
            
            # 检查面积
            if zone.area <= 0:
                self._add_error(f"分区 {zone.zone_id} 面积必须为正数: {zone.area}")
                valid = False
            
            # 检查倾角
            if zone.tilt < 0 or zone.tilt > 90:
                self._add_error(f"分区 {zone.zone_id} 倾角超出范围 (0-90): {zone.tilt}")
                valid = False
            
            # 检查方位角
            if zone.azimuth < -180 or zone.azimuth > 180:
                self._add_error(f"分区 {zone.zone_id} 方位角超出范围 (-180到180): {zone.azimuth}")
                valid = False
            
            # 检查组件数量
            if zone.module_count <= 0:
                self._add_error(f"分区 {zone.zone_id} 组件数量必须为正整数: {zone.module_count}")
                valid = False
        
        return valid
    
    @property
    def roof_zones(self) -> List[RoofZone]:
        """获取解析后的屋面分区列表"""
        return self._roof_zones
    
    def get_total_modules(self) -> int:
        """获取总组件数量"""
        return sum(zone.module_count for zone in self._roof_zones)
    
    def get_total_area(self) -> float:
        """获取总面积"""
        return sum(zone.area for zone in self._roof_zones)


class ModuleParser(DataParser):
    """光伏组件参数解析器
    
    解析组件参数JSON文件，包含以下字段：
    - model: 组件型号
    - p_max: 最大功率 (W)
    - v_mp: 最大功率点电压 (V)
    - i_mp: 最大功率点电流 (A)
    - voc: 开路电压 (V)
    - isc: 短路电流 (A)
    - temp_coeff_voc: 开路电压温度系数 (%/°C，应为负值)
    - temp_coeff_isc: 短路电流温度系数 (%/°C)
    - temp_coeff_pmax: 最大功率温度系数 (%/°C，应为负值)
    - noct: 标称工作电池温度 (°C，默认45)
    - area: 组件面积 (m²，默认1.6)
    - efficiency: 组件效率 (默认0.21)
    """
    
    REQUIRED_FIELDS = [
        'model', 'p_max', 'v_mp', 'i_mp', 'voc', 'isc',
        'temp_coeff_voc', 'temp_coeff_isc', 'temp_coeff_pmax'
    ]
    
    def __init__(self):
        super().__init__()
        self._module: Optional[PVModule] = None
    
    def parse(self, source: Union[str, Path, Dict]) -> PVModule:
        """解析组件参数
        
        Args:
            source: 可以是JSON文件路径或字典
            
        Returns:
            PVModule对象
            
        Raises:
            ParseError: 解析失败时抛出
        """
        self._errors = []
        
        if isinstance(source, (str, Path)):
            data = self._parse_json(source)
        elif isinstance(source, dict):
            data = source
        else:
            raise ParseError(f"不支持的数据源类型: {type(source)}")
        
        self._raw_data = data
        
        # 验证必需字段
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            if field not in data:
                missing_fields.append(field)
        
        if missing_fields:
            self._add_error(f"缺少必需字段: {', '.join(missing_fields)}")
            raise ParseError(f"缺少必需字段: {', '.join(missing_fields)}")
        
        # 解析数据
        try:
            self._module = PVModule(
                model=str(data['model']),
                p_max=float(data['p_max']),
                v_mp=float(data['v_mp']),
                i_mp=float(data['i_mp']),
                voc=float(data['voc']),
                isc=float(data['isc']),
                temp_coeff_voc=float(data['temp_coeff_voc']),
                temp_coeff_isc=float(data['temp_coeff_isc']),
                temp_coeff_pmax=float(data['temp_coeff_pmax']),
                noct=float(data.get('noct', 45.0)),
                area=float(data.get('area', 1.6)),
                efficiency=float(data.get('efficiency', 0.21))
            )
        except Exception as e:
            self._add_error(f"解析组件参数失败: {e}")
            raise ParseError(f"解析组件参数失败: {e}")
        
        self._parsed_data = self._module
        
        if not self.validate():
            raise ParseError("数据验证失败")
        
        return self._module
    
    def validate(self) -> bool:
        """验证组件参数
        
        验证规则：
        1. 所有电参数必须为正数
        2. 温度系数符号正确（voc和pmax应为负，isc应为正）
        3. 温度系数在合理范围内
        """
        if not self._module:
            self._add_error("没有解析到组件参数")
            return False
        
        valid = True
        m = self._module
        
        # 检查电参数为正
        for param_name, param_value in [
            ('p_max', m.p_max),
            ('v_mp', m.v_mp),
            ('i_mp', m.i_mp),
            ('voc', m.voc),
            ('isc', m.isc),
        ]:
            if param_value <= 0:
                self._add_error(f"{param_name} 必须为正数: {param_value}")
                valid = False
        
        # 检查温度系数符号
        if m.temp_coeff_voc >= 0:
            self._add_error(f"开路电压温度系数应为负值: {m.temp_coeff_voc}")
            valid = False
        
        if m.temp_coeff_isc <= 0:
            self._add_error(f"短路电流温度系数应为正值: {m.temp_coeff_isc}")
            valid = False
        
        if m.temp_coeff_pmax >= 0:
            self._add_error(f"最大功率温度系数应为负值: {m.temp_coeff_pmax}")
            valid = False
        
        # 检查温度系数范围
        if not (-0.5 <= m.temp_coeff_voc <= -0.2):
            self._add_error(f"开路电压温度系数超出合理范围 (-0.5到-0.2): {m.temp_coeff_voc}")
            valid = False
        
        if not (0.03 <= m.temp_coeff_isc <= 0.08):
            self._add_error(f"短路电流温度系数超出合理范围 (0.03到0.08): {m.temp_coeff_isc}")
            valid = False
        
        if not (-0.5 <= m.temp_coeff_pmax <= -0.3):
            self._add_error(f"最大功率温度系数超出合理范围 (-0.5到-0.3): {m.temp_coeff_pmax}")
            valid = False
        
        return valid
    
    @property
    def module(self) -> Optional[PVModule]:
        """获取解析后的组件参数"""
        return self._module
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        if not self._module:
            return {}
        return asdict(self._module)


class InverterParser(DataParser):
    """逆变器MPPT参数解析器
    
    解析逆变器MPPT表CSV文件，包含以下字段：
    - inverter_model: 逆变器型号
    - mppt_id: MPPT通道ID
    - v_min: MPPT最低工作电压 (V)
    - v_max: MPPT最高工作电压 (V)
    - v_nom: 标称工作电压 (V)
    - p_max: 最大功率 (W)
    - i_max: 最大输入电流 (A)
    - efficiency: 转换效率 (默认0.98)
    - v_start: 启动电压 (V，可选)
    """
    
    REQUIRED_FIELDS = [
        'inverter_model', 'mppt_id', 'v_min', 'v_max', 
        'v_nom', 'p_max', 'i_max'
    ]
    
    def __init__(self):
        super().__init__()
        self._inverters: List[InverterMPPT] = []
    
    def parse(self, source: Union[str, Path, pd.DataFrame]) -> List[InverterMPPT]:
        """解析逆变器MPPT参数
        
        Args:
            source: 可以是CSV文件路径或pandas DataFrame
            
        Returns:
            InverterMPPT对象列表
            
        Raises:
            ParseError: 解析失败时抛出
        """
        self._errors = []
        
        if isinstance(source, (str, Path)):
            df = self._parse_csv(source)
        elif isinstance(source, pd.DataFrame):
            df = source
        else:
            raise ParseError(f"不支持的数据源类型: {type(source)}")
        
        self._raw_data = df
        
        # 验证必需字段
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            if field not in df.columns:
                missing_fields.append(field)
        
        if missing_fields:
            self._add_error(f"缺少必需字段: {', '.join(missing_fields)}")
            raise ParseError(f"缺少必需字段: {', '.join(missing_fields)}")
        
        # 解析每一行
        self._inverters = []
        for idx, row in df.iterrows():
            try:
                v_start = row.get('v_start')
                if pd.isna(v_start):
                    v_start = None
                else:
                    v_start = float(v_start)
                
                inverter = InverterMPPT(
                    inverter_model=str(row['inverter_model']),
                    mppt_id=str(row['mppt_id']),
                    v_min=float(row['v_min']),
                    v_max=float(row['v_max']),
                    v_nom=float(row['v_nom']),
                    p_max=float(row['p_max']),
                    i_max=float(row['i_max']),
                    efficiency=float(row.get('efficiency', 0.98)),
                    v_start=v_start
                )
                self._inverters.append(inverter)
            except Exception as e:
                self._add_error(f"解析第 {idx+1} 行失败: {e}")
        
        self._parsed_data = self._inverters
        
        if not self.validate():
            raise ParseError("数据验证失败")
        
        return self._inverters
    
    def validate(self) -> bool:
        """验证逆变器参数
        
        验证规则：
        1. (inverter_model, mppt_id) 组合不能重复
        2. 电压范围合理 (v_min < v_nom < v_max)
        3. 所有电参数必须为正数
        """
        if not self._inverters:
            self._add_error("没有解析到逆变器参数")
            return False
        
        ids = set()
        valid = True
        
        for inv in self._inverters:
            # 检查重复ID
            inv_id = (inv.inverter_model, inv.mppt_id)
            if inv_id in ids:
                self._add_error(f"重复的逆变器+MPPT组合: {inv_id}")
                valid = False
            ids.add(inv_id)
            
            # 检查电参数为正
            for param_name, param_value in [
                ('v_min', inv.v_min),
                ('v_max', inv.v_max),
                ('v_nom', inv.v_nom),
                ('p_max', inv.p_max),
                ('i_max', inv.i_max),
            ]:
                if param_value <= 0:
                    self._add_error(f"逆变器 {inv.inverter_model}-{inv.mppt_id} 的 {param_name} 必须为正数: {param_value}")
                    valid = False
            
            # 检查电压范围
            if inv.v_min >= inv.v_max:
                self._add_error(f"逆变器 {inv.inverter_model}-{inv.mppt_id} 的 v_min ({inv.v_min}) 必须小于 v_max ({inv.v_max})")
                valid = False
            
            if inv.v_nom <= inv.v_min or inv.v_nom >= inv.v_max:
                self._add_error(f"逆变器 {inv.inverter_model}-{inv.mppt_id} 的 v_nom ({inv.v_nom}) 必须在 v_min ({inv.v_min}) 和 v_max ({inv.v_max}) 之间")
                valid = False
            
            # 检查效率范围
            if inv.efficiency <= 0 or inv.efficiency > 1:
                self._add_error(f"逆变器 {inv.inverter_model}-{inv.mppt_id} 的效率超出合理范围 (0, 1]: {inv.efficiency}")
                valid = False
        
        return valid
    
    @property
    def inverters(self) -> List[InverterMPPT]:
        """获取解析后的逆变器列表"""
        return self._inverters
    
    def get_by_model(self, model: str) -> List[InverterMPPT]:
        """按型号获取逆变器"""
        return [inv for inv in self._inverters if inv.inverter_model == model]
    
    def get_total_power(self) -> float:
        """获取总逆变器功率"""
        return sum(inv.p_max for inv in self._inverters)


class ShadingParser(DataParser):
    """逐小时遮挡系数解析器
    
    解析逐小时遮挡系数CSV文件，格式为：
    - month: 月份 (1-12)
    - hour_0 到 hour_23: 对应小时的遮挡系数 (0-1)
    
    遮挡系数定义：
    - 1.0: 无遮挡，完全接收辐照
    - 0.5: 50%遮挡
    - 0.0: 完全遮挡
    """
    
    REQUIRED_FIELDS = ['month'] + [f'hour_{h}' for h in range(24)]
    
    def __init__(self):
        super().__init__()
        self._shading_data: Optional[pd.DataFrame] = None
        self._shading_matrix: Optional[np.ndarray] = None
    
    def parse(self, source: Union[str, Path, pd.DataFrame]) -> np.ndarray:
        """解析遮挡系数数据
        
        Args:
            source: 可以是CSV文件路径或pandas DataFrame
            
        Returns:
            形状为 (12, 24) 的numpy数组，[month][hour]
            
        Raises:
            ParseError: 解析失败时抛出
        """
        self._errors = []
        
        if isinstance(source, (str, Path)):
            df = self._parse_csv(source)
        elif isinstance(source, pd.DataFrame):
            df = source
        else:
            raise ParseError(f"不支持的数据源类型: {type(source)}")
        
        self._raw_data = df
        
        # 验证必需字段
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            if field not in df.columns:
                missing_fields.append(field)
        
        if missing_fields:
            self._add_error(f"缺少必需字段: {', '.join(missing_fields)}")
            raise ParseError(f"缺少必需字段: {', '.join(missing_fields)}")
        
        # 验证数据行数（应为12个月）
        if len(df) != 12:
            self._add_error(f"遮挡系数数据应为12行（对应12个月），实际为 {len(df)} 行")
        
        # 排序（确保月份顺序正确）
        df = df.sort_values('month').reset_index(drop=True)
        
        # 验证月份为1-12
        expected_months = list(range(1, 13))
        actual_months = df['month'].astype(int).tolist()
        if actual_months != expected_months:
            self._add_error(f"月份数据不完整或顺序错误。期望: {expected_months}, 实际: {actual_months}")
        
        # 提取遮挡系数矩阵
        hour_cols = [f'hour_{h}' for h in range(24)]
        self._shading_data = df[['month'] + hour_cols]
        
        # 转换为numpy数组
        self._shading_matrix = df[hour_cols].values.astype(float)
        
        self._parsed_data = self._shading_matrix
        
        if not self.validate():
            raise ParseError("数据验证失败")
        
        return self._shading_matrix
    
    def validate(self) -> bool:
        """验证遮挡系数数据
        
        验证规则：
        1. 所有遮挡系数在 [0, 1] 范围内
        """
        if self._shading_matrix is None:
            self._add_error("没有解析到遮挡系数数据")
            return False
        
        valid = True
        
        # 检查值范围
        if np.any(self._shading_matrix < 0) or np.any(self._shading_matrix > 1):
            invalid_positions = np.where((self._shading_matrix < 0) | (self._shading_matrix > 1))
            for month_idx, hour_idx in zip(*invalid_positions):
                value = self._shading_matrix[month_idx, hour_idx]
                self._add_error(f"月份 {month_idx+1} 小时 {hour_idx} 的遮挡系数超出范围 [0, 1]: {value}")
            valid = False
        
        return valid
    
    @property
    def shading_matrix(self) -> Optional[np.ndarray]:
        """获取遮挡系数矩阵 (12, 24)"""
        return self._shading_matrix
    
    def get_monthly_average(self) -> np.ndarray:
        """获取各月平均遮挡系数"""
        if self._shading_matrix is None:
            return np.array([])
        return np.mean(self._shading_matrix, axis=1)
    
    def get_daily_average(self, month: int) -> float:
        """获取指定月份的日平均遮挡系数
        
        Args:
            month: 月份 (1-12)
        """
        if self._shading_matrix is None:
            return 1.0
        if month < 1 or month > 12:
            return 1.0
        return float(np.mean(self._shading_matrix[month-1]))
    
    def get_hourly(self, month: int, hour: int) -> float:
        """获取指定月份指定小时的遮挡系数
        
        Args:
            month: 月份 (1-12)
            hour: 小时 (0-23)
        """
        if self._shading_matrix is None:
            return 1.0
        if month < 1 or month > 12 or hour < 0 or hour > 23:
            return 1.0
        return float(self._shading_matrix[month-1, hour])


def parse_all_data(
    roof_zones_path: Union[str, Path],
    module_params_path: Union[str, Path],
    inverter_mppt_path: Union[str, Path],
    shading_coeff_path: Union[str, Path]
) -> Dict[str, Any]:
    """解析所有数据文件的便捷函数
    
    Args:
        roof_zones_path: 屋面分区CSV路径
        module_params_path: 组件参数JSON路径
        inverter_mppt_path: 逆变器MPPT CSV路径
        shading_coeff_path: 遮挡系数CSV路径
        
    Returns:
        包含所有解析数据的字典
    """
    result = {
        'roof_zones': None,
        'module': None,
        'inverters': None,
        'shading_matrix': None,
        'errors': []
    }
    
    # 解析屋面分区
    try:
        parser = RoofZoneParser()
        result['roof_zones'] = parser.parse(roof_zones_path)
        result['errors'].extend(parser.errors)
    except ParseError as e:
        result['errors'].append(f"屋面分区解析失败: {e}")
    
    # 解析组件参数
    try:
        parser = ModuleParser()
        result['module'] = parser.parse(module_params_path)
        result['errors'].extend(parser.errors)
    except ParseError as e:
        result['errors'].append(f"组件参数解析失败: {e}")
    
    # 解析逆变器参数
    try:
        parser = InverterParser()
        result['inverters'] = parser.parse(inverter_mppt_path)
        result['errors'].extend(parser.errors)
    except ParseError as e:
        result['errors'].append(f"逆变器参数解析失败: {e}")
    
    # 解析遮挡系数
    try:
        parser = ShadingParser()
        result['shading_matrix'] = parser.parse(shading_coeff_path)
        result['errors'].extend(parser.errors)
    except ParseError as e:
        result['errors'].append(f"遮挡系数解析失败: {e}")
    
    return result
