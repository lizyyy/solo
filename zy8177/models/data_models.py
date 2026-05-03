#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据模型定义
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
import copy


class VisualFieldTest:
    """
    视野检查数据模型
    表示单次 Humphrey 视野检查的结果
    """
    
    def __init__(self):
        # 基本信息
        self.test_id: str = ""
        self.patient_id: str = ""
        self.patient_name: str = ""
        self.test_date: Optional[datetime] = None
        self.eye: str = ""  # "left" 或 "right"
        
        # 检查参数
        self.strategy: str = ""  # 检查策略，如 "SITA-Standard"
        self.algorithm: str = ""  # 检查算法
        self.pupil_size: float = 0.0  # 瞳孔大小
        self.visual_acuity: str = ""  # 视力
        self.refraction: str = ""  # 验光结果
        
        # 可靠性指标
        self.fixation_losses: int = 0  # 固视丢失次数
        self.fixation_total: int = 0  # 固视检查总次数
        self.false_positives: int = 0  # 假阳性次数
        self.false_positive_total: int = 0  # 假阳性检查总次数
        self.false_negatives: int = 0  # 假阴性次数
        self.false_negative_total: int = 0  # 假阴性检查总次数
        
        # 全局指标
        self.md: float = 0.0  # 平均缺损 Mean Deviation
        self.psd: float = 0.0  # 模式标准差 Pattern Standard Deviation
        self.vfi: float = 0.0  # 视野指数 Visual Field Index
        
        # 点位数据
        self.points: List[Dict[str, Any]] = []
        # 每个点位包含:
        # - x: 水平位置
        # - y: 垂直位置
        # - value: 阈值
        # - td: 总偏差 Total Deviation
        # - pd: 模式偏差 Pattern Deviation
        # - td_p: 总偏差概率值
        # - pd_p: 模式偏差概率值
        # - location: 点位编号/位置
        
        # 聚类信息（用于进展分析）
        self.clusters: List[Dict[str, Any]] = []
        
        # 原始数据
        self.raw_data: Dict[str, Any] = {}
        
    def get_fixation_loss_rate(self) -> float:
        """获取固视丢失率"""
        if self.fixation_total > 0:
            return self.fixation_losses / self.fixation_total
        return 0.0
    
    def get_false_positive_rate(self) -> float:
        """获取假阳性率"""
        if self.false_positive_total > 0:
            return self.false_positives / self.false_positive_total
        return 0.0
    
    def get_false_negative_rate(self) -> float:
        """获取假阴性率"""
        if self.false_negative_total > 0:
            return self.false_negatives / self.false_negative_total
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'test_id': self.test_id,
            'patient_id': self.patient_id,
            'patient_name': self.patient_name,
            'test_date': self.test_date.isoformat() if self.test_date else None,
            'eye': self.eye,
            'strategy': self.strategy,
            'algorithm': self.algorithm,
            'pupil_size': self.pupil_size,
            'visual_acuity': self.visual_acuity,
            'refraction': self.refraction,
            'fixation_losses': self.fixation_losses,
            'fixation_total': self.fixation_total,
            'false_positives': self.false_positives,
            'false_positive_total': self.false_positive_total,
            'false_negatives': self.false_negatives,
            'false_negative_total': self.false_negative_total,
            'md': self.md,
            'psd': self.psd,
            'vfi': self.vfi,
            'points': self.points,
            'clusters': self.clusters,
            'raw_data': self.raw_data
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'VisualFieldTest':
        """从字典创建实例"""
        test = cls()
        test.test_id = data.get('test_id', '')
        test.patient_id = data.get('patient_id', '')
        test.patient_name = data.get('patient_name', '')
        
        test_date_str = data.get('test_date')
        if test_date_str:
            try:
                test.test_date = datetime.fromisoformat(test_date_str)
            except:
                pass
        
        test.eye = data.get('eye', '')
        test.strategy = data.get('strategy', '')
        test.algorithm = data.get('algorithm', '')
        test.pupil_size = data.get('pupil_size', 0.0)
        test.visual_acuity = data.get('visual_acuity', '')
        test.refraction = data.get('refraction', '')
        
        test.fixation_losses = data.get('fixation_losses', 0)
        test.fixation_total = data.get('fixation_total', 0)
        test.false_positives = data.get('false_positives', 0)
        test.false_positive_total = data.get('false_positive_total', 0)
        test.false_negatives = data.get('false_negatives', 0)
        test.false_negative_total = data.get('false_negative_total', 0)
        
        test.md = data.get('md', 0.0)
        test.psd = data.get('psd', 0.0)
        test.vfi = data.get('vfi', 0.0)
        
        test.points = data.get('points', [])
        test.clusters = data.get('clusters', [])
        test.raw_data = data.get('raw_data', {})
        
        return test


class PatientData:
    """
    患者数据模型
    包含患者信息和多次视野检查结果
    """
    
    def __init__(self):
        # 患者基本信息
        self.patient_id: str = ""
        self.patient_name: str = ""
        self.date_of_birth: Optional[datetime] = None
        self.gender: str = ""
        
        # 当前检查数据
        self.left_eye: Optional[VisualFieldTest] = None
        self.right_eye: Optional[VisualFieldTest] = None
        
        # 历史检查数据
        self.left_eye_history: List[VisualFieldTest] = []
        self.right_eye_history: List[VisualFieldTest] = []
        
        # 附加信息
        self.diagnosis: str = ""
        self.notes: str = ""
        self.metadata: Dict[str, Any] = {}
        
    def get_latest_test_date(self) -> Optional[str]:
        """获取最新的检查日期"""
        dates = []
        
        if self.left_eye and self.left_eye.test_date:
            dates.append(self.left_eye.test_date)
        if self.right_eye and self.right_eye.test_date:
            dates.append(self.right_eye.test_date)
        
        # 添加历史数据中的日期
        for history in [self.left_eye_history, self.right_eye_history]:
            for test in history:
                if test.test_date:
                    dates.append(test.test_date)
        
        if dates:
            latest = max(dates)
            return latest.strftime('%Y-%m-%d')
        return None
    
    def get_sorted_history(self, eye: str) -> List[VisualFieldTest]:
        """
        获取排序后的历史数据
        按检查日期从旧到新排序
        """
        history = []
        if eye == 'left':
            history = copy.copy(self.left_eye_history)
            if self.left_eye:
                history.append(self.left_eye)
        elif eye == 'right':
            history = copy.copy(self.right_eye_history)
            if self.right_eye:
                history.append(self.right_eye)
        
        # 按日期排序
        history.sort(key=lambda x: x.test_date if x.test_date else datetime.min)
        return history
    
    def merge(self, other: 'PatientData'):
        """
        合并另一个患者数据
        """
        # 基本信息
        if not self.patient_id:
            self.patient_id = other.patient_id
        if not self.patient_name:
            self.patient_name = other.patient_name
        if not self.date_of_birth:
            self.date_of_birth = other.date_of_birth
        if not self.gender:
            self.gender = other.gender
        
        # 当前检查数据
        if other.left_eye:
            if self.left_eye is None:
                self.left_eye = other.left_eye
            else:
                # 将当前数据移入历史
                self.left_eye_history.append(self.left_eye)
                self.left_eye = other.left_eye
        
        if other.right_eye:
            if self.right_eye is None:
                self.right_eye = other.right_eye
            else:
                # 将当前数据移入历史
                self.right_eye_history.append(self.right_eye)
                self.right_eye = other.right_eye
        
        # 历史数据
        self.left_eye_history.extend(other.left_eye_history)
        self.right_eye_history.extend(other.right_eye_history)
        
        # 去重和排序历史数据
        self.left_eye_history = self._deduplicate_history(self.left_eye_history)
        self.right_eye_history = self._deduplicate_history(self.right_eye_history)
        
        # 附加信息
        if not self.diagnosis:
            self.diagnosis = other.diagnosis
        if not self.notes:
            self.notes = other.notes
        
        # 合并元数据
        self.metadata.update(other.metadata)
        
    def _deduplicate_history(self, history: List[VisualFieldTest]) -> List[VisualFieldTest]:
        """去重历史数据"""
        seen = set()
        result = []
        
        for test in history:
            # 使用 test_id 或 test_date + eye 作为唯一标识
            key = test.test_id
            if not key:
                key = f"{test.test_date}_{test.eye}" if test.test_date else f"{id(test)}"
            
            if key not in seen:
                seen.add(key)
                result.append(test)
        
        return result
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'patient_id': self.patient_id,
            'patient_name': self.patient_name,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'gender': self.gender,
            'left_eye': self.left_eye.to_dict() if self.left_eye else None,
            'right_eye': self.right_eye.to_dict() if self.right_eye else None,
            'left_eye_history': [test.to_dict() for test in self.left_eye_history],
            'right_eye_history': [test.to_dict() for test in self.right_eye_history],
            'diagnosis': self.diagnosis,
            'notes': self.notes,
            'metadata': self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PatientData':
        """从字典创建实例"""
        patient = cls()
        patient.patient_id = data.get('patient_id', '')
        patient.patient_name = data.get('patient_name', '')
        
        dob_str = data.get('date_of_birth')
        if dob_str:
            try:
                patient.date_of_birth = datetime.fromisoformat(dob_str)
            except:
                pass
        
        patient.gender = data.get('gender', '')
        
        left_eye_data = data.get('left_eye')
        if left_eye_data:
            patient.left_eye = VisualFieldTest.from_dict(left_eye_data)
        
        right_eye_data = data.get('right_eye')
        if right_eye_data:
            patient.right_eye = VisualFieldTest.from_dict(right_eye_data)
        
        left_history_data = data.get('left_eye_history', [])
        patient.left_eye_history = [VisualFieldTest.from_dict(t) for t in left_history_data]
        
        right_history_data = data.get('right_eye_history', [])
        patient.right_eye_history = [VisualFieldTest.from_dict(t) for t in right_history_data]
        
        patient.diagnosis = data.get('diagnosis', '')
        patient.notes = data.get('notes', '')
        patient.metadata = data.get('metadata', {})
        
        return patient


class ReliabilityRules:
    """
    可靠性规则模型
    定义设备可靠性评估的规则
    """
    
    def __init__(self):
        # 规则名称和版本
        self.name: str = "Default Reliability Rules"
        self.version: str = "1.0"
        
        # 固视丢失规则
        self.fixation_loss_threshold: float = 0.2  # 20% 阈值
        self.fixation_loss_warning: float = 0.15  # 15% 警告
        self.fixation_loss_critical: float = 0.3  # 30% 严重
        
        # 假阳性规则
        self.false_positive_threshold: float = 0.15  # 15% 阈值
        self.false_positive_warning: float = 0.1  # 10% 警告
        self.false_positive_critical: float = 0.2  # 20% 严重
        
        # 假阴性规则
        self.false_negative_threshold: float = 0.2  # 20% 阈值
        self.false_negative_warning: float = 0.15  # 15% 警告
        self.false_negative_critical: float = 0.3  # 30% 严重
        
        # 总体可靠性评分权重
        self.fixation_weight: float = 0.4
        self.false_positive_weight: float = 0.3
        self.false_negative_weight: float = 0.3
        
        # 可靠性等级定义
        self.levels: Dict[str, Dict[str, Any]] = {
            'excellent': {
                'min_score': 90,
                'label': '优秀',
                'color': '#4CAF50',
                'description': '检查结果高度可靠'
            },
            'good': {
                'min_score': 70,
                'label': '良好',
                'color': '#8BC34A',
                'description': '检查结果可靠'
            },
            'fair': {
                'min_score': 50,
                'label': '一般',
                'color': '#FFC107',
                'description': '检查结果存在一定问题，需要注意'
            },
            'poor': {
                'min_score': 30,
                'label': '较差',
                'color': '#FF9800',
                'description': '检查结果可靠性较差，建议复查'
            },
            'unreliable': {
                'min_score': 0,
                'label': '不可靠',
                'color': '#F44336',
                'description': '检查结果不可靠，必须复查'
            }
        }
        
        # 附加规则
        self.additional_rules: Dict[str, Any] = {}
        
    def get_reliability_level(self, score: float) -> Dict[str, Any]:
        """
        根据评分获取可靠性等级
        """
        # 按分数从高到低排序
        sorted_levels = sorted(
            self.levels.items(),
            key=lambda x: x[1]['min_score'],
            reverse=True
        )
        
        for level_name, level_info in sorted_levels:
            if score >= level_info['min_score']:
                return {
                    'level': level_name,
                    **level_info
                }
        
        # 默认返回最低等级
        return self.levels.get('unreliable', {'level': 'unreliable', 'label': '未知'})
    
    def evaluate_test(self, test: VisualFieldTest) -> Dict[str, Any]:
        """
        评估单次检查的可靠性
        返回包含评分、等级和问题列表的字典
        """
        issues = []
        warnings = []
        
        # 计算各项得分
        fixation_rate = test.get_fixation_loss_rate()
        fp_rate = test.get_false_positive_rate()
        fn_rate = test.get_false_negative_rate()
        
        # 固视丢失评估
        if fixation_rate >= self.fixation_loss_critical:
            issues.append(f"固视丢失率过高 ({fixation_rate*100:.1f}%)，超过严重阈值 ({self.fixation_loss_critical*100}%)")
        elif fixation_rate >= self.fixation_loss_threshold:
            issues.append(f"固视丢失率较高 ({fixation_rate*100:.1f}%)，超过阈值 ({self.fixation_loss_threshold*100}%)")
        elif fixation_rate >= self.fixation_loss_warning:
            warnings.append(f"固视丢失率 ({fixation_rate*100:.1f}%) 接近阈值")
        
        # 假阳性评估
        if fp_rate >= self.false_positive_critical:
            issues.append(f"假阳性率过高 ({fp_rate*100:.1f}%)，超过严重阈值 ({self.false_positive_critical*100}%)")
        elif fp_rate >= self.false_positive_threshold:
            issues.append(f"假阳性率较高 ({fp_rate*100:.1f}%)，超过阈值 ({self.false_positive_threshold*100}%)")
        elif fp_rate >= self.false_positive_warning:
            warnings.append(f"假阳性率 ({fp_rate*100:.1f}%) 接近阈值")
        
        # 假阴性评估
        if fn_rate >= self.false_negative_critical:
            issues.append(f"假阴性率过高 ({fn_rate*100:.1f}%)，超过严重阈值 ({self.false_negative_critical*100}%)")
        elif fn_rate >= self.false_negative_threshold:
            issues.append(f"假阴性率较高 ({fn_rate*100:.1f}%)，超过阈值 ({self.false_negative_threshold*100}%)")
        elif fn_rate >= self.false_negative_warning:
            warnings.append(f"假阴性率 ({fn_rate*100:.1f}%) 接近阈值")
        
        # 计算综合评分 (满分100)
        fixation_score = max(0, 100 - (fixation_rate / self.fixation_loss_critical) * 100) if self.fixation_loss_critical > 0 else 100
        fp_score = max(0, 100 - (fp_rate / self.false_positive_critical) * 100) if self.false_positive_critical > 0 else 100
        fn_score = max(0, 100 - (fn_rate / self.false_negative_critical) * 100) if self.false_negative_critical > 0 else 100
        
        # 加权综合
        total_score = (
            fixation_score * self.fixation_weight +
            fp_score * self.false_positive_weight +
            fn_score * self.false_negative_weight
        )
        
        # 获取等级
        level = self.get_reliability_level(total_score)
        
        return {
            'score': round(total_score, 1),
            'level': level,
            'fixation_rate': round(fixation_rate * 100, 1),
            'false_positive_rate': round(fp_rate * 100, 1),
            'false_negative_rate': round(fn_rate * 100, 1),
            'fixation_score': round(fixation_score, 1),
            'false_positive_score': round(fp_score, 1),
            'false_negative_score': round(fn_score, 1),
            'issues': issues,
            'warnings': warnings
        }
    
    def merge(self, other: 'ReliabilityRules'):
        """
        合并另一个可靠性规则
        """
        # 简单的覆盖策略，后导入的规则覆盖已有规则
        if other.name != "Default Reliability Rules":
            self.name = other.name
        if other.version != "1.0":
            self.version = other.version
        
        # 合并阈值
        self.fixation_loss_threshold = other.fixation_loss_threshold
        self.fixation_loss_warning = other.fixation_loss_warning
        self.fixation_loss_critical = other.fixation_loss_critical
        
        self.false_positive_threshold = other.false_positive_threshold
        self.false_positive_warning = other.false_positive_warning
        self.false_positive_critical = other.false_positive_critical
        
        self.false_negative_threshold = other.false_negative_threshold
        self.false_negative_warning = other.false_negative_warning
        self.false_negative_critical = other.false_negative_critical
        
        # 合并权重
        self.fixation_weight = other.fixation_weight
        self.false_positive_weight = other.false_positive_weight
        self.false_negative_weight = other.false_negative_weight
        
        # 合并等级定义
        self.levels.update(other.levels)
        
        # 合并附加规则
        self.additional_rules.update(other.additional_rules)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'name': self.name,
            'version': self.version,
            'fixation_loss_threshold': self.fixation_loss_threshold,
            'fixation_loss_warning': self.fixation_loss_warning,
            'fixation_loss_critical': self.fixation_loss_critical,
            'false_positive_threshold': self.false_positive_threshold,
            'false_positive_warning': self.false_positive_warning,
            'false_positive_critical': self.false_positive_critical,
            'false_negative_threshold': self.false_negative_threshold,
            'false_negative_warning': self.false_negative_warning,
            'false_negative_critical': self.false_negative_critical,
            'fixation_weight': self.fixation_weight,
            'false_positive_weight': self.false_positive_weight,
            'false_negative_weight': self.false_negative_weight,
            'levels': self.levels,
            'additional_rules': self.additional_rules
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReliabilityRules':
        """从字典创建实例"""
        rules = cls()
        rules.name = data.get('name', "Default Reliability Rules")
        rules.version = data.get('version', "1.0")
        
        rules.fixation_loss_threshold = data.get('fixation_loss_threshold', 0.2)
        rules.fixation_loss_warning = data.get('fixation_loss_warning', 0.15)
        rules.fixation_loss_critical = data.get('fixation_loss_critical', 0.3)
        
        rules.false_positive_threshold = data.get('false_positive_threshold', 0.15)
        rules.false_positive_warning = data.get('false_positive_warning', 0.1)
        rules.false_positive_critical = data.get('false_positive_critical', 0.2)
        
        rules.false_negative_threshold = data.get('false_negative_threshold', 0.2)
        rules.false_negative_warning = data.get('false_negative_warning', 0.15)
        rules.false_negative_critical = data.get('false_negative_critical', 0.3)
        
        rules.fixation_weight = data.get('fixation_weight', 0.4)
        rules.false_positive_weight = data.get('false_positive_weight', 0.3)
        rules.false_negative_weight = data.get('false_negative_weight', 0.3)
        
        if 'levels' in data:
            rules.levels = data['levels']
        
        if 'additional_rules' in data:
            rules.additional_rules = data['additional_rules']
        
        return rules
