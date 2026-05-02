"""
CSV导出器
导出问题清单
"""

import csv
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

from ..models import (
    FiringRecord, Risk, RiskLevel, RiskType, ReviewStatus
)


class CSVExporter:
    """CSV问题清单导出器"""
    
    def __init__(self):
        self.export_time = datetime.now()
    
    def export_risks(self, record: FiringRecord, file_path: str, 
                      include_resolved: bool = False) -> str:
        """
        导出风险问题清单
        
        Args:
            record: 烧成记录
            file_path: 输出文件路径
            include_resolved: 是否包含已解决的问题
            
        Returns:
            导出的文件路径
        """
        risks = self._filter_risks(record.risks, include_resolved)
        
        rows = self._generate_risk_rows(record, risks)
        
        output_path = Path(file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=self._get_risk_fieldnames())
            writer.writeheader()
            writer.writerows(rows)
        
        return str(output_path)
    
    def export_summary(self, record: FiringRecord, file_path: str) -> str:
        """
        导出汇总统计
        
        Args:
            record: 烧成记录
            file_path: 输出文件路径
            
        Returns:
            导出的文件路径
        """
        rows = self._generate_summary_rows(record)
        
        output_path = Path(file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['分类', '项目', '数值', '备注'])
            writer.writeheader()
            writer.writerows(rows)
        
        return str(output_path)
    
    def _filter_risks(self, risks: List[Risk], include_resolved: bool) -> List[Risk]:
        """过滤风险"""
        if include_resolved:
            return risks
        
        return [r for r in risks if r.review_status != ReviewStatus.RESOLVED]
    
    def _get_risk_fieldnames(self) -> List[str]:
        """获取CSV字段名"""
        return [
            '序号',
            '风险ID',
            '风险类型',
            '严重程度',
            '标题',
            '描述',
            '发生时间',
            '复核状态',
            '复核备注',
            '复核人',
            '复核时间',
            '相关数据'
        ]
    
    def _generate_risk_rows(self, record: FiringRecord, risks: List[Risk]) -> List[Dict[str, Any]]:
        """生成风险数据行"""
        rows = []
        
        for idx, risk in enumerate(sorted(risks, key=lambda r: (self._level_order(r.level), r.timestamp or datetime.min)), 1):
            row = {
                '序号': idx,
                '风险ID': risk.risk_id,
                '风险类型': risk.risk_type.value,
                '严重程度': risk.level.value,
                '标题': risk.title,
                '描述': risk.description.replace('\n', '; '),
                '发生时间': risk.timestamp.strftime('%Y-%m-%d %H:%M:%S') if risk.timestamp else '',
                '复核状态': risk.review_status.value,
                '复核备注': risk.review_notes or '',
                '复核人': risk.reviewed_by or '',
                '复核时间': risk.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if risk.reviewed_at else '',
                '相关数据': self._format_related_data(risk.related_data)
            }
            rows.append(row)
        
        return rows
    
    def _generate_summary_rows(self, record: FiringRecord) -> List[Dict[str, Any]]:
        """生成汇总数据行"""
        rows = []
        
        rows.append({
            '分类': '基本信息',
            '项目': '记录名称',
            '数值': record.name,
            '备注': ''
        })
        rows.append({
            '分类': '基本信息',
            '项目': '记录ID',
            '数值': record.record_id,
            '备注': ''
        })
        
        if record.start_time:
            rows.append({
                '分类': '烧成时间',
                '项目': '开始时间',
                '数值': record.start_time.strftime('%Y-%m-%d %H:%M:%S'),
                '备注': ''
            })
        if record.end_time:
            rows.append({
                '分类': '烧成时间',
                '项目': '结束时间',
                '数值': record.end_time.strftime('%Y-%m-%d %H:%M:%S'),
                '备注': ''
            })
        if record.duration:
            rows.append({
                '分类': '烧成时间',
                '项目': '总时长',
                '数值': f"{record.duration.total_seconds() / 3600:.2f}小时",
                '备注': ''
            })
        
        rows.append({
            '分类': '温度数据',
            '项目': '最高温度',
            '数值': f"{record.max_temperature:.1f}°C",
            '备注': ''
        })
        rows.append({
            '分类': '温度数据',
            '项目': '数据点数',
            '数值': str(len(record.temperature_data)),
            '备注': ''
        })
        
        rows.append({
            '分类': '作品信息',
            '项目': '作品数量',
            '数值': str(len(record.work_pieces)),
            '备注': ''
        })
        rows.append({
            '分类': '作品信息',
            '项目': '釉料批次数量',
            '数值': str(len(record.glaze_batches)),
            '备注': ''
        })
        
        level_counts = self._count_by_level(record.risks)
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            rows.append({
                '分类': '风险统计',
                '项目': f'{level.value}风险数量',
                '数值': str(level_counts.get(level, 0)),
                '备注': ''
            })
        
        status_counts = self._count_by_status(record.risks)
        for status in [ReviewStatus.PENDING, ReviewStatus.CONFIRMED, ReviewStatus.DISMISSED, ReviewStatus.RESOLVED]:
            rows.append({
                '分类': '复核状态',
                '项目': f'{status.value}数量',
                '数值': str(status_counts.get(status, 0)),
                '备注': ''
            })
        
        type_counts = self._count_by_type(record.risks)
        for risk_type, count in type_counts.items():
            rows.append({
                '分类': '风险类型',
                '项目': risk_type.value,
                '数值': str(count),
                '备注': ''
            })
        
        return rows
    
    def _format_related_data(self, related_data: Dict[str, Any]) -> str:
        """格式化相关数据"""
        if not related_data:
            return ''
        
        items = []
        for key, value in related_data.items():
            if isinstance(value, float):
                items.append(f"{key}:{value:.2f}")
            else:
                items.append(f"{key}:{value}")
        
        return '; '.join(items)
    
    def _count_by_level(self, risks: List[Risk]) -> Dict[RiskLevel, int]:
        """按级别统计"""
        counts = {}
        for risk in risks:
            counts[risk.level] = counts.get(risk.level, 0) + 1
        return counts
    
    def _count_by_status(self, risks: List[Risk]) -> Dict[ReviewStatus, int]:
        """按状态统计"""
        counts = {}
        for risk in risks:
            counts[risk.review_status] = counts.get(risk.review_status, 0) + 1
        return counts
    
    def _count_by_type(self, risks: List[Risk]) -> Dict[RiskType, int]:
        """按类型统计"""
        counts = {}
        for risk in risks:
            counts[risk.risk_type] = counts.get(risk.risk_type, 0) + 1
        return counts
    
    def _level_order(self, level: RiskLevel) -> int:
        """获取风险级别排序顺序"""
        orders = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3
        }
        return orders.get(level, 999)
