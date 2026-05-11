import json
import pickle
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any
from .models import SystemState, MigrationPlan, MigrationResult


class StateStorage:
    def __init__(self, work_dir: Path):
        self.work_dir = work_dir
        self.state_file = work_dir / '.migration_state.pkl'
        self.plan_file = work_dir / '.current_plan.json'
        self.result_file = work_dir / '.current_result.json'

    def save_state(self, state: SystemState):
        with open(self.state_file, 'wb') as f:
            pickle.dump(state, f)

    def load_state(self) -> SystemState:
        if self.state_file.exists():
            with open(self.state_file, 'rb') as f:
                return pickle.load(f)
        return SystemState()

    def save_plan(self, plan: MigrationPlan):
        with open(self.plan_file, 'w', encoding='utf-8') as f:
            json.dump(self._plan_to_dict(plan), f, ensure_ascii=False, indent=2, default=str)

    def load_plan(self) -> Optional[MigrationPlan]:
        if not self.plan_file.exists():
            return None
        with open(self.plan_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return self._dict_to_plan(data)

    def save_result(self, result: MigrationResult):
        with open(self.result_file, 'w', encoding='utf-8') as f:
            json.dump(self._result_to_dict(result), f, ensure_ascii=False, indent=2, default=str)

    def load_result(self) -> Optional[MigrationResult]:
        if not self.result_file.exists():
            return None
        with open(self.result_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return self._dict_to_result(data)

    def clear_all(self):
        for f in [self.state_file, self.plan_file, self.result_file]:
            if f.exists():
                f.unlink()

    def _plan_to_dict(self, plan: MigrationPlan) -> Dict:
        return {
            'plan_id': plan.plan_id,
            'created_at': plan.created_at.isoformat() if plan.created_at else None,
            'total_users': plan.total_users,
            'validation_errors': plan.validation_errors,
            'pending_items': [self._item_to_dict(i) for i in plan.pending_items],
            'needs_review_items': [self._item_to_dict(i) for i in plan.needs_review_items],
        }

    def _dict_to_plan(self, data: Dict) -> MigrationPlan:
        from .models import MigrationItem, MigrationStatus, MigrationPlan
        plan = MigrationPlan(
            plan_id=data.get('plan_id', ''),
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else datetime.now(),
            total_users=data.get('total_users', 0),
            validation_errors=data.get('validation_errors', []),
        )
        plan.pending_items = [self._dict_to_item(i) for i in data.get('pending_items', [])]
        plan.needs_review_items = [self._dict_to_item(i) for i in data.get('needs_review_items', [])]
        return plan

    def _result_to_dict(self, result: MigrationResult) -> Dict:
        return {
            'plan_id': result.plan_id,
            'executed_at': result.executed_at.isoformat() if result.executed_at else None,
            'is_simulation': result.is_simulation,
            'total_items': result.total_items,
            'success_count': result.success_count,
            'failed_count': result.failed_count,
            'skipped_count': result.skipped_count,
            'success_items': [self._item_to_dict(i) for i in result.success_items],
            'failed_items': [self._item_to_dict(i) for i in result.failed_items],
            'skipped_items': [self._item_to_dict(i) for i in result.skipped_items],
        }

    def _dict_to_result(self, data: Dict) -> MigrationResult:
        from .models import MigrationResult
        result = MigrationResult(
            plan_id=data.get('plan_id', ''),
            executed_at=datetime.fromisoformat(data['executed_at']) if data.get('executed_at') else datetime.now(),
            is_simulation=data.get('is_simulation', True),
            total_items=data.get('total_items', 0),
            success_count=data.get('success_count', 0),
            failed_count=data.get('failed_count', 0),
            skipped_count=data.get('skipped_count', 0),
        )
        result.success_items = [self._dict_to_item(i) for i in data.get('success_items', [])]
        result.failed_items = [self._dict_to_item(i) for i in data.get('failed_items', [])]
        result.skipped_items = [self._dict_to_item(i) for i in data.get('skipped_items', [])]
        return result

    def _item_to_dict(self, item) -> Dict:
        return {
            'old_user_id': item.old_user_id,
            'new_user_id': item.new_user_id,
            'phone': item.phone,
            'points_to_migrate': item.points_to_migrate,
            'status': item.status.value if hasattr(item.status, 'value') else item.status,
            'error_reason': item.error_reason,
            'warnings': item.warnings,
            'retries': item.retries,
            'migrated_at': item.migrated_at.isoformat() if item.migrated_at else None,
            'coupons_count': len(getattr(item, 'coupons', [])),
            'points_records_count': len(getattr(item, 'points_records', [])),
        }

    def _dict_to_item(self, data: Dict):
        from .models import MigrationItem, MigrationStatus
        item = MigrationItem(
            old_user_id=data['old_user_id'],
            new_user_id=data['new_user_id'],
            phone=data.get('phone'),
            points_to_migrate=data.get('points_to_migrate', 0),
            status=MigrationStatus(data.get('status', 'pending')),
            error_reason=data.get('error_reason'),
            warnings=data.get('warnings', []),
            retries=data.get('retries', 0),
        )
        if data.get('migrated_at'):
            item.migrated_at = datetime.fromisoformat(data['migrated_at'])
        return item
