import uuid
import hashlib
from datetime import datetime
from typing import Optional, Dict, List, Tuple
from collections import defaultdict

from .models import PromptVersion, TrafficAllocation, HitRecord, RollbackEvent
from .storage import StorageManager


class PromptVersionService:
    def __init__(self, storage: Optional[StorageManager] = None):
        self.storage = storage or StorageManager()

    def publish_version(
        self,
        template_name: str,
        version_id: str,
        content: str,
        publisher: str,
        description: str = ""
    ) -> PromptVersion:
        existing = self.storage.get_version(template_name, version_id)
        if existing:
            raise ValueError(f"版本 {version_id} 已存在于模板 {template_name}")
        
        if not content.strip():
            raise ValueError("版本内容不能为空")
        
        if not publisher.strip():
            raise ValueError("发布人不能为空")
        
        version = PromptVersion(
            template_name=template_name,
            version_id=version_id,
            content=content,
            publisher=publisher,
            publish_time=datetime.now().isoformat(),
            description=description,
            is_active=True,
            traffic_weight=0
        )
        self.storage.save_version(version)
        return version

    def allocate_traffic(
        self,
        template_name: str,
        allocations: Dict[str, int],
        operator: str
    ) -> TrafficAllocation:
        versions = self.storage.list_versions(template_name)
        version_ids = {v.version_id for v in versions}
        
        for vid in allocations.keys():
            if vid not in version_ids:
                raise ValueError(f"版本 {vid} 不存在于模板 {template_name}")
        
        total_weight = sum(allocations.values())
        if total_weight != 100 and total_weight != 0:
            raise ValueError(f"流量分配总和必须为100或0，当前为 {total_weight}")
        
        for vid, weight in allocations.items():
            if weight < 0:
                raise ValueError(f"流量权重不能为负数: {vid} = {weight}")
        
        allocation = TrafficAllocation(
            template_name=template_name,
            allocations=allocations,
            update_time=datetime.now().isoformat(),
            operator=operator
        )
        self.storage.save_traffic_allocation(allocation)
        return allocation

    def record_hit(
        self,
        request_id: str,
        template_name: str,
        version_id: str,
        request_content: str = "",
        metadata: Optional[Dict] = None
    ) -> HitRecord:
        version = self.storage.get_version(template_name, version_id)
        if not version:
            raise ValueError(f"版本 {version_id} 不存在于模板 {template_name}")
        
        request_hash = hashlib.md5((request_id + request_content).encode()).hexdigest()[:16]
        
        hit = HitRecord(
            request_id=request_id,
            template_name=template_name,
            version_id=version_id,
            hit_time=datetime.now().isoformat(),
            request_hash=request_hash,
            metadata=metadata or {}
        )
        self.storage.save_hit_record(hit)
        return hit

    def rollback_version(
        self,
        template_name: str,
        from_version: str,
        to_version: str,
        operator: str,
        reason: str = ""
    ) -> RollbackEvent:
        v1 = self.storage.get_version(template_name, from_version)
        v2 = self.storage.get_version(template_name, to_version)
        
        if not v1:
            raise ValueError(f"源版本 {from_version} 不存在")
        if not v2:
            raise ValueError(f"目标版本 {to_version} 不存在")
        
        rollbacks = self.storage.get_rollback_events(template_name)
        for rb in rollbacks:
            if (rb.from_version == from_version and 
                rb.to_version == to_version and
                rb.reason == reason):
                return rb
        
        rollback_id = f"rb_{uuid.uuid4().hex[:8]}"
        
        rollback = RollbackEvent(
            template_name=template_name,
            from_version=from_version,
            to_version=to_version,
            rollback_time=datetime.now().isoformat(),
            operator=operator,
            reason=reason,
            rollback_id=rollback_id
        )
        self.storage.save_rollback_event(rollback)
        
        latest_traffic = self.storage.get_latest_traffic(template_name)
        if latest_traffic and from_version in latest_traffic.allocations:
            new_allocations = dict(latest_traffic.allocations)
            weight = new_allocations.pop(from_version, 0)
            new_allocations[to_version] = new_allocations.get(to_version, 0) + weight
            self.allocate_traffic(template_name, new_allocations, operator)
        
        return rollback

    def get_hit_summary(self, template_name: str) -> Dict:
        hits = self.storage.get_hit_records(template_name)
        versions = self.storage.list_versions(template_name)
        
        hit_counts = defaultdict(int)
        for hit in hits:
            hit_counts[hit.version_id] += 1
        
        version_info = []
        for v in versions:
            info = v.to_dict()
            info["hit_count"] = hit_counts.get(v.version_id, 0)
            info["content_hash"] = v.content_hash()
            version_info.append(info)
        
        latest_traffic = self.storage.get_latest_traffic(template_name)
        rollbacks = self.storage.get_rollback_events(template_name)
        
        return {
            "template_name": template_name,
            "total_versions": len(versions),
            "total_hits": len(hits),
            "total_rollbacks": len(rollbacks),
            "versions": version_info,
            "latest_traffic": latest_traffic.to_dict() if latest_traffic else None,
            "rollbacks": [r.to_dict() for r in rollbacks],
            "generated_at": datetime.now().isoformat()
        }

    def verify_version(self, template_name: str, version_id: str, expected_content: str) -> Tuple[bool, str]:
        version = self.storage.get_version(template_name, version_id)
        if not version:
            return False, "版本不存在"
        
        expected_hash = hashlib.md5(expected_content.encode()).hexdigest()[:8]
        actual_hash = version.content_hash()
        
        if expected_hash == actual_hash:
            return True, "内容匹配"
        else:
            return False, f"内容不匹配: 期望 {expected_hash}, 实际 {actual_hash}"

    def get_traffic_snapshot(self, template_name: str) -> Optional[Dict]:
        latest = self.storage.get_latest_traffic(template_name)
        if not latest:
            return None
        return latest.to_dict()
