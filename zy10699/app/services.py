from datetime import datetime
from app import db
from app.models import QualityRule, Alert, RuleSilence
import logging

logger = logging.getLogger(__name__)

class SilenceService:
    SIMULATE_RESTORE_FAILURE = False
    
    @classmethod
    def silence_alerts(cls, silence):
        alerts = Alert.query.filter(
            Alert.rule_id == silence.rule_id,
            Alert.status == 'active'
        ).all()
        
        alert_history = []
        for alert in alerts:
            alert_history.append({
                'alert_id': alert.id,
                'alert_type': alert.alert_type,
                'previous_status': alert.status,
                'silenced_at': datetime.utcnow().isoformat()
            })
            alert.status = 'silenced'
            alert.silenced_by = silence.id
        
        silence.alert_history = alert_history
        db.session.flush()
    
    @classmethod
    def restore_alerts(cls, silence, manual=False):
        try:
            if cls.SIMULATE_RESTORE_FAILURE and not manual:
                silence.restore_error = 'Simulated failure for testing'
                db.session.flush()
                return False
            
            merged_alerts = Alert.query.filter(
                Alert.rule_id == silence.rule_id,
                Alert.status == 'merged'
            ).all()
            
            if merged_alerts:
                silence.restore_error = f'Found {len(merged_alerts)} merged alerts. Need to verify merge state before restoring.'
                db.session.flush()
                return False
            
            alerts = Alert.query.filter(
                Alert.rule_id == silence.rule_id,
                Alert.status == 'silenced',
                Alert.silenced_by == silence.id
            ).all()
            
            for alert in alerts:
                alert.status = 'active'
                alert.silenced_by = None
            
            silence.restore_error = None
            db.session.flush()
            return True
            
        except Exception as e:
            silence.restore_error = str(e)
            db.session.flush()
            return False
    
    @classmethod
    def handle_rule_rename(cls, rule_id, old_name, new_name):
        silences = RuleSilence.query.filter_by(rule_id=rule_id).all()
        
        for silence in silences:
            alert_history = silence.alert_history or []
            for item in alert_history:
                if 'rule_name' not in item:
                    item['rule_name'] = old_name
                item['current_rule_name'] = new_name
            silence.alert_history = alert_history
        
        db.session.flush()
        return len(silences)
    
    @classmethod
    def handle_table_migration(cls, table_id, old_db, old_schema, old_table_name, 
                                new_db, new_schema, new_table_name):
        affected_rules = []
        
        rules = QualityRule.query.filter_by(table_id=table_id).all()
        
        for rule in rules:
            silences = RuleSilence.query.filter_by(rule_id=rule.id).all()
            
            for silence in silences:
                alert_history = silence.alert_history or []
                for item in alert_history:
                    item['table_migration'] = {
                        'old': f'{old_db}.{old_schema or ""}.{old_table_name}',
                        'new': f'{new_db}.{new_schema or ""}.{new_table_name}',
                        'migrated_at': datetime.utcnow().isoformat()
                    }
                silence.alert_history = alert_history
            
            affected_rules.append({
                'rule_id': rule.id,
                'rule_code': rule.rule_code,
                'silence_count': len(silences)
            })
        
        db.session.flush()
        return affected_rules
    
    @classmethod
    def handle_alert_merge(cls, source_alert_ids, target_alert_id, merged_by):
        merged_count = 0
        now = datetime.utcnow()
        
        for source_id in source_alert_ids:
            source_alert = Alert.query.get(source_id)
            if source_alert and source_alert.status == 'active':
                silence = None
                if source_alert.silenced_by:
                    silence = RuleSilence.query.get(source_alert.silenced_by)
                
                if silence:
                    alert_history = silence.alert_history or []
                    for item in alert_history:
                        if item.get('alert_id') == source_id:
                            item['merged'] = {
                                'into_alert_id': target_alert_id,
                                'merged_by': merged_by,
                                'merged_at': now.isoformat()
                            }
                    silence.alert_history = alert_history
                
                source_alert.status = 'merged'
                source_alert.merged_into = target_alert_id
                merged_count += 1
        
        db.session.flush()
        return merged_count
