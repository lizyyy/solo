"""
CSV读取和数据验证模块
"""

import csv
from datetime import datetime
from typing import List, Dict, Tuple, Any, Optional
from pathlib import Path

from .models import TankParams, DailyReading, SupplementConfig, DEFAULT_SUPPLEMENTS


class DataValidationError(Exception):
    """数据验证错误"""
    pass


class CSVReader:
    """CSV文件读取器"""
    
    def __init__(self):
        self.warnings: List[str] = []
    
    def get_warnings(self) -> List[str]:
        """获取所有警告"""
        return self.warnings.copy()
    
    def clear_warnings(self):
        """清除警告"""
        self.warnings = []
    
    def read_tank_params(self, file_path: str) -> TankParams:
        """
        读取缸体参数CSV文件
        
        CSV格式示例:
        parameter,value,unit
        tank_name,主缸,
        total_volume,200,L
        target_kh_min,7.0,dKH
        target_kh_max,9.0,dKH
        target_ca_min,400.0,ppm
        target_ca_max,450.0,ppm
        target_mg_min,1250.0,ppm
        target_mg_max,1350.0,ppm
        target_salinity_min,1.024,sg
        target_salinity_max,1.026,sg
        daily_evaporation_rate,5.0,L/day
        """
        self.clear_warnings()
        params = {}
        units = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    param = row.get('parameter', '').strip().lower()
                    value = row.get('value', '').strip()
                    unit = row.get('unit', '').strip().lower()
                    
                    if param and value:
                        params[param] = value
                        if unit:
                            units[param] = unit
        
        except FileNotFoundError:
            raise DataValidationError(f"缸体参数文件不存在: {file_path}")
        except Exception as e:
            raise DataValidationError(f"读取缸体参数文件失败: {str(e)}")
        
        # 解析参数
        tank_params = TankParams()
        
        # 基本信息
        if 'tank_name' in params:
            tank_params.tank_name = params['tank_name']
        
        if 'tank_id' in params:
            tank_params.tank_id = params['tank_id']
        
        # 体积参数
        volume_mapping = {
            'total_volume': 'total_volume',
            'total_volume_l': 'total_volume',
            'display_volume': 'display_volume',
            'sump_volume': 'sump_volume',
        }
        
        for csv_key, attr in volume_mapping.items():
            if csv_key in params:
                try:
                    value = float(params[csv_key])
                    setattr(tank_params, attr, value)
                    
                    # 单位验证
                    if csv_key in units:
                        unit = units[csv_key]
                        if unit not in ['l', 'liter', 'liters', '升']:
                            self.warnings.append(
                                f"参数 {csv_key} 单位 {unit} 不是标准单位升 (L)，请确认单位一致性"
                            )
                except ValueError:
                    self.warnings.append(f"参数 {csv_key} 值 {params[csv_key]} 不是有效数字")
        
        # 目标范围参数
        target_mapping = {
            'target_kh_min': ('target_kh_min', 'dKH'),
            'target_kh_max': ('target_kh_max', 'dKH'),
            'target_ca_min': ('target_ca_min', 'ppm'),
            'target_ca_max': ('target_ca_max', 'ppm'),
            'target_mg_min': ('target_mg_min', 'ppm'),
            'target_mg_max': ('target_mg_max', 'ppm'),
            'target_salinity_min': ('target_salinity_min', 'sg'),
            'target_salinity_max': ('target_salinity_max', 'sg'),
            'daily_evaporation_rate': ('daily_evaporation_rate', 'L/day'),
        }
        
        for csv_key, (attr, expected_unit) in target_mapping.items():
            if csv_key in params:
                try:
                    value = float(params[csv_key])
                    setattr(tank_params, attr, value)
                    
                    # 单位验证
                    if csv_key in units:
                        unit = units[csv_key].lower()
                        expected = expected_unit.lower()
                        
                        if expected == 'dkh' and unit not in ['dkh', 'kh', '德国度']:
                            self.warnings.append(
                                f"参数 {csv_key} 单位 {unit} 不是标准单位 dKH，请确认单位一致性"
                            )
                        elif expected == 'ppm' and unit not in ['ppm', 'mg/l']:
                            self.warnings.append(
                                f"参数 {csv_key} 单位 {unit} 不是标准单位 ppm，请确认单位一致性"
                            )
                        elif expected == 'sg' and unit not in ['sg', '比重', 'specific gravity']:
                            self.warnings.append(
                                f"参数 {csv_key} 单位 {unit} 不是标准单位 sg，请确认单位一致性"
                            )
                        elif expected == 'l/day' and unit not in ['l/day', '升/天', 'l']:
                            self.warnings.append(
                                f"参数 {csv_key} 单位 {unit} 不是标准单位 L/day，请确认单位一致性"
                            )
                except ValueError:
                    self.warnings.append(f"参数 {csv_key} 值 {params[csv_key]} 不是有效数字")
        
        # 验证参数
        validation_warnings = tank_params.validate()
        self.warnings.extend(validation_warnings)
        
        return tank_params
    
    def read_daily_readings(self, file_path: str) -> List[DailyReading]:
        """
        读取每日检测数据CSV文件
        
        CSV格式示例:
        date,kh,ca,mg,salinity,evaporation,notes
        2024-01-01,7.5,420,1300,1.025,5.0,正常
        2024-01-02,7.3,415,1295,1.024,6.0,KH略低
        """
        self.clear_warnings()
        readings: List[DailyReading] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                # 检查必要的列
                required_columns = ['date']
                missing_columns = [col for col in required_columns if col not in reader.fieldnames]
                
                if missing_columns:
                    raise DataValidationError(f"检测数据文件缺少必要列: {', '.join(missing_columns)}")
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        # 解析日期
                        date_str = row.get('date', '').strip()
                        if not date_str:
                            self.warnings.append(f"第 {row_num} 行: 日期为空，跳过此行")
                            continue
                        
                        try:
                            date = self._parse_date(date_str)
                        except ValueError as e:
                            self.warnings.append(f"第 {row_num} 行: 日期格式无效 '{date_str}': {str(e)}")
                            continue
                        
                        # 解析各参数
                        reading = DailyReading(date=date)
                        
                        # KH
                        kh_str = row.get('kh', '').strip()
                        if kh_str:
                            try:
                                reading.kh = float(kh_str)
                            except ValueError:
                                self.warnings.append(f"第 {row_num} 行: KH值 '{kh_str}' 不是有效数字")
                        
                        # 钙
                        ca_str = row.get('ca', '').strip()
                        if ca_str:
                            try:
                                reading.ca = float(ca_str)
                            except ValueError:
                                self.warnings.append(f"第 {row_num} 行: 钙值 '{ca_str}' 不是有效数字")
                        
                        # 镁
                        mg_str = row.get('mg', '').strip()
                        if mg_str:
                            try:
                                reading.mg = float(mg_str)
                            except ValueError:
                                self.warnings.append(f"第 {row_num} 行: 镁值 '{mg_str}' 不是有效数字")
                        
                        # 盐度
                        salinity_str = row.get('salinity', '').strip()
                        if salinity_str:
                            try:
                                reading.salinity = float(salinity_str)
                            except ValueError:
                                self.warnings.append(f"第 {row_num} 行: 盐度值 '{salinity_str}' 不是有效数字")
                        
                        # 蒸发量
                        evaporation_str = row.get('evaporation', '').strip()
                        if evaporation_str:
                            try:
                                reading.evaporation = float(evaporation_str)
                            except ValueError:
                                self.warnings.append(f"第 {row_num} 行: 蒸发量值 '{evaporation_str}' 不是有效数字")
                        
                        # 备注
                        reading.notes = row.get('notes', '').strip()
                        
                        # 检查缺失的参数
                        missing = reading.get_missing_params()
                        if missing:
                            self.warnings.append(
                                f"第 {row_num} 行 ({date_str}): 缺少参数: {', '.join(missing)}"
                            )
                        
                        readings.append(reading)
                    
                    except Exception as e:
                        self.warnings.append(f"第 {row_num} 行: 解析失败: {str(e)}")
        
        except FileNotFoundError:
            raise DataValidationError(f"检测数据文件不存在: {file_path}")
        except DataValidationError:
            raise
        except Exception as e:
            raise DataValidationError(f"读取检测数据文件失败: {str(e)}")
        
        # 按日期排序
        readings.sort(key=lambda x: x.date)
        
        # 验证数据范围
        for reading in readings:
            self._validate_reading_ranges(reading)
        
        return readings
    
    def _parse_date(self, date_str: str) -> datetime:
        """解析日期字符串"""
        # 尝试多种日期格式
        formats = [
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d-%m-%Y',
            '%d/%m/%Y',
            '%m-%d-%Y',
            '%m/%d/%Y',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        raise ValueError(f"无法解析日期: {date_str}")
    
    def _validate_reading_ranges(self, reading: DailyReading):
        """验证读取数据的数值范围"""
        date_str = reading.date.strftime('%Y-%m-%d')
        
        # KH 范围检查 (通常 5-12 dKH)
        if reading.kh is not None:
            if reading.kh < 4 or reading.kh > 14:
                self.warnings.append(
                    f"{date_str}: KH值 {reading.kh} dKH 超出常规范围 (4-14 dKH)，请确认数据准确性"
                )
        
        # 钙范围检查 (通常 350-500 ppm)
        if reading.ca is not None:
            if reading.ca < 300 or reading.ca > 550:
                self.warnings.append(
                    f"{date_str}: 钙值 {reading.ca} ppm 超出常规范围 (300-550 ppm)，请确认数据准确性"
                )
        
        # 镁范围检查 (通常 1100-1500 ppm)
        if reading.mg is not None:
            if reading.mg < 1000 or reading.mg > 1600:
                self.warnings.append(
                    f"{date_str}: 镁值 {reading.mg} ppm 超出常规范围 (1000-1600 ppm)，请确认数据准确性"
                )
        
        # 盐度范围检查 (通常 1.020-1.030 sg)
        if reading.salinity is not None:
            if reading.salinity < 1.015 or reading.salinity > 1.035:
                self.warnings.append(
                    f"{date_str}: 盐度值 {reading.salinity} sg 超出常规范围 (1.015-1.035 sg)，请确认数据准确性"
                )
        
        # 蒸发量检查 (不能为负数)
        if reading.evaporation is not None and reading.evaporation < 0:
            self.warnings.append(
                f"{date_str}: 蒸发量 {reading.evaporation} L 为负数，请确认数据准确性"
            )
    
    def read_supplement_config(self, file_path: str) -> Dict[str, SupplementConfig]:
        """
        读取补剂配置CSV文件
        
        CSV格式示例:
        name,param,concentration,concentration_unit,max_daily_dosage,safety_threshold
        KH提升液,kh,1.0,meq/mL,5.0,1.0
        钙提升液,ca,100000.0,ppm/mL,5.0,20.0
        镁提升液,mg,50000.0,ppm/mL,5.0,30.0
        """
        self.clear_warnings()
        supplements: Dict[str, SupplementConfig] = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        name = row.get('name', '').strip()
                        param = row.get('param', '').strip().lower()
                        
                        if not name or not param:
                            self.warnings.append(f"第 {row_num} 行: 补剂名称或参数类型为空，跳过")
                            continue
                        
                        # 解析数值
                        try:
                            concentration = float(row.get('concentration', '0'))
                        except ValueError:
                            self.warnings.append(f"第 {row_num} 行: 浓度值无效")
                            continue
                        
                        concentration_unit = row.get('concentration_unit', '').strip()
                        
                        try:
                            max_daily_dosage = float(row.get('max_daily_dosage', '0'))
                        except ValueError:
                            self.warnings.append(f"第 {row_num} 行: 最大每日投加量无效")
                            continue
                        
                        try:
                            safety_threshold = float(row.get('safety_threshold', '0'))
                        except ValueError:
                            self.warnings.append(f"第 {row_num} 行: 安全阈值无效")
                            continue
                        
                        supplement = SupplementConfig(
                            name=name,
                            param=param,
                            concentration=concentration,
                            concentration_unit=concentration_unit,
                            max_daily_dosage=max_daily_dosage,
                            safety_threshold=safety_threshold,
                        )
                        
                        # 验证补剂配置
                        warnings = supplement.validate()
                        self.warnings.extend(warnings)
                        
                        supplements[param] = supplement
                    
                    except Exception as e:
                        self.warnings.append(f"第 {row_num} 行: 解析失败: {str(e)}")
        
        except FileNotFoundError:
            # 如果文件不存在，使用默认配置
            self.warnings.append(f"补剂配置文件不存在: {file_path}，使用默认配置")
            return DEFAULT_SUPPLEMENTS.copy()
        except Exception as e:
            self.warnings.append(f"读取补剂配置文件失败: {str(e)}，使用默认配置")
            return DEFAULT_SUPPLEMENTS.copy()
        
        # 确保至少有基本的补剂配置
        for param in ['kh', 'ca', 'mg', 'salt']:
            if param not in supplements and param in DEFAULT_SUPPLEMENTS:
                supplements[param] = DEFAULT_SUPPLEMENTS[param]
                self.warnings.append(f"补剂配置中缺少 {param}，使用默认配置")
        
        return supplements
