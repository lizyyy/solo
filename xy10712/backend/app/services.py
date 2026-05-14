from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from datetime import datetime
import re
from email_validator import validate_email, EmailNotValidError
from diff_match_patch import diff_match_patch

from .models import (
    EmailTemplate, TemplateVersion, EmailBatch, EmailRecord,
    VariableValidation, ApprovalRecord, BatchLog, CompensationRecord,
    TemplateStatus, BatchStatus, EmailStatus, ApprovalType, ApprovalStatus
)
from .schemas import (
    EmailTemplateCreate, EmailTemplateUpdate, EmailBatchCreate,
    EmailRecipient, TemplateDiff, VariableDef
)

class TemplateService:
    @staticmethod
    def create_template(db: Session, template_data: EmailTemplateCreate, created_by: str) -> EmailTemplate:
        template = EmailTemplate(
            name=template_data.name,
            subject=template_data.subject,
            content=template_data.content,
            variables=[v.model_dump() for v in template_data.variables],
            created_by=created_by
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        version = TemplateVersion(
            template_id=template.id,
            version=1,
            subject=template.subject,
            content=template.content,
            variables=template.variables,
            created_by=created_by,
            change_description="初始版本"
        )
        db.add(version)
        db.commit()

        return template

    @staticmethod
    def update_template(db: Session, template_id: int, update_data: EmailTemplateUpdate, updated_by: str) -> Optional[EmailTemplate]:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
        if not template:
            return None

        old_version = template.version
        new_version = old_version + 1

        version = TemplateVersion(
            template_id=template.id,
            version=new_version,
            subject=template.subject,
            content=template.content,
            variables=template.variables,
            created_by=updated_by,
            change_description=update_data.change_description or "更新模板"
        )
        db.add(version)

        if update_data.name is not None:
            template.name = update_data.name
        if update_data.subject is not None:
            template.subject = update_data.subject
        if update_data.content is not None:
            template.content = update_data.content
        if update_data.variables is not None:
            template.variables = [v.model_dump() for v in update_data.variables]
        
        template.version = new_version
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def get_template_diff(db: Session, template_id: int, version_old: int, version_new: int) -> List[TemplateDiff]:
        v1 = db.query(TemplateVersion).filter(
            TemplateVersion.template_id == template_id,
            TemplateVersion.version == version_old
        ).first()
        v2 = db.query(TemplateVersion).filter(
            TemplateVersion.template_id == template_id,
            TemplateVersion.version == version_new
        ).first()
        
        if not v1 or not v2:
            return []

        differences = []
        
        if v1.subject != v2.subject:
            differences.append(TemplateDiff(
                field="subject",
                old_value=v1.subject,
                new_value=v2.subject,
                change_type="修改"
            ))
        
        if v1.content != v2.content:
            differences.append(TemplateDiff(
                field="content",
                old_value=v1.content,
                new_value=v2.content,
                change_type="修改"
            ))
        
        v1_vars = {v["name"]: v for v in v1.variables}
        v2_vars = {v["name"]: v for v in v2.variables}
        
        for name in set(v1_vars.keys()) | set(v2_vars.keys()):
            if name not in v1_vars:
                differences.append(TemplateDiff(
                    field=f"variables.{name}",
                    old_value="",
                    new_value=str(v2_vars[name]),
                    change_type="新增变量"
                ))
            elif name not in v2_vars:
                differences.append(TemplateDiff(
                    field=f"variables.{name}",
                    old_value=str(v1_vars[name]),
                    new_value="",
                    change_type="删除变量"
                ))
            elif v1_vars[name] != v2_vars[name]:
                differences.append(TemplateDiff(
                    field=f"variables.{name}",
                    old_value=str(v1_vars[name]),
                    new_value=str(v2_vars[name]),
                    change_type="修改变量"
                ))
        
        return differences

class ValidationService:
    @staticmethod
    def validate_variable(value: Any, var_def: Dict) -> tuple[bool, Optional[str]]:
        if not value and var_def.get("required", True):
            return False, "该变量为必填项"
        
        if value is None:
            return True, None
        
        expected_type = var_def.get("type", "string")
        if expected_type == "email":
            try:
                validate_email(str(value))
            except EmailNotValidError:
                return False, "邮箱格式不正确"
        elif expected_type == "number":
            try:
                float(value)
            except (ValueError, TypeError):
                return False, "必须为数字类型"
        elif expected_type == "date":
            try:
                datetime.fromisoformat(str(value).replace('Z', '+00:00'))
            except ValueError:
                return False, "日期格式不正确"
        
        pattern = var_def.get("pattern")
        if pattern and value:
            if not re.match(pattern, str(value)):
                return False, f"格式不匹配规则: {pattern}"
        
        return True, None

    @staticmethod
    def validate_email_record(db: Session, email_id: int, template_variables: List[Dict]) -> List[VariableValidation]:
        email = db.query(EmailRecord).filter(EmailRecord.id == email_id).first()
        if not email:
            return []

        existing_validations = db.query(VariableValidation).filter(
            VariableValidation.email_id == email_id
        ).all()
        for v in existing_validations:
            db.delete(v)

        validations = []
        email_vars = email.variables or {}
        
        for var_def in template_variables:
            var_name = var_def["name"]
            var_value = str(email_vars.get(var_name, ""))
            is_valid, error_msg = ValidationService.validate_variable(
                email_vars.get(var_name),
                var_def
            )
            
            validation = VariableValidation(
                email_id=email_id,
                variable_name=var_name,
                variable_value=var_value,
                is_valid=is_valid,
                error_message=error_msg,
                recalculated_at=datetime.utcnow()
            )
            db.add(validation)
            validations.append(validation)
        
        db.commit()
        return validations

    @staticmethod
    def recalculate_validations(db: Session, batch_id: int):
        batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
        if not batch or not batch.template:
            return
        
        template_vars = batch.template.variables or []
        
        for email in batch.emails:
            ValidationService.validate_email_record(db, email.id, template_vars)
        
        invalid_count = db.query(VariableValidation).join(EmailRecord).filter(
            EmailRecord.batch_id == batch_id,
            VariableValidation.is_valid == False
        ).count()
        
        if invalid_count > 0:
            batch.status = BatchStatus.VALIDATION_FAILED
        else:
            batch.status = BatchStatus.READY
        
        db.commit()

class BatchService:
    @staticmethod
    def create_batch(db: Session, batch_data: EmailBatchCreate, created_by: str) -> EmailBatch:
        template = db.query(EmailTemplate).filter(EmailTemplate.id == batch_data.template_id).first()
        if not template:
            raise ValueError("模板不存在")

        batch = EmailBatch(
            name=batch_data.name,
            template_id=batch_data.template_id,
            template_version=template.version,
            total_stages=batch_data.total_stages,
            test_recipients=batch_data.test_recipients,
            created_by=created_by
        )
        db.add(batch)
        db.flush()

        for email in batch_data.test_recipients:
            email_record = EmailRecord(
                batch_id=batch.id,
                recipient_email=email,
                recipient_name="测试收件人",
                variables={},
                is_test=True,
                grayscale_stage=0
            )
            db.add(email_record)

        for recipient in batch_data.recipients:
            email_record = EmailRecord(
                batch_id=batch.id,
                recipient_email=recipient.email,
                recipient_name=recipient.name,
                variables=recipient.variables,
                is_test=False,
                grayscale_stage=0
            )
            db.add(email_record)

        batch.total_emails = len(batch_data.test_recipients) + len(batch_data.recipients)
        db.commit()
        db.refresh(batch)

        BatchService.add_log(db, batch.id, "创建批次", created_by, f"共 {batch.total_emails} 封邮件")

        return batch

    @staticmethod
    def add_log(db: Session, batch_id: int, action: str, operator: str, details: str = ""):
        log = BatchLog(
            batch_id=batch_id,
            action=action,
            operator=operator,
            details=details
        )
        db.add(log)
        db.commit()

    @staticmethod
    def advance_grayscale_stage(db: Session, batch_id: int, operator: str) -> EmailBatch:
        batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
        if not batch:
            raise ValueError("批次不存在")
        
        if batch.grayscale_stage >= batch.total_stages:
            raise ValueError("已完成所有灰度阶段")
        
        batch.grayscale_stage += 1
        
        stage_size = (batch.total_emails - len(batch.test_recipients)) // batch.total_stages
        start_idx = len(batch.test_recipients) + (batch.grayscale_stage - 1) * stage_size
        end_idx = len(batch.test_recipients) + batch.grayscale_stage * stage_size if batch.grayscale_stage < batch.total_stages else batch.total_emails
        
        emails_to_send = db.query(EmailRecord).filter(
            EmailRecord.batch_id == batch_id,
            EmailRecord.is_test == False,
            EmailRecord.id > start_idx,
            EmailRecord.id <= end_idx
        ).all()
        
        for email in emails_to_send:
            email.grayscale_stage = batch.grayscale_stage
        
        if batch.grayscale_stage == 1:
            batch.status = BatchStatus.IN_PROGRESS
        
        BatchService.add_log(db, batch_id, f"进入灰度阶段 {batch.grayscale_stage}/{batch.total_stages}", operator)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def intercept_batch(db: Session, batch_id: int, operator: str, reason: str) -> EmailBatch:
        batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
        if not batch:
            raise ValueError("批次不存在")
        
        batch.status = BatchStatus.INTERCEPTED
        
        pending_emails = db.query(EmailRecord).filter(
            EmailRecord.batch_id == batch_id,
            EmailRecord.status.in_([EmailStatus.PENDING, EmailStatus.RETRY])
        ).all()
        
        for email in pending_emails:
            email.status = EmailStatus.INTERCEPTED
        
        batch.intercepted_count = len(pending_emails)
        
        BatchService.add_log(db, batch_id, "拦截批次", operator, reason)
        db.commit()
        db.refresh(batch)
        return batch

    @staticmethod
    def start_compensation(db: Session, batch_id: int, operator: str, compensation_type: str, email_ids: Optional[List[int]] = None, details: str = "") -> List[CompensationRecord]:
        batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
        if not batch:
            raise ValueError("批次不存在")
        
        batch.status = BatchStatus.COMPENSATING
        
        query = db.query(EmailRecord).filter(
            EmailRecord.batch_id == batch_id,
            EmailRecord.status.in_([EmailStatus.FAILED, EmailStatus.INTERCEPTED])
        )
        
        if email_ids:
            query = query.filter(EmailRecord.id.in_(email_ids))
        
        failed_emails = query.all()
        compensation_records = []
        
        for email in failed_emails:
            compensation = CompensationRecord(
                batch_id=batch_id,
                original_email_id=email.id,
                compensation_type=compensation_type,
                status="pending",
                created_by=operator,
                details=details
            )
            db.add(compensation)
            compensation_records.append(compensation)
        
        BatchService.add_log(db, batch_id, "启动补偿流程", operator, f"类型: {compensation_type}, 数量: {len(compensation_records)}")
        db.commit()
        return compensation_records

    @staticmethod
    def mark_manual_review(db: Session, batch_id: int, operator: str) -> EmailBatch:
        batch = db.query(EmailBatch).filter(EmailBatch.id == batch_id).first()
        if not batch:
            raise ValueError("批次不存在")
        
        batch.status = BatchStatus.MANUAL_REVIEW
        BatchService.add_log(db, batch_id, "转入人工复核", operator)
        db.commit()
        db.refresh(batch)
        return batch

class StatisticsService:
    @staticmethod
    def get_statistics(db: Session) -> Dict[str, Any]:
        total_templates = db.query(EmailTemplate).count()
        total_batches = db.query(EmailBatch).count()
        total_emails_sent = db.query(func.sum(EmailBatch.sent_emails)).scalar() or 0
        total_success = db.query(func.sum(EmailBatch.success_count)).scalar() or 0
        success_rate = (total_success / total_emails_sent * 100) if total_emails_sent > 0 else 0
        
        pending_approvals = db.query(ApprovalRecord).filter(
            ApprovalRecord.status == ApprovalStatus.PENDING
        ).count()
        
        batches_in_progress = db.query(EmailBatch).filter(
            EmailBatch.status == BatchStatus.IN_PROGRESS
        ).count()

        monthly_stats = {}
        for i in range(6):
            month = datetime.now().replace(day=1) - __import__('datetime').timedelta(days=i*30)
            month_key = month.strftime("%Y-%m")
            month_batches = db.query(EmailBatch).filter(
                func.strftime("%Y-%m", EmailBatch.created_at) == month_key
            ).count()
            monthly_stats[month_key] = month_batches

        return {
            "total_templates": total_templates,
            "total_batches": total_batches,
            "total_emails_sent": total_emails_sent,
            "success_rate": round(success_rate, 2),
            "pending_approvals": pending_approvals,
            "batches_in_progress": batches_in_progress,
            "monthly_stats": monthly_stats
        }
