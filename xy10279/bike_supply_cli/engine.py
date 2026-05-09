import json
import uuid
from typing import Dict, Any, Optional
from pathlib import Path
from .models import Weather, ParticipantGroup, compute_route_hash
from .climb_calculator import ClimbCalculator
from .supply_planner import SupplyPlanner
from .storage import DataStorage


class SupplyEngine:
    def __init__(self, base_dir: str = None):
        self.storage = DataStorage(base_dir)

    def load_route_file(self, file_path: str) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        ext = path.suffix.lower()
        
        if ext == ".json":
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if isinstance(data, list):
                return {"name": path.stem, "points": data}
            elif isinstance(data, dict):
                return data
            else:
                raise ValueError("JSON 格式错误")
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def process(
        self,
        route_name: str,
        raw_points: list,
        weather: Dict[str, Any] = None,
        participants: Dict[str, Any] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        weather_data = weather or {}
        participants_data = participants or {}
        
        w = Weather(
            temperature=float(weather_data.get("temperature", 20.0)),
            humidity=float(weather_data.get("humidity", 60.0)),
            wind_speed_kmh=float(weather_data.get("wind_speed_kmh", 10.0)),
            precipitation=float(weather_data.get("precipitation", 0.0)),
            uv_index=float(weather_data.get("uv_index", 5.0))
        )
        
        p = ParticipantGroup(
            level=str(participants_data.get("level", "intermediate")),
            count=int(participants_data.get("count", 20)),
            avg_speed_kmh=float(participants_data.get("avg_speed_kmh", 20.0)),
            water_per_person_per_hour=float(participants_data.get("water_per_person_per_hour", 0.75)),
            food_per_person_per_hour=float(participants_data.get("food_per_person_per_hour", 0.15))
        )
        
        settings = {
            "weather": {
                "temperature": w.temperature,
                "humidity": w.humidity,
                "wind_speed_kmh": w.wind_speed_kmh,
                "precipitation": w.precipitation,
                "uv_index": w.uv_index
            },
            "participants": {
                "level": p.level,
                "count": p.count,
                "avg_speed_kmh": p.avg_speed_kmh
            }
        }
        
        route_hash = compute_route_hash(raw_points)
        settings_hash = self.storage._hash_settings(settings)
        
        if not force:
            existing = self.storage.find_existing_run(route_hash, settings_hash)
            if existing:
                return {
                    "run_id": existing["run_id"],
                    "cached": True,
                    "record": existing
                }
        
        self.storage.save_route(route_name, raw_points, {})
        
        gpx_points = ClimbCalculator.process_points(raw_points)
        profile = ClimbCalculator.calculate_profile(gpx_points)
        profile_dict = ClimbCalculator.profile_to_dict(profile)
        
        planner = SupplyPlanner(gpx_points, profile, w, p)
        stations, totals = planner.plan()
        
        run_id = self._generate_run_id()
        record = self.storage.save_run(
            run_id=run_id,
            route_name=route_name,
            route_hash=route_hash,
            settings=settings,
            profile=profile_dict,
            stations=stations,
            totals=totals
        )
        
        return {
            "run_id": run_id,
            "cached": False,
            "record": record,
            "stations": stations,
            "profile": profile_dict,
            "totals": totals
        }

    def _generate_run_id(self) -> str:
        return f"run_{uuid.uuid4().hex[:8]}"

    def export_results(self, run_id: str = None, formats: list = None) -> Dict[str, str]:
        if run_id is None:
            run_id = self.storage.get_latest_run()
            if run_id is None:
                raise ValueError("没有可导出的运行记录")
        
        record = self.storage.load_run(run_id)
        if record is None:
            raise ValueError(f"找不到运行记录: {run_id}")
        
        formats = formats or ["json", "csv", "report"]
        outputs = {}
        
        if "json" in formats:
            path = self.storage.export_json(run_id, record)
            outputs["json"] = str(path)
        
        if "csv" in formats:
            path = self.storage.export_csv(run_id, record.get("stations", []), record.get("totals", {}))
            outputs["csv"] = str(path)
        
        if "report" in formats:
            path = self.storage.export_report(run_id, record)
            outputs["report"] = str(path)
        
        return outputs

    def get_history(self, limit: int = None) -> list:
        runs = self.storage.list_runs()
        if limit:
            runs = runs[:limit]
        return runs

    def get_run_details(self, run_id: str) -> Optional[Dict[str, Any]]:
        return self.storage.load_run(run_id)

    def validate_route(self, raw_points: list) -> Dict[str, Any]:
        errors = []
        warnings = []
        
        if not raw_points:
            errors.append("路线点为空")
            return {"valid": False, "errors": errors, "warnings": warnings}
        
        if len(raw_points) < 5:
            warnings.append("路线点数量较少 (<5)，计算精度可能受限")
        
        has_elevation = False
        for p in raw_points:
            ele = p.get("elevation", p.get("ele"))
            if ele is not None and ele != 0:
                has_elevation = True
                break
        
        if not has_elevation:
            warnings.append("未检测到海拔数据，爬升计算将无法进行")
        
        try:
            gpx_points = ClimbCalculator.process_points(raw_points)
            profile = ClimbCalculator.calculate_profile(gpx_points)
            
            if profile.total_distance_km < 1:
                warnings.append("路线总距离过短 (<1km)")
        except Exception as e:
            errors.append(f"路线处理失败: {e}")
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
