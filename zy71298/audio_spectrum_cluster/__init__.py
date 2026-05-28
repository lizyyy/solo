"""音乐音频片段谱聚类系统
用于音乐技术课的音频片段自动分组，方便学生比较不同演奏版本。
"""

__version__ = "1.0.0"

from .models import (
    AudioSegment,
    SpectralFeatures,
    ClusteringResult,
    ClusteringReport,
    AnomalyReport,
    HistoryRecord,
    OperationType,
    HistoryManager
)

try:
    from .feature_extractor import FeatureExtractor
except ImportError:
    pass

try:
    from .spectral_clustering import AudioSpectralClustering
except ImportError:
    pass

try:
    from .visualizer import ClusterVisualizer
except ImportError:
    pass

try:
    from .exporter import DataExporter
except ImportError:
    pass

try:
    from .controller import AudioClusteringController
except ImportError:
    pass

try:
    from .web_app import create_app
except ImportError:
    pass
