import pytest
from datetime import datetime

from event_manager.services.user_service import UserService
from event_manager.models import UserRole
from event_manager.exceptions import ValidationError, PermissionDeniedError, NotFoundError
from event_manager.utils import verify_password


class TestUserService:
    
    def test_create_user(self, temp_db):
        service = UserService(temp_db)
        
        user = service.create_user(
            username='newuser',
            password='password123',
            email='newuser@example.com',
            full_name='新用户',
            role=UserRole.VOLUNTEER
        )
        
        assert user is not None
        assert user.username == 'newuser'
        assert user.email == 'newuser@example.com'
        assert user.full_name == '新用户'
        assert user.role == UserRole.VOLUNTEER
        assert verify_password('password123', user.password_hash)

    def test_create_duplicate_user(self, temp_db, test_user):
        service = UserService(temp_db)
        
        with pytest.raises(ValidationError):
            service.create_user(
                username='testuser',
                password='anotherpass'
            )

    def test_authenticate_success(self, temp_db, test_user):
        service = UserService(temp_db)
        
        user = service.authenticate('testuser', 'testpass')
        
        assert user is not None
        assert user.username == 'testuser'

    def test_authenticate_fail_wrong_password(self, temp_db, test_user):
        service = UserService(temp_db)
        
        user = service.authenticate('testuser', 'wrongpassword')
        
        assert user is None

    def test_get_user_by_id(self, temp_db, test_user):
        service = UserService(temp_db)
        
        user = service.get_user_by_id(test_user.id)
        
        assert user is not None
        assert user.id == test_user.id

    def test_get_user_by_username(self, temp_db, test_user):
        service = UserService(temp_db)
        
        user = service.get_user_by_username('testuser')
        
        assert user is not None
        assert user.username == 'testuser'

    def test_list_users(self, temp_db, test_user, test_organizer, test_admin):
        service = UserService(temp_db)
        
        users = service.list_users()
        
        assert len(users) >= 3
        
        volunteers = service.list_users(role=UserRole.VOLUNTEER)
        assert len(volunteers) >= 1

    def test_update_user_password(self, temp_db, test_user):
        service = UserService(temp_db, current_user=test_user)
        
        updated_user = service.update_user(test_user.id, password='newpassword')
        
        assert verify_password('newpassword', updated_user.password_hash)

    def test_update_user_role_requires_admin(self, temp_db, test_user, test_admin):
        service = UserService(temp_db, current_user=test_user)
        
        with pytest.raises(PermissionDeniedError):
            service.update_user(test_user.id, role=UserRole.ADMIN)

    def test_deactivate_user(self, temp_db, test_user, test_admin):
        service = UserService(temp_db, current_user=test_admin)
        
        user = service.deactivate_user(test_user.id)
        
        assert user.is_active == False

    def test_deactivate_user_requires_admin(self, temp_db, test_user, test_organizer):
        service = UserService(temp_db, current_user=test_organizer)
        
        with pytest.raises(PermissionDeniedError):
            service.deactivate_user(test_user.id)

    def test_create_user_without_login(self, temp_db):
        service = UserService(temp_db, current_user=None)
        
        user = service.create_user(
            username='guestuser',
            password='guestpass'
        )
        
        assert user is not None
        assert user.role == UserRole.VOLUNTEER

    def test_create_admin_user_without_login(self, temp_db):
        service = UserService(temp_db, current_user=None)
        
        with pytest.raises(PermissionDeniedError):
            service.create_user(
                username='newadmin',
                password='adminpass',
                role=UserRole.ADMIN
            )
