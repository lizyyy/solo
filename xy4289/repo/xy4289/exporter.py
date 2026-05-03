import os
import json
import csv
from datetime import datetime
from typing import Dict, Any, List, Optional
import config


class Exporter:
    def __init__(self):
        self.export_dir = config.EXPORT_DIR
        os.makedirs(self.export_dir, exist_ok=True)

    def export_markdown_brief(self, analysis_result: Dict[str, Any], 
                                machine_metrics: Dict[str, Any],
                                water_metrics: Dict[str, Any],
                                patient_metrics: Dict[str, Any],
                                filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"透析排班预警简报_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        filepath = os.path.join(self.export_dir, filename)
        
        risk_counts = analysis_result.get('risk_counts', {})
        recommendations = analysis_result.get('recommendations', [])
        
        content = self._generate_markdown_content(
            risk_counts=risk_counts,
            recommendations=recommendations,
            machine_metrics=machine_metrics,
            water_metrics=water_metrics,
            patient_metrics=patient_metrics
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return filepath

    def _generate_markdown_content(self, 
                                     risk_counts: Dict[str, int],
                                     recommendations: List[Dict[str, Any]],
                                     machine_metrics: Dict[str, Any],
                                     water_metrics: Dict[str, Any],
                                     patient_metrics: Dict[str, Any]) -> str:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        critical = risk_counts.get('critical', 0)
        high = risk_counts.get('high', 0)
        medium = risk_counts.get('medium', 0)
        total = critical + high + medium
        
        content = f"""# 透析排班水处理预警简报

**生成时间**: {now}

---

## 一、风险概览

| 风险等级 | 数量 | 状态 |
|----------|------|------|
| 🔴 紧急 (Critical) | {critical} | {'需要立即处理' if critical > 0 else '无'} |
| 🟠 高危 (High) | {high} | {'需要优先处理' if high > 0 else '无'} |
| 🟡 中危 (Medium) | {medium} | {'建议关注' if medium > 0 else '无'} |
| **总计** | **{total}** | - |

"""
        
        if total > 0:
            content += """---

## 二、风险预警详情

"""
            
            for i, rec in enumerate(recommendations, 1):
                level_icon = {
                    'critical': '🔴',
                    'high': '🟠',
                    'medium': '🟡',
                    'low': '🟢'
                }.get(rec['risk_level'], '⚪')
                
                category_cn = {
                    'high_load': '机器高负荷',
                    'consecutive_overuse': '连续超负荷运行',
                    'disinfection_violation': '消毒间隔违规',
                    'water_quality_anomaly': '水质异常',
                    'high_risk_patient_water_risk': '高风险患者水质风险',
                    'unresolved_maintenance': '未解决故障',
                    'session_during_unresolved_fault': '故障期间安排透析',
                    'session_near_maintenance': '维修时间冲突'
                }.get(rec['category'], rec['category'])
                
                affected_time = rec.get('affected_time', '')
                if affected_time:
                    try:
                        affected_time = datetime.fromisoformat(affected_time).strftime('%Y-%m-%d %H:%M')
                    except:
                        pass
                
                content += f"""### {i}. {level_icon} {category_cn}

- **预警ID**: {rec['alert_id']}
- **风险等级**: {rec['risk_level']}
- **涉及机器**: {rec.get('machine_id', '无')}
- **涉及患者**: {rec.get('patient_id', '无')}
- **影响时间**: {affected_time or '无'}

**问题描述**: 
> {rec['problem']}

**调整建议**: 
> {rec['recommendation']}

---

"""
        
        content += """## 三、机器负荷统计

"""
        
        if machine_metrics and 'load_matrix' in machine_metrics:
            load_matrix = machine_metrics['load_matrix']
            machines = machine_metrics.get('machines', [])
            dates = machine_metrics.get('dates', [])
            
            if dates:
                content += f"**统计周期**: {min(dates)} 至 {max(dates)}\n\n"
            
            content += "| 机器ID | " + " | ".join([str(d) for d in dates]) + " | 状态 |\n"
            content += "|--------|" + "|".join(["--------" for _ in dates]) + "|------|\n"
            
            for machine_id, daily_load in load_matrix.items():
                hours_list = [daily_load.get(d, 0) for d in dates]
                total_hours = sum(hours_list)
                max_hours = max(hours_list) if hours_list else 0
                
                status = "🟢 正常"
                if max_hours > config.MAX_MACHINE_HOURS_PER_DAY:
                    status = "🔴 超负荷"
                elif max_hours > config.MAX_MACHINE_HOURS_PER_DAY * 0.8:
                    status = "🟡 接近上限"
                
                row = f"| {machine_id} | "
                row += " | ".join([f"{h:.1f}h" for h in hours_list])
                row += f" | {status} |\n"
                content += row
            
            content += f"\n**机器总数**: {len(machines)} 台\n"
        else:
            content += "> 暂无机器负荷数据\n"
        
        content += """

---

## 四、水质检测状态

"""
        
        if water_metrics:
            status = water_metrics.get('overall_status', 'unknown')
            status_icon = {
                'normal': '🟢',
                'warning': '🟡',
                'critical': '🔴'
            }.get(status, '⚪')
            status_cn = {
                'normal': '正常',
                'warning': '异常',
                'critical': '严重异常'
            }.get(status, '未知')
            
            latest_time = water_metrics.get('latest_test_time', '')
            if latest_time:
                latest_time = latest_time.strftime('%Y-%m-%d %H:%M')
            
            content += f"- **检测状态**: {status_icon} {status_cn}\n"
            content += f"- **最新检测时间**: {latest_time or '未知'}\n"
            
            anomalies = water_metrics.get('anomalies', [])
            if anomalies:
                content += "\n**异常参数**:\n"
                for anomaly in anomalies:
                    param_cn = {
                        'conductivity': '电导率',
                        'bacteria_count': '细菌数',
                        'endotoxin': '内毒素'
                    }.get(anomaly['parameter'], anomaly['parameter'])
                    content += f"- {param_cn}: {anomaly['value']} (阈值: {anomaly['threshold']})\n"
        else:
            content += "> 暂无水质数据\n"
        
        content += """

---

## 五、高风险患者统计

"""
        
        if patient_metrics:
            high_risk_count = patient_metrics.get('high_risk_count', 0)
            total_patients = patient_metrics.get('total_patients', 0)
            
            content += f"- **高风险患者数**: {high_risk_count} 人\n"
            content += f"- **总患者数**: {total_patients} 人\n"
            
            risk_sessions = patient_metrics.get('risk_sessions', [])
            if risk_sessions:
                content += "\n**高风险患者安排**:\n"
                content += "| 患者ID | 感染类型 | 透析时间 | 机器ID |\n"
                content += "|--------|----------|----------|--------|\n"
                
                for session in risk_sessions:
                    treat_time = session.get('treatment_time', '')
                    if treat_time:
                        treat_time = treat_time.strftime('%Y-%m-%d %H:%M')
                    content += f"| {session.get('patient_id', '')} | {session.get('infection_type', '')} | {treat_time} | {session.get('machine_id', '-')} |\n"
        else:
            content += "> 暂无患者数据\n"
        
        content += f"""

---

## 六、备注

本报告由系统自动生成，如有疑问请联系技术支持。

**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""
        
        return content

    def export_csv_adjustments(self, recommendations: List[Dict[str, Any]],
                                 filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"透析调整方案_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        filepath = os.path.join(self.export_dir, filename)
        
        fieldnames = [
            '序号', '预警ID', '风险等级', '类别',
            '涉及机器', '涉及患者', '影响时间',
            '问题描述', '调整建议', '优先级'
        ]
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for i, rec in enumerate(recommendations, 1):
                affected_time = rec.get('affected_time', '')
                if affected_time:
                    try:
                        affected_time = datetime.fromisoformat(affected_time).strftime('%Y-%m-%d %H:%M')
                    except:
                        pass
                
                writer.writerow({
                    '序号': i,
                    '预警ID': rec['alert_id'],
                    '风险等级': rec['risk_level'],
                    '类别': rec['category'],
                    '涉及机器': rec.get('machine_id', ''),
                    '涉及患者': rec.get('patient_id', ''),
                    '影响时间': affected_time,
                    '问题描述': rec['problem'],
                    '调整建议': rec['recommendation'],
                    '优先级': rec.get('priority', 0)
                })
        
        return filepath

    def export_json_audit(self, analysis_result: Dict[str, Any],
                            machine_metrics: Dict[str, Any],
                            water_metrics: Dict[str, Any],
                            patient_metrics: Dict[str, Any],
                            alert_records: List[Dict[str, Any]],
                            filename: Optional[str] = None) -> str:
        if filename is None:
            filename = f"审计数据包_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = os.path.join(self.export_dir, filename)
        
        def convert_datetime(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: convert_datetime(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [convert_datetime(item) for item in obj]
            return obj
        
        audit_package = {
            'export_info': {
                'export_time': datetime.now().isoformat(),
                'version': '1.0.0'
            },
            'analysis_result': convert_datetime(analysis_result),
            'machine_metrics': convert_datetime(machine_metrics),
            'water_metrics': convert_datetime(water_metrics),
            'patient_metrics': convert_datetime(patient_metrics),
            'alert_records': convert_datetime(alert_records)
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
        
        return filepath

    def export_all(self, analysis_result: Dict[str, Any],
                    machine_metrics: Dict[str, Any],
                    water_metrics: Dict[str, Any],
                    patient_metrics: Dict[str, Any],
                    alert_records: List[Dict[str, Any]]) -> Dict[str, str]:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        markdown_path = self.export_markdown_brief(
            analysis_result, machine_metrics, water_metrics, patient_metrics,
            filename=f"透析预警简报_{timestamp}.md"
        )
        
        csv_path = self.export_csv_adjustments(
            analysis_result.get('recommendations', []),
            filename=f"调整方案_{timestamp}.csv"
        )
        
        json_path = self.export_json_audit(
            analysis_result, machine_metrics, water_metrics, patient_metrics, alert_records,
            filename=f"审计包_{timestamp}.json"
        )
        
        return {
            'markdown': markdown_path,
            'csv': csv_path,
            'json': json_path
        }
