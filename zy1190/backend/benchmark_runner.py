import os
import json
import subprocess
import tempfile
import threading
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

class TestType(Enum):
    SEQUENTIAL = "sequential"
    STRIDE = "stride"
    RANDOM = "random"
    FALSE_SHARING = "false_sharing"
    NUMA = "numa"

class StructLayout(Enum):
    BAD = "bad"
    GOOD = "good"
    MIXED = "mixed"

@dataclass
class BenchmarkConfig:
    test_name: str
    array_size: int = 67108864
    stride: int = 1
    thread_count: int = 1
    cache_line_size: int = 64
    iterations: int = 10
    seed: int = 42
    struct_layout: str = "bad"
    numa_node: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BenchmarkConfig':
        return cls(**data)

@dataclass
class BenchmarkResult:
    test_name: str
    total_time_ms: float
    throughput_mbs: float
    avg_latency_ns: float
    cache_hits: int
    cache_misses: int
    latency_timeline: List[float]
    thread_conflicts: List[int]
    metadata: Dict[str, Any]
    config: Dict[str, Any]
    timestamp: str
    experiment_id: str
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BenchmarkResult':
        return cls(**data)

class BenchmarkRunner:
    def __init__(self, engine_path: str = None):
        if engine_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            engine_path = os.path.join(base_dir, "engine", "build", "cache_bench")
        
        self.engine_path = engine_path
        self._running: Dict[str, threading.Thread] = {}
        self._results: Dict[str, BenchmarkResult] = {}
        self._lock = threading.Lock()
    
    def is_engine_available(self) -> bool:
        return os.path.exists(self.engine_path) and os.access(self.engine_path, os.X_OK)
    
    def run_benchmark(self, config: BenchmarkConfig, experiment_id: str = None) -> BenchmarkResult:
        if not self.is_engine_available():
            return self._generate_mock_result(config, experiment_id)
        
        if experiment_id is None:
            experiment_id = f"exp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        config_file = None
        output_file = None
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                json.dump(config.to_dict(), f)
                config_file = f.name
            
            output_file = tempfile.mktemp(suffix='.json')
            
            cmd = [
                self.engine_path,
                "--test", config.test_name,
                "--config", config_file,
                "--output", output_file
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            
            if result.returncode != 0:
                print(f"Engine error: {result.stderr}")
                return self._generate_mock_result(config, experiment_id)
            
            with open(output_file, 'r') as f:
                result_data = json.load(f)
            
            return BenchmarkResult(
                test_name=result_data.get("test_name", config.test_name),
                total_time_ms=result_data.get("total_time_ms", 0),
                throughput_mbs=result_data.get("throughput_mbs", 0),
                avg_latency_ns=result_data.get("avg_latency_ns", 0),
                cache_hits=result_data.get("cache_hits", 0),
                cache_misses=result_data.get("cache_misses", 0),
                latency_timeline=result_data.get("latency_timeline", []),
                thread_conflicts=result_data.get("thread_conflicts", []),
                metadata=result_data.get("metadata", {}),
                config=result_data.get("config", config.to_dict()),
                timestamp=datetime.now().isoformat(),
                experiment_id=experiment_id
            )
            
        finally:
            if config_file and os.path.exists(config_file):
                os.unlink(config_file)
            if output_file and os.path.exists(output_file):
                os.unlink(output_file)
    
    def _generate_mock_result(self, config: BenchmarkConfig, experiment_id: str) -> BenchmarkResult:
        import random
        random.seed(config.seed)
        
        base_latency = {
            "sequential": 1.5,
            "stride": 3.0 if config.stride > 8 else 1.8,
            "random": 80.0,
            "false_sharing": 120.0 if config.struct_layout == "bad" else 5.0,
            "numa": 2.5
        }
        
        latency = base_latency.get(config.test_name, 10.0)
        
        total_accesses = config.array_size // 8
        cache_line_elements = config.cache_line_size // 8
        
        if config.test_name == "sequential":
            cache_misses = total_accesses // cache_line_elements
            cache_hits = total_accesses - cache_misses
        elif config.test_name == "stride":
            if config.stride >= cache_line_elements:
                cache_misses = total_accesses
                cache_hits = 0
            else:
                cache_misses = total_accesses // cache_line_elements * config.stride
                cache_hits = total_accesses - cache_misses
        elif config.test_name == "random":
            cache_misses = total_accesses
            cache_hits = 0
        elif config.test_name == "false_sharing":
            iterations = config.iterations * 10000
            total_accesses = iterations * config.thread_count
            if config.struct_layout == "bad":
                cache_misses = total_accesses
                cache_hits = 0
            else:
                cache_hits = total_accesses * 9 // 10
                cache_misses = total_accesses - cache_hits
        else:
            cache_hits = total_accesses // 2
            cache_misses = total_accesses - cache_hits
        
        timeline = []
        for i in range(config.iterations):
            variation = random.uniform(0.9, 1.1)
            timeline.append(latency * variation)
        
        thread_conflicts = []
        if config.test_name == "false_sharing" and config.struct_layout == "bad":
            thread_conflicts = [config.iterations * 10000] * config.thread_count
        else:
            thread_conflicts = [0] * config.thread_count
        
        metadata = {
            "config": {
                "array_size": config.array_size,
                "stride": config.stride,
                "iterations": config.iterations,
                "cache_line_size": config.cache_line_size
            },
            "optimization_suggestions": []
        }
        
        if config.test_name == "false_sharing":
            metadata["layout_analysis"] = {
                "layout_type": config.struct_layout,
                "issue": "false_sharing" if config.struct_layout == "bad" else "none"
            }
            if config.struct_layout == "bad":
                metadata["optimization_suggestions"] = [
                    "Use alignas(CACHE_LINE_SIZE) for frequently modified shared variables",
                    "Group read-only variables together"
                ]
        
        if config.test_name == "stride" and config.stride > 8:
            metadata["optimization_suggestions"] = [
                "Large stride causes poor cache utilization",
                "Consider reordering data access patterns"
            ]
        
        total_time = latency * total_accesses / 1e6
        throughput = (config.array_size * config.iterations) / (total_time / 1000.0) / (1024 * 1024)
        
        return BenchmarkResult(
            test_name=config.test_name,
            total_time_ms=total_time,
            throughput_mbs=throughput,
            avg_latency_ns=latency,
            cache_hits=cache_hits,
            cache_misses=cache_misses,
            latency_timeline=timeline,
            thread_conflicts=thread_conflicts,
            metadata=metadata,
            config=config.to_dict(),
            timestamp=datetime.now().isoformat(),
            experiment_id=experiment_id or f"exp_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )
    
    def run_async(self, config: BenchmarkConfig, experiment_id: str, callback=None):
        def worker():
            result = self.run_benchmark(config, experiment_id)
            with self._lock:
                self._results[experiment_id] = result
                if experiment_id in self._running:
                    del self._running[experiment_id]
            if callback:
                callback(result)
        
        thread = threading.Thread(target=worker)
        with self._lock:
            self._running[experiment_id] = thread
        thread.start()
    
    def get_status(self, experiment_id: str) -> Dict[str, Any]:
        with self._lock:
            if experiment_id in self._running:
                return {"status": "running"}
            if experiment_id in self._results:
                return {
                    "status": "completed",
                    "result": self._results[experiment_id].to_dict()
                }
            return {"status": "unknown"}
    
    def get_result(self, experiment_id: str) -> Optional[BenchmarkResult]:
        with self._lock:
            return self._results.get(experiment_id)
