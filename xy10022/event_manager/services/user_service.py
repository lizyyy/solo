from typing import Optional, List
from sqlalchemy.orm import Session

from ..models import User, UserRole
from ..exceptions import NotFoundError, ValidationError, PermissionDeniedError
from ..utils import hash_password, verify_password
from ..logger import log_action, log_error, log_warning

class UserService:
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

    def create_user(self, username: str, password: str, email: str = None, full_name: str = None, role: UserRole = UserRole.VOLUNTEER) -> User:
        if role in [UserRole.ADMIN, UserRole.ORGANIZER]:
            self._require_permission(UserRole.ADMIN)
        
        if not username or not password:
            raise ValidationError('用户名和密码不能为空')
        
        if self.db.query(User).filter(User.username == username).first():
            raise ValidationError('用户名已存在')
        
        if email and self.db.query(User).filter(User.email == email).first():
            raise ValidationError('邮箱已被使用')

        user = User(
            username=username,
            password_hash=hash_password(password),
            email=email,
            full_name=full_name,
            role=role
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        log_action('create_user', {'username': username, 'role': role.value}, user_id=self.current_user.id if self.current_user else None, resource_type='user', resource_id=user.id)
        return user

    def authenticate(self, username: str, password: str) -> Optional[User]:
        user = self.db.query(User).filter(User.username == username, User.is_active == True).first()
        if user and verify_password(password, user.password_hash):
            log_action('login', {'username': username}, user_id=user.id)
            return user
        log_warning('login_failed', {'username': username})
        return None

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        user = self.db.query(User).filter(User.id == user_id).first()
        return user

    def get_user_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def list_users(self, role: UserRole = None, active_only: bool = True) -> List[User]:
        query = self.db.query(User)
        if role:
            query = query.filter(User.role == role)
        if active_only:
            query = query.filter(User.is_active == True)
        return query.order_by(User.created_at.desc()).all()

    def update_user(self, user_id: int, **kwargs) -> User:
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError(f'用户不存在: {user_id}')
        
        if self.current_user and self.current_user.id != user_id:
            self._require_permission(UserRole.ADMIN)
        
        if 'password' in kwargs and kwargs['password']:
            user.password_hash = hash_password(kwargs.pop('password'))
        
        if 'username' in kwargs and kwargs['username'] != user.username:
            existing = self.db.query(User).filter(User.username == kwargs['username'], User.id != user_id).first()
            if existing:
                raise ValidationError('用户名已存在')
        
        if 'email' in kwargs and kwargs['email'] and kwargs['email'] != user.email:
            existing = self.db.query(User).filter(User.email == kwargs['email'], User.id != user_id).first()
            if existing:
                raise ValidationError('邮箱已被使用')
        
        if 'role' in kwargs and self.current_user:
            self._require_permission(UserRole.ADMIN)
        
        for key, value in kwargs.items():
            if value is not None and hasattr(user, key):
                setattr(user, key, value)
        
        self.db.commit()
        self.db.refresh(user)
        log_action('update_user', {'user_id': user_id, 'fields': list(kwargs.keys())}, user_id=self.current_user.id if self.current_user else None, resource_type='user', resource_id=user_id)
        return user

    def deactivate_user(self, user_id: int) -> User:
        self._require_permission(UserRole.ADMIN)
        user = self.get_user_by_id(user_id)
        if not user:
            raise NotFoundError(f'用户不存在: {user_id}')
        if user.role == UserRole.ADMIN:
            active_admins = self.db.query(User).filter(User.role == UserRole.ADMIN, User.is_active == True).count()
            if active_admins <= 1:
                raise ValidationError('至少需要保留一个活跃的管理员')
        
        user.is_active = False
        self.db.commit()
        self.db.refresh(user)
        log_action('deactivate_user', {'user_id': user_id}, user_id=self.current_user.id, resource_type='user', resource_id=user_id)
        return user
