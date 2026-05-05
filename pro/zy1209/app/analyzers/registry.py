from typing import Dict, Type, List, Optional
from .base import BaseAnalyzer, AnalysisResult
from ..models.enums import AnalysisType


class AnalyzerRegistry:
    _analyzers: Dict[AnalysisType, Type[BaseAnalyzer]] = {}
    
    @classmethod
    def register(cls, analyzer_type: AnalysisType, analyzer_class: Type[BaseAnalyzer]):
        cls._analyzers[analyzer_type] = analyzer_class
    
    @classmethod
    def get(cls, analyzer_type: AnalysisType) -> Optional[Type[BaseAnalyzer]]:
        return cls._analyzers.get(analyzer_type)
    
    @classmethod
    def get_all(cls) -> Dict[AnalysisType, Type[BaseAnalyzer]]:
        return cls._analyzers.copy()
    
    @classmethod
    def get_available_types(cls) -> List[AnalysisType]:
        return list(cls._analyzers.keys())


def register_all_analyzers():
    from .connection_pool import ConnectionPoolAnalyzer
    from .batch_write import BatchWriteAnalyzer
    from .index_analysis import IndexAnalysisAnalyzer
    from .slow_sql import SlowSQLAnalyzer
    from .read_write_split import ReadWriteSplitAnalyzer
    from .sharding_hotspot import ShardingHotspotAnalyzer
    
    AnalyzerRegistry.register(AnalysisType.CONNECTION_POOL, ConnectionPoolAnalyzer)
    AnalyzerRegistry.register(AnalysisType.BATCH_WRITE, BatchWriteAnalyzer)
    AnalyzerRegistry.register(AnalysisType.INDEX_ANALYSIS, IndexAnalysisAnalyzer)
    AnalyzerRegistry.register(AnalysisType.SLOW_SQL, SlowSQLAnalyzer)
    AnalyzerRegistry.register(AnalysisType.READ_WRITE_SPLIT, ReadWriteSplitAnalyzer)
    AnalyzerRegistry.register(AnalysisType.SHARDING_HOTSPOT, ShardingHotspotAnalyzer)


def get_analyzer(analyzer_type: AnalysisType, config: dict = None) -> Optional[BaseAnalyzer]:
    analyzer_class = AnalyzerRegistry.get(analyzer_type)
    if analyzer_class:
        return analyzer_class(config=config)
    return None


def get_all_analyzers(config: dict = None) -> Dict[AnalysisType, BaseAnalyzer]:
    return {
        analysis_type: analyzer_class(config=config)
        for analysis_type, analyzer_class in AnalyzerRegistry.get_all().items()
    }


register_all_analyzers()
