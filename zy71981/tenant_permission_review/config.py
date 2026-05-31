import os
from dataclasses import dataclass


@dataclass
class Config:
    DB_PATH: str = os.environ.get(
        "REVIEW_DB_PATH",
        os.path.join(os.path.dirname(__file__), "data", "review.db")
    )
    LOG_DIR: str = os.environ.get(
        "REVIEW_LOG_DIR",
        os.path.join(os.path.dirname(__file__), "data", "logs")
    )
    MAX_EVIDENCE_AGE_DAYS: int = 180

    def __post_init__(self):
        os.makedirs(os.path.dirname(self.DB_PATH), exist_ok=True)
        os.makedirs(self.LOG_DIR, exist_ok=True)
