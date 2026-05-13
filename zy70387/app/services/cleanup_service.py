from typing import Dict, List, Optional
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import TaskLog, SamplingRule, LogStatistics, DroppedLog
from app.config import settings


class CleanupService:
    def __init__(self, db: Session):
        self.db = db

    def _get_retention_days_for_log(self, log: TaskLog, rules: List[SamplingRule]) -> int:
        if log.rule_id:
            for rule in rules:
                if rule.id == log.rule_id:
                    return rule.retention_days
        
        return settings.DEFAULT_RETENTION_DAYS

    def _get_expired_logs_query(self, cutoff_date: datetime):
        return (
            self.db.query(TaskLog)
            .filter(TaskLog.timestamp < cutoff_date)
        )

    def cleanup_expired_logs(
        self,
        dry_run: bool = False,
        limit: Optional[int] = None
    ) -> Dict:
        now = datetime.utcnow()
        
        rules = (
            self.db.query(SamplingRule)
            .filter(SamplingRule.is_active == True)
            .all()
        )
        
        min_retention = min(
            [rule.retention_days for rule in rules] if rules else [settings.DEFAULT_RETENTION_DAYS]
        )
        
        cutoff_date = now - timedelta(days=min_retention)
        
        stats = {
            'run_time': now,
            'min_retention_days': min_retention,
            'cutoff_date': cutoff_date,
            'deleted_count': 0,
            'skipped_count': 0,
            'dry_run': dry_run,
            'deleted_by_tenant': {},
            'deleted_by_type': {}
        }
        
        query = self._get_expired_logs_query(cutoff_date)
        total_candidate = query.count()
        
        if limit:
            logs = query.order_by(TaskLog.timestamp.asc()).limit(limit).all()
        else:
            logs = query.order_by(TaskLog.timestamp.asc()).all()
        
        for log in logs:
            retention_days = self._get_retention_days_for_log(log, rules)
            log_cutoff = now - timedelta(days=retention_days)
            
            if log.timestamp >= log_cutoff:
                stats['skipped_count'] += 1
                continue
            
            if not dry_run:
                tenant_key = log.tenant_id or 'unknown'
                type_key = log.task_type or 'unknown'
                
                stats['deleted_by_tenant'][tenant_key] = stats['deleted_by_tenant'].get(tenant_key, 0) + 1
                stats['deleted_by_type'][type_key] = stats['deleted_by_type'].get(type_key, 0) + 1
                
                self.db.delete(log)
                stats['deleted_count'] += 1
            else:
                tenant_key = log.tenant_id or 'unknown'
                type_key = log.task_type or 'unknown'
                
                stats['deleted_by_tenant'][tenant_key] = stats['deleted_by_tenant'].get(tenant_key, 0) + 1
                stats['deleted_by_type'][type_key] = stats['deleted_by_type'].get(type_key, 0) + 1
                stats['deleted_count'] += 1
        
        if not dry_run and stats['deleted_count'] > 0:
            self.db.commit()
        
        stats['total_candidates'] = total_candidate
        return stats

    def cleanup_old_statistics(
        self,
        retention_days: int = 90,
        dry_run: bool = False
    ) -> Dict:
        now = datetime.utcnow()
        cutoff_date = now.date() - timedelta(days=retention_days)
        
        stats = {
            'run_time': now,
            'retention_days': retention_days,
            'cutoff_date': cutoff_date,
            'deleted_count': 0,
            'dry_run': dry_run
        }
        
        query = (
            self.db.query(LogStatistics)
            .filter(LogStatistics.stat_date < cutoff_date)
        )
        
        if dry_run:
            stats['deleted_count'] = query.count()
        else:
            stats['deleted_count'] = query.delete(synchronize_session=False)
            self.db.commit()
        
        return stats

    def cleanup_old_dropped_logs(
        self,
        retention_days: int = 30,
        dry_run: bool = False
    ) -> Dict:
        now = datetime.utcnow()
        cutoff_date = now - timedelta(days=retention_days)
        
        stats = {
            'run_time': now,
            'retention_days': retention_days,
            'cutoff_date': cutoff_date,
            'deleted_count': 0,
            'dry_run': dry_run
        }
        
        query = (
            self.db.query(DroppedLog)
            .filter(DroppedLog.drop_date < cutoff_date)
        )
        
        if dry_run:
            stats['deleted_count'] = query.count()
        else:
            stats['deleted_count'] = query.delete(synchronize_session=False)
            self.db.commit()
        
        return stats

    def get_cleanup_summary(self) -> Dict:
        now = datetime.utcnow()
        
        rules = self.db.query(SamplingRule).filter(SamplingRule.is_active == True).all()
        min_retention = min(
            [rule.retention_days for rule in rules] if rules else [settings.DEFAULT_RETENTION_DAYS]
        )
        cutoff_date = now - timedelta(days=min_retention)
        
        total_logs = self.db.query(TaskLog).count()
        expired_candidates = self._get_expired_logs_query(cutoff_date).count()
        
        per_tenant = (
            self.db.query(
                TaskLog.tenant_id,
                func.count(TaskLog.id).label('count')
            )
            .group_by(TaskLog.tenant_id)
            .all()
        )
        
        per_type = (
            self.db.query(
                TaskLog.task_type,
                func.count(TaskLog.id).label('count')
            )
            .group_by(TaskLog.task_type)
            .all()
        )
        
        return {
            'current_time': now,
            'min_retention_days': min_retention,
            'cutoff_date': cutoff_date,
            'total_logs': total_logs,
            'expired_candidates': expired_candidates,
            'active_rules': [
                {
                    'id': rule.id,
                    'name': rule.name,
                    'retention_days': rule.retention_days
                }
                for rule in rules
            ],
            'logs_by_tenant': {row.tenant_id: row.count for row in per_tenant},
            'logs_by_type': {row.task_type: row.count for row in per_type}
        }

    def run_full_cleanup(
        self,
        dry_run: bool = False,
        limit: Optional[int] = None
    ) -> Dict:
        results = {}
        
        results['task_logs'] = self.cleanup_expired_logs(dry_run=dry_run, limit=limit)
        results['statistics'] = self.cleanup_old_statistics(dry_run=dry_run)
        results['dropped_logs'] = self.cleanup_old_dropped_logs(dry_run=dry_run)
        
        return results
