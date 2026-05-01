"""报告导出模块 - 生成 risk_report.md、adjusted_feed.csv 和 alerts.json"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Union


def export_risk_report(
    simulation_data: Dict[str, Any],
    output_dir: Union[str, Path]
) -> Path:
    """导出风险报告 markdown"""
    output_path = Path(output_dir) / 'risk_report.md'
    results = simulation_data['simulation_results']
    start_time = simulation_data['start_time']
    end_time = simulation_data['end_time']

    lines = [
        "# 水产养殖场风险报告",
        "",
        f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"**模拟时段**: {start_time.strftime('%Y-%m-%d %H:%M')} ~ {end_time.strftime('%Y-%m-%d %H:%M')}",
        "",
        "---",
        "",
    ]

    for pond_id, pond_result in results.items():
        lines.append(f"## 池塘 {pond_id}")
        lines.append("")

        thresholds = pond_result['thresholds']
        lines.append(f"**阈值配置**: 溶氧 {thresholds.get('do_min', 5.0)}-{thresholds.get('do_max', 15.0)} mg/L, "
                     f"氨氮上限 {thresholds.get('ammonia_max', 0.1)} mg/L")
        lines.append("")

        hourly = pond_result['hourly_results']
        risk_counts = {'normal': 0, 'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
        for h in hourly:
            risk_counts[h['risk_level']] = risk_counts.get(h['risk_level'], 0) + 1

        lines.append("### 风险分布")
        lines.append("")
        for level in ['critical', 'high', 'medium', 'low', 'normal']:
            if risk_counts.get(level, 0) > 0:
                lines.append(f"- **{level.upper()}**: {risk_counts[level]} 小时")
        lines.append("")

        critical_hours = [h for h in hourly if h['risk_level'] in ('critical', 'high')]
        if critical_hours:
            lines.append("### 关键风险时段")
            lines.append("")
            lines.append("| 时间 | 溶氧 (mg/L) | 氨氮 (mg/L) | 温度 (°C) | 风险等级 |")
            lines.append("|------|-------------|-------------|-----------|----------|")
            for h in critical_hours:
                ts = h['timestamp']
                lines.append(
                    f"| {ts.strftime('%m-%d %H:%M')} | {h['dissolved_oxygen']} | "
                    f"{h['ammonia_nitrogen']} | {h['temperature']} | {h['risk_level'].upper()} |"
                )
            lines.append("")

        lines.append("### 24 小时预测详情")
        lines.append("")
        lines.append("| 时间 | 溶氧 | 氨氮 | 温度 | 投喂量 | 风险 |")
        lines.append("|------|------|------|------|--------|------|")
        for h in hourly:
            ts = h['timestamp']
            lines.append(
                f"| {ts.strftime('%H:%M')} | {h['dissolved_oxygen']} | "
                f"{h['ammonia_nitrogen']} | {h['temperature']} | {h['feed_amount']} | "
                f"{h['risk_level']} |"
            )
        lines.append("")
        lines.append("---")
        lines.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    return output_path


def export_adjusted_feed(
    simulation_data: Dict[str, Any],
    output_dir: Union[str, Path]
) -> Path:
    """导出调整后的投喂计划 CSV"""
    output_path = Path(output_dir) / 'adjusted_feed.csv'
    results = simulation_data['simulation_results']

    rows = []
    for pond_id, pond_result in sorted(results.items()):
        hourly = pond_result['hourly_results']
        for h in hourly:
            if h['feed_amount'] > 0:
                rows.append({
                    'pond_id': pond_id,
                    'timestamp': h['timestamp'].strftime('%Y-%m-%d %H:%M'),
                    'adjusted_feed_amount': h['feed_amount'],
                    'risk_level': h['risk_level'],
                    'do_value': h['dissolved_oxygen'],
                    'ammonia_value': h['ammonia_nitrogen'],
                })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    return output_path


def export_alerts(
    simulation_data: Dict[str, Any],
    output_dir: Union[str, Path]
) -> Path:
    """导出告警 JSON"""
    output_path = Path(output_dir) / 'alerts.json'
    results = simulation_data['simulation_results']

    alerts = []
    for pond_id, pond_result in sorted(results.items()):
        thresholds = pond_result['thresholds']
        hourly = pond_result['hourly_results']

        for h in hourly:
            risk = h['risk_level']
            if risk in ('critical', 'high'):
                do_val = h['dissolved_oxygen']
                ammonia_val = h['ammonia_nitrogen']

                alert_reasons = []
                do_min = thresholds.get('do_min', 5.0)
                ammonia_max = thresholds.get('ammonia_max', 0.1)

                if risk == 'critical':
                    if do_val < do_min * 0.7:
                        alert_reasons.append(f'溶氧严重不足 ({do_val} < {do_min * 0.7})')
                    if ammonia_val > ammonia_max * 3:
                        alert_reasons.append(f'氨氮严重超标 ({ammonia_val} > {ammonia_max * 3})')
                elif risk == 'high':
                    if do_val < do_min * 0.85:
                        alert_reasons.append(f'溶氧偏低 ({do_val} < {do_min * 0.85})')
                    if ammonia_val > ammonia_max * 2:
                        alert_reasons.append(f'氨氮偏高 ({ammonia_val} > {ammonia_max * 2})')

                if alert_reasons:
                    alerts.append({
                        'alert_id': f'{pond_id}_{h["timestamp"].strftime("%Y%m%d%H%M")}',
                        'pond_id': pond_id,
                        'timestamp': h['timestamp'].isoformat(),
                        'risk_level': risk,
                        'reasons': alert_reasons,
                        'do_value': do_val,
                        'ammonia_value': ammonia_val,
                        'temperature': h['temperature'],
                        'recommended_action': _get_action(risk, do_val, ammonia_val),
                    })

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({
            'generated_at': datetime.now().isoformat(),
            'simulation_period': {
                'start': simulation_data['start_time'].isoformat(),
                'end': simulation_data['end_time'].isoformat(),
            },
            'alert_count': len(alerts),
            'alerts': alerts,
        }, f, ensure_ascii=False, indent=2)

    return output_path


def _get_action(risk: str, do_val: float, ammonia_val: float) -> str:
    """获取推荐行动"""
    if risk == 'critical':
        return '立即增氧，检查氨氮来源，建议减少投喂或停止投喂'
    elif risk == 'high':
        return '加强增氧设备运行，适当减少投喂量'
    return '继续监控'
