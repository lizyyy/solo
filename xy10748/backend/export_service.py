from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import pandas as pd
from io import BytesIO
from backend.models import FormSubmission, User, Workflow
from backend.services import WorkflowService


class ExportService:
    @staticmethod
    def export_submissions(db: Session, filters: Dict[str, Any] = None) -> BytesIO:
        submissions = db.query(FormSubmission).order_by(FormSubmission.created_at.desc()).all()
        
        if filters:
            if filters.get("status"):
                submissions = [s for s in submissions if s.status == filters["status"]]
            if filters.get("submitter_id"):
                submissions = [s for s in submissions if s.submitter_id == filters["submitter_id"]]
            if filters.get("start_date"):
                start_date = datetime.fromisoformat(filters["start_date"])
                submissions = [s for s in submissions if s.created_at >= start_date]
            if filters.get("end_date"):
                end_date = datetime.fromisoformat(filters["end_date"])
                submissions = [s for s in submissions if s.created_at <= end_date]
        
        grouped_data = ExportService.group_submissions(submissions, db)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            for group_name, data in grouped_data.items():
                df = pd.DataFrame(data)
                df.to_excel(writer, sheet_name=group_name[:31], index=False)
        
        output.seek(0)
        return output
    
    @staticmethod
    def group_submissions(submissions: List[FormSubmission], db: Session) -> Dict[str, List[Dict[str, Any]]]:
        by_approver = {}
        by_date = {}
        by_node = {}
        
        for submission in submissions:
            workflow = WorkflowService.get_workflow(db, submission.workflow_id)
            
            base_data = {
                "申请编号": submission.submission_no,
                "申请人": submission.submitter.name if submission.submitter else "未知",
                "申请人部门": submission.submitter.department if submission.submitter else "未知",
                "状态": ExportService.get_status_text(submission.status),
                "提交时间": submission.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "更新时间": submission.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
                "是否超时提醒": "是" if submission.timeout_reminded else "否",
                "是否撤回": "是" if submission.is_withdrawn else "否",
                "重提次数": submission.resubmit_count
            }
            
            form_data = submission.form_data or {}
            for key, value in form_data.items():
                base_data[f"表单字段_{key}"] = str(value)
            
            approval_history = submission.approval_history or []
            
            for approval in approval_history:
                if approval.get("action") in ["approve", "reject"]:
                    approver_id = approval.get("approver_id")
                    approver = db.query(User).filter(User.id == approver_id).first()
                    approver_name = approver.name if approver else "未知"
                    
                    approver_data = base_data.copy()
                    approver_data.update({
                        "审批节点": approval.get("node_name", ""),
                        "审批人": approver_name,
                        "审批动作": "通过" if approval.get("action") == "approve" else "拒绝",
                        "审批意见": approval.get("comment", ""),
                        "审批时间": approval.get("timestamp", "")
                    })
                    
                    if approver_name not in by_approver:
                        by_approver[approver_name] = []
                    by_approver[approver_name].append(approver_data)
            
            date_key = submission.created_at.strftime("%Y-%m")
            if date_key not in by_date:
                by_date[date_key] = []
            by_date[date_key].append(base_data)
            
            if workflow:
                for node in workflow.nodes:
                    if node.get("type") == "approval":
                        node_name = node.get("name", "未命名节点")
                        node_data = base_data.copy()
                        node_data["审批节点"] = node_name
                        node_data["节点审批人"] = ", ".join([
                            db.query(User).filter(User.id == uid).first().name 
                            if db.query(User).filter(User.id == uid).first() 
                            else str(uid) 
                            for uid in node.get("approvers", [])
                        ])
                        
                        if node_name not in by_node:
                            by_node[node_name] = []
                        by_node[node_name].append(node_data)
                        break
        
        result = {}
        if by_approver:
            for name, data in by_approver.items():
                result[f"按审批人_{name}"] = data
        
        if by_date:
            for date, data in by_date.items():
                result[f"按月份_{date}"] = data
        
        if by_node:
            for node_name, data in by_node.items():
                result[f"按节点_{node_name[:20]}"] = data
        
        all_data = []
        for submission in submissions:
            row = {
                "申请编号": submission.submission_no,
                "申请人": submission.submitter.name if submission.submitter else "未知",
                "部门": submission.submitter.department if submission.submitter else "未知",
                "状态": ExportService.get_status_text(submission.status),
                "提交时间": submission.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "超时提醒": "是" if submission.timeout_reminded else "否",
                "已撤回": "是" if submission.is_withdrawn else "否",
                "重提次数": submission.resubmit_count
            }
            form_data = submission.form_data or {}
            for key, value in form_data.items():
                row[key] = str(value)
            all_data.append(row)
        
        if all_data:
            result["全部数据"] = all_data
        
        return result
    
    @staticmethod
    def get_status_text(status: str) -> str:
        status_map = {
            "draft": "草稿",
            "pending": "审批中",
            "approved": "已通过",
            "rejected": "已拒绝",
            "withdrawn": "已撤回"
        }
        return status_map.get(status, status)
