from models import Plan, DiscountRule, CustomerUsage, BillingResult, CacheKey, ConfigVersion
from database import db_session
from datetime import datetime, timedelta
import json


def import_all_sample_data():
    try:
        plans = import_plans()
        discounts = import_discount_rules()
        usages = import_customer_usages()
        billing_results = import_billing_results()
        cache_keys = create_cache_keys()
        
        db_session.commit()
        
        return {
            'success': True,
            'imported': {
                'plans': len(plans),
                'discount_rules': len(discounts),
                'customer_usages': len(usages),
                'billing_results': len(billing_results),
                'cache_keys': len(cache_keys)
            },
            'message': 'Sample data imported successfully'
        }
    except Exception as e:
        db_session.rollback()
        return {
            'success': False,
            'error': str(e),
            'message': 'Failed to import sample data'
        }


def import_plans():
    plans_data = [
        {
            'name': '基础版 (Basic)',
            'description': '适合个人用户和小型团队的基础功能套餐',
            'monthly_cost': 99.0,
            'features': ['10GB 存储', '基础 API 访问', '邮件支持', '5 个用户'],
            'is_active': True
        },
        {
            'name': '专业版 (Pro)',
            'description': '适合成长型企业的专业功能套餐',
            'monthly_cost': 299.0,
            'features': ['100GB 存储', '高级 API 访问', '优先技术支持', '无限用户', '高级分析', '自定义集成'],
            'is_active': True
        },
        {
            'name': '企业版 (Enterprise)',
            'description': '适合大型企业的全套功能和专属服务',
            'monthly_cost': 999.0,
            'features': ['无限存储', '全部 API 访问', '24/7 专属支持', '无限用户', '高级安全功能', 'SLA 保障', '定制开发'],
            'is_active': True
        },
        {
            'name': '免费试用版 (Free Trial)',
            'description': '14 天免费试用，体验所有专业版功能',
            'monthly_cost': 0.0,
            'features': ['5GB 存储', '基础 API 访问', '邮件支持', '3 个用户'],
            'is_active': True
        }
    ]
    
    plans = []
    for plan_data in plans_data:
        existing = Plan.query.filter_by(name=plan_data['name']).first()
        if existing:
            plans.append(existing)
            continue
        
        plan = Plan(
            name=plan_data['name'],
            description=plan_data['description'],
            monthly_cost=plan_data['monthly_cost'],
            features=json.dumps(plan_data['features']),
            is_active=plan_data['is_active']
        )
        db_session.add(plan)
        plans.append(plan)
    
    return plans


def import_discount_rules():
    discounts_data = [
        {
            'name': '新用户首月 50% 折扣',
            'rule_type': 'percentage',
            'conditions': {
                'customer_type': 'new',
                'max_months': 1
            },
            'discount_value': 50.0,
            'is_active': True
        },
        {
            'name': '年付立减 200 元',
            'rule_type': 'fixed',
            'conditions': {
                'billing_cycle': 'annual',
                'min_plan_value': 199.0
            },
            'discount_value': 200.0,
            'is_active': True
        },
        {
            'name': '企业用户专属 15% 折扣',
            'rule_type': 'percentage',
            'conditions': {
                'plan_ids': [3],  # 企业版
                'min_users': 50
            },
            'discount_value': 15.0,
            'is_active': True
        },
        {
            'name': '季度促销 25% 折扣',
            'rule_type': 'percentage',
            'conditions': {
                'promo_period': 'Q1_2024'
            },
            'discount_value': 25.0,
            'is_active': True,
            'valid_from': datetime(2024, 1, 1),
            'valid_until': datetime(2024, 3, 31)
        }
    ]
    
    discounts = []
    for discount_data in discounts_data:
        existing = DiscountRule.query.filter_by(name=discount_data['name']).first()
        if existing:
            discounts.append(existing)
            continue
        
        discount = DiscountRule(
            name=discount_data['name'],
            rule_type=discount_data['rule_type'],
            conditions=json.dumps(discount_data['conditions']),
            discount_value=discount_data['discount_value'],
            is_active=discount_data['is_active'],
            valid_from=discount_data.get('valid_from'),
            valid_until=discount_data.get('valid_until')
        )
        db_session.add(discount)
        discounts.append(discount)
    
    return discounts


def import_customer_usages():
    usages_data = [
        {'customer_id': 1001, 'plan_id': 1, 'usage_month': '2024-01', 'usage_data': {'storage_used': 2.5, 'api_calls': 1200, 'active_users': 3}},
        {'customer_id': 1001, 'plan_id': 1, 'usage_month': '2024-02', 'usage_data': {'storage_used': 3.1, 'api_calls': 1450, 'active_users': 4}},
        {'customer_id': 1001, 'plan_id': 1, 'usage_month': '2024-03', 'usage_data': {'storage_used': 4.2, 'api_calls': 1800, 'active_users': 5}},
        
        {'customer_id': 1002, 'plan_id': 2, 'usage_month': '2024-01', 'usage_data': {'storage_used': 25.6, 'api_calls': 8500, 'active_users': 12}},
        {'customer_id': 1002, 'plan_id': 2, 'usage_month': '2024-02', 'usage_data': {'storage_used': 32.1, 'api_calls': 12300, 'active_users': 15}},
        {'customer_id': 1002, 'plan_id': 2, 'usage_month': '2024-03', 'usage_data': {'storage_used': 45.8, 'api_calls': 15600, 'active_users': 18}},
        
        {'customer_id': 1003, 'plan_id': 3, 'usage_month': '2024-01', 'usage_data': {'storage_used': 156.2, 'api_calls': 45000, 'active_users': 75}},
        {'customer_id': 1003, 'plan_id': 3, 'usage_month': '2024-02', 'usage_data': {'storage_used': 189.5, 'api_calls': 52000, 'active_users': 82}},
        {'customer_id': 1003, 'plan_id': 3, 'usage_month': '2024-03', 'usage_data': {'storage_used': 220.3, 'api_calls': 58000, 'active_users': 95}},
        
        {'customer_id': 1004, 'plan_id': 2, 'usage_month': '2024-01', 'usage_data': {'storage_used': 18.9, 'api_calls': 6200, 'active_users': 8}},
        {'customer_id': 1004, 'plan_id': 2, 'usage_month': '2024-02', 'usage_data': {'storage_used': 22.3, 'api_calls': 7800, 'active_users': 10}},
        
        {'customer_id': 1005, 'plan_id': 1, 'usage_month': '2024-02', 'usage_data': {'storage_used': 1.2, 'api_calls': 450, 'active_users': 2}},
        {'customer_id': 1005, 'plan_id': 1, 'usage_month': '2024-03', 'usage_data': {'storage_used': 1.8, 'api_calls': 680, 'active_users': 2}},
    ]
    
    usages = []
    for usage_data in usages_data:
        existing = CustomerUsage.query.filter_by(
            customer_id=usage_data['customer_id'],
            usage_month=usage_data['usage_month']
        ).first()
        
        if existing:
            usages.append(existing)
            continue
        
        usage = CustomerUsage(
            customer_id=usage_data['customer_id'],
            plan_id=usage_data['plan_id'],
            usage_month=usage_data['usage_month'],
            usage_data=json.dumps(usage_data['usage_data']),
            calculated_at=datetime.utcnow()
        )
        db_session.add(usage)
        usages.append(usage)
    
    return usages


def import_billing_results():
    billing_data = []
    
    usages = CustomerUsage.query.all()
    for usage in usages:
        plan = Plan.query.get(usage.plan_id)
        if not plan:
            continue
        
        base_cost = plan.monthly_cost
        discount_amount = 0.0
        discount_rule_id = None
        
        if usage.customer_id == 1001 and usage.usage_month == '2024-01':
            discount_rule = DiscountRule.query.filter_by(name='新用户首月 50% 折扣').first()
            if discount_rule:
                discount_amount = base_cost * (discount_rule.discount_value / 100)
                discount_rule_id = discount_rule.id
        
        if usage.customer_id == 1003:
            discount_rule = DiscountRule.query.filter_by(name='企业用户专属 15% 折扣').first()
            if discount_rule:
                discount_amount = base_cost * (discount_rule.discount_value / 100)
                discount_rule_id = discount_rule.id
        
        final_cost = max(0, base_cost - discount_amount)
        
        billing_data.append({
            'customer_id': usage.customer_id,
            'usage_id': usage.id,
            'plan_id': usage.plan_id,
            'discount_rule_id': discount_rule_id,
            'billing_month': usage.usage_month,
            'base_cost': base_cost,
            'discount_amount': discount_amount,
            'final_cost': final_cost
        })
    
    results = []
    for data in billing_data:
        existing = BillingResult.query.filter_by(
            customer_id=data['customer_id'],
            billing_month=data['billing_month']
        ).first()
        
        if existing:
            results.append(existing)
            continue
        
        result = BillingResult(
            customer_id=data['customer_id'],
            usage_id=data['usage_id'],
            plan_id=data['plan_id'],
            discount_rule_id=data['discount_rule_id'],
            billing_month=data['billing_month'],
            base_cost=data['base_cost'],
            discount_amount=data['discount_amount'],
            final_cost=data['final_cost'],
            calculation_details=json.dumps({
                'base_cost': data['base_cost'],
                'discount_amount': data['discount_amount'],
                'discount_rule_id': data['discount_rule_id']
            }),
            calculated_at=datetime.utcnow()
        )
        db_session.add(result)
        results.append(result)
    
    return results


def create_cache_keys():
    cache_data = []
    
    plans = Plan.query.all()
    for plan in plans:
        cache_data.append({
            'key': f"plan:{plan.id}",
            'key_type': 'plan',
            'entity_id': plan.id,
            'data': plan.to_dict()
        })
    
    discounts = DiscountRule.query.all()
    for discount in discounts:
        cache_data.append({
            'key': f"discount:{discount.id}",
            'key_type': 'discount',
            'entity_id': discount.id,
            'data': discount.to_dict()
        })
    
    billing_results = BillingResult.query.all()
    for result in billing_results[:5]:
        cache_data.append({
            'key': f"billing:{result.customer_id}:{result.billing_month}",
            'key_type': 'customer_billing',
            'entity_id': result.customer_id,
            'data': result.to_dict()
        })
    
    cache_keys = []
    for data in cache_data:
        existing = CacheKey.query.filter_by(key=data['key']).first()
        if existing:
            cache_keys.append(existing)
            continue
        
        cache_key = CacheKey(
            key=data['key'],
            key_type=data['key_type'],
            entity_id=data['entity_id'],
            data=json.dumps(data['data']),
            is_valid=True
        )
        db_session.add(cache_key)
        cache_keys.append(cache_key)
    
    return cache_keys
