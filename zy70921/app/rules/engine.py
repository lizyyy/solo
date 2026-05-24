from typing import Dict, List, Any, Optional
from app.models import Sample, TestItem, RetestRule, TestResult
from sqlalchemy.orm import Session

class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules = self._load_active_rules()

    def _load_active_rules(self) -> List[RetestRule]:
        return self.db.query(RetestRule).filter(RetestRule.is_active == True).order_by(RetestRule.priority.desc()).all()

    def check_duplicate_submission(self, batch_no: str, sample_code: str) -> bool:
        existing = self.db.query(Sample).filter(
            Sample.batch_no == batch_no,
            Sample.sample_code == sample_code
        ).first()
        return existing is not None

    def check_mixed_batch(self, batch_no: str, sample_type: str) -> Dict[str, Any]:
        samples = self.db.query(Sample).filter(Sample.batch_no == batch_no).all()
        if not samples:
            return {"mixed": False, "types": [sample_type]}
        
        types = set()
        for s in samples:
            if s.sample_type:
                types.add(s.sample_type)
        types.add(sample_type)
        
        return {
            "mixed": len(types) > 1,
            "types": list(types)
        }


    def get_suggestion(self, status, failed_reason, issues):
        suggestions = []
        if status == 'failed':
            suggestions.append('检测结果不合格，建议')
            if failed_reason:
                if '菌落总数' in failed_reason or '微生物' in failed_reason:
                    suggestions.append('检查生产环境卫生条件')
                    suggestions.append('评估灭菌工艺有效性')
                if '重金属' in failed_reason:
                    suggestions.append('追溯原材料来源')
                    suggestions.append('检测原料重金属含量')
                if '农药残留' in failed_reason:
                    suggestions.append('核查种植过程农药使用记录')
            suggestions.append('对同批次产品进行抽样复检')
            suggestions.append('必要时启动不合格品召回程序')
        elif status == 'pending':
            suggestions.append('检测结果待确认，建议')
            suggestions.append('人工复核检测数据')
            suggestions.append('检查检测设备状态')
            suggestions.append('确认检测操作流程规范')
            if issues:
                for issue in issues:
                    if issue.get('status') == 'pending':
                        suggestions.append('重点复核项目：' + issue.get('item_name', ''))
        else:
            suggestions.append('检测结果正常')
        return '；'.join(suggestions)

    def process_sample(self, sample_data, test_items):
        batch_no = sample_data.get('batch_no', '')
        sample_code = sample_data.get('sample_code', '')
        sample_type = sample_data.get('sample_type', '')
        original_line_no = sample_data.get('original_line_no')

        result = {
            'sample': sample_data,
            'test_items': test_items,
            'status': 'normal',
            'issues': [],
            'retest_required': False,
            'retest_reason': None,
            'original_line_no': original_line_no
        }

        if self.check_duplicate_submission(batch_no, sample_code):
            result['status'] = 'failed'
            result['issues'].append({
                'item_name': '重复提交检查',
                'status': 'failed',
                'details': '该批次号+样品编码已存在'
            })
            result['duplicate'] = True
        else:
            mixed_check = self.check_mixed_batch(batch_no, sample_type)
            if mixed_check['mixed']:
                result['issues'].append({
                    'item_name': '混批检测',
                    'status': 'warning',
                    'details': '批次号下存在多种样品类型: ' + ', '.join(mixed_check['types'])
                })
                result['mixed_batch'] = True
                result['mixed_batch_types'] = mixed_check['types']

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

        failed_reason = None
        if result['issues']:
            failed_reason = '; '.join([issue.get('item_name', '') + ': ' + issue.get('status', '') for issue in result['issues']])

        suggestion = self.get_suggestion(result['status'], failed_reason, result['issues'])

        result['original_data'] = sample_data
        result['result_type'] = result['status']
        result['failed_reason'] = failed_reason
        result['suggestion'] = suggestion
        result['rule_triggered'] = result['retest_required']

        return result

    def _check_test_item(self, test_item):
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

    def _apply_rule(self, rule, result):
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
