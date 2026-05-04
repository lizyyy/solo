from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from database import Database
from monitor import FridgeMonitor


class ReportGenerator:
    def __init__(self, db: Database, monitor: FridgeMonitor):
        self.db = db
        self.monitor = monitor

    def _format_time(self, time_str: str) -> str:
        try:
            dt = datetime.fromisoformat(time_str)
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            return time_str

    def _format_duration(self, start_time: str, end_time: Optional[str]) -> str:
        try:
            start = datetime.fromisoformat(start_time)
            if end_time:
                end = datetime.fromisoformat(end_time)
            else:
                end = datetime.now()
            
            delta = end - start
            hours = delta.total_seconds() / 3600
            
            if hours < 1:
                minutes = int(delta.total_seconds() / 60)
                return f"{minutes} 分钟"
            elif hours < 24:
                return f"{hours:.1f} 小时"
            else:
                days = hours / 24
                return f"{days:.1f} 天"
        except Exception:
            return "未知"

    def _get_status_emoji(self, status: str) -> str:
        emoji_map = {
            'normal': '✅',
            'too_hot': '🔥',
            'too_cold': '❄️',
            'offline': '📴',
            'no_data': '❓',
            'unknown': '⚠️'
        }
        return emoji_map.get(status, '⚠️')

    def generate_report(self, shift_name: str = '白班', 
                        operator: str = '',
                        report_hours: int = 24) -> str:
        now = datetime.now()
        report_date = now.strftime('%Y-%m-%d')
        report_time = now.strftime('%H:%M:%S')
        
        statuses = self.monitor.get_current_status()
        open_anomalies = self.monitor.get_recent_anomalies(confirmed=False, limit=50)
        recent_anomalies = self.monitor.get_recent_anomalies(limit=100)
        
        stats = {
            'total': len(statuses),
            'normal': 0,
            'alert': 0,
            'offline': 0,
            'no_data': 0
        }
        
        for s in statuses:
            if s['status'] == 'normal':
                stats['normal'] += 1
            elif s['status'] in ['too_hot', 'too_cold']:
                stats['alert'] += 1
            elif s['status'] == 'offline':
                stats['offline'] += 1
            else:
                stats['no_data'] += 1
        
        lines = []
        
        lines.append(f"# 冰箱温度监控交接班报告")
        lines.append("")
        lines.append(f"**日期**: {report_date}")
        lines.append(f"**时间**: {report_time}")
        lines.append(f"**班次**: {shift_name}")
        if operator:
            lines.append(f"**操作员**: {operator}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 📊 状态概览")
        lines.append("")
        lines.append(f"| 状态 | 数量 | 说明 |")
        lines.append(f"|------|------|------|")
        lines.append(f"| ✅ 正常 | {stats['normal']} | 温度在正常范围内 |")
        lines.append(f"| 🔥/❄️ 异常 | {stats['alert']} | 温度超出阈值 |")
        lines.append(f"| 📴 离线 | {stats['offline']} | 传感器超过30分钟无数据 |")
        lines.append(f"| ❓ 无数据 | {stats['no_data']} | 从未收到数据 |")
        lines.append(f"| **总计** | **{stats['total']}** | |")
        lines.append("")
        
        overall_status = "✅ 所有设备正常"
        if stats['alert'] > 0:
            overall_status = "⚠️ 存在温度异常"
        elif stats['offline'] > 0:
            overall_status = "📴 存在离线设备"
        
        lines.append(f"**总体状态**: {overall_status}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 🧊 设备详细状态")
        lines.append("")
        lines.append("| 设备 | 位置 | 传感器 | 当前温度 | 阈值范围 | 状态 | 最后更新 |")
        lines.append("|------|------|--------|----------|----------|------|----------|")
        
        for s in statuses:
            emoji = self._get_status_emoji(s['status'])
            temp_str = f"{s['current_temp']:.1f}℃" if s['current_temp'] is not None else "--"
            threshold_str = f"{s['min_temp']:.1f} ~ {s['max_temp']:.1f}℃"
            last_seen = self._format_time(s['last_seen']) if s['last_seen'] else "从未"
            
            lines.append(
                f"| {s['fridge_name']} | {s['location']} | {s['sensor_id']} | "
                f"{temp_str} | {threshold_str} | {emoji} {s['status_text']} | {last_seen} |"
            )
        
        lines.append("")
        lines.append("---")
        lines.append("")
        
        ongoing_anomalies = [a for a in open_anomalies if a['end_time'] is None]
        if ongoing_anomalies:
            lines.append("## ⚠️ 进行中的异常")
            lines.append("")
            lines.append("| 设备 | 异常类型 | 开始时间 | 持续时间 | 温度范围 | 状态 |")
            lines.append("|------|----------|----------|----------|----------|------|")
            
            for a in ongoing_anomalies:
                start_time = self._format_time(a['start_time'])
                duration = self._format_duration(a['start_time'], None)
                temp_range = f"{a['min_temp']:.1f} ~ {a['max_temp']:.1f}℃" if a['min_temp'] is not None else "未知"
                confirmed = "🔓 未确认" if not a['is_confirmed'] else "✅ 已确认"
                
                lines.append(
                    f"| {a.get('fridge_name', a['fridge_id'])} | {a['anomaly_type_text']} | "
                    f"{start_time} | {duration} | {temp_range} | {confirmed} |"
                )
            lines.append("")
            lines.append("---")
            lines.append("")
        
        closed_anomalies = [a for a in recent_anomalies if a['end_time'] is not None]
        if closed_anomalies:
            lines.append("## 📋 历史异常记录（最近）")
            lines.append("")
            lines.append("| 设备 | 异常类型 | 开始时间 | 结束时间 | 持续时间 | 平均温度 | 确认状态 |")
            lines.append("|------|----------|----------|----------|----------|----------|----------|")
            
            for a in closed_anomalies[:20]:
                start_time = self._format_time(a['start_time'])
                end_time = self._format_time(a['end_time']) if a['end_time'] else "进行中"
                duration = self._format_duration(a['start_time'], a['end_time'])
                avg_temp = f"{a['avg_temp']:.1f}℃" if a['avg_temp'] is not None else "未知"
                confirmed = "✅ 已确认" if a['is_confirmed'] else "🔓 未确认"
                
                if a.get('notes'):
                    confirmed += f" ({a['notes'][:20]}...)"
                
                lines.append(
                    f"| {a.get('fridge_name', a['fridge_id'])} | {a['anomaly_type_text']} | "
                    f"{start_time} | {end_time} | {duration} | {avg_temp} | {confirmed} |"
                )
            lines.append("")
            lines.append("---")
            lines.append("")
        
        lines.append("## 📝 交接备注")
        lines.append("")
        lines.append("### 注意事项")
        lines.append("")
        
        if stats['alert'] > 0:
            lines.append("- ⚠️ **温度异常**: 请检查以下设备:")
            for s in statuses:
                if s['status'] in ['too_hot', 'too_cold']:
                    lines.append(f"  - {s['fridge_name']} ({s['location']}): 当前 {s['current_temp']:.1f}℃，阈值 {s['min_temp']:.1f}~{s['max_temp']:.1f}℃")
            lines.append("")
        
        if stats['offline'] > 0:
            lines.append("- 📴 **设备离线**: 以下传感器超过30分钟无数据:")
            for s in statuses:
                if s['status'] == 'offline':
                    lines.append(f"  - {s['fridge_name']} ({s['sensor_id']}): 最后更新于 {self._format_time(s['last_seen'])}，已离线 {s['minutes_since_last']:.0f} 分钟")
            lines.append("")
        
        if stats['alert'] == 0 and stats['offline'] == 0:
            lines.append("- ✅ 所有设备运行正常，无异常警报。")
            lines.append("")
        
        lines.append("### 待办事项")
        lines.append("")
        lines.append("- [ ] 确认所有异常警报（如存在）")
        lines.append("- [ ] 检查离线设备连接状态")
        lines.append("- [ ] 记录任何特殊情况")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📌 值班人员签字")
        lines.append("")
        lines.append("| 岗位 | 姓名 | 签字 | 时间 |")
        lines.append("|------|------|------|------|")
        lines.append("| 交班人 | | | |")
        lines.append("| 接班人 | | | |")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(f"*报告生成时间: {now.strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
