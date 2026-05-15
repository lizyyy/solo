from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from models import (
    SDKVersion, InterfaceDiff, ExampleProject, CompatibilityMatrix,
    ReleaseTask, RollbackNote, StatusHistory, CompensationAction,
    ReleaseStatus
)
from schemas import (
    SDKVersionCreate, SDKVersionUpdate, StatusTransition,
    ReleaseValidationResult, ValidationErrorDetail,
    InterfaceDiffUpdate, ExampleProjectUpdate, CompatibilityMatrixUpdate,
    ReleaseTaskUpdate, RollbackNoteCreate, CompensationActionCreate
)
from typing import List, Optional
from datetime import datetime
import json
import uuid


class ReleaseValidationService:
    @staticmethod
    def validate_version_gate(db: Session, sdk_version: SDKVersion) -> ReleaseValidationResult:
        result = ReleaseValidationResult(valid=True)
        
        if not sdk_version.version or len(sdk_version.version.strip()) == 0:
            result.errors.append(ValidationErrorDetail(
                field="version",
                message="版本号不能为空",
                severity="error"
            ))
            result.valid = False
        
        existing = db.query(SDKVersion).filter(
            and_(
                SDKVersion.sdk_name == sdk_version.sdk_name,
                SDKVersion.version == sdk_version.version,
                SDKVersion.id != sdk_version.id if sdk_version.id else True
            )
        ).first()
        if existing:
            result.errors.append(ValidationErrorDetail(
                field="version",
                message=f"SDK {sdk_version.sdk_name} {sdk_version.version} 已存在",
                severity="error"
            ))
            result.valid = False
        
        if not sdk_version.changelog or len(sdk_version.changelog.strip()) == 0:
            result.warnings.append(ValidationErrorDetail(
                field="changelog",
                message="建议填写变更日志",
                severity="warning"
            ))
        
        return result
    
    @staticmethod
    def validate_examples(db: Session, sdk_version: SDKVersion) -> ReleaseValidationResult:
        result = ReleaseValidationResult(valid=True)
        
        examples = db.query(ExampleProject).filter(
            ExampleProject.sdk_version_id == sdk_version.id
        ).all()
        
        if len(examples) == 0:
            result.warnings.append(ValidationErrorDetail(
                field="example_projects",
                message="建议至少关联一个示例项目",
                severity="warning"
            ))
        
        for example in examples:
            if not example.verified:
                result.warnings.append(ValidationErrorDetail(
                    field=f"example_{example.id}",
                    message=f"示例项目 '{example.project_name}' 尚未验证",
                    severity="warning"
                ))
            if example.build_status != "success":
                result.warnings.append(ValidationErrorDetail(
                    field=f"example_{example.id}_build",
                    message=f"示例项目 '{example.project_name}' 构建未成功",
                    severity="warning"
                ))
            if example.test_status != "success":
                result.warnings.append(ValidationErrorDetail(
                    field=f"example_{example.id}_test",
                    message=f"示例项目 '{example.project_name}' 测试未通过",
                    severity="warning"
                ))
        
        return result
    
    @staticmethod
    def validate_compatibility(db: Session, sdk_version: SDKVersion) -> ReleaseValidationResult:
        result = ReleaseValidationResult(valid=True)
        
        matrix = db.query(CompatibilityMatrix).filter(
            CompatibilityMatrix.sdk_version_id == sdk_version.id
        ).all()
        
        if len(matrix) == 0:
            result.errors.append(ValidationErrorDetail(
                field="compatibility_matrix",
                message="必须填写兼容矩阵",
                severity="error"
            ))
            result.valid = False
        
        for item in matrix:
            if not item.confirmed:
                result.errors.append(ValidationErrorDetail(
                    field=f"compatibility_{item.id}",
                    message=f"平台 '{item.platform}' 的兼容性尚未确认",
                    severity="error"
                ))
                result.valid = False
        
        return result
    
    @staticmethod
    def validate_tasks(db: Session, sdk_version: SDKVersion) -> ReleaseValidationResult:
        result = ReleaseValidationResult(valid=True)
        
        tasks = db.query(ReleaseTask).filter(
            ReleaseTask.sdk_version_id == sdk_version.id
        ).all()
        
        for task in tasks:
            if task.status != "completed":
                result.errors.append(ValidationErrorDetail(
                    field=f"task_{task.id}",
                    message=f"发布任务 '{task.task_name}' 尚未完成",
                    severity="error"
                ))
                result.valid = False
            
            if task.dependency_task_ids:
                for dep_id in task.dependency_task_ids:
                    dep_task = db.query(ReleaseTask).filter(
                        and_(
                            ReleaseTask.id == dep_id,
                            ReleaseTask.sdk_version_id == sdk_version.id
                        )
                    ).first()
                    if dep_task and dep_task.status != "completed":
                        result.errors.append(ValidationErrorDetail(
                            field=f"task_{task.id}_dependency",
                            message=f"任务 '{task.task_name}' 依赖的任务 '{dep_task.task_name}' 未完成",
                            severity="error"
                        ))
                        result.valid = False
        
        return result
    
    @staticmethod
    def validate_for_status(db: Session, sdk_version: SDKVersion, target_status: ReleaseStatus) -> ReleaseValidationResult:
        final_result = ReleaseValidationResult(valid=True)
        
        version_check = ReleaseValidationService.validate_version_gate(db, sdk_version)
        final_result.errors.extend(version_check.errors)
        final_result.warnings.extend(version_check.warnings)
        if not version_check.valid:
            final_result.valid = False
        
        if target_status in [ReleaseStatus.EXAMPLES_VERIFIED, ReleaseStatus.APPROVED, ReleaseStatus.PUBLISHED]:
            examples_check = ReleaseValidationService.validate_examples(db, sdk_version)
            final_result.errors.extend(examples_check.errors)
            final_result.warnings.extend(examples_check.warnings)
        
        if target_status in [ReleaseStatus.COMPATIBILITY_CONFIRMED, ReleaseStatus.APPROVED, ReleaseStatus.PUBLISHED]:
            compat_check = ReleaseValidationService.validate_compatibility(db, sdk_version)
            final_result.errors.extend(compat_check.errors)
            final_result.warnings.extend(compat_check.warnings)
            if not compat_check.valid:
                final_result.valid = False
        
        if target_status in [ReleaseStatus.APPROVED, ReleaseStatus.PUBLISHED]:
            tasks_check = ReleaseValidationService.validate_tasks(db, sdk_version)
            final_result.errors.extend(tasks_check.errors)
            final_result.warnings.extend(tasks_check.warnings)
            if not tasks_check.valid:
                final_result.valid = False
        
        return final_result


class SDKVersionService:
    @staticmethod
    def create_sdk_version(db: Session, sdk_data: SDKVersionCreate) -> SDKVersion:
        idempotency_key = sdk_data.idempotency_key or str(uuid.uuid4())
        
        existing = db.query(SDKVersion).filter(
            SDKVersion.request_idempotency_key == idempotency_key
        ).first()
        if existing:
            return existing
        
        db_sdk = SDKVersion(
            version=sdk_data.version,
            sdk_name=sdk_data.sdk_name,
            language=sdk_data.language,
            changelog=sdk_data.changelog,
            release_notes=sdk_data.release_notes,
            created_by=sdk_data.created_by,
            request_idempotency_key=idempotency_key
        )
        db.add(db_sdk)
        db.flush()
        
        for diff_data in sdk_data.interface_diffs:
            db_diff = InterfaceDiff(
                sdk_version_id=db_sdk.id,
                **diff_data.model_dump()
            )
            db.add(db_diff)
        
        for example_data in sdk_data.example_projects:
            db_example = ExampleProject(
                sdk_version_id=db_sdk.id,
                **example_data.model_dump()
            )
            db.add(db_example)
        
        for compat_data in sdk_data.compatibility_matrix:
            db_compat = CompatibilityMatrix(
                sdk_version_id=db_sdk.id,
                **compat_data.model_dump()
            )
            db.add(db_compat)
        
        for task_data in sdk_data.release_tasks:
            db_task = ReleaseTask(
                sdk_version_id=db_sdk.id,
                **task_data.model_dump()
            )
            db.add(db_task)
        
        db.commit()
        db.refresh(db_sdk)
        return db_sdk
    
    @staticmethod
    def get_sdk_version(db: Session, sdk_id: int) -> Optional[SDKVersion]:
        return db.query(SDKVersion).filter(SDKVersion.id == sdk_id).first()
    
    @staticmethod
    def list_sdk_versions(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status: Optional[ReleaseStatus] = None,
        sdk_name: Optional[str] = None
    ) -> List[SDKVersion]:
        query = db.query(SDKVersion)
        if status:
            query = query.filter(SDKVersion.status == status)
        if sdk_name:
            query = query.filter(SDKVersion.sdk_name.contains(sdk_name))
        return query.order_by(SDKVersion.created_at.desc()).offset(skip).limit(limit).all()
    
    @staticmethod
    def transition_status(
        db: Session,
        sdk_id: int,
        transition: StatusTransition
    ) -> SDKVersion:
        db_sdk = SDKVersionService.get_sdk_version(db, sdk_id)
        if not db_sdk:
            raise ValueError(f"SDK版本 {sdk_id} 不存在")
        
        validation = ReleaseValidationService.validate_for_status(
            db, db_sdk, transition.new_status
        )
        if not validation.valid:
            error_messages = "; ".join([f"{e.field}: {e.message}" for e in validation.errors])
            raise ValueError(f"状态转换验证失败: {error_messages}")
        
        previous_data = {
            "status": db_sdk.status,
            "updated_at": db_sdk.updated_at.isoformat() if db_sdk.updated_at else None
        }
        
        history = StatusHistory(
            sdk_version_id=sdk_id,
            from_status=db_sdk.status,
            to_status=transition.new_status,
            changed_by=transition.changed_by,
            reason=transition.reason,
            previous_data=previous_data
        )
        db.add(history)
        
        db_sdk.status = transition.new_status
        db.commit()
        db.refresh(db_sdk)
        return db_sdk
    
    @staticmethod
    def mark_dirty(db: Session, sdk_id: int, reason: str) -> SDKVersion:
        db_sdk = SDKVersionService.get_sdk_version(db, sdk_id)
        if not db_sdk:
            raise ValueError(f"SDK版本 {sdk_id} 不存在")
        
        db_sdk.is_dirty = True
        db_sdk.dirty_reason = reason
        db.commit()
        db.refresh(db_sdk)
        return db_sdk
    
    @staticmethod
    def clean_dirty(db: Session, sdk_id: int) -> SDKVersion:
        db_sdk = SDKVersionService.get_sdk_version(db, sdk_id)
        if not db_sdk:
            raise ValueError(f"SDK版本 {sdk_id} 不存在")
        
        db_sdk.is_dirty = False
        db_sdk.dirty_reason = None
        db.commit()
        db.refresh(db_sdk)
        return db_sdk


class CompensationService:
    @staticmethod
    def create_compensation_action(
        db: Session,
        sdk_id: int,
        action_data: CompensationActionCreate,
        executed_by: str
    ) -> CompensationAction:
        action = CompensationAction(
            sdk_version_id=sdk_id,
            action_type=action_data.action_type,
            description=action_data.description,
            status="pending",
            executed_by=executed_by
        )
        db.add(action)
        db.commit()
        db.refresh(action)
        return action
    
    @staticmethod
    def execute_compensation(db: Session, action_id: int) -> CompensationAction:
        action = db.query(CompensationAction).filter(CompensationAction.id == action_id).first()
        if not action:
            raise ValueError(f"补偿动作 {action_id} 不存在")
        
        try:
            action.status = "executing"
            db.commit()
            
            action.status = "completed"
            action.executed_at = datetime.utcnow()
            action.result = "补偿动作执行成功"
            
            sdk = db.query(SDKVersion).filter(SDKVersion.id == action.sdk_version_id).first()
            if sdk and sdk.is_dirty:
                sdk.is_dirty = False
                sdk.dirty_reason = None
            
            db.commit()
        except Exception as e:
            action.status = "failed"
            action.error_details = str(e)
            db.commit()
        
        db.refresh(action)
        return action
    
    @staticmethod
    def rollback_release(db: Session, sdk_id: int, rollback_data: RollbackNoteCreate, rolled_back_by: str) -> SDKVersion:
        db_sdk = SDKVersionService.get_sdk_version(db, sdk_id)
        if not db_sdk:
            raise ValueError(f"SDK版本 {sdk_id} 不存在")
        
        rollback_note = RollbackNote(
            sdk_version_id=sdk_id,
            reason=rollback_data.reason,
            rollback_version=rollback_data.rollback_version,
            affected_components=rollback_data.affected_components,
            resolution_plan=rollback_data.resolution_plan,
            rolled_back_by=rolled_back_by
        )
        db.add(rollback_note)
        
        history = StatusHistory(
            sdk_version_id=sdk_id,
            from_status=db_sdk.status,
            to_status=ReleaseStatus.ROLLED_BACK,
            changed_by=rolled_back_by,
            reason=rollback_data.reason
        )
        db.add(history)
        
        db_sdk.status = ReleaseStatus.ROLLED_BACK
        db.commit()
        db.refresh(db_sdk)
        return db_sdk


class ExportService:
    @staticmethod
    def export_release_record(db: Session, sdk_id: int) -> dict:
        db_sdk = SDKVersionService.get_sdk_version(db, sdk_id)
        if not db_sdk:
            raise ValueError(f"SDK版本 {sdk_id} 不存在")
        
        return {
            "sdk_version": {
                "id": db_sdk.id,
                "version": db_sdk.version,
                "sdk_name": db_sdk.sdk_name,
                "language": db_sdk.language,
                "status": db_sdk.status,
                "changelog": db_sdk.changelog,
                "release_notes": db_sdk.release_notes,
                "created_by": db_sdk.created_by,
                "created_at": db_sdk.created_at.isoformat()
            },
            "interface_diffs": [
                {
                    "interface_name": diff.interface_name,
                    "change_type": diff.change_type,
                    "breaking_change": diff.breaking_change,
                    "verified": diff.verified
                }
                for diff in db_sdk.interface_diffs
            ],
            "example_projects": [
                {
                    "project_name": proj.project_name,
                    "language": proj.language,
                    "verified": proj.verified,
                    "build_status": proj.build_status,
                    "test_status": proj.test_status
                }
                for proj in db_sdk.example_projects
            ],
            "compatibility_matrix": [
                {
                    "platform": item.platform,
                    "min_version": item.min_version,
                    "max_version": item.max_version,
                    "supported": item.supported,
                    "confirmed": item.confirmed
                }
                for item in db_sdk.compatibility_matrix
            ],
            "release_tasks": [
                {
                    "task_name": task.task_name,
                    "assignee": task.assignee,
                    "status": task.status,
                    "priority": task.priority
                }
                for task in db_sdk.release_tasks
            ],
            "status_history": [
                {
                    "from_status": h.from_status,
                    "to_status": h.to_status,
                    "changed_by": h.changed_by,
                    "changed_at": h.changed_at.isoformat(),
                    "reason": h.reason
                }
                for h in db_sdk.status_history
            ]
        }
