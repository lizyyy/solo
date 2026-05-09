import json
from datetime import datetime, time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from alert_reducer.models import Alert, SuppressedAlert, FailureLog


class AlertSuppressor:
    """告警抑制器"""
    
    def __init__(self, session: Session, rules: List[Dict[str, Any]] = None,
                 night_hours: Dict[str, str] = None):
        self.session = session
        self.rules = rules or []
        self.night_hours = night_hours or {'start': '22:00', 'end': '06:00'}
    
    def _parse_time(self, time_str: str) -> time:
        """解析时间字符串"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return time(hour=hours, minute=minutes)
        except:
            return time(hour=0, minute=0)
    
    def _is_in_time_range(self, check_time: datetime, start_time_str: str, 
                          end_time_str: str) -> bool:
        """检查时间是否在指定范围内"""
        start = self._parse_time(start_time_str)
        end = self._parse_time(end_time_str)
        current = check_time.time()
        
        if start <= end:
            # 常规情况，如 08:00 - 18:00
            return start <= current <= end
        else:
            # 跨午夜情况，如 22:00 - 06:00
            return current >= start or current <= end
    
    def _is_night_time(self, check_time: datetime) -> bool:
        """检查是否是夜间"""
        return self._is_in_time_range(
            check_time, 
            self.night_hours['start'], 
            self.night_hours['end']
        )
    
    def _get_alert_labels(self, alert: Alert) -> Dict[str, Any]:
        """获取告警标签"""
        try:
            return json.loads(alert.labels_json or '{}')
        except:
            return {}
    
    def _check_rule(self, alert: Alert, rule: Dict[str, Any], 
                     check_time: datetime = None) -> Dict[str, Any]:
        """检查告警是否匹配抑制规则"""
        check_time = check_time or alert.starts_at
        
        result = {
            'matched': False,
            'rule_id': rule.get('id'),
            'rule_name': rule.get('name'),
            'reason': ''
        }
        
        # 检查规则是否启用
        if rule.get('status') != 'active':
            return result
        
        # 检查时间范围
        if 'time_range' in rule:
            time_range = rule['time_range']
            if not self._is_in_time_range(
                check_time, 
                time_range.get('start', '00:00'),
                time_range.get('end', '23:59')
            ):
                return result
        
        # 检查优先级
        if 'severity' in rule:
            allowed_severities = rule['severity']
            if isinstance(allowed_severities, str):
                allowed_severities = [allowed_severities]
            
            if alert.severity not in allowed_severities:
                return result
        
        # 检查标签
        if 'labels' in rule:
            labels = self._get_alert_labels(alert)
            required_labels = rule['labels']
            
            for key, value in required_labels.items():
                if labels.get(key) != value:
                    return result
        
        # 检查是否是夜间规则
        if rule.get('night_only', False) and not self._is_night_time(check_time):
            return result
        
        # 所有条件都匹配
        result['matched'] = True
        result['reason'] = rule.get('description', f'匹配规则: {rule.get("name", rule.get("id"))}')
        
        return result
    
    def suppress_alerts(self, alerts: List[Alert], batch_id: int = None) -> Dict[str, Any]:
        """抑制告警"""
        results = {
            'suppressed_count': 0,
            'suppressed_alerts': [],
            'rules_applied': {}
        }
        
        for alert in alerts:
            # 只处理未处理的告警
            if alert.status != 'pending':
                continue
            
            # 检查所有抑制规则
            for rule in self.rules:
                try:
                    match_result = self._check_rule(alert, rule)
                    
                    if match_result['matched']:
                        # 抑制告警
                        suppressed = SuppressedAlert(
                            alert_id=alert.id,
                            rule_id=match_result['rule_id'],
                            rule_name=match_result['rule_name'],
                            reason=match_result['reason'],
                            batch_id=batch_id
                        )
                        
                        self.session.add(suppressed)
                        
                        # 更新告警状态
                        alert.status = 'suppressed'
                        
                        # 记录结果
                        results['suppressed_count'] += 1
                        results['suppressed_alerts'].append({
                            'alert_id': alert.id,
                            'alertname': alert.alertname,
                            'rule_id': match_result['rule_id'],
                            'rule_name': match_result['rule_name']
                        })
                        
                        # 统计规则应用次数
                        rule_id = match_result['rule_id']
                        if rule_id not in results['rules_applied']:
                            results['rules_applied'][rule_id] = {
                                'name': match_result['rule_name'],
                                'count': 0
                            }
                        results['rules_applied'][rule_id]['count'] += 1
                        
                        # 一个告警只被一个规则抑制
                        break
                        
                except Exception as e:
                    import traceback
                    # 记录失败
                    failure = FailureLog(
                        operation='suppress',
                        error_type=type(e).__name__,
                        error_message=str(e),
                        stack_trace=traceback.format_exc(),
                        context={'rule_id': rule.get('id'), 'alert_id': alert.id},
                        alert_id=alert.id
                    )
                    self.session.add(failure)
        
        self.session.commit()
        return results
    
    def get_suppressed_alerts(self, rule_id: str = None, start_time: datetime = None,
                              end_time: datetime = None) -> List[SuppressedAlert]:
        """获取被抑制的告警"""
        query = self.session.query(SuppressedAlert)
        
        if rule_id:
            query = query.filter(SuppressedAlert.rule_id == rule_id)
        
        if start_time:
            query = query.join(Alert).filter(Alert.starts_at >= start_time)
        
        if end_time:
            query = query.join(Alert).filter(Alert.starts_at <= end_time)
        
        return query.order_by(SuppressedAlert.created_at.desc()).all()
