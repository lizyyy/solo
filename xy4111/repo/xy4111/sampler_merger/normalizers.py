import math
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any
from pathlib import Path


class CoordinateNormalizer:
    """坐标归一化器 - 处理不同坐标系之间的转换"""
    
    WGS84_A = 6378137.0
    WGS84_EE = 0.00669342162296594323
    
    GCJ02_A = 6378245.0
    GCJ02_EE = 0.00669342162296594323
    
    BD09_LAT_OFFSET = 0.0065
    BD09_LON_OFFSET = 0.0060
    
    def __init__(self, target_system: str = "WGS84"):
        """
        初始化坐标归一化器
        
        Args:
            target_system: 目标坐标系，支持 "WGS84", "GCJ02", "BD09"
        """
        self.target_system = target_system.upper()
    
    def normalize(self, lat: float, lon: float, source_system: str = "WGS84") -> Tuple[float, float]:
        """
        将坐标从源坐标系转换到目标坐标系
        
        Args:
            lat: 纬度
            lon: 经度
            source_system: 源坐标系
        
        Returns:
            转换后的 (纬度, 经度)
        """
        source = source_system.upper()
        target = self.target_system
        
        if source == target:
            return lat, lon
        
        # 先转换到WGS84（如果源不是WGS84）
        if source == "GCJ02":
            lat, lon = self._gcj02_to_wgs84(lat, lon)
        elif source == "BD09":
            lat, lon = self._bd09_to_wgs84(lat, lon)
        
        # 再从WGS84转换到目标坐标系
        if target == "GCJ02":
            lat, lon = self._wgs84_to_gcj02(lat, lon)
        elif target == "BD09":
            lat, lon = self._wgs84_to_bd09(lat, lon)
        
        return lat, lon
    
    def _wgs84_to_gcj02(self, lat: float, lon: float) -> Tuple[float, float]:
        """WGS84转GCJ02（火星坐标）"""
        if self._is_out_of_china(lat, lon):
            return lat, lon
        
        dLat = self._transform_lat(lon - 105.0, lat - 35.0)
        dLon = self._transform_lon(lon - 105.0, lat - 35.0)
        
        radLat = lat / 180.0 * math.pi
        magic = math.sin(radLat)
        magic = 1 - self.GCJ02_EE * magic * magic
        sqrtMagic = math.sqrt(magic)
        
        dLat = (dLat * 180.0) / ((self.GCJ02_A * (1 - self.GCJ02_EE)) / (magic * sqrtMagic) * math.pi)
        dLon = (dLon * 180.0) / (self.GCJ02_A / sqrtMagic * math.cos(radLat) * math.pi)
        
        mgLat = lat + dLat
        mgLon = lon + dLon
        
        return mgLat, mgLon
    
    def _gcj02_to_wgs84(self, lat: float, lon: float) -> Tuple[float, float]:
        """GCJ02转WGS84（粗略转换）"""
        # 使用二分法精确求解
        threshold = 1e-7
        max_iter = 30
        
        # 先估算
        mgLat, mgLon = self._wgs84_to_gcj02(lat, lon)
        dLat = mgLat - lat
        dLon = mgLon - lon
        
        wgsLat = lat - dLat
        wgsLon = lon - dLon
        
        # 迭代优化
        for i in range(max_iter):
            mgLat, mgLon = self._wgs84_to_gcj02(wgsLat, wgsLon)
            dLat = mgLat - lat
            dLon = mgLon - lon
            
            if abs(dLat) < threshold and abs(dLon) < threshold:
                break
            
            wgsLat -= dLat
            wgsLon -= dLon
        
        return wgsLat, wgsLon
    
    def _wgs84_to_bd09(self, lat: float, lon: float) -> Tuple[float, float]:
        """WGS84转BD09（百度坐标）"""
        # 先转GCJ02，再转BD09
        gcjLat, gcjLon = self._wgs84_to_gcj02(lat, lon)
        
        x = gcjLon
        y = gcjLat
        
        z = math.sqrt(x * x + y * y) + 0.00002 * math.sin(y * math.pi)
        theta = math.atan2(y, x) + 0.000003 * math.cos(x * math.pi)
        
        bdLat = z * math.sin(theta) + self.BD09_LAT_OFFSET
        bdLon = z * math.cos(theta) + self.BD09_LON_OFFSET
        
        return bdLat, bdLon
    
    def _bd09_to_wgs84(self, lat: float, lon: float) -> Tuple[float, float]:
        """BD09转WGS84"""
        # 先转GCJ02，再转WGS84
        x = lon - self.BD09_LON_OFFSET
        y = lat - self.BD09_LAT_OFFSET
        
        z = math.sqrt(x * x + y * y) - 0.00002 * math.sin(y * math.pi)
        theta = math.atan2(y, x) - 0.000003 * math.cos(x * math.pi)
        
        gcjLat = z * math.sin(theta)
        gcjLon = z * math.cos(theta)
        
        return self._gcj02_to_wgs84(gcjLat, gcjLon)
    
    def _transform_lat(self, x: float, y: float) -> float:
        """纬度变换函数"""
        ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
        ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
        ret += (20.0 * math.sin(y * math.pi) + 40.0 * math.sin(y / 3.0 * math.pi)) * 2.0 / 3.0
        ret += (160.0 * math.sin(y / 12.0 * math.pi) + 320 * math.sin(y * math.pi / 30.0)) * 2.0 / 3.0
        return ret
    
    def _transform_lon(self, x: float, y: float) -> float:
        """经度变换函数"""
        ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
        ret += (20.0 * math.sin(6.0 * x * math.pi) + 20.0 * math.sin(2.0 * x * math.pi)) * 2.0 / 3.0
        ret += (20.0 * math.sin(x * math.pi) + 40.0 * math.sin(x / 3.0 * math.pi)) * 2.0 / 3.0
        ret += (150.0 * math.sin(x / 12.0 * math.pi) + 300.0 * math.sin(x / 30.0 * math.pi)) * 2.0 / 3.0
        return ret
    
    def _is_out_of_china(self, lat: float, lon: float) -> bool:
        """判断坐标是否在中国境外（简单矩形判断）"""
        return lon < 72.004 or lon > 137.8347 or lat < 0.8293 or lat > 55.8271
    
    def parse_coordinate_string(self, coord_str: str) -> Tuple[Optional[float], Optional[float], Optional[str]]:
        """
        解析坐标字符串，自动检测格式
        
        支持格式：
        - "30.1234, 120.5678"
        - "30°07'24.24\"N, 120°34'04.08\"E"
        - "30.1234° N, 120.5678° E"
        
        Returns:
            (纬度, 经度, 坐标系)
        """
        coord_str = coord_str.strip()
        
        # 尝试简单的逗号分隔
        if ',' in coord_str:
            parts = coord_str.split(',')
            if len(parts) >= 2:
                lat_str = parts[0].strip()
                lon_str = parts[1].strip()
                
                # 检查是否包含度分秒符号
                if '°' in lat_str or '°' in lon_str:
                    lat = self._dms_to_decimal(lat_str)
                    lon = self._dms_to_decimal(lon_str)
                else:
                    # 尝试直接解析浮点数
                    try:
                        lat = float(lat_str.replace('N', '').replace('S', '').replace('°', '').strip())
                        lon = float(lon_str.replace('E', '').replace('W', '').replace('°', '').strip())
                        
                        # 检查南北半球/东西半球
                        if 'S' in lat_str.upper():
                            lat = -abs(lat)
                        if 'W' in lon_str.upper():
                            lon = -abs(lon)
                    except ValueError:
                        lat = None
                        lon = None
                
                # 检测坐标系（通过关键字）
                coord_system = "WGS84"
                lower_str = coord_str.lower()
                if 'gcj' in lower_str or '火星' in lower_str:
                    coord_system = "GCJ02"
                elif 'bd' in lower_str or '百度' in lower_str:
                    coord_system = "BD09"
                
                return lat, lon, coord_system
        
        return None, None, None
    
    def _dms_to_decimal(self, dms_str: str) -> Optional[float]:
        """度分秒转十进制度数"""
        dms_str = dms_str.strip()
        
        # 匹配度分秒格式: 30°07'24.24"N 或 30°7'24.24" N
        import re
        
        # 正则匹配度分秒
        pattern = r'(\d+\.?\d*)°?\s*(\d*\.?\d*)?[\'′]?\s*(\d*\.?\d*)?["″]?\s*([NSEW]?)'
        match = re.match(pattern, dms_str.strip())
        
        if match:
            degrees = float(match.group(1))
            minutes = float(match.group(2)) if match.group(2) else 0.0
            seconds = float(match.group(3)) if match.group(3) else 0.0
            direction = match.group(4).upper()
            
            decimal = degrees + minutes / 60.0 + seconds / 3600.0
            
            if direction in ['S', 'W']:
                decimal = -decimal
            
            return decimal
        
        # 尝试简单的浮点数
        try:
            cleaned = re.sub(r'[^\d.\-+]', '', dms_str)
            return float(cleaned)
        except:
            return None


class TimeNormalizer:
    """时间归一化器 - 处理时区转换和时间戳统一"""
    
    def __init__(self, target_timezone: str = "UTC"):
        """
        初始化时间归一化器
        
        Args:
            target_timezone: 目标时区，如 "UTC", "Asia/Shanghai", "America/New_York"
        """
        self.target_timezone = target_timezone
        self._tz_cache = {}
    
    def normalize(self, dt: datetime, source_timezone: Optional[str] = None) -> datetime:
        """
        将时间从源时区转换到目标时区
        
        Args:
            dt: 时间对象
            source_timezone: 源时区，如果dt已有时区信息则忽略
        
        Returns:
            转换后的时间对象（带时区信息）
        """
        # 如果dt没有时区信息，添加源时区
        if dt.tzinfo is None:
            if source_timezone:
                dt = dt.replace(tzinfo=self._get_timezone(source_timezone))
            else:
                # 假设是UTC
                dt = dt.replace(tzinfo=timezone.utc)
        
        # 转换到目标时区
        target_tz = self._get_timezone(self.target_timezone)
        return dt.astimezone(target_tz)
    
    def parse_timestamp(
        self,
        time_str: str,
        source_timezone: Optional[str] = None,
        formats: list = None
    ) -> Optional[datetime]:
        """
        解析时间字符串并转换到目标时区
        
        Args:
            time_str: 时间字符串
            source_timezone: 源时区
            formats: 尝试的时间格式列表
        
        Returns:
            转换后的时间对象（带时区信息）
        """
        if not time_str:
            return None
        
        time_str = time_str.strip()
        
        # 常见时间格式
        default_formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%m/%d/%Y",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
        ]
        
        formats_to_try = formats or default_formats
        
        # 尝试ISO格式（带时区）
        try:
            dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
            return self.normalize(dt, source_timezone)
        except ValueError:
            pass
        
        # 尝试各种格式
        for fmt in formats_to_try:
            try:
                dt = datetime.strptime(time_str, fmt)
                return self.normalize(dt, source_timezone)
            except ValueError:
                continue
        
        return None
    
    def _get_timezone(self, tz_name: str):
        """获取时区对象（带缓存）"""
        if tz_name in self._tz_cache:
            return self._tz_cache[tz_name]
        
        # 首先检查是否是UTC
        if tz_name.upper() == "UTC":
            self._tz_cache[tz_name] = timezone.utc
            return timezone.utc
        
        # 尝试使用zoneinfo（Python 3.9+）
        try:
            from zoneinfo import ZoneInfo
            tz = ZoneInfo(tz_name)
            self._tz_cache[tz_name] = tz
            return tz
        except (ImportError, ValueError):
            pass
        
        # 尝试使用pytz
        try:
            import pytz
            tz = pytz.timezone(tz_name)
            self._tz_cache[tz_name] = tz
            return tz
        except (ImportError, pytz.UnknownTimeZoneError):
            pass
        
        # 常见时区的偏移量映射
        tz_offsets = {
            "Asia/Shanghai": 8,
            "Asia/Hong_Kong": 8,
            "Asia/Tokyo": 9,
            "America/New_York": -5,
            "America/Los_Angeles": -8,
            "Europe/London": 0,
            "Europe/Paris": 1,
        }
        
        if tz_name in tz_offsets:
            offset = tz_offsets[tz_name]
            tz = timezone(timedelta(hours=offset))
            self._tz_cache[tz_name] = tz
            return tz
        
        # 默认返回UTC
        self._tz_cache[tz_name] = timezone.utc
        return timezone.utc
    
    def format_iso(self, dt: datetime) -> str:
        """格式化为ISO 8601字符串"""
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    
    def detect_timezone_from_str(self, time_str: str) -> Optional[str]:
        """
        从时间字符串中检测时区
        
        例如:
        - "2023-05-15 14:30:00+08:00" -> "UTC+8" 或 "Asia/Shanghai"
        - "2023-05-15T14:30:00Z" -> "UTC"
        """
        time_str = time_str.strip()
        
        # 检查Z后缀
        if time_str.endswith('Z'):
            return "UTC"
        
        # 检查+/-时区偏移
        import re
        offset_match = re.search(r'([+-]\d{2}:?\d{2})$', time_str)
        if offset_match:
            offset_str = offset_match.group(1)
            try:
                # 解析偏移量
                offset_str = offset_str.replace(':', '')
                hours = int(offset_str[:3])
                minutes = int(offset_str[3:]) if len(offset_str) > 3 else 0
                
                total_offset = hours + minutes / 60.0
                
                # 映射到常见时区
                if total_offset == 8:
                    return "Asia/Shanghai"
                elif total_offset == 9:
                    return "Asia/Tokyo"
                elif total_offset == 0:
                    return "UTC"
                elif total_offset == -5:
                    return "America/New_York"
                elif total_offset == -8:
                    return "America/Los_Angeles"
                
                # 通用格式
                return f"UTC{hours:+03d}:{minutes:02d}"
            except:
                pass
        
        return None


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    计算两点之间的球面距离（Haversine公式）
    
    Args:
        lat1, lon1: 第一点坐标（度）
        lat2, lon2: 第二点坐标（度）
    
    Returns:
        距离（米）
    """
    R = 6371000.0  # 地球半径（米）
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def time_difference_seconds(dt1: datetime, dt2: datetime) -> float:
    """
    计算两个时间之间的秒数差（绝对值）
    
    Returns:
        时间差的绝对值（秒）
    """
    return abs((dt1 - dt2).total_seconds())
