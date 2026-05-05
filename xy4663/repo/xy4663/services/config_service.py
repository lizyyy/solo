from models import ConfigVersion, Plan, DiscountRule, CustomerUsage, BillingResult, Dependency, CacheKey
from database import db_session
from datetime import datetime
import json
import uuid


class ConfigService:
    
    def publish_new_config(self, changes, author='system', description=''):
        version = f"v{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"
        
        config_version = ConfigVersion(
            version=version,
            changes=json.dumps(changes),
            author=author,
            description=description
        )
        db_session.add(config_version)
        db_session.commit()
        
        affected_entities = self._analyze_changes(changes)
        affected_customers = self._find_affected_customers(affected_entities)
        
        self._create_dependencies(config_version.id, affected_entities)
        
        return {
            'config_version_id': config_version.id,
            'version': version,
            'affected_entities': affected_entities,
            'affected_customers_count': len(affected_customers),
            'affected_customers': affected_customers[:100]
        }
    
    def _analyze_changes(self, changes):
        affected = {
            'plans': [],
            'discount_rules': [],
            'config_settings': []
        }
        
        if 'plans' in changes:
            for plan_change in changes['plans']:
                plan_id = plan_change.get('id')
                if plan_id:
                    affected['plans'].append(plan_id)
        
        if 'discount_rules' in changes:
            for discount_change in changes['discount_rules']:
                discount_id = discount_change.get('id')
                if discount_id:
                    affected['discount_rules'].append(discount_id)
        
        if 'config_settings' in changes:
            affected['config_settings'] = changes['config_settings']
        
        return affected
    
    def _find_affected_customers(self, affected_entities):
        affected_customers = set()
        
        if affected_entities['plans']:
            usages = CustomerUsage.query.filter(
                CustomerUsage.plan_id.in_(affected_entities['plans'])
            ).all()
            for usage in usages:
                affected_customers.add(usage.customer_id)
        
        if affected_entities['discount_rules']:
            billing_results = BillingResult.query.filter(
                BillingResult.discount_rule_id.in_(affected_entities['discount_rules'])
            ).all()
            for result in billing_results:
                affected_customers.add(result.customer_id)
        
        return list(affected_customers)
    
    def _create_dependencies(self, config_version_id, affected_entities):
        for plan_id in affected_entities['plans']:
            dependency = Dependency(
                dependent_type='config_version',
                dependent_id=config_version_id,
                depends_on_type='plan',
                depends_on_id=plan_id
            )
            db_session.add(dependency)
        
        for discount_id in affected_entities['discount_rules']:
            dependency = Dependency(
                dependent_type='config_version',
                dependent_id=config_version_id,
                depends_on_type='discount_rule',
                depends_on_id=discount_id
            )
            db_session.add(dependency)
        
        db_session.commit()
    
    def find_affected_customers(self, config_version_id=None):
        if config_version_id:
            config_version = ConfigVersion.query.get(config_version_id)
            if not config_version:
                return {'error': 'Config version not found'}
            
            changes = json.loads(config_version.changes) if config_version.changes else {}
            affected_entities = self._analyze_changes(changes)
            affected_customers = self._find_affected_customers(affected_entities)
            
            return {
                'config_version_id': config_version_id,
                'version': config_version.version,
                'affected_entities': affected_entities,
                'affected_customers_count': len(affected_customers),
                'affected_customers': affected_customers
            }
        else:
            all_customers = set()
            usages = CustomerUsage.query.all()
            for usage in usages:
                all_customers.add(usage.customer_id)
            return {
                'affected_customers_count': len(all_customers),
                'affected_customers': list(all_customers)
            }
