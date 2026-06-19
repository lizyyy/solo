"""状态流转引擎 - 处理人工修正、重跑、展陈客户复核"""
from typing import Optional, Dict, Any, List
from datetime import datetime
from .models import (
    LayoutProject, IssueRecord,
    IssueStatus, IssueType, Handler
)
from .route_calculator import recalculate_route_length


def fill_material(
    project: LayoutProject,
    issue_id: str,
    material_name: str,
    fill_note: str,
    operator: Handler = Handler.PARK_OPS_XT
) -> Optional[IssueRecord]:
    """
    园区运维小陶/系统/展陈客户补齐某项材料
    例如：补录路线长度确认凭证、坐标原点校准记录、客户复核确认
    """
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)
    if not issue:
        return None

    issue.fill_material(material_name, fill_note, operator)

    project.add_log(
        operator=operator,
        action="补齐材料",
        details=f"问题 {issue_id} 已补齐材料：{material_name} - {fill_note}"
    )

    return issue


def manual_fix_issue(
    project: LayoutProject,
    issue_id: str,
    fix_notes: str,
    operator: Handler = Handler.PARK_OPS_XT,
    corrected_value: Optional[float] = None
) -> Optional[IssueRecord]:
    """
    园区运维小陶人工修正问题
    修正后状态变为 MANUAL_FIXED，但不直接解决，留待后续重跑验证
    自动标记：坐标原点说明确认、路线长度校验记录
    """
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)
    if not issue:
        return None

    issue.status = IssueStatus.MANUAL_FIXED
    issue.current_handler = Handler.SYSTEM
    issue.fix_notes = fix_notes

    if corrected_value is not None and issue.issue_type == IssueType.ROUTE_NOT_RECALCULATED:
        from .route_calculator import update_route_manual_length
        update_route_manual_length(project, issue.route_id, corrected_value, operator)
        issue.fill_material(
            "路线长度校验记录",
            f"人工修正录入值={corrected_value}米，修正说明：{fix_notes}",
            operator
        )
    else:
        issue.fill_material(
            "路线长度校验记录",
            f"人工修正：{fix_notes}",
            operator
        )

    issue.fill_material(
        "坐标原点说明确认",
        f"已由{operator.value}核对坐标原点说明，确认校准记录完整",
        operator
    )

    project.add_log(
        operator=operator,
        action="人工修正",
        details=f"问题 {issue_id}：{fix_notes}"
    )

    return issue


def rerun_issue(
    project: LayoutProject,
    issue_id: str,
    operator: Handler = Handler.SYSTEM
) -> Optional[IssueRecord]:
    """
    重跑问题 - 重新计算路线长度
    重跑后状态变为 RERUN，仍不直接标记为已解决，
    因为关键问题（补录路线未重算）需要留给展陈客户复核
    自动标记：系统重跑计算结果、重新计算后的路线长度确认凭证
    """
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)
    if not issue:
        return None

    if issue.issue_type == IssueType.ROUTE_NOT_RECALCULATED:
        route = recalculate_route_length(project, issue.route_id)
        if route and route.manual_input_length and route.calculated_length:
            diff = abs(route.calculated_length - route.manual_input_length)
            issue.fill_material(
                "系统重跑计算结果",
                f"系统重算={route.calculated_length}米，录入={route.manual_input_length}米，差值={round(diff, 2)}米",
                Handler.SYSTEM
            )
            issue.fill_material(
                "重新计算后的路线长度确认凭证",
                f"系统于{datetime.now().strftime('%Y-%m-%d %H:%M')}重算，结果{route.calculated_length}米",
                Handler.SYSTEM
            )
            if diff > 0.5:
                issue.status = IssueStatus.RERUN
                issue.current_handler = Handler.EXHIBITION_CLIENT
                issue.description += f" | 重跑后计算值：{route.calculated_length}米，与录入值差{round(diff, 2)}米"
                project.add_log(
                    operator=operator,
                    action="重跑验证",
                    details=f"问题 {issue_id} 重跑完成，差异{round(diff, 2)}米，已流转至展陈客户复核"
                )
            else:
                issue.status = IssueStatus.RERUN
                issue.current_handler = Handler.EXHIBITION_CLIENT
                project.add_log(
                    operator=operator,
                    action="重跑验证",
                    details=f"问题 {issue_id} 重跑完成，差值在容差内，仍需展陈客户最终确认"
                )
        else:
            if route and route.calculated_length:
                issue.fill_material(
                    "系统重跑计算结果",
                    f"系统重算={route.calculated_length}米",
                    Handler.SYSTEM
                )
                issue.fill_material(
                    "重新计算后的路线长度确认凭证",
                    f"系统于{datetime.now().strftime('%Y-%m-%d %H:%M')}重算，结果{route.calculated_length}米",
                    Handler.SYSTEM
                )
            issue.status = IssueStatus.RERUN
            issue.current_handler = Handler.EXHIBITION_CLIENT
            project.add_log(
                operator=operator,
                action="重跑验证",
                details=f"问题 {issue_id} 重跑完成，待展陈客户复核"
            )
    else:
        issue.status = IssueStatus.RERUN
        issue.current_handler = Handler.EXHIBITION_CLIENT
        project.add_log(
            operator=operator,
            action="重跑验证",
            details=f"问题 {issue_id} 重跑完成，待展陈客户复核"
        )

    return issue


def client_review_issue(
    project: LayoutProject,
    issue_id: str,
    approved: bool,
    review_notes: str,
    operator: Handler = Handler.EXHIBITION_CLIENT
) -> Optional[IssueRecord]:
    """
    展陈客户复核问题
    只有客户确认后才能标记为 RESOLVED
    通过时自动补齐：展陈客户复核确认、展陈客户对补录差异的复核确认
    通过时设置 resolved_note，保证 why_kept 有闭环说明
    """
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)
    if not issue:
        return None

    issue.review_notes = review_notes

    if approved:
        issue.status = IssueStatus.RESOLVED
        issue.current_handler = Handler.SYSTEM
        issue.resolved_at = datetime.now()

        issue.fill_material(
            "展陈客户复核确认",
            f"展陈客户于{datetime.now().strftime('%Y-%m-%d %H:%M')}复核通过：{review_notes}",
            operator
        )
        issue.fill_material(
            "展陈客户对补录差异的复核确认",
            f"已确认重跑结果：{review_notes}",
            operator
        )
        issue.fill_material(
            "坐标原点校准记录",
            f"由园区运维小陶提交，展陈客户认可校准记录有效性",
            operator
        )

        issue.resolved_note = (
            f"展陈客户于{issue.resolved_at.strftime('%Y-%m-%d %H:%M')}复核通过，"
            f"意见：{review_notes}。所有材料已补齐，流程闭环。"
        )

        project.add_log(
            operator=operator,
            action="客户复核通过",
            details=f"问题 {issue_id} 已通过复核：{review_notes}，所有材料已标记补齐"
        )
    else:
        issue.status = IssueStatus.DETECTED
        issue.current_handler = Handler.PARK_OPS_XT
        project.add_log(
            operator=operator,
            action="客户复核驳回",
            details=f"问题 {issue_id} 复核不通过，退回运维处理：{review_notes}"
        )

    return issue


def escalate_to_client(
    project: LayoutProject,
    issue_id: str,
    operator: Handler = Handler.PARK_OPS_XT
) -> Optional[IssueRecord]:
    """
    园区运维小陶将问题升级给展陈客户复核
    用于：小陶看完坐标原点说明后，确认需要客户确认的问题
    自动补齐：坐标原点校准记录（小陶已提交）
    """
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)
    if not issue:
        return None

    issue.status = IssueStatus.PENDING_REVIEW
    issue.current_handler = Handler.EXHIBITION_CLIENT

    issue.fill_material(
        "坐标原点校准记录",
        f"园区运维小陶于{datetime.now().strftime('%Y-%m-%d %H:%M')}提交坐标原点校准记录，转展陈客户复核",
        operator
    )

    project.add_log(
        operator=operator,
        action="流转客户复核",
        details=f"问题 {issue_id} 已由园区运维小陶流转至展陈客户复核，坐标原点校准记录已补齐"
    )

    return issue


def process_issue_after_origin_check(
    project: LayoutProject,
    issue_id: str,
    operator: Handler = Handler.PARK_OPS_XT
) -> Dict[str, Any]:
    """
    园区运维小陶看完坐标原点说明后的标准处理流程：
    1. 检查坐标原点说明是否完整
    2. 如果问题是补录路线未重算 -> 先重跑 -> 再流转给客户复核（不自动解决）
    3. 如果是其他问题 -> 人工修正后重跑
    """
    from .origin_manager import check_origin_consistency

    origin_check = check_origin_consistency(project)
    issue = next((i for i in project.issues if i.issue_id == issue_id), None)

    if not issue:
        return {"error": "问题不存在"}

    result = {
        "issue_id": issue_id,
        "origin_check": origin_check,
        "actions_taken": [],
        "current_status": None,
        "next_handler": None
    }

    if origin_check["needs_update"]:
        result["warnings"] = origin_check["issues"]
        result["actions_taken"].append("检测到坐标原点说明需要更新")

    if issue.issue_type == IssueType.ROUTE_NOT_RECALCULATED:
        rerun_issue(project, issue_id, operator)
        result["actions_taken"].append("已重跑路线长度计算")
        result["actions_taken"].append("已流转至展陈客户复核（未自动归正常）")
    else:
        result["actions_taken"].append("需人工修正后再重跑")

    result["current_status"] = issue.status
    result["next_handler"] = issue.current_handler

    project.add_log(
        operator=operator,
        action="坐标原点检查后处理",
        details=f"问题 {issue_id} 处理完成，已执行：{','.join(result['actions_taken'])}"
    )

    return result


def get_workflow_status(project: LayoutProject) -> Dict[str, Any]:
    """获取整体工作流状态"""
    status_counts = {}
    handler_counts = {}

    for issue in project.issues:
        status_counts[issue.status] = status_counts.get(issue.status, 0) + 1
        handler_counts[issue.current_handler] = handler_counts.get(issue.current_handler, 0) + 1

    return {
        "total_issues": len(project.issues),
        "by_status": status_counts,
        "by_handler": handler_counts,
        "pending_client": sum(1 for i in project.issues if i.current_handler == Handler.EXHIBITION_CLIENT),
        "pending_ops": sum(1 for i in project.issues if i.current_handler == Handler.PARK_OPS_XT),
        "workflow_complete": len(project.issues) > 0 and all(
            i.status == IssueStatus.RESOLVED for i in project.issues
        )
    }


def get_issue_timeline(issue: IssueRecord) -> List[Dict[str, Any]]:
    """获取问题的时间线（用于导出说明）——按事件顺序，含材料补齐记录"""
    timeline = []

    timeline.append({
        "time": issue.detected_at.strftime("%Y-%m-%d %H:%M:%S"),
        "actor": "系统",
        "action": "问题检测",
        "description": issue.description
    })

    if issue.fix_notes:
        timeline.append({
            "time": "人工修正时",
            "actor": Handler.PARK_OPS_XT.value,
            "action": "人工修正",
            "description": issue.fix_notes
        })

    for mat in issue.filled_materials:
        note = issue.material_fill_notes.get(mat, "")
        actor_val = "系统"
        if note.startswith("[") and "]" in note:
            actor_val = note[1:note.index("]")]
            note = note[note.index("]") + 1:].strip()
        timeline.append({
            "time": "材料补齐",
            "actor": actor_val,
            "action": f"补齐材料: {mat}",
            "description": note or mat
        })

    if issue.status in [IssueStatus.RERUN, IssueStatus.RESOLVED]:
        timeline.append({
            "time": "重跑时",
            "actor": "系统",
            "action": "重跑验证",
            "description": "重新计算路线长度"
        })

    if issue.review_notes:
        timeline.append({
            "time": "复核时",
            "actor": Handler.EXHIBITION_CLIENT.value,
            "action": "客户复核",
            "description": issue.review_notes
        })

    if issue.resolved_at:
        timeline.append({
            "time": issue.resolved_at.strftime("%Y-%m-%d %H:%M:%S"),
            "actor": "系统",
            "action": "问题解决",
            "description": issue.resolved_note or "流程完成"
        })

    return timeline
