import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, Tuple, List
import math
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CoordinateProcessor:
    """坐标格式转换器"""
    
    EARTH_RADIUS = 6371.0
    
    CHINA_BOUNDS = {
        "min_lon": 73.5,
        "max_lon": 135.0,
        "min_lat": 18.0,
        "max_lat": 53.5
    }
    
    def __init__(self):
        self.conversion_stats: Dict[str, Any] = {
            "total_coordinates": 0,
            "valid_coordinates": 0,
            "invalid_coordinates": 0,
            "converted_count": 0,
            "outliers": []
        }
    
    def parse_coordinate(
        self,
        value: Any,
        coord_type: str = "lon"
    ) -> Optional[float]:
        """
        解析多种坐标格式
        
        Args:
            value: 坐标值
            coord_type: 'lon' 或 'lat'
            
        Returns:
            解析后的浮点坐标，失败返回 None
        """
        if pd.isna(value) or value is None:
            return None
        
        if isinstance(value, (int, float)):
            return float(value)
        
        value_str = str(value).strip()
        
        value_str = value_str.replace("°", " ").replace("'", " ").replace('"', " ")
        value_str = value_str.replace("E", " ").replace("W", " ").replace("N", " ").replace("S", " ")
        value_str = value_str.replace("东经", " ").replace("西经", " ")
        value_str = value_str.replace("北纬", " ").replace("南纬", " ")
        
        try:
            parts = value_str.split()
            if len(parts) >= 3:
                degrees = float(parts[0])
                minutes = float(parts[1])
                seconds = float(parts[2]) if len(parts) > 2 else 0.0
                result = degrees + minutes / 60 + seconds / 3600
                return result
            elif len(parts) == 2:
                degrees = float(parts[0])
                minutes = float(parts[1])
                result = degrees + minutes / 60
                return result
            else:
                return float(value_str.replace(",", ""))
        except:
            try:
                return float(value_str.replace(",", ""))
            except:
                return None
    
    def parse_coordinate_pair(
        self,
        lon_value: Any,
        lat_value: Any
    ) -> Tuple[Optional[float], Optional[float]]:
        """
        解析经纬度对
        
        Args:
            lon_value: 经度值
            lat_value: 纬度值
            
        Returns:
            (经度, 纬度) 元组
        """
        lon = self.parse_coordinate(lon_value, "lon")
        lat = self.parse_coordinate(lat_value, "lat")
        
        return lon, lat
    
    def validate_coordinate(
        self,
        lon: Optional[float],
        lat: Optional[float],
        bounds: Optional[Dict] = None
    ) -> Tuple[bool, List[str]]:
        """
        验证坐标有效性
        
        Args:
            lon: 经度
            lat: 纬度
            bounds: 边界范围，默认使用中国范围
            
        Returns:
            (是否有效, 错误列表)
        """
        errors = []
        
        if lon is None or pd.isna(lon):
            errors.append("经度缺失")
        else:
            if bounds is None:
                bounds = self.CHINA_BOUNDS
            if lon < bounds["min_lon"] or lon > bounds["max_lon"]:
                errors.append(f"经度超出有效范围 ({bounds['min_lon']} - {bounds['max_lon']})")
        
        if lat is None or pd.isna(lat):
            errors.append("纬度缺失")
        else:
            if bounds is None:
                bounds = self.CHINA_BOUNDS
            if lat < bounds["min_lat"] or lat > bounds["max_lat"]:
                errors.append(f"纬度超出有效范围 ({bounds['min_lat']} - {bounds['max_lat']})")
        
        return len(errors) == 0, errors
    
    def process_coordinates(
        self,
        df: pd.DataFrame,
        lon_col: str = "longitude",
        lat_col: str = "latitude",
        drop_invalid: bool = False,
        bounds: Optional[Dict] = None
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        处理 DataFrame 中的坐标列
        
        Args:
            df: 数据 DataFrame
            lon_col: 经度列名
            lat_col: 纬度列名
            drop_invalid: 是否删除无效坐标行
            bounds: 坐标边界范围
            
        Returns:
            (处理后的 DataFrame, 统计信息)
        """
        stats = {
            "total": len(df),
            "valid": 0,
            "invalid": 0,
            "missing": 0,
            "out_of_bounds": 0,
            "dropped": 0
        }
        
        result_df = df.copy()
        
        if lon_col in result_df.columns:
            result_df[lon_col] = result_df[lon_col].apply(
                lambda x: self.parse_coordinate(x, "lon")
            )
        
        if lat_col in result_df.columns:
            result_df[lat_col] = result_df[lat_col].apply(
                lambda x: self.parse_coordinate(x, "lat")
            )
        
        valid_mask = []
        for idx, row in result_df.iterrows():
            lon = row.get(lon_col)
            lat = row.get(lat_col)
            
            if pd.isna(lon) or pd.isna(lat):
                stats["missing"] += 1
                valid_mask.append(False)
                continue
            
            is_valid, errors = self.validate_coordinate(lon, lat, bounds)
            if not is_valid:
                if "超出有效范围" in str(errors):
                    stats["out_of_bounds"] += 1
                valid_mask.append(False)
                continue
            
            stats["valid"] += 1
            valid_mask.append(True)
        
        stats["invalid"] = len(valid_mask) - stats["valid"]
        
        if drop_invalid:
            original_len = len(result_df)
            result_df = result_df[valid_mask].reset_index(drop=True)
            stats["dropped"] = original_len - len(result_df)
        
        self.conversion_stats["total_coordinates"] = stats["total"]
        self.conversion_stats["valid_coordinates"] = stats["valid"]
        self.conversion_stats["invalid_coordinates"] = stats["invalid"]
        
        return result_df, stats
    
    @staticmethod
    def haversine_distance(
        lon1: float,
        lat1: float,
        lon2: float,
        lat2: float
    ) -> float:
        """
        计算两点之间的球面距离（Haversine公式）
        
        Args:
            lon1: 点1经度
            lat1: 点1纬度
            lon2: 点2经度
            lat2: 点2纬度
            
        Returns:
            距离（公里）
        """
        if any(pd.isna([lon1, lat1, lon2, lat2])):
            return float("nan")
        
        lon1_rad = math.radians(lon1)
        lat1_rad = math.radians(lat1)
        lon2_rad = math.radians(lon2)
        lat2_rad = math.radians(lat2)
        
        dlon = lon2_rad - lon1_rad
        dlat = lat2_rad - lat1_rad
        
        a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        c = 2 * math.asin(math.sqrt(a))
        
        return CoordinateProcessor.EARTH_RADIUS * c
    
    def point_in_polygon(
        self,
        lon: float,
        lat: float,
        polygon: List[Tuple[float, float]]
    ) -> bool:
        """
        判断点是否在多边形内（射线法）
        
        Args:
            lon: 点经度
            lat: 点纬度
            polygon: 多边形顶点列表 [(lon1, lat1), (lon2, lat2), ...]
            
        Returns:
            是否在多边形内
        """
        if pd.isna(lon) or pd.isna(lat) or not polygon:
            return False
        
        n = len(polygon)
        inside = False
        
        p1_lon, p1_lat = polygon[0]
        for i in range(n + 1):
            p2_lon, p2_lat = polygon[i % n]
            
            if lat > min(p1_lat, p2_lat):
                if lat <= max(p1_lat, p2_lat):
                    if lon <= max(p1_lon, p2_lon):
                        if p1_lat != p2_lat:
                            x_intersect = (lat - p1_lat) * (p2_lon - p1_lon) / (p2_lat - p1_lat) + p1_lon
                            if p1_lon == p2_lon or lon <= x_intersect:
                                inside = not inside
            
            p1_lon, p1_lat = p2_lon, p2_lat
        
        return inside
    
    def find_nearest_grid(
        self,
        lon: float,
        lat: float,
        grids: Dict[str, Any],
        grid_id_col: str = "grid_id",
        lon_col: str = "longitude",
        lat_col: str = "latitude",
        boundary_col: str = "boundary"
    ) -> Tuple[Optional[str], float]:
        """
        查找最近的网格
        
        Args:
            lon: 点经度
            lat: 点纬度
            grids: 网格数据（字典或DataFrame）
            grid_id_col: 网格ID列名
            lon_col: 网格经度列名
            lat_col: 网格纬度列名
            boundary_col: 网格边界列名
            
        Returns:
            (网格ID, 距离)
        """
        if isinstance(grids, pd.DataFrame):
            grids = grids.to_dict("records")
        
        nearest_id = None
        min_distance = float("inf")
        
        for grid in grids:
            grid_id = grid.get(grid_id_col)
            
            if boundary_col in grid and grid[boundary_col]:
                if self.point_in_polygon(lon, lat, grid[boundary_col]):
                    return grid_id, 0.0
            
            grid_lon = grid.get(lon_col)
            grid_lat = grid.get(lat_col)
            
            if grid_lon is not None and grid_lat is not None:
                distance = self.haversine_distance(lon, lat, grid_lon, grid_lat)
                if not pd.isna(distance) and distance < min_distance:
                    min_distance = distance
                    nearest_id = grid_id
        
        return nearest_id, min_distance
    
    def get_conversion_report(self) -> Dict[str, Any]:
        """获取坐标转换报告"""
        return self.conversion_stats
