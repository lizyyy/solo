import pytest
from datetime import datetime, timedelta

from event_manager.services.event_service import EventService
from event_manager.models import Event, EventStatus, EventVersion
from event_manager.exceptions import ValidationError, PermissionDeniedError, NotFoundError, StateTransitionError


class TestEventService:
    
    def test_create_event(self, temp_db, test_organizer):
        service = EventService(temp_db, current_user=test_organizer)
        
        event = service.create_event(
            title='新活动',
            start_time=datetime.now() + timedelta(days=14),
            end_time=datetime.now() + timedelta(days=14, hours=4),
            location='新地点',
            description='新活动描述',
            max_participants=100
        )
        
        assert event is not None
        assert event.title == '新活动'
        assert event.location == '新地点'
        assert event.status == EventStatus.DRAFT
        
        versions = service.get_versions(event.id)
        assert len(versions) == 1
        assert versions[0].version_number == 1

    def test_create_event_requires_organizer(self, temp_db, test_user):
        service = EventService(temp_db, current_user=test_user)
        
        with pytest.raises(PermissionDeniedError):
            service.create_event(
                title='测试活动',
                start_time=datetime.now() + timedelta(days=7)
            )

    def test_create_event_without_login(self, temp_db):
        service = EventService(temp_db, current_user=None)
        
        with pytest.raises(PermissionDeniedError):
            service.create_event(
                title='测试活动',
                start_time=datetime.now() + timedelta(days=7)
            )

    def test_get_event_by_id(self, temp_db, test_event):
        service = EventService(temp_db, current_user=None)
        
        event = service.get_event_by_id(test_event.id)
        
        assert event is not None
        assert event.id == test_event.id

    def test_list_events(self, temp_db, test_event, test_organizer):
        service = EventService(temp_db, current_user=test_organizer)
        
        events = service.list_events()
        
        assert len(events) >= 1

    def test_update_event(self, temp_db, test_event, test_organizer):
        service = EventService(temp_db, current_user=test_organizer)
        
        updated_event = service.update_event(
            test_event.id,
            change_reason='更新活动信息',
            title='更新后的活动',
            max_participants=200
        )
        
        assert updated_event.title == '更新后的活动'
        assert updated_event.max_participants == 200
        
        versions = service.get_versions(test_event.id)
        assert len(versions) >= 1

    def test_update_event_by_non_owner_volunteer(self, temp_db, test_event, test_user):
        service = EventService(temp_db, current_user=test_user)
        
        with pytest.raises(PermissionDeniedError):
            service.update_event(
                test_event.id,
                title='试图修改'
            )

    def test_change_status_publish(self, temp_db, test_event, test_organizer):
        temp_db.refresh(test_event)
        test_event.status = EventStatus.DRAFT
        temp_db.commit()
        temp_db.refresh(test_event)
        
        service = EventService(temp_db, current_user=test_organizer)
        
        updated_event = service.change_status(
            test_event.id,
            EventStatus.PUBLISHED,
            reason='准备就绪'
        )
        
        assert updated_event.status == EventStatus.PUBLISHED

    def test_change_status_ongoing_after_start(self, temp_db, test_organizer):
        event = Event(
            title='已开始的活动',
            start_time=datetime.now() - timedelta(days=1),
            status=EventStatus.PUBLISHED,
            created_by=test_organizer.id
        )
        temp_db.add(event)
        temp_db.commit()
        temp_db.refresh(event)
        
        service = EventService(temp_db, current_user=test_organizer)
        
        updated_event = service.change_status(event.id, EventStatus.ONGOING)
        
        assert updated_event.status == EventStatus.ONGOING

    def test_invalid_status_transition(self, temp_db, test_event, test_organizer):
        service = EventService(temp_db, current_user=test_organizer)
        
        with pytest.raises(StateTransitionError):
            service.change_status(test_event.id, EventStatus.DRAFT)

    def test_delete_event(self, temp_db, test_organizer):
        event = Event(
            title='可删除的活动',
            start_time=datetime.now() + timedelta(days=7),
            status=EventStatus.DRAFT,
            created_by=test_organizer.id
        )
        temp_db.add(event)
        temp_db.commit()
        temp_db.refresh(event)
        
        service = EventService(temp_db, current_user=test_organizer)
        
        result = service.delete_event(event.id)
        
        assert result == True
        
        deleted_event = service.get_event_by_id(event.id)
        assert deleted_event is None

    def test_delete_published_event_fails(self, temp_db, test_event, test_organizer):
        service = EventService(temp_db, current_user=test_organizer)
        
        with pytest.raises(ValidationError):
            service.delete_event(test_event.id)

    def test_get_registration_stats(self, temp_db, test_event, test_registration, test_organizer):
        service = EventService(temp_db, current_user=test_organizer)
        
        stats = service.get_registration_stats(test_event.id)
        
        assert stats['total'] >= 1
        assert stats['pending'] >= 1
