#!/usr/bin/env python3
"""
规则引擎模块
负责检查禁飞时段、风向影响区、库存批号、资质过期等风险
"""

from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import math


class RuleEngine:
    """规则引擎类"""
    
    def __init__(self):
        """初始化规则引擎"""
        self.rules = {
            'no_fly_time': True,
            'wind_impact_zone': True,
            'ammunition_expiry': True,
            'qualification_expiry': True,
            'radar_threat': True
        }
        self.risks = []
    
    def check_all_rules(self, parsed_data: Dict[str, List[Dict[str, Any]]], 
                        operation_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        检查所有规则
        
        Args:
            parsed_data: 解析后的数据字典
            operation_time: 计划作业时间（如果为None则使用当前时间）
            
        Returns:
            风险列表
        """
        self.risks = []
        if operation_time is None:
            operation_time = datetime.now()
        
        # 检查禁飞时段
        if self.rules['no_fly_time']:
            self._check_no_fly_time(parsed_data.get('airspace_approvals', []), operation_time)
        
        # 检查风向影响区
        if self.rules['wind_impact_zone']:
            self._check_wind_impact_zone(
                parsed_data.get('radar_data', []),
                parsed_data.get('operation_points', []),
                operation_time
            )
        
        # 检查弹药库存
        if self.rules['ammunition_expiry']:
            self._check_ammunition_expiry(parsed_data.get('ammunition_inventory', []), operation_time)
        
        # 检查人员资质
        if self.rules['qualification_expiry']:
            self._check_qualification_expiry(parsed_data.get('personnel_qualifications', []), operation_time)
        
        # 检查雷达威胁
        if self.rules['radar_threat']:
            self._check_radar_threat(parsed_data.get('radar_data', []), operation_time)
        
        return self.risks
    
    def _check_no_fly_time(self, airspace_approvals: List[Dict[str, Any]], 
                           operation_time: datetime):
        """
        检查禁飞时段
        
        Args:
            airspace_approvals: 空域批复数据列表
            operation_time: 计划作业时间
        """
        if not airspace_approvals:
            self._add_risk(
                'critical',
                'no_fly_time',
                '无空域批复数据',
                '无法确认作业时段是否在禁飞时段内',
                None
            )
            return
        
        # 检查是否有有效的空域批复覆盖作业时间
        valid_approvals = []
        for i, approval in enumerate(airspace_approvals):
            start_time = approval.get('start_time')
            end_time = approval.get('end_time')
            status = approval.get('status', 'approved')
            
            if status != 'approved':
                continue
            
            if start_time and end_time:
                if start_time <= operation_time <= end_time:
                    valid_approvals.append(approval)
        
        if not valid_approvals:
            self._add_risk(
                'critical',
                'no_fly_time',
                '当前时段无有效空域批复',
                f'计划作业时间 {operation_time.strftime("%Y-%m-%d %H:%M")} 不在任何有效空域批复时段内',
                None
            )
        else:
            for approval in valid_approvals:
                approval_number = approval.get('approval_number', '未知')
                start_time = approval.get('start_time')
                end_time = approval.get('end_time')
                
                # 检查接近过期
                if end_time:
                    time_remaining = end_time - operation_time
                    if time_remaining < timedelta(minutes=30):
                        self._add_risk(
                            'warning',
                            'no_fly_time',
                            '空域批复即将过期',
                            f'空域批复 {approval_number} 将在 {time_remaining.total_seconds()/60:.0f} 分钟后过期',
                            approval
                        )
    
    def _check_wind_impact_zone(self, radar_data: List[Dict[str, Any]],
                                  operation_points: List[Dict[str, Any]],
                                  operation_time: datetime):
        """
        检查风向影响区
        
        Args:
            radar_data: 雷达数据列表
            operation_points: 作业点位列表
            operation_time: 计划作业时间
        """
        if not radar_data:
            self._add_risk(
                'warning',
                'wind_impact_zone',
                '无雷达回波数据',
                '无法评估风向影响区风险',
                None
            )
            return
        
        if not operation_points:
            self._add_risk(
                'warning',
                'wind_impact_zone',
                '无作业点位数据',
                '无法评估风向影响区风险',
                None
            )
            return
        
        # 分析雷达数据中的风暴移动
        for i, radar in enumerate(radar_data):
            reflectivity = radar.get('reflectivity', 0)
            movement_direction = radar.get('movement_direction', 0)
            movement_speed = radar.get('movement_speed', 0)
            radar_lat = radar.get('latitude', 0)
            radar_lon = radar.get('longitude', 0)
            
            # 只关注有威胁的回波（反射率>30dBZ）
            if reflectivity < 30:
                continue
            
            # 计算风暴可能影响的区域
            for j, point in enumerate(operation_points):
                point_lat = point.get('latitude', 0)
                point_lon = point.get('longitude', 0)
                point_name = point.get('name', f'点位{j+1}')
                
                # 计算两点之间的距离和方向
                distance, direction_to_point = self._calculate_distance_and_direction(
                    radar_lat, radar_lon, point_lat, point_lon
                )
                
                # 检查风暴移动方向是否朝向作业点位
                # 允许±45度的误差
                direction_diff = abs((movement_direction - direction_to_point + 180) % 360 - 180)
                
                if direction_diff <= 45:
                    # 计算风暴到达时间（假设速度单位为km/h）
                    if movement_speed > 0:
                        time_to_arrival = distance / movement_speed  # 小时
                        
                        if time_to_arrival < 2:  # 2小时内可能到达
                            risk_level = 'critical' if time_to_arrival < 0.5 else 'high' if time_to_arrival < 1 else 'medium'
                            
                            self._add_risk(
                                risk_level,
                                'wind_impact_zone',
                                '风暴可能影响作业点位',
                                f'风暴（反射率{reflectivity}dBZ）正以{movement_speed}km/h向{point_name}移动，预计{time_to_arrival*60:.0f}分钟后到达',
                                {
                                    'radar': radar,
                                    'operation_point': point,
                                    'distance_km': distance,
                                    'time_to_arrival_minutes': time_to_arrival * 60
                                }
                            )
    
    def _check_ammunition_expiry(self, ammunition_inventory: List[Dict[str, Any]],
                                   operation_time: datetime):
        """
        检查弹药库存批号和过期情况
        
        Args:
            ammunition_inventory: 弹药库存数据列表
            operation_time: 计划作业时间
        """
        if not ammunition_inventory:
            self._add_risk(
                'critical',
                'ammunition_expiry',
                '无弹药库存数据',
                '无法确认弹药是否可用',
                None
            )
            return
        
        # 检查每个弹药批次
        batch_numbers = set()
        for i, ammo in enumerate(ammunition_inventory):
            batch_number = ammo.get('batch_number', f'批次{i+1}')
            ammo_type = ammo.get('type', '未知类型')
            quantity = ammo.get('quantity', 0)
            expiry_date = ammo.get('expiry_date')
            status = ammo.get('status', 'normal')
            
            # 检查重复批号
            if batch_number in batch_numbers:
                self._add_risk(
                    'warning',
                    'ammunition_expiry',
                    '重复的弹药批号',
                    f'弹药批号 {batch_number} 出现多次',
                    ammo
                )
            batch_numbers.add(batch_number)
            
            # 检查库存数量
            if quantity <= 0:
                self._add_risk(
                    'high',
                    'ammunition_expiry',
                    '弹药库存不足',
                    f'{ammo_type}（批号：{batch_number}）库存数量为 {quantity}',
                    ammo
                )
            
            # 检查状态
            if status != 'normal':
                self._add_risk(
                    'high',
                    'ammunition_expiry',
                    '弹药状态异常',
                    f'{ammo_type}（批号：{batch_number}）状态为 {status}',
                    ammo
                )
            
            # 检查有效期
            if expiry_date:
                if expiry_date < operation_time:
                    self._add_risk(
                        'critical',
                        'ammunition_expiry',
                        '弹药已过期',
                        f'{ammo_type}（批号：{batch_number}）有效期至 {expiry_date.strftime("%Y-%m-%d")}，已过期',
                        ammo
                    )
                else:
                    # 检查即将过期（30天内）
                    days_remaining = (expiry_date - operation_time).days
                    if days_remaining < 30:
                        self._add_risk(
                            'warning',
                            'ammunition_expiry',
                            '弹药即将过期',
                            f'{ammo_type}（批号：{batch_number}）将在 {days_remaining} 天后过期',
                            ammo
                        )
    
    def _check_qualification_expiry(self, personnel_qualifications: List[Dict[str, Any]],
                                      operation_time: datetime):
        """
        检查人员资质过期情况
        
        Args:
            personnel_qualifications: 人员资质数据列表
            operation_time: 计划作业时间
        """
        if not personnel_qualifications:
            self._add_risk(
                'critical',
                'qualification_expiry',
                '无人员资质数据',
                '无法确认作业人员资质是否有效',
                None
            )
            return
        
        # 检查每个人员资质
        qualification_numbers = set()
        for i, personnel in enumerate(personnel_qualifications):
            name = personnel.get('name', f'人员{i+1}')
            qualification_type = personnel.get('qualification_type', '未知资质')
            qualification_number = personnel.get('qualification_number', f'编号{i+1}')
            expiry_date = personnel.get('expiry_date')
            status = personnel.get('status', 'valid')
            
            # 检查重复资质编号
            if qualification_number in qualification_numbers:
                self._add_risk(
                    'warning',
                    'qualification_expiry',
                    '重复的资质编号',
                    f'人员 {name} 的资质编号 {qualification_number} 出现多次',
                    personnel
                )
            qualification_numbers.add(qualification_number)
            
            # 检查状态
            if status != 'valid':
                self._add_risk(
                    'high',
                    'qualification_expiry',
                    '人员资质状态异常',
                    f'{name}（{qualification_type}）资质状态为 {status}',
                    personnel
                )
            
            # 检查有效期
            if expiry_date:
                if expiry_date < operation_time:
                    self._add_risk(
                        'critical',
                        'qualification_expiry',
                        '人员资质已过期',
                        f'{name} 的 {qualification_type} 资质有效期至 {expiry_date.strftime("%Y-%m-%d")}，已过期',
                        personnel
                    )
                else:
                    # 检查即将过期（90天内）
                    days_remaining = (expiry_date - operation_time).days
                    if days_remaining < 90:
                        self._add_risk(
                            'warning',
                            'qualification_expiry',
                            '人员资质即将过期',
                            f'{name} 的 {qualification_type} 资质将在 {days_remaining} 天后过期',
                            personnel
                        )
    
    def _check_radar_threat(self, radar_data: List[Dict[str, Any]],
                             operation_time: datetime):
        """
        检查雷达回波威胁
        
        Args:
            radar_data: 雷达数据列表
            operation_time: 计划作业时间
        """
        if not radar_data:
            return
        
        for i, radar in enumerate(radar_data):
            reflectivity = radar.get('reflectivity', 0)
            storm_type = radar.get('storm_type', '')
            risk_level = radar.get('risk_level', 'low')
            radar_time = radar.get('time')
            
            # 检查高反射率回波
            if reflectivity >= 50:
                self._add_risk(
                    'critical',
                    'radar_threat',
                    '强回波威胁',
                    f'检测到强回波（反射率{reflectivity}dBZ），类型：{storm_type or "未知"}',
                    radar
                )
            elif reflectivity >= 40:
                self._add_risk(
                    'high',
                    'radar_threat',
                    '较强回波',
                    f'检测到较强回波（反射率{reflectivity}dBZ），类型：{storm_type or "未知"}',
                    radar
                )
            elif reflectivity >= 30:
                self._add_risk(
                    'medium',
                    'radar_threat',
                    '中等强度回波',
                    f'检测到中等强度回波（反射率{reflectivity}dBZ），类型：{storm_type or "未知"}',
                    radar
                )
            
            # 检查数据时间
            if radar_time:
                time_diff = operation_time - radar_time
                if time_diff > timedelta(hours=2):
                    self._add_risk(
                        'warning',
                        'radar_threat',
                        '雷达数据过时',
                        f'雷达数据时间为 {radar_time.strftime("%Y-%m-%d %H:%M")}，距今 {time_diff.total_seconds()/3600:.1f} 小时',
                        radar
                    )
    
    def _calculate_distance_and_direction(self, lat1: float, lon1: float,
                                            lat2: float, lon2: float) -> Tuple[float, float]:
        """
        计算两点之间的距离（km）和方向（度）
        
        Args:
            lat1, lon1: 第一点的纬度和经度
            lat2, lon2: 第二点的纬度和经度
            
        Returns:
            (距离km, 方向度)
        """
        # 简化计算，假设在小范围内
        lat_diff = lat2 - lat1
        lon_diff = lon2 - lon1
        
        # 计算距离（简化版，1度纬度≈111km）
        distance_lat = lat_diff * 111.0
        distance_lon = lon_diff * 111.0 * math.cos(math.radians((lat1 + lat2) / 2))
        
        distance = math.sqrt(distance_lat ** 2 + distance_lon ** 2)
        
        # 计算方向（0-360度，0为北）
        if distance == 0:
            direction = 0.0
        else:
            direction = math.degrees(math.atan2(distance_lon, distance_lat))
            if direction < 0:
                direction += 360
        
        return distance, direction
    
    def _add_risk(self, severity: str, category: str, title: str, 
                  description: str, details: Any):
        """
        添加风险
        
        Args:
            severity: 严重程度 (critical, high, medium, warning, low)
            category: 风险类别
            title: 风险标题
            description: 风险描述
            details: 详细信息
        """
        self.risks.append({
            'severity': severity,
            'category': category,
            'title': title,
            'description': description,
            'details': details,
            'timestamp': datetime.now()
        })
    
    def enable_rule(self, rule_name: str):
        """
        启用规则
        
        Args:
            rule_name: 规则名称
        """
        if rule_name in self.rules:
            self.rules[rule_name] = True
    
    def disable_rule(self, rule_name: str):
        """
        禁用规则
        
        Args:
            rule_name: 规则名称
        """
        if rule_name in self.rules:
            self.rules[rule_name] = False
    
    def get_risks(self) -> List[Dict[str, Any]]:
        """
        获取风险列表
        
        Returns:
            风险列表
        """
        return self.risks
    
    def get_risks_by_severity(self, severity: str) -> List[Dict[str, Any]]:
        """
        按严重程度获取风险列表
        
        Args:
            severity: 严重程度
            
        Returns:
            风险列表
        """
        return [r for r in self.risks if r['severity'] == severity]
    
    def clear_risks(self):
        """清除所有风险"""
        self.risks = []
