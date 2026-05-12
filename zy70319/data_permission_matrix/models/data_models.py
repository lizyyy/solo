from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import UUID


class PermissionType(Enum):
    ALLOW = "allow"
    DENY = "deny"


class DataScopeType(Enum):
    SELF = "self"
    DEPARTMENT = "department"
    DEPARTMENT_AND_SUB = "department_and_sub"
    ALL = "all"
    CUSTOM = "custom"
    
    @property
    def priority(self) -> int:
        priorities = {
            "self": 1,
            "department": 2,
            "department_and_sub": 3,
            "all": 4,
            "custom": 5
        }
        return priorities[self.value]


class AuthorizationSource(Enum):
    ROLE = "role"
    DEPARTMENT = "department"
    TEMPORARY = "temporary"


@dataclass
class FieldPermission:
    object_type: str
    field_name: str
    permission_type: PermissionType
    can_read: bool = False
    can_write: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "object_type": self.object_type,
            "field_name": self.field_name,
            "permission_type": self.permission_type.value,
            "can_read": self.can_read,
            "can_write": self.can_write
        }


@dataclass
class DataScope:
    object_type: str
    scope_type: DataScopeType
    department_ids: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None
    custom_filter: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "object_type": self.object_type,
            "scope_type": self.scope_type.value,
            "department_ids": self.department_ids,
            "user_ids": self.user_ids,
            "custom_filter": self.custom_filter
        }


@dataclass
class Role:
    role_id: str
    role_name: str
    description: str = ""
    field_permissions: List[FieldPermission] = field(default_factory=list)
    data_scopes: List[DataScope] = field(default_factory=list)
    priority: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "role_id": self.role_id,
            "role_name": self.role_name,
            "description": self.description,
            "priority": self.priority,
            "field_permissions": [fp.to_dict() for fp in self.field_permissions],
            "data_scopes": [ds.to_dict() for ds in self.data_scopes]
        }


@dataclass
class Department:
    dept_id: str
    dept_name: str
    parent_dept_id: Optional[str] = None
    field_permissions: List[FieldPermission] = field(default_factory=list)
    data_scopes: List[DataScope] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dept_id": self.dept_id,
            "dept_name": self.dept_name,
            "parent_dept_id": self.parent_dept_id,
            "field_permissions": [fp.to_dict() for fp in self.field_permissions],
            "data_scopes": [ds.to_dict() for ds in self.data_scopes]
        }


@dataclass
class TemporaryAuthorization:
    auth_id: str
    user_id: str
    object_type: str
    field_permissions: List[FieldPermission] = field(default_factory=list)
    data_scopes: List[DataScope] = field(default_factory=list)
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    reason: str = ""
    granted_by: str = ""
    
    def is_active(self, check_time: Optional[datetime] = None) -> bool:
        now = check_time or datetime.now()
        if now < self.start_time:
            return False
        if self.end_time and now > self.end_time:
            return False
        return True
    
    def is_expired(self, check_time: Optional[datetime] = None) -> bool:
        now = check_time or datetime.now()
        return self.end_time is not None and now > self.end_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "auth_id": self.auth_id,
            "user_id": self.user_id,
            "object_type": self.object_type,
            "field_permissions": [fp.to_dict() for fp in self.field_permissions],
            "data_scopes": [ds.to_dict() for ds in self.data_scopes],
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "reason": self.reason,
            "granted_by": self.granted_by,
            "is_active": self.is_active()
        }


@dataclass
class User:
    user_id: str
    username: str
    full_name: str
    email: str
    department_id: str
    role_ids: List[str]
    is_active: bool = True
    is_employee: bool = True
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "username": self.username,
            "full_name": self.full_name,
            "email": self.email,
            "department_id": self.department_id,
            "role_ids": self.role_ids,
            "is_active": self.is_active,
            "is_employee": self.is_employee
        }


@dataclass
class EffectivePermission:
    user_id: str
    object_type: str
    field_name: str
    can_read: bool
    can_write: bool
    effective_permission_type: PermissionType
    sources: List[Dict[str, Any]]
    has_conflict: bool = False
    highest_priority_source: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "object_type": self.object_type,
            "field_name": self.field_name,
            "can_read": self.can_read,
            "can_write": self.can_write,
            "effective_permission_type": self.effective_permission_type.value,
            "sources": self.sources,
            "has_conflict": self.has_conflict,
            "highest_priority_source": self.highest_priority_source
        }


@dataclass
class EffectiveDataScope:
    user_id: str
    object_type: str
    scope_type: DataScopeType
    department_ids: List[str]
    user_ids: List[str]
    custom_filter: Optional[str]
    sources: List[Dict[str, Any]]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "object_type": self.object_type,
            "scope_type": self.scope_type.value,
            "department_ids": self.department_ids,
            "user_ids": self.user_ids,
            "custom_filter": self.custom_filter,
            "sources": self.sources
        }


@dataclass
class UserPermissionSummary:
    user_id: str
    full_name: str
    effective_permissions: Dict[str, Dict[str, EffectivePermission]]
    effective_data_scopes: Dict[str, EffectiveDataScope]
    risk_level: str = "low"
    risk_reasons: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "full_name": self.full_name,
            "risk_level": self.risk_level,
            "risk_reasons": self.risk_reasons,
            "effective_permissions": {
                obj_type: {
                    field: perm.to_dict() for field, perm in fields.items()
                } for obj_type, fields in self.effective_permissions.items()
            },
            "effective_data_scopes": {
                obj_type: scope.to_dict() for obj_type, scope in self.effective_data_scopes.items()
            }
        }
