from typing import Optional, List, Dict
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import Event, EventVersion, User, UserRole, EventStatus, RegistrationStatus
from ..exceptions import NotFoundError, ValidationError, PermissionDeniedError, StateTransitionError
from ..logger import log_action, log_error
from .state_service import validate_event_transition

class EventService:
    def __init__(self, db: Session, current_user: User = None):
        self.db = db
        self.current_user = self._merge_user(db, current_user)
    
    def _merge_user(self, db: Session, user: User = None) -> User:
        if user is None:
            return None
        try:
            return db.merge(user)
        except Exception:
            if hasattr(user, 'id') and user.id:
                return db.query(User).filter(User.id == user.id).first()
            return None

    def _require_permission(self, required_role: UserRole):
        if not self.current_user:
            raise PermissionDeniedError('需要登录')
        role_priority = {UserRole.VOLUNTEER: 1, UserRole.ORGANIZER: 2, UserRole.ADMIN: 3}
        if role_priority.get(self.current_user.role, 0) < role_priority.get(required_role, 999):
            raise PermissionDeniedError(f'需要{required_role.value}权限')

    def _can_modify_event(self, event: Event) -> bool:
        if not self.current_user:
            return False
        if self.current_user.role == UserRole.ADMIN:
            return True
        if self.current_user.role == UserRole.ORGANIZER and event.created_by == self.current_user.id:
            return True
        return False

    def create_event(self, title: str, start_time: datetime, **kwargs) -> Event:
        self._require_permission(UserRole.ORGANIZER)
        
        if not title:
            raise ValidationError('活动标题不能为空')
        if not start_time:
            raise ValidationError('活动开始时间不能为空')
        
        event = Event(
            title=title,
            start_time=start_time,
            created_by=self.current_user.id,
            **kwargs
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)
        
        self._create_version(event, '创建活动')
        log_action('create_event', {'title': title, 'event_id': event.id}, user_id=self.current_user.id, resource_type='event', resource_id=event.id)
        return event

    def _create_version(self, event: Event, reason: str):
        latest = self.db.query(EventVersion).filter(EventVersion.event_id == event.id).order_by(EventVersion.version_number.desc()).first()
        next_version = (latest.version_number + 1) if latest else 1
        
        version = EventVersion(
            event_id=event.id,
            version_number=next_version,
            title=event.title,
            description=event.description,
            location=event.location,
            start_time=event.start_time,
            end_time=event.end_time,
            max_participants=event.max_participants,
            status=event.status,
            changed_by=self.current_user.id if self.current_user else None,
            change_reason=reason
        )
        self.db.add(version)
        self.db.commit()

    def get_event_by_id(self, event_id: int) -> Optional[Event]:
        return self.db.query(Event).filter(Event.id == event_id).first()

    def list_events(self, status: EventStatus = None, created_by: int = None, include_draft: bool = False) -> List[Event]:
        query = self.db.query(Event)
        
        if not include_draft:
            if self.current_user:
                if self.current_user.role == UserRole.ADMIN:
                    pass
                else:
                    query = query.filter(
                        (Event.status != EventStatus.DRAFT) | (Event.created_by == self.current_user.id)
                    )
            else:
                query = query.filter(Event.status != EventStatus.DRAFT)
        
        if status:
            query = query.filter(Event.status == status)
        if created_by:
            query = query.filter(Event.created_by == created_by)
        
        return query.order_by(Event.start_time.desc()).all()

    def update_event(self, event_id: int, change_reason: str = '更新活动信息', **kwargs) -> Event:
        event = self.get_event_by_id(event_id)
        if not event:
            raise NotFoundError(f'活动不存在: {event_id}')
        
        if not self._can_modify_event(event):
            raise PermissionDeniedError('无权修改此活动')
        
        if 'status' in kwargs and kwargs['status'] != event.status:
            context = {'start_time': event.start_time}
            validate_event_transition(event.status, kwargs['status'], self.current_user.role, context)
        
        for key, value in kwargs.items():
            if value is not None and hasattr(event, key):
                setattr(event, key, value)
        
        self.db.commit()
        self.db.refresh(event)
        self._create_version(event, change_reason)
        
        log_action('update_event', {'event_id': event_id, 'fields': list(kwargs.keys()), 'reason': change_reason}, user_id=self.current_user.id, resource_type='event', resource_id=event_id)
        return event

    def change_status(self, event_id: int, new_status: EventStatus, reason: str = None) -> Event:
        event = self.get_event_by_id(event_id)
        if not event:
            raise NotFoundError(f'活动不存在: {event_id}')
        
        if not self._can_modify_event(event):
            raise PermissionDeniedError('无权修改此活动状态')
        
        context = {'start_time': event.start_time}
        validate_event_transition(event.status, new_status, self.current_user.role, context)
        
        old_status = event.status
        event.status = new_status
        self.db.commit()
        self.db.refresh(event)
        
        reason_msg = reason or f'状态变更: {old_status.value} -> {new_status.value}'
        self._create_version(event, reason_msg)
        
        log_action('change_event_status', {'event_id': event_id, 'from': event.status.value, 'to': new_status.value, 'reason': reason}, user_id=self.current_user.id, resource_type='event', resource_id=event_id)
        return event

    def delete_event(self, event_id: int) -> bool:
        event = self.get_event_by_id(event_id)
        if not event:
            raise NotFoundError(f'活动不存在: {event_id}')
        
        if not self._can_modify_event(event):
            raise PermissionDeniedError('无权删除此活动')
        
        if event.status not in [EventStatus.DRAFT, EventStatus.CANCELLED]:
            raise ValidationError('只能删除草稿或已取消的活动')
        
        self.db.delete(event)
        self.db.commit()
        log_action('delete_event', {'event_id': event_id, 'title': event.title}, user_id=self.current_user.id, resource_type='event', resource_id=event_id)
        return True

    def get_versions(self, event_id: int) -> List[EventVersion]:
        return self.db.query(EventVersion).filter(EventVersion.event_id == event_id).order_by(EventVersion.version_number.desc()).all()

    def get_registration_stats(self, event_id: int) -> Dict:
        event = self.get_event_by_id(event_id)
        if not event:
            raise NotFoundError(f'活动不存在: {event_id}')
        
        from .registration_service import RegistrationService
        reg_service = RegistrationService(self.db, self.current_user)
        registrations = reg_service.list_registrations(event_id=event_id)
        
        stats = {status.value: 0 for status in RegistrationStatus}
        for reg in registrations:
            stats[reg.status.value] += 1
        
        stats['total'] = len(registrations)
        stats['max_participants'] = event.max_participants
        stats['is_full'] = event.max_participants is not None and len(registrations) >= event.max_participants
        
        return stats
