import json
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GridParser:
    """街区网格边界解析器"""
    
    REQUIRED_FIELDS = {
        "grid_id": "网格编号",
        "grid_name": "网格名称",
        "area": "区域面积(平方公里)",
        "population": "人口数量",
        "zone_type": "区域类型",
        "boundary": "边界坐标"
    }
    
    FIELD_MAPPINGS = {
        "id": "grid_id",
        "网格id": "grid_id",
        "网格编号": "grid_id",
        "区块编号": "grid_id",
        "name": "grid_name",
        "名称": "grid_name",
        "网格名称": "grid_name",
        "区块名称": "grid_name",
        "面积": "area",
        "区域面积": "area",
        "平方公里": "area",
        "人口": "population",
        "人口数量": "population",
        "类型": "zone_type",
        "区域类型": "zone_type",
        "功能区类型": "zone_type",
        "边界": "boundary",
        "边界坐标": "boundary",
        "多边形": "boundary",
        "geometry": "boundary"
    }
    
    VALID_ZONE_TYPES = [
        "居住区",
        "商业区",
        "工业区",
        "文教区",
        "医疗区",
        "交通枢纽",
        "绿地",
        "混合区",
        "其他"
    ]
    
    def __init__(self):
        self.raw_data: Optional[List[Dict]] = None
        self.parsed_data: Optional[pd.DataFrame] = None
        self.boundaries: Dict[str, List[Tuple[float, float]]] = {}
        self.validation_errors: Dict[str, Any] = {
            "missing_fields": [],
            "invalid_records": [],
            "warnings": []
        }
    
    def parse(self, file_path: Path) -> pd.DataFrame:
        """
        解析街区网格文件
        
        Args:
            file_path: 文件路径（支持 GeoJSON、JSON）
            
        Returns:
            解析后的 DataFrame
        """
        logger.info(f"开始解析街区网格文件: {file_path}")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            if self._is_geojson(data):
                self.raw_data = self._parse_geojson(data)
            else:
                if isinstance(data, dict):
                    if "data" in data:
                        self.raw_data = data["data"]
                    elif "grids" in data:
                        self.raw_data = data["grids"]
                    elif "features" in data:
                        self.raw_data = self._parse_geojson_features(data["features"])
                    else:
                        self.raw_data = [data]
                else:
                    self.raw_data = data
            
            logger.info(f"读取原始数据: {len(self.raw_data)} 个网格")
        except Exception as e:
            logger.error(f"读取文件失败: {e}")
            raise ValueError(f"无法读取街区网格文件: {e}")
        
        normalized_data = self._normalize_records()
        self.parsed_data = pd.DataFrame(normalized_data)
        
        self._validate_and_clean()
        
        return self.parsed_data
    
    def _is_geojson(self, data: Dict) -> bool:
        """检查是否为 GeoJSON 格式"""
        if not isinstance(data, dict):
            return False
        return data.get("type") == "FeatureCollection" and "features" in data
    
    def _parse_geojson(self, data: Dict) -> List[Dict]:
        """解析 GeoJSON 格式"""
        features = data.get("features", [])
        return self._parse_geojson_features(features)
    
    def _parse_geojson_features(self, features: List[Dict]) -> List[Dict]:
        """解析 GeoJSON features"""
        grids = []
        for feature in features:
            if not isinstance(feature, dict):
                continue
            
            properties = feature.get("properties", {})
            geometry = feature.get("geometry", {})
            
            grid_data = {**properties}
            
            if geometry:
                grid_data["boundary"] = self._extract_coordinates(geometry)
            
            grids.append(grid_data)
        
        return grids
    
    def _extract_coordinates(self, geometry: Dict) -> List[Tuple[float, float]]:
        """从几何对象中提取坐标"""
        geom_type = geometry.get("type", "")
        coordinates = geometry.get("coordinates", [])
        
        if geom_type == "Point":
            return [tuple(coordinates)] if coordinates else []
        elif geom_type == "LineString":
            return [tuple(coord) for coord in coordinates] if coordinates else []
        elif geom_type == "Polygon":
            if coordinates and len(coordinates) > 0:
                return [tuple(coord) for coord in coordinates[0]]
            return []
        elif geom_type == "MultiPolygon":
            all_coords = []
            for polygon in coordinates:
                if polygon and len(polygon) > 0:
                    all_coords.extend([tuple(coord) for coord in polygon[0]])
            return all_coords
        
        return []
    
    def _normalize_records(self) -> List[Dict]:
        """标准化记录字段"""
        if not self.raw_data:
            return []
        
        normalized = []
        for record in self.raw_data:
            if not isinstance(record, dict):
                continue
            
            new_record = {}
            for key, value in record.items():
                key_stripped = str(key).strip()
                if key_stripped in self.FIELD_MAPPINGS:
                    mapped_key = self.FIELD_MAPPINGS[key_stripped]
                    new_record[mapped_key] = value
                elif key_stripped in self.REQUIRED_FIELDS:
                    new_record[key_stripped] = value
            
            normalized.append(new_record)
        
        return normalized
    
    def _validate_and_clean(self):
        """验证并清洗数据"""
        if self.parsed_data is None or self.parsed_data.empty:
            return
        
        df = self.parsed_data
        
        for col in ["area", "population"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
        
        if "zone_type" in df.columns:
            df["zone_type"] = df["zone_type"].astype(str).str.strip()
            unknown_types = df[
                ~df["zone_type"].isin(self.VALID_ZONE_TYPES + ["nan"])
            ].shape[0]
            if unknown_types > 0:
                self.validation_errors["warnings"].append(
                    f"{unknown_types} 个网格区域类型不在预定义列表中"
                )
        
        if "boundary" in df.columns:
            for idx, row in df.iterrows():
                grid_id = row.get("grid_id", idx)
                boundary = row["boundary"]
                
                if isinstance(boundary, str):
                    try:
                        boundary = json.loads(boundary)
                    except:
                        pass
                
                if isinstance(boundary, list):
                    coords = []
                    for coord in boundary:
                        if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                            try:
                                coords.append((float(coord[0]), float(coord[1])))
                            except:
                                pass
                    self.boundaries[str(grid_id)] = coords
                else:
                    self.boundaries[str(grid_id)] = []
        
        self.parsed_data = df
        logger.info(f"网格数据验证清洗完成，共 {len(df)} 个网格")
    
    def get_boundary(self, grid_id: str) -> List[Tuple[float, float]]:
        """获取指定网格的边界坐标"""
        return self.boundaries.get(str(grid_id), [])
    
    def get_grid_centroid(self, grid_id: str) -> Optional[Tuple[float, float]]:
        """计算网格质心"""
        boundary = self.get_boundary(grid_id)
        if not boundary or len(boundary) < 3:
            return None
        
        lats = [coord[1] for coord in boundary]
        lons = [coord[0] for coord in boundary]
        
        return (sum(lons) / len(lons), sum(lats) / len(lats))
    
    def get_zone_type_stats(self) -> pd.DataFrame:
        """按区域类型统计"""
        if self.parsed_data is None or self.parsed_data.empty:
            return pd.DataFrame()
        
        stats = self.parsed_data.groupby("zone_type").agg({
            "grid_id": "count",
            "area": ["sum", "mean"],
            "population": ["sum", "mean"]
        }).round(2)
        
        stats.columns = ["_".join(col).strip() for col in stats.columns.values]
        stats = stats.rename(columns={
            "grid_id_count": "grid_count",
            "area_sum": "total_area",
            "area_mean": "avg_area",
            "population_sum": "total_population",
            "population_mean": "avg_population"
        })
        
        return stats
    
    def get_validation_report(self) -> Dict[str, Any]:
        """获取验证报告"""
        return {
            "total_grids": len(self.raw_data) if self.raw_data else 0,
            "valid_grids": len(self.parsed_data) if self.parsed_data is not None else 0,
            "errors": self.validation_errors,
            "columns": list(self.parsed_data.columns) if self.parsed_data is not None else [],
            "zone_types": self.parsed_data["zone_type"].unique().tolist() if self.parsed_data is not None else []
        }
