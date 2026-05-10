from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from ..models import Registration, RegistrationVersion, User, UserRole, RegistrationStatus, Event, EventStatus
from ..exceptions import NotFoundError, ValidationError, PermissionDeniedError, DuplicateRegistrationError, StateTransitionError
from ..logger import log_action
from .state_service import validate_registration_transition

class RegistrationService:
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

    def _can_modify_registration(self, registration: Registration) -> bool:
        if not self.current_user:
            return False
        if self.current_user.role in [UserRole.ADMIN, UserRole.ORGANIZER]:
            return True
        if registration.user_id == self.current_user.id:
            return True
        return False

    def create_registration(self, event_id: int, participant_name: str, **kwargs) -> Registration:
        if not self.current_user:
            raise PermissionDeniedError('需要登录')
        
        event = self.db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise NotFoundError(f'活动不存在: {event_id}')
        
        if event.status not in [EventStatus.PUBLISHED, EventStatus.ONGOING]:
            raise ValidationError('只能报名已发布或进行中的活动')
        
        if participant_email := kwargs.get('participant_email'):
            existing = self.db.query(Registration).filter(
                Registration.event_id == event_id,
                Registration.participant_email == participant_email,
                Registration.status != RegistrationStatus.CANCELLED
            ).first()
            if existing:
                raise DuplicateRegistrationError(f'该邮箱已报名此活动')
        
        if event.max_participants is not None:
            confirmed_count = self.db.query(Registration).filter(
                Registration.event_id == event_id,
                Registration.status.in_([RegistrationStatus.PENDING, RegistrationStatus.CONFIRMED])
            ).count()
            if confirmed_count >= event.max_participants:
                raise ValidationError('活动名额已满')
        
        registration = Registration(
            event_id=event_id,
            user_id=self.current_user.id,
            participant_name=participant_name,
            **kwargs
        )
        self.db.add(registration)
        self.db.commit()
        self.db.refresh(registration)
        
        self._create_version(registration, '创建报名')
        log_action('create_registration', {'event_id': event_id, 'registration_id': registration.id, 'participant': participant_name}, user_id=self.current_user.id, resource_type='registration', resource_id=registration.id)
        return registration

    def _create_version(self, registration: Registration, reason: str):
        latest = self.db.query(RegistrationVersion).filter(RegistrationVersion.registration_id == registration.id).order_by(RegistrationVersion.version_number.desc()).first()
        next_version = (latest.version_number + 1) if latest else 1
        
        version = RegistrationVersion(
            registration_id=registration.id,
            version_number=next_version,
            participant_name=registration.participant_name,
            participant_email=registration.participant_email,
            participant_phone=registration.participant_phone,
            notes=registration.notes,
            status=registration.status,
            extra_data=registration.extra_data,
            changed_by=self.current_user.id if self.current_user else None,
            change_reason=reason
        )
        self.db.add(version)
        self.db.commit()

    def get_registration_by_id(self, registration_id: int) -> Optional[Registration]:
        return self.db.query(Registration).filter(Registration.id == registration_id).first()

    def list_registrations(self, event_id: int = None, user_id: int = None, status: RegistrationStatus = None, participant_name: str = None) -> List[Registration]:
        query = self.db.query(Registration)
        
        if event_id:
            query = query.filter(Registration.event_id == event_id)
        if user_id:
            query = query.filter(Registration.user_id == user_id)
        if status:
            query = query.filter(Registration.status == status)
        if participant_name:
            query = query.filter(Registration.participant_name.like(f'%{participant_name}%'))
        
        return query.order_by(Registration.created_at.desc()).all()

    def update_registration(self, registration_id: int, change_reason: str = '更新报名信息', **kwargs) -> Registration:
        registration = self.get_registration_by_id(registration_id)
        if not registration:
            raise NotFoundError(f'报名不存在: {registration_id}')
        
        if not self._can_modify_registration(registration):
            raise PermissionDeniedError('无权修改此报名')
        
        if 'status' in kwargs and kwargs['status'] != registration.status:
            validate_registration_transition(registration.status, kwargs['status'], self.current_user.role)
        
        for key, value in kwargs.items():
            if value is not None and hasattr(registration, key):
                setattr(registration, key, value)
        
        self.db.commit()
        self.db.refresh(registration)
        self._create_version(registration, change_reason)
        
        log_action('update_registration', {'registration_id': registration_id, 'fields': list(kwargs.keys()), 'reason': change_reason}, user_id=self.current_user.id, resource_type='registration', resource_id=registration_id)
        return registration

    def change_status(self, registration_id: int, new_status: RegistrationStatus, reason: str = None) -> Registration:
        registration = self.get_registration_by_id(registration_id)
        if not registration:
            raise NotFoundError(f'报名不存在: {registration_id}')
        
        if not self._can_modify_registration(registration):
            raise PermissionDeniedError('无权修改此报名状态')
        
        validate_registration_transition(registration.status, new_status, self.current_user.role)
        
        old_status = registration.status
        registration.status = new_status
        self.db.commit()
        self.db.refresh(registration)
        
        reason_msg = reason or f'状态变更: {old_status.value} -> {new_status.value}'
        self._create_version(registration, reason_msg)
        
        log_action('change_registration_status', {'registration_id': registration_id, 'from': old_status.value, 'to': new_status.value, 'reason': reason}, user_id=self.current_user.id, resource_type='registration', resource_id=registration_id)
        return registration

    def cancel_registration(self, registration_id: int, reason: str = None) -> Registration:
        return self.change_status(registration_id, RegistrationStatus.CANCELLED, reason)

    def get_versions(self, registration_id: int) -> List[RegistrationVersion]:
        return self.db.query(RegistrationVersion).filter(RegistrationVersion.registration_id == registration_id).order_by(RegistrationVersion.version_number.desc()).all()
