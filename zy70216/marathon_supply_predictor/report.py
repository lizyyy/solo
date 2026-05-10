from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import os
from .models import (
    MarathonEvent, PredictionResult, ProcessingStatus,
    Weather, SupplyItem
)
from .prediction import WeatherFactors


class ShortageReviewer:
    def __init__(self, event: MarathonEvent, results: List[PredictionResult]):
        self.event = event
        self.results = results

    def get_high_risk_stations(self) -> List[PredictionResult]:
        return [r for r in self.results if r.status == "warning" or r.status == "error"]

    def get_shortage_summary(self) -> Dict[str, Any]:
        high_risk = self.get_high_risk_stations()
        total_stations = len(self.results)

        supply_shortage: Dict[str, Dict[str, float]] = {}

        for result in self.results:
            for supply_type, gap_val in result.gap.items():
                if gap_val < 0:
                    if supply_type not in supply_shortage:
                        supply_shortage[supply_type] = {
                            "total_gap": 0.0,
                            "stations_affected": 0
                        }
                    supply_shortage[supply_type]["total_gap"] += abs(gap_val)
                    supply_shortage[supply_type]["stations_affected"] += 1

        return {
            "total_stations": total_stations,
            "high_risk_stations": len(high_risk),
            "high_risk_percentage": round(len(high_risk) / total_stations * 100, 2) if total_stations > 0 else 0,
            "high_risk_names": [r.station_name for r in high_risk],
            "supply_shortage_summary": supply_shortage
        }

    def analyze_root_causes(self) -> Dict[str, List[str]]:
        causes = {
            "distance_factor": [],
            "weather_factor": [],
            "runner_distribution": [],
            "supply_preparation": []
        }

        high_risk = self.get_high_risk_stations()

        for result in high_risk:
            if result.distance_km >= 30:
                causes["distance_factor"].append(
                    f"{result.station_name} (30km+位置，消耗系数高)"
                )

        if self.event.weather:
            temp_factor = WeatherFactors.calculate_temperature_factor(self.event.weather.temperature)
            humidity_factor = WeatherFactors.calculate_humidity_factor(self.event.weather.humidity)

            if temp_factor > 1.3:
                causes["weather_factor"].append(
                    f"高温因素: {self.event.weather.temperature}°C, 消耗系数 x{temp_factor}"
                )
            if humidity_factor > 1.15:
                causes["weather_factor"].append(
                    f"高湿因素: 湿度{self.event.weather.humidity}%, 消耗系数 x{humidity_factor}"
                )

        for result in high_risk:
            segment = None
            for seg in self.event.segments:
                if seg.segment_id == result.segment_id:
                    segment = seg
                    break

            if segment and segment.estimated_runners > 500:
                causes["runner_distribution"].append(
                    f"{result.station_name} 所在分段人数: {segment.estimated_runners}人"
                )

        for result in high_risk:
            for supply_type, is_risk in result.shortage_risk.items():
                if is_risk:
                    gap_pct = result.gap_percentage.get(supply_type, 0)
                    causes["supply_preparation"].append(
                        f"{result.station_name} {supply_type} 缺口: {abs(gap_pct):.1f}%"
                    )

        return {k: v for k, v in causes.items() if v}

    def generate_review_recommendations(self) -> List[str]:
        recommendations = []
        high_risk = self.get_high_risk_stations()
        summary = self.get_shortage_summary()

        if summary["high_risk_percentage"] > 50:
            recommendations.append("紧急: 超过一半的补给站存在风险，建议整体复核物资备量")

        if self.event.weather and self.event.weather.temperature >= 30:
            recommendations.append(
                f"高温天气({self.event.weather.temperature}°C)，建议各站点水和运动饮料备量增加20%"
            )

        for result in high_risk:
            for supply_type, is_risk in result.shortage_risk.items():
                if is_risk:
                    gap = abs(result.gap.get(supply_type, 0))
                    item = self._get_supply_item(supply_type)
                    unit = item.unit if item else "个"
                    recommendations.append(
                        f"{result.station_name}: {supply_type} 需补充约 {int(gap) + 10}{unit}"
                    )

        return recommendations

    def _get_supply_item(self, supply_type: str) -> Optional[SupplyItem]:
        for item in self.event.supply_items:
            if item.supply_type == supply_type:
                return item
        return None


class ReportGenerator:
    def __init__(
        self, 
        event: MarathonEvent, 
        results: List[PredictionResult], 
        processing_status: ProcessingStatus,
        output_dir: str
    ):
        self.event = event
        self.results = results
        self.status = processing_status
        self.output_dir = output_dir
        self.reviewer = ShortageReviewer(event, results)

    def generate_all(self) -> Dict[str, str]:
        os.makedirs(self.output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        files = {}

        files["prediction_details"] = self._save_prediction_details(timestamp)
        files["shortage_review"] = self._save_shortage_review(timestamp)
        files["processing_status"] = self._save_processing_status(timestamp)
        files["final_report"] = self._save_final_report(timestamp)

        return files

    def _save_prediction_details(self, timestamp: str) -> str:
        path = os.path.join(self.output_dir, f"prediction_details_{timestamp}.json")
        
        data = {
            "event_info": self.event.to_dict(),
            "predictions": [r.to_dict() for r in self.results],
            "generated_at": datetime.now().isoformat()
        }

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def _save_shortage_review(self, timestamp: str) -> str:
        path = os.path.join(self.output_dir, f"shortage_review_{timestamp}.json")
        
        summary = self.reviewer.get_shortage_summary()
        root_causes = self.reviewer.analyze_root_causes()
        recommendations = self.reviewer.generate_review_recommendations()

        data = {
            "event_id": self.event.event_id,
            "event_name": self.event.name,
            "shortage_summary": summary,
            "root_causes": root_causes,
            "recommendations": recommendations,
            "generated_at": datetime.now().isoformat()
        }

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def _save_processing_status(self, timestamp: str) -> str:
        path = os.path.join(self.output_dir, f"processing_status_{timestamp}.json")

        data = {
            "status": self.status.to_dict(),
            "all_station_statuses": [
                {
                    "station_id": r.station_id,
                    "station_name": r.station_name,
                    "status": r.status,
                    "warnings": r.warnings
                }
                for r in self.results
            ],
            "generated_at": datetime.now().isoformat()
        }

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def _save_final_report(self, timestamp: str) -> str:
        path = os.path.join(self.output_dir, f"final_report_{timestamp}.txt")

        summary = self.reviewer.get_shortage_summary()
        root_causes = self.reviewer.analyze_root_causes()
        recommendations = self.reviewer.generate_review_recommendations()

        report_lines = [
            "=" * 60,
            "马拉松补给消耗预测报告",
            "=" * 60,
            "",
            f"赛事名称: {self.event.name}",
            f"赛事ID: {self.event.event_id}",
            f"赛事日期: {self.event.event_date}",
            f"总里程: {self.event.total_distance_km}km",
            f"预估总人数: {self.event.total_estimated_runners}人",
            "",
            "-" * 60,
            "天气信息",
            "-" * 60,
        ]

        if self.event.weather:
            report_lines.extend([
                f"温度: {self.event.weather.temperature}°C",
                f"湿度: {self.event.weather.humidity}%",
                f"风速: {self.event.weather.wind_speed}km/h",
                f"天气类型: {self.event.weather.weather_type}",
                f"降水概率: {self.event.weather.precipitation_probability}%",
            ])
        else:
            report_lines.append("天气信息: 未提供")

        report_lines.extend([
            "",
            "-" * 60,
            "补给站预测明细",
            "-" * 60,
        ])

        for result in self.results:
            report_lines.extend([
                "",
                f"【{result.status.upper()}】{result.station_name} ({result.distance_km}km)",
                f"  分段ID: {result.segment_id}",
                f"  分段人数: {result.runners_in_segment}人",
            ])

            for supply_type, predicted in result.predicted_consumption.items():
                prepared = result.prepared_supplies.get(supply_type, 0)
                gap = result.gap.get(supply_type, 0)
                gap_pct = result.gap_percentage.get(supply_type, 0)
                risk = result.shortage_risk.get(supply_type, False)

                risk_str = "⚠️ 短缺风险" if risk else "✓ 充足"
                report_lines.append(
                    f"  {supply_type}: 预测{predicted:.1f} | 备量{prepared} | "
                    f"缺口{gap:+.1f} ({gap_pct:+.1f}%) [{risk_str}]"
                )

            if result.warnings:
                for warn in result.warnings:
                    report_lines.append(f"  ⚠️  {warn}")

        report_lines.extend([
            "",
            "-" * 60,
            "短缺汇总",
            "-" * 60,
            f"总补给站数: {summary['total_stations']}",
            f"高风险站数: {summary['high_risk_stations']} ({summary['high_risk_percentage']}%)",
        ])

        if summary["high_risk_names"]:
            report_lines.append(f"高风险站点: {', '.join(summary['high_risk_names'])}")

        report_lines.extend([
            "",
            "-" * 60,
            "根因分析",
            "-" * 60,
        ])

        if root_causes:
            for cause_type, items in root_causes.items():
                cause_names = {
                    "distance_factor": "距离因素",
                    "weather_factor": "天气因素",
                    "runner_distribution": "人流分布",
                    "supply_preparation": "备量问题"
                }
                report_lines.append(f"\n【{cause_names.get(cause_type, cause_type)}】")
                for item in items:
                    report_lines.append(f"  - {item}")
        else:
            report_lines.append("未发现明显短缺根因")

        report_lines.extend([
            "",
            "-" * 60,
            "处理状态",
            "-" * 60,
            f"当前阶段: {self.status.phase}",
            f"处理状态: {self.status.status}",
            f"需要复核: {'是' if self.status.needs_review else '否'}",
        ])

        if self.status.review_reasons:
            report_lines.append("复核原因:")
            for reason in self.status.review_reasons:
                report_lines.append(f"  - {reason}")

        if self.status.blocked_reasons:
            report_lines.append("拦截原因:")
            for reason in self.status.blocked_reasons:
                report_lines.append(f"  - {reason}")

        report_lines.extend([
            "",
            "-" * 60,
            "建议措施",
            "-" * 60,
        ])

        if recommendations:
            for rec in recommendations:
                report_lines.append(f"  - {rec}")
        else:
            report_lines.append("无需额外措施，备量充足")

        report_lines.extend([
            "",
            "=" * 60,
            f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 60,
        ])

        with open(path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(report_lines))
        return path
