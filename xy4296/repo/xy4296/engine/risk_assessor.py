#!/usr/bin/env python3
"""
风险评估模块
负责汇总和评估所有风险，提供总体风险评估结果
"""

from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import defaultdict


class RiskAssessor:
    """风险评估器类"""
    
    SEVERITY_WEIGHTS = {
        'critical': 100,
        'high': 50,
        'medium': 20,
        'warning': 10,
        'low': 1
    }
    
    SEVERITY_COLORS = {
        'critical': '#FF0000',
        'high': '#FF6600',
        'medium': '#FFCC00',
        'warning': '#99CC00',
        'low': '#00CC00'
    }
    
    SEVERITY_NAMES = {
        'critical': '严重',
        'high': '高',
        'medium': '中',
        'warning': '警告',
        'low': '低'
    }
    
    CATEGORY_NAMES = {
        'no_fly_time': '禁飞时段',
        'wind_impact_zone': '风向影响区',
        'ammunition_expiry': '弹药库存',
        'qualification_expiry': '人员资质',
        'radar_threat': '雷达威胁'
    }
    
    def __init__(self):
        """初始化风险评估器"""
        self.risks = []
        self.assessment_result = None
    
    def assess_risks(self, risks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        评估风险列表
        
        Args:
            risks: 风险列表
            
        Returns:
            评估结果字典
        """
        self.risks = risks
        
        # 按严重程度分组
        risks_by_severity = defaultdict(list)
        for risk in risks:
            severity = risk.get('severity', 'low')
            risks_by_severity[severity].append(risk)
        
        # 按类别分组
        risks_by_category = defaultdict(list)
        for risk in risks:
            category = risk.get('category', 'unknown')
            risks_by_category[category].append(risk)
        
        # 计算风险分数
        total_score = 0
        for risk in risks:
            severity = risk.get('severity', 'low')
            total_score += self.SEVERITY_WEIGHTS.get(severity, 1)
        
        # 确定总体风险等级
        overall_risk = self._determine_overall_risk(risks_by_severity, total_score)
        
        # 生成建议
        recommendations = self._generate_recommendations(risks_by_severity)
        
        self.assessment_result = {
            'timestamp': datetime.now(),
            'total_risks': len(risks),
            'risks_by_severity': dict(risks_by_severity),
            'risks_by_category': dict(risks_by_category),
            'total_score': total_score,
            'overall_risk': overall_risk,
            'can_proceed': overall_risk not in ['critical', 'high'],
            'recommendations': recommendations
        }
        
        return self.assessment_result
    
    def _determine_overall_risk(self, risks_by_severity: Dict[str, List[Dict]], 
                                 total_score: int) -> str:
        """
        确定总体风险等级
        
        Args:
            risks_by_severity: 按严重程度分组的风险
            total_score: 总风险分数
            
        Returns:
            总体风险等级
        """
        # 如果有严重风险，直接返回严重
        if risks_by_severity.get('critical', []):
            return 'critical'
        
        # 如果有高风险，返回高
        if risks_by_severity.get('high', []):
            return 'high'
        
        # 根据分数判断
        if total_score >= 100:
            return 'high'
        elif total_score >= 50:
            return 'medium'
        elif total_score >= 20:
            return 'warning'
        else:
            return 'low'
    
    def _generate_recommendations(self, risks_by_severity: Dict[str, List[Dict]]) -> List[str]:
        """
        生成建议
        
        Args:
            risks_by_severity: 按严重程度分组的风险
            
        Returns:
            建议列表
        """
        recommendations = []
        
        # 严重风险建议
        critical_risks = risks_by_severity.get('critical', [])
        if critical_risks:
            recommendations.append(f"发现 {len(critical_risks)} 项严重风险，必须立即处理，禁止作业！")
            for risk in critical_risks:
                recommendations.append(f"  - {risk.get('title', '')}: {risk.get('description', '')}")
        
        # 高风险建议
        high_risks = risks_by_severity.get('high', [])
        if high_risks:
            recommendations.append(f"发现 {len(high_risks)} 项高风险，建议处理后再作业。")
            for risk in high_risks:
                recommendations.append(f"  - {risk.get('title', '')}: {risk.get('description', '')}")
        
        # 中等风险建议
        medium_risks = risks_by_severity.get('medium', [])
        if medium_risks:
            recommendations.append(f"发现 {len(medium_risks)} 项中等风险，请注意监控。")
        
        # 警告建议
        warning_risks = risks_by_severity.get('warning', [])
        if warning_risks:
            recommendations.append(f"发现 {len(warning_risks)} 项警告信息，建议关注。")
        
        # 如果没有风险
        if not critical_risks and not high_risks and not medium_risks and not warning_risks:
            recommendations.append("未发现重大风险，可以进行作业。")
        
        return recommendations
    
    def get_risk_summary(self) -> Dict[str, Any]:
        """
        获取风险摘要
        
        Returns:
            风险摘要字典
        """
        if not self.assessment_result:
            return {'error': '未进行风险评估'}
        
        summary = {
            'timestamp': self.assessment_result['timestamp'],
            'total_risks': self.assessment_result['total_risks'],
            'overall_risk': self.assessment_result['overall_risk'],
            'overall_risk_name': self.SEVERITY_NAMES.get(
                self.assessment_result['overall_risk'], 
                self.assessment_result['overall_risk']
            ),
            'can_proceed': self.assessment_result['can_proceed'],
            'risk_counts': {}
        }
        
        # 统计各严重程度的风险数量
        for severity, risks in self.assessment_result['risks_by_severity'].items():
            summary['risk_counts'][severity] = {
                'count': len(risks),
                'name': self.SEVERITY_NAMES.get(severity, severity),
                'color': self.SEVERITY_COLORS.get(severity, '#000000')
            }
        
        # 统计各类别的风险数量
        summary['category_counts'] = {}
        for category, risks in self.assessment_result['risks_by_category'].items():
            summary['category_counts'][category] = {
                'count': len(risks),
                'name': self.CATEGORY_NAMES.get(category, category)
            }
        
        return summary
    
    def get_risks_for_display(self) -> List[Dict[str, Any]]:
        """
        获取用于显示的风险列表
        
        Returns:
            格式化的风险列表
        """
        display_risks = []
        for risk in self.risks:
            display_risk = risk.copy()
            severity = risk.get('severity', 'low')
            category = risk.get('category', 'unknown')
            
            display_risk['severity_name'] = self.SEVERITY_NAMES.get(severity, severity)
            display_risk['severity_color'] = self.SEVERITY_COLORS.get(severity, '#000000')
            display_risk['category_name'] = self.CATEGORY_NAMES.get(category, category)
            
            # 格式化时间戳
            timestamp = risk.get('timestamp')
            if timestamp:
                display_risk['timestamp_str'] = timestamp.strftime('%Y-%m-%d %H:%M:%S')
            else:
                display_risk['timestamp_str'] = ''
            
            display_risks.append(display_risk)
        
        # 按严重程度排序
        severity_order = ['critical', 'high', 'medium', 'warning', 'low']
        display_risks.sort(key=lambda x: severity_order.index(x.get('severity', 'low')))
        
        return display_risks
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取风险统计信息
        
        Returns:
            统计信息字典
        """
        if not self.assessment_result:
            return {'error': '未进行风险评估'}
        
        stats = {
            'total_risks': self.assessment_result['total_risks'],
            'total_score': self.assessment_result['total_score'],
            'by_severity': {},
            'by_category': {}
        }
        
        # 按严重程度统计
        for severity, risks in self.assessment_result['risks_by_severity'].items():
            stats['by_severity'][severity] = {
                'count': len(risks),
                'name': self.SEVERITY_NAMES.get(severity, severity),
                'percentage': (len(risks) / self.assessment_result['total_risks'] * 100) 
                               if self.assessment_result['total_risks'] > 0 else 0
            }
        
        # 按类别统计
        for category, risks in self.assessment_result['risks_by_category'].items():
            stats['by_category'][category] = {
                'count': len(risks),
                'name': self.CATEGORY_NAMES.get(category, category),
                'percentage': (len(risks) / self.assessment_result['total_risks'] * 100)
                               if self.assessment_result['total_risks'] > 0 else 0
            }
        
        return stats
    
    def clear(self):
        """清除所有数据"""
        self.risks = []
        self.assessment_result = None
