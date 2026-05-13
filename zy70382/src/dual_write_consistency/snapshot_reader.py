import json
import os
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional

from .models import EntityConfig, TenantFilter, TimeRange


class SnapshotReader:
    def __init__(self, snapshot_dir: str):
        self.snapshot_dir = snapshot_dir
    
    def read_snapshot(
        self,
        entity: EntityConfig,
        source: str,
        tenant_filter: Optional[TenantFilter] = None,
        time_range: Optional[TimeRange] = None,
    ) -> Iterator[Dict[str, Any]]:
        table_name = entity.old_table if source == "old" else entity.new_table
        snapshot_file = os.path.join(self.snapshot_dir, f"{table_name}.json")
        
        if not os.path.exists(snapshot_file):
            raise FileNotFoundError(f"Snapshot file not found: {snapshot_file}")
        
        with open(snapshot_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        records = data.get("records", []) if isinstance(data, dict) else data
        
        for record in records:
            if self._matches_tenant_filter(record, tenant_filter):
                if self._matches_time_range(record, time_range):
                    yield record
    
    def _matches_tenant_filter(
        self,
        record: Dict[str, Any],
        tenant_filter: Optional[TenantFilter],
    ) -> bool:
        if not tenant_filter or not tenant_filter.tenant_ids:
            return True
        
        tenant_field = tenant_filter.tenant_field
        tenant_id = record.get(tenant_field)
        
        return tenant_id in tenant_filter.tenant_ids
    
    def _matches_time_range(
        self,
        record: Dict[str, Any],
        time_range: Optional[TimeRange],
    ) -> bool:
        if not time_range:
            return True
        
        time_field = time_range.time_field
        time_value = record.get(time_field)
        
        if time_value is None:
            return False
        
        if isinstance(time_value, str):
            try:
                time_value = datetime.fromisoformat(time_value.replace("Z", "+00:00"))
            except ValueError:
                return False
        
        if time_range.start_time and time_value < time_range.start_time:
            return False
        if time_range.end_time and time_value > time_range.end_time:
            return False
        
        return True
