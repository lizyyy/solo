"""
Markdown导出器
导出烧成复盘报告
"""

from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from pathlib import Path

from ..models import (
    FiringRecord, Risk, RiskLevel, RiskType, ReviewStatus,
    TemperaturePoint, FiringPlan, GlazeBatch, WorkPiece, Observation
)


class MarkdownExporter:
    """Markdown复盘报告导出器"""
    
    def __init__(self):
        self.export_time = datetime.now()
    
    def export(self, record: FiringRecord, file_path: str) -> str:
        """
        导出Markdown报告
        
        Args:
            record: 烧成记录
            file_path: 输出文件路径
            
        Returns:
            导出的文件路径
        """
        content = self._generate_content(record)
        
        output_path = Path(file_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(output_path)
    
    def _generate_content(self, record: FiringRecord) -> str:
        """生成Markdown内容"""
        lines = []
        
        lines.extend(self._generate_header(record))
        lines.append("")
        
        lines.extend(self._generate_overview(record))
        lines.append("")
        
        lines.extend(self._generate_risk_summary(record))
        lines.append("")
        
        lines.extend(self._generate_temperature_profile(record))
        lines.append("")
        
        lines.extend(self._generate_firing_plan(record))
        lines.append("")
        
        lines.extend(self._generate_risk_details(record))
        lines.append("")
        
        lines.extend(self._generate_glaze_batches(record))
        lines.append("")
        
        lines.extend(self._generate_work_pieces(record))
        lines.append("")
        
        lines.extend(self._generate_observations(record))
        lines.append("")
        
        lines.extend(self._generate_review_notes(record))
        lines.append("")
        
        lines.extend(self._generate_footer())
        
        return "\n".join(lines)
    
    def _generate_header(self, record: FiringRecord) -> List[str]:
        """生成报告头部"""
        lines = []
        lines.append(f"# 窑烧曲线复盘报告")
        lines.append("")
        lines.append(f"**记录名称**: {record.name}")
        lines.append(f"**记录ID**: {record.record_id}")
        lines.append(f"**生成时间**: {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        return lines
    
    def _generate_overview(self, record: FiringRecord) -> List[str]:
        """生成概览部分"""
        lines = []
        lines.append("## 烧成概览")
        lines.append("")
        
        lines.append("| 项目 | 数值 |")
        lines.append("|------|------|")
        
        if record.start_time:
            lines.append(f"| 开始时间 | {record.start_time.strftime('%Y-%m-%d %H:%M')} |")
        else:
            lines.append("| 开始时间 | 未知 |")
        
        if record.end_time:
            lines.append(f"| 结束时间 | {record.end_time.strftime('%Y-%m-%d %H:%M')} |")
        else:
            lines.append("| 结束时间 | 未知 |")
        
        if record.duration:
            lines.append(f"| 总时长 | {self._format_duration(record.duration)} |")
        else:
            lines.append("| 总时长 | 未知 |")
        
        lines.append(f"| 最高温度 | {record.max_temperature:.1f}°C |")
        lines.append(f"| 数据点数 | {len(record.temperature_data)} |")
        lines.append(f"| 作品数量 | {len(record.work_pieces)} |")
        lines.append(f"| 釉料批次 | {len(record.glaze_batches)} |")
        lines.append(f"| 发现问题 | {len(record.risks)} 个 |")
        lines.append(f"| 待复核 | {len(record.get_pending_risks())} 个 |")
        
        return lines
    
    def _generate_risk_summary(self, record: FiringRecord) -> List[str]:
        """生成风险摘要"""
        lines = []
        lines.append("## 风险摘要")
        lines.append("")
        
        if not record.risks:
            lines.append("> ✅ 未发现任何风险问题")
            return lines
        
        level_counts = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 0,
            RiskLevel.MEDIUM: 0,
            RiskLevel.LOW: 0
        }
        
        type_counts: Dict[RiskType, int] = {}
        
        for risk in record.risks:
            level_counts[risk.level] += 1
            type_counts[risk.risk_type] = type_counts.get(risk.risk_type, 0) + 1
        
        lines.append("### 按严重程度")
        lines.append("")
        lines.append("| 级别 | 数量 | 状态 |")
        lines.append("|------|------|------|")
        
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            count = level_counts[level]
            if count > 0:
                status = "⚠️" if count > 0 else "✅"
                lines.append(f"| {self._level_icon(level)} {level.value} | {count} | {status} |")
        
        lines.append("")
        lines.append("### 按问题类型")
        lines.append("")
        lines.append("| 类型 | 数量 |")
        lines.append("|------|------|")
        
        for risk_type, count in sorted(type_counts.items(), key=lambda x: -x[1]):
            lines.append(f"| {risk_type.value} | {count} |")
        
        return lines
    
    def _generate_temperature_profile(self, record: FiringRecord) -> List[str]:
        """生成温度曲线部分"""
        lines = []
        lines.append("## 温度曲线概览")
        lines.append("")
        
        if not record.temperature_data:
            lines.append("> ❌ 无温度数据")
            return lines
        
        points = sorted(record.temperature_data, key=lambda p: p.timestamp)
        
        lines.append(f"**数据范围**: {points[0].timestamp.strftime('%Y-%m-%d %H:%M')} - {points[-1].timestamp.strftime('%Y-%m-%d %H:%M')}")
        lines.append("")
        
        if len(points) >= 2:
            sample_interval = (points[1].timestamp - points[0].timestamp).total_seconds() / 60
            lines.append(f"**采样间隔**: 约 {sample_interval:.0f} 分钟")
            lines.append("")
        
        layers = self._get_all_layers(record.temperature_data)
        if layers:
            lines.append("**监测层位**:")
            lines.append("")
            for layer in layers:
                layer_temps = [p.temperatures[layer] for p in points if layer in p.temperatures]
                if layer_temps:
                    min_temp = min(layer_temps)
                    max_temp = max(layer_temps)
                    avg_temp = sum(layer_temps) / len(layer_temps)
                    lines.append(f"- **{layer}**: 最低 {min_temp:.1f}°C / 最高 {max_temp:.1f}°C / 平均 {avg_temp:.1f}°C")
        
        lines.append("")
        lines.append("### 关键时间点")
        lines.append("")
        
        key_points = self._find_key_temperature_points(points)
        if key_points:
            lines.append("| 时间 | 事件 | 温度 |")
            lines.append("|------|------|------|")
            for kp in key_points:
                lines.append(f"| {kp['time']} | {kp['event']} | {kp['temp']:.1f}°C |")
        
        return lines
    
    def _generate_firing_plan(self, record: FiringRecord) -> List[str]:
        """生成烧成计划部分"""
        lines = []
        lines.append("## 烧成计划")
        lines.append("")
        
        if not record.firing_plan:
            lines.append("> ℹ️ 未关联烧成计划")
            return lines
        
        plan = record.firing_plan
        
        lines.append(f"**计划名称**: {plan.name}")
        lines.append(f"**计划ID**: {plan.plan_id}")
        if plan.description:
            lines.append(f"**描述**: {plan.description}")
        lines.append("")
        
        lines.append("### 烧成阶段")
        lines.append("")
        lines.append("| 阶段 | 起始温度 | 目标温度 | 升温速率 | 保温时间 |")
        lines.append("|------|----------|----------|----------|----------|")
        
        for segment in plan.segments:
            hold_time = segment.hold_time if segment.hold_time else timedelta(0)
            hold_str = self._format_duration(hold_time) if hold_time.total_seconds() > 0 else "-"
            
            lines.append(f"| {segment.name} | {segment.start_temperature:.0f}°C | {segment.end_temperature:.0f}°C | {segment.rate:.0f}°C/h | {hold_str} |")
        
        lines.append("")
        lines.append(f"**预计总时长**: {self._format_duration(plan.estimated_total_duration)}")
        lines.append(f"**最高目标温度**: {plan.max_temperature:.0f}°C")
        
        return lines
    
    def _generate_risk_details(self, record: FiringRecord) -> List[str]:
        """生成风险详情"""
        lines = []
        lines.append("## 风险详情")
        lines.append("")
        
        if not record.risks:
            lines.append("> ✅ 未发现任何风险问题")
            return lines
        
        pending_risks = record.get_pending_risks()
        if pending_risks:
            lines.append(f"> ⚠️ 有 {len(pending_risks)} 个问题待复核")
            lines.append("")
        
        risk_types = {}
        for risk in record.risks:
            if risk.risk_type not in risk_types:
                risk_types[risk.risk_type] = []
            risk_types[risk.risk_type].append(risk)
        
        for risk_type, risks in risk_types.items():
            lines.append(f"### {risk_type.value}")
            lines.append("")
            
            for risk in sorted(risks, key=lambda r: (self._level_order(r.level), r.timestamp or datetime.min)):
                status_icon = self._status_icon(risk.review_status)
                level_icon = self._level_icon(risk.level)
                
                lines.append(f"#### {status_icon} {level_icon} {risk.title}")
                lines.append("")
                lines.append(f"**风险级别**: {risk.level.value}")
                lines.append(f"**复核状态**: {risk.review_status.value}")
                if risk.timestamp:
                    lines.append(f"**发生时间**: {risk.timestamp.strftime('%Y-%m-%d %H:%M')}")
                lines.append("")
                lines.append("**详细描述**:")
                lines.append("")
                for line in risk.description.split('\n'):
                    lines.append(f"> {line}")
                lines.append("")
                
                if risk.review_notes:
                    lines.append("**复核备注**:")
                    lines.append("")
                    lines.append(f"> {risk.review_notes}")
                    lines.append("")
                
                if risk.reviewed_by:
                    lines.append(f"**复核人**: {risk.reviewed_by}")
                    if risk.reviewed_at:
                        lines.append(f"**复核时间**: {risk.reviewed_at.strftime('%Y-%m-%d %H:%M')}")
                    lines.append("")
                
                lines.append("---")
                lines.append("")
        
        return lines
    
    def _generate_glaze_batches(self, record: FiringRecord) -> List[str]:
        """生成釉料批次部分"""
        lines = []
        lines.append("## 釉料批次")
        lines.append("")
        
        if not record.glaze_batches:
            lines.append("> ℹ️ 无釉料批次数据")
            return lines
        
        lines.append("| 批次ID | 釉料名称 | 数量 | 状态 |")
        lines.append("|--------|----------|------|------|")
        
        for batch in record.glaze_batches:
            quantity_str = f"{batch.quantity} {batch.unit}" if batch.quantity else "-"
            status_icon = self._batch_status_icon(batch.status)
            lines.append(f"| {batch.batch_id} | {batch.glaze_name} | {quantity_str} | {status_icon} {batch.status} |")
        
        return lines
    
    def _generate_work_pieces(self, record: FiringRecord) -> List[str]:
        """生成作品列表部分"""
        lines = []
        lines.append("## 作品列表")
        lines.append("")
        
        if not record.work_pieces:
            lines.append("> ℹ️ 无作品数据")
            return lines
        
        lines.append("| 作品ID | 名称 | 艺术家 | 釉料批次 | 放置层位 |")
        lines.append("|--------|------|--------|----------|----------|")
        
        for work in record.work_pieces:
            title = work.title or "-"
            artist = work.artist or "-"
            batch_id = work.glaze_batch_id or "-"
            layer = work.shelf_layer or "-"
            
            lines.append(f"| {work.work_id} | {title} | {artist} | {batch_id} | {layer} |")
        
        return lines
    
    def _generate_observations(self, record: FiringRecord) -> List[str]:
        """生成观察备注部分"""
        lines = []
        lines.append("## 观察备注")
        lines.append("")
        
        if not record.observations:
            lines.append("> ℹ️ 无观察备注")
            return lines
        
        sorted_obs = sorted(record.observations, key=lambda o: o.timestamp)
        
        for obs in sorted_obs:
            lines.append(f"### [{obs.timestamp.strftime('%Y-%m-%d %H:%M')}]")
            lines.append("")
            lines.append(f"**内容**: {obs.content}")
            if obs.author:
                lines.append(f"**记录人**: {obs.author}")
            if obs.category:
                lines.append(f"**分类**: {obs.category}")
            if obs.related_work_ids:
                lines.append(f"**关联作品**: {', '.join(obs.related_work_ids)}")
            lines.append("")
        
        return lines
    
    def _generate_review_notes(self, record: FiringRecord) -> List[str]:
        """生成复核备注部分"""
        lines = []
        lines.append("## 复核总结")
        lines.append("")
        
        if record.review_notes:
            lines.append("### 复核备注")
            lines.append("")
            lines.append(record.review_notes)
            lines.append("")
        
        if record.reviewed_by:
            lines.append(f"**复核人**: {record.reviewed_by}")
        if record.reviewed_at:
            lines.append(f"**复核时间**: {record.reviewed_at.strftime('%Y-%m-%d %H:%M')}")
        
        if not record.review_notes and not record.reviewed_by:
            lines.append("> ℹ️ 尚未完成复核")
        
        return lines
    
    def _generate_footer(self) -> List[str]:
        """生成页脚"""
        lines = []
        lines.append("---")
        lines.append("")
        lines.append(f"*报告由窑烧曲线复盘台生成于 {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}*")
        return lines
    
    def _format_duration(self, duration: timedelta) -> str:
        """格式化持续时间"""
        total_seconds = duration.total_seconds()
        hours = int(total_seconds // 3600)
        minutes = int((total_seconds % 3600) // 60)
        
        if hours > 0:
            return f"{hours}小时{minutes}分钟"
        else:
            return f"{minutes}分钟"
    
    def _get_all_layers(self, points: List[TemperaturePoint]) -> List[str]:
        """获取所有层名"""
        layers = set()
        for p in points:
            layers.update(p.temperatures.keys())
        return sorted(layers)
    
    def _find_key_temperature_points(self, points: List[TemperaturePoint]) -> List[Dict]:
        """查找关键温度点"""
        if not points:
            return []
        
        key_points = []
        
        key_points.append({
            'time': points[0].timestamp.strftime('%H:%M'),
            'event': '开始',
            'temp': points[0].avg_temperature
        })
        
        if len(points) >= 3:
            mid_idx = len(points) // 2
            key_points.append({
                'time': points[mid_idx].timestamp.strftime('%H:%M'),
                'event': '中点',
                'temp': points[mid_idx].avg_temperature
            })
        
        max_temp_point = max(points, key=lambda p: p.avg_temperature)
        key_points.append({
            'time': max_temp_point.timestamp.strftime('%H:%M'),
            'event': '最高温',
            'temp': max_temp_point.avg_temperature
        })
        
        key_points.append({
            'time': points[-1].timestamp.strftime('%H:%M'),
            'event': '结束',
            'temp': points[-1].avg_temperature
        })
        
        return key_points
    
    def _level_icon(self, level: RiskLevel) -> str:
        """获取风险级别图标"""
        icons = {
            RiskLevel.CRITICAL: '🔴',
            RiskLevel.HIGH: '🟠',
            RiskLevel.MEDIUM: '🟡',
            RiskLevel.LOW: '🟢'
        }
        return icons.get(level, '⚪')
    
    def _level_order(self, level: RiskLevel) -> int:
        """获取风险级别排序顺序"""
        orders = {
            RiskLevel.CRITICAL: 0,
            RiskLevel.HIGH: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.LOW: 3
        }
        return orders.get(level, 999)
    
    def _status_icon(self, status: ReviewStatus) -> str:
        """获取复核状态图标"""
        icons = {
            ReviewStatus.PENDING: '⏳',
            ReviewStatus.CONFIRMED: '✅',
            ReviewStatus.DISMISSED: '❌',
            ReviewStatus.RESOLVED: '🔧'
        }
        return icons.get(status, '⚪')
    
    def _batch_status_icon(self, status: str) -> str:
        """获取批次状态图标"""
        icons = {
            '可用': '✅',
            '已用完': '📦',
            '已过期': '⚠️'
        }
        return icons.get(status, '⚪')
