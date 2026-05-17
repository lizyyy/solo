from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from .types import (
    SchemaSnapshot,
    FieldChange,
    ChangeType,
    CompatibilityLevel,
    CompatibilityResult,
)


def is_type_compatible(old_type: str, new_type: str) -> Tuple[bool, str]:
    type_promotions = {
        "int8": ["int16", "int32", "int64", "float", "double"],
        "int16": ["int32", "int64", "float", "double"],
        "int32": ["int64", "float", "double"],
        "int64": ["float", "double"],
        "float": ["double"],
        "string": ["large_string"],
    }
    
    if old_type == new_type:
        return True, "Types are identical"
    
    compatible_types = type_promotions.get(old_type, [])
    if new_type in compatible_types:
        return True, f"Type promotion from {old_type} to {new_type} is safe"
    
    return False, f"Type change from {old_type} to {new_type} is incompatible"


def compare_schemas(
    reference: SchemaSnapshot,
    target: SchemaSnapshot,
    strict: bool = False
) -> CompatibilityResult:
    changes: List[FieldChange] = []
    overall_level = CompatibilityLevel.FULLY_COMPATIBLE
    
    ref_fields = {f["name"]: f for f in reference.fields}
    tgt_fields = {f["name"]: f for f in target.fields}
    
    all_field_names = set(ref_fields.keys()) | set(tgt_fields.keys())
    
    for field_name in all_field_names:
        in_ref = field_name in ref_fields
        in_tgt = field_name in tgt_fields
        
        if in_ref and not in_tgt:
            impact = "high" if strict else "medium"
            changes.append(FieldChange(
                field_name=field_name,
                change_type=ChangeType.FIELD_REMOVED,
                old_value=str(ref_fields[field_name]["type"]),
                new_value=None,
                compatibility_impact=impact,
                description=f"Field '{field_name}' was removed from target schema"
            ))
            if overall_level != CompatibilityLevel.INCOMPATIBLE:
                overall_level = CompatibilityLevel.BACKWARD_COMPATIBLE if not strict else CompatibilityLevel.INCOMPATIBLE
        
        elif not in_ref and in_tgt:
            is_nullable = tgt_fields[field_name]["nullable"]
            if is_nullable:
                changes.append(FieldChange(
                    field_name=field_name,
                    change_type=ChangeType.FIELD_ADDED,
                    old_value=None,
                    new_value=str(tgt_fields[field_name]["type"]),
                    compatibility_impact="low",
                    description=f"Nullable field '{field_name}' was added to target schema"
                ))
            else:
                changes.append(FieldChange(
                    field_name=field_name,
                    change_type=ChangeType.FIELD_ADDED,
                    old_value=None,
                    new_value=str(tgt_fields[field_name]["type"]),
                    compatibility_impact="high",
                    description=f"Non-nullable field '{field_name}' was added - may break old readers"
                ))
                overall_level = CompatibilityLevel.INCOMPATIBLE
        
        else:
            ref_field = ref_fields[field_name]
            tgt_field = tgt_fields[field_name]
            
            if ref_field["type"] != tgt_field["type"]:
                compatible, reason = is_type_compatible(ref_field["type"], tgt_field["type"])
                if compatible:
                    changes.append(FieldChange(
                        field_name=field_name,
                        change_type=ChangeType.TYPE_CHANGED,
                        old_value=ref_field["type"],
                        new_value=tgt_field["type"],
                        compatibility_impact="low",
                        description=reason
                    ))
                else:
                    changes.append(FieldChange(
                        field_name=field_name,
                        change_type=ChangeType.TYPE_CHANGED,
                        old_value=ref_field["type"],
                        new_value=tgt_field["type"],
                        compatibility_impact="high",
                        description=reason
                    ))
                    overall_level = CompatibilityLevel.INCOMPATIBLE
            
            if ref_field["nullable"] != tgt_field["nullable"]:
                if not ref_field["nullable"] and tgt_field["nullable"]:
                    changes.append(FieldChange(
                        field_name=field_name,
                        change_type=ChangeType.NULLABILITY_CHANGED,
                        old_value="NOT NULL",
                        new_value="NULLABLE",
                        compatibility_impact="low",
                        description=f"Field became nullable - backward compatible"
                    ))
                else:
                    changes.append(FieldChange(
                        field_name=field_name,
                        change_type=ChangeType.NULLABILITY_CHANGED,
                        old_value="NULLABLE",
                        new_value="NOT NULL",
                        compatibility_impact="high",
                        description=f"Field became non-nullable - breaks old data with nulls"
                    ))
                    overall_level = CompatibilityLevel.INCOMPATIBLE
    
    summary = {
        "total_changes": len(changes),
        "changes_by_type": defaultdict(int),
        "changes_by_impact": defaultdict(int),
        "reference_field_count": len(reference.fields),
        "target_field_count": len(target.fields),
    }
    
    for change in changes:
        summary["changes_by_type"][change.change_type.value] += 1
        summary["changes_by_impact"][change.compatibility_impact] += 1
    
    summary["changes_by_type"] = dict(summary["changes_by_type"])
    summary["changes_by_impact"] = dict(summary["changes_by_impact"])
    
    return CompatibilityResult(
        overall_level=overall_level,
        changes=changes,
        bad_rows=[],
        summary=summary
    )


def compare_multiple_schemas(
    reference: SchemaSnapshot,
    targets: List[SchemaSnapshot],
    strict: bool = False
) -> List[CompatibilityResult]:
    return [compare_schemas(reference, target, strict) for target in targets]
