"""
JVM Options data model
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any, List


class GCCollector(Enum):
    SERIAL = "Serial"
    PARALLEL = "Parallel"
    CMS = "CMS"
    G1 = "G1"
    ZGC = "ZGC"
    SHENANDOAH = "Shenandoah"
    UNKNOWN = "Unknown"


@dataclass
class JVMOptions:
    gc_collector: GCCollector = GCCollector.UNKNOWN
    
    xms_bytes: int = 0
    xmx_bytes: int = 0
    
    max_gc_pause_millis: Optional[int] = None
    gc_time_ratio: Optional[int] = None
    
    new_ratio: Optional[int] = None
    max_new_size_bytes: Optional[int] = None
    new_size_bytes: Optional[int] = None
    survivor_ratio: Optional[int] = None
    
    g1_heap_region_size_bytes: Optional[int] = None
    g1_max_new_size_percent: Optional[int] = None
    g1_new_size_percent: Optional[int] = None
    g1_mixed_gc_count_target: Optional[int] = None
    g1_reserve_percent: Optional[int] = None
    g1_ihop_percent: Optional[int] = None
    g1_conc_refine_threads: Optional[int] = None
    
    metaspace_size_bytes: Optional[int] = None
    max_metaspace_size_bytes: Optional[int] = None
    
    parallel_gc_threads: Optional[int] = None
    conc_gc_threads: Optional[int] = None
    
    use_tlab: bool = True
    tlab_size_bytes: Optional[int] = None
    
    explicit_gc_invokes_concurrent: bool = False
    disable_explicit_gc: bool = False
    
    container_options: Dict[str, Any] = field(default_factory=dict)
    
    raw_options: List[str] = field(default_factory=list)
    raw_yaml: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def is_g1(self) -> bool:
        return self.gc_collector == GCCollector.G1
    
    @property
    def is_zgc(self) -> bool:
        return self.gc_collector == GCCollector.ZGC
    
    @property
    def is_shenandoah(self) -> bool:
        return self.gc_collector == GCCollector.SHENANDOAH
    
    @property
    def is_concurrent_collector(self) -> bool:
        return self.is_g1 or self.is_zgc or self.is_shenandoah
    
    @property
    def heap_is_fixed(self) -> bool:
        return self.xms_bytes == self.xmx_bytes and self.xms_bytes > 0
    
    def validate(self) -> List[str]:
        errors = []
        
        if self.xmx_bytes > 0 and self.xms_bytes > self.xmx_bytes:
            errors.append("-Xms cannot be larger than -Xmx")
        
        if self.gc_collector == GCCollector.ZGC:
            if self.max_gc_pause_millis is not None and self.max_gc_pause_millis < 1:
                errors.append("ZGC MaxGCPauseMillis should be positive")
        
        if self.is_g1:
            if self.g1_heap_region_size_bytes is not None:
                if self.g1_heap_region_size_bytes not in [1024**2 * i for i in [1, 2, 4, 8, 16, 32]]:
                    errors.append("G1 region size must be 1, 2, 4, 8, 16, or 32 MB")
        
        return errors
    
    def get_recommended_region_size(self, heap_bytes: int) -> int:
        if heap_bytes <= 4 * 1024**3:
            return 1 * 1024**2
        elif heap_bytes <= 8 * 1024**3:
            return 2 * 1024**2
        elif heap_bytes <= 16 * 1024**3:
            return 4 * 1024**2
        elif heap_bytes <= 32 * 1024**3:
            return 8 * 1024**2
        elif heap_bytes <= 64 * 1024**3:
            return 16 * 1024**2
        else:
            return 32 * 1024**2
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "gc_collector": self.gc_collector.value,
            "xms_bytes": self.xms_bytes,
            "xmx_bytes": self.xmx_bytes,
            "xms_gb": round(self.xms_bytes / (1024**3), 2),
            "xmx_gb": round(self.xmx_bytes / (1024**3), 2),
            "max_gc_pause_millis": self.max_gc_pause_millis,
            "gc_time_ratio": self.gc_time_ratio,
            "new_ratio": self.new_ratio,
            "survivor_ratio": self.survivor_ratio,
            "g1_heap_region_size_bytes": self.g1_heap_region_size_bytes,
            "g1_heap_region_size_mb": round(self.g1_heap_region_size_bytes / (1024**2), 2) if self.g1_heap_region_size_bytes else None,
            "g1_max_new_size_percent": self.g1_max_new_size_percent,
            "g1_ihop_percent": self.g1_ihop_percent,
            "metaspace_size_bytes": self.metaspace_size_bytes,
            "max_metaspace_size_bytes": self.max_metaspace_size_bytes,
            "parallel_gc_threads": self.parallel_gc_threads,
            "conc_gc_threads": self.conc_gc_threads,
            "is_g1": self.is_g1,
            "is_zgc": self.is_zgc,
            "is_concurrent_collector": self.is_concurrent_collector,
            "heap_is_fixed": self.heap_is_fixed,
            "validation_errors": self.validate(),
        }
