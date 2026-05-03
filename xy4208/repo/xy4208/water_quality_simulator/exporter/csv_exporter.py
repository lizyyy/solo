import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..models import SimulationResult, AnalysisReport


class CSVExporter:
    def export_simulation_curve(
        self,
        file_path: str,
        simulation_result: SimulationResult,
        scenario_name: Optional[str] = None,
    ) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            header = [
                "timestamp",
                "temperature",
                "ph",
                "ammonia_nitrogen",
                "nitrite",
                "salinity",
                "dissolved_oxygen",
            ]
            if scenario_name:
                header.insert(0, "scenario")

            writer.writerow(header)

            for i, ts in enumerate(simulation_result.timestamps):
                row = [
                    ts.strftime("%Y-%m-%d %H:%M:%S"),
                    round(simulation_result.temperatures[i], 2),
                    round(simulation_result.ph_values[i], 3),
                    round(simulation_result.ammonia_nitrogens[i], 4),
                    round(simulation_result.nitrites[i], 4),
                    round(simulation_result.salinities[i], 2),
                    round(simulation_result.dissolved_oxygens[i], 3),
                ]
                if scenario_name:
                    row.insert(0, scenario_name)
                writer.writerow(row)

    def export_multiple_scenarios(
        self,
        file_path: str,
        scenarios: Dict[str, SimulationResult],
    ) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            header = [
                "scenario",
                "timestamp",
                "temperature",
                "ph",
                "ammonia_nitrogen",
                "nitrite",
                "salinity",
                "dissolved_oxygen",
            ]
            writer.writerow(header)

            for scenario_name, result in scenarios.items():
                for i, ts in enumerate(result.timestamps):
                    row = [
                        scenario_name,
                        ts.strftime("%Y-%m-%d %H:%M:%S"),
                        round(result.temperatures[i], 2),
                        round(result.ph_values[i], 3),
                        round(result.ammonia_nitrogens[i], 4),
                        round(result.nitrites[i], 4),
                        round(result.salinities[i], 2),
                        round(result.dissolved_oxygens[i], 3),
                    ]
                    writer.writerow(row)

    def export_summary_stats(
        self,
        file_path: str,
        report: AnalysisReport,
    ) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        final_state = report.simulation_result.get_final_state()

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            writer.writerow(["metric", "initial_value", "final_value", "change", "unit"])

            initial = report.initial_state

            metrics = [
                ("temperature", "水温", "℃"),
                ("ph", "pH值", "pH"),
                ("ammonia_nitrogen", "氨氮", "mg/L"),
                ("nitrite", "亚硝酸盐", "mg/L"),
                ("salinity", "盐度", "‰"),
                ("dissolved_oxygen", "溶解氧", "mg/L"),
            ]

            for key, name, unit in metrics:
                initial_val = initial.get(key) if key in initial else None
                final_val = final_state.get(key)

                if initial_val is not None and final_val is not None:
                    change = final_val - initial_val
                    writer.writerow([
                        name,
                        round(initial_val, 4),
                        round(final_val, 4),
                        round(change, 4),
                        unit,
                    ])

            writer.writerow([])
            writer.writerow(["统计指标", "最小值", "最大值", "平均值", "标准差"])

            import math

            def calc_stats(values: List[float]) -> tuple:
                if not values:
                    return (None, None, None, None)
                min_val = min(values)
                max_val = max(values)
                mean_val = sum(values) / len(values)
                variance = sum((x - mean_val) ** 2 for x in values) / len(values)
                std_val = math.sqrt(variance)
                return (min_val, max_val, mean_val, std_val)

            stats_metrics = [
                ("氨氮", report.simulation_result.ammonia_nitrogens),
                ("亚硝酸盐", report.simulation_result.nitrites),
                ("pH", report.simulation_result.ph_values),
                ("溶解氧", report.simulation_result.dissolved_oxygens),
            ]

            for name, values in stats_metrics:
                min_val, max_val, mean_val, std_val = calc_stats(values)
                min_val_str = round(min_val, 4) if min_val is not None else ""
                max_val_str = round(max_val, 4) if max_val is not None else ""
                mean_val_str = round(mean_val, 4) if mean_val is not None else ""
                std_val_str = round(std_val, 4) if std_val is not None else ""
                writer.writerow([name, min_val_str, max_val_str, mean_val_str, std_val_str])

    def export_risks(
        self,
        file_path: str,
        report: AnalysisReport,
    ) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)

            writer.writerow([
                "risk_id",
                "risk_type",
                "risk_level",
                "description",
                "current_value",
                "threshold_value",
                "location",
                "suggested_action",
                "confidence",
            ])

            for risk in report.risks:
                writer.writerow([
                    risk.risk_id,
                    risk.risk_type.value,
                    risk.risk_level.value,
                    risk.description,
                    risk.current_value if risk.current_value is not None else "",
                    risk.threshold_value if risk.threshold_value is not None else "",
                    risk.location if risk.location else "",
                    risk.suggested_action if risk.suggested_action else "",
                    risk.confidence,
                ])
