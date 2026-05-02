from dataclasses import dataclass
from enum import Enum
from typing import Optional, Tuple

import pyproj


class CoordinateSystem(Enum):
    WGS84 = "WGS84"
    GCJ02 = "GCJ02"
    BD09 = "BD09"
    UTM = "UTM"
    CGCS2000 = "CGCS2000"

    @classmethod
    def from_string(cls, value: str) -> "CoordinateSystem":
        try:
            return cls(value.upper())
        except ValueError:
            return cls.WGS84


@dataclass
class CoordinatePoint:
    lat: float
    lon: float
    coordinate_system: CoordinateSystem = CoordinateSystem.WGS84
    elevation: Optional[float] = None
    timestamp: Optional[float] = None

    def to_tuple(self) -> Tuple[float, float, Optional[float]]:
        return (self.lat, self.lon, self.elevation)


class CoordinateConverter:
    _transformers: dict = {}

    @classmethod
    def _get_transformer(
        cls,
        from_crs: str,
        to_crs: str,
    ) -> pyproj.Transformer:
        key = f"{from_crs}:{to_crs}"
        if key not in cls._transformers:
            cls._transformers[key] = pyproj.Transformer.from_crs(
                from_crs, to_crs, always_xy=True
            )
        return cls._transformers[key]

    @staticmethod
    def _gcj02_to_wgs84(lat: float, lon: float) -> Tuple[float, float]:
        import math

        a = 6378245.0
        ee = 0.00669342162296594323

        d_lat = CoordinateConverter._transform_lat(lon - 105.0, lat - 35.0)
        d_lon = CoordinateConverter._transform_lon(lon - 105.0, lat - 35.0)
        rad_lat = lat / 180.0 * math.pi
        magic = math.sin(rad_lat)
        magic = 1 - ee * magic * magic
        sqrt_magic = math.sqrt(magic)
        d_lat = (d_lat * 180.0) / ((a * (1 - ee)) / (magic * sqrt_magic) * math.pi)
        d_lon = (d_lon * 180.0) / (a / sqrt_magic * math.cos(rad_lat) * math.pi)
        mglat = lat + d_lat
        mglon = lon + d_lon
        return (lat * 2 - mglat, lon * 2 - mglon)

    @staticmethod
    def _wgs84_to_gcj02(lat: float, lon: float) -> Tuple[float, float]:
        import math

        if CoordinateConverter._out_of_china(lat, lon):
            return (lat, lon)

        d_lat = CoordinateConverter._transform_lat(lon - 105.0, lat - 35.0)
        d_lon = CoordinateConverter._transform_lon(lon - 105.0, lat - 35.0)
        rad_lat = lat / 180.0 * math.pi
        magic = math.sin(rad_lat)
        magic = 1 - 0.00669342162296594323 * magic * magic
        sqrt_magic = math.sqrt(magic)
        d_lat = (d_lat * 180.0) / (
            (6378245.0 * (1 - 0.00669342162296594323))
            / (magic * sqrt_magic)
            * math.pi
        )
        d_lon = (d_lon * 180.0) / (
            6378245.0 / sqrt_magic * math.cos(rad_lat) * math.pi
        )
        mglat = lat + d_lat
        mglon = lon + d_lon
        return (mglat, mglon)

    @staticmethod
    def _transform_lat(x: float, y: float) -> float:
        import math

        ret = (
            -100.0
            + 2.0 * x
            + 3.0 * y
            + 0.2 * y * y
            + 0.1 * x * y
            + 0.2 * math.sqrt(abs(x))
        )
        ret += (
            (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi))
            * 2.0
            / 3.0
        )
        ret += (
            (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi))
            * 2.0
            / 3.0
        )
        ret += (
            (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0))
            * 2.0
            / 3.0
        )
        return ret

    @staticmethod
    def _transform_lon(x: float, y: float) -> float:
        import math

        ret = (
            300.0
            + x
            + 2.0 * y
            + 0.1 * x * x
            + 0.1 * x * y
            + 0.1 * math.sqrt(abs(x))
        )
        ret += (
            (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi))
            * 2.0
            / 3.0
        )
        ret += (
            (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi))
            * 2.0
            / 3.0
        )
        ret += (
            (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi))
            * 2.0
            / 3.0
        )
        return ret

    @staticmethod
    def _out_of_china(lat: float, lon: float) -> bool:
        return not (73.66 < lon < 135.05 and 3.86 < lat < 53.55)

    @staticmethod
    def _bd09_to_gcj02(lat: float, lon: float) -> Tuple[float, float]:
        import math

        x_pi = 3.14159265358979324 * 3000.0 / 180.0
        x = lon - 0.0065
        y = lat - 0.006
        z = math.sqrt(x * x + y * y) - 0.00002 * math.sin(y * x_pi)
        theta = math.atan2(y, x) - 0.000003 * math.cos(x * x_pi)
        gg_lon = z * math.cos(theta)
        gg_lat = z * math.sin(theta)
        return (gg_lat, gg_lon)

    @staticmethod
    def _gcj02_to_bd09(lat: float, lon: float) -> Tuple[float, float]:
        import math

        x_pi = 3.14159265358979324 * 3000.0 / 180.0
        z = math.sqrt(lon * lon + lat * lat) + 0.00002 * math.sin(lat * x_pi)
        theta = math.atan2(lat, lon) + 0.000003 * math.cos(lon * x_pi)
        bd_lon = z * math.cos(theta) + 0.0065
        bd_lat = z * math.sin(theta) + 0.006
        return (bd_lat, bd_lon)

    @classmethod
    def convert(
        cls,
        point: CoordinatePoint,
        target_system: CoordinateSystem,
        utm_zone: Optional[int] = None,
    ) -> CoordinatePoint:
        if point.coordinate_system == target_system:
            return point

        lat, lon = point.lat, point.lon

        if point.coordinate_system in (
            CoordinateSystem.WGS84,
            CoordinateSystem.CGCS2000,
        ):
            if target_system == CoordinateSystem.GCJ02:
                lat, lon = cls._wgs84_to_gcj02(lat, lon)
            elif target_system == CoordinateSystem.BD09:
                lat, lon = cls._wgs84_to_gcj02(lat, lon)
                lat, lon = cls._gcj02_to_bd09(lat, lon)

        elif point.coordinate_system == CoordinateSystem.GCJ02:
            if target_system in (
                CoordinateSystem.WGS84,
                CoordinateSystem.CGCS2000,
            ):
                lat, lon = cls._gcj02_to_wgs84(lat, lon)
            elif target_system == CoordinateSystem.BD09:
                lat, lon = cls._gcj02_to_bd09(lat, lon)

        elif point.coordinate_system == CoordinateSystem.BD09:
            lat, lon = cls._bd09_to_gcj02(lat, lon)
            if target_system in (
                CoordinateSystem.WGS84,
                CoordinateSystem.CGCS2000,
            ):
                lat, lon = cls._gcj02_to_wgs84(lat, lon)

        return CoordinatePoint(
            lat=lat,
            lon=lon,
            coordinate_system=target_system,
            elevation=point.elevation,
            timestamp=point.timestamp,
        )


def calculate_haversine_distance(
    point1: CoordinatePoint, point2: CoordinatePoint
) -> float:
    import math

    if point1.coordinate_system != point2.coordinate_system:
        point2 = CoordinateConverter.convert(point2, point1.coordinate_system)

    R = 6371000.0

    lat1 = math.radians(point1.lat)
    lat2 = math.radians(point2.lat)
    delta_lat = math.radians(point2.lat - point1.lat)
    delta_lon = math.radians(point2.lon - point1.lon)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
