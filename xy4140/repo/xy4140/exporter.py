from datetime import datetime, date
from typing import List, Dict, Optional, Any
from pathlib import Path

from models import (
    ElderlyPerson,
    CoolingStation,
    HeatForecast,
    DispatchPlan,
    VisitSchedule,
    CoverageGap,
    StationCongestion,
    RiskLevel,
)
from config import OUTPUT_DIR


class MarkdownExporter:
    def __init__(self):
        self.output_dir = OUTPUT_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_action_list(
        self,
        plan: DispatchPlan,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
        forecast: Optional[HeatForecast] = None,
        coverage_gaps: Optional[List[CoverageGap]] = None,
        congestions: Optional[Dict[str, List[StationCongestion]]] = None,
        hotspots: Optional[List[Dict]] = None,
    ) -> str:
        person_map = {p.id: p for p in persons}
        station_map = {s.id: s for s in stations}

        md_content = []

        md_content.append(f"# 高温避暑站调度行动清单")
        md_content.append(f"")
        md_content.append(f"**方案名称**: {plan.name}")
        md_content.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_content.append(f"**预报日期**: {plan.forecast_date}")
        md_content.append(f"**覆盖区域**: {plan.district}")
        md_content.append(f"")

        md_content.append(f"## 一、风险概览")
        md_content.append(f"")

        stats = self._calculate_risk_stats(persons)
        md_content.append(f"### 1.1 老人风险分布")
        md_content.append(f"")
        md_content.append(f"| 风险等级 | 人数 | 占比 |")
        md_content.append(f"|----------|------|------|")
        for level, count in stats["distribution"].items():
            ratio = count / stats["total"] * 100 if stats["total"] > 0 else 0
            md_content.append(f"| {level} | {count} | {ratio:.1f}% |")
        md_content.append(f"")
        md_content.append(f"**总计**: {stats['total']} 位老人")
        md_content.append(f"")

        critical_persons = [p for p in persons if p.risk_level == RiskLevel.CRITICAL.value]
        if critical_persons:
            md_content.append(f"### 1.2 极高风险老人名单")
            md_content.append(f"")
            md_content.append(f"| 姓名 | 年龄 | 社区 | 健康状况 | 独居 | 行动能力 | 风险分 |")
            md_content.append(f"|------|------|------|----------|------|----------|--------|")
            for p in sorted(critical_persons, key=lambda x: -x.risk_score):
                health = "、".join(p.health_conditions[:3]) if p.health_conditions else "无"
                living_alone = "是" if p.living_alone else "否"
                md_content.append(f"| {p.name} | {p.age} | {p.community} | {health} | {living_alone} | {p.mobility} | {p.risk_score:.2f} |")
            md_content.append(f"")

        if hotspots:
            md_content.append(f"### 1.3 风险热点区域")
            md_content.append(f"")
            md_content.append(f"| 严重程度 | 中心坐标 | 老人数 | 高/极高风险 | 最近站点(km) |")
            md_content.append(f"|----------|----------|--------|--------------|---------------|")
            for hotspot in hotspots[:10]:
                coords = f"{hotspot['center_lat']:.4f}, {hotspot['center_lon']:.4f}"
                md_content.append(f"| {hotspot['severity']} | {coords} | {hotspot['total_count']} | {hotspot['high_risk_total']} | {hotspot['nearest_station_km']} |")
            md_content.append(f"")

        md_content.append(f"## 二、站点覆盖分析")
        md_content.append(f"")

        if coverage_gaps:
            md_content.append(f"### 2.1 覆盖缺口")
            md_content.append(f"")
            md_content.append(f"| 社区 | 未覆盖人数 | 高风险人数 | 最近站点(km) | 严重程度 |")
            md_content.append(f"|------|------------|------------|---------------|----------|")
            for gap in coverage_gaps:
                md_content.append(f"| {gap.area_name} | {gap.uncovered_elderly_count} | {gap.high_risk_count} | {gap.nearest_station_distance} | {gap.gap_severity} |")
            md_content.append(f"")
        else:
            md_content.append(f"### 2.1 覆盖缺口: 无覆盖缺口")
            md_content.append(f"")

        if congestions:
            md_content.append(f"### 2.2 站点拥挤度预测")
            md_content.append(f"")
            md_content.append(f"| 站点名称 | 容量 | 预计峰值 | 拥挤等级 | 峰值时段 |")
            md_content.append(f"|----------|------|----------|----------|----------|")
            for station_id, hourly_list in congestions.items():
                station = station_map.get(station_id)
                if not station:
                    continue
                max_people = max(h.estimated_people for h in hourly_list)
                max_congestion = max(hourly_list, key=lambda x: x.capacity_ratio)
                peak_hour = f"{max_congestion.hour:02d}:00"
                md_content.append(f"| {station.name} | {station.capacity} | {max_people} | {max_congestion.congestion_level} | {peak_hour} |")
            md_content.append(f"")

        md_content.append(f"## 三、站点分配方案")
        md_content.append(f"")

        if plan.station_assignments:
            md_content.append(f"### 3.1 分配汇总")
            md_content.append(f"")

            station_counts: Dict[str, int] = {}
            for elderly_id, station_id in plan.station_assignments.items():
                station_counts[station_id] = station_counts.get(station_id, 0) + 1

            md_content.append(f"| 站点名称 | 分配人数 | 容量 | 使用率 |")
            md_content.append(f"|----------|----------|------|--------|")
            for station_id, count in station_counts.items():
                station = station_map.get(station_id)
                if station:
                    usage = count / station.capacity * 100 if station.capacity > 0 else 0
                    md_content.append(f"| {station.name} | {count} | {station.capacity} | {usage:.1f}% |")
            md_content.append(f"")

        md_content.append(f"## 四、探访排班表")
        md_content.append(f"")

        if plan.visit_schedules:
            schedules_by_staff: Dict[str, List[VisitSchedule]] = {}
            for schedule in plan.visit_schedules:
                if schedule.assigned_staff not in schedules_by_staff:
                    schedules_by_staff[schedule.assigned_staff] = []
                schedules_by_staff[schedule.assigned_staff].append(schedule)

            for staff, schedules in schedules_by_staff.items():
                md_content.append(f"### 4.1 {staff} 排班")
                md_content.append(f"")
                md_content.append(f"| 时间 | 老人姓名 | 社区 | 探访类型 | 状态 |")
                md_content.append(f"|------|----------|------|----------|------|")
                for schedule in sorted(schedules, key=lambda x: x.scheduled_time):
                    person = person_map.get(schedule.elderly_id)
                    name = person.name if person else "未知"
                    community = person.community if person else "未知"
                    md_content.append(f"| {schedule.scheduled_time} | {name} | {community} | {schedule.visit_type} | {schedule.status} |")
                md_content.append(f"")
        else:
            md_content.append(f"暂无探访排班记录。")
            md_content.append(f"")

        md_content.append(f"## 五、行动建议")
        md_content.append(f"")

        suggestions = self._generate_suggestions(
            persons, stations, coverage_gaps, congestions, forecast
        )
        for i, suggestion in enumerate(suggestions, 1):
            md_content.append(f"{i}. **{suggestion['title']}**")
            md_content.append(f"   {suggestion['content']}")
            md_content.append(f"")

        md_content.append(f"---")
        md_content.append(f"*本清单由高温避暑站调度沙盘系统自动生成*")

        return "\n".join(md_content)

    def _calculate_risk_stats(self, persons: List[ElderlyPerson]) -> Dict:
        distribution = {
            RiskLevel.LOW.value: 0,
            RiskLevel.MEDIUM.value: 0,
            RiskLevel.HIGH.value: 0,
            RiskLevel.CRITICAL.value: 0,
        }
        for p in persons:
            distribution[p.risk_level] += 1
        return {
            "distribution": distribution,
            "total": len(persons),
        }

    def _generate_suggestions(
        self,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
        coverage_gaps: Optional[List[CoverageGap]],
        congestions: Optional[Dict[str, List[StationCongestion]]],
        forecast: Optional[HeatForecast],
    ) -> List[Dict]:
        suggestions = []

        critical_count = sum(1 for p in persons if p.risk_level == RiskLevel.CRITICAL.value)
        high_count = sum(1 for p in persons if p.risk_level == RiskLevel.HIGH.value)

        if critical_count > 0:
            suggestions.append({
                "title": "极高风险老人优先处置",
                "content": f"当前有 {critical_count} 位极高风险老人，建议在热浪来临前 24 小时完成首轮探访，确认其避暑安排。",
            })

        if coverage_gaps:
            severe_gaps = [g for g in coverage_gaps if g.gap_severity == "严重"]
            if severe_gaps:
                suggestions.append({
                    "title": "覆盖缺口紧急处理",
                    "content": f"发现 {len(severe_gaps)} 个严重覆盖缺口社区，建议协调临时避暑点或安排专车接送。",
                })

        if congestions:
            crowded_stations = []
            for station_id, hourly_list in congestions.items():
                for h in hourly_list:
                    if h.congestion_level in ["拥挤", "爆满"]:
                        station = next((s for s in stations if s.id == station_id), None)
                        if station and station.name not in [cs["name"] for cs in crowded_stations]:
                            crowded_stations.append({"name": station.name, "level": h.congestion_level})
                        break

            if crowded_stations:
                suggestions.append({
                    "title": "站点分流建议",
                    "content": f"预计 {len(crowded_stations)} 个站点将出现拥挤，建议引导老人错峰前往或分流至周边站点。",
                })

        live_alone_high_risk = [
            p for p in persons
            if p.living_alone and p.risk_level in [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value]
        ]
        if live_alone_high_risk:
            suggestions.append({
                "title": "独居老人重点关注",
                "content": f"有 {len(live_alone_high_risk)} 位独居高风险老人，建议增加探访频次，确认空调使用情况和紧急联系人状态。",
            })

        if not suggestions:
            suggestions.append({
                "title": "常规防控",
                "content": "当前风险可控，请按常规流程开展避暑服务，密切关注气温变化。",
            })

        return suggestions

    def export_action_list(
        self,
        filename: str,
        plan: DispatchPlan,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
        forecast: Optional[HeatForecast] = None,
        coverage_gaps: Optional[List[CoverageGap]] = None,
        congestions: Optional[Dict[str, List[StationCongestion]]] = None,
        hotspots: Optional[List[Dict]] = None,
    ) -> Path:
        content = self.generate_action_list(
            plan, persons, stations, forecast, coverage_gaps, congestions, hotspots
        )

        if not filename.endswith(".md"):
            filename = f"{filename}.md"

        file_path = self.output_dir / filename
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        return file_path
