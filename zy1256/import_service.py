import csv
import json
import os
import yaml
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
import aiofiles
from fastapi import UploadFile


class DataImportService:
    VALID_DATA_TYPES = {"string", "hash", "list", "set", "zset", "stream"}
    
    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
    
    async def save_uploaded_file(self, file: UploadFile, session_id: int, file_type: str) -> str:
        file_ext = self._get_file_extension(file_type)
        filename = f"session_{session_id}_{file_type}{file_ext}"
        filepath = self.upload_dir / filename
        
        async with aiofiles.open(filepath, "wb") as f:
            content = await file.read()
            await f.write(content)
        
        return str(filepath)
    
    def _get_file_extension(self, file_type: str) -> str:
        extensions = {
            "keys": ".csv",
            "events": ".jsonl",
            "rules": ".yaml",
        }
        return extensions.get(file_type, ".dat")
    
    async def parse_keys_csv(self, filepath: str) -> List[Dict[str, Any]]:
        keys = []
        
        async with aiofiles.open(filepath, "r", encoding="utf-8") as f:
            content = await f.read()
            reader = csv.DictReader(content.splitlines())
            
            for row in reader:
                key_data = self._parse_key_row(row)
                if key_data:
                    keys.append(key_data)
        
        return keys
    
    def _parse_key_row(self, row: Dict[str, str]) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        
        key_name = self._get_value(row, ["key", "key_name", "name"])
        if not key_name:
            return None
        
        data_type = self._get_value(row, ["type", "data_type", "datatype"])
        data_type = (data_type or "string").lower()
        if data_type not in self.VALID_DATA_TYPES:
            data_type = "string"
        
        ttl = self._parse_int(self._get_value(row, ["ttl", "expire", "expire_seconds"]))
        memory_bytes = self._parse_int(self._get_value(row, ["memory", "memory_bytes", "size"]))
        
        result = {
            "key_name": key_name.strip(),
            "data_type": data_type,
            "ttl": ttl,
            "memory_bytes": memory_bytes,
            "value_size": self._parse_int(self._get_value(row, ["value_size", "string_size", "strlen"])),
            "field_count": self._parse_int(self._get_value(row, ["field_count", "hash_fields", "hlen"])),
            "list_length": self._parse_int(self._get_value(row, ["list_length", "llen", "length"])),
            "set_cardinality": self._parse_int(self._get_value(row, ["set_cardinality", "scard", "set_size"])),
            "zset_cardinality": self._parse_int(self._get_value(row, ["zset_cardinality", "zcard", "zset_size"])),
            "stream_length": self._parse_int(self._get_value(row, ["stream_length", "xlen", "stream_size"])),
            "tags": self._get_value(row, ["tags", "tag", "category"]),
            "description": self._get_value(row, ["description", "desc", "comment", "note"]),
        }
        
        return result
    
    def _get_value(self, row: Dict[str, str], possible_keys: List[str]) -> Optional[str]:
        for key in possible_keys:
            if key in row and row[key].strip():
                return row[key].strip()
        return None
    
    def _parse_int(self, value: Optional[str]) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value.strip())
        except (ValueError, AttributeError):
            return None
    
    async def parse_events_jsonl(self, filepath: str) -> List[Dict[str, Any]]:
        events = []
        
        async with aiofiles.open(filepath, "r", encoding="utf-8") as f:
            async for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                try:
                    event = json.loads(line)
                    parsed_event = self._parse_event(event)
                    if parsed_event:
                        events.append(parsed_event)
                except json.JSONDecodeError:
                    continue
        
        return events
    
    def _parse_event(self, event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not event:
            return None
        
        key_name = event.get("key") or event.get("key_name")
        if not key_name:
            return None
        
        timestamp_str = event.get("timestamp") or event.get("time") or event.get("ts")
        timestamp = self._parse_timestamp(timestamp_str)
        if not timestamp:
            timestamp = datetime.utcnow()
        
        command = (event.get("command") or event.get("cmd") or "UNKNOWN").upper()
        
        read_write = (event.get("read_write") or event.get("type") or "read").lower()
        if read_write not in ["read", "write", "both"]:
            read_write = self._detect_read_write(command)
        
        return {
            "timestamp": timestamp,
            "key_name": key_name.strip(),
            "command": command,
            "read_write": read_write,
            "latency_ms": self._parse_float(event.get("latency") or event.get("latency_ms")),
            "client_id": event.get("client_id") or event.get("client"),
            "database": self._parse_int(str(event.get("database") or event.get("db") or 0)),
            "tags": event.get("tags"),
        }
    
    def _parse_timestamp(self, value: Any) -> Optional[datetime]:
        if value is None:
            return None
        
        if isinstance(value, datetime):
            return value
        
        if isinstance(value, (int, float)):
            try:
                if value > 1e12:
                    return datetime.fromtimestamp(value / 1000)
                return datetime.fromtimestamp(value)
            except (ValueError, OSError):
                return None
        
        if isinstance(value, str):
            formats = [
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M:%S.%f",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(value.strip(), fmt)
                except ValueError:
                    continue
            
            try:
                ts = float(value.strip())
                if ts > 1e12:
                    return datetime.fromtimestamp(ts / 1000)
                return datetime.fromtimestamp(ts)
            except ValueError:
                pass
        
        return None
    
    def _parse_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def _parse_int(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    def _detect_read_write(self, command: str) -> str:
        read_commands = {
            "GET", "HGET", "HGETALL", "HMGET", "LINDEX", "LRANGE", "LLEN",
            "SMEMBERS", "SISMEMBER", "SCARD", "ZRANGE", "ZREVRANGE", "ZRANK",
            "ZREVRANK", "ZSCORE", "ZCARD", "XRANGE", "XREVRANGE", "XLEN",
            "TYPE", "TTL", "PTTL", "EXISTS", "MGET", "STRLEN"
        }
        
        write_commands = {
            "SET", "SETNX", "SETEX", "PSETEX", "INCR", "INCRBY", "INCRBYFLOAT",
            "DECR", "DECRBY", "APPEND", "HSET", "HSETNX", "HMSET", "HINCRBY",
            "HINCRBYFLOAT", "HDEL", "LPUSH", "RPUSH", "LPUSHX", "RPUSHX",
            "LPOP", "RPOP", "LREM", "LSET", "LTRIM", "SADD", "SREM", "SPOP",
            "SMOVE", "ZADD", "ZREM", "ZINCRBY", "ZREMRANGEBYRANK",
            "ZREMRANGEBYSCORE", "XADD", "XDEL", "XTRIM", "DEL", "UNLINK",
            "EXPIRE", "PEXPIRE", "EXPIREAT", "PEXPIREAT", "PERSIST", "RENAME",
            "RENAMENX", "MSET", "MSETNX"
        }
        
        cmd_upper = command.upper().split()[0] if command else ""
        
        if cmd_upper in write_commands:
            return "write"
        elif cmd_upper in read_commands:
            return "read"
        
        return "read"
    
    async def parse_rules_yaml(self, filepath: str) -> Dict[str, Any]:
        async with aiofiles.open(filepath, "r", encoding="utf-8") as f:
            content = await f.read()
        
        try:
            rules = yaml.safe_load(content)
            return self._normalize_rules(rules)
        except yaml.YAMLError:
            return {}
    
    def _normalize_rules(self, rules: Any) -> Dict[str, Any]:
        if not rules or not isinstance(rules, dict):
            return {}
        
        normalized = {}
        
        if "scenarios" in rules:
            for scenario_name, scenario_config in rules["scenarios"].items():
                if isinstance(scenario_config, dict):
                    normalized[scenario_name.lower()] = {
                        "scenario": scenario_name.lower(),
                        "recommended_types": [
                            t.lower() for t in scenario_config.get("recommended_types", [])
                            if isinstance(t, str)
                        ],
                        "anti_patterns": [
                            t.lower() for t in scenario_config.get("anti_patterns", [])
                            if isinstance(t, str)
                        ],
                        "memory_considerations": scenario_config.get("memory_considerations", ""),
                        "performance_notes": scenario_config.get("performance_notes", ""),
                    }
        
        if not normalized:
            for key, value in rules.items():
                if isinstance(value, dict) and "recommended_types" in value:
                    normalized[key.lower()] = {
                        "scenario": key.lower(),
                        "recommended_types": [
                            t.lower() for t in value.get("recommended_types", [])
                            if isinstance(t, str)
                        ],
                        "anti_patterns": [
                            t.lower() for t in value.get("anti_patterns", [])
                            if isinstance(t, str)
                        ],
                        "memory_considerations": value.get("memory_considerations", ""),
                        "performance_notes": value.get("performance_notes", ""),
                    }
        
        return normalized
    
    def validate_keys_csv_format(self, headers: List[str]) -> Tuple[bool, List[str]]:
        required_headers = ["key", "type"]
        optional_headers = [
            "ttl", "memory", "value_size", "field_count", "list_length",
            "set_cardinality", "zset_cardinality", "stream_length", "tags", "description"
        ]
        
        header_lower = [h.strip().lower() for h in headers]
        
        missing_required = []
        for req in required_headers:
            if req not in header_lower and req.replace("_", "") not in header_lower:
                missing_required.append(req)
        
        if missing_required:
            return False, [f"Missing required header: {h}" for h in missing_required]
        
        warnings = []
        found_optional = [h for h in optional_headers if h in header_lower]
        if not found_optional:
            warnings.append("No optional metadata headers found. Consider adding: ttl, memory, value_size, etc.")
        
        return True, warnings
    
    def validate_events_jsonl_sample(self, sample_lines: List[str]) -> Tuple[bool, List[str]]:
        errors = []
        warnings = []
        
        for i, line in enumerate(sample_lines[:10]):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            
            try:
                data = json.loads(line)
                
                if not isinstance(data, dict):
                    errors.append(f"Line {i+1}: Expected object, got {type(data).__name__}")
                    continue
                
                if "key" not in data and "key_name" not in data:
                    errors.append(f"Line {i+1}: Missing 'key' or 'key_name' field")
                
                if "command" not in data and "cmd" not in data:
                    warnings.append(f"Line {i+1}: Missing 'command' field, will use 'UNKNOWN'")
                
            except json.JSONDecodeError as e:
                errors.append(f"Line {i+1}: Invalid JSON: {str(e)}")
        
        return len(errors) == 0, errors if errors else warnings
