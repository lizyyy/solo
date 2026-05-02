from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from track_cleaner.models.track import Track


class TrackParser(ABC):
    
    @classmethod
    @abstractmethod
    def supported_extensions(cls) -> list:
        pass
    
    @abstractmethod
    def parse(self, file_path: Path) -> Track:
        pass
    
    @classmethod
    def can_parse(cls, file_path: Path) -> bool:
        suffix = file_path.suffix.lower()
        return suffix in cls.supported_extensions()
