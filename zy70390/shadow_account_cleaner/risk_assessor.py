"""风险评估模块"""
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from .config import Config
from .models import Account, DisablePlan, Employee, MatchResult, OwnerMark, Permission, RiskAssessment


class RiskAssessor:
    """风险评估器"""
    
    def __init__(self, config: Config):
        self.config = config
    
    def _get_account_permissions(
        self, account: Account, permissions: List[Permission]
    ) -> List[Permission]:
        """获取账号的所有权限"""
        return [p for p in permissions if p.account_id == account.account_id]
    
    def _has_high_risk_permission(self, account: Account, permissions: List[Permission]) -> bool:
        """检查账号是否有高风险权限"""
        system_config = self.config.systems.get(account.system, None)
        if not system_config:
            return False
        
        account_perms = self._get_account_permissions(account, permissions)
        for perm in account_perms:
            if perm.is_high_risk:
                return True
            if perm.role in system_config.high_risk_roles:
                return True
        return False
    
    def _get_best_match(
        self, account: Account, matches: List[MatchResult]
    ) -> Optional[MatchResult]:
        """获取最佳匹配（排除歧义匹配）"""
        account_matches = [m for m in matches if m.account_id == account.account_id]
        if not account_matches:
            return None
        
        # 优先选择非歧义的高置信度匹配
        non_ambiguous = [m for m in account_matches if not m.is_ambiguous]
        if non_ambiguous:
            return max(non_ambiguous, key=lambda x: x.confidence)
        
        # 否则返回置信度最高的（但仍是歧义的）
        return max(account_matches, key=lambda x: x.confidence)
    
    def assess_account(
        self,
        account: Account,
        accounts: List[Account],
        employees: List[Employee],
        matches: List[MatchResult],
        permissions: List[Permission],
        owner_marks: List[OwnerMark],
        disable_plans: List[DisablePlan],
        current_date: Optional[date] = None
    ) -> List[RiskAssessment]:
        """评估单个账号的风险"""
        risks = []
        current_date = current_date or date.today()
        best_match = self._get_best_match(account, matches)
        
        # 检查是否已有活跃的认领记录
        active_owner_mark = None
        for mark in reversed(owner_marks):
            if mark.account_id == account.account_id:
                if mark.is_exemption:
                    if mark.exemption_expiry and mark.exemption_expiry < current_date:
                        # 豁免已过期
                        risks.append(RiskAssessment(
                            account_id=account.account_id,
                            risk_level='high',
                            risk_type='service_account_expired',
                            description=f'服务账号豁免已过期 (到期日: {mark.exemption_expiry})',
                            recommended_action='重新评估豁免必要性或禁用账号',
                            evidence={'exemption_expiry': str(mark.exemption_expiry), 'reason': mark.reason},
                            score=0.85
                        ))
                    else:
                        # 豁免有效，跳过其他检查
                        active_owner_mark = mark
                else:
                    active_owner_mark = mark
                break
        
        if active_owner_mark and not (active_owner_mark.is_exemption and active_owner_mark.exemption_expiry and active_owner_mark.exemption_expiry < current_date):
            # 已有有效认领，仅在豁免过期时报告
            return risks
        
        # 检查是否已有禁用计划
        has_pending_plan = any(
            p.account_id == account.account_id and p.status == 'pending'
            for p in disable_plans
        )
        if has_pending_plan:
            return risks
        
        # 只检查活跃账号
        if account.status != 'active':
            return risks
        
        # 风险类型1: 离职员工账号未禁用
        if best_match and not best_match.is_ambiguous:
            employee = next(
                (e for e in employees if e.employee_id == best_match.employee_id),
                None
            )
            if employee:
                if employee.status == 'terminated':
                    has_high_risk = self._has_high_risk_permission(account, permissions)
                    risk_score = 0.9 if has_high_risk else 0.75
                    risks.append(RiskAssessment(
                        account_id=account.account_id,
                        risk_level='high' if has_high_risk else 'medium',
                        risk_type='terminated_employee',
                        description=f'离职员工账号仍活跃 (员工: {employee.name}, 离职日: {employee.termination_date})',
                        recommended_action='立即禁用该账号',
                        evidence={
                            'employee_id': employee.employee_id,
                            'employee_name': employee.name,
                            'termination_date': str(employee.termination_date) if employee.termination_date else 'N/A',
                            'has_high_risk_permission': str(has_high_risk)
                        },
                        score=risk_score
                    ))
                
                # 风险类型2: 转岗员工残留高权限
                elif employee.status == 'transferred':
                    has_high_risk = self._has_high_risk_permission(account, permissions)
                    if has_high_risk:
                        prev_depts = ', '.join(employee.previous_departments) if employee.previous_departments else '未知'
                        risks.append(RiskAssessment(
                            account_id=account.account_id,
                            risk_level='high',
                            risk_type='transferred_stale',
                            description=f'转岗员工仍持有原部门高权限 (原部门: {prev_depts}, 现部门: {employee.department})',
                            recommended_action='重新评估权限并撤销不必要的高权限',
                            evidence={
                                'employee_id': employee.employee_id,
                                'employee_name': employee.name,
                                'current_department': employee.department,
                                'previous_departments': prev_depts
                            },
                            score=0.8
                        ))
        
        # 风险类型3: 无人认领账号
        if not best_match:
            # 检查是否是服务账号
            if account.is_service_account:
                if not account.service_account_expiry or account.service_account_expiry < current_date:
                    risks.append(RiskAssessment(
                        account_id=account.account_id,
                        risk_level='high',
                        risk_type='service_account_expired',
                        description='服务账号无豁免或豁免已过期',
                        recommended_action='确认服务账号用途，设置负责人和到期时间，或禁用',
                        evidence={
                            'service_account_owner': account.service_account_owner or '未设置',
                            'expiry_date': str(account.service_account_expiry) if account.service_account_expiry else '未设置'
                        },
                        score=0.7
                    ))
            else:
                # 无人认领的普通账号
                has_high_risk = self._has_high_risk_permission(account, permissions)
                last_login_days = None
                if account.last_login:
                    delta = current_date - account.last_login.date()
                    last_login_days = delta.days
                
                risk_level = 'high' if has_high_risk else 'medium'
                if last_login_days and last_login_days > 90:
                    risk_level = 'high'
                    risk_score = 0.85
                elif has_high_risk:
                    risk_score = 0.8
                else:
                    risk_score = 0.5
                
                risks.append(RiskAssessment(
                    account_id=account.account_id,
                    risk_level=risk_level,
                    risk_type='unclaimed',
                    description='无法匹配到任何在职员工的账号',
                    recommended_action='确认账号归属或禁用',
                    evidence={
                        'last_login_days': str(last_login_days) if last_login_days else '未知',
                        'has_high_risk_permission': str(has_high_risk),
                        'system': account.system
                    },
                    score=risk_score
                ))
        
        # 风险类型4: 重复账号（同一个人在同一系统有多个活跃账号）
        if best_match and not best_match.is_ambiguous:
            # 查找同一员工在同一系统的其他账号
            same_employee_accounts = []
            for other_match in matches:
                if (other_match.employee_id == best_match.employee_id and
                    other_match.account_id != account.account_id and
                    not other_match.is_ambiguous):
                    other_account = next(
                        (a for a in accounts if a.account_id == other_match.account_id),
                        None
                    )
                    if (other_account and other_account.system == account.system and
                        other_account.status == 'active'):
                        same_employee_accounts.append(other_account)
            
            if same_employee_accounts:
                risks.append(RiskAssessment(
                    account_id=account.account_id,
                    risk_level='medium',
                    risk_type='duplicate',
                    description=f'同一员工在 {account.system} 系统有多个活跃账号',
                    recommended_action='合并或清理冗余账号',
                    evidence={
                        'employee_id': best_match.employee_id,
                        'other_accounts': ', '.join(a.username for a in same_employee_accounts)
                    },
                    score=0.5
                ))
        
        return risks
    
    def assess_all(
        self,
        accounts: List[Account],
        employees: List[Employee],
        matches: List[MatchResult],
        permissions: List[Permission],
        owner_marks: List[OwnerMark],
        disable_plans: List[DisablePlan],
        current_date: Optional[date] = None
    ) -> List[RiskAssessment]:
        """评估所有账号的风险"""
        all_risks = []
        for account in accounts:
            risks = self.assess_account(
                account, accounts, employees, matches, permissions,
                owner_marks, disable_plans, current_date
            )
            all_risks.extend(risks)
        
        return sorted(all_risks, key=lambda x: x.score, reverse=True)
