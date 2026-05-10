from dataclasses import dataclass
from pathlib import Path
@dataclass
class Config:
    DATA_DIR: Path = Path("./data")
    HISTORY_DIR: Path = Path("./data/history")
    REPORTS_DIR: Path = Path("./data/reports")
    SAMPLES_DIR: Path = Path("./samples")
    
    DETOUR_DISTANCE_THRESHOLD: float = 1.5
    DETOUR_TIME_RATIO: float = 1.4
    STATIONARY_TIME_THRESHOLD: int = 300
    
    MATCH_TIME_WINDOW: int = 600
    
    def __post_init__(self):
        for path in [self.DATA_DIR, self.HISTORY_DIR, self.REPORTS_DIR, self.SAMPLES_DIR]:
            path.mkdir(parents=True, exist_ok=True)
config = Config()
