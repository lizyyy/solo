import pytest
from datetime import datetime, timedelta

from event_manager.services.registration_service import RegistrationService
from event_manager.models import RegistrationStatus, EventStatus, Event, RegistrationVersion
from event_manager.exceptions import ValidationError, PermissionDeniedError, DuplicateRegistrationError, StateTransitionError


class TestRegistrationService:
    
    def test_create_registration(self, temp_db, test_event, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        registration = service.create_registration(
            event_id=test_event.id,
            participant_name='李四',
            participant_email='lisi@example.com',
            participant_phone='13900139000',
            notes='新报名'
        )
        
        assert registration is not None
        assert registration.participant_name == '李四'
        assert registration.status == RegistrationStatus.PENDING
        
        versions = service.get_versions(registration.id)
        assert len(versions) == 1

    def test_create_registration_for_full_event(self, temp_db, test_organizer, test_user):
        event = Event(
            title='满员活动',
            start_time=datetime.now() + timedelta(days=7),
            max_participants=1,
            status=EventStatus.PUBLISHED,
            created_by=test_organizer.id
        )
        temp_db.add(event)
        temp_db.commit()
        temp_db.refresh(event)
        
        from event_manager.models import Registration
        existing_reg = Registration(
            event_id=event.id,
            user_id=test_user.id,
            participant_name='已报名',
            status=RegistrationStatus.CONFIRMED
        )
        temp_db.add(existing_reg)
        temp_db.commit()
        
        service = RegistrationService(temp_db, current_user=test_user)
        
        with pytest.raises(ValidationError):
            service.create_registration(
                event_id=event.id,
                participant_name='新人'
            )

    def test_duplicate_registration(self, temp_db, test_event, test_user, test_registration):
        service = RegistrationService(temp_db, current_user=test_user)
        
        with pytest.raises(DuplicateRegistrationError):
            service.create_registration(
                event_id=test_event.id,
                participant_name='另一个人',
                participant_email='zhangsan@example.com'
            )

    def test_get_registration_by_id(self, temp_db, test_registration, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        registration = service.get_registration_by_id(test_registration.id)
        
        assert registration is not None
        assert registration.id == test_registration.id

    def test_list_registrations(self, temp_db, test_event, test_registration, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        registrations = service.list_registrations(event_id=test_event.id)
        
        assert len(registrations) >= 1

    def test_update_registration(self, temp_db, test_registration, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        updated = service.update_registration(
            test_registration.id,
            change_reason='更新联系方式',
            participant_phone='18800188000',
            notes='更新后的备注'
        )
        
        assert updated.participant_phone == '18800188000'
        assert updated.notes == '更新后的备注'
        
        versions = service.get_versions(test_registration.id)
        assert len(versions) >= 1

    def test_change_status_confirm(self, temp_db, test_registration, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        updated = service.change_status(
            test_registration.id,
            RegistrationStatus.CONFIRMED,
            reason='确认参加'
        )
        
        assert updated.status == RegistrationStatus.CONFIRMED

    def test_change_status_cancel(self, temp_db, test_registration, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        updated = service.cancel_registration(
            test_registration.id,
            reason='临时有事'
        )
        
        assert updated.status == RegistrationStatus.CANCELLED

    def test_invalid_registration_status_transition(self, temp_db, test_event, test_user):
        from event_manager.models import Registration
        completed_reg = Registration(
            event_id=test_event.id,
            user_id=test_user.id,
            participant_name='已完成',
            status=RegistrationStatus.COMPLETED
        )
        temp_db.add(completed_reg)
        temp_db.commit()
        temp_db.refresh(completed_reg)
        
        service = RegistrationService(temp_db, current_user=test_user)
        
        with pytest.raises(StateTransitionError):
            service.change_status(completed_reg.id, RegistrationStatus.PENDING)

    def test_get_versions(self, temp_db, test_registration, test_user):
        service = RegistrationService(temp_db, current_user=test_user)
        
        service.update_registration(
            test_registration.id,
            change_reason='第一次更新',
            notes='更新1'
        )
        service.update_registration(
            test_registration.id,
            change_reason='第二次更新',
            notes='更新2'
        )
        
        versions = service.get_versions(test_registration.id)
        
        assert len(versions) >= 2
        assert versions[0].version_number >= 2
