from datetime import datetime
from typing import List, Dict, Any
import os

from cold_chain.models import TraceResult, TemperatureSeverity


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def _format_datetime(self, dt: datetime) -> str:
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def generate_text_report(self, result: TraceResult) -> str:
        lines = []
        
        lines.append("=" * 80)
        lines.append("冷链温控异常追溯报告")
        lines.append("=" * 80)
        lines.append(f"生成时间：{self._format_datetime(result.execution_time)}")
        lines.append("")
        
        lines.append("一、执行摘要")
        lines.append("-" * 80)
        lines.append(f"  分析批次总数：{result.total_batches}")
        lines.append(f"  存在异常批次：{result.batches_with_anomalies}")
        lines.append(f"  检测到异常数：{result.total_anomalies}")
        lines.append(f"  发现数据缺口：{len(result.data_gaps)}")
        lines.append(f"  检测时间漂移：{len(result.time_drifts)}")
        lines.append("")
        
        if result.anomalies:
            lines.append("二、异常详情")
            lines.append("-" * 80)
            lines.append("")
            
            for i, anomaly in enumerate(result.anomalies, 1):
                lines.append(f"【异常 {i}】ID: {anomaly.anomaly_id}")
                lines.append(f"  所属批次：{anomaly.batch_id}")
                lines.append(f"  涉及车辆：{anomaly.vehicle_id}")
                lines.append(f"  传感器ID：{anomaly.sensor_id}")
                lines.append(f"  严重程度：{anomaly.severity.value}")
                lines.append(f"  开始时间：{self._format_datetime(anomaly.start_time)}")
                lines.append(f"  结束时间：{self._format_datetime(anomaly.end_time)}")
                lines.append(f"  持续时间：{round(anomaly.duration_minutes, 1)} 分钟")
                lines.append("  温度范围：")
                lines.append(f"    最高温度：{anomaly.max_temperature} °C")
                lines.append(f"    最低温度：{anomaly.min_temperature} °C")
                lines.append(f"    平均温度：{round(anomaly.avg_temperature, 2)} °C")
                lines.append("")
                
                if anomaly.responsible_segments:
                    lines.append("  责任区间分析：")
                    for j, segment in enumerate(anomaly.responsible_segments, 1):
                        lines.append(f"    【责任段 {j}】")
                        if segment['responsibility_type'] == 'driver':
                            lines.append(f"      类型：运输途中（司机）")
                            lines.append(f"      司机ID：{segment['driver_id']}")
                            lines.append(f"      司机姓名：{segment['driver_name']}")
                            lines.append(f"      车辆ID：{segment['vehicle_id']}")
                            lines.append(f"      路线：{segment['start_node_name']} → {segment['end_node_name']}")
                        else:
                            lines.append(f"      类型：节点作业")
                            lines.append(f"      节点：{segment['node_name']}")
                            lines.append(f"      操作员：{segment['operator']}")
                        
                        start, end = segment['time_range']
                        lines.append(f"      时间范围：{self._format_datetime(start)} 至 {self._format_datetime(end)}")
                        lines.append(f"      责任占比：{round(segment.get('overlap_ratio', 1) * 100, 1)}%")
                    lines.append("")
                
                if anomaly.notes:
                    lines.append("  说明信息：")
                    for note in anomaly.notes:
                        lines.append(f"    • {note}")
                    lines.append("")
                
                if anomaly.data_gaps:
                    lines.append("  数据缺口：")
                    for gap in anomaly.data_gaps:
                        lines.append(f"    • {gap['description']}")
                    lines.append("")
                
                if anomaly.requires_manual_confirmation:
                    lines.append("  ⚠️ 需要人工确认")
                lines.append("")
        
        if result.batch_summary:
            lines.append("三、批次追踪汇总")
            lines.append("-" * 80)
            lines.append("")
            
            for batch_id, info in result.batch_summary.items():
                lines.append(f"批次 {batch_id}：{info['product_name']}")
                lines.append(f"  产品类型：{info['product_type']}")
                lines.append(f"  数量：{info['quantity']}")
                lines.append(f"  运输车辆：{', '.join(info['vehicles']) if info['vehicles'] else '未指定'}")
                lines.append(f"  异常数量：{info['anomaly_count']}")
                if info['anomalies']:
                    lines.append(f"  关联异常：{', '.join(info['anomalies'])}")
                lines.append("")
        
        if result.data_gaps:
            lines.append("四、数据质量检查")
            lines.append("-" * 80)
            lines.append("")
            
            high_severity = [g for g in result.data_gaps if g.severity == 'high']
            medium_severity = [g for g in result.data_gaps if g.severity == 'medium']
            low_severity = [g for g in result.data_gaps if g.severity == 'low']
            
            if high_severity:
                lines.append("【高优先级】")
                for gap in high_severity:
                    time_range = ""
                    if gap.start_time and gap.end_time:
                        time_range = f" ({self._format_datetime(gap.start_time)} - {self._format_datetime(gap.end_time)})"
                    lines.append(f"  • {gap.description}{time_range}")
                lines.append("")
            
            if medium_severity:
                lines.append("【中优先级】")
                for gap in medium_severity:
                    time_range = ""
                    if gap.start_time and gap.end_time:
                        time_range = f" ({self._format_datetime(gap.start_time)} - {self._format_datetime(gap.end_time)})"
                    lines.append(f"  • {gap.description}{time_range}")
                lines.append("")
            
            if low_severity:
                lines.append("【低优先级】")
                for gap in low_severity:
                    time_range = ""
                    if gap.start_time and gap.end_time:
                        time_range = f" ({self._format_datetime(gap.start_time)} - {self._format_datetime(gap.end_time)})"
                    lines.append(f"  • {gap.description}{time_range}")
                lines.append("")
        
        if result.time_drifts:
            lines.append("五、传感器时间漂移检测")
            lines.append("-" * 80)
            lines.append("")
            
            for drift in result.time_drifts:
                lines.append(f"传感器 {drift.sensor_id}（车辆 {drift.vehicle_id}）")
                lines.append(f"  漂移类型：{drift.drift_type}")
                lines.append(f"  估计偏差：{round(drift.estimated_drift_seconds, 1)} 秒（约 {round(drift.estimated_drift_seconds/60, 1)} 分钟）")
                lines.append(f"  置信度：{round(drift.confidence * 100, 1)}%")
                lines.append(f"  参考事件：{drift.reference_event}")
                lines.append("")
        
        if result.recommendations:
            lines.append("六、建议行动")
            lines.append("-" * 80)
            lines.append("")
            
            for i, rec in enumerate(result.recommendations, 1):
                lines.append(f"{i}. {rec}")
            lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)

    def _get_css(self) -> str:
        return """
        body { font-family: 'Microsoft YaHei', sans-serif; margin: 20px; line-height: 1.6; color: #333; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }
        h3 { color: #7f8c8d; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .summary-item { background: white; padding: 15px; border-radius: 6px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .summary-item .number { font-size: 28px; font-weight: bold; color: #3498db; }
        .summary-item .label { font-size: 14px; color: #7f8c8d; margin-top: 5px; }
        .anomaly { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .anomaly.severity-WARNING { border-left: 4px solid #f39c12; }
        .anomaly.severity-CRITICAL { border-left: 4px solid #e74c3c; }
        .anomaly-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .severity-badge { padding: 5px 15px; border-radius: 20px; font-weight: bold; }
        .severity-WARNING .severity-badge { background: #f39c12; color: white; }
        .severity-CRITICAL .severity-badge { background: #e74c3c; color: white; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 15px; }
        .info-item { background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .info-item .key { font-size: 12px; color: #7f8c8d; }
        .info-item .value { font-size: 14px; font-weight: 500; margin-top: 3px; }
        .responsibility { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 10px 0; }
        .responsibility.driver { background: #e3f2fd; border-color: #2196f3; }
        .responsibility.node { background: #fff3cd; border-color: #ffc107; }
        .notes { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin: 10px 0; color: #721c24; }
        .manual-confirmation { background: #dc3545; color: white; padding: 10px 15px; border-radius: 6px; display: inline-block; margin-top: 10px; }
        .batch-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
        .data-gap { background: #fff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 15px; margin: 10px 0; border-left: 4px solid; }
        .data-gap.high { border-left-color: #e74c3c; }
        .data-gap.medium { border-left-color: #f39c12; }
        .data-gap.low { border-left-color: #3498db; }
        .recommendation { background: #d4edda; border: 1px solid #28a745; border-radius: 6px; padding: 15px; margin: 10px 0; color: #155724; }
        .time-drift { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 15px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #7f8c8d; font-size: 12px; }
        """

    def generate_html_report(self, result: TraceResult) -> str:
        generated_time = self._format_datetime(result.execution_time)
        total_batches = result.total_batches
        batches_with_anomalies = result.batches_with_anomalies
        total_anomalies = result.total_anomalies
        data_gaps_count = len(result.data_gaps)
        
        html_parts = []
        
        html_parts.append("<!DOCTYPE html>")
        html_parts.append("<html lang=\"zh-CN\">")
        html_parts.append("<head>")
        html_parts.append("    <meta charset=\"UTF-8\">")
        html_parts.append("    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">")
        html_parts.append("    <title>冷链温控异常追溯报告</title>")
        html_parts.append("    <style>")
        html_parts.append(self._get_css())
        html_parts.append("    </style>")
        html_parts.append("</head>")
        html_parts.append("<body>")
        
        html_parts.append("    <h1>冷链温控异常追溯报告</h1>")
        html_parts.append(f"    <p><strong>生成时间：</strong>{generated_time}</p>")
        
        html_parts.append("    <div class=\"summary\">")
        html_parts.append("        <h2>一、执行摘要</h2>")
        html_parts.append("        <div class=\"summary-grid\">")
        html_parts.append("            <div class=\"summary-item\">")
        html_parts.append(f"                <div class=\"number\">{total_batches}</div>")
        html_parts.append("                <div class=\"label\">分析批次总数</div>")
        html_parts.append("            </div>")
        html_parts.append("            <div class=\"summary-item\">")
        html_parts.append(f"                <div class=\"number\" style=\"color: #f39c12;\">{batches_with_anomalies}</div>")
        html_parts.append("                <div class=\"label\">存在异常批次</div>")
        html_parts.append("            </div>")
        html_parts.append("            <div class=\"summary-item\">")
        html_parts.append(f"                <div class=\"number\" style=\"color: #e74c3c;\">{total_anomalies}</div>")
        html_parts.append("                <div class=\"label\">检测到异常数</div>")
        html_parts.append("            </div>")
        html_parts.append("            <div class=\"summary-item\">")
        html_parts.append(f"                <div class=\"number\" style=\"color: #9b59b6;\">{data_gaps_count}</div>")
        html_parts.append("                <div class=\"label\">发现数据缺口</div>")
        html_parts.append("            </div>")
        html_parts.append("        </div>")
        html_parts.append("    </div>")
        
        if result.anomalies:
            html_parts.append("    <h2>二、异常详情</h2>")
            for i, anomaly in enumerate(result.anomalies, 1):
                severity_class = "severity-" + anomaly.severity.name
                html_parts.append(f"    <div class=\"anomaly {severity_class}\">")
                html_parts.append("        <div class=\"anomaly-header\">")
                html_parts.append(f"            <h3>异常 {i}：{anomaly.anomaly_id}</h3>")
                html_parts.append(f"            <span class=\"severity-badge\">{anomaly.severity.value}</span>")
                html_parts.append("        </div>")
                html_parts.append("        <div class=\"info-grid\">")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">所属批次</div>")
                html_parts.append(f"                <div class=\"value\">{anomaly.batch_id}</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">涉及车辆</div>")
                html_parts.append(f"                <div class=\"value\">{anomaly.vehicle_id}</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">传感器ID</div>")
                html_parts.append(f"                <div class=\"value\">{anomaly.sensor_id}</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">持续时间</div>")
                html_parts.append(f"                <div class=\"value\">{round(anomaly.duration_minutes, 1)} 分钟</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">开始时间</div>")
                html_parts.append(f"                <div class=\"value\">{self._format_datetime(anomaly.start_time)}</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">结束时间</div>")
                html_parts.append(f"                <div class=\"value\">{self._format_datetime(anomaly.end_time)}</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">最高温度</div>")
                html_parts.append(f"                <div class=\"value\">{anomaly.max_temperature} °C</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">最低温度</div>")
                html_parts.append(f"                <div class=\"value\">{anomaly.min_temperature} °C</div>")
                html_parts.append("            </div>")
                html_parts.append("            <div class=\"info-item\">")
                html_parts.append("                <div class=\"key\">平均温度</div>")
                html_parts.append(f"                <div class=\"value\">{round(anomaly.avg_temperature, 2)} °C</div>")
                html_parts.append("            </div>")
                html_parts.append("        </div>")
                
                if anomaly.responsible_segments:
                    html_parts.append("        <h4>责任区间</h4>")
                    for segment in anomaly.responsible_segments:
                        seg_type = segment['responsibility_type']
                        start, end = segment['time_range']
                        
                        if seg_type == 'driver':
                            html_parts.append("        <div class=\"responsibility driver\">")
                            html_parts.append("            <strong>🚛 运输途中（司机）</strong><br>")
                            html_parts.append(f"            司机：{segment['driver_name']}（{segment['driver_id']}）<br>")
                            html_parts.append(f"            车辆：{segment['vehicle_id']}<br>")
                            html_parts.append(f"            路线：{segment['start_node_name']} → {segment['end_node_name']}<br>")
                            html_parts.append(f"            时间：{self._format_datetime(start)} 至 {self._format_datetime(end)}<br>")
                            html_parts.append(f"            责任占比：{round(segment.get('overlap_ratio', 1) * 100, 1)}%")
                            html_parts.append("        </div>")
                        else:
                            html_parts.append("        <div class=\"responsibility node\">")
                            html_parts.append("            <strong>🏢 节点作业</strong><br>")
                            html_parts.append(f"            节点：{segment['node_name']}<br>")
                            html_parts.append(f"            操作员：{segment['operator']}<br>")
                            html_parts.append(f"            签收时间：{self._format_datetime(segment['signoff_time'])}")
                            html_parts.append("        </div>")
                
                if anomaly.notes:
                    html_parts.append("        <div class=\"notes\">")
                    html_parts.append("            <strong>📝 说明信息：</strong><ul>")
                    for note in anomaly.notes:
                        html_parts.append(f"                <li>{note}</li>")
                    html_parts.append("            </ul>")
                    html_parts.append("        </div>")
                
                if anomaly.requires_manual_confirmation:
                    html_parts.append("        <div class=\"manual-confirmation\">⚠️ 需要人工确认</div>")
                
                html_parts.append("    </div>")
        
        if result.batch_summary:
            html_parts.append("    <h2>三、批次追踪汇总</h2>")
            for batch_id, info in result.batch_summary.items():
                status = "✅ 正常" if info['anomaly_count'] == 0 else f"⚠️ {info['anomaly_count']}个异常"
                html_parts.append("    <div class=\"batch-card\">")
                html_parts.append(f"        <strong>{batch_id}：{info['product_name']}</strong><br>")
                html_parts.append(f"        产品类型：{info['product_type']} | 数量：{info['quantity']}<br>")
                html_parts.append(f"        运输车辆：{', '.join(info['vehicles']) if info['vehicles'] else '未指定'}<br>")
                html_parts.append(f"        状态：{status}")
                if info['anomalies']:
                    html_parts.append(f" | 关联异常：{', '.join(info['anomalies'])}")
                html_parts.append("    </div>")
        
        if result.data_gaps:
            html_parts.append("    <h2>四、数据质量检查</h2>")
            for gap in result.data_gaps:
                time_range = ""
                if gap.start_time and gap.end_time:
                    time_range = f"（{self._format_datetime(gap.start_time)} - {self._format_datetime(gap.end_time)}）"
                html_parts.append(f"    <div class=\"data-gap {gap.severity}\">")
                html_parts.append(f"        <strong>{gap.description}</strong>{time_range}")
                html_parts.append("<br>")
                html_parts.append("<small>")
                html_parts.append(f"            类型：{gap.gap_type}")
                html_parts.append(f"            | 车辆：{gap.vehicle_id if gap.vehicle_id else '未指定'}")
                if gap.batch_id:
                    html_parts.append(f" | 批次：{gap.batch_id}")
                html_parts.append("</small>")
                html_parts.append("    </div>")
        
        if result.time_drifts:
            html_parts.append("    <h2>五、传感器时间漂移</h2>")
            for drift in result.time_drifts:
                html_parts.append("    <div class=\"time-drift\">")
                html_parts.append("        <strong>⚠️ 传感器时间漂移检测</strong><br>")
                html_parts.append(f"        传感器：{drift.sensor_id} | 车辆：{drift.vehicle_id}<br>")
                html_parts.append(f"        漂移类型：{drift.drift_type}<br>")
                html_parts.append(f"        估计偏差：{round(drift.estimated_drift_seconds, 1)} 秒（约 {round(drift.estimated_drift_seconds/60, 1)} 分钟）<br>")
                html_parts.append(f"        置信度：{round(drift.confidence * 100, 1)}% | 参考事件：{drift.reference_event}")
                html_parts.append("    </div>")
        
        if result.recommendations:
            html_parts.append("    <h2>六、建议行动</h2>")
            for i, rec in enumerate(result.recommendations, 1):
                html_parts.append("    <div class=\"recommendation\">")
                html_parts.append(f"        <strong>{i}.</strong> {rec}")
                html_parts.append("    </div>")
        
        html_parts.append("    <div class=\"footer\">")
        html_parts.append("        冷链温控异常追溯系统 | 报告生成完毕")
        html_parts.append("    </div>")
        html_parts.append("</body>")
        html_parts.append("</html>")
        
        return "\n".join(html_parts)

    def save_report(
        self, result: TraceResult, filename: str, format_type: str = "text"
    ) -> str:
        timestamp = result.execution_time.strftime("%Y%m%d_%H%M%S")
        if format_type == "html":
            content = self.generate_html_report(result)
            full_filename = f"{filename}_{timestamp}.html"
        else:
            content = self.generate_text_report(result)
            full_filename = f"{filename}_{timestamp}.txt"
        
        filepath = os.path.join(self.output_dir, full_filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return filepath
