from models import CacheKey, Dependency, CustomerUsage, BillingResult, Plan, DiscountRule
from database import db_session
from datetime import datetime
import json


class CacheService:
    
    def invalidate_cache(self, cache_keys=None, customer_ids=None):
        invalidated_count = 0
        invalidated_keys = []
        
        if cache_keys:
            for key in cache_keys:
                cache_key = CacheKey.query.filter_by(key=key).first()
                if cache_key and cache_key.is_valid:
                    cache_key.is_valid = False
                    cache_key.updated_at = datetime.utcnow()
                    invalidated_count += 1
                    invalidated_keys.append(key)
        
        if customer_ids:
            for customer_id in customer_ids:
                customer_cache_keys = CacheKey.query.filter(
                    CacheKey.key_type == 'customer_billing',
                    CacheKey.entity_id == customer_id,
                    CacheKey.is_valid == True
                ).all()
                
                for cache_key in customer_cache_keys:
                    cache_key.is_valid = False
                    cache_key.updated_at = datetime.utcnow()
                    invalidated_count += 1
                    invalidated_keys.append(cache_key.key)
                
                usage_cache_keys = CacheKey.query.filter(
                    CacheKey.key_type == 'usage',
                    CacheKey.key.like(f'%customer:{customer_id}%'),
                    CacheKey.is_valid == True
                ).all()
                
                for cache_key in usage_cache_keys:
                    cache_key.is_valid = False
                    cache_key.updated_at = datetime.utcnow()
                    invalidated_count += 1
                    invalidated_keys.append(cache_key.key)
        
        db_session.commit()
        
        return {
            'invalidated_count': invalidated_count,
            'invalidated_keys': invalidated_keys,
            'timestamp': datetime.utcnow().isoformat()
        }
    
    def get_cache_keys_by_entity(self, entity_type, entity_id):
        keys = CacheKey.query.filter_by(
            key_type=entity_type,
            entity_id=entity_id
        ).all()
        return [k.to_dict() for k in keys]
    
    def create_cache_key(self, key, key_type, entity_id=None, data=None, expires_at=None):
        existing = CacheKey.query.filter_by(key=key).first()
        if existing:
            existing.data = json.dumps(data) if data else '{}'
            existing.is_valid = True
            existing.expires_at = expires_at
            existing.updated_at = datetime.utcnow()
            db_session.commit()
            return existing.to_dict()
        
        cache_key = CacheKey(
            key=key,
            key_type=key_type,
            entity_id=entity_id,
            data=json.dumps(data) if data else '{}',
            expires_at=expires_at,
            is_valid=True
        )
        db_session.add(cache_key)
        db_session.commit()
        return cache_key.to_dict()
    
    def invalidate_by_config_changes(self, affected_entities):
        invalidated_count = 0
        invalidated_keys = []
        
        for plan_id in affected_entities.get('plans', []):
            plan_cache_keys = CacheKey.query.filter(
                CacheKey.key_type == 'plan',
                CacheKey.entity_id == plan_id,
                CacheKey.is_valid == True
            ).all()
            
            for cache_key in plan_cache_keys:
                cache_key.is_valid = False
                cache_key.updated_at = datetime.utcnow()
                invalidated_count += 1
                invalidated_keys.append(cache_key.key)
        
        for discount_id in affected_entities.get('discount_rules', []):
            discount_cache_keys = CacheKey.query.filter(
                CacheKey.key_type == 'discount',
                CacheKey.entity_id == discount_id,
                CacheKey.is_valid == True
            ).all()
            
            for cache_key in discount_cache_keys:
                cache_key.is_valid = False
                cache_key.updated_at = datetime.utcnow()
                invalidated_count += 1
                invalidated_keys.append(cache_key.key)
        
        db_session.commit()
        
        return {
            'invalidated_count': invalidated_count,
            'invalidated_keys': invalidated_keys
        }
