from datetime import datetime
from typing import Dict, List, Optional, Any, Set, Tuple
from collections import defaultdict

from models.data_models import (
    User, Role, Department, TemporaryAuthorization,
    FieldPermission, DataScope, PermissionType, DataScopeType,
    EffectivePermission, EffectiveDataScope, UserPermissionSummary,
    AuthorizationSource
)
from utils.helpers import get_sub_departments


class PermissionEngine:
    """权限计算引擎"""
    
    def __init__(
        self,
        users: Dict[str, User],
        roles: Dict[str, Role],
        departments: Dict[str, Department],
        temp_auths: List[TemporaryAuthorization]
    ):
        self.users = users
        self.roles = roles
        self.departments = departments
        self.temp_auths = temp_auths
        self._processed_temp_auths: Dict[str, List[TemporaryAuthorization]] = defaultdict(list)
        for auth in temp_auths:
            self._processed_temp_auths[auth.user_id].append(auth)
    
    def _collect_user_permission_sources(
        self,
        user: User,
        object_type: str,
        check_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """收集用户的所有权限来源"""
        sources = []
        
        for role_id in user.role_ids:
            if role_id in self.roles:
                role = self.roles[role_id]
                for fp in role.field_permissions:
                    if fp.object_type == object_type:
                        sources.append({
                            'source_type': AuthorizationSource.ROLE.value,
                            'source_id': role_id,
                            'source_name': role.role_name,
                            'priority': role.priority,
                            'permission': fp
                        })
        
        dept_chain = self._get_department_chain(user.department_id)
        for dept_id in dept_chain:
            if dept_id in self.departments:
                dept = self.departments[dept_id]
                for fp in dept.field_permissions:
                    if fp.object_type == object_type:
                        sources.append({
                            'source_type': AuthorizationSource.DEPARTMENT.value,
                            'source_id': dept_id,
                            'source_name': dept.dept_name,
                            'priority': 0,
                            'permission': fp
                        })
        
        if user.user_id in self._processed_temp_auths:
            for auth in self._processed_temp_auths[user.user_id]:
                if auth.object_type == object_type and auth.is_active(check_time):
                    for fp in auth.field_permissions:
                        if fp.object_type == object_type:
                            sources.append({
                                'source_type': AuthorizationSource.TEMPORARY.value,
                                'source_id': auth.auth_id,
                                'source_name': f'临时授权({auth.reason or auth.auth_id})',
                                'priority': 100,
                                'permission': fp,
                                'auth_start': auth.start_time,
                                'auth_end': auth.end_time
                            })
        
        return sources
    
    def _get_department_chain(self, dept_id: str) -> List[str]:
        """获取部门链（从当前部门到顶级部门）"""
        chain = [dept_id]
        current_id = dept_id
        while current_id in self.departments:
            dept = self.departments[current_id]
            if dept.parent_dept_id:
                chain.append(dept.parent_dept_id)
                current_id = dept.parent_dept_id
            else:
                break
        return chain
    
    def _calculate_effective_field_permissions(
        self,
        user: User,
        object_type: str,
        sources: List[Dict[str, Any]]
    ) -> Dict[str, EffectivePermission]:
        """计算有效字段权限"""
        field_permissions: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        for src in sources:
            fp: FieldPermission = src['permission']
            field_permissions[fp.field_name].append(src)
        
        effective_perms = {}
        
        for field_name, src_list in field_permissions.items():
            deny_sources = [s for s in src_list if s['permission'].permission_type == PermissionType.DENY]
            allow_sources = [s for s in src_list if s['permission'].permission_type == PermissionType.ALLOW]
            
            has_conflict = len(deny_sources) > 0 and len(allow_sources) > 0
            
            if deny_sources:
                highest_deny = max(deny_sources, key=lambda x: x['priority'])
                effective_perm = EffectivePermission(
                    user_id=user.user_id,
                    object_type=object_type,
                    field_name=field_name,
                    can_read=False,
                    can_write=False,
                    effective_permission_type=PermissionType.DENY,
                    sources=src_list,
                    has_conflict=has_conflict,
                    highest_priority_source=highest_deny
                )
            else:
                effective_can_read = any(s['permission'].can_read for s in allow_sources)
                effective_can_write = any(s['permission'].can_write for s in allow_sources)
                highest_allow = max(allow_sources, key=lambda x: x['priority']) if allow_sources else None
                
                effective_perm = EffectivePermission(
                    user_id=user.user_id,
                    object_type=object_type,
                    field_name=field_name,
                    can_read=effective_can_read,
                    can_write=effective_can_write,
                    effective_permission_type=PermissionType.ALLOW if allow_sources else PermissionType.DENY,
                    sources=src_list,
                    has_conflict=has_conflict,
                    highest_priority_source=highest_allow
                )
            
            effective_perms[field_name] = effective_perm
        
        return effective_perms
    
    def _collect_data_scope_sources(
        self,
        user: User,
        object_type: str,
        check_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """收集数据范围来源"""
        sources = []
        
        for role_id in user.role_ids:
            if role_id in self.roles:
                role = self.roles[role_id]
                for ds in role.data_scopes:
                    if ds.object_type == object_type:
                        sources.append({
                            'source_type': AuthorizationSource.ROLE.value,
                            'source_id': role_id,
                            'source_name': role.role_name,
                            'priority': role.priority,
                            'data_scope': ds
                        })
        
        dept_chain = self._get_department_chain(user.department_id)
        for dept_id in dept_chain:
            if dept_id in self.departments:
                dept = self.departments[dept_id]
                for ds in dept.data_scopes:
                    if ds.object_type == object_type:
                        sources.append({
                            'source_type': AuthorizationSource.DEPARTMENT.value,
                            'source_id': dept_id,
                            'source_name': dept.dept_name,
                            'priority': 0,
                            'data_scope': ds
                        })
        
        if user.user_id in self._processed_temp_auths:
            for auth in self._processed_temp_auths[user.user_id]:
                if auth.object_type == object_type and auth.is_active(check_time):
                    for ds in auth.data_scopes:
                        if ds.object_type == object_type:
                            sources.append({
                                'source_type': AuthorizationSource.TEMPORARY.value,
                                'source_id': auth.auth_id,
                                'source_name': f'临时授权({auth.reason or auth.auth_id})',
                                'priority': 100,
                                'data_scope': ds,
                                'auth_start': auth.start_time,
                                'auth_end': auth.end_time
                            })
        
        return sources
    
    def _calculate_effective_data_scope(
        self,
        user: User,
        object_type: str,
        sources: List[Dict[str, Any]]
    ) -> Optional[EffectiveDataScope]:
        """计算有效数据范围"""
        if not sources:
            return None
        
        highest_priority = max(s['priority'] for s in sources)
        top_sources = [s for s in sources if s['priority'] == highest_priority]
        
        all_dept_ids: Set[str] = set()
        all_user_ids: Set[str] = set()
        effective_scope_type = DataScopeType.SELF
        
        for src in top_sources:
            ds: DataScope = src['data_scope']
            
            if ds.scope_type.priority > effective_scope_type.priority:
                effective_scope_type = ds.scope_type
            
            if ds.department_ids:
                all_dept_ids.update(ds.department_ids)
            if ds.user_ids:
                all_user_ids.update(ds.user_ids)
        
        if effective_scope_type == DataScopeType.DEPARTMENT:
            all_dept_ids.add(user.department_id)
        elif effective_scope_type == DataScopeType.DEPARTMENT_AND_SUB:
            sub_depts = get_sub_departments(user.department_id, self.departments)
            all_dept_ids.update(sub_depts)
        elif effective_scope_type == DataScopeType.ALL:
            all_dept_ids.update(self.departments.keys())
        
        custom_filters = [s['data_scope'].custom_filter for s in top_sources if s['data_scope'].custom_filter]
        effective_filter = ' AND '.join(f'({f})' for f in custom_filters) if custom_filters else None
        
        return EffectiveDataScope(
            user_id=user.user_id,
            object_type=object_type,
            scope_type=effective_scope_type,
            department_ids=sorted(all_dept_ids),
            user_ids=sorted(all_user_ids),
            custom_filter=effective_filter,
            sources=top_sources
        )
    
    def calculate_user_permissions(
        self,
        user_id: str,
        object_type: str,
        check_time: Optional[datetime] = None
    ) -> Optional[UserPermissionSummary]:
        """计算指定用户对某类数据的权限"""
        if user_id not in self.users:
            return None
        
        user = self.users[user_id]
        check_time = check_time or datetime.now()
        
        perm_sources = self._collect_user_permission_sources(user, object_type, check_time)
        effective_perms = self._calculate_effective_field_permissions(user, object_type, perm_sources)
        
        scope_sources = self._collect_data_scope_sources(user, object_type, check_time)
        effective_scope = self._calculate_effective_data_scope(user, object_type, scope_sources)
        
        scopes_dict = {}
        if effective_scope:
            scopes_dict[object_type] = effective_scope
        
        summary = UserPermissionSummary(
            user_id=user_id,
            full_name=user.full_name,
            effective_permissions={object_type: effective_perms},
            effective_data_scopes=scopes_dict
        )
        
        self._assess_risk(summary, user, object_type, check_time)
        
        return summary
    
    def _assess_risk(
        self,
        summary: UserPermissionSummary,
        user: User,
        object_type: str,
        check_time: datetime
    ) -> None:
        """评估风险等级"""
        risk_reasons = []
        risk_level = "low"
        
        if not user.is_active:
            risk_reasons.append("用户已离职/停用但仍有配置")
            risk_level = "high"
        
        if not user.is_employee:
            has_temp_auths = any(
                auth.user_id == user.user_id and auth.is_active(check_time)
                for auth in self.temp_auths
            )
            if has_temp_auths:
                risk_reasons.append("外包人员拥有临时授权")
                risk_level = "medium"
        
        if object_type in summary.effective_permissions:
            perms = summary.effective_permissions[object_type]
            for field_name, ep in perms.items():
                if ep.has_conflict:
                    risk_reasons.append(f"字段 {field_name} 存在权限冲突")
                    if risk_level == "low":
                        risk_level = "medium"
        
        if user.user_id in self._processed_temp_auths:
            for auth in self._processed_temp_auths[user.user_id]:
                if auth.is_expired(check_time):
                    risk_reasons.append(f"存在过期临时授权: {auth.auth_id}")
                    if risk_level == "low":
                        risk_level = "medium"
        
        summary.risk_level = risk_level
        summary.risk_reasons = risk_reasons
    
    def check_field_permission(
        self,
        user_id: str,
        object_type: str,
        field_name: str,
        operation: str = "read",
        check_time: Optional[datetime] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """检查用户是否有某字段的特定权限"""
        summary = self.calculate_user_permissions(user_id, object_type, check_time)
        if not summary:
            return False, None
        
        if object_type not in summary.effective_permissions:
            return False, None
        
        perms = summary.effective_permissions[object_type]
        if field_name not in perms:
            return False, None
        
        ep = perms[field_name]
        if operation == "read":
            result = ep.can_read
        elif operation == "write":
            result = ep.can_write
        else:
            result = False
        
        explanation = {
            "can_access": result,
            "effective_permission_type": ep.effective_permission_type.value,
            "has_conflict": ep.has_conflict,
            "sources": ep.sources,
            "highest_priority_source": ep.highest_priority_source
        }
        
        return result, explanation
    
    def get_expired_authorizations(self, check_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """获取所有过期的临时授权"""
        check_time = check_time or datetime.now()
        expired = []
        
        for auth in self.temp_auths:
            if auth.is_expired(check_time):
                user = self.users.get(auth.user_id)
                expired.append({
                    "auth_id": auth.auth_id,
                    "user_id": auth.user_id,
                    "user_name": user.full_name if user else "Unknown",
                    "object_type": auth.object_type,
                    "end_time": auth.end_time,
                    "reason": auth.reason,
                    "granted_by": auth.granted_by
                })
        
        return expired
    
    def get_all_object_types(self) -> Set[str]:
        """获取所有数据对象类型"""
        object_types = set()
        
        for role in self.roles.values():
            for fp in role.field_permissions:
                object_types.add(fp.object_type)
            for ds in role.data_scopes:
                object_types.add(ds.object_type)
        
        for dept in self.departments.values():
            for fp in dept.field_permissions:
                object_types.add(fp.object_type)
            for ds in dept.data_scopes:
                object_types.add(ds.object_type)
        
        for auth in self.temp_auths:
            object_types.add(auth.object_type)
        
        return object_types
