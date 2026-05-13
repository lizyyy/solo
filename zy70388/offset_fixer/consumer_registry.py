from datetime import datetime
from typing import Dict, List, Optional, Set
from .models import ConsumerInfo, ConsumerRecord


class ConsumerRegistry:
    def __init__(self):
        self._consumers: Dict[str, ConsumerInfo] = {}
        self._records: List[ConsumerRecord] = []
        
    def register_consumer(self, consumer: ConsumerInfo):
        self._consumers[consumer.consumer_id] = consumer
        
    def update_consumer_heartbeat(self, consumer_id: str, heartbeat: datetime):
        if consumer_id in self._consumers:
            self._consumers[consumer_id].last_heartbeat = heartbeat
            self._consumers[consumer_id].is_online = True
            
    def mark_consumer_offline(self, consumer_id: str):
        if consumer_id in self._consumers:
            self._consumers[consumer_id].is_online = False
            
    def get_consumer(self, consumer_id: str) -> Optional[ConsumerInfo]:
        return self._consumers.get(consumer_id)
        
    def get_consumers_by_topic(self, topic: str) -> List[ConsumerInfo]:
        return [c for c in self._consumers.values() if topic in c.topics]
        
    def is_consumer_online_for_partition(self, topic: str, partition: int) -> bool:
        consumers = self.get_consumers_by_topic(topic)
        return any(c.is_online for c in consumers)
        
    def add_processed_record(self, record: ConsumerRecord):
        self._records.append(record)
        
    def get_processed_records(self, topic: Optional[str] = None, 
                             partition: Optional[int] = None,
                             consumer_id: Optional[str] = None) -> List[ConsumerRecord]:
        records = self._records
        if topic:
            records = [r for r in records if r.topic == topic]
        if partition is not None:
            records = [r for r in records if r.partition == partition]
        if consumer_id:
            records = [r for r in records if r.consumer_id == consumer_id]
        return records
        
    def get_max_processed_offset(self, topic: str, partition: int) -> Optional[int]:
        records = self.get_processed_records(topic=topic, partition=partition)
        if not records:
            return None
        return max(r.processed_offset for r in records)
        
    def get_consumers_needing_idempotent_check(self, topic: str, partition: int,
                                              target_offset: int) -> List[ConsumerInfo]:
        max_offset = self.get_max_processed_offset(topic, partition)
        if max_offset is None or target_offset >= max_offset:
            return []
            
        consumer_ids = set(
            r.consumer_id for r in self.get_processed_records(topic=topic, partition=partition)
            if r.processed_offset >= target_offset
        )
        
        return [self._consumers[cid] for cid in consumer_ids if cid in self._consumers]
        
    def get_all_consumers(self) -> List[ConsumerInfo]:
        return list(self._consumers.values())
