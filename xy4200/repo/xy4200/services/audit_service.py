from typing import Dict, List, Any, Optional
from datetime import datetime
import json

from flask import request
from app import db
from models import AuditLog, Pottery, SpliceGroup


class AuditAction:
    CREATE = 'create'
    UPDATE = 'update'
    DELETE = 'delete'
    
    IMPORT = 'import'
    EXPORT = 'export'
    
    SUBMIT = 'submit'
    WITHDRAW = 'withdraw'
    APPROVE = 'approve'
    REJECT = 'reject'
    
    REVIEW_START = 'review_start'
    REVIEW_COMPLETE = 'review_complete'
    
    VALIDATION = 'validation'
    RULE_CHECK = 'rule_check'
    
    VERSION_CREATE = 'version_create'
    VERSION_RESTORE = 'version_restore'
    
    ARCHIVE = 'archive'
    UNARCHIVE = 'unarchive'


class AuditEntityType:
    POTTERY = 'pottery'
    SPLICE_GROUP = 'splice_group'
    ISSUE = 'issue'
    VERSION = 'version'
    IMPORT = 'import'
    EXPORT = 'export'


class AuditService:
    
    @staticmethod
    def log_action(action: str,
                   entity_type: str,
                   entity_id: str,
                   old_values: Optional[Dict] = None,
                   new_values: Optional[Dict] = None,
                   user: Optional[str] = None,
                   notes: Optional[str] = None) -> AuditLog:
        
        ip_address = None
        user_agent = None
        
        try:
            if request:
                ip_address = request.remote_addr
                user_agent = request.user_agent.string if request.user_agent else None
        except RuntimeError:
            pass
        
        audit_log = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=json.dumps(old_values, ensure_ascii=False, default=str) if old_values else None,
            new_values=json.dumps(new_values, ensure_ascii=False, default=str) if new_values else None,
            user=user,
            ip_address=ip_address,
            user_agent=user_agent,
            notes=notes
        )
        
        db.session.add(audit_log)
        
        return audit_log
    
    @staticmethod
    def log_pottery_create(pottery: Pottery,
                           user: Optional[str] = None,
                           notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.CREATE,
            entity_type=AuditEntityType.POTTERY,
            entity_id=pottery.pottery_id,
            new_values=pottery.to_dict(),
            user=user,
            notes=notes or f'创建陶片: {pottery.pottery_id}'
        )
    
    @staticmethod
    def log_pottery_update(pottery: Pottery,
                           old_values: Dict,
                           user: Optional[str] = None,
                           notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.UPDATE,
            entity_type=AuditEntityType.POTTERY,
            entity_id=pottery.pottery_id,
            old_values=old_values,
            new_values=pottery.to_dict(),
            user=user,
            notes=notes or f'更新陶片: {pottery.pottery_id}'
        )
    
    @staticmethod
    def log_pottery_delete(pottery: Pottery,
                           user: Optional[str] = None,
                           notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.DELETE,
            entity_type=AuditEntityType.POTTERY,
            entity_id=pottery.pottery_id,
            old_values=pottery.to_dict(),
            user=user,
            notes=notes or f'删除陶片: {pottery.pottery_id}'
        )
    
    @staticmethod
    def log_group_create(group: SpliceGroup,
                         user: Optional[str] = None,
                         notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.CREATE,
            entity_type=AuditEntityType.SPLICE_GROUP,
            entity_id=group.group_id,
            new_values=group.to_dict(),
            user=user,
            notes=notes or f'创建拼接组: {group.group_id}'
        )
    
    @staticmethod
    def log_group_update(group: SpliceGroup,
                         old_values: Dict,
                         user: Optional[str] = None,
                         notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.UPDATE,
            entity_type=AuditEntityType.SPLICE_GROUP,
            entity_id=group.group_id,
            old_values=old_values,
            new_values=group.to_dict(),
            user=user,
            notes=notes or f'更新拼接组: {group.group_id}'
        )
    
    @staticmethod
    def log_group_submit(group: SpliceGroup,
                         user: Optional[str] = None,
                         notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.SUBMIT,
            entity_type=AuditEntityType.SPLICE_GROUP,
            entity_id=group.group_id,
            new_values={
                'status': group.status,
                'pottery_ids': group.get_pottery_ids()
            },
            user=user,
            notes=notes or f'提交拼接组: {group.group_id}'
        )
    
    @staticmethod
    def log_group_withdraw(group: SpliceGroup,
                           user: Optional[str] = None,
                           notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.WITHDRAW,
            entity_type=AuditEntityType.SPLICE_GROUP,
            entity_id=group.group_id,
            new_values={'status': group.status},
            user=user,
            notes=notes or f'撤回拼接组: {group.group_id}'
        )
    
    @staticmethod
    def log_group_approve(group: SpliceGroup,
                          user: Optional[str] = None,
                          notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.APPROVE,
            entity_type=AuditEntityType.SPLICE_GROUP,
            entity_id=group.group_id,
            new_values={
                'status': group.status,
                'review_result': group.review_result,
                'review_notes': group.review_notes
            },
            user=user,
            notes=notes or f'审核通过拼接组: {group.group_id}'
        )
    
    @staticmethod
    def log_group_reject(group: SpliceGroup,
                         user: Optional[str] = None,
                         notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.REJECT,
            entity_type=AuditEntityType.SPLICE_GROUP,
            entity_id=group.group_id,
            new_values={
                'status': group.status,
                'review_result': group.review_result,
                'review_notes': group.review_notes
            },
            user=user,
            notes=notes or f'审核驳回拼接组: {group.group_id}'
        )
    
    @staticmethod
    def log_import(import_type: str,
                   record_count: int,
                   success_count: int,
                   error_count: int,
                   user: Optional[str] = None,
                   notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.IMPORT,
            entity_type=AuditEntityType.IMPORT,
            entity_id=f'import_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}',
            new_values={
                'import_type': import_type,
                'record_count': record_count,
                'success_count': success_count,
                'error_count': error_count
            },
            user=user,
            notes=notes or f'导入数据: {import_type}, 成功 {success_count}/{record_count} 条'
        )
    
    @staticmethod
    def log_export(export_type: str,
                   format: str,
                   record_count: int,
                   user: Optional[str] = None,
                   notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.EXPORT,
            entity_type=AuditEntityType.EXPORT,
            entity_id=f'export_{datetime.utcnow().strftime("%Y%m%d%H%M%S")}',
            new_values={
                'export_type': export_type,
                'format': format,
                'record_count': record_count
            },
            user=user,
            notes=notes or f'导出数据: {export_type}, 格式 {format}, 共 {record_count} 条'
        )
    
    @staticmethod
    def log_validation(entity_type: str,
                       entity_id: str,
                       issues: List[Dict],
                       user: Optional[str] = None,
                       notes: Optional[str] = None) -> AuditLog:
        return AuditService.log_action(
            action=AuditAction.VALIDATION,
            entity_type=entity_type,
            entity_id=entity_id,
            new_values={
                'issue_count': len(issues),
                'issues': issues[:10]
            },
            user=user,
            notes=notes or f'规则校验: 发现 {len(issues)} 个问题'
        )
    
    @staticmethod
    def get_logs(entity_type: Optional[str] = None,
                 entity_id: Optional[str] = None,
                 action: Optional[str] = None,
                 user: Optional[str] = None,
                 start_time: Optional[datetime] = None,
                 end_time: Optional[datetime] = None,
                 limit: int = 100) -> List[AuditLog]:
        query = AuditLog.query
        
        if entity_type:
            query = query.filter_by(entity_type=entity_type)
        if entity_id:
            query = query.filter_by(entity_id=entity_id)
        if action:
            query = query.filter_by(action=action)
        if user:
            query = query.filter_by(user=user)
        if start_time:
            query = query.filter(AuditLog.timestamp >= start_time)
        if end_time:
            query = query.filter(AuditLog.timestamp <= end_time)
        
        query = query.order_by(AuditLog.timestamp.desc())
        
        if limit > 0:
            query = query.limit(limit)
        
        return query.all()
    
    @staticmethod
    def get_audit_stats(start_time: Optional[datetime] = None,
                        end_time: Optional[datetime] = None) -> Dict[str, Any]:
        query = AuditLog.query
        
        if start_time:
            query = query.filter(AuditLog.timestamp >= start_time)
        if end_time:
            query = query.filter(AuditLog.timestamp <= end_time)
        
        logs = query.all()
        
        action_counts = {}
        entity_type_counts = {}
        user_counts = {}
        
        for log in logs:
            if log.action not in action_counts:
                action_counts[log.action] = 0
            action_counts[log.action] += 1
            
            if log.entity_type not in entity_type_counts:
                entity_type_counts[log.entity_type] = 0
            entity_type_counts[log.entity_type] += 1
            
            if log.user:
                if log.user not in user_counts:
                    user_counts[log.user] = 0
                user_counts[log.user] += 1
        
        return {
            'total_logs': len(logs),
            'action_counts': action_counts,
            'entity_type_counts': entity_type_counts,
            'user_counts': user_counts,
            'start_time': start_time.isoformat() if start_time else None,
            'end_time': end_time.isoformat() if end_time else None
        }
