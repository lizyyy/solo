"""路线长度计算与问题检测模块"""
from typing import List, Tuple, Dict, Any, Optional
from datetime import datetime
from .models import (
    RouteRecord, LayoutProject, IssueRecord,
    IssueType, IssueStatus, Handler
)


def calculate_segment_length(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """计算两点间距离"""
    dx = p1[0] - p2[0]
    dy = p1[1] - p2[1]
    return (dx ** 2 + dy ** 2) ** 0.5


def calculate_route_length(route: RouteRecord) -> float:
    """计算路线总长度（含途经点）"""
    total = 0.0
    points = [route.start_point] + route.via_points + [route.end_point]

    for i in range(len(points) - 1):
        total += calculate_segment_length(points[i], points[i + 1])

    return round(total, 2)


def recalculate_route_length(project: LayoutProject, route_id: str) -> Optional[RouteRecord]:
    """重新计算指定路线长度"""
    route = next((r for r in project.routes if r.route_id == route_id), None)
    if not route:
        return None

    new_length = calculate_route_length(route)
    route.calculated_length = new_length
    route.last_calculated_at = datetime.now()
    route.last_updated_at = datetime.now()

    if route.manual_input_length is not None:
        tolerance = 0.01
        route.length_matched = abs(route.calculated_length - route.manual_input_length) <= tolerance

    project.add_log(
        operator=Handler.SYSTEM,
        action="重算路线长度",
        details=f"路线 {route.route_name}({route_id}) 重新计算长度: {new_length}米"
    )
    return route


def recalculate_all_routes(project: LayoutProject) -> List[RouteRecord]:
    """重新计算所有路线长度"""
    updated = []
    for route in project.routes:
        new_length = calculate_route_length(route)
        route.calculated_length = new_length
        route.last_calculated_at = datetime.now()
        route.last_updated_at = datetime.now()

        if route.manual_input_length is not None:
            tolerance = 0.01
            route.length_matched = abs(route.calculated_length - route.manual_input_length) <= tolerance

        updated.append(route)

    project.add_log(
        operator=Handler.SYSTEM,
        action="批量重算路线",
        details=f"已重新计算 {len(updated)} 条路线的长度"
    )
    return updated


def detect_route_issues(project: LayoutProject) -> List[IssueRecord]:
    """
    检测路线问题，重点：补录路线未重新计算长度
    检测到问题后状态设为 PENDING_REVIEW，留给展陈客户复核
    """
    issues = []
    issue_counter = len(project.issues) + 1

    for route in project.routes:
        if route.is_supplementary and route.calculated_length is None:
            issue = IssueRecord(
                issue_id=f"ISS-{issue_counter:03d}",
                issue_type=IssueType.ROUTE_NOT_RECALCULATED,
                route_id=route.route_id,
                description=f"补录路线「{route.route_name}」录入了人工长度 {route.manual_input_length}米，但未触发系统重新计算",
                status=IssueStatus.PENDING_REVIEW,
                current_handler=Handler.EXHIBITION_CLIENT,
                missing_materials=["重新计算后的路线长度确认凭证", "坐标原点校准记录"]
            )
            issues.append(issue)
            issue_counter += 1

        elif route.is_supplementary and route.calculated_length is not None and route.manual_input_length is not None:
            diff = abs(route.calculated_length - route.manual_input_length)
            if diff > 0.5:
                issue = IssueRecord(
                    issue_id=f"ISS-{issue_counter:03d}",
                    issue_type=IssueType.ROUTE_NOT_RECALCULATED,
                    route_id=route.route_id,
                    description=f"补录路线「{route.route_name}」人工录入({route.manual_input_length}米)与系统计算({route.calculated_length}米)差异过大，差值{round(diff, 2)}米",
                    status=IssueStatus.PENDING_REVIEW,
                    current_handler=Handler.EXHIBITION_CLIENT,
                    missing_materials=["长度差异说明", "现场复核记录"]
                )
                issues.append(issue)
                issue_counter += 1

        if route.manual_input_length and not route.is_supplementary:
            if route.calculated_length is None:
                issue = IssueRecord(
                    issue_id=f"ISS-{issue_counter:03d}",
                    issue_type=IssueType.WRONG_CALIBER,
                    route_id=route.route_id,
                    description=f"路线「{route.route_name}」有手工录入但未标记为补录，可能存在错口径问题",
                    status=IssueStatus.DETECTED,
                    current_handler=Handler.PARK_OPS_XT
                )
                issues.append(issue)
                issue_counter += 1

    project.issues.extend(issues)
    if issues:
        project.add_log(
            operator=Handler.SYSTEM,
            action="问题检测",
            details=f"检测到 {len(issues)} 个路线问题，其中 {sum(1 for i in issues if i.status == IssueStatus.PENDING_REVIEW)} 条已流转至展陈客户复核"
        )

    return issues


def update_route_manual_length(
    project: LayoutProject,
    route_id: str,
    manual_length: float,
    operator: Handler,
    is_supplementary: bool = True
) -> Optional[RouteRecord]:
    """更新路线的人工录入长度（补录）"""
    route = next((r for r in project.routes if r.route_id == route_id), None)
    if not route:
        return None

    route.manual_input_length = manual_length
    route.is_supplementary = is_supplementary
    route.last_updated_at = datetime.now()
    route.calculated_length = None
    route.last_calculated_at = None
    route.length_matched = None

    project.add_log(
        operator=operator,
        action="补录路线长度",
        details=f"路线 {route.route_name}({route_id}) 补录长度: {manual_length}米，系统计算长度已清空待重算"
    )

    return route


def get_route_issue_summary(project: LayoutProject) -> Dict[str, Any]:
    """获取路线问题汇总"""
    total = len(project.issues)
    pending_client = sum(1 for i in project.issues if i.status == IssueStatus.PENDING_REVIEW)
    pending_ops = sum(1 for i in project.issues if i.status == IssueStatus.DETECTED)
    resolved = sum(1 for i in project.issues if i.status == IssueStatus.RESOLVED)
    manual_fixed = sum(1 for i in project.issues if i.status == IssueStatus.MANUAL_FIXED)
    rerun = sum(1 for i in project.issues if i.status == IssueStatus.RERUN)

    return {
        "total_issues": total,
        "pending_client_review": pending_client,
        "pending_ops_processing": pending_ops,
        "manual_fixed": manual_fixed,
        "rerun": rerun,
        "resolved": resolved
    }
