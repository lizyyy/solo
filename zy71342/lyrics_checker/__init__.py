from .rhyme import RhymeChecker
from .word_count import WordCounter
from .repetition import RepetitionDetector
from .polyphone import PolyphoneHandler
from .report import ReportGenerator
from .version import VersionManager
from .checker import LyricsChecker

__version__ = "1.0.0"
__all__ = [
    "RhymeChecker",
    "WordCounter",
    "RepetitionDetector",
    "PolyphoneHandler",
    "ReportGenerator",
    "VersionManager",
    "LyricsChecker",
]
