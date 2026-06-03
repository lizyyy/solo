import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from .models import (
    PointCloudLog,
    SafetyRadiusTable,
    CoordinateIssue,
    SiteNote,
    WorkflowStep,
    init_db
)
from .coord_detector import CoordinateDetector, CoordDetectionResult

class GaugeInspectionWorkflow:
    def __init__(self):
        init_db()

    def step1_import_point_cloud_log(self, log_no: str, items: List[Dict[str, Any]],
                                      imported_by: str = "system") -> Tuple[PointCloudLog, List[Dict[str, Any]]]:
        WorkflowStep.start_step(1, imported_by)
        
        log = PointCloudLog.create(log_no, items, imported_by)
        
        detection_results = CoordinateDetector.batch_detect(items)
        
        issues_with_notes = []
        
        for item, detection in detection_results:
            issue = CoordinateIssue.create(
                point_cloud_log_id=log.id,
                item_identifier=item["identifier"],
                original_coord_x=item["x"],
                original_coord_y=item["y"],
                original_coord_z=item.get("z"),
                coord_type_detected=detection.coord_type,
                is_mixed=detection.is_mixed,
                status="pending_inspection",
                reserved_for_inspection=True
            )
            
            why_kept, missing_materials, next_action, contact_person = self._generate_site_note_content(
                issue, detection, has_safety_radius=False
            )
            
            site_note = SiteNote.create(
                issue_id=issue.id,
                why_kept=why_kept,
                missing_materials=missing_materials,
                next_action=next_action,
                contact_person=contact_person
            )
            
            issues_with_notes.append({
                "issue": issue,
                "detection": detection,
                "site_note": site_note
            })
        
        WorkflowStep.complete_step(1, f"导入{len(items)}条点云数据，发现{len([x for x in issues_with_notes if x['issue'].is_mixed])}条坐标混合问题")
        
        return log, issues_with_notes

    def step2_review_safety_radius_table(self, table_no: str, items: List[Dict[str, Any]],
                                         reviewed_by: str = "ajing") -> Tuple[SafetyRadiusTable, List[Dict[str, Any]]]:
        WorkflowStep.start_step(2, reviewed_by)
        
        table = SafetyRadiusTable.create(table_no, items, reviewed_by)
        
        latest_log = PointCloudLog.get_latest()
        if not latest_log:
            raise ValueError("请先导入点云抽稀日志，再补录安全半径表")
        
        existing_issues = CoordinateIssue.get_by_point_cloud_log_id(latest_log.id)
        
        id_to_safety_item = {item["identifier"]: item for item in items}
        
        updated_issues_with_notes = []
        
        for issue in existing_issues:
            safety_item = id_to_safety_item.get(issue.item_identifier)
            
            if safety_item:
                detection = CoordinateDetector.detect(
                    str(safety_item["x"]),
                    str(safety_item["y"]),
                    str(safety_item.get("z")) if safety_item.get("z") else None
                )
                
                issue.update_status(
                    "ajing_reviewed",
                    safety_radius_table_id=table.id
                )
                
                issue.coord_type_detected = detection.coord_type
                issue.is_mixed = detection.is_mixed
                issue.original_coord_x = str(safety_item["x"])
                issue.original_coord_y = str(safety_item["y"])
                if safety_item.get("z"):
                    issue.original_coord_z = str(safety_item["z"])
                
                why_kept, missing_materials, next_action, contact_person = self._generate_site_note_content(
                    issue, detection, has_safety_radius=True,
                    safety_radius=safety_item.get("safety_radius")
                )
                
                existing_note = SiteNote.get_by_issue_id(issue.id)
                if existing_note:
                    updated_note = existing_note.update(
                        why_kept=why_kept,
                        missing_materials=missing_materials,
                        next_action=next_action,
                        contact_person=contact_person
                    )
                else:
                    updated_note = SiteNote.create(
                        issue_id=issue.id,
                        why_kept=why_kept,
                        missing_materials=missing_materials,
                        next_action=next_action,
                        contact_person=contact_person
                    )
                
                updated_issues_with_notes.append({
                    "issue": issue,
                    "detection": detection,
                    "site_note": updated_note,
                    "safety_item": safety_item
                })
            else:
                updated_issues_with_notes.append({
                    "issue": issue,
                    "detection": None,
                    "site_note": SiteNote.get_by_issue_id(issue.id),
                    "safety_item": None,
                    "warning": f"点云项【{issue.item_identifier}】在安全半径表中找不到对应记录，保持原状留给巡检组"
                })
        
        WorkflowStep.complete_step(2, f"阿景已复核{len(items)}条安全半径数据，关联{len(updated_issues_with_notes)}条问题记录")
        
        return table, updated_issues_with_notes

    def step3_finalize_for_site_team(self, inspector_name: str = "巡检组") -> List[Dict[str, Any]]:
        WorkflowStep.start_step(3, inspector_name)
        
        all_issues = CoordinateIssue.get_all()
        finalized_notes = []
        
        for issue in all_issues:
            if issue.status == "ajing_reviewed" and issue.is_mixed:
                issue.update_status("pending_final_inspection")
                
                existing_note = SiteNote.get_by_issue_id(issue.id)
                if existing_note:
                    updated_note = existing_note.update(
                        next_action="请巡检组现场复核坐标系统一性，确认是经纬度还是米制，如需坐标转换找阿景",
                        contact_person="巡检组（如需技术支持找展陈设计师阿景）"
                    )
                else:
                    updated_note = SiteNote.create(
                        issue_id=issue.id,
                        why_kept="坐标系统存疑",
                        missing_materials="现场实测坐标确认",
                        next_action="请巡检组现场复核坐标系统一性，确认是经纬度还是米制，如需坐标转换找阿景",
                        contact_person="巡检组（如需技术支持找展陈设计师阿景）"
                    )
                finalized_notes.append({
                    "issue": issue,
                    "site_note": updated_note,
                    "action_required": True
                })
            elif issue.status == "ajing_reviewed" and not issue.is_mixed:
                issue.update_status("ready_for_construction")
                
                existing_note = SiteNote.get_by_issue_id(issue.id)
                if existing_note:
                    updated_note = existing_note.update(
                        next_action="坐标系统已确认，可安排现场施工",
                        contact_person="现场班组"
                    )
                else:
                    updated_note = SiteNote.create(
                        issue_id=issue.id,
                        why_kept="坐标系统已确认统一",
                        missing_materials=None,
                        next_action="坐标系统已确认，可安排现场施工",
                        contact_person="现场班组"
                    )
                finalized_notes.append({
                    "issue": issue,
                    "site_note": updated_note,
                    "action_required": False
                })
            else:
                finalized_notes.append({
                    "issue": issue,
                    "site_note": SiteNote.get_by_issue_id(issue.id),
                    "action_required": True,
                    "note": "此条尚未经过阿景复核，保持待巡检状态"
                })
        
        WorkflowStep.complete_step(3, f"已为现场班组更新{len(finalized_notes)}条说明，其中{len([x for x in finalized_notes if x['action_required']])}条需进一步处理")
        
        return finalized_notes

    def _generate_site_note_content(self, issue: CoordinateIssue, detection: CoordDetectionResult,
                                     has_safety_radius: bool, safety_radius: Optional[str] = None
                                     ) -> Tuple[str, str, str, str]:
        if detection.is_mixed:
            why_kept_parts = [
                f"点云项【{issue.item_identifier}】检测到坐标系统混合"
            ]
            why_kept_parts.append(f"X轴({detection.raw_x})判定为{detection.x_type}")
            why_kept_parts.append(f"Y轴({detection.raw_y})判定为{detection.y_type}")
            if detection.z_type:
                why_kept_parts.append(f"Z轴({detection.raw_z})判定为{detection.z_type}")
            why_kept = "；".join(why_kept_parts)
            
            missing_parts = []
            if not has_safety_radius:
                missing_parts.append("安全半径表未补录")
            missing_parts.append("现场坐标系统确认（经纬度/米制二选一）")
            missing_materials = "、".join(missing_parts) if missing_parts else None
            
            if has_safety_radius:
                next_action = "请巡检组先复核坐标系统一性，别急着归正常，确认无误后再处理；如需坐标转换公式找阿景"
                contact_person = "巡检组（坐标转换找展陈设计师阿景）"
            else:
                next_action = "先等展陈设计师阿景补录安全半径表，之后巡检组再复核坐标系统"
                contact_person = "展陈设计师阿景（补安全半径表）→ 巡检组（复核坐标）"
        
        else:
            if detection.coord_type == "lonlat":
                why_kept = f"点云项【{issue.item_identifier}】坐标系统判定为经纬度，限界计算需确认投影参数"
            elif detection.coord_type == "meter":
                why_kept = f"点云项【{issue.item_identifier}】坐标系统判定为米制，可直接用于限界计算"
            else:
                why_kept = f"点云项【{issue.item_identifier}】坐标系统存疑，需人工确认"
            
            if not has_safety_radius:
                missing_materials = "安全半径表未补录"
                next_action = "等展陈设计师阿景补录安全半径表后，再确认是否可施工"
                contact_person = "展陈设计师阿景"
            else:
                if safety_radius:
                    why_kept += f"，安全半径{safety_radius}米已确认"
                missing_materials = None
                next_action = "坐标系统一，安全半径已补，可移交现场班组施工"
                contact_person = "现场班组"
        
        return why_kept, missing_materials, next_action, contact_person

    def get_workflow_status(self) -> List[Dict[str, Any]]:
        steps = WorkflowStep.get_all()
        return [
            {
                "step_order": s.step_order,
                "step_name": s.step_name,
                "status": s.status,
                "started_time": s.started_time,
                "completed_time": s.completed_time,
                "operator": s.operator,
                "remark": s.remark
            }
            for s in steps
        ]

    def get_all_issues_with_notes(self) -> List[Dict[str, Any]]:
        issues = CoordinateIssue.get_all()
        result = []
        for issue in issues:
            note = SiteNote.get_by_issue_id(issue.id)
            result.append({
                "issue": issue,
                "site_note": note
            })
        return result

    def reset_workflow(self) -> None:
        WorkflowStep.reset_all()

    def get_point_cloud_logs(self) -> List[PointCloudLog]:
        conn = __import__('sqlite3').connect(self._get_db_path())
        conn.row_factory = __import__('sqlite3').Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM point_cloud_logs ORDER BY id DESC")
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for row in rows:
            data = dict(row)
            items = json.loads(data["raw_data"])
            logs.append(PointCloudLog(
                id=data["id"],
                log_no=data["log_no"],
                import_time=data["import_time"],
                imported_by=data["imported_by"],
                raw_data=data["raw_data"],
                status=data["status"],
                remark=data["remark"],
                items=[__import__('dataclasses').make_dataclass('PointCloudItem', list(items[0].keys()))(**item) if items else None for item in items]
            ))
        return logs

    def _get_db_path(self) -> str:
        return os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "db", "gauge_inspection.db")
