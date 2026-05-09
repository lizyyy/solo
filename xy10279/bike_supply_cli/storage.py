import os
import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from dataclasses import asdict
from .models import RunRecord, SupplyStation


class DataStorage:
    def __init__(self, base_dir: str = None):
        if base_dir is None:
            base_dir = os.getcwd()
        self.base_dir = Path(base_dir)
        self.data_dir = self.base_dir / "bike_supply_cli" / "data"
        self.exports_dir = self.base_dir / "bike_supply_cli" / "exports"
        
        self.index_file = self.data_dir / "index.json"
        self.runs_dir = self.data_dir / "runs"
        self.routes_dir = self.data_dir / "routes"
        
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [self.data_dir, self.exports_dir, self.runs_dir, self.routes_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def _load_index(self) -> Dict[str, Any]:
        if self.index_file.exists():
            with open(self.index_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"by_hash": {}, "runs": []}

    def _save_index(self, index: Dict[str, Any]):
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=2)

    def find_existing_run(self, route_hash: str, settings_hash: str) -> Optional[Dict[str, Any]]:
        index = self._load_index()
        key = f"{route_hash}_{settings_hash}"
        
        if key in index.get("by_hash", {}):
            run_id = index["by_hash"][key]
            return self.load_run(run_id)
        return None

    def save_route(self, name: str, raw_points: List[Dict[str, Any]], metadata: Dict[str, Any] = None) -> str:
        from .models import compute_route_hash
        
        route_hash = compute_route_hash(raw_points)
        route_file = self.routes_dir / f"{route_hash}.json"
        
        route_data = {
            "name": name,
            "hash": route_hash,
            "points": raw_points,
            "metadata": metadata or {},
            "saved_at": datetime.now().isoformat()
        }
        
        if not route_file.exists():
            with open(route_file, "w", encoding="utf-8") as f:
                json.dump(route_data, f, ensure_ascii=False, indent=2)
        
        return route_hash

    def load_route(self, route_hash: str) -> Optional[Dict[str, Any]]:
        route_file = self.routes_dir / f"{route_hash}.json"
        if route_file.exists():
            with open(route_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def list_routes(self) -> List[Dict[str, Any]]:
        routes = []
        for f in self.routes_dir.glob("*.json"):
            with open(f, "r", encoding="utf-8") as fp:
                data = json.load(fp)
                routes.append({
                    "name": data.get("name", f.stem),
                    "hash": data.get("hash", f.stem),
                    "point_count": len(data.get("points", [])),
                    "saved_at": data.get("saved_at", "")
                })
        routes.sort(key=lambda r: r.get("saved_at", ""), reverse=True)
        return routes

    def save_run(
        self,
        run_id: str,
        route_name: str,
        route_hash: str,
        settings: Dict[str, Any],
        profile: Dict[str, Any],
        stations: List[SupplyStation],
        totals: Dict[str, Any]
    ) -> RunRecord:
        timestamp = datetime.now().isoformat()
        
        stations_dicts = [
            {
                "id": s.id,
                "name": s.name,
                "distance_km": s.distance_km,
                "elevation": s.elevation,
                "type": s.type,
                "materials": s.materials,
                "reason": s.reason
            }
            for s in stations
        ]
        
        record = RunRecord(
            run_id=run_id,
            timestamp=timestamp,
            route_name=route_name,
            route_hash=route_hash,
            settings=settings,
            profile=profile,
            stations=stations_dicts,
            totals=totals,
            status="completed"
        )
        
        settings_hash = self._hash_settings(settings)
        composite_key = f"{route_hash}_{settings_hash}"
        
        run_file = self.runs_dir / f"{run_id}.json"
        with open(run_file, "w", encoding="utf-8") as f:
            json.dump(asdict(record), f, ensure_ascii=False, indent=2)
        
        index = self._load_index()
        if "by_hash" not in index:
            index["by_hash"] = {}
        
        old_run_id = index["by_hash"].get(composite_key)
        if old_run_id and old_run_id != run_id:
            self._delete_run(old_run_id)
        
        index["by_hash"][composite_key] = run_id
        
        if "runs" not in index:
            index["runs"] = []
        
        index["runs"] = [r for r in index["runs"] if r.get("run_id") != old_run_id]
        index["runs"].append({
            "run_id": run_id,
            "route_name": route_name,
            "route_hash": route_hash,
            "timestamp": timestamp,
            "station_count": len(stations),
            "status": "completed"
        })
        
        self._save_index(index)
        return record

    def _hash_settings(self, settings: Dict[str, Any]) -> str:
        import hashlib
        data = json.dumps(settings, sort_keys=True)
        return hashlib.sha256(data.encode()).hexdigest()[:12]

    def load_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        run_file = self.runs_dir / f"{run_id}.json"
        if run_file.exists():
            with open(run_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def list_runs(self) -> List[Dict[str, Any]]:
        index = self._load_index()
        runs = index.get("runs", [])
        runs.sort(key=lambda r: r.get("timestamp", ""), reverse=True)
        return runs

    def _delete_run(self, run_id: str):
        run_file = self.runs_dir / f"{run_id}.json"
        if run_file.exists():
            run_file.unlink()
        
        json_export = self.exports_dir / f"{run_id}_supply_plan.json"
        if json_export.exists():
            json_export.unlink()
        
        csv_export = self.exports_dir / f"{run_id}_supply_plan.csv"
        if csv_export.exists():
            csv_export.unlink()

    def export_json(self, run_id: str, record: Dict[str, Any]) -> Path:
        export_file = self.exports_dir / f"{run_id}_supply_plan.json"
        with open(export_file, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False, indent=2)
        return export_file

    def export_csv(self, run_id: str, stations: List[Dict[str, Any]], totals: Dict[str, Any]) -> Path:
        export_file = self.exports_dir / f"{run_id}_supply_plan.csv"
        
        with open(export_file, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            
            writer.writerow(["骑行补给站排布计划", f"Run ID: {run_id}"])
            writer.writerow([])
            
            writer.writerow(["汇总统计"])
            writer.writerow(["补给站数量", totals.get("station_count", 0)])
            writer.writerow(["总用水量(L)", totals.get("total_water_liters", 0)])
            writer.writerow(["总食物量(kg)", totals.get("total_food_kg", 0)])
            writer.writerow(["电解质包", totals.get("total_electrolytes_packs", 0)])
            writer.writerow(["能量胶", totals.get("total_energy_gels", 0)])
            writer.writerow([])
            
            writer.writerow([
                "编号", "名称", "位置(km)", "海拔(m)", "类型", 
                "水(L)", "食物(kg)", "电解质", "能量胶", "原因"
            ])
            
            for s in stations:
                mats = s.get("materials", {})
                writer.writerow([
                    s.get("id", ""),
                    s.get("name", ""),
                    s.get("distance_km", 0),
                    s.get("elevation", 0),
                    s.get("type", ""),
                    mats.get("water_liters", 0),
                    mats.get("food_kg", 0),
                    mats.get("electrolytes_packs", 0),
                    mats.get("energy_gels", 0),
                    s.get("reason", "")
                ])
        
        return export_file

    def export_report(self, run_id: str, record: Dict[str, Any]) -> Path:
        export_file = self.exports_dir / f"{run_id}_report.txt"
        
        profile = record.get("profile", {})
        totals = record.get("totals", {})
        stations = record.get("stations", [])
        
        lines = [
            "=" * 60,
            "骑行俱乐部补给站排布报告",
            "=" * 60,
            f"Run ID: {run_id}",
            f"路线: {record.get('route_name', '未知')}",
            f"生成时间: {record.get('timestamp', '未知')}",
            "",
            "-" * 60,
            "一、路线概况",
            "-" * 60,
            f"  总距离: {profile.get('total_distance_km', 0):.2f} km",
            f"  总爬升: {profile.get('total_elevation_gain', 0):.0f} m",
            f"  总下降: {profile.get('total_elevation_loss', 0):.0f} m",
            f"  最高海拔: {profile.get('max_elevation', 0):.0f} m",
            f"  最低海拔: {profile.get('min_elevation', 0):.0f} m",
            f"  爬坡段数: {len(profile.get('climbs', []))}",
            "",
            "-" * 60,
            "二、物资汇总",
            "-" * 60,
            f"  补给站数量: {totals.get('station_count', 0)}",
            f"  总用水量: {totals.get('total_water_liters', 0):.1f} L",
            f"  总食物量: {totals.get('total_food_kg', 0):.1f} kg",
            f"  电解质包: {totals.get('total_electrolytes_packs', 0):.0f}",
            f"  能量胶: {totals.get('total_energy_gels', 0)}",
            "",
            "-" * 60,
            "三、补给站详情",
            "-" * 60,
        ]
        
        for s in stations:
            mats = s.get("materials", {})
            lines.extend([
                "",
                f"  [{s.get('id', '')}] {s.get('name', '')}",
                f"      位置: {s.get('distance_km', 0):.2f} km | 海拔: {s.get('elevation', 0):.0f} m | 类型: {s.get('type', '')}",
                f"      物资: 水 {mats.get('water_liters', 0):.1f}L | 食物 {mats.get('food_kg', 0):.1f}kg | 电解质 {mats.get('electrolytes_packs', 0):.0f} | 能量胶 {mats.get('energy_gels', 0)}",
                f"      原因: {s.get('reason', '')}"
            ])
        
        with open(export_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        
        return export_file

    def get_latest_run(self) -> Optional[str]:
        runs = self.list_runs()
        if runs:
            return runs[0].get("run_id")
        return None
