"""
漏损复盘报告生成器
生成Markdown格式的复盘报告
"""

from datetime import datetime
from typing import List, Optional

from ..analysis.water_balance import ZoneBalanceResult
from ..analysis.pressure_propagation import PressureDropEvent, PropagationPath
from ..analysis.leak_detection import SuspectedLeak


class ReportGenerator:
    """漏损复盘报告生成器"""
    
    def __init__(self):
        self._date_format = "%Y-%m-%d %H:%M:%S"
    
    def generate_report(
        self,
        start_time: datetime,
        end_time: datetime,
        balance_results: List[ZoneBalanceResult],
        pressure_events: List[PressureDropEvent],
        propagation_paths: List[PropagationPath],
        suspected_leaks: List[SuspectedLeak],
        validation_errors: List[str],
        data_anomalies: dict
    ) -> str:
        """生成完整的复盘报告"""
        lines = []
        
        lines.append("# 供水管网漏损夜间复盘报告")
        lines.append("")
        lines.append(f"**分析时段**: {start_time.strftime(self._date_format)} 至 {end_time.strftime(self._date_format)}")
        lines.append(f"**生成时间**: {datetime.now().strftime(self._date_format)}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、数据验证结果")
        lines.append("")
        
        if validation_errors:
            lines.append("### ❌ 验证错误")
            lines.append("")
            for error in validation_errors:
                lines.append(f"- {error}")
            lines.append("")
        else:
            lines.append("✅ 所有数据验证通过")
            lines.append("")
        
        if data_anomalies:
            lines.append("### ⚠️ 数据异常")
            lines.append("")
            for sensor_id, anomalies in data_anomalies.items():
                lines.append(f"**传感器 {sensor_id}**:")
                for anomaly in anomalies:
                    lines.append(f"- {anomaly}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 二、分区水量平衡分析")
        lines.append("")
        
        if balance_results:
            lines.append("| 分区 | 入流量(m³) | 用户用量(m³) | 不明水量(m³) | 漏损率 | 状态 |")
            lines.append("|------|-----------|-------------|-------------|--------|------|")
            
            for result in balance_results:
                status = "⚠️ 可疑" if result.is_suspicious else "✅ 正常"
                if result.excluded_reasons:
                    status = "ℹ️ 排除"
                lines.append(
                    f"| {result.zone_name} ({result.zone_id}) | "
                    f"{result.total_inflow:.2f} | "
                    f"{result.total_user_consumption:.2f} | "
                    f"{result.unaccounted_water:.2f} | "
                    f"{result.loss_rate:.1%} | "
                    f"{status} |"
                )
            lines.append("")
            
            suspicious_results = [r for r in balance_results if r.is_suspicious and not r.excluded_reasons]
            if suspicious_results:
                lines.append("### 可疑分区详情")
                lines.append("")
                for result in suspicious_results:
                    lines.append(f"#### {result.zone_name} ({result.zone_id})")
                    lines.append("")
                    for reason in result.suspicion_reasons:
                        lines.append(f"- {reason}")
                    lines.append("")
                    if result.inflow_details:
                        lines.append("**入流表详情**:")
                        lines.append("")
                        for meter_id, consumption in result.inflow_details:
                            lines.append(f"- {meter_id}: {consumption:.2f} m³")
                        lines.append("")
                    if result.user_details:
                        lines.append("**用户表详情**:")
                        lines.append("")
                        for meter_id, consumption in result.user_details:
                            lines.append(f"- {meter_id}: {consumption:.2f} m³")
                        lines.append("")
        else:
            lines.append("无分区水量平衡数据")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 三、压力突降事件分析")
        lines.append("")
        
        valid_events = [e for e in pressure_events if e.is_valid]
        invalid_events = [e for e in pressure_events if not e.is_valid]
        
        if valid_events:
            lines.append("### 有效压力突降事件")
            lines.append("")
            lines.append("| 传感器 | 节点 | 时间 | 压降(MPa) | 压降速率(MPa/s) |")
            lines.append("|--------|------|------|----------|----------------|")
            
            for event in valid_events:
                lines.append(
                    f"| {event.sensor_id} | {event.node_id or '-'} | "
                    f"{event.event_time.strftime(self._date_format)} | "
                    f"{event.drop_magnitude:.3f} | "
                    f"{event.drop_rate:.6f} |"
                )
            lines.append("")
        else:
            lines.append("无有效压力突降事件")
            lines.append("")
        
        if invalid_events:
            lines.append("### 已排除的压力事件")
            lines.append("")
            for event in invalid_events:
                lines.append(f"- **{event.sensor_id}** @ {event.event_time.strftime(self._date_format)}: ")
                lines.append(f"  {event.exclusion_reason or '未知原因'}")
            lines.append("")
        
        if propagation_paths:
            lines.append("### 压力传播路径")
            lines.append("")
            for i, path in enumerate(propagation_paths, 1):
                lines.append(f"#### 路径 {i}")
                lines.append("")
                lines.append(f"- **源传感器**: {path.source_sensor}")
                lines.append(f"- **影响传感器数**: {len(path.affected_sensors)}")
                if path.estimated_leak_location:
                    lines.append(f"- **估计漏点位置**: {path.estimated_leak_location}")
                    lines.append(f"- **置信度**: {path.confidence:.0%}")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 四、可疑漏点定位结果")
        lines.append("")
        
        if suspected_leaks:
            high_priority = [l for l in suspected_leaks if l.priority == "high"]
            medium_priority = [l for l in suspected_leaks if l.priority == "medium"]
            low_priority = [l for l in suspected_leaks if l.priority == "low"]
            
            lines.append("### 汇总")
            lines.append("")
            lines.append(f"- 🔴 高优先级: {len(high_priority)} 个")
            lines.append(f"- 🟡 中优先级: {len(medium_priority)} 个")
            lines.append(f"- 🟢 低优先级: {len(low_priority)} 个")
            lines.append("")
            
            all_leaks = high_priority + medium_priority + low_priority
            
            for leak in all_leaks:
                priority_icon = "🔴" if leak.priority == "high" else ("🟡" if leak.priority == "medium" else "🟢")
                lines.append(f"### {priority_icon} {leak.leak_id}")
                lines.append("")
                lines.append(f"- **位置**: {leak.location_description}")
                lines.append(f"- **优先级**: {leak.priority}")
                lines.append(f"- **置信度**: {leak.confidence:.0%}")
                if leak.estimated_water_loss > 0:
                    lines.append(f"- **估计漏损量**: {leak.estimated_water_loss:.1f} m³")
                if leak.estimated_time:
                    lines.append(f"- **估计时间**: {leak.estimated_time.strftime(self._date_format)}")
                lines.append("")
                lines.append("**证据**:")
                lines.append("")
                for evidence_type in leak.evidence_types:
                    lines.append(f"- **{evidence_type}**:")
                    if evidence_type in leak.evidence_details:
                        lines.append(f"  {leak.evidence_details[evidence_type]}")
                lines.append("")
        else:
            lines.append("✅ 未发现可疑漏点")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 五、建议")
        lines.append("")
        
        if suspected_leaks:
            lines.append("### 紧急处理建议")
            lines.append("")
            
            high_priority = [l for l in suspected_leaks if l.priority == "high"]
            if high_priority:
                lines.append(f"1. **立即处理高优先级漏点 ({len(high_priority)} 个)**:")
                for leak in high_priority:
                    lines.append(f"   - {leak.leak_id}: {leak.location_description}")
                lines.append("")
            
            lines.append("2. **按隔离计划逐步关闭阀门核实漏点**")
            lines.append("3. **准备抢修人员和材料**")
            lines.append("4. **通知受影响区域用户**")
            lines.append("")
        else:
            lines.append("本次夜间复盘未发现明显漏损迹象。建议：")
            lines.append("")
            lines.append("1. 继续监测管网运行状态")
            lines.append("2. 定期对比抄表数据")
            lines.append("3. 维护压力传感器正常运行")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由 WaterLeak 漏损分析系统自动生成*")
        
        return "\n".join(lines)
    
    def write_report(self, file_path: str, content: str):
        """写入报告到文件"""
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
