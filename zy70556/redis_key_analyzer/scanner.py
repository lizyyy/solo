import redis
import json
import csv
from typing import List, Dict, Any, Tuple, Optional
from tqdm import tqdm
from dataclasses import dataclass, asdict
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class KeyInfo:
    key: str
    ttl: str
    ttl_seconds: Optional[int]
    memory_bytes: int
    key_type: str
    prefix: str
    has_expiry: bool
    scan_timestamp: str


@dataclass
class BadRecord:
    row_number: int
    raw_data: str
    error_reason: str
    timestamp: str


class RedisScanner:
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0, password: str = None):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.client = None

    def connect(self) -> bool:
        try:
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                decode_responses=True,
                socket_timeout=5
            )
            self.client.ping()
            logger.info(f"Successfully connected to Redis at {self.host}:{self.port}/{self.db}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            return False

    def scan_keys(self, pattern: str = "*", batch_size: int = 1000, max_keys: int = None) -> Tuple[List[KeyInfo], List[BadRecord]]:
        if not self.client:
            raise ConnectionError("Not connected to Redis")

        keys_info = []
        bad_records = []
        count = 0

        logger.info(f"Starting key scan with pattern: {pattern}, batch_size: {batch_size}")
        
        try:
            for key in tqdm(self.client.scan_iter(match=pattern, count=batch_size), desc="Scanning keys"):
                if max_keys and count >= max_keys:
                    logger.info(f"Reached max keys limit: {max_keys}")
                    break

                try:
                    key_info = self._get_key_info(key)
                    if key_info:
                        keys_info.append(key_info)
                    count += 1
                except Exception as e:
                    bad_records.append(BadRecord(
                        row_number=count + 1,
                        raw_data=key,
                        error_reason=str(e),
                        timestamp=datetime.now().isoformat()
                    ))
                    logger.warning(f"Error processing key '{key}': {e}")

        except Exception as e:
            logger.error(f"Scan failed: {e}")

        logger.info(f"Scan completed. Processed {count} keys, {len(keys_info)} successful, {len(bad_records)} errors.")
        return keys_info, bad_records

    def _get_key_info(self, key: str) -> Optional[KeyInfo]:
        ttl_seconds = self.client.ttl(key)
        memory_bytes = self.client.memory_usage(key) or 0
        key_type = self.client.type(key)
        
        prefix = self._extract_prefix(key)
        has_expiry = ttl_seconds != -1

        if ttl_seconds == -1:
            ttl_category = "PERMANENT"
        elif ttl_seconds == -2:
            ttl_category = "NOT_FOUND"
        elif ttl_seconds < 3600:
            ttl_category = "TTL_1H"
        elif ttl_seconds < 86400:
            ttl_category = "TTL_1D"
        elif ttl_seconds < 604800:
            ttl_category = "TTL_1W"
        elif ttl_seconds < 2592000:
            ttl_category = "TTL_1M"
        else:
            ttl_category = "TTL_LONG"

        return KeyInfo(
            key=key,
            ttl=ttl_category,
            ttl_seconds=ttl_seconds if ttl_seconds > 0 else None,
            memory_bytes=memory_bytes,
            key_type=key_type,
            prefix=prefix,
            has_expiry=has_expiry,
            scan_timestamp=datetime.now().isoformat()
        )

    def _extract_prefix(self, key: str, delimiter: str = ":", max_depth: int = 2) -> str:
        parts = key.split(delimiter)
        if len(parts) <= max_depth:
            return delimiter.join(parts[:-1]) if len(parts) > 1 else parts[0]
        return delimiter.join(parts[:max_depth])

    def load_from_file(self, file_path: str) -> Tuple[List[KeyInfo], List[BadRecord]]:
        keys_info = []
        bad_records = []

        logger.info(f"Loading keys from file: {file_path}")
        
        try:
            if file_path.endswith('.json'):
                with open(file_path, 'r') as f:
                    data = json.load(f)
                    for idx, item in enumerate(tqdm(data, desc="Loading JSON")):
                        try:
                            key_info = KeyInfo(
                                key=item.get('key', ''),
                                ttl=item.get('ttl', 'UNKNOWN'),
                                ttl_seconds=item.get('ttl_seconds'),
                                memory_bytes=item.get('memory_bytes', 0),
                                key_type=item.get('key_type', 'unknown'),
                                prefix=item.get('prefix', self._extract_prefix(item.get('key', ''))),
                                has_expiry=item.get('has_expiry', False),
                                scan_timestamp=item.get('scan_timestamp', datetime.now().isoformat())
                            )
                            keys_info.append(key_info)
                        except Exception as e:
                            bad_records.append(BadRecord(
                                row_number=idx + 1,
                                raw_data=str(item),
                                error_reason=str(e),
                                timestamp=datetime.now().isoformat()
                            ))
            elif file_path.endswith('.csv'):
                with open(file_path, 'r', newline='', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for idx, row in enumerate(tqdm(reader, desc="Loading CSV")):
                        try:
                            ttl_sec = int(row['ttl_seconds']) if row.get('ttl_seconds') and row['ttl_seconds'] else None
                            key_info = KeyInfo(
                                key=row.get('key', ''),
                                ttl=row.get('ttl', 'UNKNOWN'),
                                ttl_seconds=ttl_sec,
                                memory_bytes=int(row.get('memory_bytes', 0)),
                                key_type=row.get('key_type', 'unknown'),
                                prefix=row.get('prefix', self._extract_prefix(row.get('key', ''))),
                                has_expiry=row.get('has_expiry', 'False').lower() == 'true',
                                scan_timestamp=row.get('scan_timestamp', datetime.now().isoformat())
                            )
                            keys_info.append(key_info)
                        except Exception as e:
                            bad_records.append(BadRecord(
                                row_number=idx + 2,
                                raw_data=str(row),
                                error_reason=str(e),
                                timestamp=datetime.now().isoformat()
                            ))
            else:
                raise ValueError(f"Unsupported file format: {file_path}")

        except Exception as e:
            logger.error(f"Failed to load file: {e}")
            raise

        logger.info(f"Loaded {len(keys_info)} keys, {len(bad_records)} bad records from {file_path}")
        return keys_info, bad_records
