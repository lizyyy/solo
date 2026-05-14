from typing import Dict, Any, List, Tuple
from datetime import datetime
from app.models.models import Rule, EdgeNode, CheckResult
import operator


class RuleEngine:
    def __init__(self):
        self.operators = {
            'eq': operator.eq,
            'ne': operator.ne,
            'gt': operator.gt,
            'ge': operator.ge,
            'lt': operator.lt,
            'le': operator.le,
            'contains': lambda a, b: b in a if isinstance(a, (str, list)) else False,
            'not_contains': lambda a, b: b not in a if isinstance(a, (str, list)) else True,
            'in': lambda a, b: a in b if isinstance(b, (list, tuple)) else False,
            'not_in': lambda a, b: a not in b if isinstance(b, (list, tuple)) else True,
            'startswith': lambda a, b: a.startswith(b) if isinstance(a, str) else False,
            'endswith': lambda a, b: a.endswith(b) if isinstance(a, str) else False,
        }

    def evaluate_condition(self, condition: Dict[str, Any], node_data: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        field = condition.get('field')
        op = condition.get('operator')
        expected = condition.get('value')

        if not all([field, op]):
            return False, {'error': 'Invalid condition structure'}

        actual = node_data.get(field)
        op_func = self.operators.get(op)

        if not op_func:
            return False, {'error': f'Unknown operator: {op}'}

        try:
            result = op_func(actual, expected)
            details = {
                'field': field,
                'operator': op,
                'expected_value': expected,
                'actual_value': actual,
                'evaluation_result': result
            }
            return result, details
        except Exception as e:
            return False, {'error': str(e), 'field': field, 'actual': actual, 'expected': expected}

    def evaluate_composite(self, conditions: List[Dict[str, Any]], node_data: Dict[str, Any], logic: str = 'and') -> Tuple[bool, List[Dict[str, Any]]]:
        all_details = []
        results = []

        for cond in conditions:
            if 'conditions' in cond:
                sub_result, sub_details = self.evaluate_composite(
                    cond['conditions'],
                    node_data,
                    cond.get('logic', 'and')
                )
                results.append(sub_result)
                all_details.extend(sub_details)
            else:
                result, details = self.evaluate_condition(cond, node_data)
                results.append(result)
                all_details.append(details)

        if logic == 'and':
            final_result = all(results)
        elif logic == 'or':
            final_result = any(results)
        else:
            final_result = all(results)

        return final_result, all_details

    def check_node(self, node: EdgeNode, rules: List[Rule]) -> List[CheckResult]:
        results = []
        node_data = {
            'node_id': node.node_id,
            'node_name': node.node_name,
            'region': node.region,
            'group': node.group,
            'hardware_model': node.hardware_model,
            'software_version': node.software_version,
            'ip_address': node.ip_address,
            'responsible_team': node.responsible_team,
            **(node.extra_data or {})
        }

        for rule in rules:
            condition = rule.condition
            is_blocked = False
            all_details = []
            block_reason = ''

            if 'conditions' in condition:
                is_blocked, all_details = self.evaluate_composite(
                    condition['conditions'],
                    node_data,
                    condition.get('logic', 'and')
                )
            else:
                is_blocked, details = self.evaluate_condition(condition, node_data)
                all_details = [details]

            if is_blocked:
                block_reason = f"节点 '{node.node_name}' ({node.node_id}) 因规则 '{rule.name}' 被拦截: {rule.description}"

            result = CheckResult(
                rule_id=rule.id,
                rule_code=rule.code,
                rule_name=rule.name,
                risk_type=rule.risk_type,
                is_blocked=is_blocked,
                block_reason=block_reason,
                details={'evaluations': all_details}
            )
            results.append(result)

        return results

    def get_rule_snapshot(self, rules: List[Rule]) -> Dict[str, Any]:
        return {
            'rules': [
                {
                    'id': r.id,
                    'code': r.code,
                    'name': r.name,
                    'description': r.description,
                    'risk_type': r.risk_type,
                    'version': r.version,
                    'condition': r.condition
                }
                for r in rules
            ],
            'snapshot_time': datetime.now().isoformat()
        }


rule_engine = RuleEngine()
