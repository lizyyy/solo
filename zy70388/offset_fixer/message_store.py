from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .models import Message, PartitionInfo, OffsetStatus


class MessageStore:
    def __init__(self):
        self._topics: Dict[str, Dict[int, List[Message]]] = {}
        
    def add_topic(self, topic: str, partitions: int):
        if topic not in self._topics:
            self._topics[topic] = {i: [] for i in range(partitions)}
            
    def add_message(self, message: Message):
        if message.topic not in self._topics:
            self._topics[message.topic] = {message.partition: []}
        if message.partition not in self._topics[message.topic]:
            self._topics[message.topic][message.partition] = []
        self._topics[message.topic][message.partition].append(message)
        self._topics[message.topic][message.partition].sort(key=lambda m: m.offset)
        
    def get_messages(self, topic: str, partition: int, 
                    start_offset: Optional[int] = None, 
                    end_offset: Optional[int] = None) -> List[Message]:
        if topic not in self._topics or partition not in self._topics[topic]:
            return []
        
        messages = self._topics[topic][partition]
        if start_offset is None and end_offset is None:
            return messages
        
        result = []
        for msg in messages:
            if (start_offset is None or msg.offset >= start_offset) and \
               (end_offset is None or msg.offset <= end_offset):
                result.append(msg)
        return result
        
    def get_partition_info(self, topic: str, partition: int, current_offset: int) -> Optional[PartitionInfo]:
        if topic not in self._topics or partition not in self._topics[topic]:
            return None
            
        messages = self._topics[topic][partition]
        if not messages:
            return PartitionInfo(
                topic=topic,
                partition=partition,
                current_offset=current_offset,
                earliest_offset=0,
                latest_offset=0,
                messages=[]
            )
            
        earliest = min(m.offset for m in messages)
        latest = max(m.offset for m in messages)
        
        return PartitionInfo(
            topic=topic,
            partition=partition,
            current_offset=current_offset,
            earliest_offset=earliest,
            latest_offset=latest,
            messages=messages
        )
        
    def get_messages_by_time_range(self, topic: str, partition: int,
                                   start_time: datetime, end_time: datetime) -> List[Message]:
        if topic not in self._topics or partition not in self._topics[topic]:
            return []
            
        messages = self._topics[topic][partition]
        return [
            msg for msg in messages
            if start_time <= msg.timestamp <= end_time
        ]
        
    def get_offset_by_time(self, topic: str, partition: int, timestamp: datetime) -> Optional[int]:
        if topic not in self._topics or partition not in self._topics[topic]:
            return None
            
        messages = self._topics[topic][partition]
        for msg in messages:
            if msg.timestamp >= timestamp:
                return msg.offset
        return max(m.offset for m in messages) if messages else None
        
    def get_topics(self) -> List[str]:
        return list(self._topics.keys())
        
    def get_partitions(self, topic: str) -> List[int]:
        if topic not in self._topics:
            return []
        return list(self._topics[topic].keys())
