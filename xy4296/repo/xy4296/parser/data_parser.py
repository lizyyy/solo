#!/usr/bin/env python3
"""
数据解析模块
支持导入CSV/JSON/YAML格式的数据
"""

import csv
import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional

import yaml


class DataParser:
    """数据解析器类"""
    
    def __init__(self):
        """初始化数据解析器"""
        self.parsed_data = {
            'radar_data': [],
            'airspace_approvals': [],
            'operation_points': [],
            'ammunition_inventory': [],
            'personnel_qualifications': []
        }
    
    def parse_file(self, file_path: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        解析数据文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            解析后的数据字典
        """
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.csv':
            return self._parse_csv(file_path)
        elif file_ext == '.json':
            return self._parse_json(file_path)
        elif file_ext in ['.yaml', '.yml']:
            return self._parse_yaml(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")
    
    def _parse_csv(self, file_path: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        解析CSV文件
        
        Args:
            file_path: CSV文件路径
            
        Returns:
            解析后的数据字典
        """
        filename = os.path.basename(file_path).lower()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data = list(reader)
        
        # 根据文件名判断数据类型
        if 'radar' in filename or '雷达' in filename:
            self.parsed_data['radar_data'] = self._parse_radar_data(data)
        elif 'airspace' in filename or '空域' in filename or '批复' in filename:
            self.parsed_data['airspace_approvals'] = self._parse_airspace_data(data)
        elif 'point' in filename or '点位' in filename or '作业点' in filename:
            self.parsed_data['operation_points'] = self._parse_points_data(data)
        elif 'ammunition' in filename or '弹药' in filename or '库存' in filename:
            self.parsed_data['ammunition_inventory'] = self._parse_ammunition_data(data)
        elif 'personnel' in filename or '人员' in filename or '资质' in filename:
            self.parsed_data['personnel_qualifications'] = self._parse_personnel_data(data)
        else:
            # 尝试自动检测数据类型
            self._auto_detect_and_parse(data)
        
        return self.parsed_data
    
    def _parse_json(self, file_path: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        解析JSON文件
        
        Args:
            file_path: JSON文件路径
            
        Returns:
            解析后的数据字典
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # JSON文件可以包含多种数据类型
        if isinstance(data, dict):
            for key, value in data.items():
                if 'radar' in key.lower() and isinstance(value, list):
                    self.parsed_data['radar_data'] = self._parse_radar_data(value)
                elif 'airspace' in key.lower() and isinstance(value, list):
                    self.parsed_data['airspace_approvals'] = self._parse_airspace_data(value)
                elif 'point' in key.lower() and isinstance(value, list):
                    self.parsed_data['operation_points'] = self._parse_points_data(value)
                elif 'ammunition' in key.lower() and isinstance(value, list):
                    self.parsed_data['ammunition_inventory'] = self._parse_ammunition_data(value)
                elif 'personnel' in key.lower() and isinstance(value, list):
                    self.parsed_data['personnel_qualifications'] = self._parse_personnel_data(value)
        elif isinstance(data, list):
            self._auto_detect_and_parse(data)
        
        return self.parsed_data
    
    def _parse_yaml(self, file_path: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        解析YAML文件
        
        Args:
            file_path: YAML文件路径
            
        Returns:
            解析后的数据字典
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        # YAML文件处理方式与JSON类似
        if isinstance(data, dict):
            for key, value in data.items():
                if 'radar' in key.lower() and isinstance(value, list):
                    self.parsed_data['radar_data'] = self._parse_radar_data(value)
                elif 'airspace' in key.lower() and isinstance(value, list):
                    self.parsed_data['airspace_approvals'] = self._parse_airspace_data(value)
                elif 'point' in key.lower() and isinstance(value, list):
                    self.parsed_data['operation_points'] = self._parse_points_data(value)
                elif 'ammunition' in key.lower() and isinstance(value, list):
                    self.parsed_data['ammunition_inventory'] = self._parse_ammunition_data(value)
                elif 'personnel' in key.lower() and isinstance(value, list):
                    self.parsed_data['personnel_qualifications'] = self._parse_personnel_data(value)
        elif isinstance(data, list):
            self._auto_detect_and_parse(data)
        
        return self.parsed_data
    
    def _parse_radar_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        解析雷达回波数据
        
        Args:
            data: 原始数据列表
            
        Returns:
            解析后的雷达数据列表
        """
        parsed = []
        for item in data:
            try:
                parsed_item = {
                    'id': item.get('id', item.get('ID', '')),
                    'time': self._parse_datetime(item.get('time', item.get('时间', ''))),
                    'location': item.get('location', item.get('位置', '')),
                    'latitude': float(item.get('latitude', item.get('纬度', 0))),
                    'longitude': float(item.get('longitude', item.get('经度', 0))),
                    'reflectivity': float(item.get('reflectivity', item.get('反射率', item.get('回波强度', 0)))),
                    'storm_type': item.get('storm_type', item.get('风暴类型', '')),
                    'movement_direction': float(item.get('movement_direction', item.get('移动方向', 0))),
                    'movement_speed': float(item.get('movement_speed', item.get('移动速度', 0))),
                    'risk_level': item.get('risk_level', item.get('风险等级', 'low'))
                }
                parsed.append(parsed_item)
            except (ValueError, TypeError) as e:
                print(f"解析雷达数据项时出错: {e}")
                continue
        return parsed
    
    def _parse_airspace_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        解析空域批复数据
        
        Args:
            data: 原始数据列表
            
        Returns:
            解析后的空域批复数据列表
        """
        parsed = []
        for item in data:
            try:
                parsed_item = {
                    'id': item.get('id', item.get('ID', '')),
                    'approval_number': item.get('approval_number', item.get('批复编号', '')),
                    'operation_point': item.get('operation_point', item.get('作业点位', '')),
                    'start_time': self._parse_datetime(item.get('start_time', item.get('开始时间', ''))),
                    'end_time': self._parse_datetime(item.get('end_time', item.get('结束时间', ''))),
                    'altitude_min': float(item.get('altitude_min', item.get('最低高度', 0))),
                    'altitude_max': float(item.get('altitude_max', item.get('最高高度', 0))),
                    'operation_type': item.get('operation_type', item.get('作业类型', '')),
                    'status': item.get('status', item.get('状态', 'approved'))
                }
                parsed.append(parsed_item)
            except (ValueError, TypeError) as e:
                print(f"解析空域批复数据项时出错: {e}")
                continue
        return parsed
    
    def _parse_points_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        解析作业点位数据
        
        Args:
            data: 原始数据列表
            
        Returns:
            解析后的作业点位数据列表
        """
        parsed = []
        for item in data:
            try:
                parsed_item = {
                    'id': item.get('id', item.get('ID', '')),
                    'name': item.get('name', item.get('名称', '')),
                    'code': item.get('code', item.get('编码', '')),
                    'latitude': float(item.get('latitude', item.get('纬度', 0))),
                    'longitude': float(item.get('longitude', item.get('经度', 0))),
                    'altitude': float(item.get('altitude', item.get('海拔', 0))),
                    'equipment_type': item.get('equipment_type', item.get('设备类型', '')),
                    'equipment_status': item.get('equipment_status', item.get('设备状态', 'normal')),
                    'contact_person': item.get('contact_person', item.get('联系人', '')),
                    'contact_phone': item.get('contact_phone', item.get('联系电话', ''))
                }
                parsed.append(parsed_item)
            except (ValueError, TypeError) as e:
                print(f"解析作业点位数据项时出错: {e}")
                continue
        return parsed
    
    def _parse_ammunition_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        解析弹药库存数据
        
        Args:
            data: 原始数据列表
            
        Returns:
            解析后的弹药库存数据列表
        """
        parsed = []
        for item in data:
            try:
                parsed_item = {
                    'id': item.get('id', item.get('ID', '')),
                    'batch_number': item.get('batch_number', item.get('批号', '')),
                    'type': item.get('type', item.get('类型', '')),
                    'quantity': int(item.get('quantity', item.get('数量', 0))),
                    'storage_location': item.get('storage_location', item.get('存储位置', '')),
                    'production_date': self._parse_datetime(item.get('production_date', item.get('生产日期', ''))),
                    'expiry_date': self._parse_datetime(item.get('expiry_date', item.get('有效期至', ''))),
                    'status': item.get('status', item.get('状态', 'normal'))
                }
                parsed.append(parsed_item)
            except (ValueError, TypeError) as e:
                print(f"解析弹药库存数据项时出错: {e}")
                continue
        return parsed
    
    def _parse_personnel_data(self, data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        解析人员资质数据
        
        Args:
            data: 原始数据列表
            
        Returns:
            解析后的人员资质数据列表
        """
        parsed = []
        for item in data:
            try:
                parsed_item = {
                    'id': item.get('id', item.get('ID', '')),
                    'name': item.get('name', item.get('姓名', '')),
                    'position': item.get('position', item.get('职位', '')),
                    'qualification_type': item.get('qualification_type', item.get('资质类型', '')),
                    'qualification_number': item.get('qualification_number', item.get('资质编号', '')),
                    'issue_date': self._parse_datetime(item.get('issue_date', item.get('颁发日期', ''))),
                    'expiry_date': self._parse_datetime(item.get('expiry_date', item.get('有效期至', ''))),
                    'status': item.get('status', item.get('状态', 'valid'))
                }
                parsed.append(parsed_item)
            except (ValueError, TypeError) as e:
                print(f"解析人员资质数据项时出错: {e}")
                continue
        return parsed
    
    def _auto_detect_and_parse(self, data: List[Dict[str, Any]]):
        """
        自动检测数据类型并解析
        
        Args:
            data: 原始数据列表
        """
        if not data:
            return
        
        # 取第一个样本检测
        sample = data[0]
        keys = [k.lower() for k in sample.keys()]
        
        # 检测雷达数据
        if any(k in keys for k in ['reflectivity', '反射率', '回波', 'storm']):
            self.parsed_data['radar_data'] = self._parse_radar_data(data)
        # 检测空域批复数据
        elif any(k in keys for k in ['approval', '批复', 'start_time', 'end_time', '开始时间', '结束时间']):
            self.parsed_data['airspace_approvals'] = self._parse_airspace_data(data)
        # 检测作业点位数据
        elif any(k in keys for k in ['operation_point', '作业点', '点位', 'equipment', '设备']):
            self.parsed_data['operation_points'] = self._parse_points_data(data)
        # 检测弹药库存数据
        elif any(k in keys for k in ['batch', '批号', 'ammunition', '弹药', 'inventory', '库存']):
            self.parsed_data['ammunition_inventory'] = self._parse_ammunition_data(data)
        # 检测人员资质数据
        elif any(k in keys for k in ['qualification', '资质', 'personnel', '人员', 'expiry', '有效期']):
            self.parsed_data['personnel_qualifications'] = self._parse_personnel_data(data)
    
    def _parse_datetime(self, datetime_str: str) -> Optional[datetime]:
        """
        解析日期时间字符串
        
        Args:
            datetime_str: 日期时间字符串
            
        Returns:
            datetime对象或None
        """
        if not datetime_str:
            return None
        
        # 尝试多种格式
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d %H:%M',
            '%Y-%m-%d',
            '%Y/%m/%d %H:%M:%S',
            '%Y/%m/%d %H:%M',
            '%Y/%m/%d',
            '%Y年%m月%d日 %H:%M:%S',
            '%Y年%m月%d日 %H:%M',
            '%Y年%m月%d日'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(str(datetime_str).strip(), fmt)
            except ValueError:
                continue
        
        return None
    
    def get_parsed_data(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        获取解析后的数据
        
        Returns:
            解析后的数据字典
        """
        return self.parsed_data
    
    def clear_data(self):
        """清除所有数据"""
        self.parsed_data = {
            'radar_data': [],
            'airspace_approvals': [],
            'operation_points': [],
            'ammunition_inventory': [],
            'personnel_qualifications': []
        }
