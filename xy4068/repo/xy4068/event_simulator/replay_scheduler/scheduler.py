import json
import random
import signal
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from event_simulator.models.event import Event
from event_simulator.models.jitter_rule import JitterRule, JitterType


class ReplayStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    STOPPED = "stopped"
    ERROR = "error"


@dataclass
class ReplayState:
    status: ReplayStatus = ReplayStatus.IDLE
    speed: float = 1.0
    current_index: int = 0
    total_events: int = 0
    start_time: Optional[datetime] = None
    pause_time: Optional[datetime] = None
    elapsed_seconds: float = 0.0
    last_event_time: Optional[datetime] = None
    processed_events: int = 0
    errors: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "speed": self.speed,
            "current_index": self.current_index,
            "total_events": self.total_events,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "pause_time": self.pause_time.isoformat() if self.pause_time else None,
            "elapsed_seconds": self.elapsed_seconds,
            "last_event_time": self.last_event_time.isoformat() if self.last_event_time else None,
            "processed_events": self.processed_events,
            "errors": self.errors,
        }


class ReplayScheduler:
    def __init__(
        self,
        events: List[Event],
        jitter_rules: Optional[List[JitterRule]] = None,
        on_event: Optional[Callable[[Event], None]] = None,
        on_status_change: Optional[Callable[[ReplayStatus], None]] = None,
        state_dir: Optional[Path] = None,
    ):
        self._events = sorted(events, key=lambda e: e.timestamp)
        self._jitter_rules = jitter_rules or []
        self._on_event = on_event
        self._on_status_change = on_status_change
        
        self._state = ReplayState(total_events=len(events))
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()
        
        self._replay_thread: Optional[threading.Thread] = None
        self._scenario_start_time: Optional[datetime] = None
        
        self._state_dir = state_dir
        if self._state_dir:
            self._state_dir.mkdir(parents=True, exist_ok=True)
        
        self._original_handlers: Dict[int, Any] = {}
    
    @property
    def state(self) -> ReplayState:
        with self._lock:
            return self._state
    
    def _change_status(self, new_status: ReplayStatus):
        with self._lock:
            old_status = self._state.status
            self._state.status = new_status
        if self._on_status_change and old_status != new_status:
            self._on_status_change(new_status)
    
    def _calculate_time_offset(self, event: Event) -> float:
        if not self._events:
            return 0.0
        scenario_start = self._events[0].timestamp
        return (event.timestamp - scenario_start).total_seconds()
    
    def _apply_jitter(self, event: Event, event_offset: float) -> List[Event]:
        result_events = [event]
        dropped = False
        
        for rule in self._jitter_rules:
            if not rule.is_applicable(event.camera_id, event.event_type, int(event_offset)):
                continue
            
            if random.random() > rule.probability:
                continue
            
            if rule.jitter_type == JitterType.PACKET_LOSS:
                if rule.loss_percentage and random.random() < rule.loss_percentage:
                    dropped = True
                    break
            
            elif rule.jitter_type == JitterType.NETWORK_DELAY:
                min_delay = rule.delay_min_ms or 100
                max_delay = rule.delay_max_ms or 1000
                delay_ms = random.randint(min_delay, max_delay)
                delayed_event = Event(
                    id=f"{event.id}_delayed_{delay_ms}ms",
                    event_type=event.event_type,
                    timestamp=event.timestamp + timedelta(milliseconds=delay_ms),
                    camera_id=event.camera_id,
                    area_id=event.area_id,
                    severity=event.severity,
                    source=event.source,
                    confidence=event.confidence,
                    payload={**event.payload, "_jitter_type": "network_delay", "_delay_ms": delay_ms},
                    metadata={**event.metadata},
                )
                result_events = [delayed_event]
            
            elif rule.jitter_type == JitterType.TIMESTAMP_DRIFT:
                drift = rule.drift_seconds or random.randint(-5, 5)
                drifted_event = Event(
                    id=f"{event.id}_drifted_{drift}s",
                    event_type=event.event_type,
                    timestamp=event.timestamp + timedelta(seconds=drift),
                    camera_id=event.camera_id,
                    area_id=event.area_id,
                    severity=event.severity,
                    source=event.source,
                    confidence=event.confidence,
                    payload={**event.payload, "_jitter_type": "timestamp_drift", "_drift_seconds": drift},
                    metadata={**event.metadata},
                )
                result_events = [drifted_event]
            
            elif rule.jitter_type == JitterType.DUPLICATE:
                count = rule.duplicate_count or 2
                duplicates = []
                for i in range(count):
                    dup_event = Event(
                        id=f"{event.id}_dup_{i+1}",
                        event_type=event.event_type,
                        timestamp=event.timestamp,
                        camera_id=event.camera_id,
                        area_id=event.area_id,
                        severity=event.severity,
                        source=event.source,
                        confidence=event.confidence,
                        payload={**event.payload, "_jitter_type": "duplicate", "_dup_index": i + 1},
                        metadata={**event.metadata},
                    )
                    duplicates.append(dup_event)
                result_events = [event] + duplicates
        
        if dropped:
            return []
        return result_events
    
    def _emit_event(self, event: Event):
        if self._on_event:
            self._on_event(event)
        with self._lock:
            self._state.processed_events += 1
            self._state.last_event_time = event.timestamp
    
    def _replay_loop(self, speed: float = 1.0, start_index: int = 0):
        if not self._events:
            self._change_status(ReplayStatus.COMPLETED)
            return
        
        with self._lock:
            self._state.speed = speed
            self._state.current_index = start_index
            self._state.start_time = datetime.now()
            self._scenario_start_time = self._events[0].timestamp
        
        self._change_status(ReplayStatus.RUNNING)
        
        wall_start = time.time()
        scenario_start = self._events[0].timestamp
        
        for i in range(start_index, len(self._events)):
            if self._stop_event.is_set():
                self._change_status(ReplayStatus.STOPPED)
                return
            
            self._pause_event.wait()
            
            if self._stop_event.is_set():
                self._change_status(ReplayStatus.STOPPED)
                return
            
            event = self._events[i]
            event_offset = (event.timestamp - scenario_start).total_seconds()
            
            with self._lock:
                current_elapsed = time.time() - wall_start
                self._state.elapsed_seconds = current_elapsed
            
            target_wall_time = event_offset / speed
            
            wait_time = target_wall_time - current_elapsed
            
            if wait_time > 0:
                time.sleep(wait_time)
            
            if self._stop_event.is_set():
                self._change_status(ReplayStatus.STOPPED)
                return
            
            jittered_events = self._apply_jitter(event, event_offset)
            
            for j_event in jittered_events:
                self._emit_event(j_event)
            
            with self._lock:
                self._state.current_index = i + 1
        
        self._change_status(ReplayStatus.COMPLETED)
    
    def start(self, speed: float = 1.0, resume_from_checkpoint: bool = False):
        if self._state.status == ReplayStatus.RUNNING:
            return
        
        self._stop_event.clear()
        self._pause_event.set()
        
        start_index = 0
        if resume_from_checkpoint and self._state_dir:
            checkpoint = self._load_checkpoint()
            if checkpoint:
                start_index = checkpoint.get("current_index", 0)
        
        self._replay_thread = threading.Thread(
            target=self._replay_loop,
            args=(speed, start_index),
            daemon=True,
        )
        self._replay_thread.start()
    
    def pause(self):
        if self._state.status != ReplayStatus.RUNNING:
            return
        
        with self._lock:
            self._state.pause_time = datetime.now()
        
        self._pause_event.clear()
        self._change_status(ReplayStatus.PAUSED)
        
        if self._state_dir:
            self._save_checkpoint()
    
    def resume(self, speed: Optional[float] = None):
        if self._state.status != ReplayStatus.PAUSED:
            return
        
        if self._state.pause_time and self._state.start_time:
            pause_duration = (datetime.now() - self._state.pause_time).total_seconds()
        
        self._pause_event.set()
        
        new_speed = speed if speed is not None else self._state.speed
        with self._lock:
            self._state.speed = new_speed
        
        self._change_status(ReplayStatus.RUNNING)
    
    def stop(self):
        self._stop_event.set()
        self._pause_event.set()
        
        if self._replay_thread and self._replay_thread.is_alive():
            self._replay_thread.join(timeout=2.0)
        
        self._change_status(ReplayStatus.STOPPED)
    
    def set_speed(self, speed: float):
        if speed <= 0:
            raise ValueError("Speed must be greater than 0")
        with self._lock:
            self._state.speed = speed
    
    def seek(self, index: int):
        if index < 0 or index >= len(self._events):
            raise ValueError(f"Index must be between 0 and {len(self._events) - 1}")
        with self._lock:
            self._state.current_index = index
    
    def _save_checkpoint(self):
        if not self._state_dir:
            return
        
        checkpoint_path = self._state_dir / "replay_checkpoint.json"
        checkpoint_data = {
            "checkpoint_time": datetime.now().isoformat(),
            "current_index": self._state.current_index,
            "total_events": self._state.total_events,
            "processed_events": self._state.processed_events,
            "elapsed_seconds": self._state.elapsed_seconds,
            "speed": self._state.speed,
        }
        
        with open(checkpoint_path, "w", encoding="utf-8") as f:
            json.dump(checkpoint_data, f, indent=2, ensure_ascii=False)
    
    def _load_checkpoint(self) -> Optional[Dict[str, Any]]:
        if not self._state_dir:
            return None
        
        checkpoint_path = self._state_dir / "replay_checkpoint.json"
        if not checkpoint_path.exists():
            return None
        
        try:
            with open(checkpoint_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    
    def get_progress(self) -> Dict[str, Any]:
        with self._lock:
            progress = 0.0
            if self._state.total_events > 0:
                progress = (self._state.current_index / self._state.total_events) * 100
            
            return {
                "status": self._state.status.value,
                "current_index": self._state.current_index,
                "total_events": self._state.total_events,
                "processed_events": self._state.processed_events,
                "progress_percent": round(progress, 2),
                "speed": self._state.speed,
                "elapsed_seconds": self._state.elapsed_seconds,
            }
    
    def wait(self, timeout: Optional[float] = None):
        if self._replay_thread:
            self._replay_thread.join(timeout=timeout)
