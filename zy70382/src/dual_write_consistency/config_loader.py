import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from .models import (
    CheckConfig,
    EntityConfig,
    FieldMapping,
    TenantFilter,
    TimeRange,
)


def load_config(config_path: str) -> CheckConfig:
    with open(config_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    entities: List[EntityConfig] = []
    for entity_data in data.get("entities", []):
        field_mappings = [
            FieldMapping(**fm) for fm in entity_data.get("field_mappings", [])
        ]
        entity = EntityConfig(
            name=entity_data["name"],
            old_table=entity_data["old_table"],
            new_table=entity_data["new_table"],
            primary_key=entity_data.get("primary_key", "id"),
            status_field=entity_data.get("status_field"),
            amount_fields=entity_data.get("amount_fields", []),
            field_mappings=field_mappings,
            ignored_fields=entity_data.get("ignored_fields", []),
            dynamic_field_patterns=entity_data.get("dynamic_field_patterns", []),
            frozen_data_criteria=entity_data.get("frozen_data_criteria"),
        )
        entities.append(entity)
    
    tenant_filter: Optional[TenantFilter] = None
    if "tenant_filter" in data:
        tf_data = data["tenant_filter"]
        tenant_filter = TenantFilter(
            tenant_ids=tf_data.get("tenant_ids", []),
            tenant_field=tf_data.get("tenant_field", "tenant_id"),
        )
    
    time_range: Optional[TimeRange] = None
    if "time_range" in data:
        tr_data = data["time_range"]
        start_time = None
        if tr_data.get("start_time"):
            start_time = datetime.fromisoformat(tr_data["start_time"])
        end_time = None
        if tr_data.get("end_time"):
            end_time = datetime.fromisoformat(tr_data["end_time"])
        time_range = TimeRange(
            start_time=start_time,
            end_time=end_time,
            time_field=tr_data.get("time_field", "created_at"),
        )
    
    return CheckConfig(
        entities=entities,
        tenant_filter=tenant_filter,
        time_range=time_range,
        batch_size=data.get("batch_size", 1000),
    )
