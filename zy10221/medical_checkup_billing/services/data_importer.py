import json
import csv
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import os

from models.data_models import (
    GroupCheckup, Employee, Package, AddOn, Payment,
    DiscountPolicy, Refund
)


class DataStore:
    def __init__(self, data_dir: str = "./data_store"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.group_checkups: Dict[str, GroupCheckup] = {}
        self.employees: Dict[str, Employee] = {}
        self.packages: Dict[str, Package] = {}
        self.add_ons: Dict[str, AddOn] = {}
        self.payments: Dict[str, Payment] = {}
        self.discount_policies: Dict[str, DiscountPolicy] = {}
        self.refunds: Dict[str, Refund] = {}
        
        self._imported_files: Dict[str, str] = {}
        self._processed_add_ons: set = set()
        self._processed_payments: set = set()
        self._processed_refunds: set = set()
        
        self._state_file = self.data_dir / "datastore_state.json"
        self._load_state()

    def _load_state(self):
        if not self._state_file.exists():
            return
        
        try:
            with open(self._state_file, 'r', encoding='utf-8') as f:
                state = json.load(f)
            
            self._imported_files = state.get('imported_files', {})
            self._processed_add_ons = set(state.get('processed_add_ons', []))
            self._processed_payments = set(state.get('processed_payments', []))
            self._processed_refunds = set(state.get('processed_refunds', []))
            
            for item in state.get('group_checkups', []):
                self.group_checkups[item['company_id']] = GroupCheckup(**item)
            
            for item in state.get('employees', []):
                self.employees[item['employee_id']] = Employee(**item)
            
            for item in state.get('packages', []):
                self.packages[item['package_id']] = Package(**item)
            
            for item in state.get('add_ons', []):
                self.add_ons[item['add_on_id']] = AddOn(**item)
            
            for item in state.get('payments', []):
                self.payments[item['payment_id']] = Payment(**item)
            
            for item in state.get('discount_policies', []):
                self.discount_policies[item['policy_id']] = DiscountPolicy(**item)
            
            for item in state.get('refunds', []):
                self.refunds[item['refund_id']] = Refund(**item)
                
        except Exception as e:
            print(f"⚠️  加载数据状态失败: {e}")

    def _save_state(self):
        state = {
            'imported_files': self._imported_files,
            'processed_add_ons': list(self._processed_add_ons),
            'processed_payments': list(self._processed_payments),
            'processed_refunds': list(self._processed_refunds),
            'group_checkups': [gc.__dict__ for gc in self.group_checkups.values()],
            'employees': [e.__dict__ for e in self.employees.values()],
            'packages': [p.__dict__ for p in self.packages.values()],
            'add_ons': [a.__dict__ for a in self.add_ons.values()],
            'payments': [p.__dict__ for p in self.payments.values()],
            'discount_policies': [d.__dict__ for d in self.discount_policies.values()],
            'refunds': [r.__dict__ for r in self.refunds.values()],
        }
        
        with open(self._state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

    def clear(self):
        self.group_checkups.clear()
        self.employees.clear()
        self.packages.clear()
        self.add_ons.clear()
        self.payments.clear()
        self.discount_policies.clear()
        self.refunds.clear()
        self._imported_files.clear()
        self._processed_add_ons.clear()
        self._processed_payments.clear()
        self._processed_refunds.clear()
        
        if self._state_file.exists():
            self._state_file.unlink()
        print("✅ 数据已清空")

    def _generate_file_hash(self, file_path: str) -> str:
        hasher = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b''):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _is_file_imported(self, file_path: str) -> bool:
        file_hash = self._generate_file_hash(file_path)
        file_name = os.path.basename(file_path)
        
        if file_name in self._imported_files:
            if self._imported_files[file_name] == file_hash:
                return True
        return False

    def _mark_file_imported(self, file_path: str):
        file_hash = self._generate_file_hash(file_path)
        file_name = os.path.basename(file_path)
        self._imported_files[file_name] = file_hash

    def _load_json(self, file_path: str) -> Dict[str, Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _load_csv(self, file_path: str) -> List[Dict[str, str]]:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            return list(reader)

    def import_group_checkups(self, file_path: str):
        if self._is_file_imported(file_path):
            print(f"⚠️  文件已导入过: {os.path.basename(file_path)}，跳过")
            return

        data = self._load_json(file_path)
        for item in data:
            company = GroupCheckup(
                company_name=item['company_name'],
                company_id=item['company_id'],
                allowed_items=item.get('allowed_items', []),
                forbidden_items=item.get('forbidden_items', []),
                discount_rate=float(item.get('discount_rate', 1.0)),
                contract_number=item.get('contract_number', '')
            )
            self.group_checkups[company.company_id] = company
        
        self._mark_file_imported(file_path)
        self._save_state()
        print(f"✅ 已导入 {len(data)} 个团检企业")

    def import_employees(self, file_path: str):
        if self._is_file_imported(file_path):
            print(f"⚠️  文件已导入过: {os.path.basename(file_path)}，跳过")
            return

        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.json':
            data = self._load_json(file_path)
        else:
            data = self._load_csv(file_path)

        count = 0
        for item in data:
            emp = Employee(
                employee_id=str(item['employee_id']),
                name=item['name'],
                id_card=item['id_card'],
                company_id=item['company_id'],
                package_id=item['package_id'],
                checkup_date=item['checkup_date']
            )
            self.employees[emp.employee_id] = emp
            count += 1

        self._mark_file_imported(file_path)
        self._save_state()
        print(f"✅ 已导入 {count} 名员工")

    def import_packages(self, file_path: str):
        if self._is_file_imported(file_path):
            print(f"⚠️  文件已导入过: {os.path.basename(file_path)}，跳过")
            return

        data = self._load_json(file_path)
        for item in data:
            pkg = Package(
                package_id=item['package_id'],
                package_name=item['package_name'],
                base_items=item.get('base_items', []),
                base_price=float(item.get('base_price', 0.0))
            )
            self.packages[pkg.package_id] = pkg

        self._mark_file_imported(file_path)
        self._save_state()
        print(f"✅ 已导入 {len(data)} 个套餐")

    def import_add_ons(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.json':
            data = self._load_json(file_path)
        else:
            data = self._load_csv(file_path)

        new_count = 0
        duplicate_count = 0
        
        for item in data:
            add_on_id = str(item['add_on_id'])
            
            if add_on_id in self._processed_add_ons:
                duplicate_count += 1
                continue

            add_on = AddOn(
                add_on_id=add_on_id,
                employee_id=str(item['employee_id']),
                item_code=item['item_code'],
                item_name=item['item_name'],
                quantity=int(item['quantity']),
                unit_price=float(item['unit_price']),
                operator=item['operator'],
                timestamp=item['timestamp'],
                status=item.get('status', 'pending')
            )
            self.add_ons[add_on_id] = add_on
            self._processed_add_ons.add(add_on_id)
            new_count += 1

        self._save_state()
        print(f"✅ 新增加项: {new_count} 条, 重复跳过: {duplicate_count} 条")

    def import_payments(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.json':
            data = self._load_json(file_path)
        else:
            data = self._load_csv(file_path)

        new_count = 0
        duplicate_count = 0
        
        for item in data:
            payment_id = str(item['payment_id'])
            
            if payment_id in self._processed_payments:
                duplicate_count += 1
                continue

            payment = Payment(
                payment_id=payment_id,
                employee_id=str(item['employee_id']),
                add_on_id=str(item.get('add_on_id', '')),
                item_code=item['item_code'],
                amount=float(item['amount']),
                payment_method=item['payment_method'],
                operator=item['operator'],
                timestamp=item['timestamp'],
                status=item.get('status', 'completed')
            )
            self.payments[payment_id] = payment
            self._processed_payments.add(payment_id)
            new_count += 1

        self._save_state()
        print(f"✅ 新增收费: {new_count} 条, 重复跳过: {duplicate_count} 条")

    def import_discount_policies(self, file_path: str):
        if self._is_file_imported(file_path):
            print(f"⚠️  文件已导入过: {os.path.basename(file_path)}，跳过")
            return

        data = self._load_json(file_path)
        for item in data:
            policy = DiscountPolicy(
                policy_id=item['policy_id'],
                policy_name=item['policy_name'],
                company_id=item.get('company_id'),
                item_code=item.get('item_code'),
                discount_rate=float(item.get('discount_rate', 1.0)),
                valid_from=item.get('valid_from'),
                valid_to=item.get('valid_to')
            )
            self.discount_policies[policy.policy_id] = policy

        self._mark_file_imported(file_path)
        self._save_state()
        print(f"✅ 已导入 {len(data)} 个折扣政策")

    def import_refunds(self, file_path: str):
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.json':
            data = self._load_json(file_path)
        else:
            data = self._load_csv(file_path)

        new_count = 0
        duplicate_count = 0
        
        for item in data:
            refund_id = str(item['refund_id'])
            
            if refund_id in self._processed_refunds:
                duplicate_count += 1
                continue

            refund = Refund(
                refund_id=refund_id,
                original_payment_id=str(item['original_payment_id']),
                employee_id=str(item['employee_id']),
                amount=float(item['amount']),
                operator=item['operator'],
                timestamp=item['timestamp'],
                reason=item.get('reason', ''),
                status=item.get('status', 'completed')
            )
            self.refunds[refund_id] = refund
            self._processed_refunds.add(refund_id)
            new_count += 1

        self._save_state()
        print(f"✅ 新增退费: {new_count} 条, 重复跳过: {duplicate_count} 条")

    def get_summary(self) -> Dict[str, int]:
        return {
            "团检企业": len(self.group_checkups),
            "员工": len(self.employees),
            "套餐": len(self.packages),
            "加项记录": len(self.add_ons),
            "收费记录": len(self.payments),
            "折扣政策": len(self.discount_policies),
            "退费记录": len(self.refunds)
        }
