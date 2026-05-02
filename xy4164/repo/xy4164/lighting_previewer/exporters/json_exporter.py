"""JSON计算包导出器"""

import json
from typing import Dict, Any, Optional
from pathlib import Path

from ..models import (
    CropZone, LEDSpectrum, SensorData, ElectricityPrice,
    LightPlan, CalculationResult, ValidationResult
)


class JSONExporter:
    
    def __init__(self):
        pass
    
    def export_calculation_package(
        self,
        zones: list,
        spectra: list,
        sensors: list,
        electricity_price: ElectricityPrice,
        light_plan: LightPlan,
        calculation_result: CalculationResult,
        validation_result: Optional[ValidationResult] = None,
        output_path: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        
        package = {
            "version": "1.0.0",
            "exported_at": __import__('datetime').datetime.now().isoformat(),
            "metadata": metadata or {},
            
            "input_data": {
                "zones": [z.to_dict() for z in zones],
                "spectra": [s.to_dict() for s in spectra],
                "sensors": [s.to_dict() for s in sensors],
                "electricity_price": electricity_price.to_dict() if electricity_price else None
            },
            
            "light_plan": light_plan.to_dict() if light_plan else None,
            "calculation_result": calculation_result.to_dict() if calculation_result else None,
            "validation_result": validation_result.to_dict() if validation_result else None
        }
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(package, f, ensure_ascii=False, indent=2)
        
        return package
    
    def export_light_plan_only(
        self,
        light_plan: LightPlan,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        
        data = light_plan.to_dict()
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        
        return data
    
    def export_calculation_result_only(
        self,
        calculation_result: CalculationResult,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        
        data = calculation_result.to_dict()
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        
        return data
    
    def export_validation_result_only(
        self,
        validation_result: ValidationResult,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        
        data = validation_result.to_dict()
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        
        return data
    
    def export_summary(
        self,
        calculation_result: CalculationResult,
        validation_result: Optional[ValidationResult] = None,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        
        summary = {
            "summary": {
                "total_dli": calculation_result.total_dli,
                "natural_dli": calculation_result.total_natural_dli,
                "supplemental_dli": calculation_result.total_supplemental_dli,
                "total_energy_kwh": calculation_result.total_estimated_energy,
                "total_cost": calculation_result.total_estimated_cost,
                "budget_limit": calculation_result.budget_limit,
                "budget_utilization": calculation_result.budget_utilization,
                "budget_status": calculation_result.budget_status,
                "overall_risk_level": calculation_result.overall_risk_level,
                
                "zone_summary": {
                    "total_zones": len(calculation_result.zone_results),
                    "deficient_zones": len(calculation_result.deficient_zones),
                    "excessive_zones": len(calculation_result.excessive_zones),
                    "zones_at_risk": len(calculation_result.zones_at_risk)
                }
            }
        }
        
        if validation_result:
            summary["validation"] = {
                "is_valid": validation_result.is_valid,
                "has_critical": validation_result.has_critical,
                "has_warnings": validation_result.has_warnings,
                "issue_summary": validation_result.issue_summary
            }
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
        
        return summary
    
    def import_calculation_package(
        self,
        filepath: str
    ) -> Dict[str, Any]:
        
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"计算包文件不存在: {filepath}")
        
        with open(path, 'r', encoding='utf-8') as f:
            package = json.load(f)
        
        return package
