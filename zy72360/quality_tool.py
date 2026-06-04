from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum
import uuid

class RecordStatus(Enum):
    NORMAL = "正常"
    CONFLICT = "冲突待确认"
    REJECTED = "已驳回"
    CONFIRMED = "已确认"
    PENDING_REVIEW = "待安全员复核"
