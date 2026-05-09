from typing import List, Dict, Any
from datetime import datetime
import csv


class ReportGenerator:
    RISK_COLORS = {
        'CRITICAL': '#DC2626',
        'HIGH': '#EA580C',
        'MEDIUM': '#CA8A04',
        'LOW': '#2563EB',
        'NONE': '#16A34A'
    }

    RISK_LABELS = {
        'CRITICAL': '严重',
        'HIGH': '高风险',
        'MEDIUM': '中风险',
        'LOW': '低风险',
        'NONE': '无风险'
    }

    @staticmethod
    def generate_markdown(
        results: List[Dict[str, Any]],
        simulation_id: str,
        route_id: str,
        simulation_timestamp: datetime
    ) -> str:
        lines = []

        lines.append(f'# 冷链运输温控风险推演报告')
        lines.append('')
        lines.append(f'**推演ID:** {simulation_id}')
        lines.append(f'**路线ID:** {route_id}')
        lines.append(f'**推演时间:** {simulation_timestamp.strftime("%Y-%m-%d %H:%M:%S")}')
        lines.append('')

        stats = ReportGenerator._calculate_statistics(results)
        lines.append('## 风险统计概览')
        lines.append('')
        lines.append(f'| 风险等级 | 订单数量 | 占比 |')
        lines.append(f'|---------|---------|------|')
        for level, label in ReportGenerator.RISK_LABELS.items():
            count = stats.get(level, 0)
            pct = (count / len(results) * 100) if results else 0
            lines.append(f'| {label} | {count} | {pct:.1f}% |')
        lines.append('')

        lines.append('## 订单风险详情')
        lines.append('')

        for result in results:
            risk_label = ReportGenerator.RISK_LABELS.get(result['risk_level'], result['risk_level'])
            risk_color = ReportGenerator.RISK_COLORS.get(result['risk_level'], '#666666')
            
            lines.append(f'### 订单 {result["order_id"]}')
            lines.append('')
            lines.append(f'- **风险等级:** <span style="color:{risk_color};font-weight:bold">{risk_label}</span>')
            lines.append(f'- **超限时长:** {result["total_overtime_min"]} 分钟')
            lines.append(f'- **最高温超限:** +{result["max_temp_violation"]:.1f}°C')
            lines.append(f'- **最低温超限:** {result["min_temp_violation"]:.1f}°C')
            lines.append('')

            if result['triggers']:
                lines.append('#### 触发原因')
                lines.append('')
                for trigger in result['triggers']:
                    lines.append(f'- {trigger}')
                lines.append('')

            if result['missing_data_count'] > 0:
                lines.append('#### 传感器缺测情况')
                lines.append('')
                lines.append(f'- **缺测次数:** {result["missing_data_count"]}')
                lines.append(f'- **缺测时长:** {result["missing_data_duration_min"]:.0f} 分钟')
                lines.append('')

            if result['recommendations']:
                lines.append('#### 建议处置')
                lines.append('')
                for i, rec in enumerate(result['recommendations'], 1):
                    lines.append(f'{i}. {rec}')
                lines.append('')

            if result.get('segment_details'):
                lines.append('#### 路段详情')
                lines.append('')
                lines.append(f'| 路段 | 车厢 | 起始站 → 到达站 | 时长(分) | 最高温 | 最低温 | 超限时长 | 缺测时长 |')
                lines.append(f'|------|------|---------------|---------|--------|--------|---------|---------|')
                for seg in result['segment_details']:
                    overtime = seg.get('overtime_min', 0)
                    missing = sum(p.get('duration_min', 0) for p in seg.get('missing_periods', []))
                    lines.append(
                        f'| {seg.get("segment_id", "")} | {seg.get("compartment", "")} | '
                        f'{seg.get("from_stop", "")} → {seg.get("to_stop", "")} | '
                        f'{seg.get("duration_min", 0):.0f} | '
                        f'{seg.get("max_temp", 0):.1f}°C | {seg.get("min_temp", 0):.1f}°C | '
                        f'{overtime}分 | {missing:.0f}分 |'
                    )
                lines.append('')

        return '\n'.join(lines)

    @staticmethod
    def generate_csv(
        results: List[Dict[str, Any]],
        output_path: str
    ):
        rows = []
        for result in results:
            row = {
                'order_id': result['order_id'],
                'route_id': result['route_id'],
                'risk_level': ReportGenerator.RISK_LABELS.get(result['risk_level'], result['risk_level']),
                'risk_level_code': result['risk_level'],
                'total_overtime_min': result['total_overtime_min'],
                'max_temp_violation': round(result['max_temp_violation'], 2),
                'min_temp_violation': round(result['min_temp_violation'], 2),
                'triggers': '; '.join(result['triggers']) if result['triggers'] else '',
                'missing_data_count': result['missing_data_count'],
                'missing_data_duration_min': round(result['missing_data_duration_min'], 2),
                'recommendations': '; '.join(result['recommendations']) if result['recommendations'] else '',
                'simulation_timestamp': result['simulation_timestamp']
            }
            rows.append(row)

        if rows:
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

    @staticmethod
    def _calculate_statistics(results: List[Dict[str, Any]]) -> Dict[str, int]:
        stats = {
            'CRITICAL': 0,
            'HIGH': 0,
            'MEDIUM': 0,
            'LOW': 0,
            'NONE': 0
        }
        for result in results:
            level = result['risk_level']
            if level in stats:
                stats[level] += 1
        return stats
