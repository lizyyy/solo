"""
JVM Options YAML Parser
"""

import yaml
from typing import Dict, Any, Optional, List
import re
import logging

from ..models.jvm_options import JVMOptions, GCCollector

logger = logging.getLogger(__name__)


class JVMOptionsParser:
    def __init__(self):
        self.options: JVMOptions = JVMOptions()
        self.raw_options: List[str] = []
    
    def parse_file(self, filepath: str) -> JVMOptions:
        self.options = JVMOptions()
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        self.options.raw_yaml = data or {}
        
        if "jvmOptions" in data:
            self.raw_options = data["jvmOptions"]
            self.options.raw_options = self.raw_options
        elif "options" in data:
            self.raw_options = data["options"]
            self.options.raw_options = self.raw_options
        elif isinstance(data, list):
            self.raw_options = data
            self.options.raw_options = self.raw_options
        
        self._parse_options()
        return self.options
    
    def _parse_options(self):
        for option in self.raw_options:
            self._parse_single_option(option)
        
        if self.options.gc_collector == GCCollector.UNKNOWN:
            self.options.gc_collector = GCCollector.G1
        
        if self.options.xms_bytes == 0 and self.options.xmx_bytes > 0:
            self.options.xms_bytes = self.options.xmx_bytes
        
        if self.options.xmx_bytes == 0 and self.options.xms_bytes > 0:
            self.options.xmx_bytes = self.options.xms_bytes
    
    def _parse_single_option(self, option: str):
        option = option.strip()
        
        if option.startswith("-Xms"):
            self.options.xms_bytes = self._parse_memory_value(option[4:])
        
        elif option.startswith("-Xmx"):
            self.options.xmx_bytes = self._parse_memory_value(option[4:])
        
        elif option.startswith("-Xmn"):
            value = self._parse_memory_value(option[4:])
            self.options.new_size_bytes = value
            self.options.max_new_size_bytes = value
        
        elif option.startswith("-XX:NewRatio="):
            try:
                self.options.new_ratio = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:MaxNewSize="):
            self.options.max_new_size_bytes = self._parse_memory_value(option.split('=')[1])
        
        elif option.startswith("-XX:NewSize="):
            self.options.new_size_bytes = self._parse_memory_value(option.split('=')[1])
        
        elif option.startswith("-XX:SurvivorRatio="):
            try:
                self.options.survivor_ratio = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:MaxGCPauseMillis="):
            try:
                self.options.max_gc_pause_millis = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:GCTimeRatio="):
            try:
                self.options.gc_time_ratio = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:G1HeapRegionSize="):
            self.options.g1_heap_region_size_bytes = self._parse_memory_value(option.split('=')[1])
        
        elif option.startswith("-XX:G1MaxNewSizePercent="):
            try:
                self.options.g1_max_new_size_percent = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:G1NewSizePercent="):
            try:
                self.options.g1_new_size_percent = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:G1MixedGCCountTarget="):
            try:
                self.options.g1_mixed_gc_count_target = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:G1ReservePercent="):
            try:
                self.options.g1_reserve_percent = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:InitiatingHeapOccupancyPercent="):
            try:
                self.options.g1_ihop_percent = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:G1ConcRefinementThreads="):
            try:
                self.options.g1_conc_refine_threads = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:MetaspaceSize="):
            self.options.metaspace_size_bytes = self._parse_memory_value(option.split('=')[1])
        
        elif option.startswith("-XX:MaxMetaspaceSize="):
            self.options.max_metaspace_size_bytes = self._parse_memory_value(option.split('=')[1])
        
        elif option.startswith("-XX:ParallelGCThreads="):
            try:
                self.options.parallel_gc_threads = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option.startswith("-XX:ConcGCThreads="):
            try:
                self.options.conc_gc_threads = int(option.split('=')[1])
            except (ValueError, IndexError):
                pass
        
        elif option == "-XX:-UseTLAB":
            self.options.use_tlab = False
        
        elif option == "-XX:+UseTLAB":
            self.options.use_tlab = True
        
        elif option.startswith("-XX:TLABSize="):
            self.options.tlab_size_bytes = self._parse_memory_value(option.split('=')[1])
        
        elif option == "-XX:+ExplicitGCInvokesConcurrent":
            self.options.explicit_gc_invokes_concurrent = True
        
        elif option == "-XX:+DisableExplicitGC":
            self.options.disable_explicit_gc = True
        
        elif option == "-XX:+UseSerialGC":
            self.options.gc_collector = GCCollector.SERIAL
        
        elif option == "-XX:+UseParallelGC" or option == "-XX:+UseParallelOldGC":
            self.options.gc_collector = GCCollector.PARALLEL
        
        elif option == "-XX:+UseConcMarkSweepGC":
            self.options.gc_collector = GCCollector.CMS
        
        elif option == "-XX:+UseG1GC":
            self.options.gc_collector = GCCollector.G1
        
        elif option == "-XX:+UseZGC":
            self.options.gc_collector = GCCollector.ZGC
        
        elif option == "-XX:+UseShenandoahGC":
            self.options.gc_collector = GCCollector.SHENANDOAH
    
    def _parse_memory_value(self, value: str) -> int:
        value = value.strip().upper()
        
        match = re.match(r'^(\d+(?:\.\d+)?)\s*([KMGTPE]?I?B?)$', value)
        if not match:
            try:
                return int(float(value))
            except ValueError:
                return 0
        
        num = float(match.group(1))
        unit = match.group(2)
        
        multipliers = {
            '': 1,
            'B': 1,
            'K': 1024,
            'KB': 1024,
            'KIB': 1024,
            'M': 1024 ** 2,
            'MB': 1024 ** 2,
            'MIB': 1024 ** 2,
            'G': 1024 ** 3,
            'GB': 1024 ** 3,
            'GIB': 1024 ** 3,
            'T': 1024 ** 4,
            'TB': 1024 ** 4,
            'TIB': 1024 ** 4,
            'P': 1024 ** 5,
            'PB': 1024 ** 5,
            'PIB': 1024 ** 5,
            'E': 1024 ** 6,
            'EB': 1024 ** 6,
            'EIB': 1024 ** 6,
        }
        
        return int(num * multipliers.get(unit, 1))
    
    def generate_recommended_options(self, base_options: JVMOptions = None) -> List[str]:
        recommendations = []
        
        opts = base_options or self.options
        
        if opts.is_g1:
            if opts.xmx_bytes > 0:
                recommended_region = opts.get_recommended_region_size(opts.xmx_bytes)
                if opts.g1_heap_region_size_bytes != recommended_region:
                    recommendations.append(
                        f"-XX:G1HeapRegionSize={recommended_region // (1024 * 1024)}m"
                    )
            
            if opts.g1_ihop_percent is None or opts.g1_ihop_percent < 40:
                recommendations.append("-XX:InitiatingHeapOccupancyPercent=45")
            
            if opts.g1_reserve_percent is None or opts.g1_reserve_percent < 15:
                recommendations.append("-XX:G1ReservePercent=15")
        
        if opts.is_zgc:
            if opts.max_gc_pause_millis is None:
                recommendations.append("-XX:MaxGCPauseMillis=200")
        
        if opts.max_metaspace_size_bytes is None:
            recommendations.append("-XX:MaxMetaspaceSize=256m")
        
        if opts.disable_explicit_gc and opts.explicit_gc_invokes_concurrent:
            recommendations.append("-XX:+ExplicitGCInvokesConcurrent")
            recommendations.append("-XX:-DisableExplicitGC")
        
        return recommendations
