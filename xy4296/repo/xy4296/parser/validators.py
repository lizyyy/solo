#!/usr/bin/env python3
"""
数据验证模块
负责验证导入数据的完整性和正确性
"""

from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple


class DataValidator:
    """数据验证器类"""
    
    def __init__(self):
        """初始化数据验证器"""
        self.errors = []
        self.warnings = []
    
    def validate_all(self, parsed_data: Dict[str, List[Dict[str, Any]]]) -> Tuple[bool, List[Dict[str, Any]]]:
        """
        验证所有数据
        
        Args:
            parsed_data: 解析后的数据字典
            
        Returns:
            (是否通过验证, 错误列表)
        """
        self.errors = []
        self.warnings = []
        
        # 验证雷达数据
        if parsed_data.get('radar_data'):
            self._validate_radar_data(parsed_data['radar_data'])
        
        # 验证空域批复数据
        if parsed_data.get('airspace_approvals'):
            self._validate_airspace_data(parsed_data['airspace_approvals'])
        
        # 验证作业点位数据
        if parsed_data.get('operation_points'):
            self._validate_points_data(parsed_data['operation_points'])
        
        # 验证弹药库存数据
        if parsed_data.get('ammunition_inventory'):
            self._validate_ammunition_data(parsed_data['ammunition_inventory'])
        
        # 验证人员资质数据
        if parsed_data.get('personnel_qualifications'):
            self._validate_personnel_data(parsed_data['personnel_qualifications'])
        
        # 验证数据关联性
        self._validate_data_relationships(parsed_data)
        
        is_valid = len(self.errors) == 0
        return is_valid, self.errors + self.warnings
    
    def _validate_radar_data(self, data: List[Dict[str, Any]]):
        """
        验证雷达数据
        
        Args:
            data: 雷达数据列表
        """
        for i, item in enumerate(data):
            # 验证必要字段
            if not item.get('time'):
                self._add_error('radar_data', i, '缺少时间字段')
            
            # 验证经纬度范围
            latitude = item.get('latitude', 0)
            longitude = item.get('longitude', 0)
            
            if latitude < -90 or latitude > 90:
                self._add_error('radar_data', i, f'纬度值 {latitude} 超出有效范围 (-90 到 90)')
            
            if longitude < -180 or longitude > 180:
                self._add_error('radar_data', i, f'经度值 {longitude} 超出有效范围 (-180 到 180)')
            
            # 验证反射率值
            reflectivity = item.get('reflectivity', 0)
            if reflectivity < -10 or reflectivity > 80:
                self._add_warning('radar_data', i, f'反射率值 {reflectivity} 超出常规范围 (-10 到 80)')
            
            # 验证移动方向
            direction = item.get('movement_direction', 0)
            if direction < 0 or direction > 360:
                self._add_error('radar_data', i, f'移动方向 {direction} 超出有效范围 (0 到 360)')
    
    def _validate_airspace_data(self, data: List[Dict[str, Any]]):
        """
        验证空域批复数据
        
        Args:
            data: 空域批复数据列表
        """
        for i, item in enumerate(data):
            # 验证必要字段
            if not item.get('approval_number'):
                self._add_error('airspace_approvals', i, '缺少批复编号')
            
            if not item.get('start_time'):
                self._add_error('airspace_approvals', i, '缺少开始时间')
            
            if not item.get('end_time'):
                self._add_error('airspace_approvals', i, '缺少结束时间')
            
            # 验证时间顺序
            start_time = item.get('start_time')
            end_time = item.get('end_time')
            
            if start_time and end_time and start_time >= end_time:
                self._add_error('airspace_approvals', i, '开始时间晚于或等于结束时间')
            
            # 验证高度范围
            alt_min = item.get('altitude_min', 0)
            alt_max = item.get('altitude_max', 0)
            
            if alt_min < 0:
                self._add_error('airspace_approvals', i, f'最低高度 {alt_min} 不能为负值')
            
            if alt_max <= alt_min:
                self._add_error('airspace_approvals', i, f'最高高度 {alt_max} 必须大于最低高度 {alt_min}')
            
            # 检查是否已过期
            if end_time:
                now = datetime.now()
                if end_time < now:
                    self._add_warning('airspace_approvals', i, '空域批复已过期')
    
    def _validate_points_data(self, data: List[Dict[str, Any]]):
        """
        验证作业点位数据
        
        Args:
            data: 作业点位数据列表
        """
        for i, item in enumerate(data):
            # 验证必要字段
            if not item.get('name'):
                self._add_error('operation_points', i, '缺少点位名称')
            
            # 验证经纬度范围
            latitude = item.get('latitude', 0)
            longitude = item.get('longitude', 0)
            
            if latitude < -90 or latitude > 90:
                self._add_error('operation_points', i, f'纬度值 {latitude} 超出有效范围 (-90 到 90)')
            
            if longitude < -180 or longitude > 180:
                self._add_error('operation_points', i, f'经度值 {longitude} 超出有效范围 (-180 到 180)')
            
            # 验证海拔
            altitude = item.get('altitude', 0)
            if altitude < -500 or altitude > 9000:
                self._add_warning('operation_points', i, f'海拔值 {altitude} 超出常规范围 (-500 到 9000)')
    
    def _validate_ammunition_data(self, data: List[Dict[str, Any]]):
        """
        验证弹药库存数据
        
        Args:
            data: 弹药库存数据列表
        """
        for i, item in enumerate(data):
            # 验证必要字段
            if not item.get('batch_number'):
                self._add_error('ammunition_inventory', i, '缺少批号')
            
            if not item.get('type'):
                self._add_error('ammunition_inventory', i, '缺少弹药类型')
            
            # 验证数量
            quantity = item.get('quantity', 0)
            if quantity < 0:
                self._add_error('ammunition_inventory', i, f'数量 {quantity} 不能为负值')
            
            if quantity == 0:
                self._add_warning('ammunition_inventory', i, '库存数量为0')
            
            # 验证有效期
            expiry_date = item.get('expiry_date')
            if expiry_date:
                now = datetime.now()
                if expiry_date < now:
                    self._add_error('ammunition_inventory', i, '弹药已过期')
                elif (expiry_date - now).days < 30:
                    self._add_warning('ammunition_inventory', i, '弹药即将过期（30天内）')
    
    def _validate_personnel_data(self, data: List[Dict[str, Any]]):
        """
        验证人员资质数据
        
        Args:
            data: 人员资质数据列表
        """
        for i, item in enumerate(data):
            # 验证必要字段
            if not item.get('name'):
                self._add_error('personnel_qualifications', i, '缺少姓名')
            
            if not item.get('qualification_type'):
                self._add_error('personnel_qualifications', i, '缺少资质类型')
            
            if not item.get('qualification_number'):
                self._add_error('personnel_qualifications', i, '缺少资质编号')
            
            # 验证有效期
            expiry_date = item.get('expiry_date')
            if expiry_date:
                now = datetime.now()
                if expiry_date < now:
                    self._add_error('personnel_qualifications', i, '资质已过期')
                elif (expiry_date - now).days < 90:
                    self._add_warning('personnel_qualifications', i, '资质即将过期（90天内）')
            
            # 验证颁发日期和有效期关系
            issue_date = item.get('issue_date')
            if issue_date and expiry_date and issue_date >= expiry_date:
                self._add_error('personnel_qualifications', i, '颁发日期晚于或等于有效期')
    
    def _validate_data_relationships(self, parsed_data: Dict[str, List[Dict[str, Any]]]):
        """
        验证数据之间的关联性
        
        Args:
            parsed_data: 解析后的数据字典
        """
        # 检查空域批复引用的作业点位是否存在
        operation_points = parsed_data.get('operation_points', [])
        point_names = {p.get('name') for p in operation_points if p.get('name')}
        point_codes = {p.get('code') for p in operation_points if p.get('code')}
        
        airspace_approvals = parsed_data.get('airspace_approvals', [])
        for i, approval in enumerate(airspace_approvals):
            operation_point = approval.get('operation_point', '')
            if operation_point and operation_point not in point_names and operation_point not in point_codes:
                self._add_warning('airspace_approvals', i, f'引用的作业点位 "{operation_point}" 在点位数据中未找到')
    
    def _add_error(self, data_type: str, index: int, message: str):
        """
        添加错误
        
        Args:
            data_type: 数据类型
            index: 数据索引
            message: 错误消息
        """
        self.errors.append({
            'type': 'error',
            'data_type': data_type,
            'index': index,
            'message': message
        })
    
    def _add_warning(self, data_type: str, index: int, message: str):
        """
        添加警告
        
        Args:
            data_type: 数据类型
            index: 数据索引
            message: 警告消息
        """
        self.warnings.append({
            'type': 'warning',
            'data_type': data_type,
            'index': index,
            'message': message
        })
    
    def get_errors(self) -> List[Dict[str, Any]]:
        """
        获取错误列表
        
        Returns:
            错误列表
        """
        return self.errors
    
    def get_warnings(self) -> List[Dict[str, Any]]:
        """
        获取警告列表
        
        Returns:
            警告列表
        """
        return self.warnings
    
    def clear(self):
        """清除所有错误和警告"""
        self.errors = []
        self.warnings = []
