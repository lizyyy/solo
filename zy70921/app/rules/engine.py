from typing import Dict, List, Any, Optional
from app.models import Sample, TestItem, RetestRule
from sqlalchemy.orm import Session

class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = self._load_active_rules()

    def _load_active_rules(self) -> List[RetestRule]:
        return self.db.query(RetestRule).filter(RetestRule.is_active == True).order_by(RetestRule.priority.desc()).all()

    def process_sample(self, sample_data: Dict[str, Any], test_items: List[Dict[str, Any]]) -> Dict[str, Any]:
        result = {
            'sample': sample_data,
            'test_items': test_items,
            'status': 'normal',
            'issues': [],
            'retest_required': False,
            'retest_reason': None
        }

        for test_item in test_items:
            item_status = self._check_test_item(test_item)
            if item_status != 'normal':
                result['issues'].append({
                    'item_name': test_item.get('item_name'),
                    'status': item_status,
                    'details': test_item
                })

        if result['issues']:
            has_failed = any(issue['status'] == 'failed' for issue in result['issues'])
            if has_failed:
                result['status'] = 'failed'
            else:
                result['status'] = 'pending'

        for rule in self.rules:
            if self._apply_rule(rule, result):
                break

        return result

    def _check_test_item(self, test_item: Dict[str, Any]) -> str:
        limit_value = test_item.get('limit_value')
        test_value = test_item.get('test_value')

        if limit_value is None or test_value is None:
            return 'pending'

        try:
            limit = float(limit_value)
            value = float(test_value)
            if value > limit:
                return 'failed'
            else:
                return 'normal'
        except (ValueError, TypeError):
            return 'pending'

    def _apply_rule(self, rule: RetestRule, result: Dict[str, Any]) -> bool:
        try:
            condition_expr = rule.condition_expr
            if not condition_expr:
                return False

            context = {
                'result': result,
                'sample': result['sample'],
                'test_items': result['test_items'],
                'status': result['status']
            }

            if eval(condition_expr, {'__builtins__': {}}, context):
                action_expr = rule.action_expr
                if action_expr:
                    exec(action_expr, {'__builtins__': {}}, context)
                    result.update(context.get('result', result))
                return True
        except Exception:
            pass
        return False
