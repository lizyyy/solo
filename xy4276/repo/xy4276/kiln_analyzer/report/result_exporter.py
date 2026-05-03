import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from kiln_analyzer.models import AnalysisResult


class JSONResultExporter:
    def export(
        self,
        analysis_result: AnalysisResult,
        output_path: Path,
        include_profiles: bool = True,
    ) -> None:
        data = self._result_to_dict(analysis_result, include_profiles)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def _result_to_dict(
        self, result: AnalysisResult, include_profiles: bool
    ) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "batch_id": result.batch_id,
            "analysis_time": result.analysis_time.isoformat(),
            "curve_name": result.curve_name,
            "metadata": result.metadata,
        }

        deviations_data: List[Dict] = []
        for dev in result.phase_deviations:
            dev_data = {
                "phase_name": dev.phase_name,
                "phase_type": dev.phase_type.value,
                "avg_temp_deviation": dev.avg_temp_deviation,
                "max_temp_deviation": dev.max_temp_deviation,
                "rate_deviation": dev.rate_deviation,
                "hold_deviation_seconds": dev.hold_deviation_seconds,
            }
            if include_profiles:
                dev_data["target_temp_profile"] = dev.target_temp_profile
                dev_data["actual_temp_profile"] = dev.actual_temp_profile
            deviations_data.append(dev_data)
        data["phase_deviations"] = deviations_data

        integrals_data: List[Dict] = []
        for integral in result.heat_integrals:
            integrals_data.append({
                "phase_name": integral.phase_name,
                "total_heat": integral.total_heat,
                "heat_by_layer": integral.heat_by_layer,
                "reference_heat": integral.reference_heat,
                "deviation_percent": integral.deviation_percent,
            })
        data["heat_integrals"] = integrals_data

        risk_data: Dict[str, Any] = {
            "overall_risk": result.risk_assessment.overall_risk.value,
            "overall_score": result.risk_assessment.overall_score,
            "critical_factors": result.risk_assessment.critical_factors,
            "suggestions": result.risk_assessment.suggestions,
        }

        layer_risks_data: Dict[str, Dict] = {}
        for layer_name, risk in result.risk_assessment.layer_risks.items():
            layer_risks_data[layer_name] = {
                "risk_level": risk.risk_level.value,
                "risk_score": risk.risk_score,
                "risk_factors": risk.risk_factors,
                "suggestion": risk.suggestion,
            }
        risk_data["layer_risks"] = layer_risks_data

        data["risk_assessment"] = risk_data

        return data


class CSVResultExporter:
    def export(
        self,
        analysis_result: AnalysisResult,
        output_dir: Path,
    ) -> List[Path]:
        output_dir.mkdir(parents=True, exist_ok=True)

        written_files: List[Path] = []

        deviation_path = output_dir / "deviations.csv"
        self._write_deviations_csv(analysis_result, deviation_path)
        written_files.append(deviation_path)

        heat_path = output_dir / "heat_integrals.csv"
        self._write_heat_integrals_csv(analysis_result, heat_path)
        written_files.append(heat_path)

        risk_path = output_dir / "risks.csv"
        self._write_risks_csv(analysis_result, risk_path)
        written_files.append(risk_path)

        summary_path = output_dir / "summary.csv"
        self._write_summary_csv(analysis_result, summary_path)
        written_files.append(summary_path)

        return written_files

    def _write_deviations_csv(
        self, result: AnalysisResult, path: Path
    ) -> None:
        rows: List[Dict[str, Any]] = []

        for dev in result.phase_deviations:
            for layer_name, avg_dev in dev.avg_temp_deviation.items():
                max_dev = dev.max_temp_deviation.get(layer_name, 0.0)
                rate_dev = (dev.rate_deviation or {}).get(layer_name)

                rows.append({
                    "batch_id": result.batch_id,
                    "phase_name": dev.phase_name,
                    "phase_type": dev.phase_type.value,
                    "layer": layer_name,
                    "avg_temp_deviation": round(avg_dev, 2),
                    "max_temp_deviation": round(max_dev, 2),
                    "rate_deviation": round(rate_dev, 2) if rate_dev is not None else "",
                    "hold_deviation_seconds": dev.hold_deviation_seconds or "",
                })

        if rows:
            with open(path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

    def _write_heat_integrals_csv(
        self, result: AnalysisResult, path: Path
    ) -> None:
        rows: List[Dict[str, Any]] = []

        for integral in result.heat_integrals:
            for layer_name, heat in integral.heat_by_layer.items():
                rows.append({
                    "batch_id": result.batch_id,
                    "phase_name": integral.phase_name,
                    "layer": layer_name,
                    "heat_integral": round(heat, 2),
                    "total_phase_heat": round(integral.total_heat, 2),
                    "reference_heat": round(integral.reference_heat, 2) if integral.reference_heat else "",
                    "deviation_percent": round(integral.deviation_percent, 2) if integral.deviation_percent else "",
                })

        if rows:
            with open(path, "w", encoding="utf-8", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

    def _write_risks_csv(
        self, result: AnalysisResult, path: Path
    ) -> None:
        rows: List[Dict[str, Any]] = []

        for layer_name, risk in result.risk_assessment.layer_risks.items():
            rows.append({
                "batch_id": result.batch_id,
                "layer": layer_name,
                "risk_level": risk.risk_level.value,
                "risk_score": round(risk.risk_score, 2),
                "risk_factors": "; ".join(risk.risk_factors),
                "suggestion": risk.suggestion or "",
            })

        rows.append({
            "batch_id": result.batch_id,
            "layer": "OVERALL",
            "risk_level": result.risk_assessment.overall_risk.value,
            "risk_score": round(result.risk_assessment.overall_score, 2),
            "risk_factors": "; ".join(result.risk_assessment.critical_factors),
            "suggestion": "; ".join(result.risk_assessment.suggestions),
        })

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def _write_summary_csv(
        self, result: AnalysisResult, path: Path
    ) -> None:
        row = {
            "batch_id": result.batch_id,
            "analysis_time": result.analysis_time.isoformat(),
            "curve_name": result.curve_name,
            "overall_risk": result.risk_assessment.overall_risk.value,
            "overall_risk_score": round(result.risk_assessment.overall_score, 2),
            "phase_count": len(result.phase_deviations),
            "critical_factor_count": len(result.risk_assessment.critical_factors),
            "suggestion_count": len(result.risk_assessment.suggestions),
        }

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=row.keys())
            writer.writeheader()
            writer.writerow(row)
