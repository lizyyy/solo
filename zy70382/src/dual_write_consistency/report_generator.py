from datetime import datetime
from typing import Dict, List, Optional

from .comparison_engine import ComparisonEngine
from .models import (
    CheckReport,
    Difference,
    DifferenceStatus,
    DifferenceType,
    EntityConfig,
    EntityReport,
    TenantFilter,
    TimeRange,
)


class ReportGenerator:
    def __init__(self, comparison_engine: ComparisonEngine):
        self.comparison_engine = comparison_engine
    
    def generate_report(
        self,
        entities: List[EntityConfig],
        tenant_filter: Optional[TenantFilter] = None,
        time_range: Optional[TimeRange] = None,
        max_samples: int = 10,
    ) -> CheckReport:
        entity_reports: List[EntityReport] = []
        all_differences: List[Difference] = []
        affected_tenants: set = set()
        
        summary: Dict[str, int] = {
            "new_missing": 0,
            "old_missing": 0,
            "field_diffs": 0,
            "mapping_diffs": 0,
            "status_diffs": 0,
            "amount_diffs": 0,
            "duplicate_pks": 0,
        }
        
        for entity in entities:
            differences, total_checked = self.comparison_engine.compare_entity(
                entity=entity,
                tenant_filter=tenant_filter,
                time_range=time_range,
            )
            
            new_missing = 0
            old_missing = 0
            field_diffs = 0
            mapping_diffs = 0
            status_diffs = 0
            amount_diffs = 0
            duplicate_pks = 0
            
            for diff in differences:
                if diff.tenant_id:
                    affected_tenants.add(diff.tenant_id)
                
                if diff.diff_type == DifferenceType.NEW_MISSING:
                    new_missing += 1
                    summary["new_missing"] += 1
                elif diff.diff_type == DifferenceType.OLD_MISSING:
                    old_missing += 1
                    summary["old_missing"] += 1
                elif diff.diff_type == DifferenceType.FIELD_DIFF:
                    field_diffs += 1
                    summary["field_diffs"] += 1
                elif diff.diff_type == DifferenceType.MAPPING_DIFF:
                    mapping_diffs += 1
                    summary["mapping_diffs"] += 1
                elif diff.diff_type == DifferenceType.STATUS_DIFF:
                    status_diffs += 1
                    summary["status_diffs"] += 1
                elif diff.diff_type == DifferenceType.AMOUNT_DIFF:
                    amount_diffs += 1
                    summary["amount_diffs"] += 1
                elif diff.diff_type == DifferenceType.DUPLICATE_PK:
                    duplicate_pks += 1
                    summary["duplicate_pks"] += 1
                
                all_differences.append(diff)
            
            sample_differences = differences[:max_samples]
            suggestions = [
                self.comparison_engine.suggest_compensation(diff, entity)
                for diff in sample_differences
            ]
            
            entity_reports.append(EntityReport(
                entity=entity.name,
                total_checked=total_checked,
                new_missing=new_missing,
                old_missing=old_missing,
                field_diffs=field_diffs,
                mapping_diffs=mapping_diffs,
                status_diffs=status_diffs,
                amount_diffs=amount_diffs,
                duplicate_pks=duplicate_pks,
                sample_differences=sample_differences,
                suggestions=suggestions,
            ))
        
        return CheckReport(
            check_time=datetime.now(),
            entities=entity_reports,
            total_differences=len(all_differences),
            affected_tenants=list(affected_tenants),
            summary=summary,
        )
    
    def generate_diff_explanation(
        self,
        diff: Difference,
        entity_config: Optional[EntityConfig] = None,
    ) -> Dict[str, any]:
        explanation = {
            "diff_id": diff.id,
            "entity": diff.entity,
            "primary_key": diff.primary_key,
            "pk_value": diff.pk_value,
            "diff_type": diff.diff_type.value,
            "status": diff.status.value,
            "tenant_id": diff.tenant_id,
            "created_at": diff.created_at,
            "first_seen_at": diff.first_seen_at,
            "recurrence_count": diff.recurrence_count,
        }
        
        if diff.diff_type == DifferenceType.NEW_MISSING:
            explanation["description"] = "记录仅存在于旧库，新库缺失"
            explanation["affected_record"] = diff.old_record
        elif diff.diff_type == DifferenceType.OLD_MISSING:
            explanation["description"] = "记录仅存在于新库，旧库缺失"
            explanation["affected_record"] = diff.new_record
        elif diff.diff_type == DifferenceType.DUPLICATE_PK:
            explanation["description"] = "存在重复主键"
            explanation["old_record"] = diff.old_record
            explanation["new_record"] = diff.new_record
        elif diff.diff_type == DifferenceType.MAPPING_DIFF:
            explanation["description"] = "字段映射不一致"
            explanation["field_differences"] = [
                {
                    "field": fd.field,
                    "old_value": fd.old_value,
                    "new_value": fd.new_value,
                    "is_mapping_issue": fd.mapping_issue,
                }
                for fd in diff.field_diffs
            ]
        elif diff.diff_type == DifferenceType.STATUS_DIFF:
            explanation["description"] = "状态字段不一致"
            explanation["field_differences"] = [
                {
                    "field": fd.field,
                    "old_value": fd.old_value,
                    "new_value": fd.new_value,
                }
                for fd in diff.field_diffs
            ]
        elif diff.diff_type == DifferenceType.AMOUNT_DIFF:
            explanation["description"] = "金额字段不一致"
            explanation["field_differences"] = [
                {
                    "field": fd.field,
                    "old_value": fd.old_value,
                    "new_value": fd.new_value,
                }
                for fd in diff.field_diffs
            ]
        else:
            explanation["description"] = "字段值不一致"
            explanation["field_differences"] = [
                {
                    "field": fd.field,
                    "old_value": fd.old_value,
                    "new_value": fd.new_value,
                }
                for fd in diff.field_diffs
            ]
        
        if entity_config:
            suggestion = self.comparison_engine.suggest_compensation(diff, entity_config)
            explanation["compensation_suggestion"] = {
                "action": suggestion.action.value,
                "reason": suggestion.reason,
                "is_frozen": suggestion.is_frozen,
            }
        
        if diff.status in [
            DifferenceStatus.RECURRING,
            DifferenceStatus.CONFIRMED,
            DifferenceStatus.FIXED,
        ]:
            explanation["status_history"] = {
                "first_seen_at": diff.first_seen_at,
                "confirmed_at": diff.confirmed_at,
                "fixed_at": diff.fixed_at,
                "recurrence_count": diff.recurrence_count,
            }
        
        return explanation
