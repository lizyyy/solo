"""数据加载和存储模块"""

import json
import os
from datetime import datetime, date
from typing import List, Dict, Optional
from pathlib import Path

from .models import (
    CustomerProfile, APIKey, AccessLog, IPRegionBaseline,
    APIConfig, SafetyMark
)


class DataStore:
    """数据存储和加载器"""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self._customers: Dict[str, CustomerProfile] = {}
        self._api_keys: Dict[str, APIKey] = {}
        self._access_logs: List[AccessLog] = []
        self._region_baselines: Dict[str, IPRegionBaseline] = {}
        self._api_configs: Dict[str, APIConfig] = {}
        self._safety_marks: List[SafetyMark] = []

    def load_all(self) -> None:
        self.load_customers()
        self.load_api_keys()
        self.load_access_logs()
        self.load_region_baselines()
        self.load_api_configs()
        self.load_safety_marks()

    def save_all(self) -> None:
        self.save_customers()
        self.save_api_keys()
        self.save_access_logs()
        self.save_region_baselines()
        self.save_api_configs()
        self.save_safety_marks()

    def load_customers(self) -> None:
        path = self.data_dir / "customers.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self._customers[item["customer_id"]] = CustomerProfile(
                        customer_id=item["customer_id"],
                        customer_name=item["customer_name"],
                        create_date=date.fromisoformat(item["create_date"]),
                        business_type=item["business_type"],
                        industry=item["industry"],
                        avg_daily_calls=item.get("avg_daily_calls", 0),
                        peak_hours=item.get("peak_hours", []),
                        usual_regions=item.get("usual_regions", []),
                        is_new_customer=item.get("is_new_customer", False),
                    )

    def save_customers(self) -> None:
        path = self.data_dir / "customers.json"
        data = []
        for cust in self._customers.values():
            data.append({
                "customer_id": cust.customer_id,
                "customer_name": cust.customer_name,
                "create_date": cust.create_date.isoformat(),
                "business_type": cust.business_type,
                "industry": cust.industry,
                "avg_daily_calls": cust.avg_daily_calls,
                "peak_hours": cust.peak_hours,
                "usual_regions": cust.usual_regions,
                "is_new_customer": cust.is_new_customer,
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_api_keys(self) -> None:
        path = self.data_dir / "api_keys.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self._api_keys[item["key_id"]] = APIKey(
                        key_id=item["key_id"],
                        customer_id=item["customer_id"],
                        api_key=item["api_key"],
                        create_date=date.fromisoformat(item["create_date"]),
                        permissions=item.get("permissions", []),
                        rate_limit=item.get("rate_limit", 1000),
                        is_active=item.get("is_active", True),
                    )

    def save_api_keys(self) -> None:
        path = self.data_dir / "api_keys.json"
        data = []
        for key in self._api_keys.values():
            data.append({
                "key_id": key.key_id,
                "customer_id": key.customer_id,
                "api_key": key.api_key,
                "create_date": key.create_date.isoformat(),
                "permissions": key.permissions,
                "rate_limit": key.rate_limit,
                "is_active": key.is_active,
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_access_logs(self) -> None:
        path = self.data_dir / "access_logs.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self._access_logs.append(AccessLog(
                        log_id=item["log_id"],
                        api_key=item["api_key"],
                        endpoint=item["endpoint"],
                        ip=item["ip"],
                        region=item["region"],
                        timestamp=datetime.fromisoformat(item["timestamp"]),
                        status_code=item["status_code"],
                        response_time_ms=item["response_time_ms"],
                        is_sensitive=item.get("is_sensitive", False),
                        is_duplicate=item.get("is_duplicate", False),
                    ))

    def save_access_logs(self) -> None:
        path = self.data_dir / "access_logs.json"
        data = []
        for log in self._access_logs:
            data.append({
                "log_id": log.log_id,
                "api_key": log.api_key,
                "endpoint": log.endpoint,
                "ip": log.ip,
                "region": log.region,
                "timestamp": log.timestamp.isoformat(),
                "status_code": log.status_code,
                "response_time_ms": log.response_time_ms,
                "is_sensitive": log.is_sensitive,
                "is_duplicate": log.is_duplicate,
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_region_baselines(self) -> None:
        path = self.data_dir / "region_baselines.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    key = f"{item['customer_id']}:{item['key_id']}"
                    self._region_baselines[key] = IPRegionBaseline(
                        customer_id=item["customer_id"],
                        key_id=item["key_id"],
                        usual_regions=item.get("usual_regions", []),
                        usual_ips=item.get("usual_ips", []),
                        last_updated=datetime.fromisoformat(item["last_updated"]),
                    )

    def save_region_baselines(self) -> None:
        path = self.data_dir / "region_baselines.json"
        data = []
        for baseline in self._region_baselines.values():
            data.append({
                "customer_id": baseline.customer_id,
                "key_id": baseline.key_id,
                "usual_regions": baseline.usual_regions,
                "usual_ips": baseline.usual_ips,
                "last_updated": baseline.last_updated.isoformat(),
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_api_configs(self) -> None:
        path = self.data_dir / "api_configs.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self._api_configs[item["endpoint"]] = APIConfig(
                        endpoint=item["endpoint"],
                        is_sensitive=item.get("is_sensitive", False),
                        permission_required=item.get("permission_required"),
                        max_calls_per_hour=item.get("max_calls_per_hour", 100),
                    )

    def save_api_configs(self) -> None:
        path = self.data_dir / "api_configs.json"
        data = []
        for config in self._api_configs.values():
            data.append({
                "endpoint": config.endpoint,
                "is_sensitive": config.is_sensitive,
                "permission_required": config.permission_required,
                "max_calls_per_hour": config.max_calls_per_hour,
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_safety_marks(self) -> None:
        path = self.data_dir / "safety_marks.json"
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self._safety_marks.append(SafetyMark(
                        mark_id=item["mark_id"],
                        customer_id=item["customer_id"],
                        key_id=item["key_id"],
                        marked_by=item["marked_by"],
                        mark_time=datetime.fromisoformat(item["mark_time"]),
                        reason=item["reason"],
                        expires_at=datetime.fromisoformat(item["expires_at"]) if item.get("expires_at") else None,
                        is_active=item.get("is_active", True),
                    ))

    def save_safety_marks(self) -> None:
        path = self.data_dir / "safety_marks.json"
        data = []
        for mark in self._safety_marks:
            data.append({
                "mark_id": mark.mark_id,
                "customer_id": mark.customer_id,
                "key_id": mark.key_id,
                "marked_by": mark.marked_by,
                "mark_time": mark.mark_time.isoformat(),
                "reason": mark.reason,
                "expires_at": mark.expires_at.isoformat() if mark.expires_at else None,
                "is_active": mark.is_active,
            })
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_customer(self, customer_id: str) -> Optional[CustomerProfile]:
        return self._customers.get(customer_id)

    def get_api_key(self, key_id: str) -> Optional[APIKey]:
        return self._api_keys.get(key_id)

    def get_api_key_by_api_key(self, api_key: str) -> Optional[APIKey]:
        for key in self._api_keys.values():
            if key.api_key == api_key:
                return key
        return None

    def get_access_logs(self, key_id: Optional[str] = None,
                        customer_id: Optional[str] = None,
                        endpoint: Optional[str] = None) -> List[AccessLog]:
        logs = self._access_logs
        if key_id:
            api_key = self.get_api_key(key_id)
            if api_key:
                logs = [l for l in logs if l.api_key == api_key.api_key]
        if customer_id:
            customer_keys = [k.api_key for k in self._api_keys.values()
                           if k.customer_id == customer_id]
            logs = [l for l in logs if l.api_key in customer_keys]
        if endpoint:
            logs = [l for l in logs if l.endpoint == endpoint]
        return logs

    def get_region_baseline(self, customer_id: str, key_id: str) -> Optional[IPRegionBaseline]:
        return self._region_baselines.get(f"{customer_id}:{key_id}")

    def get_api_config(self, endpoint: str) -> Optional[APIConfig]:
        return self._api_configs.get(endpoint)

    def get_safety_marks(self, key_id: Optional[str] = None,
                         customer_id: Optional[str] = None) -> List[SafetyMark]:
        marks = self._safety_marks
        if key_id:
            marks = [m for m in marks if m.key_id == key_id]
        if customer_id:
            marks = [m for m in marks if m.customer_id == customer_id]
        return marks

    def add_safety_mark(self, mark: SafetyMark) -> None:
        self._safety_marks.append(mark)

    def get_all_customers(self) -> Dict[str, CustomerProfile]:
        return self._customers

    def get_all_api_keys(self) -> Dict[str, APIKey]:
        return self._api_keys

    def get_all_api_configs(self) -> Dict[str, APIConfig]:
        return self._api_configs

    def set_customer(self, customer: CustomerProfile) -> None:
        self._customers[customer.customer_id] = customer

    def set_api_key(self, api_key: APIKey) -> None:
        self._api_keys[api_key.key_id] = api_key

    def add_access_log(self, log: AccessLog) -> None:
        self._access_logs.append(log)

    def set_region_baseline(self, baseline: IPRegionBaseline) -> None:
        self._region_baselines[f"{baseline.customer_id}:{baseline.key_id}"] = baseline

    def set_api_config(self, config: APIConfig) -> None:
        self._api_configs[config.endpoint] = config
