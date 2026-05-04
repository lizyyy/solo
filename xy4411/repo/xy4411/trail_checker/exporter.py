import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from .models import (
    RunnerStatus, AidStationCheck, MedicalEventCheck, AuditPackage, RaceConfig
)


def format_duration(seconds: Optional[float]) -> str:
    if seconds is None:
        return "N/A"
    td = timedelta(seconds=seconds)
    hours = int(td.total_seconds() // 3600)
    minutes = int((td.total_seconds() % 3600) // 60)
    seconds = int(td.total_seconds() % 60)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def format_datetime(dt: Optional[datetime]) -> str:
    if dt is None:
        return "N/A"
    return dt.strftime("%Y-%m-%d %H:%M:%S")


class ReportExporter:
    def __init__(self, race_config: RaceConfig):
        self.race_config = race_config

    def generate_markdown_report(
        self,
        runners: List[RunnerStatus],
        aid_stations: List[AidStationCheck],
        medical_events: List[MedicalEventCheck],
        summary: Dict[str, Any]
    ) -> str:
        lines = []
        lines.append(f"# {self.race_config.race_name} - 完赛核对报告")
        lines.append("")
        lines.append(f"- **比赛日期**: {self.race_config.race_date}")
        lines.append(f"- **距离**: {self.race_config.distance_km} km")
        lines.append(f"- **报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append("## 一、总体统计")
        lines.append("")
        lines.append("| 指标 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 报名人数 | {summary['total_registrations']} |")
        lines.append(f"| 出发人数 | {summary['runners_started']} |")
        lines.append(f"| 完赛人数 | {summary['runners_finished']} |")
        lines.append(f"| 未完赛人数 | {summary['runners_not_finished']} |")
        lines.append(f"| 超时人数 | {summary['runners_cutoff']} |")
        lines.append(f"| 需复核选手 | {summary['runners_needs_review']} |")
        lines.append(f"| 补给站异常 | {summary['aid_stations_anomalies']} |")
        lines.append(f"| 医疗事件 | {summary['medical_events_total']} |")
        lines.append(f"| 需回访医疗事件 | {summary['medical_events_follow_up']} |")
        lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 二、选手完赛情况")
        lines.append("")

        finished = [r for r in runners if r.race_status in ["完赛", "完赛(需复核)"]]
        not_finished = [r for r in runners if r.race_status not in ["完赛", "完赛(需复核)", "未出发"]]
        not_started = [r for r in runners if r.race_status == "未出发"]

        if finished:
            lines.append("### 2.1 完赛选手")
            lines.append("")
            lines.append("| 参赛号 | 姓名 | 出发时间 | 完赛时间 | 用时 | 状态 | 复核状态 |")
            lines.append("|--------|------|----------|----------|------|------|----------|")
            for r in sorted(finished, key=lambda x: x.total_time_seconds or float('inf')):
                lines.append(
                    f"| {r.bib} | {r.name} | {format_datetime(r.start_time)} | "
                    f"{format_datetime(r.end_time)} | {format_duration(r.total_time_seconds)} | "
                    f"{r.race_status} | {r.review_status} |"
                )
            lines.append("")

        if not_finished:
            lines.append("### 2.2 未完赛选手")
            lines.append("")
            lines.append("| 参赛号 | 姓名 | 状态 | 缺失检查点 | 超时违规 | 复核状态 |")
            lines.append("|--------|------|------|------------|----------|----------|")
            for r in sorted(not_finished, key=lambda x: x.bib):
                missing = ", ".join(r.checkpoints_missing) if r.checkpoints_missing else "无"
                cutoff = len(r.cutoff_violations) if r.cutoff_violations else 0
                lines.append(
                    f"| {r.bib} | {r.name} | {r.race_status} | {missing} | "
                    f"{cutoff} 项 | {r.review_status} |"
                )
            lines.append("")

        if not_started:
            lines.append("### 2.3 未出发选手")
            lines.append("")
            lines.append("| 参赛号 | 姓名 | 复核状态 |")
            lines.append("|--------|------|----------|")
            for r in sorted(not_started, key=lambda x: x.bib):
                lines.append(f"| {r.bib} | {r.name} | {r.review_status} |")
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 三、需复核选手详情")
        lines.append("")
        
        needs_review = [r for r in runners if r.review_status != "ok"]
        if needs_review:
            for r in needs_review:
                lines.append(f"### 选手 {r.bib} - {r.name}")
                lines.append("")
                lines.append(f"- **状态**: {r.race_status}")
                lines.append(f"- **复核状态**: {r.review_status}")
                if r.checkpoints_missing:
                    lines.append(f"- **缺失检查点**: {', '.join(r.checkpoints_missing)}")
                if r.cutoff_violations:
                    lines.append("- **超时违规**:")
                    for violation in r.cutoff_violations:
                        lines.append(f"  - {violation}")
                if r.medical_events:
                    lines.append(f"- **医疗事件**: {', '.join(r.medical_events)}")
                if r.review_notes:
                    lines.append(f"- **复核备注**: {r.review_notes}")
                lines.append("")
        else:
            lines.append("无需要复核的选手。")
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 四、补给站消耗检查")
        lines.append("")
        
        for station in aid_stations:
            lines.append(f"### {station.station_name}")
            lines.append("")
            lines.append("| 物品 | 预期量 | 实际消耗 | 状态 |")
            lines.append("|------|--------|----------|------|")
            for item in station.expected_items.keys():
                expected = station.expected_items[item]
                actual = station.total_consumed.get(item, 0)
                status = "正常"
                if actual > expected * 1.2:
                    status = "超量"
                elif actual < expected * 0.3 and actual > 0:
                    status = "偏低"
                lines.append(f"| {item} | {expected} | {actual} | {status} |")
            lines.append("")
            
            if station.anomalies:
                lines.append("**异常记录**:")
                lines.append("")
                for anomaly in station.anomalies:
                    lines.append(f"- {anomaly}")
                lines.append("")
            
            lines.append(f"- **复核状态**: {station.review_status}")
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 五、医疗事件记录")
        lines.append("")

        severe_events = [e for e in medical_events if e.severity == "severe"]
        moderate_events = [e for e in medical_events if e.severity == "moderate"]
        mild_events = [e for e in medical_events if e.severity == "mild"]

        if severe_events:
            lines.append("### 5.1 严重事件")
            lines.append("")
            lines.append("| 事件ID | 参赛号 | 姓名 | 状态 | 需回访 | 复核状态 |")
            lines.append("|--------|--------|------|------|--------|----------|")
            for e in severe_events:
                lines.append(
                    f"| {e.event_id} | {e.bib} | {e.runner_name} | {e.status} | "
                    f"{'是' if e.needs_follow_up else '否'} | {e.review_status} |"
                )
            lines.append("")

        if moderate_events:
            lines.append("### 5.2 中等事件")
            lines.append("")
            lines.append("| 事件ID | 参赛号 | 姓名 | 状态 | 需回访 | 复核状态 |")
            lines.append("|--------|--------|------|------|--------|----------|")
            for e in moderate_events:
                lines.append(
                    f"| {e.event_id} | {e.bib} | {e.runner_name} | {e.status} | "
                    f"{'是' if e.needs_follow_up else '否'} | {e.review_status} |"
                )
            lines.append("")

        if mild_events:
            lines.append("### 5.3 轻微事件")
            lines.append("")
            lines.append("| 事件ID | 参赛号 | 姓名 | 状态 | 需回访 | 复核状态 |")
            lines.append("|--------|--------|------|------|--------|----------|")
            for e in mild_events:
                lines.append(
                    f"| {e.event_id} | {e.bib} | {e.runner_name} | {e.status} | "
                    f"{'是' if e.needs_follow_up else '否'} | {e.review_status} |"
                )
            lines.append("")

        lines.append("---")
        lines.append("")

        lines.append("## 六、检查点配置")
        lines.append("")
        lines.append("| 检查点 | 名称 | 距离(km) | 关门时间 |")
        lines.append("|--------|------|-----------|----------|")
        for cp in sorted(self.race_config.checkpoints, key=lambda x: x.distance_km):
            lines.append(
                f"| {cp.cp_id} | {cp.name} | {cp.distance_km} | "
                f"{cp.cutoff_time.strftime('%Y-%m-%d %H:%M:%S')} |"
            )
        lines.append("")

        return "\n".join(lines)

    def generate_audit_package(
        self,
        runners: List[RunnerStatus],
        aid_stations: List[AidStationCheck],
        medical_events: List[MedicalEventCheck],
        summary: Dict[str, Any],
        total_registrations: int,
        total_timing_records: int,
        total_aid_records: int,
        total_medical_events: int,
    ) -> AuditPackage:
        return AuditPackage(
            generated_at=datetime.now(),
            race_name=self.race_config.race_name,
            race_date=self.race_config.race_date,
            total_registrations=total_registrations,
            total_timing_records=total_timing_records,
            total_aid_station_records=total_aid_records,
            total_medical_events=total_medical_events,
            runner_checks=runners,
            aid_station_checks=aid_stations,
            medical_event_checks=medical_events,
            summary=summary,
        )

    def export_report(self, output_path: str, content: str):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)

    def export_audit_package(self, output_path: str, audit_package: AuditPackage):
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(
                audit_package.model_dump(mode="json"),
                f,
                ensure_ascii=False,
                indent=2,
                default=str,
            )
