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
            logger.info("Successfully connected to Redis")
            return True
        except Exception as e:
            logger.error("Failed to connect to Redis: %s", e)
            return False


