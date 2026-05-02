"""导出模块 - 负责生成各种格式的报告。"""

import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

from zha_beng_yan_suan_qi.types import (
    SiteConfig,
    SimulationResult,
    AlertType,
    AlertLevel,
)
from zha_beng_yan_suan_qi.storage import DateTimeEncoder


class Exporter:
    """导出器类。"""
    
    def __init__(self, config: SiteConfig, result: SimulationResult):
        self.config = config
        self.result = result
    
    def _get_alert_summary(self) -> Dict[str, Dict[str, int]]:
        """获取告警摘要统计。"""
        summary: Dict[str, Dict[str, int]] = {
            alert_type.value: {"critical": 0, "warning": 0, "info": 0}
            for alert_type in AlertType
        }
        
        for alert in self.result.alerts:
            alert_type = alert.alert_type if isinstance(alert.alert_type, str) else alert.alert_type.value
            level = alert.level if isinstance(alert.level, str) else alert.level.value
            
            if alert_type in summary:
                if level in summary[alert_type]:
                    summary[alert_type][level] += 1
        
        return summary
    
    def _generate_markdown_content(self) -> str:
        """生成Markdown格式的值班建议内容。"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        content = f"""# 闸泵联排演算器 - 值班建议报告

> 生成时间: {now}
> 站点: {self.result.site_name}
> 演算时段: {self.result.simulation_start} 至 {self.result.simulation_end}

---

## 一、演算摘要

### 1.1 水位统计

| 指标 | 数值 |
|------|------|
| 最高内水位 | {self.result.max_inner_level:.2f} 米 |
| 最低内水位 | {self.result.min_inner_level:.2f} 米 |
| 警戒水位 | {self.config.inner_warning_level:.2f} 米 |
| 保证水位 | {self.config.inner_critical_level:.2f} 米 |

### 1.2 能耗统计

| 指标 | 数值 |
|------|------|
| 总能耗 | {self.result.total_energy_kwh:.2f} 千瓦时 |
| 每日能耗限额 | {self.config.daily_energy_limit_kwh or '未设置'} 千瓦时 |

### 1.3 泵运行统计

"""
        
        if self.result.total_pump_runtime_hours:
            content += "| 泵编号 | 运行时长 |\n|--------|----------|\n"
            for pump_id, runtime in self.result.total_pump_runtime_hours.items():
                content += f"| {pump_id} | {runtime:.1f} 小时 |\n"
        else:
            content += "无泵运行记录\n"
        
        content += """
---

## 二、告警分析

"""
        
        alert_summary = self._get_alert_summary()
        total_critical = sum(
            s.get('critical', 0) for s in alert_summary.values()
        )
        total_warning = sum(
            s.get('warning', 0) for s in alert_summary.values()
        )
        
        content += f"""### 2.1 告警统计

| 告警级别 | 数量 |
|----------|------|
| 🔴 严重 (Critical) | {total_critical} |
| 🟡 警告 (Warning) | {total_warning} |
| 🔵 提示 (Info) | {sum(s.get('info', 0) for s in alert_summary.values())} |

### 2.2 按类型统计

"""
        
        type_names = {
            AlertType.OVERTOPPING: "漫顶风险",
            AlertType.BACKFLOW: "倒灌风险",
            AlertType.PUMP_CYCLE: "泵启停间隔",
            AlertType.ENERGY_LIMIT: "能耗超限",
            AlertType.DATA_GAP: "数据缺口",
        }
        
        for alert_type, counts in alert_summary.items():
            total = counts['critical'] + counts['warning'] + counts['info']
            if total > 0:
                type_name = type_names.get(alert_type, alert_type)
                content += f"**{type_name}**: 严重 {counts['critical']}, 警告 {counts['warning']}, 提示 {counts['info']}\n\n"
        
        content += """### 2.3 严重告警详情

"""
        
        critical_alerts = [
            a for a in self.result.alerts
            if a.level == AlertLevel.CRITICAL or (isinstance(a.level, str) and a.level == 'critical')
        ]
        
        if critical_alerts:
            for i, alert in enumerate(critical_alerts, 1):
                type_name = type_names.get(alert.alert_type, alert.alert_type)
                ts = alert.timestamp.strftime("%Y-%m-%d %H:%M") if alert.timestamp else "-"
                content += f"#### {i}. {type_name}\n\n"
                content += f"- 时间: {ts}\n"
                content += f"- 描述: {alert.message}\n"
                if alert.details:
                    content += f"- 详情: {json.dumps(alert.details, ensure_ascii=False)}\n"
                content += "\n"
        else:
            content += "✅ 无严重告警\n\n"
        
        content += """---

## 三、值班建议

### 3.1 水位控制建议

"""
        
        level_margin = self.config.inner_critical_level - self.result.max_inner_level
        
        if self.result.max_inner_level >= self.config.inner_critical_level:
            content += """⚠️ **紧急**: 演算显示水位将超过保证水位！

**建议措施**:
1. 立即启动所有可用泵站
2. 检查闸门是否能全开
3. 密切关注外河水位变化
4. 准备启动应急预案

"""
        elif self.result.max_inner_level >= self.config.inner_warning_level:
            content += "⚠️ **注意**: 演算显示水位将超过警戒水位\n\n"
            content += "**建议措施**:\n"
            content += "1. 提前启动部分泵站进行预排\n"
            content += "2. 监控外河水位，避免闸门开启时倒灌\n"
            content += "3. 准备增加泵组运行\n\n"
        elif level_margin < 0.5:
            content += "ℹ️ **提示**: 最高水位接近警戒水位，建议保持关注\n\n"
        else:
            content += "✅ **安全**: 最高水位在安全范围内\n\n"
        
        content += """### 3.2 泵运行建议

"""
        
        if self.result.total_pump_runtime_hours:
            avg_runtime = sum(self.result.total_pump_runtime_hours.values()) / len(self.result.total_pump_runtime_hours)
            content += f"平均每台泵运行时长: {avg_runtime:.1f} 小时\n\n"
            
            if avg_runtime > 12:
                content += "⚠️ 泵运行时间较长，建议:\n"
                content += "- 检查泵运行状态\n"
                content += "- 考虑轮休避免过热\n"
                content += "- 准备备用泵\n\n"
        else:
            content += "演算期间无泵启动，水位控制通过闸门完成\n\n"
        
        content += """### 3.3 闸门操作建议

"""
        
        has_backflow_risk = any(
            a for a in self.result.alerts
            if a.alert_type == AlertType.BACKFLOW
        )
        
        if has_backflow_risk:
            content += """⚠️ **存在倒灌风险**!

**关键建议**:
1. 外河水位高于内河时，务必关闭所有闸门
2. 确认闸门密封性
3. 设置水位警报，及时响应外河水位变化

"""
        else:
            content += "✅ 无倒灌风险\n\n"
        
        content += """---

## 四、关键时间点

"""
        
        if self.result.states:
            content += "| 时间 | 内水位 | 外水位 | 泵流量 | 闸门流量 | 状态 |\n"
            content += "|------|--------|--------|--------|----------|------|\n"
            
            for i, state in enumerate(self.result.states):
                if i % 4 == 0 or i == len(self.result.states) - 1:
                    ts = state.timestamp.strftime("%m-%d %H:%M")
                    inner = f"{state.inner_level:.2f}m"
                    outer = f"{state.outer_level:.2f}m" if state.outer_level else "-"
                    pump = f"{state.pump_total_flow_m3h:.0f}m³/h"
                    gate = f"{state.gate_total_flow_m3h:.0f}m³/h"
                    
                    level_status = "正常"
                    if state.inner_level >= self.config.inner_critical_level:
                        level_status = "🔴超限"
                    elif state.inner_level >= self.config.inner_warning_level:
                        level_status = "🟡警戒"
                    
                    content += f"| {ts} | {inner} | {outer} | {pump} | {gate} | {level_status} |\n"
        
        content += f"""
---

## 附录

### 站点配置

- 站点ID: {self.config.site_id}
- 河道名称: {self.config.river_name}
- 河道面积: {self.config.inner_channel_area} 平方米
- 最大库容: {self.config.inner_channel_capacity} 立方米
- 警戒水位: {self.config.inner_warning_level} 米
- 保证水位: {self.config.inner_critical_level} 米
- 最小泵启停间隔: {self.config.min_pump_cycle_hours} 小时

### 演算参数

- 时间步长: {self.result.step_hours} 小时
- 时间步数: {len(self.result.states)}

---

*本报告由闸泵联排演算器自动生成，仅供参考。实际操作请结合现场情况判断。*
"""
        
        return content
    
    def export_markdown(self, filepath: str) -> None:
        """导出Markdown格式的值班建议。"""
        content = self._generate_markdown_content()
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def export_csv(self, filepath: str) -> None:
        """导出CSV格式的时序表。"""
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            header = [
                '时间',
                '内河水位(m)',
                '外河水位(m)',
                '库容(万m³)',
                '入流量(m³/h)',
                '泵总流量(m³/h)',
                '闸门流量(m³/h)',
                '净流量(m³/h)',
                '降雨量(mm)',
            ]
            
            for pump_id in self.result.total_pump_runtime_hours.keys():
                header.append(f'泵{pump_id}状态')
            
            for gate_id in (self.result.states[0].gate_openings.keys() if self.result.states else []):
                header.append(f'闸门{gate_id}开度(m)')
            
            writer.writerow(header)
            
            for state in self.result.states:
                row = [
                    state.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    f"{state.inner_level:.3f}",
                    f"{state.outer_level:.3f}" if state.outer_level else "",
                    f"{state.storage_m3 / 10000:.3f}",
                    f"{state.inflow_m3h:.1f}",
                    f"{state.pump_total_flow_m3h:.1f}",
                    f"{state.gate_total_flow_m3h:.1f}",
                    f"{state.net_flow_m3h:.1f}",
                    f"{state.rainfall_mm:.2f}",
                ]
                
                for pump_id in self.result.total_pump_runtime_hours.keys():
                    pump_state = state.pump_states.get(pump_id, 'off')
                    row.append(pump_state.value if hasattr(pump_state, 'value') else str(pump_state))
                
                for gate_id in (self.result.states[0].gate_openings.keys() if self.result.states else []):
                    opening = state.gate_openings.get(gate_id, 0.0)
                    row.append(f"{opening:.3f}")
                
                writer.writerow(row)
    
    def export_json(self, filepath: str) -> None:
        """导出JSON格式的审计包。"""
        export_data: Dict[str, Any] = {
            "report_metadata": {
                "generated_at": datetime.now().isoformat(),
                "site_name": self.result.site_name,
                "site_id": self.config.site_id,
                "simulation_period": {
                    "start": self.result.simulation_start.isoformat(),
                    "end": self.result.simulation_end.isoformat(),
                    "step_hours": self.result.step_hours,
                }
            },
            "site_config": self.config.model_dump(mode='json'),
            "simulation_summary": {
                "max_inner_level": self.result.max_inner_level,
                "min_inner_level": self.result.min_inner_level,
                "total_energy_kwh": self.result.total_energy_kwh,
                "total_pump_runtime_hours": self.result.total_pump_runtime_hours,
                "alert_summary": self._get_alert_summary(),
            },
            "alerts": [
                {
                    "type": a.alert_type.value if hasattr(a.alert_type, 'value') else a.alert_type,
                    "level": a.level.value if hasattr(a.level, 'value') else a.level,
                    "message": a.message,
                    "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                    "details": a.details,
                }
                for a in self.result.alerts
            ],
            "time_series": [],
        }
        
        for state in self.result.states:
            state_dict = {
                "timestamp": state.timestamp.isoformat(),
                "inner_level": state.inner_level,
                "outer_level": state.outer_level,
                "storage_m3": state.storage_m3,
                "inflow_m3h": state.inflow_m3h,
                "pump_total_flow_m3h": state.pump_total_flow_m3h,
                "gate_total_flow_m3h": state.gate_total_flow_m3h,
                "net_flow_m3h": state.net_flow_m3h,
                "rainfall_mm": state.rainfall_mm,
                "pump_states": {
                    k: v.value if hasattr(v, 'value') else v
                    for k, v in state.pump_states.items()
                },
                "gate_openings": state.gate_openings,
            }
            export_data["time_series"].append(state_dict)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
