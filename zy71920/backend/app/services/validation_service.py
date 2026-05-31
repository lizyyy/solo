import re
from typing import List, Dict, Any, Optional, Tuple
from ..models import Artwork


VALID_UNITS = ["cm", "m", "mm", "inch", "in"]
UNIT_MESSAGES = {
    "cm": "厘米",
    "m": "米",
    "mm": "毫米",
    "inch": "英寸",
    "in": "英寸"
}


def validate_unit(unit: str) -> Tuple[bool, str]:
    unit_lower = unit.lower().strip()
    if unit_lower not in VALID_UNITS:
        return False, f"尺寸单位 '{unit}' 不支持，请使用厘米(cm)、米(m)、毫米(mm)或英寸(inch)"
    return True, ""


def validate_dimensions(width: float, height: float, unit: str) -> List[Dict[str, Any]]:
    issues = []
    
    unit_lower = unit.lower().strip()
    is_valid, msg = validate_unit(unit)
    if not is_valid:
        issues.append({
            "type": "unit_error",
            "message": msg,
            "severity": "warning"
        })
    
    if width <= 0 or height <= 0:
        issues.append({
            "type": "dimension_error",
            "message": f"作品尺寸必须大于0，当前尺寸：宽{width} x 高{height}",
            "severity": "error"
        })
    
    if unit_lower == "cm" and (width > 500 or height > 500):
        issues.append({
            "type": "dimension_warning",
            "message": f"作品尺寸较大（{width}x{height}cm），请确认单位是否正确（是否应该是米？）",
            "severity": "warning"
        })
    
    if unit_lower == "m" and (width < 0.1 or height < 0.1):
        issues.append({
            "type": "dimension_warning",
            "message": f"作品尺寸较小（{width}x{height}m），请确认单位是否正确（是否应该是厘米？）",
            "severity": "warning"
        })
    
    return issues


def validate_artwork_data(data: Dict[str, Any], row_num: int) -> Tuple[bool, List[Dict[str, Any]]]:
    issues = []
    
    required_fields = ["artwork_id", "title", "artist", "width", "height"]
    for field in required_fields:
        if field not in data or data[field] is None or str(data[field]).strip() == "":
            issues.append({
                "row": row_num,
                "artwork_id": data.get("artwork_id"),
                "type": "missing_field",
                "message": f"缺少必要信息：{field}（作品编号/标题/艺术家/尺寸不能留空）",
                "severity": "error"
            })
    
    if "width" in data and data["width"] is not None:
        try:
            width = float(data["width"])
        except (ValueError, TypeError):
            issues.append({
                "row": row_num,
                "artwork_id": data.get("artwork_id"),
                "type": "invalid_number",
                "message": f"宽度 '{data['width']}' 不是有效的数字，请输入数字",
                "severity": "error"
            })
    
    if "height" in data and data["height"] is not None:
        try:
            height = float(data["height"])
        except (ValueError, TypeError):
            issues.append({
                "row": row_num,
                "artwork_id": data.get("artwork_id"),
                "type": "invalid_number",
                "message": f"高度 '{data['height']}' 不是有效的数字，请输入数字",
                "severity": "error"
            })
    
    unit = data.get("unit", "cm")
    if unit:
        is_valid, msg = validate_unit(unit)
        if not is_valid:
            issues.append({
                "row": row_num,
                "artwork_id": data.get("artwork_id"),
                "type": "unit_error",
                "message": msg,
                "severity": "warning"
            })
    
    has_errors = any(issue["severity"] == "error" for issue in issues)
    return not has_errors, issues


def check_position_conflicts(artworks: List[Artwork]) -> List[Dict[str, Any]]:
    conflicts = []
    
    wall_groups: Dict[str, List[Artwork]] = {}
    for artwork in artworks:
        if artwork.wall_location and artwork.position_x is not None and artwork.position_y is not None:
            if artwork.wall_location not in wall_groups:
                wall_groups[artwork.wall_location] = []
            wall_groups[artwork.wall_location].append(artwork)
    
    for wall, wall_artworks in wall_groups.items():
        for i, art1 in enumerate(wall_artworks):
            for art2 in wall_artworks[i+1:]:
                overlap = check_overlap(art1, art2)
                if overlap:
                    conflicts.append({
                        "type": "position_conflict",
                        "artwork1_id": art1.artwork_id,
                        "artwork1_title": art1.title,
                        "artwork2_id": art2.artwork_id,
                        "artwork2_title": art2.title,
                        "wall": wall,
                        "message": f"展墙 '{wall}' 上，作品 '{art1.title}' 和 '{art2.title}' 的挂墙位置可能重叠，请确认"
                    })
    
    return conflicts


def check_overlap(art1: Artwork, art2: Artwork) -> bool:
    try:
        w1 = float(art1.width) if art1.unit == "cm" else float(art1.width) * 100
        h1 = float(art1.height) if art1.unit == "cm" else float(art1.height) * 100
        w2 = float(art2.width) if art2.unit == "cm" else float(art2.width) * 100
        h2 = float(art2.height) if art2.unit == "cm" else float(art2.height) * 100
        
        left1, right1 = art1.position_x, art1.position_x + w1
        bottom1, top1 = art1.position_y, art1.position_y + h1
        left2, right2 = art2.position_x, art2.position_x + w2
        bottom2, top2 = art2.position_y, art2.position_y + h2
        
        return not (right1 <= left2 or right2 <= left1 or top1 <= bottom2 or top2 <= bottom1)
    except:
        return False
