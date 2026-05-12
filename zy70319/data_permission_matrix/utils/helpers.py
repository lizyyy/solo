import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from models.data_models import (
    User, Role, Department, TemporaryAuthorization,
    FieldPermission, DataScope, PermissionType, DataScopeType
)


def parse_datetime(dt_str: str) -> datetime:
    """解析ISO格式的日期时间字符串"""
    try:
        return datetime.fromisoformat(dt_str)
    except ValueError:
        return datetime.now()


def load_json_file(file_path: str) -> Dict[str, Any]:
    """加载JSON文件"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json_file(data: Dict[str, Any], file_path: str) -> None:
    """保存JSON文件"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def ensure_directory_exists(dir_path: str) -> None:
    """确保目录存在"""
    os.makedirs(dir_path, exist_ok=True)


def parse_field_permission(fp_data: Dict[str, Any]) -> FieldPermission:
    """解析字段权限数据"""
    return FieldPermission(
        object_type=fp_data['object_type'],
        field_name=fp_data['field_name'],
        permission_type=PermissionType(fp_data.get('permission_type', 'allow')),
        can_read=fp_data.get('can_read', False),
        can_write=fp_data.get('can_write', False)
    )


def parse_data_scope(ds_data: Dict[str, Any]) -> DataScope:
    """解析数据范围数据"""
    return DataScope(
        object_type=ds_data['object_type'],
        scope_type=DataScopeType(ds_data.get('scope_type', 'self')),
        department_ids=ds_data.get('department_ids'),
        user_ids=ds_data.get('user_ids'),
        custom_filter=ds_data.get('custom_filter')
    )


def parse_user(user_data: Dict[str, Any]) -> User:
    """解析用户数据"""
    return User(
        user_id=user_data['user_id'],
        username=user_data['username'],
        full_name=user_data['full_name'],
        email=user_data['email'],
        department_id=user_data['department_id'],
        role_ids=user_data.get('role_ids', []),
        is_active=user_data.get('is_active', True),
        is_employee=user_data.get('is_employee', True)
    )


def parse_role(role_data: Dict[str, Any]) -> Role:
    """解析角色数据"""
    return Role(
        role_id=role_data['role_id'],
        role_name=role_data['role_name'],
        description=role_data.get('description', ''),
        field_permissions=[
            parse_field_permission(fp) for fp in role_data.get('field_permissions', [])
        ],
        data_scopes=[
            parse_data_scope(ds) for ds in role_data.get('data_scopes', [])
        ],
        priority=role_data.get('priority', 0)
    )


def parse_department(dept_data: Dict[str, Any]) -> Department:
    """解析部门数据"""
    return Department(
        dept_id=dept_data['dept_id'],
        dept_name=dept_data['dept_name'],
        parent_dept_id=dept_data.get('parent_dept_id'),
        field_permissions=[
            parse_field_permission(fp) for fp in dept_data.get('field_permissions', [])
        ],
        data_scopes=[
            parse_data_scope(ds) for ds in dept_data.get('data_scopes', [])
        ]
    )


def parse_temporary_auth(auth_data: Dict[str, Any]) -> TemporaryAuthorization:
    """解析临时授权数据"""
    return TemporaryAuthorization(
        auth_id=auth_data['auth_id'],
        user_id=auth_data['user_id'],
        object_type=auth_data['object_type'],
        field_permissions=[
            parse_field_permission(fp) for fp in auth_data.get('field_permissions', [])
        ],
        data_scopes=[
            parse_data_scope(ds) for ds in auth_data.get('data_scopes', [])
        ],
        start_time=parse_datetime(auth_data.get('start_time', datetime.now().isoformat())),
        end_time=parse_datetime(auth_data['end_time']) if auth_data.get('end_time') else None,
        reason=auth_data.get('reason', ''),
        granted_by=auth_data.get('granted_by', '')
    )


def get_sub_departments(dept_id: str, departments: Dict[str, Department]) -> List[str]:
    """获取所有子部门ID"""
    result = [dept_id]
    for dept in departments.values():
        if dept.parent_dept_id == dept_id:
            result.extend(get_sub_departments(dept.dept_id, departments))
    return result


def format_date_for_report(dt: datetime) -> str:
    """格式化日期用于报告"""
    return dt.strftime('%Y-%m-%d %H:%M:%S')
