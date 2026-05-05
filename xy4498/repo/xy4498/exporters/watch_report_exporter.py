import json
import os
from typing import List, Optional, Dict, Any
from datetime import datetime

from models import (
    WorkOrder, TimingLog, TimingMeasurement,
    ServiceStep, PartReplacement, WaterproofTest,
    WatchReviewConclusion, WatchAnalysisResult,
    RateDriftAnalysis, AmplitudeAnomaly, PositionVariation,
    ReworkRiskAssessment
)


class WatchReportExporter:
    """钟表维修报告导出器"""
    
    RISK_COLORS = {
        'low': '🟢',
        'medium': '🟡',
        'high': '🟠',
        'critical': '🔴'
    }
    
    SEVERITY_COLORS = {
        'normal': '🟢',
        'mild': '🟡',
        'moderate': '🟠',
        'severe': '🔴'
    }
    
    STATUS_ICONS = {
        'pending': '⏳',
        'in_progress': '🔄',
        'completed': '✅',
        'skipped': '⏭️'
    }
    
    def __init__(self):
        pass
    
    def export_markdown(self, work_order: WorkOrder,
                        analysis_result: Optional[WatchAnalysisResult] = None,
                        include_measurements: bool = True,
                        include_steps: bool = True,
                        include_parts: bool = True) -> str:
        """
        导出 Markdown 格式报告
        
        Args:
            work_order: 工单对象
            analysis_result: 分析结果（可选）
            include_measurements: 是否包含详细测量数据
            include_steps: 是否包含拆洗步骤
            include_parts: 是否包含零件更换清单
        
        Returns:
            Markdown 格式的报告字符串
        """
        lines = []
        
        lines.append(self._generate_header(work_order))
        lines.append(self._generate_basic_info(work_order))
        
        if analysis_result and analysis_result.rework_risk:
            lines.append(self._generate_risk_summary(analysis_result.rework_risk))
        
        latest_log = work_order.get_latest_timing_log()
        if latest_log:
            lines.append(self._generate_timing_summary(latest_log, analysis_result))
            if include_measurements:
                lines.append(self._generate_measurement_table(latest_log))
        
        if analysis_result:
            lines.append(self._generate_analysis_details(analysis_result))
        
        if include_steps and work_order.service_steps:
            lines.append(self._generate_service_steps(work_order.service_steps))
        
        if include_parts and work_order.part_replacements:
            lines.append(self._generate_parts_list(work_order.part_replacements))
        
        latest_waterproof = work_order.get_latest_waterproof_test()
        if latest_waterproof:
            lines.append(self._generate_waterproof_test(latest_waterproof))
        
        latest_review = work_order.get_latest_review()
        if latest_review:
            lines.append(self._generate_review_conclusion(latest_review))
        
        lines.append(self._generate_footer())
        
        return '\n\n'.join(lines)
    
    def export_json(self, work_order: WorkOrder,
                    analysis_result: Optional[WatchAnalysisResult] = None,
                    pretty: bool = True) -> str:
        """
        导出 JSON 格式明细
        
        Args:
            work_order: 工单对象
            analysis_result: 分析结果（可选）
            pretty: 是否格式化输出
        
        Returns:
            JSON 格式的字符串
        """
        data = {
            'export_time': datetime.now().isoformat(),
            'work_order': work_order.to_dict()
        }
        
        if analysis_result:
            data['analysis_result'] = analysis_result.to_dict()
        
        indent = 2 if pretty else None
        return json.dumps(data, ensure_ascii=False, indent=indent)
    
    def export_to_file(self, work_order: WorkOrder,
                       file_path: str,
                       format_type: str = 'markdown',
                       analysis_result: Optional[WatchAnalysisResult] = None,
                       **kwargs) -> None:
        """
        导出到文件
        
        Args:
            work_order: 工单对象
            file_path: 输出文件路径
            format_type: 格式类型 'markdown' 或 'json'
            analysis_result: 分析结果（可选）
            **kwargs: 其他参数传递给导出函数
        """
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        if format_type.lower() == 'markdown':
            content = self.export_markdown(work_order, analysis_result, **kwargs)
        elif format_type.lower() == 'json':
            content = self.export_json(work_order, analysis_result, **kwargs)
        else:
            raise ValueError(f"不支持的导出格式: {format_type}")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_header(self, work_order: WorkOrder) -> str:
        """生成报告头部"""
        lines = [
            '# 钟表维修走时复盘报告',
            '',
            f'**工单号**: {work_order.work_order_number}',
            f'**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}',
            '',
            '---'
        ]
        return '\n'.join(lines)
    
    def _generate_basic_info(self, work_order: WorkOrder) -> str:
        """生成基本信息"""
        lines = ['## 📋 基本信息', '']
        
        rows = [
            ['客户名称', work_order.customer_name],
            ['手表品牌', work_order.watch_brand],
            ['手表型号', work_order.watch_model],
            ['机芯类型', self._format_movement_type(work_order.movement_type)],
            ['机芯型号', work_order.movement_model or '-'],
            ['序列号', work_order.serial_number or '-'],
            ['收表日期', work_order.received_date.strftime('%Y-%m-%d') if work_order.received_date else '-'],
            ['取表期限', work_order.due_date.strftime('%Y-%m-%d') if work_order.due_date else '-'],
            ['当前状态', self._format_status(work_order.status)],
            ['服务类型', self._format_service_type(work_order.service_type)],
        ]
        
        if work_order.initial_complaints:
            rows.append(['客户投诉', '; '.join(work_order.initial_complaints)])
        
        if work_order.estimated_cost:
            rows.append(['预估费用', f'¥{work_order.estimated_cost:.2f}'])
        if work_order.actual_cost:
            rows.append(['实际费用', f'¥{work_order.actual_cost:.2f}'])
        
        table = self._make_simple_table(['项目', '内容'], rows)
        lines.append(table)
        
        return '\n'.join(lines)
    
    def _generate_risk_summary(self, risk: ReworkRiskAssessment) -> str:
        """生成风险摘要"""
        lines = ['## ⚠️ 返修风险评估', '']
        
        risk_icon = self.RISK_COLORS.get(risk.overall_risk_level, '⚪')
        probability_pct = risk.probability_of_rework * 100
        
        rows = [
            ['风险等级', f'{risk_icon} {self._format_risk_level(risk.overall_risk_level)}'],
            ['风险分数', f'{risk.risk_score:.0f}/100'],
            ['返修概率', f'{probability_pct:.0f}%'],
            ['优先级', self._format_priority(risk.priority_level)],
        ]
        
        table = self._make_simple_table(['项目', '内容'], rows)
        lines.append(table)
        
        if risk.contributing_issues:
            lines.append('')
            lines.append('### 风险因素')
            lines.append('')
            for issue in risk.contributing_issues:
                lines.append(f'- 🔸 {issue}')
        
        if risk.recommended_actions:
            lines.append('')
            lines.append('### 建议措施')
            lines.append('')
            for action in risk.recommended_actions:
                lines.append(f'- 📌 {action}')
        
        return '\n'.join(lines)
    
    def _generate_timing_summary(self, timing_log: TimingLog,
                                  analysis_result: Optional[WatchAnalysisResult]) -> str:
        """生成走时数据摘要"""
        lines = ['## ⏱️ 走时数据摘要', '']
        
        if not timing_log.measurements:
            lines.append('*暂无走时测量数据*')
            return '\n'.join(lines)
        
        rates = [m.rate for m in timing_log.measurements]
        amplitudes = [m.amplitude for m in timing_log.measurements]
        beat_errors = [m.beat_error for m in timing_log.measurements]
        
        rows = [
            ['测试日期', timing_log.test_date.strftime('%Y-%m-%d %H:%M') if timing_log.test_date else '-'],
            ['校表仪型号', timing_log.instrument_model or '-'],
            ['测试方位数', str(len(timing_log.measurements))],
            ['', ''],
            ['**平均日差**', f'{sum(rates)/len(rates):+.2f} 秒/日'],
            ['日差范围', f'{min(rates):+.2f} ~ {max(rates):+.2f} 秒/日'],
            ['', ''],
            ['**平均摆幅**', f'{sum(amplitudes)/len(amplitudes):.1f} 度'],
            ['摆幅范围', f'{min(amplitudes):.1f} ~ {max(amplitudes):.1f} 度'],
            ['', ''],
            ['**平均偏振**', f'{sum(beat_errors)/len(beat_errors):.3f} 毫秒'],
            ['偏振范围', f'{min(beat_errors):.3f} ~ {max(beat_errors):.3f} 毫秒'],
        ]
        
        table = self._make_simple_table(['项目', '数值'], rows)
        lines.append(table)
        
        return '\n'.join(lines)
    
    def _generate_measurement_table(self, timing_log: TimingLog) -> str:
        """生成详细测量数据表"""
        lines = ['### 📊 详细测量数据', '']
        
        if not timing_log.measurements:
            lines.append('*暂无详细测量数据*')
            return '\n'.join(lines)
        
        headers = ['方位', '日差 (秒/日)', '摆幅 (度)', '偏振 (毫秒)', '温度 (°C)']
        rows = []
        
        for m in timing_log.measurements:
            rate_color = self._get_rate_color(m.rate)
            amp_color = self._get_amplitude_color(m.amplitude)
            beat_color = self._get_beat_error_color(m.beat_error)
            
            rows.append([
                m.position,
                f'{rate_color} {m.rate:+.2f}',
                f'{amp_color} {m.amplitude:.1f}',
                f'{beat_color} {m.beat_error:.3f}',
                f'{m.temperature:.1f}' if m.temperature else '-',
            ])
        
        table = self._make_simple_table(headers, rows)
        lines.append(table)
        
        return '\n'.join(lines)
    
    def _generate_analysis_details(self, analysis_result: WatchAnalysisResult) -> str:
        """生成分析详情"""
        lines = ['## 🔍 走时分析详情', '']
        
        if analysis_result.rate_drifts:
            lines.append(self._generate_rate_drift_section(analysis_result.rate_drifts))
            lines.append('')
        
        if analysis_result.amplitude_anomalies:
            lines.append(self._generate_amplitude_anomaly_section(analysis_result.amplitude_anomalies))
            lines.append('')
        
        if analysis_result.position_variations:
            lines.append(self._generate_position_variation_section(analysis_result.position_variations))
        
        return '\n'.join(lines)
    
    def _generate_rate_drift_section(self, drifts: List[RateDriftAnalysis]) -> str:
        """生成日差漂移部分"""
        lines = ['### 日差漂移分析', '']
        
        concerning = [d for d in drifts if d.is_concerning]
        if not concerning:
            lines.append('*所有方位日差均在正常范围内* ✅')
            return '\n'.join(lines)
        
        headers = ['方位', '初始日差', '最终日差', '漂移量', '程度', '状态']
        rows = []
        
        for d in concerning:
            severity_icon = self.SEVERITY_COLORS.get(d.drift_severity, '⚪')
            direction_icon = '⬆️' if d.drift_direction == 'positive' else '⬇️' if d.drift_direction == 'negative' else '➡️'
            
            rows.append([
                d.position,
                f'{d.initial_rate:+.2f}',
                f'{d.final_rate:+.2f}',
                f'{direction_icon} {d.drift_amount:+.2f}',
                f'{severity_icon} {self._format_severity(d.drift_severity)}',
                '⚠️ 关注' if d.is_concerning else '✅ 正常',
            ])
        
        table = self._make_simple_table(headers, rows)
        lines.append(table)
        
        all_causes = set()
        for d in concerning:
            all_causes.update(d.possible_causes)
        
        if all_causes:
            lines.append('')
            lines.append('**可能原因:**')
            for cause in all_causes:
                lines.append(f'- {cause}')
        
        return '\n'.join(lines)
    
    def _generate_amplitude_anomaly_section(self, anomalies: List[AmplitudeAnomaly]) -> str:
        """生成摆幅异常部分"""
        lines = ['### 摆幅异常分析', '']
        
        headers = ['方位', '测量值', '正常值范围', '偏差', '程度', '类型']
        rows = []
        
        for a in anomalies:
            severity_icon = self.SEVERITY_COLORS.get(a.severity, '⚪')
            type_label = '偏低' if a.anomaly_type == 'too_low' else '偏高' if a.anomaly_type == 'too_high' else '不稳定'
            
            rows.append([
                a.position,
                f'{a.measured_amplitude:.1f}°',
                f'{a.expected_min:.0f}° ~ {a.expected_max:.0f}°',
                f'{a.deviation:+.1f}° ({a.deviation_percent:.1f}%)',
                f'{severity_icon} {self._format_severity(a.severity)}',
                type_label,
            ])
        
        table = self._make_simple_table(headers, rows)
        lines.append(table)
        
        all_causes = set()
        all_recs = set()
        for a in anomalies:
            all_causes.update(a.possible_causes)
            all_recs.update(a.recommendations)
        
        if all_causes:
            lines.append('')
            lines.append('**可能原因:**')
            for cause in all_causes:
                lines.append(f'- {cause}')
        
        if all_recs:
            lines.append('')
            lines.append('**建议措施:**')
            for rec in all_recs:
                lines.append(f'- {rec}')
        
        return '\n'.join(lines)
    
    def _generate_position_variation_section(self, variations: List[PositionVariation]) -> str:
        """生成位差波动部分"""
        lines = ['### 位差波动分析', '']
        
        headers = ['指标类型', '最小值', '最大值', '极差', '标准差', '程度', '最差方位', '最佳方位']
        rows = []
        
        for v in variations:
            severity_icon = self.SEVERITY_COLORS.get(v.variation_severity, '⚪')
            metric_label = {'rate': '日差', 'amplitude': '摆幅', 'beat_error': '偏振'}.get(v.metric_type, v.metric_type)
            metric_unit = {'rate': '秒/日', 'amplitude': '度', 'beat_error': '毫秒'}.get(v.metric_type, '')
            
            rows.append([
                metric_label,
                f'{v.min_value:.2f} {metric_unit}',
                f'{v.max_value:.2f} {metric_unit}',
                f'{v.range_value:.2f} {metric_unit}',
                f'{v.standard_deviation:.2f}',
                f'{severity_icon} {self._format_severity(v.variation_severity)}',
                v.worst_position or '-',
                v.best_position or '-',
            ])
        
        table = self._make_simple_table(headers, rows)
        lines.append(table)
        
        all_causes = set()
        for v in variations:
            if v.is_concerning:
                all_causes.update(v.possible_causes)
        
        if all_causes:
            lines.append('')
            lines.append('**可能原因:**')
            for cause in all_causes:
                lines.append(f'- {cause}')
        
        return '\n'.join(lines)
    
    def _generate_service_steps(self, steps: List[ServiceStep]) -> str:
        """生成拆洗步骤部分"""
        lines = ['## 🔧 拆洗步骤记录', '']
        
        if not steps:
            lines.append('*暂无拆洗步骤记录*')
            return '\n'.join(lines)
        
        headers = ['序号', '步骤名称', '操作师傅', '状态', '耗时(分)', '发现问题']
        rows = []
        
        for step in steps:
            status_icon = self.STATUS_ICONS.get(step.status, '')
            issues = '; '.join(step.issues_found) if step.issues_found else '-'
            
            rows.append([
                str(step.step_number),
                step.step_name,
                step.technician or '-',
                f'{status_icon} {self._format_step_status(step.status)}',
                f'{step.duration_minutes:.1f}' if step.duration_minutes else '-',
                issues,
            ])
        
        table = self._make_simple_table(headers, rows)
        lines.append(table)
        
        completed = len([s for s in steps if s.status == 'completed'])
        total = len(steps)
        lines.append('')
        lines.append(f'**进度**: {completed}/{total} 步骤已完成 ({completed/total*100:.0f}%)')
        
        return '\n'.join(lines)
    
    def _generate_parts_list(self, parts: List[PartReplacement]) -> str:
        """生成零件更换清单部分"""
        lines = ['## 🔩 零件更换清单', '']
        
        if not parts:
            lines.append('*暂无零件更换记录*')
            return '\n'.join(lines)
        
        headers = ['零件编号', '零件名称', '数量', '更换原因', '旧零件状态', '成本']
        rows = []
        total_cost = 0.0
        
        for part in parts:
            cost_str = f'¥{part.cost:.2f}' if part.cost else '-'
            if part.cost:
                total_cost += part.cost * part.quantity
            
            rows.append([
                part.part_number or '-',
                part.part_name,
                str(part.quantity),
                part.reason or '-',
                part.old_part_condition or '-',
                cost_str,
            ])
        
        table = self._make_simple_table(headers, rows)
        lines.append(table)
        
        if total_cost > 0:
            lines.append('')
            lines.append(f'**零件总成本**: ¥{total_cost:.2f}')
        
        return '\n'.join(lines)
    
    def _generate_waterproof_test(self, test: WaterproofTest) -> str:
        """生成防水测试部分"""
        lines = ['## 💧 防水测试', '']
        
        result_icon = '✅' if test.result == 'pass' else '⚠️' if test.result == 'conditional' else '❌'
        
        rows = [
            ['测试日期', test.test_date.strftime('%Y-%m-%d %H:%M') if test.test_date else '-'],
            ['测试类型', self._format_test_type(test.test_type)],
            ['测试压力', f'{test.pressure_bar:.1f} 巴' if test.pressure_bar else '-'],
            ['测试时长', f'{test.duration_minutes} 分钟' if test.duration_minutes else '-'],
            ['测试结果', f'{result_icon} {self._format_test_result(test.result)}'],
            ['泄漏检测', '✅ 无泄漏' if not test.leak_detected else f'❌ 检测到泄漏'],
        ]
        
        if test.leak_location:
            rows.append(['泄漏位置', test.leak_location])
        if test.technician:
            rows.append(['操作师傅', test.technician])
        if test.equipment_model:
            rows.append(['设备型号', test.equipment_model])
        
        table = self._make_simple_table(['项目', '内容'], rows)
        lines.append(table)
        
        return '\n'.join(lines)
    
    def _generate_review_conclusion(self, review: WatchReviewConclusion) -> str:
        """生成人工复核结论部分"""
        lines = ['## 📝 人工复核结论', '']
        
        status_icon = {
            'excellent': '🌟',
            'good': '✅',
            'fair': '⚠️',
            'poor': '❌'
        }.get(review.overall_status, '⚪')
        
        rows = [
            ['复核人', review.reviewer],
            ['复核日期', review.review_date.strftime('%Y-%m-%d %H:%M') if review.review_date else '-'],
            ['整体状态', f'{status_icon} {self._format_overall_status(review.overall_status)}'],
            ['', ''],
            ['日差评估', self._format_assessment(review.rate_assessment)],
            ['摆幅评估', self._format_assessment(review.amplitude_assessment)],
            ['位差评估', self._format_assessment(review.position_variation_assessment)],
            ['防水评估', self._format_waterproof_assessment(review.waterproof_assessment)],
        ]
        
        table = self._make_simple_table(['项目', '内容'], rows)
        lines.append(table)
        
        if review.root_causes:
            lines.append('')
            lines.append('### 根本原因')
            for cause in review.root_causes:
                lines.append(f'- {cause}')
        
        if review.recommendations:
            lines.append('')
            lines.append('### 建议')
            for rec in review.recommendations:
                lines.append(f'- {rec}')
        
        if review.rework_needed:
            lines.append('')
            lines.append(f'### ⚠️ 需返修')
            if review.rework_reason:
                lines.append(f'**原因**: {review.rework_reason}')
            if review.estimated_return_days:
                lines.append(f'**预计返修天数**: {review.estimated_return_days} 天')
        
        if review.notes:
            lines.append('')
            lines.append('### 备注')
            lines.append(review.notes)
        
        return '\n'.join(lines)
    
    def _generate_footer(self) -> str:
        """生成页脚"""
        lines = [
            '---',
            '',
            '*本报告由钟表维修走时复盘工具自动生成*',
            f'*生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}*'
        ]
        return '\n'.join(lines)
    
    def _make_simple_table(self, headers: List[str], rows: List[List[str]]) -> str:
        """生成简单的 Markdown 表格"""
        lines = []
        
        lines.append('| ' + ' | '.join(headers) + ' |')
        lines.append('| ' + ' | '.join(['---' for _ in headers]) + ' |')
        
        for row in rows:
            lines.append('| ' + ' | '.join(str(cell) for cell in row) + ' |')
        
        return '\n'.join(lines)
    
    def _format_movement_type(self, mtype: str) -> str:
        """格式化机芯类型"""
        mapping = {
            'mechanical': '机械',
            'automatic': '自动机械',
            'quartz': '石英'
        }
        return mapping.get(mtype, mtype)
    
    def _format_status(self, status: str) -> str:
        """格式化工单状态"""
        mapping = {
            'received': '已收表',
            'in_service': '维修中',
            'testing': '检测中',
            'ready': '已就绪',
            'delivered': '已交付'
        }
        return mapping.get(status, status)
    
    def _format_service_type(self, stype: Optional[str]) -> str:
        """格式化服务类型"""
        if not stype:
            return '-'
        mapping = {
            'full_service': '全面保养',
            'partial_service': '部分保养',
            'repair_only': '仅维修'
        }
        return mapping.get(stype, stype)
    
    def _format_risk_level(self, level: str) -> str:
        """格式化风险等级"""
        mapping = {
            'low': '低风险',
            'medium': '中等风险',
            'high': '高风险',
            'critical': '临界风险'
        }
        return mapping.get(level, level)
    
    def _format_priority(self, priority: str) -> str:
        """格式化优先级"""
        mapping = {
            'low': '低',
            'normal': '正常',
            'high': '高',
            'urgent': '紧急'
        }
        return mapping.get(priority, priority)
    
    def _format_severity(self, severity: str) -> str:
        """格式化严重程度"""
        mapping = {
            'normal': '正常',
            'mild': '轻度',
            'moderate': '中度',
            'severe': '重度'
        }
        return mapping.get(severity, severity)
    
    def _format_step_status(self, status: str) -> str:
        """格式化步骤状态"""
        mapping = {
            'pending': '待处理',
            'in_progress': '进行中',
            'completed': '已完成',
            'skipped': '已跳过'
        }
        return mapping.get(status, status)
    
    def _format_test_type(self, ttype: str) -> str:
        """格式化测试类型"""
        mapping = {
            'dry': '干试',
            'wet': '湿试',
            'pressure': '压力测试'
        }
        return mapping.get(ttype, ttype)
    
    def _format_test_result(self, result: str) -> str:
        """格式化测试结果"""
        mapping = {
            'pass': '通过',
            'fail': '失败',
            'conditional': '有条件通过'
        }
        return mapping.get(result, result)
    
    def _format_overall_status(self, status: str) -> str:
        """格式化整体状态"""
        mapping = {
            'excellent': '优秀',
            'good': '良好',
            'fair': '一般',
            'poor': '较差'
        }
        return mapping.get(status, status)
    
    def _format_assessment(self, assessment: str) -> str:
        """格式化评估结果"""
        mapping = {
            'normal': '✅ 正常',
            'slightly_fast': '⚠️ 略快',
            'slightly_slow': '⚠️ 略慢',
            'significant_issue': '❌ 异常',
            'low': '⚠️ 偏低',
            'very_low': '❌ 过低',
            'inconsistent': '⚠️ 不稳定',
            'moderate': '⚠️ 中等',
            'significant': '❌ 明显',
            'not_tested': '未测试'
        }
        return mapping.get(assessment, assessment)
    
    def _format_waterproof_assessment(self, assessment: str) -> str:
        """格式化防水评估"""
        mapping = {
            'pass': '✅ 通过',
            'fail': '❌ 失败',
            'not_tested': '未测试'
        }
        return mapping.get(assessment, assessment)
    
    def _get_rate_color(self, rate: float) -> str:
        """获取日差颜色标识"""
        if -10 <= rate <= 10:
            return '✅'
        elif -30 <= rate <= 30:
            return '⚠️'
        else:
            return '❌'
    
    def _get_amplitude_color(self, amplitude: float) -> str:
        """获取摆幅颜色标识"""
        if 220 <= amplitude <= 320:
            return '✅'
        elif 150 <= amplitude <= 350:
            return '⚠️'
        else:
            return '❌'
    
    def _get_beat_error_color(self, beat_error: float) -> str:
        """获取偏振颜色标识"""
        if beat_error <= 0.5:
            return '✅'
        elif beat_error <= 1.0:
            return '⚠️'
        else:
            return '❌'
