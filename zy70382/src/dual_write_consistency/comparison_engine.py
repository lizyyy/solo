import hashlib
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    CompensateAction,
    CompensateSuggestion,
    Difference,
    DifferenceStatus,
    DifferenceType,
    EntityConfig,
    FieldDifference,
    TenantFilter,
    TimeRange,
)
from .snapshot_reader import SnapshotReader


def normalize_field_name(field: str) -> str:
    return field.lower().replace("_", "")


def values_equal(old_val: Any, new_val: Any) -> bool:
    if old_val == new_val:
        return True
    
    if old_val is None and new_val == "":
        return True
    if new_val is None and old_val == "":
        return True
    
    if isinstance(old_val, bool) and isinstance(new_val, int):
        return old_val == bool(new_val)
    if isinstance(new_val, bool) and isinstance(old_val, int):
        return new_val == bool(old_val)
    
    try:
        old_dec = Decimal(str(old_val))
        new_dec = Decimal(str(new_val))
        return old_dec == new_dec
    except (InvalidOperation, TypeError, ValueError):
        pass
    
    if isinstance(old_val, str) and isinstance(new_val, str):
        if old_val.strip() == new_val.strip():
            return True
    
    if isinstance(old_val, datetime) and isinstance(new_val, str):
        try:
            new_dt = datetime.fromisoformat(new_val.replace("Z", "+00:00"))
            return old_val == new_dt
        except ValueError:
            pass
    if isinstance(new_val, datetime) and isinstance(old_val, str):
        try:
            old_dt = datetime.fromisoformat(old_val.replace("Z", "+00:00"))
            return new_val == old_dt
        except ValueError:
            pass
    
    return False


class ComparisonEngine:
    def __init__(self, snapshot_reader: SnapshotReader):
        self.snapshot_reader = snapshot_reader
    
    def _normalize_for_comparison(
        self,
        entity: EntityConfig,
        old_record: Dict[str, Any],
        new_record: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        old_normalized: Dict[str, Any] = {}
        new_normalized: Dict[str, Any] = {}
        
        for old_field, new_field in [(fm.old_field, fm.new_field) for fm in entity.field_mappings]:
            if old_field in old_record:
                old_normalized[new_field] = old_record[old_field]
        
        for field, value in old_record.items():
            normalized = normalize_field_name(field)
            matches_mapping = any(
                normalize_field_name(fm.old_field) == normalized
                for fm in entity.field_mappings
            )
            if not matches_mapping:
                old_normalized[field] = value
        
        for field, value in new_record.items():
            new_normalized[field] = value
        
        return old_normalized, new_normalized
    
    def _is_dynamic_field(self, field: str, patterns: List[str]) -> bool:
        for pattern in patterns:
            if re.match(pattern, field):
                return True
        return False
    
    def _is_frozen(self, record: Dict[str, Any], criteria: Optional[Dict[str, Any]]) -> bool:
        if not criteria:
            return False
        for field, value in criteria.items():
            if record.get(field) != value:
                return False
        return True
    
    def _compare_fields(
        self,
        entity: EntityConfig,
        old_normalized: Dict[str, Any],
        new_normalized: Dict[str, Any],
    ) -> Tuple[List[FieldDifference], List[FieldDifference], List[FieldDifference]]:
        field_diffs: List[FieldDifference] = []
        status_diffs: List[FieldDifference] = []
        amount_diffs: List[FieldDifference] = []
        
        ignored = set(entity.ignored_fields)
        dynamic_patterns = entity.dynamic_field_patterns
        
        all_fields = set(old_normalized.keys()) | set(new_normalized.keys())
        
        for field in all_fields:
            if field in ignored:
                continue
            if self._is_dynamic_field(field, dynamic_patterns):
                continue
            
            old_val = old_normalized.get(field)
            new_val = new_normalized.get(field)
            
            if not values_equal(old_val, new_val):
                diff = FieldDifference(
                    field=field,
                    old_value=old_val,
                    new_value=new_val,
                    mapping_issue=False,
                )
                
                if entity.status_field and field == entity.status_field:
                    status_diffs.append(diff)
                elif field in entity.amount_fields:
                    amount_diffs.append(diff)
                else:
                    field_diffs.append(diff)
        
        return field_diffs, status_diffs, amount_diffs
    
    def _check_mapping_issues(
        self,
        entity: EntityConfig,
        old_record: Dict[str, Any],
        new_record: Dict[str, Any],
    ) -> List[FieldDifference]:
        mapping_diffs: List[FieldDifference] = []
        
        for fm in entity.field_mappings:
            if fm.old_field in old_record:
                old_val = old_record[fm.old_field]
                new_val = new_record.get(fm.new_field)
                
                if not values_equal(old_val, new_val):
                    mapping_diffs.append(FieldDifference(
                        field=f"{fm.old_field} -> {fm.new_field}",
                        old_value=old_val,
                        new_value=new_val,
                        mapping_issue=True,
                    ))
        
        return mapping_diffs
    
    def _generate_diff_id(self, entity_name: str, pk_value: Any, diff_type: DifferenceType) -> str:
        key = f"{entity_name}:{str(pk_value)}:{diff_type.value}"
        return hashlib.md5(key.encode("utf-8")).hexdigest()
    
    def _get_tenant_id(self, record: Dict[str, Any], tenant_field: str) -> Optional[str]:
        return str(record.get(tenant_field)) if tenant_field in record else None
    
    def compare_entity(
        self,
        entity: EntityConfig,
        tenant_filter: Optional[TenantFilter] = None,
        time_range: Optional[TimeRange] = None,
    ) -> Tuple[List[Difference], int]:
        differences: List[Difference] = []
        
        old_records: Dict[Any, Dict[str, Any]] = {}
        new_records: Dict[Any, Dict[str, Any]] = {}
        
        old_duplicates: set = set()
        new_duplicates: set = set()
        
        for record in self.snapshot_reader.read_snapshot(
            entity=entity,
            source="old",
            tenant_filter=tenant_filter,
            time_range=time_range,
        ):
            pk = record.get(entity.primary_key)
            if pk in old_records:
                old_duplicates.add(pk)
            old_records[pk] = record
        
        for record in self.snapshot_reader.read_snapshot(
            entity=entity,
            source="new",
            tenant_filter=tenant_filter,
            time_range=time_range,
        ):
            pk = record.get(entity.primary_key)
            if pk in new_records:
                new_duplicates.add(pk)
            new_records[pk] = record
        
        all_pks = set(old_records.keys()) | set(new_records.keys())
        total_checked = len(all_pks)
        
        tenant_field = tenant_filter.tenant_field if tenant_filter else "tenant_id"
        
        for pk in old_duplicates:
            record = old_records[pk]
            diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.DUPLICATE_PK)
            differences.append(Difference(
                id=diff_id,
                entity=entity.name,
                primary_key=entity.primary_key,
                pk_value=pk,
                diff_type=DifferenceType.DUPLICATE_PK,
                old_record=record,
                tenant_id=self._get_tenant_id(record, tenant_field),
            ))
        
        for pk in new_duplicates:
            record = new_records[pk]
            if pk not in old_duplicates:
                diff_id = self._generate_diff_id(entity.name + ":new", pk, DifferenceType.DUPLICATE_PK)
                differences.append(Difference(
                    id=diff_id,
                    entity=entity.name,
                    primary_key=entity.primary_key,
                    pk_value=pk,
                    diff_type=DifferenceType.DUPLICATE_PK,
                    new_record=record,
                    tenant_id=self._get_tenant_id(record, tenant_field),
                ))
        
        for pk in all_pks:
            old_rec = old_records.get(pk)
            new_rec = new_records.get(pk)
            
            if old_rec is None and new_rec is not None:
                diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.OLD_MISSING)
                differences.append(Difference(
                    id=diff_id,
                    entity=entity.name,
                    primary_key=entity.primary_key,
                    pk_value=pk,
                    diff_type=DifferenceType.OLD_MISSING,
                    new_record=new_rec,
                    tenant_id=self._get_tenant_id(new_rec, tenant_field),
                ))
            elif new_rec is None and old_rec is not None:
                diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.NEW_MISSING)
                differences.append(Difference(
                    id=diff_id,
                    entity=entity.name,
                    primary_key=entity.primary_key,
                    pk_value=pk,
                    diff_type=DifferenceType.NEW_MISSING,
                    old_record=old_rec,
                    tenant_id=self._get_tenant_id(old_rec, tenant_field),
                ))
            elif old_rec is not None and new_rec is not None:
                mapping_diffs = self._check_mapping_issues(entity, old_rec, new_rec)
                if mapping_diffs:
                    diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.MAPPING_DIFF)
                    differences.append(Difference(
                        id=diff_id,
                        entity=entity.name,
                        primary_key=entity.primary_key,
                        pk_value=pk,
                        diff_type=DifferenceType.MAPPING_DIFF,
                        field_diffs=mapping_diffs,
                        old_record=old_rec,
                        new_record=new_rec,
                        tenant_id=self._get_tenant_id(old_rec, tenant_field),
                    ))
                
                old_norm, new_norm = self._normalize_for_comparison(entity, old_rec, new_rec)
                field_diffs, status_diffs, amount_diffs = self._compare_fields(
                    entity, old_norm, new_norm
                )
                
                if status_diffs:
                    diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.STATUS_DIFF)
                    differences.append(Difference(
                        id=diff_id,
                        entity=entity.name,
                        primary_key=entity.primary_key,
                        pk_value=pk,
                        diff_type=DifferenceType.STATUS_DIFF,
                        field_diffs=status_diffs,
                        old_record=old_rec,
                        new_record=new_rec,
                        tenant_id=self._get_tenant_id(old_rec, tenant_field),
                    ))
                
                if amount_diffs:
                    diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.AMOUNT_DIFF)
                    differences.append(Difference(
                        id=diff_id,
                        entity=entity.name,
                        primary_key=entity.primary_key,
                        pk_value=pk,
                        diff_type=DifferenceType.AMOUNT_DIFF,
                        field_diffs=amount_diffs,
                        old_record=old_rec,
                        new_record=new_rec,
                        tenant_id=self._get_tenant_id(old_rec, tenant_field),
                    ))
                
                if field_diffs:
                    diff_id = self._generate_diff_id(entity.name, pk, DifferenceType.FIELD_DIFF)
                    differences.append(Difference(
                        id=diff_id,
                        entity=entity.name,
                        primary_key=entity.primary_key,
                        pk_value=pk,
                        diff_type=DifferenceType.FIELD_DIFF,
                        field_diffs=field_diffs,
                        old_record=old_rec,
                        new_record=new_rec,
                        tenant_id=self._get_tenant_id(old_rec, tenant_field),
                    ))
        
        return differences, total_checked
    
    def suggest_compensation(
        self,
        difference: Difference,
        entity: EntityConfig,
    ) -> CompensateSuggestion:
        record = difference.old_record or difference.new_record
        is_frozen = self._is_frozen(record, entity.frozen_data_criteria) if record else False
        
        if difference.diff_type == DifferenceType.NEW_MISSING:
            action = CompensateAction.COPY_TO_NEW
            reason = "记录仅存在于旧库，建议同步到新库"
        elif difference.diff_type == DifferenceType.OLD_MISSING:
            action = CompensateAction.COPY_TO_OLD
            reason = "记录仅存在于新库，建议同步到旧库"
        elif difference.diff_type == DifferenceType.DUPLICATE_PK:
            action = CompensateAction.MANUAL
            reason = "存在重复主键，需要人工确认保留哪条"
        elif difference.diff_type == DifferenceType.MAPPING_DIFF:
            action = CompensateAction.MANUAL
            reason = "字段映射不一致，需要检查映射规则或手动修正"
        elif difference.diff_type == DifferenceType.STATUS_DIFF:
            action = CompensateAction.SYNC_BOTH
            reason = "状态字段不一致，需要确认正确状态后同步两边"
        elif difference.diff_type == DifferenceType.AMOUNT_DIFF:
            action = CompensateAction.MANUAL
            reason = "金额字段不一致，需要人工确认正确值"
        else:
            action = CompensateAction.SYNC_BOTH
            reason = "字段值不一致，需要确认正确值后同步"
        
        if is_frozen:
            action = CompensateAction.MANUAL
            reason = "数据已冻结，禁止自动补偿，需要人工评估"
        
        return CompensateSuggestion(
            difference_id=difference.id,
            entity=difference.entity,
            primary_key=difference.primary_key,
            pk_value=difference.pk_value,
            action=action,
            reason=reason,
            is_frozen=is_frozen,
        )
