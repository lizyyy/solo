import uuid
import traceback
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from alert_reducer.models import (
    Alert, MergedAlert, ProcessBatch, FailureLog, 
    SuppressedAlert, EscalatedAlert
)
from alert_reducer.importer import AlertImporter
from alert_reducer.merger import AlertMerger
from alert_reducer.suppressor import AlertSuppressor
from alert_reducer.escalator import AlertEscalator


class AlertProcessor:
    """告警处理协调器"""
    
    def __init__(self, session: Session, config_manager):
        self.session = session
        self.config = config_manager
        
        # 初始化各个组件
        self.importer = AlertImporter(session)
        self.merger = AlertMerger(
            session,
            merge_window_minutes=config_manager.merge_window_minutes,
            merge_by_fields=config_manager.merge_by_fields
        )
        self.suppressor = AlertSuppressor(
            session,
            rules=config_manager.active_suppression_rules,
            night_hours=config_manager.night_hours
        )
        self.escalator = AlertEscalator(
            session,
            strategies=config_manager.escalation_strategies,
            count_threshold=config_manager.merge_count_threshold
        )
    
    def _create_batch(self) -> ProcessBatch:
        """创建处理批次"""
        batch = ProcessBatch(
            batch_uuid=str(uuid.uuid4()),
            start_time=datetime.utcnow(),
            status='running'
        )
        self.session.add(batch)
        self.session.flush()
        return batch
    
    def _complete_batch(self, batch: ProcessBatch, stats: Dict[str, Any], 
                        error: str = None):
        """完成处理批次"""
        batch.end_time = datetime.utcnow()
        batch.status = 'failed' if error else 'completed'
        batch.total_alerts = stats.get('total', 0)
        batch.merged_alerts = stats.get('merged', 0)
        batch.suppressed_alerts = stats.get('suppressed', 0)
        batch.escalated_alerts = stats.get('escalated', 0)
        batch.error_message = error
        self.session.commit()
    
    def _log_failure(self, operation: str, error: Exception, 
                     context: Dict = None, batch_id: int = None):
        """记录失败日志"""
        try:
            failure = FailureLog(
                operation=operation,
                error_type=type(error).__name__,
                error_message=str(error),
                stack_trace=traceback.format_exc(),
                context_json=str(context) if context else None,
                batch_id=batch_id
            )
            self.session.add(failure)
            self.session.commit()
        except Exception as e:
            print(f"记录失败日志失败: {e}")
    
    def _get_alerts_in_range(self, start_time: datetime = None, 
                              end_time: datetime = None,
                              status: str = None) -> List[Alert]:
        """获取指定时间范围的告警"""
        query = self.session.query(Alert)
        
        if start_time:
            query = query.filter(Alert.starts_at >= start_time)
        
        if end_time:
            query = query.filter(Alert.starts_at <= end_time)
        
        if status:
            query = query.filter(Alert.status == status)
        
        return query.all()
    
    def process(self, start_time: datetime = None, end_time: datetime = None,
                window_minutes: int = None) -> Dict[str, Any]:
        """处理告警"""
        # 创建处理批次
        batch = self._create_batch()
        
        try:
            # 计算时间范围
            if window_minutes:
                end_time = datetime.utcnow()
                start_time = end_time - timedelta(minutes=window_minutes)
            elif not start_time:
                # 默认处理最近1小时
                end_time = datetime.utcnow()
                start_time = end_time - timedelta(hours=1)
            
            # 获取待处理的告警
            alerts = self._get_alerts_in_range(start_time, end_time, status='pending')
            
            stats = {
                'total': len(alerts),
                'merged': 0,
                'suppressed': 0,
                'escalated': 0
            }
            
            # 步骤1: 抑制告警
            suppress_result = self.suppressor.suppress_alerts(alerts, batch.id)
            stats['suppressed'] = suppress_result['suppressed_count']
            
            # 获取剩余未处理的告警
            remaining_alerts = [a for a in alerts if a.status == 'pending']
            
            # 步骤2: 合并告警
            merge_result = self.merger.merge_alerts(remaining_alerts, batch.id)
            stats['merged'] = merge_result['total_merged_alerts']
            
            # 获取合并后的告警
            merged_alerts = self.merger.get_merged_alerts(
                start_time=start_time,
                end_time=end_time
            )
            active_merged = [m for m in merged_alerts if m.status in ['active']]
            
            # 获取仍然是单个的告警（未被合并也未被抑制）
            single_alerts = [a for a in remaining_alerts if a.status == 'pending']
            
            # 步骤3: 升级告警
            escalate_result = self.escalator.escalate_alerts(
                alerts=single_alerts,
                merged_alerts=active_merged,
                batch_id=batch.id
            )
            stats['escalated'] = escalate_result['escalated_count']
            
            # 完成批次
            self._complete_batch(batch, stats)
            
            return {
                'success': True,
                'batch_id': batch.id,
                'batch_uuid': batch.batch_uuid,
                'time_range': {
                    'start': start_time.isoformat() if start_time else None,
                    'end': end_time.isoformat() if end_time else None
                },
                'stats': stats,
                'details': {
                    'suppression': suppress_result,
                    'merge': merge_result,
                    'escalation': escalate_result
                }
            }
            
        except Exception as e:
            self._log_failure('process', e, batch_id=batch.id)
            self._complete_batch(batch, {'total': 0}, error=str(e))
            return {
                'success': False,
                'error': str(e),
                'batch_id': batch.id
            }
    
    def rerun(self, batch_id: int = None, start_time: datetime = None,
              end_time: datetime = None) -> Dict[str, Any]:
        """重跑处理"""
        try:
            if batch_id:
                # 根据批次ID重跑
                batch = self.session.query(ProcessBatch).filter(
                    ProcessBatch.id == batch_id
                ).first()
                
                if not batch:
                    return {
                        'success': False,
                        'error': f'批次不存在: {batch_id}'
                    }
                
                # 重置相关告警状态
                alerts = self.session.query(Alert).filter(
                    Alert.batch_id == batch_id
                ).all()
                
                for alert in alerts:
                    alert.status = 'pending'
                    alert.merged_alert_id = None
                
                # 删除相关的处理记录
                self.session.query(SuppressedAlert).filter(
                    SuppressedAlert.batch_id == batch_id
                ).delete()
                
                self.session.query(EscalatedAlert).filter(
                    EscalatedAlert.batch_id == batch_id
                ).delete()
                
                self.session.query(MergedAlert).filter(
                    MergedAlert.batch_id == batch_id
                ).delete()
                
                self.session.commit()
                
                # 重新处理
                return self.process(
                    start_time=batch.start_time,
                    end_time=batch.end_time
                )
            elif start_time and end_time:
                # 根据时间范围重跑
                # 先重置该时间范围内的告警
                alerts = self._get_alerts_in_range(start_time, end_time)
                
                for alert in alerts:
                    alert.status = 'pending'
                    alert.merged_alert_id = None
                
                self.session.commit()
                
                # 重新处理
                return self.process(start_time=start_time, end_time=end_time)
            else:
                return {
                    'success': False,
                    'error': '必须提供batch_id或时间范围'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_batch(self, batch_id: int) -> Optional[ProcessBatch]:
        """获取处理批次"""
        return self.session.query(ProcessBatch).filter(
            ProcessBatch.id == batch_id
        ).first()
    
    def get_batches(self, status: str = None, limit: int = 100) -> List[ProcessBatch]:
        """获取处理批次列表"""
        query = self.session.query(ProcessBatch)
        
        if status:
            query = query.filter(ProcessBatch.status == status)
        
        return query.order_by(ProcessBatch.created_at.desc()).limit(limit).all()
