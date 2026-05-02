"""瓦片索引与地理范围管理模块"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import mercantile
from geojson import Feature, FeatureCollection

from .utils import calculate_file_hash, load_json, save_json


@dataclass
class TileInfo:
    """瓦片信息"""
    z: int
    x: int
    y: int
    file_path: Optional[Path] = None
    hash: Optional[str] = None
    size: int = 0

    @property
    def key(self) -> Tuple[int, int, int]:
        return (self.z, self.x, self.y)

    @property
    def tile_id(self) -> str:
        return f"{self.z}/{self.x}/{self.y}"


@dataclass
class ParcelInfo:
    """地块信息"""
    parcel_id: str
    name: str
    version: str
    geojson_path: Path
    hash: str
    bounding_box: Tuple[float, float, float, float]  # min_lon, min_lat, max_lon, max_lat
    geometry: Dict[str, Any]
    required_zoom_levels: List[int] = field(default_factory=lambda: [14, 15, 16, 17, 18])

    @property
    def parcel_key(self) -> str:
        return f"{self.parcel_id}_v{self.version}"


@dataclass
class TaskInfo:
    """任务信息"""
    task_id: str
    name: str
    status: str  # pending, in_progress, completed, rolled_back
    assigned_terminal: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    parcel_ids: List[str] = field(default_factory=list)
    version: str = "1.0.0"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RollbackPackage:
    """回滚包信息"""
    package_id: str
    version: str
    created_at: datetime
    file_path: Path
    hash: str
    size: int
    affected_parcels: List[str] = field(default_factory=list)


class TileIndexManager:
    """瓦片索引管理器"""

    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.tile_cache: Dict[Tuple[int, int, int], TileInfo] = {}
        self.parcels: Dict[str, ParcelInfo] = {}
        self.tasks: Dict[str, TaskInfo] = {}
        self.rollback_packages: Dict[str, RollbackPackage] = {}
        self.index_file = work_dir / ".sync_index" / "tile_index.json"

    def scan_tiles(self, tiles_dir: Path, zoom_levels: Optional[List[int]] = None) -> int:
        """
        扫描瓦片目录并建立索引
        
        Args:
            tiles_dir: 瓦片目录，结构应为 tiles_dir/z/x/y.png
            zoom_levels: 可选的缩放级别过滤列表
        
        Returns:
            扫描到的瓦片数量
        """
        if not tiles_dir.exists():
            return 0

        tile_count = 0
        for z_dir in tiles_dir.iterdir():
            if not z_dir.is_dir():
                continue
            try:
                z = int(z_dir.name)
            except ValueError:
                continue
            if zoom_levels and z not in zoom_levels:
                continue

            for x_dir in z_dir.iterdir():
                if not x_dir.is_dir():
                    continue
                try:
                    x = int(x_dir.name)
                except ValueError:
                    continue

                for tile_file in x_dir.iterdir():
                    if not tile_file.is_file():
                        continue
                    # 支持 .png, .jpg, .webp, .pbf 等格式
                    if tile_file.suffix.lower() not in [".png", ".jpg", ".jpeg", ".webp", ".pbf", ".mbtiles"]:
                        continue
                    try:
                        y = int(tile_file.stem)
                    except ValueError:
                        continue

                    tile_key = (z, x, y)
                    tile_info = TileInfo(
                        z=z,
                        x=x,
                        y=y,
                        file_path=tile_file,
                        hash=calculate_file_hash(tile_file),
                        size=tile_file.stat().st_size
                    )
                    self.tile_cache[tile_key] = tile_info
                    tile_count += 1

        return tile_count

    def scan_parcels(self, parcels_dir: Path) -> int:
        """
        扫描地块GeoJSON目录
        
        预期格式：
        - 每个地块一个GeoJSON文件
        - properties 包含: parcel_id, name, version
        """
        if not parcels_dir.exists():
            return 0

        parcel_count = 0
        for geojson_file in parcels_dir.glob("**/*.geojson"):
            try:
                data = load_json(geojson_file)
                
                # 支持 FeatureCollection 和单个 Feature
                if data.get("type") == "FeatureCollection":
                    features = data.get("features", [])
                else:
                    features = [data]

                for feature in features:
                    props = feature.get("properties", {})
                    geometry = feature.get("geometry", {})

                    if not geometry:
                        continue

                    parcel_id = props.get("parcel_id", f"parcel_{parcel_count}")
                    name = props.get("name", f"地块 {parcel_count + 1}")
                    version = props.get("version", "1.0.0")

                    # 计算边界框
                    bbox = self._calculate_bbox(geometry)

                    parcel_info = ParcelInfo(
                        parcel_id=parcel_id,
                        name=name,
                        version=version,
                        geojson_path=geojson_file,
                        hash=calculate_file_hash(geojson_file),
                        bounding_box=bbox,
                        geometry=geometry,
                        required_zoom_levels=props.get("required_zoom_levels", [14, 15, 16, 17, 18])
                    )

                    self.parcels[parcel_info.parcel_key] = parcel_info
                    parcel_count += 1

            except Exception as e:
                print(f"警告: 解析 {geojson_file} 时出错: {e}")
                continue

        return parcel_count

    def scan_tasks(self, tasks_dir: Path) -> int:
        """
        扫描任务清单目录
        
        预期格式：
        - JSON文件包含任务列表
        - 每个任务包含: task_id, name, status, parcel_ids, version
        """
        if not tasks_dir.exists():
            return 0

        task_count = 0
        for task_file in tasks_dir.glob("**/*.json"):
            try:
                data = load_json(task_file)
                
                # 支持列表或单个任务对象
                tasks = data if isinstance(data, list) else [data]

                for task_data in tasks:
                    task_id = task_data.get("task_id", f"task_{task_count}")
                    
                    created_at = None
                    if "created_at" in task_data:
                        try:
                            created_at = datetime.fromisoformat(task_data["created_at"])
                        except ValueError:
                            pass

                    updated_at = None
                    if "updated_at" in task_data:
                        try:
                            updated_at = datetime.fromisoformat(task_data["updated_at"])
                        except ValueError:
                            pass

                    task_info = TaskInfo(
                        task_id=task_id,
                        name=task_data.get("name", f"任务 {task_count + 1}"),
                        status=task_data.get("status", "pending"),
                        assigned_terminal=task_data.get("assigned_terminal"),
                        created_at=created_at,
                        updated_at=updated_at,
                        parcel_ids=task_data.get("parcel_ids", []),
                        version=task_data.get("version", "1.0.0"),
                        metadata=task_data.get("metadata", {})
                    )

                    self.tasks[task_id] = task_info
                    task_count += 1

            except Exception as e:
                print(f"警告: 解析 {task_file} 时出错: {e}")
                continue

        return task_count

    def scan_rollback_packages(self, rollback_dir: Path) -> int:
        """
        扫描回滚包目录
        """
        if not rollback_dir.exists():
            return 0

        package_count = 0
        for pkg_file in rollback_dir.glob("**/*"):
            if not pkg_file.is_file():
                continue
            if pkg_file.suffix.lower() not in [".zip", ".tar", ".tar.gz", ".json"]:
                continue

            try:
                # 尝试读取元数据
                meta_file = pkg_file.with_suffix(".meta.json")
                if meta_file.exists():
                    meta = load_json(meta_file)
                else:
                    meta = {}

                package_id = meta.get("package_id", f"rollback_{package_count}")
                created_at = None
                if "created_at" in meta:
                    try:
                        created_at = datetime.fromisoformat(meta["created_at"])
                    except ValueError:
                        created_at = datetime.fromtimestamp(pkg_file.stat().st_mtime)
                else:
                    created_at = datetime.fromtimestamp(pkg_file.stat().st_mtime)

                pkg = RollbackPackage(
                    package_id=package_id,
                    version=meta.get("version", "1.0.0"),
                    created_at=created_at,
                    file_path=pkg_file,
                    hash=calculate_file_hash(pkg_file),
                    size=pkg_file.stat().st_size,
                    affected_parcels=meta.get("affected_parcels", [])
                )

                self.rollback_packages[package_id] = pkg
                package_count += 1

            except Exception as e:
                print(f"警告: 处理回滚包 {pkg_file} 时出错: {e}")
                continue

        return package_count

    def calculate_required_tiles(self, parcel: ParcelInfo) -> Set[Tuple[int, int, int]]:
        """
        计算地块所需的瓦片集合
        
        根据GeoJSON的几何形状和所需缩放级别，计算所有应该存在的瓦片
        """
        required_tiles = set()
        min_lon, min_lat, max_lon, max_lat = parcel.bounding_box

        for z in parcel.required_zoom_levels:
            # 使用 mercantile 计算边界框内的所有瓦片
            tiles = list(mercantile.tiles(min_lon, min_lat, max_lon, max_lat, [z]))
            for tile in tiles:
                required_tiles.add((tile.z, tile.x, tile.y))

        return required_tiles

    def get_missing_tiles(self, parcel: ParcelInfo) -> Set[Tuple[int, int, int]]:
        """获取地块缺失的瓦片"""
        required = self.calculate_required_tiles(parcel)
        available = set(self.tile_cache.keys())
        return required - available

    def get_coverage_stats(self, parcel: ParcelInfo) -> Dict[str, Any]:
        """获取地块瓦片覆盖率统计"""
        required = self.calculate_required_tiles(parcel)
        available = set(self.tile_cache.keys()) & required
        missing = required - available

        total = len(required)
        if total == 0:
            coverage = 100.0
        else:
            coverage = (len(available) / total) * 100

        return {
            "parcel_id": parcel.parcel_id,
            "parcel_name": parcel.name,
            "version": parcel.version,
            "total_tiles": total,
            "available_tiles": len(available),
            "missing_tiles": len(missing),
            "coverage_percent": round(coverage, 2),
            "missing_tile_list": [f"{z}/{x}/{y}" for z, x, y in sorted(missing)]
        }

    def save_index(self) -> None:
        """保存索引到文件"""
        index_data = {
            "generated_at": datetime.now().isoformat(),
            "tiles": {
                f"{z}/{x}/{y}": {
                    "z": z,
                    "x": x,
                    "y": y,
                    "hash": info.hash,
                    "size": info.size,
                    "file_path": str(info.file_path) if info.file_path else None
                }
                for (z, x, y), info in self.tile_cache.items()
            },
            "parcels": {
                key: {
                    "parcel_id": p.parcel_id,
                    "name": p.name,
                    "version": p.version,
                    "hash": p.hash,
                    "bounding_box": p.bounding_box,
                    "required_zoom_levels": p.required_zoom_levels,
                    "geojson_path": str(p.geojson_path)
                }
                for key, p in self.parcels.items()
            },
            "tasks": {
                task_id: {
                    "task_id": t.task_id,
                    "name": t.name,
                    "status": t.status,
                    "assigned_terminal": t.assigned_terminal,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                    "updated_at": t.updated_at.isoformat() if t.updated_at else None,
                    "parcel_ids": t.parcel_ids,
                    "version": t.version
                }
                for task_id, t in self.tasks.items()
            },
            "rollback_packages": {
                pkg_id: {
                    "package_id": pkg.package_id,
                    "version": pkg.version,
                    "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
                    "hash": pkg.hash,
                    "size": pkg.size,
                    "file_path": str(pkg.file_path),
                    "affected_parcels": pkg.affected_parcels
                }
                for pkg_id, pkg in self.rollback_packages.items()
            }
        }

        save_json(index_data, self.index_file)

    def load_index(self) -> bool:
        """从文件加载索引"""
        if not self.index_file.exists():
            return False

        try:
            data = load_json(self.index_file)
            
            # 加载瓦片
            for tile_id, tile_data in data.get("tiles", {}).items():
                z, x, y = map(int, tile_id.split("/"))
                key = (z, x, y)
                self.tile_cache[key] = TileInfo(
                    z=z,
                    x=x,
                    y=y,
                    file_path=Path(tile_data["file_path"]) if tile_data.get("file_path") else None,
                    hash=tile_data.get("hash"),
                    size=tile_data.get("size", 0)
                )

            # 加载地块
            for key, parcel_data in data.get("parcels", {}).items():
                self.parcels[key] = ParcelInfo(
                    parcel_id=parcel_data["parcel_id"],
                    name=parcel_data["name"],
                    version=parcel_data["version"],
                    geojson_path=Path(parcel_data["geojson_path"]),
                    hash=parcel_data["hash"],
                    bounding_box=tuple(parcel_data["bounding_box"]),
                    geometry={},  # 不从索引加载完整几何
                    required_zoom_levels=parcel_data.get("required_zoom_levels", [14, 15, 16, 17, 18])
                )

            # 加载任务
            for task_id, task_data in data.get("tasks", {}).items():
                created_at = None
                if task_data.get("created_at"):
                    try:
                        created_at = datetime.fromisoformat(task_data["created_at"])
                    except ValueError:
                        pass

                updated_at = None
                if task_data.get("updated_at"):
                    try:
                        updated_at = datetime.fromisoformat(task_data["updated_at"])
                    except ValueError:
                        pass

                self.tasks[task_id] = TaskInfo(
                    task_id=task_data["task_id"],
                    name=task_data["name"],
                    status=task_data["status"],
                    assigned_terminal=task_data.get("assigned_terminal"),
                    created_at=created_at,
                    updated_at=updated_at,
                    parcel_ids=task_data.get("parcel_ids", []),
                    version=task_data.get("version", "1.0.0")
                )

            # 加载回滚包
            for pkg_id, pkg_data in data.get("rollback_packages", {}).items():
                created_at = None
                if pkg_data.get("created_at"):
                    try:
                        created_at = datetime.fromisoformat(pkg_data["created_at"])
                    except ValueError:
                        pass

                self.rollback_packages[pkg_id] = RollbackPackage(
                    package_id=pkg_data["package_id"],
                    version=pkg_data.get("version", "1.0.0"),
                    created_at=created_at,
                    file_path=Path(pkg_data["file_path"]),
                    hash=pkg_data["hash"],
                    size=pkg_data.get("size", 0),
                    affected_parcels=pkg_data.get("affected_parcels", [])
                )

            return True

        except Exception as e:
            print(f"警告: 加载索引时出错: {e}")
            return False

    def _calculate_bbox(self, geometry: Dict[str, Any]) -> Tuple[float, float, float, float]:
        """
        计算几何形状的边界框
        返回: (min_lon, min_lat, max_lon, max_lat)
        """
        all_coords = []
        geom_type = geometry.get("type")
        coords = geometry.get("coordinates", [])

        def flatten_coords(c: Any) -> None:
            if isinstance(c, (list, tuple)):
                if len(c) >= 2 and all(isinstance(x, (int, float)) for x in c[:2]):
                    all_coords.append((c[0], c[1]))
                else:
                    for item in c:
                        flatten_coords(item)

        flatten_coords(coords)

        if not all_coords:
            return (0.0, 0.0, 0.0, 0.0)

        lons = [c[0] for c in all_coords]
        lats = [c[1] for c in all_coords]

        return (min(lons), min(lats), max(lons), max(lats))
