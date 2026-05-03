"""
报告生成器 - 生成 Markdown 交接报告、CSV 异常清单和 JSON 审计摘要
"""

import csv
import json
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import defaultdict

from config import Config
from parsers.csv_parser import TemperatureCSVParser, TemperatureReading
from parsers.photo_parser import PhotoParser, PhotoInfo
from parsers.log_parser import DoorLogParser, DoorSession
from rules.engine import RuleEngine, Anomaly, AlertLevel, AnomalyType


class ReportGenerator:
    """
    报告生成器
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        temp_parser: Optional[TemperatureCSVParser] = None,
        photo_parser: Optional[PhotoParser] = None,
        door_parser: Optional[DoorLogParser] = None,
        rule_engine: Optional[RuleEngine] = None,
    ):
        self.config = config or Config()
        self.temp_parser = temp_parser
        self.photo_parser = photo_parser
        self.door_parser = door_parser
        self.rule_engine = rule_engine
        self.generated_at = datetime.now()

    def generate_all(
        self,
        output_dir: Optional[Path] = None,
        prefix: str = "",
    ) -> Dict[str, Path]:
        """
        生成所有报告
        
        Returns:
            包含报告路径的字典
        """
        output_dir = output_dir or self.config.OUTPUT_DIR
        output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = self.generated_at.strftime("%Y%m%d_%H%M%S")
        if prefix:
            base_name = f"{prefix}_{timestamp}"
        else:
            base_name = timestamp
            
        results = {}
        
        md_path = output_dir / f"{base_name}_handover_report.md"
        self.generate_markdown_report(md_path)
        results["markdown"] = md_path
        
        csv_path = output_dir / f"{base_name}_anomalies.csv"
        self.generate_anomaly_csv(csv_path)
        results["csv"] = csv_path
        
        json_path = output_dir / f"{base_name}_audit_summary.json"
        self.generate_audit_json(json_path)
        results["json"] = json_path
        
        return results

    def generate_markdown_report(self, output_path: Path) -> Path:
        """
        生成 Markdown 交接报告
        """
        content = self._build_markdown_content()
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        return output_path

    def generate_anomaly_csv(self, output_path: Path) -> Path:
        """
        生成 CSV 异常清单
        """
        if not self.rule_engine:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write("")
            return output_path
            
        anomalies = self.rule_engine.anomalies
        
        fieldnames = [
            "序号",
            "告警级别",
            "异常类型",
            "日期",
            "时间",
            "班次",
            "传感器ID",
            "描述",
            "详细信息",
        ]
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for idx, anomaly in enumerate(anomalies, 1):
                row = {
                    "序号": idx,
                    "告警级别": self._alert_level_display(anomaly.alert_level),
                    "异常类型": self._anomaly_type_display(anomaly.anomaly_type),
                    "日期": anomaly.date.isoformat() if anomaly.date else "",
                    "时间": anomaly.timestamp.strftime("%H:%M:%S") if anomaly.timestamp else "",
                    "班次": self._shift_display(anomaly.shift),
                    "传感器ID": anomaly.sensor_id or "",
                    "描述": anomaly.description,
                    "详细信息": json.dumps(anomaly.details, ensure_ascii=False),
                }
                writer.writerow(row)
                
        return output_path

    def generate_audit_json(self, output_path: Path) -> Path:
        """
        生成 JSON 审计摘要
        """
        audit_data = self._build_audit_data()
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=str)
            
        return output_path

    def _build_markdown_content(self) -> str:
        """
        构建 Markdown 报告内容
        """
        lines = []
        
        lines.append("# 疫苗冷链交接报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、概览")
        lines.append("")
        lines.extend(self._build_overview_section())
        lines.append("")
        
        lines.append("## 二、异常汇总")
        lines.append("")
        lines.extend(self._build_anomaly_summary_section())
        lines.append("")
        
        lines.append("## 三、温度监控详情")
        lines.append("")
        lines.extend(self._build_temperature_section())
        lines.append("")
        
        lines.append("## 四、巡检照片状态")
        lines.append("")
        lines.extend(self._build_photo_section())
        lines.append("")
        
        lines.append("## 五、开门日志记录")
        lines.append("")
        lines.extend(self._build_door_log_section())
        lines.append("")
        
        lines.append("## 六、详细异常列表")
        lines.append("")
        lines.extend(self._build_detailed_anomaly_section())
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由冷链交接自动化工具生成*")
        
        return "\n".join(lines)

    def _build_overview_section(self) -> List[str]:
        """
        构建概览部分
        """
        lines = []
        
        date_range = None
        if self.temp_parser and self.temp_parser.all_readings:
            date_range = self.temp_parser.get_date_range()
        elif self.photo_parser and self.photo_parser.photos_by_date:
            dates = sorted(self.photo_parser.photos_by_date.keys())
            if dates:
                date_range = (
                    datetime.combine(dates[0], datetime.min.time()),
                    datetime.combine(dates[-1], datetime.max.time()),
                )
        
        lines.append("| 项目 | 数值 |")
        lines.append("|------|------|")
        
        if date_range:
            lines.append(f"| 数据日期范围 | {date_range[0].strftime('%Y-%m-%d')} 至 {date_range[1].strftime('%Y-%m-%d')} |")
        
        if self.temp_parser:
            stats = self.temp_parser.get_stats()
            lines.append(f"| 温度读数总数 | {stats['total_readings']} |")
            lines.append(f"| 温度记录文件数 | {stats['files_parsed']} |")
            if stats.get("sensors"):
                lines.append(f"| 传感器数量 | {len(stats['sensors'])} |")
        
        if self.photo_parser:
            stats = self.photo_parser.get_stats()
            lines.append(f"| 巡检照片总数 | {stats['total_photos']} |")
            lines.append(f"| 有照片的日期数 | {stats['dates_with_photos']} |")
        
        if self.door_parser:
            stats = self.door_parser.get_stats()
            lines.append(f"| 开门日志条目数 | {stats['total_entries']} |")
            lines.append(f"| 开门会话数 | {stats['total_sessions']} |")
        
        if self.rule_engine:
            summary = self.rule_engine.get_summary()
            lines.append(f"| **异常总数** | **{summary['total_anomalies']}** |")
            lines.append(f"| 严重异常 (CRITICAL) | {summary['critical_count']} |")
            lines.append(f"| 高级异常 (HIGH) | {summary['high_count']} |")
            lines.append(f"| 中级异常 (MEDIUM) | {summary['medium_count']} |")
        
        return lines

    def _build_anomaly_summary_section(self) -> List[str]:
        """
        构建异常汇总部分
        """
        lines = []
        
        if not self.rule_engine or not self.rule_engine.anomalies:
            lines.append("✅ **无异常检测到**")
            lines.append("")
            lines.append("所有监控指标均在正常范围内。")
            return lines
        
        summary = self.rule_engine.get_summary()
        
        if summary["critical_count"] > 0:
            lines.append(f"### 🔴 严重异常 ({summary['critical_count']} 项)")
            lines.append("")
            for anomaly in self.rule_engine.get_critical_anomalies():
                lines.append(f"- **{self._anomaly_type_display(anomaly.anomaly_type)}**: {anomaly.description}")
            lines.append("")
        
        if summary["high_count"] > 0:
            lines.append(f"### 🟠 高级异常 ({summary['high_count']} 项)")
            lines.append("")
            for anomaly in self.rule_engine.get_high_anomalies():
                lines.append(f"- **{self._anomaly_type_display(anomaly.anomaly_type)}**: {anomaly.description}")
            lines.append("")
        
        if summary["medium_count"] > 0:
            lines.append(f"### 🟡 中级异常 ({summary['medium_count']} 项)")
            lines.append("")
            for anomaly in self.rule_engine.get_anomalies_by_level(AlertLevel.MEDIUM):
                lines.append(f"- **{self._anomaly_type_display(anomaly.anomaly_type)}**: {anomaly.description}")
            lines.append("")
        
        return lines

    def _build_temperature_section(self) -> List[str]:
        """
        构建温度监控部分
        """
        lines = []
        
        if not self.temp_parser or not self.temp_parser.all_readings:
            lines.append("⚠️ 无温度数据")
            return lines
        
        stats = self.temp_parser.get_stats()
        
        lines.append("### 温度统计")
        lines.append("")
        lines.append("| 指标 | 数值 | 状态 |")
        lines.append("|------|------|------|")
        
        min_temp = stats.get("min_temp", 0)
        max_temp = stats.get("max_temp", 0)
        avg_temp = stats.get("avg_temp", 0)
        
        min_status = "✅" if min_temp >= self.config.TEMP_THRESHOLD_MIN else "❌"
        max_status = "✅" if max_temp <= self.config.TEMP_THRESHOLD_MAX else "❌"
        avg_status = "✅" if (self.config.TEMP_THRESHOLD_MIN <= avg_temp <= self.config.TEMP_THRESHOLD_MAX) else "❌"
        
        lines.append(f"| 最低温度 | {min_temp:.2f}°C | {min_status} |")
        lines.append(f"| 最高温度 | {max_temp:.2f}°C | {max_status} |")
        lines.append(f"| 平均温度 | {avg_temp:.2f}°C | {avg_status} |")
        lines.append("")
        
        lines.append(f"*温度阈值范围: {self.config.TEMP_THRESHOLD_MIN}°C - {self.config.TEMP_THRESHOLD_MAX}°C*")
        lines.append("")
        
        if stats.get("sensors") and len(stats["sensors"]) > 0:
            lines.append("### 按传感器统计")
            lines.append("")
            lines.append("| 传感器 | 读数数量 | 最低 | 最高 | 平均 |")
            lines.append("|--------|----------|------|------|------|")
            
            for sensor_id, readings in self.temp_parser.sensor_readings.items():
                temps = [r.temperature for r in readings]
                line = f"| {sensor_id or '未知'} | {len(readings)} | "
                line += f"{min(temps):.2f}°C | {max(temps):.2f}°C | {sum(temps)/len(temps):.2f}°C |"
                lines.append(line)
        
        return lines

    def _build_photo_section(self) -> List[str]:
        """
        构建照片部分
        """
        lines = []
        
        if not self.photo_parser or not self.photo_parser.parsed_photos:
            lines.append("⚠️ 无巡检照片数据")
            return lines
        
        stats = self.photo_parser.get_stats()
        
        lines.append("### 照片统计")
        lines.append("")
        lines.append("| 类型 | 数量 |")
        lines.append("|------|------|")
        
        for photo_type, count in stats.get("photo_types", {}).items():
            type_display = self._photo_type_display(photo_type)
            lines.append(f"| {type_display} | {count} |")
        lines.append("")
        
        if stats.get("shift_counts"):
            lines.append("### 按班次统计")
            lines.append("")
            lines.append("| 班次 | 照片数量 |")
            lines.append("|------|----------|")
            for shift, count in stats["shift_counts"].items():
                shift_display = self._shift_display(shift)
                lines.append(f"| {shift_display} | {count} |")
            lines.append("")
        
        if self.photo_parser.photos_by_date:
            lines.append("### 按日期统计")
            lines.append("")
            lines.append("| 日期 | 照片数量 | 类型 |")
            lines.append("|------|----------|------|")
            
            for target_date in sorted(self.photo_parser.photos_by_date.keys()):
                photos = self.photo_parser.photos_by_date[target_date]
                types = {p.photo_type for p in photos}
                type_displays = [self._photo_type_display(t) for t in types]
                lines.append(f"| {target_date.isoformat()} | {len(photos)} | {', '.join(type_displays)} |")
        
        return lines

    def _build_door_log_section(self) -> List[str]:
        """
        构建开门日志部分
        """
        lines = []
        
        if not self.door_parser or not self.door_parser.parsed_entries:
            lines.append("⚠️ 无开门日志数据")
            return lines
        
        stats = self.door_parser.get_stats()
        
        lines.append("### 开门统计")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总开门次数 | {stats['total_sessions']} |")
        lines.append(f"| 日志条目数 | {stats['total_entries']} |")
        
        if stats.get("doors"):
            lines.append(f"| 涉及门数量 | {len(stats['doors'])} |")
            
        if stats.get("avg_duration_seconds"):
            avg_min = stats["avg_duration_seconds"] / 60
            max_min = stats["max_duration_seconds"] / 60
            lines.append(f"| 平均开门时长 | {avg_min:.2f} 分钟 |")
            lines.append(f"| 最长开门时长 | {max_min:.2f} 分钟 |")
        
        lines.append("")
        
        if self.door_parser.sessions:
            lines.append("### 最近开门记录")
            lines.append("")
            lines.append("| 门ID | 开门时间 | 关门时间 | 时长(分钟) | 状态 |")
            lines.append("|------|----------|----------|------------|------|")
            
            recent_sessions = sorted(self.door_parser.sessions, key=lambda s: s.open_time, reverse=True)[:10]
            
            for session in reversed(recent_sessions):
                door_id = session.door_id or "未知"
                open_time = session.open_time.strftime("%Y-%m-%d %H:%M:%S")
                close_time = session.close_time.strftime("%Y-%m-%d %H:%M:%S") if session.close_time else "-"
                duration = f"{session.duration_seconds/60:.2f}" if session.duration_seconds else "-"
                status = "✅ 已关闭" if session.close_time else "⚠️ 未关闭"
                lines.append(f"| {door_id} | {open_time} | {close_time} | {duration} | {status} |")
        
        return lines

    def _build_detailed_anomaly_section(self) -> List[str]:
        """
        构建详细异常列表
        """
        lines = []
        
        if not self.rule_engine or not self.rule_engine.anomalies:
            lines.append("无异常记录。")
            return lines
        
        for level in [AlertLevel.CRITICAL, AlertLevel.HIGH, AlertLevel.MEDIUM]:
            anomalies = self.rule_engine.get_anomalies_by_level(level)
            if not anomalies:
                continue
            
            level_display = self._alert_level_display(level)
            lines.append(f"### {level_display}")
            lines.append("")
            lines.append("| 序号 | 类型 | 日期 | 时间 | 描述 |")
            lines.append("|------|------|------|------|------|")
            
            for idx, anomaly in enumerate(anomalies, 1):
                anomaly_type = self._anomaly_type_display(anomaly.anomaly_type)
                date_str = anomaly.date.isoformat() if anomaly.date else "-"
                time_str = anomaly.timestamp.strftime("%H:%M") if anomaly.timestamp else "-"
                lines.append(f"| {idx} | {anomaly_type} | {date_str} | {time_str} | {anomaly.description} |")
            
            lines.append("")
        
        return lines

    def _build_audit_data(self) -> Dict[str, Any]:
        """
        构建审计数据
        """
        audit_data = {
            "generated_at": self.generated_at.isoformat(),
            "version": "1.0.0",
        }
        
        audit_data["overview"] = {}
        
        if self.temp_parser:
            audit_data["temperature"] = self.temp_parser.get_stats()
            audit_data["overview"]["temperature_readings"] = audit_data["temperature"]["total_readings"]
        
        if self.photo_parser:
            audit_data["photos"] = self.photo_parser.get_stats()
            audit_data["overview"]["total_photos"] = audit_data["photos"]["total_photos"]
        
        if self.door_parser:
            audit_data["door_logs"] = self.door_parser.get_stats()
            audit_data["overview"]["door_sessions"] = audit_data["door_logs"]["total_sessions"]
        
        if self.rule_engine:
            audit_data["anomalies"] = {
                "summary": self.rule_engine.get_summary(),
                "list": self.rule_engine.all_anomalies_to_list(),
            }
            audit_data["overview"]["total_anomalies"] = audit_data["anomalies"]["summary"]["total_anomalies"]
        
        audit_data["config"] = {
            "temperature_threshold": {
                "min": self.config.TEMP_THRESHOLD_MIN,
                "max": self.config.TEMP_THRESHOLD_MAX,
            },
            "min_readings_per_hour": self.config.MIN_READINGS_PER_HOUR,
            "shift_times": self.config.SHIFT_TIMES,
            "required_photos_per_shift": self.config.REQUIRED_PHOTOS_PER_SHIFT,
        }
        
        return audit_data

    def _alert_level_display(self, level: AlertLevel) -> str:
        """
        告警级别显示名称
        """
        display_names = {
            AlertLevel.CRITICAL: "严重 (CRITICAL)",
            AlertLevel.HIGH: "高级 (HIGH)",
            AlertLevel.MEDIUM: "中级 (MEDIUM)",
            AlertLevel.LOW: "低级 (LOW)",
        }
        return display_names.get(level, str(level.value))

    def _anomaly_type_display(self, anomaly_type: AnomalyType) -> str:
        """
        异常类型显示名称
        """
        display_names = {
            AnomalyType.TEMP_OVER_THRESHOLD: "温度超上限",
            AnomalyType.TEMP_UNDER_THRESHOLD: "温度超下限",
            AnomalyType.MISSING_READINGS: "缺测",
            AnomalyType.PHOTO_MISSING: "照片缺失",
            AnomalyType.HANDOVER_TIME_CONFLICT: "交接时间冲突",
            AnomalyType.DOOR_OPENED_LONG: "长时间开门",
            AnomalyType.DOOR_SESSION_INCOMPLETE: "开门会话未完成",
        }
        return display_names.get(anomaly_type, str(anomaly_type.value))

    def _shift_display(self, shift: Optional[str]) -> str:
        """
        班次显示名称
        """
        if not shift:
            return "未知"
        display_names = {
            "morning": "早班",
            "evening": "晚班",
        }
        return display_names.get(shift, shift)

    def _photo_type_display(self, photo_type: str) -> str:
        """
        照片类型显示名称
        """
        display_names = {
            "temperature_1": "温度1",
            "temperature_2": "温度2",
            "door_check": "门检查",
            "inventory": "库存",
            "other": "其他",
            "misc": "其他",
        }
        return display_names.get(photo_type, photo_type)
