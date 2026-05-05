import yaml
import json
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from app.models import Node, Slot, Request, SlotEvent
from app.utils.redis_slot import key_slot
from app.config import settings


class DataImporter:
    def __init__(self, db: Session):
        self.db = db

    def import_nodes_yaml(self, yaml_content: str) -> int:
        data = yaml.safe_load(yaml_content)
        nodes = data.get("nodes", []) if isinstance(data, dict) else []
        
        count = 0
        for node_data in nodes:
            node = Node(
                node_id=node_data.get("node_id", str(uuid.uuid4())),
                host=node_data.get("host", "127.0.0.1"),
                port=node_data.get("port", 6379),
                role=node_data.get("role", "master"),
                master_id=node_data.get("master_id"),
                state=node_data.get("state", "connected"),
                is_alive=node_data.get("is_alive", True)
            )
            self.db.add(node)
            count += 1
        
        self.db.commit()
        return count

    def import_slot_events_jsonl(self, jsonl_content: str) -> int:
        count = 0
        for line in jsonl_content.strip().split("\n"):
            if not line.strip():
                continue
            event_data = json.loads(line)
            
            timestamp_str = event_data.get("timestamp")
            if isinstance(timestamp_str, str):
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            else:
                timestamp = datetime.utcnow()
            
            slot_number = event_data.get("slot")
            if slot_number is None:
                slot_number = event_data.get("slot_number")
            
            event = SlotEvent(
                event_type=event_data.get("type", event_data.get("event_type", "unknown")),
                slot_number=slot_number,
                from_node_id=event_data.get("from_node", event_data.get("from_node_id")),
                to_node_id=event_data.get("to_node", event_data.get("to_node_id")),
                timestamp=timestamp,
                original_data=event_data
            )
            self.db.add(event)
            
            self._apply_slot_event(event_data)
            count += 1
        
        self.db.commit()
        return count

    def import_requests_jsonl(self, jsonl_content: str) -> int:
        count = 0
        for line in jsonl_content.strip().split("\n"):
            if not line.strip():
                continue
            req_data = json.loads(line)
            
            timestamp_str = req_data.get("timestamp")
            if isinstance(timestamp_str, str):
                timestamp = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
            else:
                timestamp = datetime.utcnow()
            
            key = req_data.get("key")
            key_slot_value = req_data.get("key_slot")
            if key_slot_value is None and key:
                key_slot_value = key_slot(key)
            
            command = req_data.get("command", "").upper()
            is_read = command in ["GET", "HGET", "ZRANGE", "SMEMBERS", "LRANGE", "MGET", "PING", "INFO", "HELLO", "SCAN", "SSCAN", "HSCAN", "ZSCAN"]
            is_write = command in ["SET", "HSET", "ZADD", "SADD", "LPUSH", "RPUSH", "DEL", "INCR", "DECR", "APPEND", "MSET", "EXPIRE", "PERSIST", "RENAME"]
            is_lua = command in ["EVAL", "EVALSHA", "SCRIPT"]
            is_transaction = command in ["MULTI", "EXEC", "WATCH", "UNWATCH", "DISCARD"]
            
            request = Request(
                request_id=req_data.get("request_id", str(uuid.uuid4())),
                command=command,
                key=key,
                key_slot=key_slot_value,
                is_read=is_read,
                is_write=is_write,
                is_lua=is_lua,
                is_transaction=is_transaction,
                timestamp=timestamp,
                original_data=req_data
            )
            self.db.add(request)
            count += 1
        
        self.db.commit()
        return count

    def _apply_slot_event(self, event_data: Dict[str, Any]):
        event_type = event_data.get("type", event_data.get("event_type", "")).lower()
        slot_number = event_data.get("slot") or event_data.get("slot_number")
        from_node = event_data.get("from_node") or event_data.get("from_node_id")
        to_node = event_data.get("to_node") or event_data.get("to_node_id")
        
        if slot_number is None:
            return
        
        slot = self.db.query(Slot).filter(Slot.slot_number == slot_number).first()
        
        if not slot:
            slot = Slot(slot_number=slot_number)
            self.db.add(slot)
        
        if event_type == "migrating":
            slot.state = "migrating"
            slot.is_migrating = True
            slot.migrating_node_id = from_node
            slot.importing_node_id = to_node
        elif event_type == "importing":
            slot.state = "importing"
            slot.is_importing = True
            slot.migrating_node_id = from_node
            slot.importing_node_id = to_node
        elif event_type == "migrated" or event_type == "stable":
            slot.state = "stable"
            slot.is_migrating = False
            slot.is_importing = False
            slot.owner_node_id = to_node
            slot.migrating_node_id = None
            slot.importing_node_id = None
        
        self.db.flush()

    def clear_all_data(self):
        self.db.query(Request).delete()
        self.db.query(SlotEvent).delete()
        self.db.query(Slot).delete()
        self.db.query(Node).delete()
        self.db.commit()
