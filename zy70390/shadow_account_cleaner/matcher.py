"""匹配引擎 - 账号与HR员工数据匹配"""
from typing import Dict, List, Optional, Tuple

from .models import Account, Employee, MatchResult


class Matcher:
    """账号与员工匹配引擎"""
    
    def __init__(self, employees: List[Employee], accounts: List[Account]):
        self.employees = employees
        self.accounts = accounts
        self._employee_index = self._build_indexes()
    
    def _build_indexes(self) -> Dict[str, Dict[str, List[Employee]]]:
        """构建员工索引"""
        indexes = {
            'employee_id': {},
            'email': {},
            'phone': {},
            'name': {},
        }
        
        for emp in self.employees:
            # 员工号索引
            if emp.employee_id not in indexes['employee_id']:
                indexes['employee_id'][emp.employee_id] = []
            indexes['employee_id'][emp.employee_id].append(emp)
            
            # 邮箱索引
            for email in [emp.email] + emp.previous_emails:
                email_lower = email.lower().strip()
                if email_lower not in indexes['email']:
                    indexes['email'][email_lower] = []
                indexes['email'][email_lower].append(emp)
            
            # 手机号索引
            if emp.phone not in indexes['phone']:
                indexes['phone'][emp.phone] = []
            indexes['phone'][emp.phone].append(emp)
            
            # 姓名索引
            name_norm = self._normalize_name(emp.name)
            if name_norm not in indexes['name']:
                indexes['name'][name_norm] = []
            indexes['name'][name_norm].append(emp)
        
        return indexes
    
    @staticmethod
    def _normalize_name(name: str) -> str:
        """标准化姓名"""
        return ''.join(name.split()).lower()
    
    @staticmethod
    def _normalize_email(email: str) -> str:
        """标准化邮箱"""
        return email.lower().strip()
    
    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """标准化手机号"""
        return ''.join(filter(str.isdigit, phone))
    
    def match_account(self, account: Account) -> List[MatchResult]:
        """匹配单个账号"""
        matches = []
        seen_employees = set()
        
        # 1. 员工号精确匹配
        if account.employee_id:
            emp_list = self._employee_index['employee_id'].get(account.employee_id, [])
            for emp in emp_list:
                if emp.employee_id not in seen_employees:
                    matches.append(MatchResult(
                        account_id=account.account_id,
                        employee_id=emp.employee_id,
                        confidence=1.0,
                        evidence={'employee_id': emp.employee_id},
                        match_method='exact_employee_id',
                        is_ambiguous=False
                    ))
                    seen_employees.add(emp.employee_id)
        
        # 2. 邮箱精确匹配
        if account.email:
            email_norm = self._normalize_email(account.email)
            emp_list = self._employee_index['email'].get(email_norm, [])
            for emp in emp_list:
                if emp.employee_id not in seen_employees:
                    evidence = {'email': account.email}
                    if emp.email.lower() == email_norm:
                        evidence['email_type'] = 'current'
                    else:
                        evidence['email_type'] = 'historical'
                    matches.append(MatchResult(
                        account_id=account.account_id,
                        employee_id=emp.employee_id,
                        confidence=0.95,
                        evidence=evidence,
                        match_method='exact_email',
                        is_ambiguous=False
                    ))
                    seen_employees.add(emp.employee_id)
        
        # 3. 手机号精确匹配
        if account.phone:
            phone_norm = self._normalize_phone(account.phone)
            emp_list = self._employee_index['phone'].get(phone_norm, [])
            for emp in emp_list:
                if emp.employee_id not in seen_employees:
                    matches.append(MatchResult(
                        account_id=account.account_id,
                        employee_id=emp.employee_id,
                        confidence=0.9,
                        evidence={'phone': account.phone},
                        match_method='exact_phone',
                        is_ambiguous=False
                    ))
                    seen_employees.add(emp.employee_id)
        
        # 4. 姓名匹配（可能有歧义）
        if account.name and account.name.strip():
            name_norm = self._normalize_name(account.name)
            emp_list = self._employee_index['name'].get(name_norm, [])
            if emp_list and not any(m.employee_id in {e.employee_id for e in emp_list} for m in matches):
                is_ambiguous = len(emp_list) > 1
                for emp in emp_list:
                    if emp.employee_id not in seen_employees:
                        # 计算置信度
                        confidence = 0.6
                        evidence = {'name': account.name}
                        
                        # 部门匹配加分
                        if account.system and emp.department:
                            dept_system_map = {
                                '技术部': ['git', 'bi'],
                                '销售部': ['crm', 'bi'],
                                '市场部': ['crm'],
                            }
                            if account.system in dept_system_map.get(emp.department, []):
                                confidence += 0.15
                                evidence['department_match'] = emp.department
                        
                        matches.append(MatchResult(
                            account_id=account.account_id,
                            employee_id=emp.employee_id,
                            confidence=min(confidence, 0.9),
                            evidence=evidence,
                            match_method='name_match',
                            is_ambiguous=is_ambiguous
                        ))
                        seen_employees.add(emp.employee_id)
        
        # 5. 用户名/显示名模糊匹配
        if not matches and account.username:
            username_norm = self._normalize_name(account.username)
            # 尝试在姓名索引中查找
            for name_key, emp_list in self._employee_index['name'].items():
                if username_norm in name_key or name_key in username_norm:
                    for emp in emp_list:
                        if emp.employee_id not in seen_employees:
                            confidence = 0.4
                            if len(username_norm) == len(name_key):
                                confidence = 0.55
                            matches.append(MatchResult(
                                account_id=account.account_id,
                                employee_id=emp.employee_id,
                                confidence=confidence,
                                evidence={'username': account.username, 'matched_name': emp.name},
                                match_method='fuzzy_username',
                                is_ambiguous=True
                            ))
                            seen_employees.add(emp.employee_id)
        
        return matches
    
    def match_all(self) -> List[MatchResult]:
        """匹配所有账号"""
        all_matches = []
        for account in self.accounts:
            # 跳过已被认领或豁免的账号（这些在风险评估中单独处理）
            if account.is_service_account:
                continue
            
            matches = self.match_account(account)
            all_matches.extend(matches)
        
        return all_matches
    
    def get_account_matches(self, account_id: str) -> List[MatchResult]:
        """获取指定账号的所有匹配"""
        account = next((a for a in self.accounts if a.account_id == account_id), None)
        if not account:
            return []
        return self.match_account(account)
