from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
import csv
import io
import os
import json
from pathlib import Path

from app.models import (
    ConstructionPlan, ConflictCheck, ConflictType,
    ApprovalRecord, AuditLog, ApprovalStatus,
    WorkTrain, PowerWindow, PersonnelQualification,
    TrackSection, ImportRecord
)
from app.config import settings


class RiskQueryService:
    """风险查询服务"""
    
    @staticmethod
    def get_conflicts_by_risk(
        db: Session,
        risk_level: str = None,
        conflict_type: str = None,
        is_resolved: bool = False,
        start_date: datetime = None,
        end_date: datetime = None,
        offset: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """按风险等级查询冲突记录"""
        query = db.query(ConflictCheck)
        
        if not is_resolved:
            query = query.filter(ConflictCheck.is_resolved == False)
        
        if risk_level:
            query = query.filter(ConflictCheck.risk_level == risk_level)
        
        if conflict_type:
            try:
                type_enum = ConflictType(conflict_type)
                query = query.filter(ConflictCheck.conflict_type == type_enum)
            except ValueError:
                valid_types = [t.value for t in ConflictType]
                raise ValueError(f"无效的冲突类型: {conflict_type}，有效类型: {valid_types}")
        
        if start_date:
            query = query.filter(ConflictCheck.check_time >= start_date)
        
        if end_date:
            query = query.filter(ConflictCheck.check_time <= end_date)
        
        total = query.count()
        
        conflicts = query.order_by(
            db.case(
                (ConflictCheck.risk_level == "严重", 1),
                (ConflictCheck.risk_level == "高风险", 2),
                (ConflictCheck.risk_level == "中风险", 3),
                (ConflictCheck.risk_level == "低风险", 4),
                else_=5
            ),
            ConflictCheck.check_time.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "conflicts": [
                {
                    "id": c.id,
                    "plan_id": c.plan_id,
                    "conflict_type": c.conflict_type.value,
                    "description": c.description,
                    "risk_level": c.risk_level,
                    "is_resolved": c.is_resolved,
                    "resolved_by": c.resolved_by,
                    "resolution_notes": c.resolution_notes,
                    "check_time": c.check_time.isoformat() if c.check_time else None,
                    "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None
                }
                for c in conflicts
            ]
        }
    
    @staticmethod
    def get_risk_statistics(
        db: Session,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Dict[str, Any]:
        """获取风险统计信息"""
        query = db.query(ConflictCheck)
        
        if start_date:
            query = query.filter(ConflictCheck.check_time >= start_date)
        
        if end_date:
            query = query.filter(ConflictCheck.check_time <= end_date)
        
        total = query.count()
        unresolved = query.filter(ConflictCheck.is_resolved == False).count()
        resolved = total - unresolved
        
        by_risk = db.query(
            ConflictCheck.risk_level,
            func.count(ConflictCheck.id).label('count')
        ).filter(
            ConflictCheck.is_resolved == False
        ).group_by(ConflictCheck.risk_level).all()
        
        risk_summary = {
            "严重": 0,
            "高风险": 0,
            "中风险": 0,
            "低风险": 0
        }
        for risk_level, count in by_risk:
            if risk_level in risk_summary:
                risk_summary[risk_level] = count
        
        by_type = db.query(
            ConflictCheck.conflict_type,
            func.count(ConflictCheck.id).label('count')
        ).filter(
            ConflictCheck.is_resolved == False
        ).group_by(ConflictCheck.conflict_type).all()
        
        type_summary = {}
        for conflict_type, count in by_type:
            type_summary[conflict_type.value] = count
        
        high_risk_plans = db.query(
            ConstructionPlan.id,
            ConstructionPlan.plan_no,
            ConstructionPlan.plan_name,
            ConstructionPlan.line,
            ConstructionPlan.status,
            func.count(ConflictCheck.id).label('conflict_count')
        ).join(
            ConflictCheck, ConflictCheck.plan_id == ConstructionPlan.id
        ).filter(
            ConflictCheck.is_resolved == False,
            ConflictCheck.risk_level.in_(["严重", "高风险"])
        ).group_by(ConstructionPlan.id).order_by(
            desc('conflict_count')
        ).limit(10).all()
        
        return {
            "total_conflicts": total,
            "unresolved": unresolved,
            "resolved": resolved,
            "risk_summary": risk_summary,
            "type_summary": type_summary,
            "high_risk_plans": [
                {
                    "id": p.id,
                    "plan_no": p.plan_no,
                    "plan_name": p.plan_name,
                    "line": p.line,
                    "status": p.status.value,
                    "high_risk_conflict_count": p.conflict_count
                }
                for p in high_risk_plans
            ]
        }
    
    @staticmethod
    def get_audit_logs(
        db: Session,
        operation_type: str = None,
        operator: str = None,
        target_type: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        offset: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """查询审计日志"""
        query = db.query(AuditLog)
        
        if operation_type:
            query = query.filter(AuditLog.operation_type == operation_type)
        
        if operator:
            query = query.filter(AuditLog.operator.like(f"%{operator}%"))
        
        if target_type:
            query = query.filter(AuditLog.target_type == target_type)
        
        if start_date:
            query = query.filter(AuditLog.operation_time >= start_date)
        
        if end_date:
            query = query.filter(AuditLog.operation_time <= end_date)
        
        total = query.count()
        
        logs = query.order_by(
            AuditLog.operation_time.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "logs": [
                {
                    "id": l.id,
                    "operation_type": l.operation_type,
                    "operator": l.operator,
                    "target_type": l.target_type,
                    "target_id": l.target_id,
                    "details": json.loads(l.details) if l.details else None,
                    "ip_address": l.ip_address,
                    "operation_time": l.operation_time.isoformat() if l.operation_time else None
                }
                for l in logs
            ]
        }
    
    @staticmethod
    def search_plans(
        db: Session,
        keyword: str = None,
        line: str = None,
        status: str = None,
        start_date: datetime = None,
        end_date: datetime = None,
        has_conflicts: bool = None,
        offset: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        """综合搜索施工计划"""
        query = db.query(ConstructionPlan)
        
        if keyword:
            query = query.filter(
                or_(
                    ConstructionPlan.plan_no.like(f"%{keyword}%"),
                    ConstructionPlan.plan_name.like(f"%{keyword}%"),
                    ConstructionPlan.track_section.like(f"%{keyword}%"),
                    ConstructionPlan.responsible_person.like(f"%{keyword}%")
                )
            )
        
        if line:
            query = query.filter(ConstructionPlan.line == line)
        
        if status:
            try:
                status_enum = ApprovalStatus(status)
                query = query.filter(ConstructionPlan.status == status_enum)
            except ValueError:
                pass
        
        if start_date:
            query = query.filter(ConstructionPlan.start_time >= start_date)
        
        if end_date:
            query = query.filter(ConstructionPlan.start_time <= end_date)
        
        if has_conflicts is not None:
            if has_conflicts:
                query = query.join(
                    ConflictCheck, 
                    and_(
                        ConflictCheck.plan_id == ConstructionPlan.id,
                        ConflictCheck.is_resolved == False
                    )
                )
            else:
                subquery = db.query(ConflictCheck.plan_id).filter(
                    ConflictCheck.is_resolved == False
                ).distinct()
                query = query.filter(ConstructionPlan.id.notin_(subquery))
        
        total = query.count()
        
        plans = query.order_by(
            ConstructionPlan.start_time.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            "total": total,
            "offset": offset,
            "limit": limit,
            "plans": [
                {
                    "id": p.id,
                    "plan_no": p.plan_no,
                    "plan_name": p.plan_name,
                    "line": p.line,
                    "track_section": p.track_section,
                    "start_time": p.start_time.isoformat() if p.start_time else None,
                    "end_time": p.end_time.isoformat() if p.end_time else None,
                    "status": p.status.value,
                    "work_type": p.work_type,
                    "responsible_person": p.responsible_person
                }
                for p in plans
            ]
        }


class AuditExportService:
    """审计导出服务"""
    
    @staticmethod
    def _generate_filename(prefix: str, ext: str) -> str:
        """生成导出文件名"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{timestamp}.{ext}"
    
    @staticmethod
    def export_conflicts_to_csv(
        db: Session,
        risk_level: str = None,
        conflict_type: str = None,
        is_resolved: bool = False,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Tuple[str, str]:
        """导出冲突记录为 CSV
        
        Returns:
            (文件路径, 文件名)
        """
        result = RiskQueryService.get_conflicts_by_risk(
            db, risk_level, conflict_type, is_resolved,
            start_date, end_date, offset=0, limit=10000
        )
        
        filename = AuditExportService._generate_filename("conflicts", "csv")
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ID', '计划ID', '冲突类型', '风险等级', '描述',
                '是否已解决', '解决人', '解决说明',
                '检查时间', '解决时间'
            ])
            
            for c in result['conflicts']:
                writer.writerow([
                    c['id'],
                    c['plan_id'],
                    c['conflict_type'],
                    c['risk_level'],
                    c['description'],
                    '是' if c['is_resolved'] else '否',
                    c['resolved_by'] or '',
                    c['resolution_notes'] or '',
                    c['check_time'] or '',
                    c['resolved_at'] or ''
                ])
        
        return filepath, filename
    
    @staticmethod
    def export_audit_logs_to_csv(
        db: Session,
        operation_type: str = None,
        operator: str = None,
        target_type: str = None,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> Tuple[str, str]:
        """导出审计日志为 CSV"""
        result = RiskQueryService.get_audit_logs(
            db, operation_type, operator, target_type,
            start_date, end_date, offset=0, limit=10000
        )
        
        filename = AuditExportService._generate_filename("audit_logs", "csv")
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                'ID', '操作类型', '操作人', '目标类型', '目标ID',
                '详细信息', 'IP地址', '操作时间'
            ])
            
            for log in result['logs']:
                details = json.dumps(log['details'], ensure_ascii=False) if log['details'] else ''
                writer.writerow([
                    log['id'],
                    log['operation_type'],
                    log['operator'] or '',
                    log['target_type'] or '',
                    log['target_id'] or '',
                    details,
                    log['ip_address'] or '',
                    log['operation_time'] or ''
                ])
        
        return filepath, filename
    
    @staticmethod
    def export_daily_audit_report(
        db: Session,
        report_date: datetime = None,
        export_format: str = "markdown"
    ) -> Tuple[str, str]:
        """导出每日审计报告
        
        Args:
            db: 数据库会话
            report_date: 报告日期，默认为今天
            export_format: 导出格式，支持 'markdown' 或 'csv'
            
        Returns:
            (文件路径, 文件名)
        """
        if report_date is None:
            report_date = datetime.now()
        
        start_of_day = report_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = start_of_day + timedelta(days=1)
        
        stats = RiskQueryService.get_risk_statistics(db, start_of_day, end_of_day)
        
        plans_query = db.query(
            ConstructionPlan.status,
            func.count(ConstructionPlan.id).label('count')
        ).filter(
            ConstructionPlan.start_time >= start_of_day,
            ConstructionPlan.start_time < end_of_day
        ).group_by(ConstructionPlan.status).all()
        
        plans_by_status = {}
        for status, count in plans_query:
            plans_by_status[status.value] = count
        
        approval_records = db.query(ApprovalRecord).filter(
            ApprovalRecord.approval_time >= start_of_day,
            ApprovalRecord.approval_time < end_of_day
        ).order_by(ApprovalRecord.approval_time.asc()).all()
        
        audit_logs = db.query(AuditLog).filter(
            AuditLog.operation_time >= start_of_day,
            AuditLog.operation_time < end_of_day
        ).order_by(AuditLog.operation_time.asc()).all()
        
        if export_format == "csv":
            return AuditExportService._export_daily_report_csv(
                report_date, stats, plans_by_status, approval_records, audit_logs
            )
        else:
            return AuditExportService._export_daily_report_markdown(
                report_date, stats, plans_by_status, approval_records, audit_logs
            )
    
    @staticmethod
    def _export_daily_report_markdown(
        report_date: datetime,
        stats: Dict,
        plans_by_status: Dict,
        approval_records: List,
        audit_logs: List
    ) -> Tuple[str, str]:
        """导出 Markdown 格式的每日报告"""
        filename = AuditExportService._generate_filename("daily_report", "md")
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        date_str = report_date.strftime("%Y年%m月%d日")
        
        markdown = f"""# 封锁点冲突审签台 - 每日审计报告

**报告日期**: {date_str}  
**生成时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

---

## 一、风险统计概览

| 指标 | 数量 |
|------|------|
| 总冲突数 | {stats['total_conflicts']} |
| 未解决 | {stats['unresolved']} |
| 已解决 | {stats['resolved']} |

### 1.1 按风险等级分布

| 风险等级 | 数量 |
|----------|------|
| 🔴 严重 | {stats['risk_summary']['严重']} |
| 🟠 高风险 | {stats['risk_summary']['高风险']} |
| 🟡 中风险 | {stats['risk_summary']['中风险']} |
| 🟢 低风险 | {stats['risk_summary']['低风险']} |

### 1.2 按冲突类型分布

| 冲突类型 | 数量 |
|----------|------|
"""
        
        for conflict_type, count in stats['type_summary'].items():
            markdown += f"| {conflict_type} | {count} |\n"
        
        markdown += """
---

## 二、施工计划状态

| 状态 | 数量 |
|------|------|
"""
        
        for status, count in plans_by_status.items():
            markdown += f"| {status} | {count} |\n"
        
        if stats['high_risk_plans']:
            markdown += """
---

## 三、高风险计划预警

以下计划存在未解决的严重/高风险冲突：

| 计划编号 | 计划名称 | 线路 | 状态 | 高风险冲突数 |
|----------|----------|------|------|--------------|
"""
            
            for plan in stats['high_risk_plans']:
                markdown += f"| {plan['plan_no']} | {plan['plan_name']} | {plan['line']} | {plan['status']} | {plan['high_risk_conflict_count']} |\n"
        
        if approval_records:
            markdown += f"""
---

## 四、今日审签记录

共 {len(approval_records)} 条审签操作：

| 序号 | 计划ID | 操作人 | 操作类型 | 原状态 | 新状态 | 操作时间 | 备注 |
|------|--------|--------|----------|--------|--------|----------|------|
"""
            
            for idx, record in enumerate(approval_records, 1):
                prev_status = record.previous_status.value if record.previous_status else '-'
                new_status = record.new_status.value if record.new_status else '-'
                approval_time = record.approval_time.strftime("%H:%M:%S") if record.approval_time else '-'
                comments = (record.comments or '')[:50]
                if len(record.comments or '') > 50:
                    comments += '...'
                markdown += f"| {idx} | {record.plan_id} | {record.approver} | {record.action} | {prev_status} | {new_status} | {approval_time} | {comments} |\n"
        
        if audit_logs:
            markdown += f"""
---

## 五、今日操作日志

共 {len(audit_logs)} 条操作记录：

| 序号 | 操作类型 | 操作人 | 目标类型 | 操作时间 |
|------|----------|--------|----------|----------|
"""
            
            for idx, log in enumerate(audit_logs, 1):
                op_time = log.operation_time.strftime("%H:%M:%S") if log.operation_time else '-'
                markdown += f"| {idx} | {log.operation_type} | {log.operator or '-'} | {log.target_type or '-'} | {op_time} |\n"
        
        markdown += """
---

## 六、注意事项

1. 🔴 **严重风险** 计划必须立即处理，禁止审签
2. 🟠 **高风险** 计划需要调度员确认是否可接受
3. 所有计划在提交审核前必须通过冲突检查
4. 已审签计划如发现新冲突，建议执行撤销操作

---

*本报告由封锁点冲突审签台自动生成*
"""
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        return filepath, filename
    
    @staticmethod
    def _export_daily_report_csv(
        report_date: datetime,
        stats: Dict,
        plans_by_status: Dict,
        approval_records: List,
        audit_logs: List
    ) -> Tuple[str, str]:
        """导出 CSV 格式的每日报告（多工作表模拟为多文件打包，这里简化为单文件汇总）"""
        filename = AuditExportService._generate_filename("daily_report", "csv")
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            writer.writerow(['封锁点冲突审签台 - 每日审计报告'])
            writer.writerow(['报告日期', report_date.strftime("%Y-%m-%d")])
            writer.writerow(['生成时间', datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow([])
            
            writer.writerow(['=== 风险统计概览 ==='])
            writer.writerow(['指标', '数量'])
            writer.writerow(['总冲突数', stats['total_conflicts']])
            writer.writerow(['未解决', stats['unresolved']])
            writer.writerow(['已解决', stats['resolved']])
            writer.writerow([])
            
            writer.writerow(['=== 风险等级分布 ==='])
            writer.writerow(['风险等级', '数量'])
            for level, count in stats['risk_summary'].items():
                writer.writerow([level, count])
            writer.writerow([])
            
            writer.writerow(['=== 冲突类型分布 ==='])
            writer.writerow(['冲突类型', '数量'])
            for conflict_type, count in stats['type_summary'].items():
                writer.writerow([conflict_type, count])
            writer.writerow([])
            
            writer.writerow(['=== 计划状态分布 ==='])
            writer.writerow(['状态', '数量'])
            for status, count in plans_by_status.items():
                writer.writerow([status, count])
            writer.writerow([])
            
            if approval_records:
                writer.writerow(['=== 今日审签记录 ==='])
                writer.writerow(['序号', '计划ID', '操作人', '操作类型', '原状态', '新状态', '操作时间', '备注'])
                for idx, record in enumerate(approval_records, 1):
                    prev_status = record.previous_status.value if record.previous_status else ''
                    new_status = record.new_status.value if record.new_status else ''
                    approval_time = record.approval_time.isoformat() if record.approval_time else ''
                    writer.writerow([
                        idx, record.plan_id, record.approver, record.action,
                        prev_status, new_status, approval_time, record.comments or ''
                    ])
                writer.writerow([])
            
            if audit_logs:
                writer.writerow(['=== 今日操作日志 ==='])
                writer.writerow(['序号', '操作类型', '操作人', '目标类型', '目标ID', '操作时间'])
                for idx, log in enumerate(audit_logs, 1):
                    op_time = log.operation_time.isoformat() if log.operation_time else ''
                    writer.writerow([
                        idx, log.operation_type, log.operator or '',
                        log.target_type or '', log.target_id or '', op_time
                    ])
        
        return filepath, filename
    
    @staticmethod
    def export_plan_detail(
        db: Session,
        plan_id: int,
        export_format: str = "markdown"
    ) -> Tuple[str, str]:
        """导出单个计划的详细报告"""
        from app.services.approval_service import ApprovalService
        from app.services.conflict_checker import ConflictCheckService
        
        plan = db.query(ConstructionPlan).filter(
            ConstructionPlan.id == plan_id
        ).first()
        
        if not plan:
            raise ValueError(f"计划不存在: {plan_id}")
        
        approval_history = ApprovalService.get_approval_history(db, plan_id)
        conflicts = ConflictCheckService.get_conflicts_by_plan(db, plan_id, include_resolved=True)
        
        filename = AuditExportService._generate_filename(f"plan_{plan.plan_no}", export_format)
        filepath = os.path.join(settings.EXPORT_DIR, filename)
        
        if export_format == "csv":
            return AuditExportService._export_plan_detail_csv(plan, approval_history, conflicts, filepath, filename)
        else:
            return AuditExportService._export_plan_detail_markdown(plan, approval_history, conflicts, filepath, filename)
    
    @staticmethod
    def _export_plan_detail_markdown(
        plan: ConstructionPlan,
        approval_history: List,
        conflicts: List,
        filepath: str,
        filename: str
    ) -> Tuple[str, str]:
        """导出 Markdown 格式的计划详情"""
        markdown = f"""# 施工计划详情报告

## 一、基本信息

| 字段 | 值 |
|------|-----|
| 计划编号 | {plan.plan_no} |
| 计划名称 | {plan.plan_name} |
| 线路 | {plan.line} |
| 轨行区段 | {plan.track_section} |
| 作业类型 | {plan.work_type or '-'} |
| 作业内容 | {plan.work_content or '-'} |
| 施工单位 | {plan.construction_unit or '-'} |
| 负责人 | {plan.responsible_person or '-'} |
| 联系电话 | {plan.contact_phone or '-'} |

## 二、时间与资源

| 字段 | 值 |
|------|-----|
| 开始时间 | {plan.start_time.strftime('%Y-%m-%d %H:%M:%S') if plan.start_time else '-'} |
| 结束时间 | {plan.end_time.strftime('%Y-%m-%d %H:%M:%S') if plan.end_time else '-'} |
| 停电要求 | {plan.power_requirement or '无'} |
| 是否需要作业车 | {'是' if plan.work_train_required else '否'} |
| 当前状态 | {plan.status.value} |

## 三、冲突记录

共 {len(conflicts)} 条冲突记录：

"""
        
        if conflicts:
            markdown += "| 序号 | 冲突类型 | 风险等级 | 状态 | 描述 |\n"
            markdown += "|------|----------|----------|------|------|\n"
            
            for idx, c in enumerate(conflicts, 1):
                status = "已解决" if c.is_resolved else "未解决"
                markdown += f"| {idx} | {c.conflict_type.value} | {c.risk_level} | {status} | {c.description} |\n"
        else:
            markdown += "> 暂无冲突记录\n"
        
        if approval_history:
            markdown += f"""
## 四、审签历史

共 {len(approval_history)} 条审签记录：

| 序号 | 操作人 | 操作类型 | 原状态 | 新状态 | 操作时间 | 备注 |
|------|--------|----------|--------|--------|----------|------|
"""
            
            for idx, record in enumerate(approval_history, 1):
                prev_status = record['previous_status'] or '-'
                new_status = record['new_status'] or '-'
                op_time = record['approval_time'] or '-'
                comments = (record['comments'] or '-')[:80]
                markdown += f"| {idx} | {record['approver']} | {record['action']} | {prev_status} | {new_status} | {op_time} | {comments} |\n"
        
        markdown += f"""
---

*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        return filepath, filename
    
    @staticmethod
    def _export_plan_detail_csv(
        plan: ConstructionPlan,
        approval_history: List,
        conflicts: List,
        filepath: str,
        filename: str
    ) -> Tuple[str, str]:
        """导出 CSV 格式的计划详情"""
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            writer.writerow(['施工计划详情报告'])
            writer.writerow(['生成时间', datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow([])
            
            writer.writerow(['=== 基本信息 ==='])
            writer.writerow(['计划编号', plan.plan_no])
            writer.writerow(['计划名称', plan.plan_name])
            writer.writerow(['线路', plan.line])
            writer.writerow(['轨行区段', plan.track_section])
            writer.writerow(['作业类型', plan.work_type or ''])
            writer.writerow(['作业内容', plan.work_content or ''])
            writer.writerow(['施工单位', plan.construction_unit or ''])
            writer.writerow(['负责人', plan.responsible_person or ''])
            writer.writerow([])
            
            writer.writerow(['=== 时间与资源 ==='])
            writer.writerow(['开始时间', plan.start_time.isoformat() if plan.start_time else ''])
            writer.writerow(['结束时间', plan.end_time.isoformat() if plan.end_time else ''])
            writer.writerow(['停电要求', plan.power_requirement or '无'])
            writer.writerow(['需要作业车', '是' if plan.work_train_required else '否'])
            writer.writerow(['当前状态', plan.status.value])
            writer.writerow([])
            
            if conflicts:
                writer.writerow(['=== 冲突记录 ==='])
                writer.writerow(['序号', '冲突类型', '风险等级', '是否已解决', '描述'])
                for idx, c in enumerate(conflicts, 1):
                    writer.writerow([
                        idx, c.conflict_type.value, c.risk_level,
                        '是' if c.is_resolved else '否', c.description
                    ])
                writer.writerow([])
            
            if approval_history:
                writer.writerow(['=== 审签历史 ==='])
                writer.writerow(['序号', '操作人', '操作类型', '原状态', '新状态', '操作时间', '备注'])
                for idx, record in enumerate(approval_history, 1):
                    writer.writerow([
                        idx, record['approver'], record['action'],
                        record['previous_status'] or '', record['new_status'] or '',
                        record['approval_time'] or '', record['comments'] or ''
                    ])
        
        return filepath, filename
