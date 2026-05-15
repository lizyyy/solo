import json
from typing import Optional, Dict, Any, Tuple
from datetime import datetime
from .models import SubmissionMaterial, DriftConclusion, CheckStatus
from .storage import StorageManager
from .checker import PermissionDriftChecker


class SubmissionResult:
    def __init__(self, success: bool, is_duplicate: bool, conclusion: Optional[DriftConclusion] = None,
                 existing_material: Optional[SubmissionMaterial] = None, conflict_info: Optional[str] = None):
        self.success = success
        self.is_duplicate = is_duplicate
        self.conclusion = conclusion
        self.existing_material = existing_material
        self.conflict_info = conflict_info


class MaterialProcessor:
    def __init__(self, storage_manager: Optional[StorageManager] = None):
        self.storage = storage_manager or StorageManager()
        self.checker = PermissionDriftChecker()
    
    def process_material(self, raw_data: Dict[str, Any], batch_id: str, title: str,
                        department: str, submitter: str) -> SubmissionResult:
        material_hash = self.storage.calculate_material_hash(raw_data)
        
        existing_material = self.storage.get_submission_by_hash(material_hash)
        if existing_material:
            existing_conclusion = self.storage.get_conclusion_by_submission(existing_material.submission_id)
            
            same_batch = existing_material.batch_id == batch_id
            if same_batch:
                return SubmissionResult(
                    success=True,
                    is_duplicate=True,
                    conclusion=existing_conclusion,
                    existing_material=existing_material,
                    conflict_info=f"相同材料已在同一批次中提交，提交ID: {existing_material.submission_id}"
                )
            else:
                return SubmissionResult(
                    success=False,
                    is_duplicate=True,
                    conclusion=existing_conclusion,
                    existing_material=existing_material,
                    conflict_info=f"冲突：相同材料已存在于其他批次！现有批次: {existing_material.batch_id}, 新批次: {batch_id}"
                )
        
        material = self._parse_material(raw_data, batch_id, title, department, submitter, material_hash)
        
        self.storage.save_submission(material)
        
        conclusion = self.checker.check(material)
        self.storage.save_conclusion(conclusion)
        
        return SubmissionResult(
            success=True,
            is_duplicate=False,
            conclusion=conclusion,
            existing_material=material
        )
    
    def _parse_material(self, raw_data: Dict[str, Any], batch_id: str, title: str,
                       department: str, submitter: str, material_hash: str) -> SubmissionMaterial:
        from .models import DevicePermissionItem, ApprovalNode, MeetingAttachment, ApprovalStatus
        
        permission_items = []
        for item_data in raw_data.get("permission_items", []):
            permission_items.append(DevicePermissionItem(**item_data))
        
        approval_nodes = []
        for node_data in raw_data.get("approval_nodes", []):
            if "approved_at" in node_data and node_data["approved_at"]:
                node_data["approved_at"] = datetime.fromisoformat(node_data["approved_at"])
            approval_nodes.append(ApprovalNode(**node_data))
        
        meeting_attachments = []
        for att_data in raw_data.get("meeting_attachments", []):
            meeting_attachments.append(MeetingAttachment(**att_data))
        
        return SubmissionMaterial(
            batch_id=batch_id,
            title=title,
            department=department,
            submitter=submitter,
            permission_items=permission_items,
            approval_nodes=approval_nodes,
            meeting_attachments=meeting_attachments,
            material_hash=material_hash,
            raw_data=raw_data
        )
    
    def get_conclusion_by_submission(self, submission_id: str) -> Optional[DriftConclusion]:
        return self.storage.get_conclusion_by_submission(submission_id)
    
    def get_submission_by_id(self, submission_id: str) -> Optional[SubmissionMaterial]:
        return self.storage.get_submission(submission_id)
    
    def query_by_approval_node(self, node_id: Optional[str] = None, node_name: Optional[str] = None,
                               batch_id: Optional[str] = None) -> list:
        results = []
        
        submissions = []
        if batch_id:
            submissions = self.storage.get_submissions_by_batch(batch_id)
        else:
            submissions = self.storage.get_all_submissions()
        
        for submission in submissions:
            for node in submission.approval_nodes:
                match = True
                if node_id and node.node_id != node_id:
                    match = False
                if node_name and node_name not in node.node_name:
                    match = False
                
                if match:
                    conclusion = self.storage.get_conclusion_by_submission(submission.submission_id)
                    results.append({
                        "submission": submission,
                        "node": node,
                        "conclusion": conclusion
                    })
        
        return results
    
    def export_results(self, output_format: str = "json", batch_id: Optional[str] = None) -> Any:
        if output_format not in ["json", "dict"]:
            raise ValueError(f"不支持的导出格式: {output_format}")
        
        export_data = []
        
        if batch_id:
            submissions = self.storage.get_submissions_by_batch(batch_id)
        else:
            submissions = self.storage.get_all_submissions()
        
        for submission in submissions:
            conclusion = self.storage.get_conclusion_by_submission(submission.submission_id)
            
            item_export = {
                "submission_id": submission.submission_id,
                "batch_id": submission.batch_id,
                "title": submission.title,
                "department": submission.department,
                "submitter": submission.submitter,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "overall_status": conclusion.overall_status.value if conclusion else None,
                "permission_items_count": len(submission.permission_items),
                "check_results": [],
                "meeting_attachments": [],
                "approval_nodes": []
            }
            
            if conclusion:
                for cr in conclusion.check_results:
                    item_export["check_results"].append({
                        "check_id": cr.check_id,
                        "check_name": cr.check_name,
                        "status": cr.status.value,
                        "message": cr.message,
                        "details": cr.details,
                        "affected_items": cr.affected_items
                    })
            
            for att in submission.meeting_attachments:
                item_export["meeting_attachments"].append({
                    "file_name": att.file_name,
                    "content_before": att.content_before,
                    "content_after": att.content_after,
                    "modification_note": att.modification_note
                })
            
            for node in submission.approval_nodes:
                item_export["approval_nodes"].append({
                    "node_id": node.node_id,
                    "node_name": node.node_name,
                    "approver": node.approver,
                    "status": node.status.value,
                    "comment": node.comment,
                    "approved_at": node.approved_at.isoformat() if node.approved_at else None,
                    "attachment_before": node.attachment_before,
                    "attachment_after": node.attachment_after
                })
            
            export_data.append(item_export)
        
        if output_format == "json":
            return json.dumps(export_data, ensure_ascii=False, indent=2)
        
        return export_data
