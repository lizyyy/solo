from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import uuid
from backend.models import User, FormTemplate, Workflow, FormSubmission, ApprovalRecord, ValidationRule
from backend.schemas import (
    UserCreate, FormTemplateCreate, WorkflowCreate, FormSubmissionCreate,
    ApprovalRecordCreate, ValidationRuleCreate, ValidationResponse, ValidationErrorResponse
)


def generate_submission_no() -> str:
    return f"SUB{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


class UserService:
    @staticmethod
    def create_user(db: Session, user: UserCreate) -> User:
        db_user = User(**user.dict())
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    
    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_all_users(db: Session) -> List[User]:
        return db.query(User).all()


class FormTemplateService:
    @staticmethod
    def create_template(db: Session, template: FormTemplateCreate) -> FormTemplate:
        db_template = FormTemplate(**template.dict())
        db.add(db_template)
        db.commit()
        db.refresh(db_template)
        return db_template
    
    @staticmethod
    def get_template(db: Session, template_id: int) -> Optional[FormTemplate]:
        return db.query(FormTemplate).filter(FormTemplate.id == template_id).first()
    
    @staticmethod
    def get_all_templates(db: Session) -> List[FormTemplate]:
        return db.query(FormTemplate).filter(FormTemplate.is_active == True).all()


class WorkflowService:
    @staticmethod
    def create_workflow(db: Session, workflow: WorkflowCreate) -> Workflow:
        db_workflow = Workflow(**workflow.dict())
        db.add(db_workflow)
        db.commit()
        db.refresh(db_workflow)
        return db_workflow
    
    @staticmethod
    def get_workflow(db: Session, workflow_id: int) -> Optional[Workflow]:
        return db.query(Workflow).filter(Workflow.id == workflow_id).first()
    
    @staticmethod
    def get_all_workflows(db: Session) -> List[Workflow]:
        return db.query(Workflow).filter(Workflow.is_active == True).all()
    
    @staticmethod
    def get_start_node(workflow: Workflow) -> Optional[Dict[str, Any]]:
        for node in workflow.nodes:
            if node.get("type") == "start":
                return node
        return None
    
    @staticmethod
    def get_next_node(workflow: Workflow, current_node_id: str, form_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        outgoing_edges = [e for e in workflow.edges if e.get("source") == current_node_id]
        
        for edge in outgoing_edges:
            condition = edge.get("condition", {})
            if not condition or WorkflowService.evaluate_condition(condition, form_data):
                next_node_id = edge.get("target")
                for node in workflow.nodes:
                    if node.get("id") == next_node_id:
                        return node
        return None
    
    @staticmethod
    def evaluate_condition(condition: Dict[str, Any], form_data: Dict[str, Any]) -> bool:
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")
        field_value = form_data.get(field)
        
        if operator == "equals":
            return field_value == value
        elif operator == "not_equals":
            return field_value != value
        elif operator == "greater_than":
            return field_value > value if field_value and value else False
        elif operator == "less_than":
            return field_value < value if field_value and value else False
        elif operator == "contains":
            return value in str(field_value)
        elif operator == "not_contains":
            return value not in str(field_value)
        elif operator == "is_empty":
            return field_value is None or field_value == ""
        elif operator == "is_not_empty":
            return field_value is not None and field_value != ""
        return True


class ValidationService:
    @staticmethod
    def create_validation_rule(db: Session, rule: ValidationRuleCreate) -> ValidationRule:
        db_rule = ValidationRule(**rule.dict())
        db.add(db_rule)
        db.commit()
        db.refresh(db_rule)
        return db_rule
    
    @staticmethod
    def get_rules_for_workflow(db: Session, workflow_id: int) -> List[ValidationRule]:
        return db.query(ValidationRule).filter(ValidationRule.workflow_id == workflow_id).all()
    
    @staticmethod
    def validate_form_data(db: Session, workflow_id: int, form_data: Dict[str, Any], node_id: Optional[str] = None) -> ValidationResponse:
        errors = []
        rules = ValidationService.get_rules_for_workflow(db, workflow_id)
        
        for rule in rules:
            if node_id and rule.node_id != node_id:
                continue
            
            field_value = form_data.get(rule.field_name)
            rule_config = rule.rule_config
            
            is_valid = True
            if rule.rule_type == "required":
                if field_value is None or field_value == "":
                    is_valid = False
            elif rule.rule_type == "min_length":
                if field_value and len(str(field_value)) < rule_config.get("min", 0):
                    is_valid = False
            elif rule.rule_type == "max_length":
                if field_value and len(str(field_value)) > rule_config.get("max", 9999):
                    is_valid = False
            elif rule.rule_type == "min_value":
                if field_value is not None and field_value < rule_config.get("min", 0):
                    is_valid = False
            elif rule.rule_type == "max_value":
                if field_value is not None and field_value > rule_config.get("max", 999999):
                    is_valid = False
            elif rule.rule_type == "pattern":
                import re
                if field_value and not re.match(rule_config.get("pattern", ""), str(field_value)):
                    is_valid = False
            elif rule.rule_type == "email":
                import re
                if field_value and not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", str(field_value)):
                    is_valid = False
            
            if not is_valid:
                errors.append(ValidationErrorResponse(
                    field=rule.field_name,
                    message=rule.error_message,
                    rule_type=rule.rule_type
                ))
        
        return ValidationResponse(valid=len(errors) == 0, errors=errors)


class FormSubmissionService:
    @staticmethod
    def create_submission(db: Session, submission: FormSubmissionCreate) -> FormSubmission:
        submission_no = generate_submission_no()
        
        existing = db.query(FormSubmission).filter(
            FormSubmission.form_template_id == submission.form_template_id,
            FormSubmission.submitter_id == submission.submitter_id,
            FormSubmission.form_data == submission.form_data,
            FormSubmission.status == "draft"
        ).first()
        
        if existing:
            return existing
        
        db_submission = FormSubmission(
            **submission.dict(),
            submission_no=submission_no,
            status="draft"
        )
        db.add(db_submission)
        db.commit()
        db.refresh(db_submission)
        return db_submission
    
    @staticmethod
    def submit_form(db: Session, submission_id: int) -> FormSubmission:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")
        
        workflow = WorkflowService.get_workflow(db, submission.workflow_id)
        if not workflow:
            raise ValueError("Workflow not found")
        
        validation_result = ValidationService.validate_form_data(db, submission.workflow_id, submission.form_data)
        if not validation_result.valid:
            raise ValueError(f"Validation failed: {[e.message for e in validation_result.errors]}")
        
        start_node = WorkflowService.get_start_node(workflow)
        if not start_node:
            raise ValueError("Workflow has no start node")
        
        next_node = WorkflowService.get_next_node(workflow, start_node.get("id"), submission.form_data)
        
        submission.status = "pending"
        submission.current_node_id = next_node.get("id") if next_node else None
        
        if next_node and next_node.get("type") == "end":
            submission.status = "approved"
            submission.current_node_id = None
        
        db.commit()
        db.refresh(submission)
        return submission
    
    @staticmethod
    def approve_submission(db: Session, submission_id: int, approver_id: int, comment: Optional[str] = None) -> FormSubmission:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")
        
        workflow = WorkflowService.get_workflow(db, submission.workflow_id)
        if not workflow:
            raise ValueError("Workflow not found")
        
        current_node = None
        for node in workflow.nodes:
            if node.get("id") == submission.current_node_id:
                current_node = node
                break
        
        if not current_node:
            raise ValueError("Current node not found")
        
        approvers = current_node.get("approvers", [])
        if approver_id not in approvers:
            raise ValueError("You are not authorized to approve this submission")
        
        approval_record = ApprovalRecord(
            submission_id=submission_id,
            node_id=submission.current_node_id,
            node_name=current_node.get("name", ""),
            approver_id=approver_id,
            action="approve",
            comment=comment
        )
        db.add(approval_record)
        
        approval_history = submission.approval_history or []
        approval_history.append({
            "node_id": submission.current_node_id,
            "node_name": current_node.get("name", ""),
            "approver_id": approver_id,
            "action": "approve",
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat()
        })
        submission.approval_history = approval_history
        
        next_node = WorkflowService.get_next_node(workflow, submission.current_node_id, submission.form_data)
        
        if next_node:
            if next_node.get("type") == "end":
                submission.status = "approved"
                submission.current_node_id = None
            else:
                submission.current_node_id = next_node.get("id")
        else:
            submission.status = "approved"
            submission.current_node_id = None
        
        db.commit()
        db.refresh(submission)
        return submission
    
    @staticmethod
    def reject_submission(db: Session, submission_id: int, approver_id: int, comment: Optional[str] = None) -> FormSubmission:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")
        
        workflow = WorkflowService.get_workflow(db, submission.workflow_id)
        if not workflow:
            raise ValueError("Workflow not found")
        
        current_node = None
        for node in workflow.nodes:
            if node.get("id") == submission.current_node_id:
                current_node = node
                break
        
        if not current_node:
            raise ValueError("Current node not found")
        
        approvers = current_node.get("approvers", [])
        if approver_id not in approvers:
            raise ValueError("You are not authorized to reject this submission")
        
        approval_record = ApprovalRecord(
            submission_id=submission_id,
            node_id=submission.current_node_id,
            node_name=current_node.get("name", ""),
            approver_id=approver_id,
            action="reject",
            comment=comment
        )
        db.add(approval_record)
        
        approval_history = submission.approval_history or []
        approval_history.append({
            "node_id": submission.current_node_id,
            "node_name": current_node.get("name", ""),
            "approver_id": approver_id,
            "action": "reject",
            "comment": comment,
            "timestamp": datetime.utcnow().isoformat()
        })
        submission.approval_history = approval_history
        submission.status = "rejected"
        
        db.commit()
        db.refresh(submission)
        return submission
    
    @staticmethod
    def withdraw_submission(db: Session, submission_id: int, user_id: int, reason: Optional[str] = None) -> FormSubmission:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")
        
        if submission.submitter_id != user_id:
            raise ValueError("Only the submitter can withdraw the submission")
        
        if submission.status not in ["pending", "draft"]:
            raise ValueError("Only pending or draft submissions can be withdrawn")
        
        submission.is_withdrawn = True
        submission.status = "withdrawn"
        
        approval_history = submission.approval_history or []
        approval_history.append({
            "action": "withdraw",
            "reason": reason,
            "timestamp": datetime.utcnow().isoformat()
        })
        submission.approval_history = approval_history
        
        db.commit()
        db.refresh(submission)
        return submission
    
    @staticmethod
    def resubmit_submission(db: Session, submission_id: int, form_data: Dict[str, Any]) -> FormSubmission:
        submission = db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")
        
        if not submission.is_withdrawn and submission.status != "rejected":
            raise ValueError("Only withdrawn or rejected submissions can be resubmitted")
        
        validation_result = ValidationService.validate_form_data(db, submission.workflow_id, form_data)
        if not validation_result.valid:
            raise ValueError(f"Validation failed: {[e.message for e in validation_result.errors]}")
        
        new_submission = FormSubmission(
            form_template_id=submission.form_template_id,
            workflow_id=submission.workflow_id,
            submitter_id=submission.submitter_id,
            form_data=form_data,
            submission_no=generate_submission_no(),
            status="draft",
            resubmit_count=submission.resubmit_count + 1,
            parent_submission_id=submission_id
        )
        db.add(new_submission)
        db.commit()
        db.refresh(new_submission)
        
        return FormSubmissionService.submit_form(db, new_submission.id)
    
    @staticmethod
    def get_submission(db: Session, submission_id: int) -> Optional[FormSubmission]:
        return db.query(FormSubmission).filter(FormSubmission.id == submission_id).first()
    
    @staticmethod
    def get_submissions_by_user(db: Session, user_id: int) -> List[FormSubmission]:
        return db.query(FormSubmission).filter(FormSubmission.submitter_id == user_id).order_by(FormSubmission.created_at.desc()).all()
    
    @staticmethod
    def get_all_submissions(db: Session) -> List[FormSubmission]:
        return db.query(FormSubmission).order_by(FormSubmission.created_at.desc()).all()
    
    @staticmethod
    def get_pending_approvals(db: Session, approver_id: int) -> List[FormSubmission]:
        submissions = db.query(FormSubmission).filter(
            FormSubmission.status == "pending",
            FormSubmission.is_withdrawn == False
        ).all()
        
        result = []
        for submission in submissions:
            workflow = WorkflowService.get_workflow(db, submission.workflow_id)
            if workflow:
                for node in workflow.nodes:
                    if node.get("id") == submission.current_node_id:
                        approvers = node.get("approvers", [])
                        if approver_id in approvers:
                            result.append(submission)
                        break
        return result
    
    @staticmethod
    def check_timeouts(db: Session, timeout_hours: int = 24) -> List[FormSubmission]:
        threshold = datetime.utcnow() - timedelta(hours=timeout_hours)
        submissions = db.query(FormSubmission).filter(
            FormSubmission.status == "pending",
            FormSubmission.is_withdrawn == False,
            FormSubmission.timeout_reminded == False,
            FormSubmission.updated_at < threshold
        ).all()
        
        for submission in submissions:
            submission.timeout_reminded = True
            
            approval_history = submission.approval_history or []
            approval_history.append({
                "action": "timeout_reminder",
                "message": f"Submission pending for more than {timeout_hours} hours",
                "timestamp": datetime.utcnow().isoformat()
            })
            submission.approval_history = approval_history
        
        db.commit()
        return submissions
