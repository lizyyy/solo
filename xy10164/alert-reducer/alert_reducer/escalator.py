import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from alert_reducer.models import Alert, MergedAlert, EscalatedAlert, FailureLog


class AlertEscalator:
    """告警升级器"""
    
    def __init__(self, session: Session, strategies: List[Dict[str, Any]] = None,
                 count_threshold: int = 5):
        self.session = session
        self.strategies = strategies or []
        self.count_threshold = count_threshold
    
    def _check_strategy(self, alert: Alert = None, merged: MergedAlert = None,
                        strategy: Dict[str, Any] = None, 
                        current_time: datetime = None) -> Dict[str, Any]:
        """检查告警是否匹配升级策略"""
        current_time = current_time or datetime.utcnow()
        
        result = {
            'matched': False,
            'strategy_id': strategy.get('id'),
            'strategy_name': strategy.get('name'),
            'escalation_level': None,
            'notify_list': []
        }
        
        if not strategy:
            return result
        
        conditions = strategy.get('conditions', {})
        
        # 处理单个告警
        if alert:
            # 检查优先级
            if 'severity' in conditions:
                if alert.severity != conditions['severity']:
                    return result
            
            # 检查持续时间
            if 'duration' in conditions:
                required_duration = conditions['duration']
                actual_duration = (current_time - alert.starts_at).total_seconds()
                
                if actual_duration < required_duration:
                    return result
        
        # 处理合并告警
        if merged:
            # 检查优先级（如果策略指定了优先级条件）
            if 'severity' in conditions:
                if not merged.severity or merged.severity != conditions['severity']:
                    return result
            
            # 检查合并数量
            if 'merged_count_gt' in conditions:
                if merged.alert_count <= conditions['merged_count_gt']:
                    return result
            
            # 检查持续时间
            if 'duration' in conditions:
                required_duration = conditions['duration']
                actual_duration = (current_time - merged.starts_at).total_seconds()
                
                if actual_duration < required_duration:
                    return result
        
        # 所有条件都匹配
        result['matched'] = True
        
        # 获取升级动作
        actions = strategy.get('actions', [])
        for action in actions:
            if action.get('type') == 'escalate':
                result['escalation_level'] = action.get('level')
                result['notify_list'] = action.get('notify', [])
                break
        
        return result
    
    def escalate_alerts(self, alerts: List[Alert] = None, 
                        merged_alerts: List[MergedAlert] = None,
                        batch_id: int = None,
                        current_time: datetime = None) -> Dict[str, Any]:
        """升级告警"""
        current_time = current_time or datetime.utcnow()
        
        results = {
            'escalated_count': 0,
            'escalated_alerts': [],
            'strategies_applied': {}
        }
        
        # 处理单个告警
        if alerts:
            for alert in alerts:
                # 跳过已升级的告警
                if alert.status in ['escalated', 'suppressed']:
                    continue
                
                for strategy in self.strategies:
                    try:
                        # 跳过针对合并告警的策略
                        if 'merged_count_gt' in strategy.get('conditions', {}):
                            continue
                        
                        match_result = self._check_strategy(
                            alert=alert, 
                            strategy=strategy,
                            current_time=current_time
                        )
                        
                        if match_result['matched']:
                            # 创建升级记录
                            escalated = EscalatedAlert(
                                alert_id=alert.id,
                                strategy_id=match_result['strategy_id'],
                                strategy_name=match_result['strategy_name'],
                                escalation_level=match_result['escalation_level'],
                                notify_list=json.dumps(match_result['notify_list'], ensure_ascii=False),
                                batch_id=batch_id
                            )
                            
                            self.session.add(escalated)
                            
                            # 更新告警状态
                            alert.status = 'escalated'
                            
                            # 记录结果
                            results['escalated_count'] += 1
                            results['escalated_alerts'].append({
                                'type': 'single',
                                'alert_id': alert.id,
                                'alertname': alert.alertname,
                                'severity': alert.severity,
                                'strategy_id': match_result['strategy_id'],
                                'strategy_name': match_result['strategy_name'],
                                'level': match_result['escalation_level']
                            })
                            
                            # 统计策略应用次数
                            strategy_id = match_result['strategy_id']
                            if strategy_id not in results['strategies_applied']:
                                results['strategies_applied'][strategy_id] = {
                                    'name': match_result['strategy_name'],
                                    'count': 0
                                }
                            results['strategies_applied'][strategy_id]['count'] += 1
                            
                            break
                            
                    except Exception as e:
                        import traceback
                        failure = FailureLog(
                            operation='escalate',
                            error_type=type(e).__name__,
                            error_message=str(e),
                            stack_trace=traceback.format_exc(),
                            context={'strategy_id': strategy.get('id'), 'alert_id': alert.id},
                            alert_id=alert.id
                        )
                        self.session.add(failure)
        
        # 处理合并告警
        if merged_alerts:
            for merged in merged_alerts:
                # 跳过已升级的合并告警
                if merged.is_escalated:
                    continue
                
                for strategy in self.strategies:
                    try:
                        match_result = self._check_strategy(
                            merged=merged, 
                            strategy=strategy,
                            current_time=current_time
                        )
                        
                        if match_result['matched']:
                            # 创建升级记录
                            escalated = EscalatedAlert(
                                merged_alert_id=merged.id,
                                strategy_id=match_result['strategy_id'],
                                strategy_name=match_result['strategy_name'],
                                escalation_level=match_result['escalation_level'],
                                notify_list=json.dumps(match_result['notify_list'], ensure_ascii=False),
                                batch_id=batch_id
                            )
                            
                            self.session.add(escalated)
                            
                            # 更新合并告警状态
                            merged.is_escalated = True
                            merged.status = 'escalated'
                            
                            # 记录结果
                            results['escalated_count'] += 1
                            results['escalated_alerts'].append({
                                'type': 'merged',
                                'merged_alert_id': merged.id,
                                'alert_count': merged.alert_count,
                                'strategy_id': match_result['strategy_id'],
                                'strategy_name': match_result['strategy_name'],
                                'level': match_result['escalation_level']
                            })
                            
                            # 统计策略应用次数
                            strategy_id = match_result['strategy_id']
                            if strategy_id not in results['strategies_applied']:
                                results['strategies_applied'][strategy_id] = {
                                    'name': match_result['strategy_name'],
                                    'count': 0
                                }
                            results['strategies_applied'][strategy_id]['count'] += 1
                            
                            break
                            
                    except Exception as e:
                        import traceback
                        failure = FailureLog(
                            operation='escalate',
                            error_type=type(e).__name__,
                            error_message=str(e),
                            stack_trace=traceback.format_exc(),
                            context={'strategy_id': strategy.get('id'), 'merged_alert_id': merged.id}
                        )
                        self.session.add(failure)
        
        self.session.commit()
        return results
    
    def get_escalated_alerts(self, level: str = None, start_time: datetime = None,
                             end_time: datetime = None) -> List[EscalatedAlert]:
        """获取升级的告警"""
        query = self.session.query(EscalatedAlert)
        
        if level:
            query = query.filter(EscalatedAlert.escalation_level == level)
        
        if start_time:
            query = query.filter(EscalatedAlert.created_at >= start_time)
        
        if end_time:
            query = query.filter(EscalatedAlert.created_at <= end_time)
        
        return query.order_by(EscalatedAlert.created_at.desc()).all()
