from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Set, Tuple
from pathlib import Path
import hashlib

from .models import (
    ActionItem, ActionItemStatus, OperationType, Meeting
)
from .parser import parse_meeting_content, ParsedMeeting, ParsedActionItem
from .repository import (
    ParticipantRepository, RoleRepository, ParticipantRoleRepository,
    MeetingRepository, ActionItemRepository, ImportRecordRepository,
    AuditLogRepository
)
from .database import compute_hash


@dataclass
class ValidationError:
    code: str
    message: str
    severity: str = "error"
    action_id: Optional[int] = None
    detail: Optional[str] = None


@dataclass
class ImportResult:
    success: bool
    meeting_id: Optional[int]
    action_count: int
    errors: List[ValidationError]
    warnings: List[ValidationError]
    skipped_duplicate: bool = False


@dataclass
class CheckResult:
    total_actions: int
    new_count: int
    overdue_count: int
    blocked_count: int
    done_count: int
    errors: List[ValidationError]
    warnings: List[ValidationError]


class MeetingService:
    @staticmethod
    def import_meeting(content: str, source_path: str = "", 
                       operator: str = "system",
                       force: bool = False) -> ImportResult:
        errors = []
        warnings = []
        
        content_hash = compute_hash(content)
        
        if ImportRecordRepository.exists(content_hash):
            existing = MeetingRepository.get_by_hash(content_hash)
            return ImportResult(
                success=True,
                meeting_id=existing.id if existing else None,
                action_count=0,
                errors=[],
                warnings=[ValidationError(
                    code="DUPLICATE_IMPORT",
                    message=f"该纪要已导入 (hash: {content_hash[:12]}...)",
                    severity="warning"
                )],
                skipped_duplicate=True
            )
        
        parsed = parse_meeting_content(content, source_path)
        
        known_participants = set(p.name for p in ParticipantRepository.get_all())
        
        invalid_assignees = []
        for item in parsed.action_items:
            for assignee in item.assignees:
                if assignee not in known_participants:
                    invalid_assignees.append(assignee)
        
        if invalid_assignees:
            for name in set(invalid_assignees):
                warnings.append(ValidationError(
                    code="UNKNOWN_ASSIGNEE",
                    message=f"负责人不在参会人名单中: {name}",
                    severity="warning",
                    detail=f"该负责人未在系统中注册，可能需要先添加到参会人名单"
                ))
        
        no_due_date = []
        for i, item in enumerate(parsed.action_items):
            if item.due_date is None:
                no_due_date.append(i + 1)
        
        if no_due_date:
            warnings.append(ValidationError(
                code="NO_DUE_DATE",
                message=f"以下行动项缺少截止日期: {', '.join(f'#{n}' for n in no_due_date)}",
                severity="warning",
                detail="缺少截止日期的行动项可能无法被有效追踪"
            ))
        
        meeting_date = parsed.meeting_date or date.today()
        attendees_str = ", ".join(parsed.attendees) if parsed.attendees else "未知"
        
        meeting_id = MeetingRepository.add(
            title=parsed.title,
            meeting_date=meeting_date,
            attendees=attendees_str,
            content_hash=content_hash,
            source_path=source_path,
            operator=operator
        )
        
        ImportRecordRepository.add(content_hash, source_path)
        
        action_count = 0
        for parsed_item in parsed.action_items:
            ActionItemRepository.add(
                meeting_id=meeting_id,
                description=parsed_item.description,
                assignees=parsed_item.assignees,
                due_date=parsed_item.due_date,
                dependencies=[],
                notes=f"原始行: {parsed_item.raw_line}" if parsed_item.raw_line else None,
                operator=operator
            )
            action_count += 1
        
        return ImportResult(
            success=True,
            meeting_id=meeting_id,
            action_count=action_count,
            errors=errors,
            warnings=warnings
        )
    
    @staticmethod
    def import_file(file_path: str, operator: str = "system",
                    force: bool = False) -> ImportResult:
        path = Path(file_path)
        if not path.exists():
            return ImportResult(
                success=False,
                meeting_id=None,
                action_count=0,
                errors=[ValidationError(
                    code="FILE_NOT_FOUND",
                    message=f"文件不存在: {file_path}",
                    severity="error"
                )],
                warnings=[]
            )
        content = path.read_text(encoding='utf-8')
        return MeetingService.import_meeting(
            content, source_path=str(path), operator=operator, force=force
        )


class ActionItemService:
    @staticmethod
    def check_all_status() -> CheckResult:
        today = date.today()
        all_actions = ActionItemRepository.get_all()
        
        errors = []
        warnings = []
        
        new_count = 0
        overdue_count = 0
        blocked_count = 0
        done_count = 0
        
        action_map = {item.id: item for item in all_actions}
        
        for action in all_actions:
            if action.due_date and action.due_date < today:
                if action.status not in [ActionItemStatus.DONE, ActionItemStatus.CANCELLED, ActionItemStatus.OVERDUE]:
                    ActionItemRepository.update_status(
                        action.id, ActionItemStatus.OVERDUE,
                        operator="system",
                        reason=f"自动标记: 截止日期 {action.due_date} 已过"
                    )
                    action.status = ActionItemStatus.OVERDUE
            
            if action.status == ActionItemStatus.OVERDUE:
                overdue_count += 1
            elif action.status == ActionItemStatus.DONE:
                done_count += 1
            elif action.status == ActionItemStatus.PENDING:
                new_count += 1
            
            if action.dependencies:
                incomplete_deps = []
                for dep_id in action.dependencies:
                    if dep_id in action_map:
                        dep = action_map[dep_id]
                        if dep.status not in [ActionItemStatus.DONE, ActionItemStatus.CANCELLED]:
                            incomplete_deps.append(dep_id)
                
                if incomplete_deps and action.status != ActionItemStatus.BLOCKED:
                    ActionItemRepository.update_status(
                        action.id, ActionItemStatus.BLOCKED,
                        operator="system",
                        reason=f"依赖未完成: {incomplete_deps}"
                    )
                    action.status = ActionItemStatus.BLOCKED
                
                if incomplete_deps:
                    blocked_count += 1
                    errors.append(ValidationError(
                        code="BLOCKED_BY_DEPENDENCY",
                        message=f"行动项 #{action.id} 被阻塞",
                        severity="error",
                        action_id=action.id,
                        detail=f"依赖的行动项未完成: {', '.join(f'#{d}' for d in incomplete_deps)}"
                    ))
            elif action.status == ActionItemStatus.BLOCKED:
                ActionItemRepository.update_status(
                    action.id, ActionItemStatus.PENDING,
                    operator="system",
                    reason="依赖已全部完成，解除阻塞"
                )
        
        for action in all_actions:
            if not action.assignees:
                warnings.append(ValidationError(
                    code="NO_ASSIGNEE",
                    message=f"行动项 #{action.id} 没有负责人",
                    severity="warning",
                    action_id=action.id
                ))
            else:
                known_names = set(p.name for p in ParticipantRepository.get_all())
                for assignee in action.assignees:
                    if assignee not in known_names:
                        warnings.append(ValidationError(
                            code="UNKNOWN_ASSIGNEE",
                            message=f"行动项 #{action.id} 的负责人 '{assignee}' 不在名单中",
                            severity="warning",
                            action_id=action.id
                        ))
        
        if not all_actions:
            new_count = 0
        
        return CheckResult(
            total_actions=len(all_actions),
            new_count=new_count,
            overdue_count=overdue_count,
            blocked_count=blocked_count,
            done_count=done_count,
            errors=errors,
            warnings=warnings
        )
    
    @staticmethod
    def complete_action(action_id: int, operator: str, 
                        reason: Optional[str] = None) -> Tuple[bool, List[ValidationError]]:
        errors = []
        action = ActionItemRepository.get_by_id(action_id)
        
        if action is None:
            errors.append(ValidationError(
                code="NOT_FOUND",
                message=f"行动项 #{action_id} 不存在",
                severity="error"
            ))
            return False, errors
        
        if action.status == ActionItemStatus.DONE:
            return True, errors
        
        action_map = {a.id: a for a in ActionItemRepository.get_all()}
        incomplete_deps = []
        for dep_id in action.dependencies:
            if dep_id in action_map:
                dep = action_map[dep_id]
                if dep.status not in [ActionItemStatus.DONE, ActionItemStatus.CANCELLED]:
                    incomplete_deps.append(dep_id)
        
        if incomplete_deps:
            errors.append(ValidationError(
                code="DEPENDENCIES_INCOMPLETE",
                message=f"无法完成，依赖未完成: {', '.join(f'#{d}' for d in incomplete_deps)}",
                severity="error",
                action_id=action_id
            ))
            return False, errors
        
        success = ActionItemRepository.update_status(
            action_id, ActionItemStatus.DONE,
            operator=operator,
            reason=reason or "手动标记完成"
        )
        
        return success, errors
    
    @staticmethod
    def update_action(action_id: int, operator: str,
                      description: Optional[str] = None,
                      assignees: Optional[List[str]] = None,
                      due_date: Optional[date] = None,
                      dependencies: Optional[List[int]] = None,
                      notes: Optional[str] = None,
                      reason: Optional[str] = None) -> Tuple[bool, List[ValidationError]]:
        errors = []
        
        if assignees is not None:
            known_names = set(p.name for p in ParticipantRepository.get_all())
            for assignee in assignees:
                if assignee not in known_names:
                    errors.append(ValidationError(
                        code="UNKNOWN_ASSIGNEE",
                        message=f"负责人 '{assignee}' 不在名单中",
                        severity="warning"
                    ))
        
        if dependencies is not None:
            all_ids = set(a.id for a in ActionItemRepository.get_all())
            for dep_id in dependencies:
                if dep_id not in all_ids:
                    errors.append(ValidationError(
                        code="INVALID_DEPENDENCY",
                        message=f"依赖的行动项 #{dep_id} 不存在",
                        severity="error"
                    ))
            if action_id in dependencies:
                errors.append(ValidationError(
                    code="SELF_DEPENDENCY",
                    message="行动项不能依赖自己",
                    severity="error"
                ))
        
        if any(e.severity == "error" for e in errors):
            return False, errors
        
        success = ActionItemRepository.update(
            action_id=action_id,
            description=description,
            assignees=assignees,
            due_date=due_date,
            dependencies=dependencies,
            notes=notes,
            operator=operator,
            reason=reason
        )
        
        return success, errors
    
    @staticmethod
    def get_by_assignee() -> Dict[str, List[ActionItem]]:
        result = {}
        all_actions = ActionItemRepository.get_all()
        
        for action in all_actions:
            for assignee in action.assignees:
                if assignee not in result:
                    result[assignee] = []
                result[assignee].append(action)
        
        for participant in ParticipantRepository.get_all():
            if participant.name not in result:
                result[participant.name] = []
        
        return result
    
    @staticmethod
    def get_actions_by_status(status: ActionItemStatus) -> List[ActionItem]:
        return [a for a in ActionItemRepository.get_all() if a.status == status]
    
    @staticmethod
    def mark_in_progress(action_id: int, operator: str, 
                        reason: Optional[str] = None) -> bool:
        return ActionItemRepository.update_status(
            action_id, ActionItemStatus.IN_PROGRESS,
            operator=operator,
            reason=reason or "标记为进行中"
        )
    
    @staticmethod
    def cancel_action(action_id: int, operator: str, 
                      reason: Optional[str] = None) -> bool:
        return ActionItemRepository.update_status(
            action_id, ActionItemStatus.CANCELLED,
            operator=operator,
            reason=reason or "取消"
        )


class ParticipantService:
    @staticmethod
    def add_participant(name: str, email: Optional[str] = None,
                        operator: str = "system") -> Tuple[bool, Optional[int]]:
        if ParticipantRepository.exists(name):
            participant = ParticipantRepository.get_by_name(name)
            return True, participant.id if participant else None
        
        participant_id = ParticipantRepository.add(name, email, operator)
        return True, participant_id
    
    @staticmethod
    def add_role(name: str, description: Optional[str] = None,
                 operator: str = "system") -> Tuple[bool, Optional[int]]:
        if RoleRepository.exists(name):
            role = RoleRepository.get_by_name(name)
            return True, role.id if role else None
        
        role_id = RoleRepository.add(name, description, operator)
        return True, role_id
    
    @staticmethod
    def assign_role(participant_name: str, role_name: str,
                    operator: str = "system") -> Tuple[bool, List[str]]:
        errors = []
        
        participant = ParticipantRepository.get_by_name(participant_name)
        if not participant:
            errors.append(f"参会人 '{participant_name}' 不存在")
            return False, errors
        
        role = RoleRepository.get_by_name(role_name)
        if not role:
            errors.append(f"角色 '{role_name}' 不存在")
            return False, errors
        
        ParticipantRoleRepository.add(participant.id, role.id, operator)
        return True, []
