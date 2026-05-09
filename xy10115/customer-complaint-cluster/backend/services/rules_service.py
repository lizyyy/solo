from backend.models.models import db, Rule


class RulesService:
    
    @staticmethod
    def create_rule(data):
        rule = Rule(
            name=data['name'],
            pattern=data['pattern'],
            pattern_type=data.get('pattern_type', 'keyword'),
            cluster_name=data.get('cluster_name'),
            priority=data.get('priority', 0),
            is_active=data.get('is_active', True)
        )
        db.session.add(rule)
        db.session.commit()
        return rule.to_dict()
    
    @staticmethod
    def update_rule(rule_id, data):
        rule = Rule.query.get(rule_id)
        if not rule:
            return None
        
        if 'name' in data:
            rule.name = data['name']
        if 'pattern' in data:
            rule.pattern = data['pattern']
        if 'pattern_type' in data:
            rule.pattern_type = data['pattern_type']
        if 'cluster_name' in data:
            rule.cluster_name = data['cluster_name']
        if 'priority' in data:
            rule.priority = data['priority']
        if 'is_active' in data:
            rule.is_active = data['is_active']
        
        db.session.commit()
        return rule.to_dict()
    
    @staticmethod
    def delete_rule(rule_id):
        rule = Rule.query.get(rule_id)
        if not rule:
            return False
        db.session.delete(rule)
        db.session.commit()
        return True
    
    @staticmethod
    def get_rule(rule_id):
        rule = Rule.query.get(rule_id)
        return rule.to_dict() if rule else None
    
    @staticmethod
    def list_rules(is_active=None):
        query = Rule.query
        if is_active is not None:
            query = query.filter_by(is_active=is_active)
        rules = query.order_by(Rule.priority.desc(), Rule.id.desc()).all()
        return [r.to_dict() for r in rules]
    
    @staticmethod
    def toggle_rule(rule_id):
        rule = Rule.query.get(rule_id)
        if not rule:
            return None
        rule.is_active = not rule.is_active
        db.session.commit()
        return rule.to_dict()
