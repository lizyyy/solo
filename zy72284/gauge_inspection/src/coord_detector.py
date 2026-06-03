import re
from typing import Tuple, List, Dict, Any, Optional
from dataclasses import dataclass

@dataclass
class CoordDetectionResult:
    is_mixed: bool
    coord_type: str
    x_type: str
    y_type: str
    z_type: Optional[str]
    raw_x: str
    raw_y: str
    raw_z: Optional[str]
    confidence: float

class CoordinateDetector:
    LON_LAT_PATTERN = re.compile(
        r'^-?\d{1,3}\.\d{5,}$'
    )
    
    METER_PATTERN = re.compile(
        r'^-?\d{1,6}\.\d{1,3}$'
    )
    
    LARGE_METER_PATTERN = re.compile(
        r'^-?\d{4,7}(\.\d{1,3})?$'
    )

    @classmethod
    def _detect_single_coord(cls, value: str, axis: str) -> Tuple[str, float]:
        if value is None or value.strip() == "":
            return ("unknown", 0.0)
        
        value = value.strip()
        
        try:
            num = float(value)
        except (ValueError, TypeError):
            return ("unknown", 0.0)
        
        abs_num = abs(num)
        
        if axis in ("x", "y"):
            if -180.0 <= num <= 180.0 and cls.LON_LAT_PATTERN.match(value):
                if -90.0 <= num <= 90.0:
                    return ("lonlat_like", 0.85)
                elif axis == "x":
                    return ("lonlat_like", 0.75)
            
            if abs_num >= 1000.0 and (cls.METER_PATTERN.match(value) or cls.LARGE_METER_PATTERN.match(value)):
                return ("meter_like", 0.8)
            
            if abs_num >= 100.0 and abs_num < 1000.0:
                if "." in value and len(value.split(".")[-1]) <= 3:
                    return ("meter_like", 0.6)
                else:
                    return ("ambiguous", 0.3)
            
            if abs_num < 100.0:
                if cls.LON_LAT_PATTERN.match(value):
                    return ("lonlat_like", 0.7)
                elif cls.METER_PATTERN.match(value):
                    return ("meter_like", 0.4)
                return ("ambiguous", 0.3)
        
        elif axis == "z":
            if abs_num <= 100.0 and "." in value:
                return ("meter_like", 0.6)
            if abs_num > 100.0:
                return ("meter_like", 0.8)
            return ("ambiguous", 0.4)
        
        return ("unknown", 0.0)

    @classmethod
    def detect(cls, x: str, y: str, z: Optional[str] = None) -> CoordDetectionResult:
        x_type, x_conf = cls._detect_single_coord(x, "x")
        y_type, y_conf = cls._detect_single_coord(y, "y")
        z_type, z_conf = (None, 0.0)
        if z is not None:
            z_type, z_conf = cls._detect_single_coord(z, "z")
        
        xy_types = [t for t in [x_type, y_type] if t not in ("unknown",)]
        all_types = [t for t in [x_type, y_type, z_type] if t not in ("unknown", None)]
        
        xy_has_lonlat = any("lonlat" in t for t in xy_types)
        xy_has_meter = any("meter" in t for t in xy_types)
        xy_has_ambiguous = any("ambiguous" in t for t in xy_types)
        
        all_has_lonlat = any("lonlat" in t for t in all_types)
        all_has_meter = any("meter" in t for t in all_types)
        
        is_mixed = False
        coord_type = "unknown"
        
        if xy_has_lonlat and xy_has_meter:
            is_mixed = True
            coord_type = "mixed_lonlat_meter"
        elif xy_has_lonlat:
            coord_type = "lonlat"
        elif xy_has_meter:
            coord_type = "meter"
        elif xy_has_ambiguous:
            coord_type = "ambiguous"
            is_mixed = False
        elif all_has_lonlat and all_has_meter:
            coord_type = "ambiguous"
            is_mixed = False
        else:
            coord_type = "unknown"
        
        confidences = [x_conf, y_conf]
        if z_conf > 0:
            confidences.append(z_conf)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        return CoordDetectionResult(
            is_mixed=is_mixed,
            coord_type=coord_type,
            x_type=x_type,
            y_type=y_type,
            z_type=z_type,
            raw_x=x,
            raw_y=y,
            raw_z=z,
            confidence=avg_confidence
        )

    @classmethod
    def detect_from_item(cls, item: Dict[str, Any]) -> CoordDetectionResult:
        x = str(item.get("x", ""))
        y = str(item.get("y", ""))
        z = item.get("z")
        if z is not None:
            z = str(z)
        return cls.detect(x, y, z)

    @classmethod
    def batch_detect(cls, items: List[Dict[str, Any]]) -> List[Tuple[Dict[str, Any], CoordDetectionResult]]:
        results = []
        for item in items:
            detection = cls.detect_from_item(item)
            results.append((item, detection))
        return results

    @classmethod
    def explain_detection(cls, result: CoordDetectionResult) -> str:
        lines = []
        lines.append(f"坐标检测结果: {result.coord_type}")
        lines.append(f"  X轴({result.raw_x}): {result.x_type}")
        lines.append(f"  Y轴({result.raw_y}): {result.y_type}")
        if result.z_type:
            lines.append(f"  Z轴({result.raw_z}): {result.z_type}")
        
        if result.is_mixed:
            lines.append("  ⚠️  经纬度与米制坐标混合！需巡检组复核")
        else:
            lines.append("  ✅ 坐标系一致")
        
        lines.append(f"  检测置信度: {result.confidence:.1%}")
        return "\n".join(lines)
