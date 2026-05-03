from typing import Dict, List, Any, Optional
from datetime import datetime
import json


class ReportExporter:
    def __init__(self, 
                 validation_results: Dict[str, Any],
                 metrics: Dict[str, Any],
                 rules_result: Dict[str, Any]):
        self.validation_results = validation_results
        self.metrics = metrics
        self.rules_result = rules_result
        self.report_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def export_json(self) -> str:
        report = {
            'report_metadata': {
                'generated_at': self.report_time,
                'report_version': '1.0'
            },
            'validation_results': self.validation_results,
            'metrics': self.metrics,
            'rules_analysis': self.rules_result
        }
        return json.dumps(report, ensure_ascii=False, indent=2)

    def export_markdown(self) -> str:
        lines = []
        
        lines.append('# 自习室座位爽约和噪音投诉分析报告')
        lines.append(f'> 生成时间: {self.report_time}')
        lines.append('')
        
        lines.append('## 一、数据校验结果')
        lines.append('')
        lines.append(self._format_validation_md())
        lines.append('')
        
        lines.append('## 二、核心指标概览')
        lines.append('')
        lines.append(self._format_overall_metrics_md())
        lines.append('')
        
        lines.append('## 三、风险分析')
        lines.append('')
        lines.append(self._format_risk_analysis_md())
        lines.append('')
        
        lines.append('## 四、调整建议')
        lines.append('')
        lines.append(self._format_suggestions_md())
        lines.append('')
        
        lines.append('## 五、详细数据分析')
        lines.append('')
        lines.append(self._format_detailed_metrics_md())
        lines.append('')
        
        lines.append('---')
        lines.append('*此报告由自习室分析系统自动生成*')
        
        return '\n'.join(lines)

    def export_html(self) -> str:
        html_parts = []
        
        html_parts.append('<!DOCTYPE html>')
        html_parts.append('<html lang="zh-CN">')
        html_parts.append('<head>')
        html_parts.append('    <meta charset="UTF-8">')
        html_parts.append('    <meta name="viewport" content="width=device-width, initial-scale=1.0">')
        html_parts.append('    <title>自习室座位爽约和噪音投诉分析报告</title>')
        html_parts.append('    <style>')
        html_parts.append(self._get_css())
        html_parts.append('    </style>')
        html_parts.append('</head>')
        html_parts.append('<body>')
        html_parts.append('    <div class="container">')
        
        html_parts.append('        <header class="report-header">')
        html_parts.append('            <h1>自习室座位爽约和噪音投诉分析报告</h1>')
        html_parts.append(f'            <p class="generated-at">生成时间: {self.report_time}</p>')
        html_parts.append('        </header>')
        
        html_parts.append('        <section class="section">')
        html_parts.append('            <h2 class="section-title">一、数据校验结果</h2>')
        html_parts.append(self._format_validation_html())
        html_parts.append('        </section>')
        
        html_parts.append('        <section class="section">')
        html_parts.append('            <h2 class="section-title">二、核心指标概览</h2>')
        html_parts.append(self._format_overall_metrics_html())
        html_parts.append('        </section>')
        
        html_parts.append('        <section class="section">')
        html_parts.append('            <h2 class="section-title">三、风险分析</h2>')
        html_parts.append(self._format_risk_analysis_html())
        html_parts.append('        </section>')
        
        html_parts.append('        <section class="section">')
        html_parts.append('            <h2 class="section-title">四、调整建议</h2>')
        html_parts.append(self._format_suggestions_html())
        html_parts.append('        </section>')
        
        html_parts.append('        <footer class="report-footer">')
        html_parts.append('            <p>此报告由自习室分析系统自动生成</p>')
        html_parts.append('        </footer>')
        
        html_parts.append('    </div>')
        html_parts.append('</body>')
        html_parts.append('</html>')
        
        return '\n'.join(html_parts)

    def _format_validation_md(self) -> str:
        lines = []
        total_errors = 0
        total_warnings = 0
        
        for file_name, result in self.validation_results.items():
            errors = result.get('errors', [])
            warnings = result.get('warnings', [])
            total_errors += len(errors)
            total_warnings += len(warnings)
            
            status = '✅ 通过' if result.get('is_valid', False) else '❌ 失败'
            lines.append(f'### {file_name} - {status}')
            lines.append(f'- 数据行数: {result.get("row_count", 0)}')
            lines.append(f'- 错误数: {len(errors)}')
            lines.append(f'- 警告数: {len(warnings)}')
            lines.append('')
            
            if errors:
                lines.append('#### 错误详情:')
                for err in errors:
                    lines.append(f'- 第 {err["row_number"]} 行 `{err["field_name"]}`: {err["message"]}')
                lines.append('')
            
            if warnings:
                lines.append('#### 警告详情:')
                for warn in warnings:
                    lines.append(f'- 第 {warn["row_number"]} 行 `{warn["field_name"]}`: {warn["message"]}')
                lines.append('')
        
        lines.append(f'**汇总**: {total_errors} 个错误, {total_warnings} 个警告')
        return '\n'.join(lines)

    def _format_overall_metrics_md(self) -> str:
        overall = self.metrics.get('overall', {})
        lines = []
        
        lines.append('| 指标 | 数值 |')
        lines.append('|------|------|')
        lines.append(f'| 总预约数 | {overall.get("total_bookings", 0)} |')
        lines.append(f'| 已签到数 | {overall.get("checked_in_count", 0)} |')
        lines.append(f'| 爽约数 | {overall.get("no_show_count", 0)} |')
        lines.append(f'| **爽约率** | **{overall.get("no_show_rate", 0)}%** |')
        lines.append(f'| 迟到数 | {overall.get("late_count", 0)} |')
        lines.append(f'| **迟到率** | **{overall.get("late_rate", 0)}%** |')
        lines.append(f'| 平均迟到分钟 | {overall.get("avg_late_minutes", 0)} |')
        lines.append(f'| 取消数 | {overall.get("cancelled_count", 0)} |')
        lines.append(f'| 取消率 | {overall.get("cancellation_rate", 0)}% |')
        lines.append(f'| 噪音投诉数 | {overall.get("noise_complaint_count", 0)} |')
        lines.append(f'| 退款投诉数 | {overall.get("refund_complaint_count", 0)} |')
        lines.append(f'| **投诉率** | **{overall.get("complaint_rate", 0)}%** |')
        lines.append(f'| 退款率 | {overall.get("refund_rate", 0)}% |')
        lines.append(f'| **座位利用率** | **{overall.get("utilization_rate", 0)}%** |')
        lines.append(f'| 总保证金 | {overall.get("total_deposit", 0)} 元 |')
        
        return '\n'.join(lines)

    def _format_risk_analysis_md(self) -> str:
        lines = []
        summary = self.rules_result.get('summary', {})
        risk_items = self.rules_result.get('risk_items', [])
        
        lines.append(f'- 总风险项数: {summary.get("total_risk_items", 0)}')
        lines.append(f'- 风险等级分布:')
        
        dist = summary.get('risk_level_distribution', {})
        for level, count in dist.items():
            level_name = {
                'critical': '🔴 严重',
                'high': '🟠 高',
                'medium': '🟡 中等',
                'low': '🟢 低'
            }.get(level, level)
            lines.append(f'  - {level_name}: {count} 项')
        
        lines.append('')
        lines.append('### 高风险项详情')
        lines.append('')
        
        high_risk = [r for r in risk_items if r.get('risk_level') in ['critical', 'high']]
        if not high_risk:
            lines.append('暂无高风险项 🎉')
        else:
            for item in high_risk[:10]:
                level_icon = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🟢'}.get(item.get('risk_level'), '⚪')
                lines.append(f'#### {level_icon} {item.get("item_name")} (风险评分: {item.get("risk_score")})')
                lines.append(f'- 类型: {self._get_type_name(item.get("item_type"))}')
                lines.append('')
                lines.append('**问题:**')
                for issue in item.get('issues', []):
                    lines.append(f'- {issue}')
                lines.append('')
                lines.append('**建议:**')
                for sug in item.get('suggestions', []):
                    lines.append(f'- {sug}')
                lines.append('')
        
        return '\n'.join(lines)

    def _format_suggestions_md(self) -> str:
        lines = []
        suggestions = self.rules_result.get('suggestions', [])
        
        if not suggestions:
            lines.append('暂无具体调整建议')
            return '\n'.join(lines)
        
        for i, sug in enumerate(suggestions, 1):
            priority_icon = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}.get(sug.get('priority'), '⚪')
            lines.append(f'### {priority_icon} 建议 {i}: {sug.get("title")}')
            lines.append(f'> 优先级: {self._get_priority_name(sug.get("priority"))}')
            lines.append('')
            lines.append(sug.get('description', ''))
            lines.append('')
            
            affected = sug.get('affected_items', [])
            if affected:
                lines.append('**受影响项:**')
                for item in affected:
                    lines.append(f'- {item.get("name", item.get("id", ""))}')
                lines.append('')
            
            impact = sug.get('expected_impact', {})
            if impact:
                lines.append('**预期效果:**')
                for key, value in impact.items():
                    lines.append(f'- {key}: {value}')
                lines.append('')
            
            steps = sug.get('implementation_steps', [])
            if steps:
                lines.append('**实施步骤:**')
                for j, step in enumerate(steps, 1):
                    lines.append(f'{j}. {step}')
                lines.append('')
        
        return '\n'.join(lines)

    def _format_detailed_metrics_md(self) -> str:
        lines = []
        
        lines.append('### 按区域分析')
        lines.append('')
        zones = self.metrics.get('by_zone', {})
        if zones:
            lines.append('| 区域 | 预约数 | 爽约率 | 迟到率 | 投诉率 | 噪音投诉 |')
            lines.append('|------|--------|--------|--------|--------|----------|')
            for zone_id, zone in zones.items():
                lines.append(f'| {zone.get("zone_name", zone_id)} | {zone.get("total_bookings", 0)} | {zone.get("no_show_rate", 0)}% | {zone.get("late_rate", 0)}% | {zone.get("complaint_rate", 0)}% | {zone.get("noise_complaints", 0)} |')
        else:
            lines.append('暂无区域数据')
        lines.append('')
        
        lines.append('### 按时段分析')
        lines.append('')
        slots = self.metrics.get('by_time_slot', {})
        if slots:
            lines.append('| 时段 | 预约数 | 爽约率 | 迟到率 | 投诉数 |')
            lines.append('|------|--------|--------|--------|--------|')
            for slot_id, slot in slots.items():
                lines.append(f'| {slot.get("slot_name", slot_id)} | {slot.get("total_bookings", 0)} | {slot.get("no_show_rate", 0)}% | {slot.get("late_rate", 0)}% | {slot.get("complaints", 0)} |')
        else:
            lines.append('暂无时段数据')
        lines.append('')
        
        return '\n'.join(lines)

    def _format_validation_html(self) -> str:
        parts = []
        total_errors = 0
        total_warnings = 0
        
        for file_name, result in self.validation_results.items():
            errors = result.get('errors', [])
            warnings = result.get('warnings', [])
            total_errors += len(errors)
            total_warnings += len(warnings)
            
            status_class = 'success' if result.get('is_valid', False) else 'error'
            status_text = '通过' if result.get('is_valid', False) else '失败'
            
            parts.append(f'<div class="validation-card {status_class}">')
            parts.append(f'    <h3>{file_name} <span class="badge {status_class}">{status_text}</span></h3>')
            parts.append(f'    <p>数据行数: {result.get("row_count", 0)} | 错误: {len(errors)} | 警告: {len(warnings)}</p>')
            
            if errors:
                parts.append('    <div class="error-list">')
                parts.append('        <h4>错误详情</h4>')
                parts.append('        <ul>')
                for err in errors:
                    parts.append(f'            <li><strong>第 {err["row_number"]} 行</strong> [{err["field_name"]}]: {err["message"]}</li>')
                parts.append('        </ul>')
                parts.append('    </div>')
            
            if warnings:
                parts.append('    <div class="warning-list">')
                parts.append('        <h4>警告详情</h4>')
                parts.append('        <ul>')
                for warn in warnings:
                    parts.append(f'            <li><strong>第 {warn["row_number"]} 行</strong> [{warn["field_name"]}]: {warn["message"]}</li>')
                parts.append('        </ul>')
                parts.append('    </div>')
            
            parts.append('</div>')
        
        parts.append(f'<div class="summary-box"><strong>汇总:</strong> {total_errors} 个错误, {total_warnings} 个警告</div>')
        
        return '\n'.join(parts)

    def _format_overall_metrics_html(self) -> str:
        overall = self.metrics.get('overall', {})
        parts = []
        
        parts.append('<div class="metrics-grid">')
        
        key_metrics = [
            ('总预约数', overall.get('total_bookings', 0), ''),
            ('爽约率', f"{overall.get('no_show_rate', 0)}%", 'critical'),
            ('迟到率', f"{overall.get('late_rate', 0)}%", 'warning'),
            ('投诉率', f"{overall.get('complaint_rate', 0)}%", 'warning'),
            ('座位利用率', f"{overall.get('utilization_rate', 0)}%", 'success'),
            ('总保证金', f"{overall.get('total_deposit', 0)} 元", '')
        ]
        
        for label, value, status in key_metrics:
            status_class = f'metric-{status}' if status else ''
            parts.append(f'    <div class="metric-card {status_class}">')
            parts.append(f'        <div class="metric-value">{value}</div>')
            parts.append(f'        <div class="metric-label">{label}</div>')
            parts.append('    </div>')
        
        parts.append('</div>')
        
        parts.append('<div class="metrics-detail">')
        parts.append('    <table class="detail-table">')
        parts.append('        <thead><tr><th>指标</th><th>数值</th></tr></thead>')
        parts.append('        <tbody>')
        
        detail_metrics = [
            ('已签到数', overall.get('checked_in_count', 0)),
            ('爽约数', overall.get('no_show_count', 0)),
            ('迟到数', overall.get('late_count', 0)),
            ('平均迟到分钟', overall.get('avg_late_minutes', 0)),
            ('取消数', overall.get('cancelled_count', 0)),
            ('取消率', f"{overall.get('cancellation_rate', 0)}%"),
            ('噪音投诉数', overall.get('noise_complaint_count', 0)),
            ('退款投诉数', overall.get('refund_complaint_count', 0)),
            ('退款率', f"{overall.get('refund_rate', 0)}%")
        ]
        
        for label, value in detail_metrics:
            parts.append(f'            <tr><td>{label}</td><td>{value}</td></tr>')
        
        parts.append('        </tbody>')
        parts.append('    </table>')
        parts.append('</div>')
        
        return '\n'.join(parts)

    def _format_risk_analysis_html(self) -> str:
        parts = []
        summary = self.rules_result.get('summary', {})
        risk_items = self.rules_result.get('risk_items', [])
        
        parts.append('<div class="risk-summary">')
        parts.append(f'    <p><strong>总风险项数:</strong> {summary.get("total_risk_items", 0)}</p>')
        parts.append('    <div class="risk-distribution">')
        
        dist = summary.get('risk_level_distribution', {})
        for level, count in dist.items():
            level_class = level
            level_name = {
                'critical': '严重',
                'high': '高',
                'medium': '中等',
                'low': '低'
            }.get(level, level)
            parts.append(f'        <span class="risk-badge {level_class}">{level_name}: {count}</span>')
        
        parts.append('    </div>')
        parts.append('</div>')
        
        high_risk = [r for r in risk_items if r.get('risk_level') in ['critical', 'high']]
        if high_risk:
            parts.append('<div class="risk-items">')
            parts.append('    <h3>高风险项详情</h3>')
            
            for item in high_risk:
                level_class = item.get('risk_level', 'low')
                level_name = {
                    'critical': '严重',
                    'high': '高',
                    'medium': '中等',
                    'low': '低'
                }.get(item.get('risk_level'), '未知')
                
                parts.append(f'    <div class="risk-item-card {level_class}">')
                parts.append(f'        <div class="risk-header">')
                parts.append(f'            <span class="risk-name">{item.get("item_name")}</span>')
                parts.append(f'            <span class="risk-score">风险评分: {item.get("risk_score")} ({level_name})</span>')
                parts.append('        </div>')
                parts.append(f'        <div class="risk-type">类型: {self._get_type_name(item.get("item_type"))}</div>')
                
                if item.get('issues'):
                    parts.append('        <div class="risk-section">')
                    parts.append('            <h4>问题</h4>')
                    parts.append('            <ul>')
                    for issue in item.get('issues', []):
                        parts.append(f'                <li>{issue}</li>')
                    parts.append('            </ul>')
                    parts.append('        </div>')
                
                if item.get('suggestions'):
                    parts.append('        <div class="risk-section">')
                    parts.append('            <h4>建议</h4>')
                    parts.append('            <ul>')
                    for sug in item.get('suggestions', []):
                        parts.append(f'                <li>{sug}</li>')
                    parts.append('            </ul>')
                    parts.append('        </div>')
                
                parts.append('    </div>')
            
            parts.append('</div>')
        else:
            parts.append('<div class="no-risk">暂无高风险项 🎉</div>')
        
        return '\n'.join(parts)

    def _format_suggestions_html(self) -> str:
        parts = []
        suggestions = self.rules_result.get('suggestions', [])
        
        if not suggestions:
            parts.append('<p class="no-suggestions">暂无具体调整建议</p>')
            return '\n'.join(parts)
        
        for i, sug in enumerate(suggestions, 1):
            priority_class = sug.get('priority', 'low')
            priority_name = {'high': '高优先级', 'medium': '中优先级', 'low': '低优先级'}.get(sug.get('priority'), '未知')
            
            parts.append(f'<div class="suggestion-card {priority_class}">')
            parts.append(f'    <div class="suggestion-header">')
            parts.append(f'        <span class="suggestion-title">建议 {i}: {sug.get("title")}</span>')
            parts.append(f'        <span class="priority-badge {priority_class}">{priority_name}</span>')
            parts.append('    </div>')
            parts.append(f'    <p class="suggestion-desc">{sug.get("description", "")}</p>')
            
            affected = sug.get('affected_items', [])
            if affected:
                parts.append('    <div class="suggestion-section">')
                parts.append('        <h4>受影响项</h4>')
                parts.append('        <ul class="affected-list">')
                for item in affected:
                    parts.append(f'            <li>{item.get("name", item.get("id", ""))}</li>')
                parts.append('        </ul>')
                parts.append('    </div>')
            
            impact = sug.get('expected_impact', {})
            if impact:
                parts.append('    <div class="suggestion-section">')
                parts.append('        <h4>预期效果</h4>')
                parts.append('        <ul class="impact-list">')
                for key, value in impact.items():
                    parts.append(f'            <li><strong>{key}:</strong> {value}</li>')
                parts.append('        </ul>')
                parts.append('    </div>')
            
            steps = sug.get('implementation_steps', [])
            if steps:
                parts.append('    <div class="suggestion-section">')
                parts.append('        <h4>实施步骤</h4>')
                parts.append('        <ol class="steps-list">')
                for step in steps:
                    parts.append(f'            <li>{step}</li>')
                parts.append('        </ol>')
                parts.append('    </div>')
            
            parts.append('</div>')
        
        return '\n'.join(parts)

    def _get_type_name(self, item_type: str) -> str:
        names = {
            'member': '会员',
            'zone': '区域',
            'time_slot': '时段',
            'seat': '座位'
        }
        return names.get(item_type, item_type)

    def _get_priority_name(self, priority: str) -> str:
        names = {
            'high': '高优先级',
            'medium': '中优先级',
            'low': '低优先级'
        }
        return names.get(priority, priority)

    def _get_css(self) -> str:
        return '''
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f5f5f5;
            }
            
            .container {
                max-width: 1000px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .report-header {
                text-align: center;
                padding: 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 10px;
                margin-bottom: 30px;
            }
            
            .report-header h1 {
                font-size: 2em;
                margin-bottom: 10px;
            }
            
            .generated-at {
                font-size: 0.9em;
                opacity: 0.9;
            }
            
            .section {
                background: white;
                padding: 25px;
                border-radius: 10px;
                margin-bottom: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            
            .section-title {
                color: #667eea;
                border-bottom: 2px solid #667eea;
                padding-bottom: 10px;
                margin-bottom: 20px;
            }
            
            .validation-card {
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
            }
            
            .validation-card.success {
                border-color: #48bb78;
            }
            
            .validation-card.error {
                border-color: #f56565;
            }
            
            .badge {
                padding: 3px 10px;
                border-radius: 12px;
                font-size: 0.8em;
                font-weight: bold;
            }
            
            .badge.success {
                background: #c6f6d5;
                color: #22543d;
            }
            
            .badge.error {
                background: #fed7d7;
                color: #742a2a;
            }
            
            .error-list, .warning-list {
                margin-top: 10px;
                padding: 10px;
                border-radius: 5px;
            }
            
            .error-list {
                background: #fff5f5;
            }
            
            .warning-list {
                background: #fffbeb;
            }
            
            .error-list ul, .warning-list ul {
                margin-left: 20px;
                color: #742a2a;
            }
            
            .summary-box {
                padding: 15px;
                background: #edf2f7;
                border-radius: 8px;
                margin-top: 15px;
            }
            
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .metric-card {
                background: linear-gradient(135deg, #f6f8fb 0%, #e9ecef 100%);
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                border-left: 4px solid #667eea;
            }
            
            .metric-critical {
                border-left-color: #f56565;
                background: linear-gradient(135deg, #fff5f5 0%, #fed7d7 100%);
            }
            
            .metric-warning {
                border-left-color: #ed8936;
                background: linear-gradient(135deg, #fffbeb 0%, #feebc8 100%);
            }
            
            .metric-success {
                border-left-color: #48bb78;
                background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
            }
            
            .metric-value {
                font-size: 2em;
                font-weight: bold;
                color: #667eea;
            }
            
            .metric-critical .metric-value {
                color: #c53030;
            }
            
            .metric-warning .metric-value {
                color: #c05621;
            }
            
            .metric-success .metric-value {
                color: #22543d;
            }
            
            .metric-label {
                font-size: 0.9em;
                color: #666;
                margin-top: 5px;
            }
            
            .detail-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .detail-table th, .detail-table td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .detail-table th {
                background: #f6f8fb;
                font-weight: bold;
            }
            
            .detail-table tr:hover {
                background: #f9fafb;
            }
            
            .risk-summary {
                padding: 15px;
                background: #edf2f7;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .risk-distribution {
                margin-top: 10px;
            }
            
            .risk-badge {
                display: inline-block;
                padding: 5px 12px;
                border-radius: 15px;
                margin-right: 10px;
                font-size: 0.9em;
                font-weight: bold;
            }
            
            .risk-badge.critical {
                background: #fed7d7;
                color: #742a2a;
            }
            
            .risk-badge.high {
                background: #fed7aa;
                color: #7c2d12;
            }
            
            .risk-badge.medium {
                background: #fef3c7;
                color: #78350f;
            }
            
            .risk-badge.low {
                background: #d1fae5;
                color: #065f46;
            }
            
            .risk-item-card {
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 15px;
            }
            
            .risk-item-card.critical {
                border-color: #f56565;
                background: #fff5f5;
            }
            
            .risk-item-card.high {
                border-color: #ed8936;
                background: #fffbeb;
            }
            
            .risk-item-card.medium {
                border-color: #ecc94b;
                background: #fffff0;
            }
            
            .risk-item-card.low {
                border-color: #68d391;
                background: #f0fff4;
            }
            
            .risk-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .risk-name {
                font-weight: bold;
                font-size: 1.1em;
            }
            
            .risk-score {
                font-size: 0.9em;
                color: #666;
            }
            
            .risk-type {
                font-size: 0.9em;
                color: #888;
                margin-bottom: 10px;
            }
            
            .risk-section {
                margin-top: 10px;
            }
            
            .risk-section h4 {
                color: #555;
                margin-bottom: 5px;
            }
            
            .risk-section ul {
                margin-left: 20px;
            }
            
            .no-risk {
                text-align: center;
                padding: 30px;
                background: #f0fff4;
                border-radius: 10px;
                color: #22543d;
                font-size: 1.1em;
            }
            
            .suggestion-card {
                border: 2px solid #e0e0e0;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 20px;
                background: white;
            }
            
            .suggestion-card.high {
                border-color: #f56565;
            }
            
            .suggestion-card.medium {
                border-color: #ed8936;
            }
            
            .suggestion-card.low {
                border-color: #48bb78;
            }
            
            .suggestion-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .suggestion-title {
                font-weight: bold;
                font-size: 1.2em;
                color: #333;
            }
            
            .priority-badge {
                padding: 5px 12px;
                border-radius: 15px;
                font-size: 0.85em;
                font-weight: bold;
            }
            
            .priority-badge.high {
                background: #fed7d7;
                color: #742a2a;
            }
            
            .priority-badge.medium {
                background: #fed7aa;
                color: #7c2d12;
            }
            
            .priority-badge.low {
                background: #c6f6d5;
                color: #22543d;
            }
            
            .suggestion-desc {
                color: #666;
                margin-bottom: 15px;
            }
            
            .suggestion-section {
                margin-top: 15px;
                padding: 10px;
                background: #f9fafb;
                border-radius: 5px;
            }
            
            .suggestion-section h4 {
                color: #555;
                margin-bottom: 8px;
            }
            
            .affected-list, .impact-list, .steps-list {
                margin-left: 20px;
            }
            
            .steps-list li {
                margin-bottom: 5px;
            }
            
            .no-suggestions {
                text-align: center;
                padding: 20px;
                color: #666;
            }
            
            .report-footer {
                text-align: center;
                padding: 20px;
                color: #888;
                font-size: 0.9em;
                margin-top: 30px;
            }
        '''
