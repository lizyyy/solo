from app import db
from app.models import QualityRule, CheckTask, CheckResult, AnomalySample, Dataset
from datetime import datetime, date, timedelta
import json
import threading
import hashlib

class MockDataProvider:
    def __init__(self):
        self.data = {
            'customers': [
                {'id': 1, 'name': '张三', 'phone': '13800138001', 'email': 'zhangsan@example.com', 'created_at': '2024-01-01'},
                {'id': 2, 'name': '李四', 'phone': None, 'email': 'lisi@example.com', 'created_at': '2024-01-02'},
                {'id': 3, 'name': '王五', 'phone': '13800138003', 'email': None, 'created_at': '2024-01-03'},
                {'id': 4, 'name': '赵六', 'phone': None, 'email': 'zhaoliu@example.com', 'created_at': '2024-01-04'},
                {'id': 5, 'name': '钱七', 'phone': '13800138005', 'email': 'qianqi@example.com', 'created_at': '2024-01-05'},
            ],
            'orders': [
                {'id': 101, 'customer_id': 1, 'amount': 100.0, 'status': 'paid', 'created_at': '2024-01-01'},
                {'id': 102, 'customer_id': 2, 'amount': 50.0, 'status': 'paid', 'created_at': '2024-01-02'},
                {'id': 103, 'customer_id': 3, 'amount': 200.0, 'status': 'pending', 'created_at': '2024-01-03'},
                {'id': 104, 'customer_id': 1, 'amount': 50000.0, 'status': 'paid', 'created_at': '2024-01-04'},
                {'id': 105, 'customer_id': 4, 'amount': 75.0, 'status': 'paid', 'created_at': '2024-01-05'},
            ],
            'payments': [
                {'id': 201, 'order_id': 101, 'amount': 100.0, 'method': 'alipay', 'created_at': '2024-01-01'},
                {'id': 202, 'order_id': 102, 'amount': 45.0, 'method': 'wechat', 'created_at': '2024-01-02'},
                {'id': 203, 'order_id': 104, 'amount': 49000.0, 'method': 'alipay', 'created_at': '2024-01-04'},
                {'id': 204, 'order_id': 105, 'amount': 75.0, 'method': 'wechat', 'created_at': '2024-01-05'},
            ]
        }
    
    def get_table_data(self, table_name):
        return self.data.get(table_name, [])
    
    def get_previous_day_total(self, table_name, column_name):
        data = self.data.get(table_name, [])
        if not data:
            return 0.0
        return sum(row.get(column_name, 0) for row in data[:-1])

class CheckEngine:
    def __init__(self):
        self.data_provider = MockDataProvider()
    
    def run_check_async(self, task_id, rule_ids):
        thread = threading.Thread(target=self._run_check, args=(task_id, rule_ids))
        thread.start()
    
    def _run_check(self, task_id, rule_ids):
        from app import create_app
        app = create_app()
        
        with app.app_context():
            task = CheckTask.query.get(task_id)
            if not task:
                return
            
            try:
                task.status = 'running'
                db.session.commit()
                
                for rule_id in rule_ids:
                    rule = QualityRule.query.get(rule_id)
                    if not rule:
                        continue
                    
                    self._execute_rule(task.id, rule)
                
                task.status = 'completed'
                task.end_time = datetime.utcnow()
                
            except Exception as e:
                task.status = 'failed'
                task.error_message = str(e)
                task.end_time = datetime.utcnow()
            
            finally:
                db.session.commit()
    
    def _execute_rule(self, task_id, rule):
        try:
            threshold = json.loads(rule.threshold_config)
            dataset = Dataset.query.get(rule.dataset_id)
            table_data = self.data_provider.get_table_data(dataset.table_name)
            
            if rule.rule_type == 'null_rate':
                self._check_null_rate(task_id, rule, table_data, threshold)
            elif rule.rule_type == 'uniqueness':
                self._check_uniqueness(task_id, rule, table_data, threshold)
            elif rule.rule_type == 'value_range':
                self._check_value_range(task_id, rule, table_data, threshold)
            elif rule.rule_type == 'daily_fluctuation':
                self._check_daily_fluctuation(task_id, rule, table_data, threshold)
            elif rule.rule_type == 'cross_table_consistency':
                self._check_cross_table_consistency(task_id, rule, threshold)
            else:
                self._create_config_error_result(task_id, rule, f"未知规则类型: {rule.rule_type}")
        
        except Exception as e:
            self._create_config_error_result(task_id, rule, f"执行错误: {str(e)}")
    
    def _check_null_rate(self, task_id, rule, table_data, threshold):
        column_name = rule.column_name
        if not column_name:
            self._create_config_error_result(task_id, rule, "缺少列名配置")
            return
        
        total = len(table_data)
        if total == 0:
            self._create_result(task_id, rule, 'passed', 0.0, threshold['max_null_rate'], "表为空，无数据检查")
            return
        
        null_count = sum(1 for row in table_data if row.get(column_name) is None)
        null_rate = null_count / total
        
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type='passed' if null_rate <= threshold['max_null_rate'] else 'failed',
            actual_value=null_rate,
            expected_value=threshold['max_null_rate'],
            message=f"空值率检查: 总记录 {total}, 空值 {null_count}, 空值率 {null_rate:.2%}"
        )
        db.session.add(result)
        db.session.flush()
        
        if null_rate > threshold['max_null_rate']:
            sample_index = 0
            for row in table_data:
                if row.get(column_name) is None:
                    is_recurrence = self._check_recurrence(rule.id, row)
                    sample = AnomalySample(
                        result_id=result.id,
                        sample_data=json.dumps(row, ensure_ascii=False),
                        sample_index=sample_index,
                        is_recurrence=is_recurrence
                    )
                    db.session.add(sample)
                    sample_index += 1
                    if sample_index >= 100:
                        break
        
        db.session.commit()
    
    def _check_uniqueness(self, task_id, rule, table_data, threshold):
        column_name = rule.column_name
        if not column_name:
            self._create_config_error_result(task_id, rule, "缺少列名配置")
            return
        
        total = len(table_data)
        if total == 0:
            self._create_result(task_id, rule, 'passed', 1.0, threshold['min_unique_ratio'], "表为空，无数据检查")
            return
        
        values = [row.get(column_name) for row in table_data]
        unique_values = len(set(values))
        unique_ratio = unique_values / total
        
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type='passed' if unique_ratio >= threshold['min_unique_ratio'] else 'failed',
            actual_value=unique_ratio,
            expected_value=threshold['min_unique_ratio'],
            message=f"唯一性检查: 总记录 {total}, 唯一值 {unique_values}, 唯一率 {unique_ratio:.2%}"
        )
        db.session.add(result)
        db.session.flush()
        
        if unique_ratio < threshold['min_unique_ratio']:
            from collections import Counter
            counts = Counter(values)
            duplicates = [(v, c) for v, c in counts.items() if c > 1]
            sample_index = 0
            for value, count in duplicates:
                matching_rows = [r for r in table_data if r.get(column_name) == value]
                for row in matching_rows[:5]:
                    is_recurrence = self._check_recurrence(rule.id, row)
                    sample = AnomalySample(
                        result_id=result.id,
                        sample_data=json.dumps(row, ensure_ascii=False),
                        sample_index=sample_index,
                        is_recurrence=is_recurrence
                    )
                    db.session.add(sample)
                    sample_index += 1
                    if sample_index >= 100:
                        break
                if sample_index >= 100:
                    break
        
        db.session.commit()
    
    def _check_value_range(self, task_id, rule, table_data, threshold):
        column_name = rule.column_name
        if not column_name:
            self._create_config_error_result(task_id, rule, "缺少列名配置")
            return
        
        min_val = threshold.get('min_value')
        max_val = threshold.get('max_value')
        
        total = len(table_data)
        if total == 0:
            self._create_result(task_id, rule, 'passed', 0, max_val or min_val, "表为空，无数据检查")
            return
        
        out_of_range = []
        for row in table_data:
            val = row.get(column_name)
            if val is None:
                continue
            try:
                num_val = float(val)
                if min_val is not None and num_val < min_val:
                    out_of_range.append(row)
                elif max_val is not None and num_val > max_val:
                    out_of_range.append(row)
            except:
                pass
        
        failed_ratio = len(out_of_range) / total
        
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type='passed' if len(out_of_range) == 0 else 'failed',
            actual_value=failed_ratio,
            expected_value=0.0,
            message=f"取值范围检查: 总记录 {total}, 超出范围 {len(out_of_range)}, 超出比例 {failed_ratio:.2%}"
        )
        db.session.add(result)
        db.session.flush()
        
        if out_of_range:
            sample_index = 0
            for row in out_of_range:
                is_recurrence = self._check_recurrence(rule.id, row)
                sample = AnomalySample(
                    result_id=result.id,
                    sample_data=json.dumps(row, ensure_ascii=False),
                    sample_index=sample_index,
                    is_recurrence=is_recurrence
                )
                db.session.add(sample)
                sample_index += 1
                if sample_index >= 100:
                    break
        
        db.session.commit()
    
    def _check_daily_fluctuation(self, task_id, rule, table_data, threshold):
        column_name = rule.column_name
        if not column_name:
            self._create_config_error_result(task_id, rule, "缺少列名配置")
            return
        
        dataset = Dataset.query.get(rule.dataset_id)
        prev_total = self.data_provider.get_previous_day_total(dataset.table_name, column_name)
        current_total = sum(row.get(column_name, 0) for row in table_data if isinstance(row.get(column_name), (int, float)))
        
        if prev_total == 0:
            self._create_result(task_id, rule, 'passed', 0.0, 0.0, "昨日数据为0，无法计算波动")
            return
        
        change_ratio = (current_total - prev_total) / prev_total
        
        max_increase = threshold.get('max_increase_ratio', 1.0)
        max_decrease = threshold.get('max_decrease_ratio', 1.0)
        
        is_passed = True
        if change_ratio > 0 and change_ratio > max_increase:
            is_passed = False
        elif change_ratio < 0 and abs(change_ratio) > max_decrease:
            is_passed = False
        
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type='passed' if is_passed else 'failed',
            actual_value=change_ratio,
            expected_value=max_increase if change_ratio > 0 else -max_decrease,
            message=f"日环比波动检查: 昨日总额 {prev_total}, 今日总额 {current_total}, 波动 {change_ratio:.2%}"
        )
        db.session.add(result)
        db.session.flush()
        
        if not is_passed:
            for i, row in enumerate(table_data[:20]):
                is_recurrence = self._check_recurrence(rule.id, row)
                sample = AnomalySample(
                    result_id=result.id,
                    sample_data=json.dumps(row, ensure_ascii=False),
                    sample_index=i,
                    is_recurrence=is_recurrence
                )
                db.session.add(sample)
        
        db.session.commit()
    
    def _check_cross_table_consistency(self, task_id, rule, threshold):
        column_name = rule.column_name
        target_dataset_id = rule.target_dataset_id
        target_column_name = rule.target_column_name
        
        if not column_name or not target_dataset_id or not target_column_name:
            self._create_config_error_result(task_id, rule, "跨表规则配置不完整，缺少目标数据集或列名")
            return
        
        source_dataset = Dataset.query.get(rule.dataset_id)
        target_dataset = Dataset.query.get(target_dataset_id)
        
        if not target_dataset:
            self._create_config_error_result(task_id, rule, "目标数据集不存在")
            return
        
        source_data = self.data_provider.get_table_data(source_dataset.table_name)
        target_data = self.data_provider.get_table_data(target_dataset.table_name)
        
        source_total = sum(row.get(column_name, 0) for row in source_data if isinstance(row.get(column_name), (int, float)))
        target_total = sum(row.get(target_column_name, 0) for row in target_data if isinstance(row.get(target_column_name), (int, float)))
        
        if source_total == 0:
            self._create_result(task_id, rule, 'passed', 0.0, 0.0, "源表金额为0")
            return
        
        diff_ratio = abs(source_total - target_total) / source_total
        
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type='passed' if diff_ratio <= threshold['max_diff_ratio'] else 'failed',
            actual_value=diff_ratio,
            expected_value=threshold['max_diff_ratio'],
            message=f"跨表一致性检查: {source_dataset.table_name}.{column_name} 总额 {source_total}, {target_dataset.table_name}.{target_column_name} 总额 {target_total}, 差异率 {diff_ratio:.2%}"
        )
        db.session.add(result)
        db.session.flush()
        
        if diff_ratio > threshold['max_diff_ratio']:
            sample_data = {
                'source_table': source_dataset.table_name,
                'source_column': column_name,
                'source_total': source_total,
                'target_table': target_dataset.table_name,
                'target_column': target_column_name,
                'target_total': target_total,
                'diff_ratio': diff_ratio
            }
            is_recurrence = self._check_recurrence(rule.id, sample_data)
            sample = AnomalySample(
                result_id=result.id,
                sample_data=json.dumps(sample_data, ensure_ascii=False),
                sample_index=0,
                is_recurrence=is_recurrence
            )
            db.session.add(sample)
        
        db.session.commit()
    
    def _check_recurrence(self, rule_id, sample_row):
        sample_hash = hashlib.sha256(json.dumps(sample_row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        
        existing_samples = AnomalySample.query.join(CheckResult).filter(
            CheckResult.rule_id == rule_id,
            AnomalySample.confirmation_status == 'false_positive'
        ).all()
        
        for sample in existing_samples:
            try:
                existing_data = json.loads(sample.sample_data)
                existing_hash = hashlib.sha256(json.dumps(existing_data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
                if existing_hash == sample_hash:
                    return True
            except:
                continue
        
        return False
    
    def _create_result(self, task_id, rule, result_type, actual_value, expected_value, message):
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type=result_type,
            actual_value=actual_value,
            expected_value=expected_value,
            message=message
        )
        db.session.add(result)
        db.session.commit()
    
    def _create_config_error_result(self, task_id, rule, message):
        result = CheckResult(
            task_id=task_id,
            rule_id=rule.id,
            result_type='config_error',
            message=message
        )
        db.session.add(result)
        db.session.commit()
