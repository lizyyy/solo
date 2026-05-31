import uuid
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from models import (
    InspectionRecord, ProcessingResult, RecordStatus, AlertLevel,
    AuditTrail, InspectionReport, RecordSource, DuplicateGroup
)
from core_processor import (
    get_alert_level, check_threshold_cross, check_late_arrival,
    check_duplicates, check_sequence_errors, check_fluctuation,
    create_audit_trail
)
from error_messages import (
    generate_user_friendly_message, format_audit_reason, 
    get_level_description, STATUS_DESCRIPTIONS
)
from config import SEQUENCE_CHECK_WINDOW_MINUTES


class InspectionPipeline:
    def __init__(self):
        self.processed_records: Dict[str, ProcessingResult] = {}
        self.previous_values: Dict[str, List[Tuple[datetime, float]]] = defaultdict(list)
        self.alert_confirmations: Dict[str, List[Tuple[datetime, str]]] = defaultdict(list)

    def process_batch(self, records: List[InspectionRecord]) -> List[ProcessingResult]:
        records.sort(key=lambda r: r.collect_time)
        
        duplicate_groups = check_duplicates(records)
        sequence_errors = check_sequence_errors(records, SEQUENCE_CHECK_WINDOW_MINUTES)
        
        sequence_error_record_ids = set()
        for r1, r2, _ in sequence_errors:
            sequence_error_record_ids.add(r1.record_id)
            sequence_error_record_ids.add(r2.record_id)
        
        duplicate_record_ids = set()
        for group in duplicate_groups.values():
            for r in group.records:
                if r.record_id != group.kept_record_id:
                    duplicate_record_ids.add(r.record_id)
        
        results = []
        for record in records:
            result = self.process_single(
                record, 
                duplicate_groups, 
                duplicate_record_ids,
                sequence_error_record_ids,
                sequence_errors
            )
            results.append(result)
            self.processed_records[record.record_id] = result
        
        return results

    def process_single(
        self,
        record: InspectionRecord,
        duplicate_groups: Dict[str, DuplicateGroup],
        duplicate_record_ids: set,
        sequence_error_record_ids: set,
        sequence_errors: List[Tuple[InspectionRecord, InspectionRecord, str]]
    ) -> ProcessingResult:
        audit_trails: List[AuditTrail] = []
        status = RecordStatus.NORMAL
        is_pending = False
        pending_reasons = []
        user_messages = []
        suggestions = []
        
        level, _ = get_alert_level(record.metric_name, record.metric_value)
        original_level = level
        
        history_key = f"{record.device_id}_{record.metric_name}"
        previous_values = [v for _, v in self.previous_values[history_key]]
        previous_value = previous_values[-1] if previous_values else None
        
        is_late, late_reason = check_late_arrival(record)
        if is_late:
            status = RecordStatus.LATE_ARRIVAL
            is_pending = True
            pending_reasons.append(late_reason)
            
            audit_trails.append(create_audit_trail(
                record_id=record.record_id,
                action="标记为晚到数据",
                old_level=None,
                new_level=None,
                reason=late_reason,
                evidence={
                    "collect_time": record.collect_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "receive_time": record.receive_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "delay_hours": round((record.receive_time - record.collect_time).total_seconds() / 3600, 1)
                },
                operator=record.operator
            ))
            
            msg, sugs = generate_user_friendly_message(
                "late_arrival",
                device_name=record.device_name,
                collect_time=record.collect_time.strftime("%Y-%m-%d %H:%M"),
                receive_time=record.receive_time.strftime("%Y-%m-%d %H:%M"),
                delay_hours=round((record.receive_time - record.collect_time).total_seconds() / 3600, 1),
                threshold_hours=24
            )
            user_messages.append(msg)
            suggestions.extend(sugs)
        
        if record.record_id in duplicate_record_ids:
            status = RecordStatus.DUPLICATE
            is_pending = True
            
            group_key = f"{record.device_id}_{record.metric_name}_{record.collect_time.strftime('%Y%m%d%H%M')}"
            group = duplicate_groups.get(group_key)
            first_time = group.records[0].receive_time.strftime("%Y-%m-%d %H:%M") if group else "未知"
            first_operator = group.records[0].operator or "系统"
            
            dup_reason = f"该记录与{group.kept_record_id}重复，已保留最早收到的记录"
            pending_reasons.append(dup_reason)
            
            audit_trails.append(create_audit_trail(
                record_id=record.record_id,
                action="标记为重复记录",
                old_level=level,
                new_level=None,
                reason=dup_reason,
                evidence={
                    "kept_record_id": group.kept_record_id,
                    "total_duplicates": group.duplicate_count,
                    "first_receive_time": first_time
                },
                operator=record.operator
            ))
            
            alert_key = f"{record.device_id}_{record.metric_name}"
            confirm_count = len(self.alert_confirmations[alert_key])
            msg, sugs = generate_user_friendly_message(
                "duplicate_alert",
                device_name=record.device_name,
                metric_name=record.metric_name,
                count=confirm_count if confirm_count > 0 else group.duplicate_count,
                first_time=first_time,
                operator=first_operator
            )
            user_messages.append(msg)
            suggestions.extend(sugs)
        
        if record.record_id in sequence_error_record_ids:
            status = RecordStatus.SEQUENCE_ERROR
            is_pending = True
            
            related_errors = [e for e in sequence_errors 
                             if e[0].record_id == record.record_id or e[1].record_id == record.record_id]
            
            for r1, r2, seq_reason in related_errors:
                pending_reasons.append(seq_reason)
                
                level1, _ = get_alert_level(r1.metric_name, r1.metric_value)
                level2, _ = get_alert_level(r2.metric_name, r2.metric_value)
                
                audit_trails.append(create_audit_trail(
                    record_id=record.record_id,
                    action="标记为时序异常",
                    old_level=level1 if r1.record_id == record.record_id else level2,
                    new_level=level2 if r1.record_id == record.record_id else level1,
                    reason=seq_reason,
                    evidence={
                        "related_record_id": r2.record_id if r1.record_id == record.record_id else r1.record_id,
                        "earlier_time": r1.collect_time.strftime("%H:%M"),
                        "later_time": r2.collect_time.strftime("%H:%M"),
                        "earlier_level": level1.value,
                        "later_level": level2.value
                    },
                    operator=record.operator
                ))
                
                msg, sugs = generate_user_friendly_message(
                    "sequence_error",
                    device_name=record.device_name,
                    earlier_time=r1.collect_time.strftime("%H:%M"),
                    later_time=r2.collect_time.strftime("%H:%M"),
                    higher_level=level1.value,
                    lower_level=level2.value
                )
                user_messages.append(msg)
                suggestions.extend(sugs)
        
        crossed, old_level_cross, new_level_cross, cross_reason = check_threshold_cross(
            record.metric_value, previous_value, record.metric_name
        )
        
        if crossed and record.record_id not in duplicate_record_ids:
            status = RecordStatus.THRESHOLD_CROSS
            is_pending = True
            pending_reasons.append(cross_reason)
            
            level_order = [AlertLevel.NORMAL, AlertLevel.NOTICE, AlertLevel.WARNING, 
                          AlertLevel.ALARM, AlertLevel.CRITICAL]
            cross_count = abs(level_order.index(new_level_cross) - level_order.index(old_level_cross))
            
            audit_trails.append(create_audit_trail(
                record_id=record.record_id,
                action="阈值跨档标记",
                old_level=old_level_cross,
                new_level=new_level_cross,
                reason=cross_reason,
                evidence={
                    "previous_value": previous_value,
                    "current_value": record.metric_value,
                    "metric_name": record.metric_name,
                    "unit": record.unit,
                    "cross_count": cross_count
                },
                operator=record.operator
            ))
            
            msg, sugs = generate_user_friendly_message(
                "threshold_cross",
                device_name=record.device_name,
                metric_name=record.metric_name,
                old_level=old_level_cross.value,
                new_level=new_level_cross.value,
                old_value=previous_value,
                new_value=record.metric_value,
                unit=record.unit,
                cross_count=cross_count
            )
            user_messages.append(msg)
            suggestions.extend(sugs)
        
        processed_inspection_records = [pr.record for pr in self.processed_records.values()]
        is_fluctuation, fluct_reason, recent_values = check_fluctuation(record, processed_inspection_records)
        if is_fluctuation and not is_pending:
            is_pending = True
            pending_reasons.append(fluct_reason)
            
            audit_trails.append(create_audit_trail(
                record_id=record.record_id,
                action="波动异常标记",
                old_level=None,
                new_level=level,
                reason=fluct_reason,
                evidence={
                    "recent_values": recent_values,
                    "current_value": record.metric_value,
                    "average_value": sum(recent_values) / len(recent_values) if recent_values else 0
                },
                operator=record.operator
            ))
            
            avg_val = sum(recent_values) / len(recent_values) if recent_values else 0
            change_pct = abs(record.metric_value - avg_val) / avg_val * 100 if avg_val > 0 else 0
            
            msg, sugs = generate_user_friendly_message(
                "fluctuation",
                device_name=record.device_name,
                metric_name=record.metric_name,
                current_value=record.metric_value,
                avg_value=f"{avg_val:.2f}",
                change_percent=f"{change_pct:.1f}",
                unit=record.unit
            )
            user_messages.append(msg)
            suggestions.extend(sugs)
        
        if record.source == RecordSource.CORRECTED and record.original_record_id:
            is_pending = True
            correct_reason = f"人工更正记录，原记录ID：{record.original_record_id}"
            pending_reasons.append(correct_reason)
            
            original = self.processed_records.get(record.original_record_id)
            old_value = original.record.metric_value if original else "未知"
            
            audit_trails.append(create_audit_trail(
                record_id=record.record_id,
                action="人工更正记录",
                old_level=original.level if original else None,
                new_level=level,
                reason=correct_reason,
                evidence={
                    "original_record_id": record.original_record_id,
                    "old_value": old_value,
                    "new_value": record.metric_value,
                    "remarks": record.remarks
                },
                operator=record.operator
            ))
            
            msg, sugs = generate_user_friendly_message(
                "manual_correction",
                device_name=record.device_name,
                metric_name=record.metric_name,
                operator=record.operator or "未知操作员",
                correct_time=record.receive_time.strftime("%Y-%m-%d %H:%M"),
                old_value=old_value,
                new_value=record.metric_value,
                unit=record.unit,
                remarks=record.remarks or "无备注"
            )
            user_messages.append(msg)
            suggestions.extend(sugs)
        
        if status == RecordStatus.NORMAL and not is_pending:
            audit_trails.append(create_audit_trail(
                record_id=record.record_id,
                action="正常处理",
                old_level=None,
                new_level=level,
                reason=f"数据在正常范围内，{level.value}",
                evidence={
                    "metric_value": record.metric_value,
                    "metric_name": record.metric_name,
                    "level": level.value
                },
                operator=record.operator
            ))
        
        if is_pending and status == RecordStatus.NORMAL:
            status = RecordStatus.PENDING
        
        self.previous_values[history_key].append((record.collect_time, record.metric_value))
        if level in [AlertLevel.ALARM, AlertLevel.CRITICAL]:
            self.alert_confirmations[history_key].append((record.receive_time, record.operator or "系统"))
        
        final_status = status if not is_pending else status
        return ProcessingResult(
            record=record,
            status=final_status,
            level=level,
            audit_trails=audit_trails,
            user_friendly_message="\n\n".join(user_messages) if user_messages else None,
            suggestions=suggestions,
            is_pending_review=is_pending,
            review_reason="\n".join(pending_reasons) if pending_reasons else None
        )

    def generate_report(self, results: List[ProcessingResult]) -> InspectionReport:
        normal_results = [r for r in results if not r.is_pending_review]
        pending_results = [r for r in results if r.is_pending_review]
        
        warning_count = sum(1 for r in results if r.level == AlertLevel.WARNING)
        alarm_count = sum(1 for r in results if r.level == AlertLevel.ALARM)
        critical_count = sum(1 for r in results if r.level == AlertLevel.CRITICAL)
        
        threshold_cross_count = sum(1 for r in results if r.status == RecordStatus.THRESHOLD_CROSS)
        duplicate_count = sum(1 for r in results if r.status == RecordStatus.DUPLICATE)
        late_count = sum(1 for r in results if r.status == RecordStatus.LATE_ARRIVAL)
        seq_error_count = sum(1 for r in results if r.status == RecordStatus.SEQUENCE_ERROR)
        
        summary_parts = []
        if pending_results:
            summary_parts.append(f"有{len(pending_results)}条记录需要人工复核，")
        if threshold_cross_count:
            summary_parts.append(f"{threshold_cross_count}次阈值跨档，")
        if duplicate_count:
            summary_parts.append(f"{duplicate_count}条重复记录，")
        if late_count:
            summary_parts.append(f"{late_count}条晚到数据，")
        if seq_error_count:
            summary_parts.append(f"{seq_error_count}条时序异常。")
        
        if not summary_parts:
            summary = "所有数据正常，无异常情况。"
        else:
            summary = "".join(summary_parts) + "请值班长重点关注待确认项。"
        
        return InspectionReport(
            report_id=str(uuid.uuid4()),
            generate_time=datetime.now(),
            total_records=len(results),
            normal_count=len(normal_results),
            pending_count=len(pending_results),
            warning_count=warning_count,
            alarm_count=alarm_count,
            critical_count=critical_count,
            normal_results=normal_results,
            pending_results=pending_results,
            threshold_cross_count=threshold_cross_count,
            duplicate_count=duplicate_count,
            late_arrival_count=late_count,
            sequence_error_count=seq_error_count,
            summary=summary
        )

    def format_report_for_display(self, report: InspectionReport) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("📋 光伏逆变器波动巡检报告")
        lines.append("=" * 60)
        lines.append(f"报告编号：{report.report_id}")
        lines.append(f"生成时间：{report.generate_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"总记录数：{report.total_records}")
        lines.append("")
        lines.append("📊 统计概览")
        lines.append(f"  ✅ 正常：{report.normal_count} 条")
        lines.append(f"  ⏳ 待确认：{report.pending_count} 条")
        lines.append(f"  ⚠️ 警告：{report.warning_count} 条")
        lines.append(f"  🚨 报警：{report.alarm_count} 条")
        lines.append(f"  💥 严重：{report.critical_count} 条")
        lines.append("")
        lines.append(f"  🔄 重复记录：{report.duplicate_count} 条")
        lines.append(f"  ⏰ 晚到数据：{report.late_arrival_count} 条")
        lines.append(f"  ❓ 时序异常：{report.sequence_error_count} 条")
        lines.append(f"  ⚡ 阈值跨档：{report.threshold_cross_count} 次")
        lines.append("")
        lines.append("📝 巡检总结")
        lines.append(f"  {report.summary}")
        lines.append("")
        lines.append("=" * 60)
        lines.append("⏳ 待确认记录详情（值班长请重点复核）")
        lines.append("=" * 60)
        
        for i, result in enumerate(report.pending_results, 1):
            r = result.record
            lines.append("")
            lines.append(f"【{i}】{r.device_name} - {r.metric_name}")
            lines.append(f"    状态：{STATUS_DESCRIPTIONS.get(result.status, result.status.value)}")
            lines.append(f"    级别：{get_level_description(result.level, r.metric_value, r.unit)}")
            lines.append(f"    采集时间：{r.collect_time.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"    来源：{r.source.value}")
            if r.operator:
                lines.append(f"    操作员：{r.operator}")
            if result.user_friendly_message:
                lines.append(f"    提示：{result.user_friendly_message}")
            if result.suggestions:
                lines.append(f"    建议：")
                for sug in result.suggestions:
                    lines.append(f"      - {sug}")
            if result.audit_trails:
                lines.append(f"    复核依据：")
                for trail in result.audit_trails:
                    lines.append(f"      {trail.timestamp.strftime('%H:%M:%S')} - {trail.action}")
                    lines.append(f"        {format_audit_reason(trail.reason, trail.evidence)}")
        
        if not report.pending_results:
            lines.append("  暂无待确认记录，全部正常 ✅")
        
        lines.append("")
        lines.append("=" * 60)
        lines.append("✅ 正常记录（值班长可快速浏览）")
        lines.append("=" * 60)
        
        for i, result in enumerate(report.normal_results, 1):
            r = result.record
            lines.append(
                f"【{i}】{r.device_name} | {r.metric_name}: "
                f"{get_level_description(result.level, r.metric_value, r.unit)} | "
                f"{r.collect_time.strftime('%H:%M')}"
            )
        
        return "\n".join(lines)
