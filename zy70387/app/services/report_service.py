from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models import LogStatistics, DroppedLog, TaskLog, SamplingRule
from app.schemas import LogReport, DailyReport, TenantReport, RuleHitDetail


class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_date_range(self, start_date: Optional[date], end_date: Optional[date]):
        if end_date is None:
            end_date = datetime.utcnow().date()
        if start_date is None:
            start_date = end_date - timedelta(days=7)
        return start_date, end_date

    def get_daily_reports(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tenant_id: Optional[str] = None,
        task_type: Optional[str] = None
    ) -> List[DailyReport]:
        start_date, end_date = self._get_date_range(start_date, end_date)
        
        query = (
            self.db.query(
                LogStatistics.stat_date,
                func.sum(LogStatistics.total_logs).label('total_logs'),
                func.sum(LogStatistics.sampled_logs).label('sampled_logs'),
                func.sum(LogStatistics.dropped_logs).label('dropped_logs'),
                func.sum(LogStatistics.duplicate_logs).label('duplicate_logs'),
                func.sum(LogStatistics.failure_logs).label('failure_logs'),
                func.sum(LogStatistics.failure_context_logs).label('failure_context_logs')
            )
            .filter(
                LogStatistics.stat_date >= start_date,
                LogStatistics.stat_date <= end_date
            )
        )
        
        if tenant_id:
            query = query.filter(LogStatistics.tenant_id == tenant_id)
        if task_type:
            query = query.filter(LogStatistics.task_type == task_type)
        
        results = query.group_by(LogStatistics.stat_date).order_by(LogStatistics.stat_date).all()
        
        reports = []
        for row in results:
            total = row.total_logs or 0
            retention_rate = (row.sampled_logs or 0) / total if total > 0 else 0.0
            failure_rate = (row.failure_logs or 0) / total if total > 0 else 0.0
            
            reports.append(DailyReport(
                stat_date=row.stat_date,
                total_logs=total,
                sampled_logs=row.sampled_logs or 0,
                dropped_logs=row.dropped_logs or 0,
                duplicate_logs=row.duplicate_logs or 0,
                failure_logs=row.failure_logs or 0,
                failure_context_logs=row.failure_context_logs or 0,
                retention_rate=round(retention_rate, 4),
                failure_rate=round(failure_rate, 4)
            ))
        
        return reports

    def get_tenant_reports(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> List[TenantReport]:
        start_date, end_date = self._get_date_range(start_date, end_date)
        
        results = (
            self.db.query(
                LogStatistics.tenant_id,
                func.sum(LogStatistics.total_logs).label('total_logs'),
                func.sum(LogStatistics.sampled_logs).label('sampled_logs'),
                func.sum(LogStatistics.dropped_logs).label('dropped_logs'),
                func.sum(LogStatistics.failure_logs).label('failure_logs'),
                LogStatistics.rule_id
            )
            .filter(
                LogStatistics.stat_date >= start_date,
                LogStatistics.stat_date <= end_date
            )
            .group_by(LogStatistics.tenant_id, LogStatistics.rule_id)
            .order_by(func.sum(LogStatistics.total_logs).desc())
            .all()
        )
        
        tenant_map = {}
        for row in results:
            tenant_id = row.tenant_id
            if tenant_id not in tenant_map:
                tenant_map[tenant_id] = {
                    'total_logs': 0,
                    'sampled_logs': 0,
                    'dropped_logs': 0,
                    'failure_logs': 0,
                    'rule_hits': {}
                }
            
            tenant_map[tenant_id]['total_logs'] += row.total_logs or 0
            tenant_map[tenant_id]['sampled_logs'] += row.sampled_logs or 0
            tenant_map[tenant_id]['dropped_logs'] += row.dropped_logs or 0
            tenant_map[tenant_id]['failure_logs'] += row.failure_logs or 0
            
            if row.rule_id:
                if row.rule_id not in tenant_map[tenant_id]['rule_hits']:
                    tenant_map[tenant_id]['rule_hits'][row.rule_id] = 0
                tenant_map[tenant_id]['rule_hits'][row.rule_id] += row.total_logs or 0
        
        reports = []
        rules = {rule.id: rule for rule in self.db.query(SamplingRule).all()}
        
        for tenant_id, data in tenant_map.items():
            total = data['total_logs']
            retention_rate = data['sampled_logs'] / total if total > 0 else 0.0
            
            rule_hits = []
            for rule_id, hit_count in data['rule_hits'].items():
                rule = rules.get(rule_id)
                if rule:
                    explanation = f"规则 '{rule.name}' "
                    if rule.tenant_id:
                        explanation += f"匹配租户 {rule.tenant_id} "
                    if rule.task_type:
                        explanation += f"匹配类型 {rule.task_type} "
                    explanation += f"(采样率 {rule.sample_rate})"
                    
                    rule_hits.append(RuleHitDetail(
                        rule_id=rule.id,
                        rule_name=rule.name,
                        rule_version=rule.version,
                        sample_rate=rule.sample_rate,
                        is_vip_tenant=rule.is_vip_tenant,
                        task_type=rule.task_type,
                        tenant_id=rule.tenant_id,
                        hit_count=hit_count,
                        explanation=explanation
                    ))
            
            reports.append(TenantReport(
                tenant_id=tenant_id,
                total_logs=data['total_logs'],
                sampled_logs=data['sampled_logs'],
                dropped_logs=data['dropped_logs'],
                failure_logs=data['failure_logs'],
                retention_rate=round(retention_rate, 4),
                rule_hits=rule_hits
            ))
        
        return reports

    def get_top_dropped_reasons(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 10
    ) -> List[dict]:
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=7)
        
        results = (
            self.db.query(
                DroppedLog.drop_reason,
                func.sum(DroppedLog.drop_count).label('total_dropped')
            )
            .filter(
                DroppedLog.drop_date >= start_date,
                DroppedLog.drop_date <= end_date
            )
            .group_by(DroppedLog.drop_reason)
            .order_by(func.sum(DroppedLog.drop_count).desc())
            .limit(limit)
            .all()
        )
        
        return [
            {
                'reason': row.drop_reason,
                'count': row.total_dropped,
                'description': self._get_reason_description(row.drop_reason)
            }
            for row in results
        ]

    def _get_reason_description(self, reason: str) -> str:
        descriptions = {
            'not_sampled': '未命中采样（概率性丢弃）',
            'duplicate_log': '重复日志（去重丢弃）',
            'sampled': '采样命中（保留）',
            'failure_always_save': '失败日志全量保留'
        }
        return descriptions.get(reason, reason)

    def get_recent_failures(self, limit: int = 10) -> List[dict]:
        failures = (
            self.db.query(TaskLog)
            .filter(TaskLog.is_failure == True)
            .order_by(TaskLog.timestamp.desc())
            .limit(limit)
            .all()
        )
        
        result = []
        for failure in failures:
            context_logs = (
                self.db.query(TaskLog)
                .filter(TaskLog.context_for_failure_id == failure.id)
                .order_by(TaskLog.timestamp.asc())
                .all()
            )
            
            result.append({
                'failure_id': failure.id,
                'task_id': failure.task_id,
                'tenant_id': failure.tenant_id,
                'task_type': failure.task_type,
                'message': failure.message,
                'timestamp': failure.timestamp,
                'context_count': len(context_logs),
                'context_logs': [
                    {
                        'id': ctx.id,
                        'message': ctx.message,
                        'timestamp': ctx.timestamp,
                        'log_level': ctx.log_level
                    }
                    for ctx in context_logs
                ]
            })
        
        return result

    def generate_report(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tenant_id: Optional[str] = None,
        task_type: Optional[str] = None
    ) -> LogReport:
        start_date, end_date = self._get_date_range(start_date, end_date)
        
        daily_reports = self.get_daily_reports(start_date, end_date, tenant_id, task_type)
        tenant_reports = self.get_tenant_reports(start_date, end_date) if not tenant_id else []
        top_dropped = self.get_top_dropped_reasons(start_date, end_date)
        recent_failures = self.get_recent_failures()
        
        summary = {
            'period_start': start_date,
            'period_end': end_date,
            'total_logs': sum(r.total_logs for r in daily_reports),
            'total_sampled': sum(r.sampled_logs for r in daily_reports),
            'total_dropped': sum(r.dropped_logs for r in daily_reports),
            'total_failures': sum(r.failure_logs for r in daily_reports),
            'total_failure_context': sum(r.failure_context_logs for r in daily_reports)
        }
        
        total = summary['total_logs']
        summary['retention_rate'] = round(summary['total_sampled'] / total, 4) if total > 0 else 0.0
        summary['drop_rate'] = round(summary['total_dropped'] / total, 4) if total > 0 else 0.0
        
        return LogReport(
            generated_at=datetime.utcnow(),
            period_start=start_date,
            period_end=end_date,
            summary=summary,
            daily_reports=daily_reports,
            tenant_reports=tenant_reports,
            top_dropped_reasons=top_dropped,
            rule_hit_details=[],
            recent_failures=recent_failures
        )
