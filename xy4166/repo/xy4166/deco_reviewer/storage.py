import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .models import (
    DiveLog,
    DiveProfilePoint,
    GasMix,
    GasType,
    SafetyStop,
    DiveAnalysis,
    Violation,
    ViolationType,
    CalculationResult,
    TissueCompartment,
)


class DiveStorage:
    """潜水档案存储管理器"""

    def __init__(self, storage_dir: Optional[Path] = None):
        if storage_dir is None:
            storage_dir = Path.home() / ".deco_reviewer" / "dives"
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save_dive(self, dive_log: DiveLog) -> Path:
        """保存潜水日志"""
        dive_data = self._dive_log_to_dict(dive_log)
        file_path = self.storage_dir / f"{dive_log.dive_id}.json"
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(dive_data, f, ensure_ascii=False, indent=2, default=str)
        
        return file_path

    def save_analysis(self, analysis: DiveAnalysis) -> Path:
        """保存潜水分析结果"""
        analysis_data = self._analysis_to_dict(analysis)
        file_path = self.storage_dir / f"{analysis.dive_log.dive_id}_analysis.json"
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(analysis_data, f, ensure_ascii=False, indent=2, default=str)
        
        return file_path

    def load_dive(self, dive_id: str) -> Optional[DiveLog]:
        """加载潜水日志"""
        file_path = self.storage_dir / f"{dive_id}.json"
        if not file_path.exists():
            return None
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return self._dict_to_dive_log(data)

    def load_analysis(self, dive_id: str) -> Optional[DiveAnalysis]:
        """加载潜水分析结果"""
        file_path = self.storage_dir / f"{dive_id}_analysis.json"
        if not file_path.exists():
            return None
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return self._dict_to_analysis(data)

    def list_dives(self) -> List[Dict[str, Any]]:
        """列出所有保存的潜水"""
        dives = []
        
        for file_path in self.storage_dir.glob("*_analysis.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            dives.append({
                "dive_id": data.get("dive_log", {}).get("dive_id"),
                "diver_name": data.get("dive_log", {}).get("diver_name"),
                "dive_date": data.get("dive_log", {}).get("dive_date"),
                "max_depth": data.get("summary", {}).get("max_depth"),
                "total_time": data.get("summary", {}).get("total_time"),
                "violation_count": len(data.get("violations", [])),
                "critical_count": sum(1 for v in data.get("violations", []) if v.get("severity") == "critical"),
            })
        
        dives.sort(key=lambda x: x.get("dive_date", ""), reverse=True)
        return dives

    def get_latest_dive(self) -> Optional[DiveAnalysis]:
        """获取最新的潜水分析"""
        dives = self.list_dives()
        if not dives:
            return None
        
        latest_dive_id = dives[0]["dive_id"]
        return self.load_analysis(latest_dive_id)

    def delete_dive(self, dive_id: str) -> bool:
        """删除潜水记录"""
        dive_file = self.storage_dir / f"{dive_id}.json"
        analysis_file = self.storage_dir / f"{dive_id}_analysis.json"
        
        deleted = False
        if dive_file.exists():
            dive_file.unlink()
            deleted = True
        if analysis_file.exists():
            analysis_file.unlink()
            deleted = True
        
        return deleted

    def _dive_log_to_dict(self, dive_log: DiveLog) -> Dict[str, Any]:
        """将DiveLog转换为字典"""
        return {
            "dive_id": dive_log.dive_id,
            "diver_name": dive_log.diver_name,
            "dive_date": dive_log.dive_date.isoformat() if dive_log.dive_date else None,
            "start_time": dive_log.start_time.isoformat() if dive_log.start_time else None,
            "end_time": dive_log.end_time.isoformat() if dive_log.end_time else None,
            "profile": [
                {
                    "time": p.time,
                    "depth": p.depth,
                    "temperature": p.temperature,
                }
                for p in dive_log.profile
            ],
            "gas_mix": {
                "gas_type": dive_log.gas_mix.gas_type.value,
                "o2_percent": dive_log.gas_mix.o2_percent,
                "n2_percent": dive_log.gas_mix.n2_percent,
                "he_percent": dive_log.gas_mix.he_percent,
            },
            "safety_stops": [
                {
                    "depth": s.depth,
                    "duration": s.duration,
                }
                for s in dive_log.safety_stops
            ],
            "surface_interval_minutes": dive_log.surface_interval_minutes,
        }

    def _analysis_to_dict(self, analysis: DiveAnalysis) -> Dict[str, Any]:
        """将DiveAnalysis转换为字典"""
        return {
            "dive_log": self._dive_log_to_dict(analysis.dive_log),
            "calculation_result": {
                "current_ndl": analysis.calculation_result.current_ndl,
                "max_ndl": analysis.calculation_result.max_ndl,
                "cns_percentage": analysis.calculation_result.cns_percentage,
                "otu_value": analysis.calculation_result.otu_value,
                "leading_compartment": analysis.calculation_result.leading_compartment,
                "m_value_ratio": analysis.calculation_result.m_value_ratio,
                "tissue_compartments": [
                    {
                        "compartment_id": c.compartment_id,
                        "current_p_n2": c.current_p_n2,
                        "current_p_he": c.current_p_he,
                        "n2_half_time": c.n2_half_time,
                    }
                    for c in analysis.calculation_result.tissue_compartments
                ],
            },
            "violations": [
                {
                    "violation_type": v.violation_type.value,
                    "severity": v.severity,
                    "message": v.message,
                    "details": v.details,
                    "time_point": v.time_point,
                }
                for v in analysis.violations
            ],
            "summary": analysis.summary,
            "generated_at": datetime.now().isoformat(),
        }

    def _dict_to_dive_log(self, data: Dict[str, Any]) -> DiveLog:
        """将字典转换为DiveLog"""
        gas_mix_data = data.get("gas_mix", {})
        gas_type = GasType(gas_mix_data.get("gas_type", "air"))
        
        return DiveLog(
            dive_id=data.get("dive_id", ""),
            diver_name=data.get("diver_name", ""),
            dive_date=datetime.fromisoformat(data["dive_date"]) if data.get("dive_date") else datetime.now(),
            start_time=datetime.fromisoformat(data["start_time"]) if data.get("start_time") else None,
            end_time=datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None,
            profile=[
                DiveProfilePoint(
                    time=p.get("time", 0),
                    depth=p.get("depth", 0.0),
                    temperature=p.get("temperature"),
                )
                for p in data.get("profile", [])
            ],
            gas_mix=GasMix(
                gas_type=gas_type,
                o2_percent=gas_mix_data.get("o2_percent", 21.0),
                n2_percent=gas_mix_data.get("n2_percent", 79.0),
                he_percent=gas_mix_data.get("he_percent", 0.0),
            ),
            safety_stops=[
                SafetyStop(
                    depth=s.get("depth", 0.0),
                    duration=s.get("duration", 0),
                )
                for s in data.get("safety_stops", [])
            ],
            surface_interval_minutes=data.get("surface_interval_minutes"),
        )

    def _dict_to_analysis(self, data: Dict[str, Any]) -> DiveAnalysis:
        """将字典转换为DiveAnalysis"""
        dive_log = self._dict_to_dive_log(data.get("dive_log", {}))
        
        calc_data = data.get("calculation_result", {})
        calculation_result = CalculationResult(
            tissue_compartments=[
                TissueCompartment(
                    compartment_id=c.get("compartment_id", i + 1),
                    n2_half_time=c.get("n2_half_time", 5.0),
                    n2_a=0.0,
                    n2_b=0.0,
                    current_p_n2=c.get("current_p_n2", 0.79),
                    current_p_he=c.get("current_p_he", 0.0),
                )
                for i, c in enumerate(calc_data.get("tissue_compartments", []))
            ],
            current_ndl=calc_data.get("current_ndl"),
            max_ndl=calc_data.get("max_ndl", 0),
            cns_percentage=calc_data.get("cns_percentage", 0.0),
            otu_value=calc_data.get("otu_value", 0.0),
            leading_compartment=calc_data.get("leading_compartment", 1),
            m_value_ratio=calc_data.get("m_value_ratio", 0.0),
        )
        
        violations = [
            Violation(
                violation_type=ViolationType(v.get("violation_type", "ndl_exceeded")),
                severity=v.get("severity", "warning"),
                message=v.get("message", ""),
                details=v.get("details", {}),
                time_point=v.get("time_point"),
            )
            for v in data.get("violations", [])
        ]
        
        return DiveAnalysis(
            dive_log=dive_log,
            calculation_result=calculation_result,
            violations=violations,
            summary=data.get("summary", {}),
        )
