import pandas as pd
from datetime import datetime
from typing import Dict, Any, List
import os
import json


class ReportGenerator:
    def __init__(self, output_dir: str = "output"):
        self.output_dir = output_dir
        self.generation_time = None

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def generate_text_report(self,
                             data_quality: Dict[str, Any],
                             anomaly_summary: Dict[str, Any],
                             trajectory_results: Dict[str, Any],
                             processing_suggestions: List[Dict[str, Any]],
                             conflict_report: Dict[str, Any],
                             filename: str = None) -> str:
        self.generation_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        report_lines = []
        report_lines.append("=" * 70)
        report_lines.append("河道漂浮物轨迹推演分析报告")
        report_lines.append("=" * 70)
        report_lines.append(f"报告生成时间: {self.generation_time}")
        report_lines.append(f"数据来源: {data_quality.get('source', '未知')}")
        report_lines.append(f"数据加载时间: {data_quality.get('load_time', '未知')}")
        report_lines.append("")

        report_lines.append("-" * 70)
        report_lines.append("【1】数据质量报告")
        report_lines.append("-" * 70)
        report_lines.append(f"总记录数: {data_quality.get('total_rows', 0)} 条")
        report_lines.append(f"清洗后记录数: {data_quality.get('cleaned_rows', 0)} 条")
        report_lines.append(f"重复记录: {data_quality.get('duplicates', 0)} 条")

        missing = data_quality.get('missing_values', {})
        if missing:
            report_lines.append(f"缺失值字段: {', '.join([f'{k}({v})' for k, v in missing.items()])}")

        gaps = data_quality.get('time_gaps', [])
        if gaps:
            report_lines.append(f"采样缺口: 发现 {len(gaps)} 处")
            for gap in gaps[:3]:
                report_lines.append(f"  - {gap['gap_start']} 至 {gap['gap_end']}, 缺口 {gap['gap_duration_min']} 分钟")

        unit_convs = data_quality.get('unit_conversions', [])
        if unit_convs:
            report_lines.append(f"单位转换: 完成 {len(unit_convs)} 处")
            for conv in unit_convs[:3]:
                report_lines.append(f"  - 记录{conv['row_index']}: {conv['original_value']}{conv['original_unit']} → {conv['normalized_value']}{conv['target_unit']}")

        report_lines.append("")
        report_lines.append("-" * 70)
        report_lines.append("【2】异常检测结果")
        report_lines.append("-" * 70)
        report_lines.append(f"参数版本: {anomaly_summary.get('params_version', '')} ({anomaly_summary.get('params_version_note', '')})")
        report_lines.append(f"参数创建人: {anomaly_summary.get('params_created_by', '')}")
        report_lines.append(f"参数创建时间: {anomaly_summary.get('params_created_at', '')}")
        report_lines.append("")
        report_lines.append("应用阈值:")
        for k, v in anomaly_summary.get('thresholds_applied', {}).items():
            report_lines.append(f"  - {k}: {v}")
        report_lines.append("")
        report_lines.append(f"检测总记录: {anomaly_summary.get('total_records', 0)} 条")
        report_lines.append(f"异常记录: {anomaly_summary.get('anomaly_count', 0)} 条")
        report_lines.append(f"  高风险: {anomaly_summary.get('high_risk_count', 0)} 条")
        report_lines.append(f"  中风险: {anomaly_summary.get('medium_risk_count', 0)} 条")
        report_lines.append(f"  低风险: {anomaly_summary.get('low_risk_count', 0)} 条")

        anomalies = anomaly_summary.get('anomalies', [])
        if anomalies:
            report_lines.append("")
            report_lines.append("异常明细:")
            for a in anomalies:
                report_lines.append(f"  [{a['timestamp']}] 记录{a['row_index']}: {';'.join(a['anomaly_type'])} (风险分: {a['risk_score']})")

        report_lines.append("")
        report_lines.append("-" * 70)
        report_lines.append("【3】处理建议")
        report_lines.append("-" * 70)
        for s in processing_suggestions:
            level_icon = {'urgent': '🚨', 'warning': '⚠️', 'info': 'ℹ️'}.get(s['level'], '📌')
            report_lines.append(f"{level_icon} [{s['category']}] {s['action_item']}")
            report_lines.append(f"   {s['description']}")
            if 'details' in s and s['details']:
                for d in s['details']:
                    report_lines.append(f"   • {d}")
            report_lines.append(f"   责任方: {s['responsible_role']}")
            report_lines.append("")

        report_lines.append("")
        report_lines.append("-" * 70)
        report_lines.append("【4】巡检表冲突检测")
        report_lines.append("-" * 70)
        report_lines.append(f"冲突总数: {conflict_report.get('total_conflicts', 0)} 处")
        conflicts = conflict_report.get('conflicts', [])
        if conflicts:
            for i, c in enumerate(conflicts, 1):
                report_lines.append(f"\n冲突 #{i}: {c['conflict_type']}")
                report_lines.append(f"  巡检表说法: {c['inspection_evidence']}")
                report_lines.append(f"  推演系统说法: {c['detection_evidence']}")
                report_lines.append(f"  建议动作:")
                for j, action in enumerate(c['suggested_actions'], 1):
                    report_lines.append(f"    {j}. {action}")
        else:
            report_lines.append("✅ 巡检表与推演结果一致，无冲突")

        report_lines.append("")
        report_lines.append("-" * 70)
        report_lines.append("【5】轨迹推演摘要")
        report_lines.append("-" * 70)
        report_lines.append(f"推演对象数: {trajectory_results.get('objects_count', 0)} 个")
        trajectories = trajectory_results.get('trajectories', {})
        for obj_id, traj in trajectories.items():
            summary = traj.get('summary', {})
            report_lines.append(f"物体 {obj_id}:")
            report_lines.append(f"  实际轨迹点: {summary.get('total_points', 0)} 个")
            report_lines.append(f"  预测轨迹点: {summary.get('predicted_points', 0)} 个")
            report_lines.append(f"  平均流速: {summary.get('avg_velocity', 0):.2f} m/s")
            report_lines.append(f"  最大漂移: {summary.get('max_drift', 0):.1f} m")

        report_lines.append("")
        report_lines.append("=" * 70)
        report_lines.append("报告结束 | 数据留痕可追溯")
        report_lines.append("=" * 70)

        report_text = '\n'.join(report_lines)

        if filename is None:
            filename = f"analysis_report_{self.generation_time.replace(' ', '_').replace(':', '-')}.txt"

        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_text)

        return filepath

    def export_processed_data(self, df: pd.DataFrame, filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"processed_data_{timestamp}.csv"

        filepath = os.path.join(self.output_dir, filename)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        return filepath

    def save_json_summary(self, all_data: Dict[str, Any], filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"summary_{timestamp}.json"

        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        return filepath
