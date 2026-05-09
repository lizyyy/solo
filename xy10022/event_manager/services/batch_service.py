from typing import List, Dict, Callable, Any, Tuple
from sqlalchemy.orm import Session

from ..models import User, UserRole, Registration, RegistrationStatus
from ..exceptions import BatchOperationError, PermissionDeniedError, NotFoundError
from ..logger import log_action, log_error
from .registration_service import RegistrationService

class BatchService:
    def __init__(self, db: Session, current_user: User = None):
        self.db = db
        self.current_user = current_user
        self.reg_service = RegistrationService(db, current_user)

    def _require_permission(self, required_role: UserRole):
        if not self.current_user:
            raise PermissionDeniedError('需要登录')
        role_priority = {UserRole.VOLUNTEER: 1, UserRole.ORGANIZER: 2, UserRole.ADMIN: 3}
        if role_priority.get(self.current_user.role, 0) < role_priority.get(required_role, 999):
            raise PermissionDeniedError(f'需要{required_role.value}权限')

    def batch_update_registration_status(self, registration_ids: List[int], new_status: RegistrationStatus, reason: str = None) -> Dict:
        self._require_permission(UserRole.VOLUNTEER)
        
        successful = []
        failed = []
        
        for reg_id in registration_ids:
            try:
                registration = self.reg_service.get_registration_by_id(reg_id)
                if not registration:
                    failed.append({'id': reg_id, 'error': f'报名不存在: {reg_id}'})
                    continue
                
                self.reg_service.change_status(reg_id, new_status, reason)
                successful.append(reg_id)
            except Exception as e:
                failed.append({'id': reg_id, 'error': str(e)})
                log_error('batch_update_status_failed', {'registration_id': reg_id, 'error': str(e)}, user_id=self.current_user.id)
        
        log_action('batch_update_registration_status', {
            'new_status': new_status.value,
            'successful_count': len(successful),
            'failed_count': len(failed),
            'reason': reason
        }, user_id=self.current_user.id)
        
        if failed and not successful:
            raise BatchOperationError('批量更新全部失败', successful=successful, failed=failed)
        
        return {
            'successful': successful,
            'failed': failed,
            'total': len(registration_ids),
            'successful_count': len(successful),
            'failed_count': len(failed)
        }

    def batch_cancel_registrations(self, registration_ids: List[int], reason: str = None) -> Dict:
        return self.batch_update_registration_status(registration_ids, RegistrationStatus.CANCELLED, reason)

    def batch_confirm_registrations(self, registration_ids: List[int], reason: str = None) -> Dict:
        return self.batch_update_registration_status(registration_ids, RegistrationStatus.CONFIRMED, reason)

    def batch_import_registrations(self, event_id: int, registrations_data: List[Dict], reason: str = '批量导入') -> Dict:
        self._require_permission(UserRole.ORGANIZER)
        
        successful = []
        failed = []
        
        for idx, data in enumerate(registrations_data):
            try:
                participant_name = data.get('participant_name')
                if not participant_name:
                    failed.append({'index': idx, 'error': '缺少参与者姓名', 'data': data})
                    continue
                
                reg = self.reg_service.create_registration(
                    event_id=event_id,
                    participant_name=participant_name,
                    participant_email=data.get('participant_email'),
                    participant_phone=data.get('participant_phone'),
                    notes=data.get('notes'),
                    extra_data=data.get('extra_data')
                )
                successful.append({'id': reg.id, 'participant_name': participant_name})
            except Exception as e:
                failed.append({'index': idx, 'error': str(e), 'data': data})
                log_error('batch_import_failed', {'index': idx, 'error': str(e), 'data': data}, user_id=self.current_user.id)
        
        log_action('batch_import_registrations', {
            'event_id': event_id,
            'successful_count': len(successful),
            'failed_count': len(failed)
        }, user_id=self.current_user.id, resource_type='event', resource_id=event_id)
        
        return {
            'successful': successful,
            'failed': failed,
            'total': len(registrations_data),
            'successful_count': len(successful),
            'failed_count': len(failed)
        }
