"""JSON 审计包导出模块"""

import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from rov_tension_checker.storage.models import AnalysisRecord
from rov_tension_checker.analysis.risk_engine import RiskSeverity


class JSONAuditor:
    def __init__(self):
        self.version = "1.0"
    
    def export_audit(
        self,
        record: AnalysisRecord,
        output_path: str,
        include_samples: bool = True
    ) -> str:
        audit_data = self._build_audit_package(record, include_samples)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=self._json_default)
        
        return str(path)
    
    def _build_audit_package(
        self,
        record: AnalysisRecord,
        include_samples: bool
    ) -> Dict[str, Any]:
        package: Dict[str, Any] = {
            "version": self.version,
            "generated_at": datetime.now().isoformat(),
            "analysis_info": {
                "analysis_id": record.analysis_id,
                "project_name": record.project_name,
                "pipeline_id": record.pipeline_id,
                "survey_date": record.survey_date.isoformat(),
                "created_at": record.created_at.isoformat()
            },
            "summary": {
                "sample_count": record.sample_count,
                "critical_risk_count": record.critical_risk_count,
                "warning_risk_count": record.warning_risk_count,
                "risk_summary": record.risk_summary
            },
            "statistics": {
                "max_top_tension": record.max_top_tension,
                "min_top_tension": record.min_top_tension,
                "avg_top_tension": record.avg_top_tension,
                "min_bending_radius": record.min_bending_radius,
                "min_bending_radius_location": record.min_bending_radius_location,
                "min_cable_length": record.min_cable_length,
                "max_cable_length": record.max_cable_length,
                "avg_cable_length": record.avg_cable_length,
                "max_depth": record.max_depth,
                "min_depth": record.min_depth,
                "avg_depth": record.avg_depth,
                "max_current_speed": record.max_current_speed,
                "avg_current_speed": record.avg_current_speed,
                "max_horizontal_offset": record.max_horizontal_offset,
                "avg_horizontal_offset": record.avg_horizontal_offset
            },
            "config_snapshot": record.config_snapshot
        }
        
        if include_samples:
            package["samples"] = self._serialize_samples(record.samples)
        
        return package
    
    def _serialize_samples(
        self,
        samples: List[Any]
    ) -> List[Dict[str, Any]]:
        serialized: List[Dict[str, Any]] = []
        
        for sample in samples:
            sample_dict: Dict[str, Any] = {
                "sample_index": sample.sample_index,
                "timestamp": sample.timestamp.isoformat()
            }
            
            if sample.vessel_latitude is not None:
                sample_dict["vessel_latitude"] = sample.vessel_latitude
            if sample.vessel_longitude is not None:
                sample_dict["vessel_longitude"] = sample.vessel_longitude
            if sample.vessel_x is not None:
                sample_dict["vessel_x"] = sample.vessel_x
            if sample.vessel_y is not None:
                sample_dict["vessel_y"] = sample.vessel_y
            if sample.vessel_heading is not None:
                sample_dict["vessel_heading"] = sample.vessel_heading
            
            if sample.rov_depth is not None:
                sample_dict["rov_depth"] = sample.rov_depth
            if sample.rov_cable_length is not None:
                sample_dict["rov_cable_length"] = sample.rov_cable_length
            if sample.rov_thrust_forward is not None:
                sample_dict["rov_thrust_forward"] = sample.rov_thrust_forward
            if sample.rov_thrust_vertical is not None:
                sample_dict["rov_thrust_vertical"] = sample.rov_thrust_vertical
            
            if sample.current_speed is not None:
                sample_dict["current_speed"] = sample.current_speed
            if sample.current_direction is not None:
                sample_dict["current_direction"] = sample.current_direction
            
            if sample.horizontal_offset is not None:
                sample_dict["horizontal_offset"] = sample.horizontal_offset
            if sample.top_tension is not None:
                sample_dict["top_tension"] = sample.top_tension
            if sample.bottom_tension is not None:
                sample_dict["bottom_tension"] = sample.bottom_tension
            if sample.tension_ratio is not None:
                sample_dict["tension_ratio"] = sample.tension_ratio
            if sample.safety_margin is not None:
                sample_dict["safety_margin"] = sample.safety_margin
            if sample.minimum_bending_radius is not None:
                sample_dict["minimum_bending_radius"] = sample.minimum_bending_radius
            if sample.bending_radius_location is not None:
                sample_dict["bending_radius_location"] = sample.bending_radius_location
            if sample.top_angle is not None:
                sample_dict["top_angle"] = sample.top_angle
            if sample.bottom_angle is not None:
                sample_dict["bottom_angle"] = sample.bottom_angle
            
            if sample.risks:
                sample_dict["risks"] = [
                    {
                        "risk_type": risk.risk_type.value,
                        "severity": risk.severity.value,
                        "timestamp": risk.timestamp.isoformat(),
                        "description": risk.description,
                        "details": risk.details
                    }
                    for risk in sample.risks
                ]
            
            serialized.append(sample_dict)
        
        return serialized
    
    def _json_default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, RiskSeverity):
            return obj.value
        try:
            return asdict(obj)
        except TypeError:
            return str(obj)
    
    def export_minimal(
        self,
        record: AnalysisRecord,
        output_path: str
    ) -> str:
        return self.export_audit(record, output_path, include_samples=False)
