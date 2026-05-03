import os
from dataclasses import dataclass
from typing import List


@dataclass
class ArchiveConfig:
    PHOTO_EXTENSIONS: List[str] = None
    CSV_EXTENSION: str = '.csv'
    GPX_EXTENSION: str = '.gpx'
    TEXT_EXTENSIONS: List[str] = None
    
    ARCHIVE_ROOT: str = None
    REVIEW_FILE: str = 'review.json'
    MANIFEST_FILE: str = 'manifest.json'
    ROLLBACK_LOG: str = 'rollback_log.json'
    
    TIME_TOLERANCE_MINUTES: int = 30
    DEPTH_TOLERANCE: float = 0.5
    LOCATION_TOLERANCE_METERS: float = 100.0
    
    DATE_FORMAT: str = '%Y%m%d'
    
    def __init__(self):
        self.PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tiff', '.tif']
        self.TEXT_EXTENSIONS = ['.txt', '.md']
        self.ARCHIVE_ROOT = os.path.join(os.getcwd(), 'archive')


config = ArchiveConfig()
