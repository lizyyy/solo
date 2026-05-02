from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum

from app.models.models import BroadcastEvent, AuditLog
from app.services.storage_service import StorageService


class BroadcastStatus(Enum):
    SCHEDULED = 'scheduled'
    IMPORTED = 'imported'
    PENDING_VALIDATION = 'pending_validation'
    VALIDATED = 'validated'
    HAS_ERRORS = 'has_errors'
    LOGGED = 'logged'
    RECONCILED = 'reconciled'
    CANCELLED = 'cancelled'
    COMPLETED = 'completed'


class StateTransition:
    
    VALID_TRANSITIONS = {
        BroadcastStatus.SCHEDULED: [
            BroadcastStatus.IMPORTED,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.IMPORTED: [
            BroadcastStatus.PENDING_VALIDATION,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.PENDING_VALIDATION: [
            BroadcastStatus.VALIDATED,
            BroadcastStatus.HAS_ERRORS,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.VALIDATED: [
            BroadcastStatus.LOGGED,
            BroadcastStatus.RECONCILED,
            BroadcastStatus.COMPLETED,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.HAS_ERRORS: [
            BroadcastStatus.PENDING_VALIDATION,
            BroadcastStatus.VALIDATED,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.LOGGED: [
            BroadcastStatus.RECONCILED,
            BroadcastStatus.COMPLETED,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.RECONCILED: [
            BroadcastStatus.COMPLETED,
            BroadcastStatus.CANCELLED
        ],
        BroadcastStatus.COMPLETED: [],
        BroadcastStatus.CANCELLED: []
    }
    
    @staticmethod
    def can_transition(from_status: str, to_status: str) -> bool:
        try:
            from_enum = BroadcastStatus(from_status)
            to_enum = BroadcastStatus(to_status)
            return to_enum in StateTransition.VALID_TRANSITIONS.get(from_enum, [])
        except ValueError:
            return False
    
    @staticmethod
    def get_next_possible_statuses(current_status: str) -> List[str]:
        try:
            current = BroadcastStatus(current_status)
            return [s.value for s in StateTransition.VALID_TRANSITIONS.get(current, [])]
        except ValueError:
            return []


class BroadcastStateMachine:
    
    @staticmethod
    def transition_event(event_id: int, new_status: str, 
                          operator: Optional[str] = None,
                          reason: Optional[str] = None) -> Dict[str, Any]:
        event = StorageService.get_event_by_code(str(event_id)) if isinstance(event_id, str) else None
        
        if not event:
            from app.models.models import BroadcastEvent
            from app import db
            event = BroadcastEvent.query.get(event_id)
        
        if not event:
            return {
                'success': False,
                'error': f'事件不存在: {event_id}'
            }
        
        current_status = event.status
        
        if not StateTransition.can_transition(current_status, new_status):
            possible_next = StateTransition.get_next_possible_statuses(current_status)
            return {
                'success': False,
                'error': f'状态流转不允许: {current_status} -> {new_status}',
                'possible_next_statuses': possible_next
            }
        
        old_status = event.status
        event.status = new_status
        from app import db
        db.session.commit()
        
        StorageService.create_audit_log(
            action='STATUS_TRANSITION',
            entity_type='BroadcastEvent',
            entity_id=event.id,
            details=f'状态变更: {old_status} -> {new_status}' + (f' | 原因: {reason}' if reason else ''),
            operator=operator
        )
        
        return {
            'success': True,
            'event_id': event.id,
            'old_status': old_status,
            'new_status': new_status
        }
    
    @staticmethod
    def mark_as_imported(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.IMPORTED.value,
            operator=operator,
            reason='数据导入完成'
        )
    
    @staticmethod
    def submit_for_validation(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.PENDING_VALIDATION.value,
            operator=operator,
            reason='提交合规校验'
        )
    
    @staticmethod
    def mark_validated(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.VALIDATED.value,
            operator=operator,
            reason='合规校验通过'
        )
    
    @staticmethod
    def mark_has_errors(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.HAS_ERRORS.value,
            operator=operator,
            reason='合规校验发现问题'
        )
    
    @staticmethod
    def mark_logged(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.LOGGED.value,
            operator=operator,
            reason='已记录到播出日志'
        )
    
    @staticmethod
    def mark_reconciled(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.RECONCILED.value,
            operator=operator,
            reason='排期与日志已对齐'
        )
    
    @staticmethod
    def mark_completed(event_id: int, operator: Optional[str] = None) -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.COMPLETED.value,
            operator=operator,
            reason='播出流程完成'
        )
    
    @staticmethod
    def mark_cancelled(event_id: int, operator: Optional[str] = None, 
                       reason: str = '手动取消') -> Dict[str, Any]:
        return BroadcastStateMachine.transition_event(
            event_id,
            BroadcastStatus.CANCELLED.value,
            operator=operator,
            reason=reason
        )
    
    @staticmethod
    def get_event_workflow_status(event_id: int) -> Dict[str, Any]:
        event = StorageService.get_event_by_code(str(event_id)) if isinstance(event_id, str) else None
        
        if not event:
            from app.models.models import BroadcastEvent
            event = BroadcastEvent.query.get(event_id)
        
        if not event:
            return {
                'success': False,
                'error': f'事件不存在: {event_id}'
            }
        
        current_status = event.status
        possible_next = StateTransition.get_next_possible_statuses(current_status)
        
        audit_logs = AuditLog.query.filter_by(
            entity_type='BroadcastEvent',
            entity_id=event.id
        ).order_by(AuditLog.timestamp.desc()).all()
        
        return {
            'success': True,
            'event_id': event.id,
            'current_status': current_status,
            'possible_next_statuses': possible_next,
            'status_description': BroadcastStateMachine._get_status_description(current_status),
            'workflow_history': [
                {
                    'action': log.action,
                    'timestamp': log.timestamp.isoformat() if log.timestamp else None,
                    'details': log.details,
                    'operator': log.operator
                }
                for log in audit_logs
            ]
        }
    
    @staticmethod
    def _get_status_description(status: str) -> str:
        descriptions = {
            'scheduled': '已排期 - 等待导入确认',
            'imported': '已导入 - 等待校验',
            'pending_validation': '校验中 - 正在执行合规检查',
            'validated': '已校验 - 合规检查通过',
            'has_errors': '存在问题 - 需人工复核',
            'logged': '已记录 - 播出日志已确认',
            'reconciled': '已对齐 - 排期与日志一致',
            'completed': '已完成 - 全流程结束',
            'cancelled': '已取消 - 流程终止'
        }
        return descriptions.get(status, '未知状态')
    
    @staticmethod
    def bulk_update_status(event_ids: List[int], new_status: str,
                           operator: Optional[str] = None,
                           reason: Optional[str] = None) -> Dict[str, Any]:
        results = []
        success_count = 0
        failed_count = 0
        
        for event_id in event_ids:
            result = BroadcastStateMachine.transition_event(
                event_id, new_status, operator, reason
            )
            results.append(result)
            if result.get('success'):
                success_count += 1
            else:
                failed_count += 1
        
        return {
            'success': True,
            'total': len(event_ids),
            'success_count': success_count,
            'failed_count': failed_count,
            'results': results
        }
