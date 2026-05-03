import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from uuid import uuid4

from ..models import (
    AnalysisReport,
    ComparisonReport,
    PondConfig,
    PondState,
    Scenario,
    SimulationResult,
)


class JSONExporter:
    def _default_serializer(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    def export_audit_package(
        self,
        file_path: str,
        report: AnalysisReport,
        pond_config: Optional[PondConfig] = None,
        initial_state: Optional[PondState] = None,
        scenario: Optional[Scenario] = None,
        sensor_data: Optional[Dict[str, Any]] = None,
        operator_info: Optional[Dict[str, Any]] = None,
    ) -> None:
        audit_package: Dict[str, Any] = {
            "audit_id": f"audit_{uuid4().hex[:12]}",
            "generated_at": datetime.now().isoformat(),
            "version": "1.0",
            "system": "育苗池水质换水推演器",
        }

        audit_package["report"] = report.to_dict()

        if pond_config:
            audit_package["pond_config"] = {
                "pond_id": pond_config.pond_id,
                "pond_name": pond_config.pond_name,
                "volume": pond_config.volume,
                "area": pond_config.area,
                "depth": pond_config.depth,
                "species": pond_config.species,
                "stage": pond_config.stage,
                "stocking_density": pond_config.stocking_density,
            }

        if initial_state:
            audit_package["initial_state"] = initial_state.to_dict()

        if scenario:
            audit_package["scenario"] = scenario.to_dict()

        if sensor_data:
            audit_package["sensor_data"] = sensor_data

        audit_package["simulation_details"] = self._extract_simulation_details(
            report.simulation_result
        )

        audit_package["risk_summary"] = self._generate_risk_summary(report)

        audit_package["recommendation_summary"] = self._generate_recommendation_summary(report)

        if operator_info:
            audit_package["operator"] = operator_info

        audit_package["checksum"] = self._generate_checksum(audit_package)

        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                audit_package,
                f,
                default=self._default_serializer,
                ensure_ascii=False,
                indent=2,
            )

    def _extract_simulation_details(
        self,
        result: SimulationResult,
    ) -> Dict[str, Any]:
        final_state = result.get_final_state()

        import math

        def calc_stats(values: List[float]) -> Dict[str, float]:
            if not values:
                return {}
            min_val = min(values)
            max_val = max(values)
            mean_val = sum(values) / len(values)
            variance = sum((x - mean_val) ** 2 for x in values) / len(values)
            std_val = math.sqrt(variance)
            return {
                "min": round(min_val, 4),
                "max": round(max_val, 4),
                "mean": round(mean_val, 4),
                "std": round(std_val, 4),
            }

        return {
            "timesteps": len(result.timestamps),
            "start_time": result.timestamps[0].isoformat() if result.timestamps else None,
            "end_time": result.timestamps[-1].isoformat() if result.timestamps else None,
            "final_state": {
                "temperature": round(final_state.get("temperature", 0), 2),
                "ph": round(final_state.get("ph", 0), 3),
                "ammonia_nitrogen": round(final_state.get("ammonia_nitrogen", 0), 4),
                "nitrite": round(final_state.get("nitrite", 0), 4),
                "salinity": round(final_state.get("salinity", 0), 2),
                "dissolved_oxygen": round(final_state.get("dissolved_oxygen", 0), 3),
            },
            "statistics": {
                "ammonia_nitrogen": calc_stats(result.ammonia_nitrogens),
                "nitrite": calc_stats(result.nitrites),
                "ph": calc_stats(result.ph_values),
                "dissolved_oxygen": calc_stats(result.dissolved_oxygens),
            },
        }

    def _generate_risk_summary(
        self,
        report: AnalysisReport,
    ) -> Dict[str, Any]:
        from ..models import RiskLevel

        counts = {
            "CRITICAL": 0,
            "DANGER": 0,
            "WARNING": 0,
            "SAFE": 0,
        }

        for risk in report.risks:
            counts[risk.risk_level.value.upper()] = counts.get(risk.risk_level.value.upper(), 0) + 1

        highest_level = report.get_highest_risk_level()

        return {
            "total_risks": len(report.risks),
            "by_level": counts,
            "highest_level": highest_level.value,
        }

    def _generate_recommendation_summary(
        self,
        report: AnalysisReport,
    ) -> Dict[str, Any]:
        recs = report.recommendations

        summary: Dict[str, Any] = {
            "water_change": None,
            "aeration": None,
            "probiotics": None,
        }

        wc_rec = recs.get("water_change", {})
        if wc_rec and wc_rec.get("recommended"):
            summary["water_change"] = {
                "recommended": True,
                "exchange_ratio": wc_rec.get("exchange_ratio", 0),
                "urgency": wc_rec.get("urgency", "normal"),
                "duration_hours": wc_rec.get("duration_hours", 0),
                "reason": wc_rec.get("reason", ""),
            }

        aer_rec = recs.get("aeration", {})
        if aer_rec and aer_rec.get("recommended"):
            summary["aeration"] = {
                "recommended": True,
                "intensity": aer_rec.get("intensity", "normal"),
                "duration_hours": aer_rec.get("duration_hours", 0),
                "reason": aer_rec.get("reason", ""),
            }

        prob_rec = recs.get("probiotics", {})
        if prob_rec and prob_rec.get("recommended"):
            summary["probiotics"] = {
                "recommended": True,
                "probiotics_type": prob_rec.get("probiotics_type", ""),
                "dosage": prob_rec.get("dosage", 0),
                "reason": prob_rec.get("reason", ""),
            }

        return summary

    def _generate_checksum(
        self,
        data: Dict[str, Any],
    ) -> str:
        import hashlib

        checksum_data = {
            "report_id": data.get("report", {}).get("report_id"),
            "generated_at": data.get("generated_at"),
            "risk_count": len(data.get("report", {}).get("risks", [])),
        }

        checksum_str = json.dumps(checksum_data, sort_keys=True)
        return hashlib.sha256(checksum_str.encode("utf-8")).hexdigest()[:16]

    def export_comparison_audit(
        self,
        file_path: str,
        comparison_report: ComparisonReport,
        baseline_report: Optional[AnalysisReport] = None,
        comparison_report_obj: Optional[AnalysisReport] = None,
    ) -> None:
        audit_package: Dict[str, Any] = {
            "audit_id": f"comp_audit_{uuid4().hex[:12]}",
            "generated_at": datetime.now().isoformat(),
            "type": "comparison",
        }

        audit_package["comparison"] = comparison_report.to_dict()

        if baseline_report:
            audit_package["baseline_report_summary"] = {
                "report_id": baseline_report.report_id,
                "highest_risk_level": baseline_report.get_highest_risk_level().value,
                "risk_count": len(baseline_report.risks),
            }

        if comparison_report_obj:
            audit_package["comparison_report_summary"] = {
                "report_id": comparison_report_obj.report_id,
                "highest_risk_level": comparison_report_obj.get_highest_risk_level().value,
                "risk_count": len(comparison_report_obj.risks),
            }

        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                audit_package,
                f,
                default=self._default_serializer,
                ensure_ascii=False,
                indent=2,
            )
