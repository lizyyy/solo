from models import RecalcTask, CustomerUsage, BillingResult, Plan, DiscountRule, ConfigVersion, CacheKey
from database import db_session
from datetime import datetime
import json
import time


class RecalcService:
    
    def create_recalc_task(self, customer_ids=None, config_version_id=None):
        task_type = 'specific' if customer_ids else 'full'
        if config_version_id and not customer_ids:
            task_type = 'config_based'
        
        total_items = len(customer_ids) if customer_ids else self._get_total_customers()
        
        task = RecalcTask(
            task_type=task_type,
            config_version_id=config_version_id,
            customer_ids=json.dumps(customer_ids) if customer_ids else '[]',
            total_items=total_items,
            status='pending'
        )
        db_session.add(task)
        db_session.commit()
        
        return task
    
    def _get_total_customers(self):
        from sqlalchemy import func
        result = db_session.query(func.count(CustomerUsage.customer_id.distinct())).scalar()
        return result or 0
    
    def process_recalc_task(self, task_id):
        task = RecalcTask.query.get(task_id)
        if not task:
            return
        
        try:
            task.status = 'running'
            task.started_at = datetime.utcnow()
            db_session.commit()
            
            customer_ids = json.loads(task.customer_ids) if task.customer_ids else []
            
            if not customer_ids:
                customer_ids = self._get_all_customer_ids()
            
            processed = 0
            total = len(customer_ids)
            results = {
                'success': 0,
                'failed': 0,
                'changes': []
            }
            
            for customer_id in customer_ids:
                try:
                    change = self._recalculate_customer_billing(customer_id, task.config_version_id)
                    if change:
                        results['changes'].append(change)
                    results['success'] += 1
                except Exception as e:
                    results['failed'] += 1
                    print(f"Error recalculating customer {customer_id}: {e}")
                
                processed += 1
                task.processed_items = processed
                task.progress = int((processed / total) * 100) if total > 0 else 0
                db_session.commit()
                
                time.sleep(0.1)
            
            task.status = 'completed'
            task.completed_at = datetime.utcnow()
            task.result_summary = json.dumps(results)
            db_session.commit()
            
        except Exception as e:
            task.status = 'failed'
            task.error_message = str(e)
            task.completed_at = datetime.utcnow()
            db_session.commit()
    
    def _get_all_customer_ids(self):
        from sqlalchemy import distinct
        result = db_session.query(distinct(CustomerUsage.customer_id)).all()
        return [r[0] for r in result]
    
    def _recalculate_customer_billing(self, customer_id, config_version_id=None):
        usages = CustomerUsage.query.filter_by(customer_id=customer_id).all()
        
        changes = []
        
        for usage in usages:
            plan = Plan.query.get(usage.plan_id)
            if not plan:
                continue
            
            old_result = BillingResult.query.filter_by(
                customer_id=customer_id,
                usage_id=usage.id
            ).first()
            
            base_cost = plan.monthly_cost
            discount_amount = 0.0
            discount_rule_id = None
            
            discount_rules = DiscountRule.query.filter_by(is_active=True).all()
            for discount in discount_rules:
                if self._is_discount_applicable(discount, usage, plan):
                    if discount.rule_type == 'percentage':
                        discount_amount = base_cost * (discount.discount_value / 100)
                    elif discount.rule_type == 'fixed':
                        discount_amount = discount.discount_value
                    discount_rule_id = discount.id
                    break
            
            final_cost = max(0, base_cost - discount_amount)
            
            calculation_details = {
                'base_cost': base_cost,
                'discount_amount': discount_amount,
                'discount_rule_id': discount_rule_id,
                'usage_data': json.loads(usage.usage_data) if usage.usage_data else {},
                'plan_features': json.loads(plan.features) if plan.features else []
            }
            
            if old_result:
                old_final = old_result.final_cost
                if abs(old_final - final_cost) > 0.01:
                    changes.append({
                        'customer_id': customer_id,
                        'usage_id': usage.id,
                        'billing_month': usage.usage_month,
                        'old_cost': old_final,
                        'new_cost': final_cost,
                        'difference': final_cost - old_final
                    })
                
                old_result.base_cost = base_cost
                old_result.discount_amount = discount_amount
                old_result.final_cost = final_cost
                old_result.discount_rule_id = discount_rule_id
                old_result.calculation_details = json.dumps(calculation_details)
                old_result.config_version_id = config_version_id
                old_result.calculated_at = datetime.utcnow()
            else:
                new_result = BillingResult(
                    customer_id=customer_id,
                    usage_id=usage.id,
                    plan_id=usage.plan_id,
                    discount_rule_id=discount_rule_id,
                    billing_month=usage.usage_month,
                    base_cost=base_cost,
                    discount_amount=discount_amount,
                    final_cost=final_cost,
                    calculation_details=json.dumps(calculation_details),
                    config_version_id=config_version_id,
                    calculated_at=datetime.utcnow()
                )
                db_session.add(new_result)
                
                changes.append({
                    'customer_id': customer_id,
                    'usage_id': usage.id,
                    'billing_month': usage.usage_month,
                    'old_cost': None,
                    'new_cost': final_cost,
                    'difference': final_cost
                })
            
            self._update_cache_keys(customer_id, usage.usage_month, final_cost, calculation_details)
        
        db_session.commit()
        return changes if changes else None
    
    def _is_discount_applicable(self, discount, usage, plan):
        conditions = json.loads(discount.conditions) if discount.conditions else {}
        
        if conditions.get('plan_ids') and plan.id not in conditions['plan_ids']:
            return False
        
        if conditions.get('min_usage'):
            usage_data = json.loads(usage.usage_data) if usage.usage_data else {}
            total_usage = usage_data.get('total', 0)
            if total_usage < conditions['min_usage']:
                return False
        
        if discount.valid_from and datetime.utcnow() < discount.valid_from:
            return False
        
        if discount.valid_until and datetime.utcnow() > discount.valid_until:
            return False
        
        return True
    
    def _update_cache_keys(self, customer_id, billing_month, final_cost, details):
        cache_key = CacheKey.query.filter_by(
            key=f"billing:{customer_id}:{billing_month}",
            key_type='customer_billing'
        ).first()
        
        cache_data = {
            'customer_id': customer_id,
            'billing_month': billing_month,
            'final_cost': final_cost,
            'details': details,
            'calculated_at': datetime.utcnow().isoformat()
        }
        
        if cache_key:
            cache_key.data = json.dumps(cache_data)
            cache_key.is_valid = True
            cache_key.updated_at = datetime.utcnow()
        else:
            cache_key = CacheKey(
                key=f"billing:{customer_id}:{billing_month}",
                key_type='customer_billing',
                entity_id=customer_id,
                data=json.dumps(cache_data),
                is_valid=True
            )
            db_session.add(cache_key)
        
        db_session.commit()
