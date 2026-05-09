import json
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from jinja2 import Template

from alert_reducer.models import (
    Alert, MergedAlert, SuppressedAlert, EscalatedAlert,
    ProcessBatch, FailureLog
)


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>值班告警降噪报告 - {{ report_date }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .header .meta {
            opacity: 0.9;
            font-size: 14px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .stat-card .label {
            color: #666;
            font-size: 14px;
            margin-bottom: 8px;
        }
        .stat-card .value {
            font-size: 36px;
            font-weight: bold;
            color: #333;
        }
        .stat-card.critical .value { color: #e53e3e; }
        .stat-card.warning .value { color: #dd6b20; }
        .stat-card.success .value { color: #38a169; }
        .section {
            background: white;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .section h2 {
            margin: 0 0 20px 0;
            color: #333;
            font-size: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #555;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-P1, .badge-critical { background: #fed7d7; color: #c53030; }
        .badge-P2, .badge-high { background: #feebc8; color: #c05621; }
        .badge-P3 { background: #bee3f8; color: #2b6cb0; }
        .badge-P4, .badge-P5 { background: #e2e8f0; color: #4a5568; }
        .badge-escalated { background: #feb2b2; color: #c53030; }
        .badge-suppressed { background: #c6f6d5; color: #276749; }
        .badge-merged { background: #e9d8fd; color: #6b46c1; }
        .badge-pending { background: #feebc8; color: #c05621; }
        .empty-state {
            text-align: center;
            padding: 40px;
            color: #999;
        }
        .summary-box {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #667eea;
        }
        .summary-box h3 {
            margin: 0 0 10px 0;
            color: #2d3748;
        }
        .summary-box p {
            margin: 5px 0;
            color: #4a5568;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 值班告警降噪报告</h1>
        <div class="meta">
            报告时间: {{ report_date }} | 时间范围: {{ time_range.start }} - {{ time_range.end }}
        </div>
    </div>
    
    <div class="summary-box">
        <h3>📋 执行摘要</h3>
        <p><strong>总告警数:</strong> {{ summary.total_alerts }}</p>
        <p><strong>降噪率:</strong> {{ "%.1f"|format(summary.noise_reduction_rate) }}%</p>
        <p><strong>需要关注的告警:</strong> {{ summary.needs_attention }}</p>
        <p><strong>主要告警类型:</strong> {{ summary.top_alert_types|join(", ") }}</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="label">总告警数</div>
            <div class="value">{{ stats.total_alerts }}</div>
        </div>
        <div class="stat-card success">
            <div class="label">已抑制</div>
            <div class="value">{{ stats.suppressed_alerts }}</div>
        </div>
        <div class="stat-card">
            <div class="label">已合并</div>
            <div class="value">{{ stats.merged_alerts }}</div>
        </div>
        <div class="stat-card critical">
            <div class="label">已升级</div>
            <div class="value">{{ stats.escalated_alerts }}</div>
        </div>
        <div class="stat-card warning">
            <div class="label">处理批次</div>
            <div class="value">{{ stats.batches_count }}</div>
        </div>
        <div class="stat-card">
            <div class="label">失败次数</div>
            <div class="value">{{ stats.failures_count }}</div>
        </div>
    </div>
    
    {% if escalated_alerts %}
    <div class="section">
        <h2>🚨 需要立即关注的告警 (已升级)</h2>
        <table>
            <thead>
                <tr>
                    <th>告警名称</th>
                    <th>优先级</th>
                    <th>升级级别</th>
                    <th>通知对象</th>
                    <th>时间</th>
                </tr>
            </thead>
            <tbody>
                {% for alert in escalated_alerts %}
                <tr>
                    <td>{{ alert.alertname }}</td>
                    <td><span class="badge badge-{{ alert.severity }}">{{ alert.severity }}</span></td>
                    <td><span class="badge badge-{{ alert.escalation_level }}">{{ alert.escalation_level }}</span></td>
                    <td>{{ alert.notify_list }}</td>
                    <td>{{ alert.created_at }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}
    
    {% if suppressed_alerts %}
    <div class="section">
        <h2>🔇 已抑制的告警</h2>
        <table>
            <thead>
                <tr>
                    <th>告警名称</th>
                    <th>优先级</th>
                    <th>抑制规则</th>
                    <th>原因</th>
                    <th>时间</th>
                </tr>
            </thead>
            <tbody>
                {% for alert in suppressed_alerts %}
                <tr>
                    <td>{{ alert.alertname }}</td>
                    <td><span class="badge badge-{{ alert.severity }}">{{ alert.severity }}</span></td>
                    <td>{{ alert.rule_name }}</td>
                    <td>{{ alert.reason }}</td>
                    <td>{{ alert.created_at }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}
    
    {% if merged_alerts %}
    <div class="section">
        <h2>🔗 已合并的告警组</h2>
        <table>
            <thead>
                <tr>
                    <th>告警数量</th>
                    <th>状态</th>
                    <th>开始时间</th>
                    <th>结束时间</th>
                </tr>
            </thead>
            <tbody>
                {% for merged in merged_alerts %}
                <tr>
                    <td>{{ merged.alert_count }}</td>
                    <td><span class="badge badge-{{ merged.status }}">{{ merged.status }}</span></td>
                    <td>{{ merged.starts_at }}</td>
                    <td>{{ merged.ends_at or '-' }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}
    
    {% if failures %}
    <div class="section">
        <h2>⚠️ 处理失败记录</h2>
        <table>
            <thead>
                <tr>
                    <th>操作</th>
                    <th>错误类型</th>
                    <th>错误信息</th>
                    <th>时间</th>
                </tr>
            </thead>
            <tbody>
                {% for failure in failures %}
                <tr>
                    <td>{{ failure.operation }}</td>
                    <td>{{ failure.error_type }}</td>
                    <td>{{ failure.error_message[:100] }}{% if failure.error_message|length > 100 %}...{% endif %}</td>
                    <td>{{ failure.created_at }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    {% endif %}
    
    <div class="section">
        <h2>💡 改进建议</h2>
        {% if suggestions %}
        <ul>
            {% for suggestion in suggestions %}
            <li>{{ suggestion }}</li>
            {% endfor %}
        </ul>
        {% else %}
        <div class="empty-state">当前配置合理，无特别建议</div>
        {% endif %}
    </div>
</body>
</html>
"""


class AlertReporter:
    """告警报告生成器"""
    
    def __init__(self, session: Session):
        self.session = session
    
    def _get_alerts(self, start_time: datetime = None, end_time: datetime = None,
                    status: str = None, severity: str = None) -> List[Alert]:
        """获取告警"""
        query = self.session.query(Alert)
        
        if start_time:
            query = query.filter(Alert.starts_at >= start_time)
        if end_time:
            query = query.filter(Alert.starts_at <= end_time)
        if status:
            query = query.filter(Alert.status == status)
        if severity:
            query = query.filter(Alert.severity == severity)
        
        return query.order_by(Alert.starts_at.desc()).all()
    
    def _get_escalated_alerts(self, start_time: datetime = None, 
                               end_time: datetime = None) -> List[Dict[str, Any]]:
        """获取升级的告警"""
        query = self.session.query(EscalatedAlert)
        
        if start_time:
            query = query.filter(EscalatedAlert.created_at >= start_time)
        if end_time:
            query = query.filter(EscalatedAlert.created_at <= end_time)
        
        escalated = query.order_by(EscalatedAlert.created_at.desc()).all()
        
        result = []
        for e in escalated:
            alert = None
            if e.alert_id:
                alert = self.session.query(Alert).filter(Alert.id == e.alert_id).first()
            
            result.append({
                'id': e.id,
                'alertname': alert.alertname if alert else 'Merged Alert',
                'severity': alert.severity if alert else 'N/A',
                'escalation_level': e.escalation_level,
                'strategy_name': e.strategy_name,
                'notify_list': e.notify_list,
                'created_at': e.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return result
    
    def _get_suppressed_alerts(self, start_time: datetime = None,
                                end_time: datetime = None) -> List[Dict[str, Any]]:
        """获取抑制的告警"""
        query = self.session.query(SuppressedAlert)
        
        if start_time:
            query = query.filter(SuppressedAlert.created_at >= start_time)
        if end_time:
            query = query.filter(SuppressedAlert.created_at <= end_time)
        
        suppressed = query.order_by(SuppressedAlert.created_at.desc()).all()
        
        result = []
        for s in suppressed:
            alert = self.session.query(Alert).filter(Alert.id == s.alert_id).first()
            
            result.append({
                'id': s.id,
                'alertname': alert.alertname if alert else 'Unknown',
                'severity': alert.severity if alert else 'N/A',
                'rule_id': s.rule_id,
                'rule_name': s.rule_name,
                'reason': s.reason,
                'created_at': s.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return result
    
    def _get_merged_alerts(self, start_time: datetime = None,
                            end_time: datetime = None) -> List[Dict[str, Any]]:
        """获取合并的告警"""
        query = self.session.query(MergedAlert)
        
        if start_time:
            query = query.filter(MergedAlert.starts_at >= start_time)
        if end_time:
            query = query.filter(MergedAlert.starts_at <= end_time)
        
        merged = query.order_by(MergedAlert.starts_at.desc()).all()
        
        return [{
            'id': m.id,
            'merge_key': m.merge_key,
            'alert_count': m.alert_count,
            'status': m.status,
            'is_escalated': m.is_escalated,
            'starts_at': m.starts_at.strftime('%Y-%m-%d %H:%M:%S'),
            'ends_at': m.ends_at.strftime('%Y-%m-%d %H:%M:%S') if m.ends_at else None
        } for m in merged]
    
    def _get_failures(self, start_time: datetime = None,
                      end_time: datetime = None) -> List[Dict[str, Any]]:
        """获取失败记录"""
        query = self.session.query(FailureLog)
        
        if start_time:
            query = query.filter(FailureLog.created_at >= start_time)
        if end_time:
            query = query.filter(FailureLog.created_at <= end_time)
        
        failures = query.order_by(FailureLog.created_at.desc()).all()
        
        return [{
            'id': f.id,
            'operation': f.operation,
            'error_type': f.error_type,
            'error_message': f.error_message,
            'created_at': f.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for f in failures]
    
    def _get_batches(self, start_time: datetime = None,
                     end_time: datetime = None) -> List[ProcessBatch]:
        """获取处理批次"""
        query = self.session.query(ProcessBatch)
        
        if start_time:
            query = query.filter(ProcessBatch.created_at >= start_time)
        if end_time:
            query = query.filter(ProcessBatch.created_at <= end_time)
        
        return query.order_by(ProcessBatch.created_at.desc()).all()
    
    def _generate_suggestions(self, stats: Dict[str, Any], 
                               alerts: List[Alert]) -> List[str]:
        """生成改进建议"""
        suggestions = []
        
        # 高优先级告警过多
        p1_count = len([a for a in alerts if a.severity == 'P1'])
        p2_count = len([a for a in alerts if a.severity == 'P2'])
        
        if p1_count > 5:
            suggestions.append(f"⚠️ P1级别告警数量较多({p1_count}个)，建议检查系统稳定性")
        
        if p2_count > 10:
            suggestions.append(f"⚠️ P2级别告警数量较多({p2_count}个)，建议优化告警阈值")
        
        # 抑制率分析
        if stats['total_alerts'] > 0:
            suppress_rate = stats['suppressed_alerts'] / stats['total_alerts']
            if suppress_rate < 0.2:
                suggestions.append("💡 抑制率较低(%.1f%%)，建议检查抑制规则配置" % (suppress_rate * 100))
            elif suppress_rate > 0.8:
                suggestions.append("⚠️ 抑制率过高(%.1f%%)，可能会漏掉重要告警" % (suppress_rate * 100))
        
        # 升级率分析
        if stats['total_alerts'] > 0:
            escalate_rate = stats['escalated_alerts'] / stats['total_alerts']
            if escalate_rate > 0.3:
                suggestions.append("⚠️ 升级率较高(%.1f%%)，建议检查升级策略配置" % (escalate_rate * 100))
        
        return suggestions
    
    def generate_report(self, start_time: datetime = None, end_time: datetime = None,
                        format: str = 'html') -> Dict[str, Any]:
        """生成报告"""
        # 默认时间范围：最近24小时
        if not end_time:
            end_time = datetime.utcnow()
        if not start_time:
            start_time = end_time - timedelta(hours=24)
        
        # 获取数据
        alerts = self._get_alerts(start_time, end_time)
        escalated_alerts = self._get_escalated_alerts(start_time, end_time)
        suppressed_alerts = self._get_suppressed_alerts(start_time, end_time)
        merged_alerts = self._get_merged_alerts(start_time, end_time)
        failures = self._get_failures(start_time, end_time)
        batches = self._get_batches(start_time, end_time)
        
        # 统计
        stats = {
            'total_alerts': len(alerts),
            'suppressed_alerts': len(suppressed_alerts),
            'merged_alerts': len(merged_alerts),
            'escalated_alerts': len(escalated_alerts),
            'batches_count': len(batches),
            'failures_count': len(failures)
        }
        
        # 摘要
        noise_reduction = 0
        if stats['total_alerts'] > 0:
            noise_reduction = (stats['suppressed_alerts'] + stats['merged_alerts']) / stats['total_alerts'] * 100
        
        # 获取主要告警类型
        alert_names = {}
        for alert in alerts:
            alert_names[alert.alertname] = alert_names.get(alert.alertname, 0) + 1
        top_alert_types = sorted(alert_names.items(), key=lambda x: x[1], reverse=True)[:5]
        
        summary = {
            'total_alerts': len(alerts),
            'noise_reduction_rate': noise_reduction,
            'needs_attention': stats['escalated_alerts'],
            'top_alert_types': [name for name, count in top_alert_types]
        }
        
        # 建议
        suggestions = self._generate_suggestions(stats, alerts)
        
        report_data = {
            'report_date': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S'),
            'time_range': {
                'start': start_time.strftime('%Y-%m-%d %H:%M:%S'),
                'end': end_time.strftime('%Y-%m-%d %H:%M:%S')
            },
            'stats': stats,
            'summary': summary,
            'escalated_alerts': escalated_alerts,
            'suppressed_alerts': suppressed_alerts,
            'merged_alerts': merged_alerts,
            'failures': failures,
            'suggestions': suggestions
        }
        
        if format == 'html':
            template = Template(HTML_TEMPLATE)
            report_data['html'] = template.render(**report_data)
        
        return report_data
