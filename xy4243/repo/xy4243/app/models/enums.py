from enum import Enum, auto


class HandoverStatus(Enum):
    PENDING = auto()
    READY = auto()
    IN_USE = auto()
    RETURNED = auto()
    VERIFIED = auto()
    LOST = auto()
    MISSING = auto()


class DangerLevel(Enum):
    SAFE = auto()
    LOW = auto()
    MEDIUM = auto()
    HIGH = auto()
    CRITICAL = auto()


class CheckStatus(Enum):
    OK = auto()
    WARNING = auto()
    ERROR = auto()
    UNKNOWN = auto()
