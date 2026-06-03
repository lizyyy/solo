"""安全半径表导入与验证模块"""
import csv
import json
from typing import List, Dict, Any, Optional
from .models import SafetyRadius, LayoutProject, Handler


def import_safety_radius_csv(file_path: str, project: LayoutProject) -> List[SafetyRadius]:
    """从CSV导入安全半径表"""
    records = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                record = SafetyRadius(
                    cabinet_id=row['柜号'],
                    cabinet_name=row['柜名'],
                    position=(float(row['X坐标']), float(row['Y坐标'])),
                    safety_radius=float(row['安全半径']),
                    chemical_type=row['化学品类型'],
                    hazard_level=row.get('危险等级', '中等')
                )
                records.append(record)
            except (KeyError, ValueError) as e:
                raise ValueError(f"解析第{reader.line_num}行失败: {str(e)}")

    project.safety_radii = records
    project.add_log(
        operator=Handler.SYSTEM,
        action="导入安全半径表",
        details=f"成功导入 {len(records)} 条危化品柜安全半径记录"
    )
    return records


def import_safety_radius_json(data: List[Dict[str, Any]], project: LayoutProject) -> List[SafetyRadius]:
    """从JSON数据导入安全半径表"""
    records = []
    for idx, row in enumerate(data):
        try:
            record = SafetyRadius(
                cabinet_id=row['cabinet_id'],
                cabinet_name=row['cabinet_name'],
                position=(float(row['x']), float(row['y'])),
                safety_radius=float(row['safety_radius']),
                chemical_type=row['chemical_type'],
                hazard_level=row.get('hazard_level', '中等')
            )
            records.append(record)
        except (KeyError, ValueError) as e:
            raise ValueError(f"解析第{idx}条数据失败: {str(e)}")

    project.safety_radii = records
    project.add_log(
        operator=Handler.SYSTEM,
        action="导入安全半径表",
        details=f"成功导入 {len(records)} 条危化品柜安全半径记录"
    )
    return records


def validate_safety_radius_overlap(project: LayoutProject) -> List[Dict[str, Any]]:
    """验证安全半径是否重叠"""
    issues = []
    cabinets = project.safety_radii

    for i, c1 in enumerate(cabinets):
        for c2 in cabinets[i + 1:]:
            dx = c1.position[0] - c2.position[0]
            dy = c1.position[1] - c2.position[1]
            distance = (dx ** 2 + dy ** 2) ** 0.5
            min_required = c1.safety_radius + c2.safety_radius

            if distance < min_required:
                issues.append({
                    'type': '安全半径重叠',
                    'cabinets': [c1.cabinet_id, c2.cabinet_id],
                    'distance': round(distance, 2),
                    'required': round(min_required, 2),
                    'gap': round(min_required - distance, 2)
                })

    if issues:
        project.add_log(
            operator=Handler.SYSTEM,
            action="安全半径校验",
            details=f"检测到 {len(issues)} 处安全半径重叠问题"
        )

    return issues


def import_routes_csv(file_path: str, project: LayoutProject) -> List:
    """从CSV导入路线记录"""
    from .models import RouteRecord
    from datetime import datetime

    routes = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                via_points = []
                if row.get('途经点'):
                    for pt in row['途经点'].split(';'):
                        if pt:
                            x, y = pt.split(',')
                            via_points.append((float(x), float(y)))

                manual_len = float(row['人工录入长度']) if row.get('人工录入长度') else None
                calc_len = float(row['计算长度']) if row.get('计算长度') else None

                route = RouteRecord(
                    route_id=row['路线ID'],
                    route_name=row['路线名称'],
                    start_point=(float(row['起点X']), float(row['起点Y'])),
                    end_point=(float(row['终点X']), float(row['终点Y'])),
                    via_points=via_points,
                    calculated_length=calc_len,
                    manual_input_length=manual_len,
                    is_supplementary=row.get('是否补录', '否') == '是',
                    length_matched=None,
                    last_calculated_at=datetime.now() if calc_len else None,
                    last_updated_at=datetime.now()
                )
                routes.append(route)
            except (KeyError, ValueError) as e:
                raise ValueError(f"解析第{reader.line_num}行失败: {str(e)}")

    project.routes = routes
    project.add_log(
        operator=Handler.SYSTEM,
        action="导入路线表",
        details=f"成功导入 {len(routes)} 条路线记录"
    )
    return routes


def import_routes_json(data: List[Dict[str, Any]], project: LayoutProject) -> List:
    """从JSON导入路线记录"""
    from .models import RouteRecord
    from datetime import datetime

    routes = []
    for idx, row in enumerate(data):
        try:
            route = RouteRecord(
                route_id=row['route_id'],
                route_name=row['route_name'],
                start_point=(float(row['start_x']), float(row['start_y'])),
                end_point=(float(row['end_x']), float(row['end_y'])),
                via_points=[(float(p[0]), float(p[1])) for p in row.get('via_points', [])],
                calculated_length=row.get('calculated_length'),
                manual_input_length=row.get('manual_input_length'),
                is_supplementary=row.get('is_supplementary', False),
                length_matched=None,
                last_calculated_at=datetime.now() if row.get('calculated_length') else None,
                last_updated_at=datetime.now()
            )
            routes.append(route)
        except (KeyError, ValueError) as e:
            raise ValueError(f"解析第{idx}条数据失败: {str(e)}")

    project.routes = routes
    project.add_log(
        operator=Handler.SYSTEM,
        action="导入路线表",
        details=f"成功导入 {len(routes)} 条路线记录"
    )
    return routes
