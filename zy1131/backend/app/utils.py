import json
from pathlib import Path
from typing import Any, Dict, Optional
from datetime import datetime

def load_json_file(file_path: str) -> Optional[Dict[str, Any]]:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"加载JSON文件失败: {e}")
        return None

def save_json_file(data: Any, file_path: str) -> bool:
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"保存JSON文件失败: {e}")
        return False

def generate_timestamp() -> str:
    return datetime.now().isoformat()

def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def calculate_bounds(items: list, x_key: str = "x", y_key: str = "y") -> Dict[str, float]:
    if not items:
        return {"min_x": 0, "max_x": 0, "min_y": 0, "max_y": 0, "width": 0, "height": 0}
    
    min_x = float('inf')
    max_x = float('-inf')
    min_y = float('inf')
    max_y = float('-inf')
    
    for item in items:
        x = safe_float(item.get(x_key))
        y = safe_float(item.get(y_key))
        min_x = min(min_x, x)
        max_x = max(max_x, x)
        min_y = min(min_y, y)
        max_y = max(max_y, y)
    
    return {
        "min_x": min_x,
        "max_x": max_x,
        "min_y": min_y,
        "max_y": max_y,
        "width": max_x - min_x,
        "height": max_y - min_y
    }

def format_issue_for_display(issue: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": issue.get("id"),
        "title": issue.get("title"),
        "severity": issue.get("severity"),
        "status": issue.get("status"),
        "category": issue.get("category"),
        "rule_name": issue.get("rule_name"),
        "description": issue.get("description"),
        "suggestion": issue.get("suggestion"),
        "location": issue.get("location", {}),
        "created_at": issue.get("created_at")
    }

def merge_duplicate_issues(issues: list) -> list:
    seen = {}
    unique_issues = []
    
    for issue in issues:
        key = f"{issue.get('rule_id')}_{issue.get('location', {}).get('x')}_{issue.get('location', {}).get('y')}"
        
        if key not in seen:
            seen[key] = True
            unique_issues.append(issue)
    
    return unique_issues

def filter_issues_by_severity(issues: list, severity: str) -> list:
    return [i for i in issues if i.get("severity") == severity.lower()]

def filter_issues_by_status(issues: list, status: str) -> list:
    return [i for i in issues if i.get("status") == status.lower()]

def count_issues_by_category(issues: list) -> Dict[str, int]:
    counts = {}
    for issue in issues:
        category = issue.get("category", "unknown")
        counts[category] = counts.get(category, 0) + 1
    return counts

def create_default_ruleset() -> Dict[str, Any]:
    return {
        "name": "Default PCB Rules",
        "version": "1.0",
        "description": "默认PCB设计规则集",
        "rules": [
            {
                "id": "trace_width",
                "name": "走线宽度检查",
                "category": "electrical",
                "description": "检查走线宽度是否符合最小要求",
                "severity": "critical",
                "enabled": True,
                "parameters": {
                    "min_width": 0.15,
                    "critical_nets": {}
                }
            },
            {
                "id": "clearance",
                "name": "间距检查",
                "category": "electrical",
                "description": "检查走线、焊盘、过孔之间的间距",
                "severity": "critical",
                "enabled": True,
                "parameters": {
                    "min_clearance": 0.15,
                    "pad_to_pad": 0.2,
                    "pad_to_trace": 0.15,
                    "trace_to_trace": 0.15,
                    "via_to_any": 0.15
                }
            },
            {
                "id": "via_size",
                "name": "过孔尺寸检查",
                "category": "manufacturing",
                "description": "检查过孔钻孔直径和环形焊盘宽度",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "min_drill": 0.3,
                    "max_drill": 6.0,
                    "min_annular_ring": 0.15
                }
            },
            {
                "id": "component_to_edge",
                "name": "器件到板边距离检查",
                "category": "assembly",
                "description": "检查器件与板边的最小距离",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "min_distance": 2.0,
                    "connectors_extra": 3.0
                }
            },
            {
                "id": "silkscreen_over_pad",
                "name": "丝印压焊盘检查",
                "category": "manufacturing",
                "description": "检查丝印是否覆盖焊盘",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "min_clearance": 0.1
                }
            },
            {
                "id": "bom_availability",
                "name": "BOM缺料检查",
                "category": "bom",
                "description": "检查BOM中的器件是否可用",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "require_alternate": False,
                    "critical_components": []
                }
            },
            {
                "id": "footprint_match",
                "name": "封装匹配检查",
                "category": "bom",
                "description": "检查PCB封装与BOM封装是否一致",
                "severity": "critical",
                "enabled": True,
                "parameters": {}
            },
            {
                "id": "polarity_direction",
                "name": "极性器件方向检查",
                "category": "assembly",
                "description": "检查极性器件的旋转角度是否规范",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "allowed_rotations": [0, 90, 180, 270],
                    "check_diode_alignment": True
                }
            },
            {
                "id": "connector_orientation",
                "name": "连接器朝向检查",
                "category": "assembly",
                "description": "检查边缘连接器是否朝向外",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "edge_connectors_outward": True,
                    "pin1_location": "left"
                }
            },
            {
                "id": "thermal_margin",
                "name": "高功耗器件散热检查",
                "category": "thermal",
                "description": "检查高功耗器件的散热余量",
                "severity": "warning",
                "enabled": True,
                "parameters": {
                    "high_power_threshold": 0.5,
                    "min_clearance": 1.0,
                    "thermal_vias_required": True,
                    "via_count_min": 4
                }
            }
        ]
    }
