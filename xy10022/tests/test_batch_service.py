import pytest
from datetime import datetime, timedelta

from event_manager.services.batch_service import BatchService
from event_manager.services.registration_service import RegistrationService
from event_manager.models import Registration, RegistrationStatus, EventStatus
from event_manager.exceptions import BatchOperationError, PermissionDeniedError


class TestBatchService:
    
    def test_batch_update_registration_status(self, temp_db, test_event, test_user, test_organizer):
        registrations = []
        for i in range(5):
            reg = Registration(
                event_id=test_event.id,
                user_id=test_user.id,
                participant_name=f'测试用户{i}',
                participant_email=f'test{i}@example.com',
                status=RegistrationStatus.PENDING
            )
            registrations.append(reg)
            temp_db.add(reg)
        temp_db.commit()
        
        service = BatchService(temp_db, current_user=test_organizer)
        reg_ids = [r.id for r in registrations]
        
        result = service.batch_update_registration_status(reg_ids, RegistrationStatus.CONFIRMED, '批量确认')
        
        assert result['successful_count'] == 5
        assert result['failed_count'] == 0
        assert result['total'] == 5
        
        for reg in registrations:
            temp_db.refresh(reg)
            assert reg.status == RegistrationStatus.CONFIRMED

    def test_batch_update_with_failures(self, temp_db, test_event, test_user, test_organizer):
        reg1 = Registration(
            event_id=test_event.id,
            user_id=test_user.id,
            participant_name='有效用户',
            participant_email='valid@example.com',
            status=RegistrationStatus.PENDING
        )
        temp_db.add(reg1)
        temp_db.commit()
        temp_db.refresh(reg1)
        
        invalid_ids = [reg1.id, 99999, 88888]
        
        service = BatchService(temp_db, current_user=test_organizer)
        
        result = service.batch_update_registration_status(invalid_ids, RegistrationStatus.CONFIRMED)
        
        assert result['successful_count'] == 1
        assert result['failed_count'] == 2
        assert len(result['successful']) == 1
        assert len(result['failed']) == 2

    def test_batch_confirm(self, temp_db, test_event, test_user, test_organizer):
        reg = Registration(
            event_id=test_event.id,
            user_id=test_user.id,
            participant_name='待确认',
            participant_email='confirm@example.com',
            status=RegistrationStatus.PENDING
        )
        temp_db.add(reg)
        temp_db.commit()
        temp_db.refresh(reg)
        
        service = BatchService(temp_db, current_user=test_organizer)
        
        result = service.batch_confirm_registrations([reg.id], '批量确认')
        
        assert result['successful_count'] == 1
        temp_db.refresh(reg)
        assert reg.status == RegistrationStatus.CONFIRMED

    def test_batch_cancel(self, temp_db, test_event, test_user, test_organizer):
        reg = Registration(
            event_id=test_event.id,
            user_id=test_user.id,
            participant_name='待取消',
            participant_email='cancel@example.com',
            status=RegistrationStatus.PENDING
        )
        temp_db.add(reg)
        temp_db.commit()
        temp_db.refresh(reg)
        
        service = BatchService(temp_db, current_user=test_organizer)
        
        result = service.batch_cancel_registrations([reg.id], '批量取消')
        
        assert result['successful_count'] == 1
        temp_db.refresh(reg)
        assert reg.status == RegistrationStatus.CANCELLED

    def test_batch_import_registrations(self, temp_db, test_event, test_organizer):
        registrations_data = [
            {'participant_name': '导入用户1', 'participant_email': 'import1@example.com'},
            {'participant_name': '导入用户2', 'participant_email': 'import2@example.com'},
            {'participant_name': '', 'participant_email': 'missing@example.com'},
        ]
        
        service = BatchService(temp_db, current_user=test_organizer)
        
        result = service.batch_import_registrations(test_event.id, registrations_data)
        
        assert result['successful_count'] == 2
        assert result['failed_count'] == 1
        assert len(result['successful']) == 2
        assert len(result['failed']) == 1

    def test_batch_import_requires_organizer(self, temp_db, test_event, test_user):
        registrations_data = [
            {'participant_name': '测试', 'participant_email': 'test@example.com'}
        ]
        
        service = BatchService(temp_db, current_user=test_user)
        
        with pytest.raises(PermissionDeniedError):
            service.batch_import_registrations(test_event.id, registrations_data)

    def test_batch_update_requires_permission(self, temp_db):
        service = BatchService(temp_db, current_user=None)
        
        with pytest.raises(PermissionDeniedError):
            service.batch_update_registration_status([1, 2], RegistrationStatus.CONFIRMED)
