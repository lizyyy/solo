"""服务层 - 编排核心三步流程"""
from typing import Dict, Any, Optional, List
from .models import LayoutProject, Handler
from .data_import import (
    import_safety_radius_csv, import_safety_radius_json,
    import_routes_csv, import_routes_json, validate_safety_radius_overlap
)
from .origin_manager import get_origin_info, check_origin_consistency, set_coordinate_origin
from .route_calculator import detect_route_issues, get_route_issue_summary
from .workflow import (
    process_issue_after_origin_check, get_workflow_status,
    client_review_issue, manual_fix_issue, rerun_issue, escalate_to_client
)
from .visualization import export_layout_screenshot, export_issue_detail_screenshot
from .demo_data import create_demo_project


def run_standard_three_step_process(
    safety_radius_path: Optional[str] = None,
    routes_path: Optional[str] = None,
    safety_radius_data: Optional[List[Dict[str, Any]]] = None,
    routes_data: Optional[List[Dict[str, Any]]] = None,
    origin_point: tuple = (0.0, 0.0),
    origin_description: str = "",
    origin_calibration_date: str = "",
    origin_calibrated_by: str = "园区运维小陶",
    output_dir: str = "./output",
    use_demo: bool = False
) -> Dict[str, Any]:
    """
    执行标准三步流程：
    1. 安全半径表第一次导入
    2. 园区运维小陶补看坐标原点说明
    3. 导出截图更新

    关键细节：碰到补录路线没有重新计算长度时，别急着归正常，留给展陈客户复核
    """
    result = {
        "step_results": {},
        "issues_found": [],
        "exported_files": {},
        "workflow_status": None
    }

    if use_demo:
        project = create_demo_project()
        result["step_results"]["demo_initialized"] = True
    else:
        project = LayoutProject(project_id="PROJ-" + str(__import__('time').time()).split('.')[0])

    print("\n" + "="*60)
    print("📍 步骤1：安全半径表第一次导入")
    print("="*60)

    if not use_demo:
        if safety_radius_path:
            import_safety_radius_csv(safety_radius_path, project)
        elif safety_radius_data:
            import_safety_radius_json(safety_radius_data, project)

        if routes_path:
            import_routes_csv(routes_path, project)
        elif routes_data:
            import_routes_json(routes_data, project)

        if not project.coordinate_origin:
            set_coordinate_origin(
                project=project,
                origin_point=origin_point,
                description=origin_description or "默认坐标原点，请补充校准说明",
                calibration_date=origin_calibration_date or __import__('datetime').datetime.now().strftime("%Y-%m-%d"),
                calibrated_by=origin_calibrated_by
            )

        overlap_issues = validate_safety_radius_overlap(project)
        detect_route_issues(project)

    result["step_results"]["step1_import"] = {
        "cabinets_count": len(project.safety_radii),
        "routes_count": len(project.routes),
        "overlap_issues": validate_safety_radius_overlap(project) if not use_demo else [],
        "initial_issues_count": len(project.issues)
    }
    print(f"✅ 导入完成：{len(project.safety_radii)} 个柜位，{len(project.routes)} 条路线")
    if project.issues:
        print(f"⚠️  检测到 {len(project.issues)} 个初始问题")

    print("\n" + "="*60)
    print("📍 步骤2：园区运维小陶补看坐标原点说明")
    print("="*60)

    origin_info = get_origin_info(project)
    origin_check = check_origin_consistency(project)

    result["step_results"]["step2_origin_check"] = {
        "origin_info": origin_info,
        "origin_check": origin_check
    }

    print(f"📌 坐标原点版本: {origin_info['version'] if origin_info else '未设置'}")
    if origin_info:
        print(f"📍 原点位置: {origin_info['origin_point']}")
        print(f"📝 说明: {origin_info['description']}")
        print(f"🔍 校准日期: {origin_info['calibration_date']}")
        print(f"👤 校准人: {origin_info['calibrated_by']}")
        print(f"💡 影响评估: {origin_info['impact']}")

    if origin_check["needs_update"]:
        print(f"⚠️  原点需要更新: {origin_check['issues']}")

    pending_issues = [i for i in project.issues if i.status.value in ["已检测", "已人工修正"]]
    for issue in pending_issues:
        print(f"\n🔧 处理问题 {issue.issue_id}...")
        process_result = process_issue_after_origin_check(
            project=project,
            issue_id=issue.issue_id,
            operator=Handler.PARK_OPS_XT
        )
        print(f"   已执行: {process_result['actions_taken']}")
        print(f"   当前状态: {issue.status.value}")
        print(f"   下一步处理人: {issue.current_handler.value}")

    result["step_results"]["step2_processed_issues"] = len(pending_issues)

    print("\n" + "="*60)
    print("📍 步骤3：导出截图更新")
    print("="*60)

    import os
    os.makedirs(output_dir, exist_ok=True)

    main_screenshot = f"{output_dir}/layout_report_step3.png"
    export_layout_screenshot(project, main_screenshot)
    print(f"🖼️  主布局报告已导出: {main_screenshot}")

    detail_screenshots = []
    for issue in project.issues:
        if issue.status.value != "已解决":
            detail_path = f"{output_dir}/issue_{issue.issue_id}_detail.png"
            export_issue_detail_screenshot(project, issue.issue_id, detail_path)
            detail_screenshots.append(detail_path)
            print(f"🖼️  问题详情已导出: {detail_path}")

    result["exported_files"] = {
        "main_report": main_screenshot,
        "issue_details": detail_screenshots
    }

    result["step_results"]["step3_export"] = {
        "main_report": main_screenshot,
        "detail_screenshots_count": len(detail_screenshots)
    }

    result["workflow_status"] = get_workflow_status(project)
    result["issues_found"] = [
        {
            "issue_id": i.issue_id,
            "type": i.issue_type.value,
            "status": i.status.value,
            "current_handler": i.current_handler.value,
            "why_kept": i.why_kept(),
            "missing_info": i.missing_info(),
            "next_step": i.next_step(),
            "route_id": i.route_id
        }
        for i in project.issues
    ]

    print("\n" + "="*60)
    print("📋 流程总结")
    print("="*60)
    ws = result["workflow_status"]
    print(f"总问题数: {ws['total_issues']}")
    print(f"待展陈客户复核: {ws['pending_client']}")
    print(f"待园区运维处理: {ws['pending_ops']}")
    print(f"流程是否完成: {'是' if ws['workflow_complete'] else '否，还有问题待客户复核'}")

    for issue in result["issues_found"]:
        if issue["status"] != "已解决":
            print(f"\n⚠️  {issue['issue_id']} - {issue['type']}")
            print(f"   📍 状态: {issue['status']}")
            print(f"   👤 当前处理: {issue['current_handler']}")
            print(f"   ❓ 为什么被留下: {issue['why_kept']}")
            print(f"   📋 还缺材料: {issue['missing_info']}")
            print(f"   👉 下一步: {issue['next_step']}")

    result["project"] = project
    return result


def get_project_summary(project: LayoutProject) -> Dict[str, Any]:
    """获取项目摘要信息"""
    return {
        "project_id": project.project_id,
        "project_name": project.project_name,
        "version": f"v{project.version}",
        "created_at": project.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "cabinets_count": len(project.safety_radii),
        "routes_count": len(project.routes),
        "issues_count": len(project.issues),
        "has_origin": project.coordinate_origin is not None,
        "origin_version": f"v{project.coordinate_origin.version}" if project.coordinate_origin else None,
        "issue_summary": get_route_issue_summary(project),
        "workflow": get_workflow_status(project)
    }


def get_project_serializable(project: LayoutProject) -> Dict[str, Any]:
    """获取可序列化的项目数据（用于API返回）"""
    return {
        "project_id": project.project_id,
        "project_name": project.project_name,
        "version": project.version,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "safety_radii": [
            {
                "cabinet_id": c.cabinet_id,
                "cabinet_name": c.cabinet_name,
                "position": c.position,
                "safety_radius": c.safety_radius,
                "chemical_type": c.chemical_type,
                "hazard_level": c.hazard_level
            }
            for c in project.safety_radii
        ],
        "coordinate_origin": {
            "version": project.coordinate_origin.version,
            "origin_point": project.coordinate_origin.origin_point,
            "description": project.coordinate_origin.description,
            "calibration_date": project.coordinate_origin.calibration_date,
            "calibrated_by": project.coordinate_origin.calibrated_by,
            "notes": project.coordinate_origin.notes
        } if project.coordinate_origin else None,
        "routes": [
            {
                "route_id": r.route_id,
                "route_name": r.route_name,
                "start_point": r.start_point,
                "end_point": r.end_point,
                "via_points": r.via_points,
                "calculated_length": r.calculated_length,
                "manual_input_length": r.manual_input_length,
                "is_supplementary": r.is_supplementary,
                "length_matched": r.length_matched,
                "has_issue": any(i.route_id == r.route_id and i.status.value != "已解决" for i in project.issues)
            }
            for r in project.routes
        ],
        "issues": [
            {
                "issue_id": i.issue_id,
                "issue_type": i.issue_type.value,
                "route_id": i.route_id,
                "description": i.description,
                "status": i.status.value,
                "detected_at": i.detected_at.isoformat() if i.detected_at else None,
                "current_handler": i.current_handler.value,
                "missing_materials": i.missing_materials,
                "why_kept": i.why_kept(),
                "missing_info": i.missing_info(),
                "next_step": i.next_step(),
                "fix_notes": i.fix_notes,
                "review_notes": i.review_notes,
                "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None
            }
            for i in project.issues
        ],
        "operation_logs": [
            {
                "timestamp": log.timestamp.isoformat(),
                "operator": log.operator.value,
                "action": log.action,
                "details": log.details
            }
            for log in project.operation_logs
        ],
        "summary": get_project_summary(project)
    }
