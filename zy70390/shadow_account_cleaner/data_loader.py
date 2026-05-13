"""数据加载器"""
import json
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

import yaml

from .models import Account, Employee, Permission


class DataLoader:
    """数据加载器"""
    
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
    
    def _parse_date(self, value: str) -> date:
        """解析日期"""
        for fmt in ['%Y-%m-%d', '%Y/%m/%d']:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {value}")
    
    def _parse_datetime(self, value: str) -> datetime:
        """解析日期时间"""
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M']:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            raise ValueError(f"无法解析日期时间: {value}")
    
    def load_employees(self, filename: str = "employees.yaml") -> List[Employee]:
        """加载HR员工数据"""
        file_path = self.data_dir / filename
        if not file_path.exists():
            file_path = self.data_dir / "employees.json"
        
        if not file_path.exists():
            return []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.suffix == '.json':
                data = json.load(f)
            else:
                data = yaml.safe_load(f)
        
        employees = []
        for item in data:
            emp_data = {
                'employee_id': item['employee_id'],
                'name': item['name'],
                'email': item['email'],
                'phone': item['phone'],
                'department': item['department'],
                'position': item['position'],
                'status': item['status'],
                'join_date': self._parse_date(item['join_date']),
            }
            if 'termination_date' in item and item['termination_date']:
                emp_data['termination_date'] = self._parse_date(item['termination_date'])
            if 'previous_departments' in item:
                emp_data['previous_departments'] = item['previous_departments']
            if 'previous_emails' in item:
                emp_data['previous_emails'] = item['previous_emails']
            if 'manager_id' in item:
                emp_data['manager_id'] = item['manager_id']
            
            employees.append(Employee(**emp_data))
        
        return employees
    
    def load_accounts(self, filename: str = "accounts.yaml") -> List[Account]:
        """加载系统账号数据"""
        file_path = self.data_dir / filename
        if not file_path.exists():
            file_path = self.data_dir / "accounts.json"
        
        if not file_path.exists():
            return []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.suffix == '.json':
                data = json.load(f)
            else:
                data = yaml.safe_load(f)
        
        accounts = []
        for item in data:
            acc_data = {
                'account_id': item['account_id'],
                'system': item['system'],
                'username': item['username'],
            }
            if 'name' in item:
                acc_data['name'] = item['name']
            if 'email' in item:
                acc_data['email'] = item['email']
            if 'phone' in item:
                acc_data['phone'] = item['phone']
            if 'employee_id' in item:
                acc_data['employee_id'] = item['employee_id']
            if 'status' in item:
                acc_data['status'] = item['status']
            if 'created_at' in item and item['created_at']:
                acc_data['created_at'] = self._parse_datetime(item['created_at'])
            if 'last_login' in item and item['last_login']:
                acc_data['last_login'] = self._parse_datetime(item['last_login'])
            if 'is_service_account' in item:
                acc_data['is_service_account'] = item['is_service_account']
            if 'service_account_owner' in item:
                acc_data['service_account_owner'] = item['service_account_owner']
            if 'service_account_expiry' in item and item['service_account_expiry']:
                acc_data['service_account_expiry'] = self._parse_date(item['service_account_expiry'])
            if 'notes' in item:
                acc_data['notes'] = item['notes']
            
            accounts.append(Account(**acc_data))
        
        return accounts
    
    def load_permissions(self, filename: str = "permissions.yaml") -> List[Permission]:
        """加载权限数据"""
        file_path = self.data_dir / filename
        if not file_path.exists():
            file_path = self.data_dir / "permissions.json"
        
        if not file_path.exists():
            return []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.suffix == '.json':
                data = json.load(f)
            else:
                data = yaml.safe_load(f)
        
        permissions = []
        for item in data:
            perm_data = {
                'permission_id': item['permission_id'],
                'account_id': item['account_id'],
                'system': item['system'],
                'role': item['role'],
            }
            if 'permissions' in item:
                perm_data['permissions'] = item['permissions']
            if 'is_high_risk' in item:
                perm_data['is_high_risk'] = item['is_high_risk']
            if 'granted_at' in item and item['granted_at']:
                perm_data['granted_at'] = self._parse_datetime(item['granted_at'])
            
            permissions.append(Permission(**perm_data))
        
        return permissions
