"""
校验规则引擎
实现展品装箱的各种校验规则：漏扫、重复装箱、签名缺失、照片不匹配等
"""

import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict

from .models import (
    Exhibit, ScanRecord, PhotoRecord, Anomaly, ProjectData,
    ReviewComment
)


class BaseRule(ABC):
    """校验规则基类"""
    
    rule_name: str = ""
    rule_description: str = ""
    severity: str = "medium"  # 默认严重程度: critical, high, medium, low
    
    def __init__(self):
        self.anomalies: List[Anomaly] = []
    
    @abstractmethod
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        """
        执行校验
        
        Args:
            project_data: 项目数据
            
        Returns:
            List[Anomaly]: 检测到的异常列表
        """
        pass
    
    def _create_anomaly(
        self,
        anomaly_type: str,
        description: str,
        suggestion: str = "",
        exhibit_id: Optional[str] = None,
        box_number: Optional[str] = None,
        scan_id: Optional[str] = None,
        photo_id: Optional[str] = None,
        severity: Optional[str] = None
    ) -> Anomaly:
        """创建异常记录"""
        return Anomaly(
            anomaly_id=str(uuid.uuid4()),
            anomaly_type=anomaly_type,
            severity=severity or self.severity,
            exhibit_id=exhibit_id,
            box_number=box_number,
            scan_id=scan_id,
            photo_id=photo_id,
            description=description,
            suggestion=suggestion,
            detected_time=datetime.now()
        )


class MissingScanRule(BaseRule):
    """漏扫检查规则 - 检查展品清单中的展品是否有对应的扫描记录"""
    
    rule_name = "漏扫检查"
    rule_description = "检查展品清单中的展品是否都有对应的装箱扫描记录"
    severity = "critical"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        # 获取所有已扫描的展品编号
        scanned_exhibit_ids = set(scan.exhibit_id for scan in project_data.scan_records)
        
        # 检查每个展品是否有扫描记录
        for exhibit in project_data.exhibits:
            if exhibit.exhibit_id not in scanned_exhibit_ids:
                anomaly = self._create_anomaly(
                    anomaly_type="missing_scan",
                    description=f"展品 [{exhibit.exhibit_id}] {exhibit.name} 没有装箱扫描记录",
                    suggestion="请确认该展品是否已装箱，或补充扫描记录",
                    exhibit_id=exhibit.exhibit_id
                )
                anomalies.append(anomaly)
        
        return anomalies


class DuplicateBoxRule(BaseRule):
    """重复装箱检查规则 - 检查同一件展品是否被装进多个箱子"""
    
    rule_name = "重复装箱检查"
    rule_description = "检查同一件展品是否被扫描进多个不同的箱子"
    severity = "critical"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        # 按展品编号分组扫描记录
        exhibit_scans: Dict[str, List[ScanRecord]] = defaultdict(list)
        for scan in project_data.scan_records:
            exhibit_scans[scan.exhibit_id].append(scan)
        
        # 检查每个展品的箱号是否唯一
        for exhibit_id, scans in exhibit_scans.items():
            if len(scans) > 1:
                # 获取所有不同的箱号
                box_numbers = set(scan.box_number for scan in scans)
                if len(box_numbers) > 1:
                    # 获取展品信息
                    exhibit = project_data.get_exhibit_by_id(exhibit_id)
                    exhibit_name = exhibit.name if exhibit else "未知展品"
                    
                    # 按时间排序扫描记录
                    sorted_scans = sorted(scans, key=lambda s: s.scan_time)
                    scan_details = "\n".join([
                        f"  - 箱号 [{scan.box_number}] 扫描时间: {scan.scan_time.strftime('%Y-%m-%d %H:%M:%S')} 操作人: {scan.operator}"
                        for scan in sorted_scans
                    ])
                    
                    anomaly = self._create_anomaly(
                        anomaly_type="duplicate_box",
                        description=f"展品 [{exhibit_id}] {exhibit_name} 被扫描进多个箱子:\n{scan_details}",
                        suggestion="请核查哪次扫描是正确的，标记错误的扫描记录或重新扫描",
                        exhibit_id=exhibit_id,
                        scan_id=sorted_scans[-1].scan_id if sorted_scans else None
                    )
                    anomalies.append(anomaly)
        
        return anomalies


class MissingSignatureRule(BaseRule):
    """签名缺失检查规则 - 检查扫描记录是否有操作人员签名确认"""
    
    rule_name = "签名缺失检查"
    rule_description = "检查装箱扫描记录是否有操作人员的电子签名确认"
    severity = "high"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        for scan in project_data.scan_records:
            if not scan.has_signature:
                exhibit = project_data.get_exhibit_by_id(scan.exhibit_id)
                exhibit_name = exhibit.name if exhibit else "未知展品"
                
                anomaly = self._create_anomaly(
                    anomaly_type="missing_signature",
                    description=f"扫描记录 [{scan.scan_id}] 缺少操作人签名确认\n"
                               f"展品: [{scan.exhibit_id}] {exhibit_name}\n"
                               f"箱号: {scan.box_number}\n"
                               f"操作人: {scan.operator}\n"
                               f"扫描时间: {scan.scan_time.strftime('%Y-%m-%d %H:%M:%S')}",
                    suggestion="请联系操作人补充电子签名，或确认该记录的有效性",
                    exhibit_id=scan.exhibit_id,
                    box_number=scan.box_number,
                    scan_id=scan.scan_id
                )
                anomalies.append(anomaly)
        
        return anomalies


class PhotoMismatchRule(BaseRule):
    """照片证据不匹配检查规则 - 检查扫描记录引用的照片是否存在且匹配"""
    
    rule_name = "照片证据检查"
    rule_description = "检查扫描记录引用的照片是否存在，且与展品/箱号匹配"
    severity = "high"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        # 创建照片ID到照片记录的映射
        photo_map = {photo.photo_id: photo for photo in project_data.photo_records}
        
        # 创建文件名到照片记录的映射（用于备用匹配）
        photo_by_name = {photo.file_name: photo for photo in project_data.photo_records}
        
        for scan in project_data.scan_records:
            exhibit = project_data.get_exhibit_by_id(scan.exhibit_id)
            exhibit_name = exhibit.name if exhibit else "未知展品"
            
            # 检查每个照片引用
            for photo_ref in scan.photo_references:
                # 尝试按ID查找
                photo = photo_map.get(photo_ref)
                
                # 如果按ID找不到，尝试按文件名查找
                if not photo:
                    photo = photo_by_name.get(photo_ref)
                
                if not photo:
                    # 照片不存在
                    anomaly = self._create_anomaly(
                        anomaly_type="photo_missing",
                        description=f"扫描记录 [{scan.scan_id}] 引用的照片不存在\n"
                                   f"照片引用: {photo_ref}\n"
                                   f"展品: [{scan.exhibit_id}] {exhibit_name}\n"
                                   f"箱号: {scan.box_number}",
                        suggestion="请检查照片目录是否完整，或确认照片引用是否正确",
                        exhibit_id=scan.exhibit_id,
                        box_number=scan.box_number,
                        scan_id=scan.scan_id,
                        photo_id=photo_ref
                    )
                    anomalies.append(anomaly)
                else:
                    # 照片存在，检查关联性
                    is_exhibit_matched = scan.exhibit_id in photo.exhibit_references
                    is_box_matched = scan.box_number in photo.box_references
                    
                    if not (is_exhibit_matched or is_box_matched):
                        anomaly = self._create_anomaly(
                            anomaly_type="photo_mismatch",
                            description=f"扫描记录 [{scan.scan_id}] 引用的照片与展品/箱号不匹配\n"
                                       f"照片: {photo.file_name}\n"
                                       f"展品: [{scan.exhibit_id}] {exhibit_name}\n"
                                       f"箱号: {scan.box_number}\n"
                                       f"照片关联展品: {', '.join(photo.exhibit_references) or '无'}\n"
                                       f"照片关联箱号: {', '.join(photo.box_references) or '无'}",
                            suggestion="请确认照片是否对应正确的展品和箱号，可能需要重新拍摄或标注",
                            exhibit_id=scan.exhibit_id,
                            box_number=scan.box_number,
                            scan_id=scan.scan_id,
                            photo_id=photo.photo_id
                        )
                        anomalies.append(anomaly)
        
        return anomalies


class FragileBufferRule(BaseRule):
    """易碎品缓冲确认检查规则 - 检查易碎品是否有缓冲材料确认"""
    
    rule_name = "易碎品缓冲检查"
    rule_description = "检查易碎品的装箱扫描记录是否有缓冲材料确认"
    severity = "high"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        # 获取所有易碎品
        fragile_exhibits = [e for e in project_data.exhibits if e.is_fragile]
        
        # 创建展品ID到扫描记录的映射
        exhibit_scans: Dict[str, List[ScanRecord]] = defaultdict(list)
        for scan in project_data.scan_records:
            exhibit_scans[scan.exhibit_id].append(scan)
        
        for exhibit in fragile_exhibits:
            scans = exhibit_scans.get(exhibit.exhibit_id, [])
            
            if not scans:
                # 没有扫描记录（会被漏扫规则捕获），这里跳过
                continue
            
            # 检查所有扫描记录是否有缓冲确认
            for scan in scans:
                if not scan.buffer_verified:
                    anomaly = self._create_anomaly(
                        anomaly_type="fragile_buffer_missing",
                        description=f"易碎品 [{exhibit.exhibit_id}] {exhibit.name} 缺少缓冲材料确认\n"
                                   f"扫描记录: {scan.scan_id}\n"
                                   f"箱号: {scan.box_number}\n"
                                   f"操作人: {scan.operator}",
                        suggestion="易碎品装箱必须使用缓冲材料（气泡膜、珍珠棉等），请补充确认",
                        exhibit_id=exhibit.exhibit_id,
                        box_number=scan.box_number,
                        scan_id=scan.scan_id
                    )
                    anomalies.append(anomaly)
        
        return anomalies


class TemperatureHumidityRule(BaseRule):
    """温湿度记录检查规则 - 检查需要温湿度控制的展品是否有温湿度记录"""
    
    rule_name = "温湿度记录检查"
    rule_description = "检查特殊要求的展品是否有装箱时的温湿度记录"
    severity = "medium"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        # 获取有特殊温湿度要求的展品
        # 检查 special_requirements 中是否包含温湿度相关关键词
        temp_humidity_keywords = ['温湿度', '温度', '湿度', 'temperature', 'humidity', '恒温', '恒湿']
        
        for exhibit in project_data.exhibits:
            has_temp_requirement = False
            
            # 检查特殊要求字段
            if exhibit.special_requirements:
                req_lower = exhibit.special_requirements.lower()
                for keyword in temp_humidity_keywords:
                    if keyword.lower() in req_lower:
                        has_temp_requirement = True
                        break
            
            # 高价值展品也可能需要温湿度记录
            if exhibit.estimated_value > 100000:  # 价值超过10万
                has_temp_requirement = True
            
            if has_temp_requirement:
                # 获取该展品的扫描记录
                scans = [s for s in project_data.scan_records if s.exhibit_id == exhibit.exhibit_id]
                
                for scan in scans:
                    if scan.temperature is None or scan.humidity is None:
                        temp_status = "缺失" if scan.temperature is None else f"{scan.temperature}°C"
                        humidity_status = "缺失" if scan.humidity is None else f"{scan.humidity}%"
                        
                        anomaly = self._create_anomaly(
                            anomaly_type="temp_humidity_missing",
                            description=f"展品 [{exhibit.exhibit_id}] {exhibit.name} 缺少温湿度记录\n"
                                       f"当前记录 - 温度: {temp_status}, 湿度: {humidity_status}\n"
                                       f"扫描记录: {scan.scan_id}\n"
                                       f"箱号: {scan.box_number}",
                            suggestion="请补充装箱时的温湿度记录，确保展品运输环境符合要求",
                            exhibit_id=exhibit.exhibit_id,
                            box_number=scan.box_number,
                            scan_id=scan.scan_id
                        )
                        anomalies.append(anomaly)
        
        return anomalies


class UnknownExhibitRule(BaseRule):
    """未知展品检查规则 - 检查扫描记录中的展品是否在展品清单中"""
    
    rule_name = "未知展品检查"
    rule_description = "检查扫描记录中的展品编号是否存在于展品清单中"
    severity = "high"
    
    def validate(self, project_data: ProjectData) -> List[Anomaly]:
        anomalies = []
        
        # 获取展品清单中的所有展品编号
        valid_exhibit_ids = set(e.exhibit_id for e in project_data.exhibits)
        
        # 检查每个扫描记录
        for scan in project_data.scan_records:
            if scan.exhibit_id not in valid_exhibit_ids:
                anomaly = self._create_anomaly(
                    anomaly_type="unknown_exhibit",
                    description=f"扫描记录 [{scan.scan_id}] 中的展品编号不在展品清单中\n"
                               f"展品编号: {scan.exhibit_id}\n"
                               f"箱号: {scan.box_number}\n"
                               f"操作人: {scan.operator}\n"
                               f"扫描时间: {scan.scan_time.strftime('%Y-%m-%d %H:%M:%S')}",
                    suggestion="请检查展品编号是否输入错误，或确认该展品是否属于本次撤展范围",
                    exhibit_id=scan.exhibit_id,
                    box_number=scan.box_number,
                    scan_id=scan.scan_id
                )
                anomalies.append(anomaly)
        
        return anomalies


class RuleEngine:
    """规则引擎 - 管理和执行所有校验规则"""
    
    # 所有可用的规则类
    RULE_CLASSES = [
        MissingScanRule,
        DuplicateBoxRule,
        MissingSignatureRule,
        PhotoMismatchRule,
        FragileBufferRule,
        TemperatureHumidityRule,
        UnknownExhibitRule,
    ]
    
    def __init__(self):
        self.rules: List[BaseRule] = [rule_class() for rule_class in self.RULE_CLASSES]
        self.execution_history: List[Dict[str, Any]] = []
    
    def register_rule(self, rule: BaseRule):
        """注册新规则"""
        self.rules.append(rule)
    
    def validate_all(self, project_data: ProjectData) -> Tuple[List[Anomaly], Dict[str, Any]]:
        """
        执行所有规则校验
        
        Args:
            project_data: 项目数据
            
        Returns:
            Tuple[List[Anomaly], Dict[str, Any]]: (所有异常列表, 执行统计信息)
        """
        all_anomalies: List[Anomaly] = []
        execution_stats = {
            'total_rules': len(self.rules),
            'rules_executed': 0,
            'total_anomalies': 0,
            'by_severity': {
                'critical': 0,
                'high': 0,
                'medium': 0,
                'low': 0
            },
            'by_type': defaultdict(int),
            'rule_results': []
        }
        
        start_time = datetime.now()
        
        for rule in self.rules:
            rule_start = datetime.now()
            anomalies = rule.validate(project_data)
            rule_end = datetime.now()
            
            all_anomalies.extend(anomalies)
            
            # 统计
            execution_stats['rules_executed'] += 1
            execution_stats['total_anomalies'] += len(anomalies)
            
            for anomaly in anomalies:
                execution_stats['by_severity'][anomaly.severity] += 1
                execution_stats['by_type'][anomaly.anomaly_type] += 1
            
            execution_stats['rule_results'].append({
                'rule_name': rule.rule_name,
                'anomaly_count': len(anomalies),
                'execution_time_ms': (rule_end - rule_start).total_seconds() * 1000
            })
        
        end_time = datetime.now()
        execution_stats['total_execution_time_ms'] = (end_time - start_time).total_seconds() * 1000
        
        # 记录执行历史
        self.execution_history.append({
            'timestamp': start_time.isoformat(),
            'project_name': project_data.project_name,
            'stats': execution_stats
        })
        
        return all_anomalies, execution_stats
    
    def validate_by_names(self, project_data: ProjectData, rule_names: List[str]) -> Tuple[List[Anomaly], Dict[str, Any]]:
        """
        只执行指定名称的规则
        
        Args:
            project_data: 项目数据
            rule_names: 要执行的规则名称列表
            
        Returns:
            Tuple[List[Anomaly], Dict[str, Any]]: (异常列表, 执行统计)
        """
        # 过滤出指定的规则
        original_rules = self.rules
        self.rules = [r for r in self.rules if r.rule_name in rule_names]
        
        try:
            return self.validate_all(project_data)
        finally:
            # 恢复原始规则列表
            self.rules = original_rules
    
    def get_available_rules(self) -> List[Dict[str, str]]:
        """获取所有可用规则的信息"""
        return [
            {
                'name': rule.rule_name,
                'description': rule.rule_description,
                'severity': rule.severity
            }
            for rule in self.rules
        ]
