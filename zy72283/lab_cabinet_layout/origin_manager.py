"""坐标原点说明管理模块"""
from typing import Optional, Dict, Any
from datetime import datetime
from .models import CoordinateOrigin, LayoutProject, Handler


def set_coordinate_origin(
    project: LayoutProject,
    origin_point: tuple,
    description: str,
    calibration_date: str,
    calibrated_by: str,
    notes: str = ""
) -> CoordinateOrigin:
    """设置坐标原点说明"""
    version = 1
    if project.coordinate_origin:
        version = project.coordinate_origin.version + 1

    origin = CoordinateOrigin(
        origin_point=origin_point,
        description=description,
        calibration_date=calibration_date,
        calibrated_by=calibrated_by,
        version=version,
        notes=notes
    )

    project.coordinate_origin = origin
    project.version += 1

    project.add_log(
        operator=Handler.PARK_OPS_XT,
        action="更新坐标原点说明",
        details=f"版本 v{version}：{description}，原点({origin_point[0]}, {origin_point[1]})"
    )

    return origin


def get_origin_info(project: LayoutProject) -> Optional[Dict[str, Any]]:
    """获取坐标原点说明信息"""
    if not project.coordinate_origin:
        return None

    origin = project.coordinate_origin
    return {
        "version": f"v{origin.version}",
        "origin_point": origin.origin_point,
        "description": origin.description,
        "calibration_date": origin.calibration_date,
        "calibrated_by": origin.calibrated_by,
        "notes": origin.notes,
        "impact": _calculate_origin_impact(project, origin)
    }


def _calculate_origin_impact(project: LayoutProject, origin: CoordinateOrigin) -> str:
    """计算坐标原点变更对路线的影响"""
    if not project.routes:
        return "暂无路线数据，无法评估影响"

    ox, oy = origin.origin_point
    adjustments = []

    for route in project.routes:
        start_adj = (route.start_point[0] - ox, route.start_point[1] - oy)
        end_adj = (route.end_point[0] - ox, route.end_point[1] - oy)
        adjustments.append({
            "route_id": route.route_id,
            "route_name": route.route_name,
            "start_adjusted": start_adj,
            "end_adjusted": end_adj
        })

    return f"影响 {len(adjustments)} 条路线坐标，需确认是否需要重算长度"


def transform_coordinates(project: LayoutProject, origin: CoordinateOrigin) -> None:
    """根据坐标原点转换所有路线坐标（相对坐标转绝对坐标）"""
    ox, oy = origin.origin_point

    for route in project.routes:
        route.start_point = (route.start_point[0] + ox, route.start_point[1] + oy)
        route.end_point = (route.end_point[0] + ox, route.end_point[1] + oy)
        route.via_points = [(p[0] + ox, p[1] + oy) for p in route.via_points]
        route.last_updated_at = datetime.now()

    for cabinet in project.safety_radii:
        cabinet.position = (cabinet.position[0] + ox, cabinet.position[1] + oy)

    project.add_log(
        operator=Handler.SYSTEM,
        action="坐标转换",
        details=f"根据原点({ox}, {oy})完成 {len(project.routes)} 条路线和 {len(project.safety_radii)} 个柜位的坐标转换"
    )


def check_origin_consistency(project: LayoutProject) -> Dict[str, Any]:
    """检查坐标原点一致性"""
    result = {
        "has_origin": project.coordinate_origin is not None,
        "origin_version": None,
        "needs_update": False,
        "issues": []
    }

    if not project.coordinate_origin:
        result["needs_update"] = True
        result["issues"].append("未设置坐标原点说明，所有路线长度计算可能存在基准偏差")
        return result

    origin = project.coordinate_origin
    result["origin_version"] = f"v{origin.version}"

    try:
        cal_date = datetime.strptime(origin.calibration_date, "%Y-%m-%d")
        days_since = (datetime.now() - cal_date).days
        if days_since > 365:
            result["needs_update"] = True
            result["issues"].append(f"坐标原点校准已超过 {days_since} 天，建议重新校准")
    except ValueError:
        result["issues"].append("校准日期格式不正确，应为 YYYY-MM-DD")

    if not origin.description or len(origin.description) < 10:
        result["needs_update"] = True
        result["issues"].append("坐标原点说明描述过于简略，建议补充校准基准、测量方法等信息")

    return result


def update_origin_notes(project: LayoutProject, notes: str) -> Optional[CoordinateOrigin]:
    """更新坐标原点备注"""
    if not project.coordinate_origin:
        return None

    project.coordinate_origin.notes = notes
    project.add_log(
        operator=Handler.PARK_OPS_XT,
        action="更新坐标原点备注",
        details=notes[:50] + ("..." if len(notes) > 50 else "")
    )
    return project.coordinate_origin
