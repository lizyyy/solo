import random
import time
import heapq
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum


class ThreadState(Enum):
    READY = "ready"
    RUNNING = "running"
    WAITING = "waiting"
    BLOCKED_ON_IO = "blocked_on_io"
    BLOCKED_ON_LOCK = "blocked_on_lock"
    FINISHED = "finished"


class GILState(Enum):
    FREE = "free"
    HELD = "held"
    REQUESTED = "requested"


@dataclass
class SimulationConfig:
    cpu_intensive: bool = True
    io_blocking: bool = False
    c_extension_gil_release: bool = False
    thread_count: int = 4
    switch_interval: float = 0.005
    lock_contention: bool = False
    total_instructions: int = 10000
    seed: Optional[int] = None

    def __post_init__(self):
        if self.seed is not None:
            random.seed(self.seed)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'cpu_intensive': self.cpu_intensive,
            'io_blocking': self.io_blocking,
            'c_extension_gil_release': self.c_extension_gil_release,
            'thread_count': self.thread_count,
            'switch_interval': self.switch_interval,
            'lock_contention': self.lock_contention,
            'total_instructions': self.total_instructions,
            'seed': self.seed
        }


@dataclass
class BytecodeInstruction:
    opcode: str
    arg: Any = None
    duration: float = 0.0001
    releases_gil: bool = False
    is_io: bool = False
    requires_lock: bool = False


class GIL:
    def __init__(self):
        self.state = GILState.FREE
        self.owner_thread_id: Optional[int] = None
        self.instruction_count = 0
        self.switch_interval_instructions = 100
        self.waiting_threads: List[int] = []
        self.preemption_pending = False

    def acquire(self, thread_id: int) -> bool:
        if self.state == GILState.FREE:
            self.state = GILState.HELD
            self.owner_thread_id = thread_id
            self.instruction_count = 0
            return True
        return False

    def release(self) -> Optional[int]:
        if self.state == GILState.HELD:
            old_owner = self.owner_thread_id
            self.state = GILState.FREE
            self.owner_thread_id = None
            self.instruction_count = 0
            return old_owner
        return None

    def should_preempt(self) -> bool:
        return self.instruction_count >= self.switch_interval_instructions and bool(self.waiting_threads)

    def increment_instruction(self):
        self.instruction_count += 1


@dataclass
class Thread:
    id: int
    state: ThreadState = ThreadState.READY
    instructions_executed: int = 0
    wait_time: float = 0.0
    gil_acquisitions: int = 0
    io_blocked_until: float = 0.0
    pending_events: List[Dict] = field(default_factory=list)
    instruction_pointer: int = 0
    remaining_instructions: int = 0

    def generate_instruction(self, config: SimulationConfig) -> BytecodeInstruction:
        opcodes = []
        
        if config.cpu_intensive:
            opcodes.extend([
                ('BINARY_ADD', 0.0001),
                ('BINARY_MULTIPLY', 0.00015),
                ('COMPARE_OP', 0.0001),
                ('LOAD_FAST', 0.00005),
                ('STORE_FAST', 0.00005),
                ('JUMP_FORWARD', 0.00008),
            ])
        
        if config.io_blocking:
            opcodes.extend([
                ('CALL_FUNCTION_IO', 0.05, True),
                ('LOAD_ATTR_IO', 0.01, True),
            ])
        
        if config.c_extension_gil_release:
            opcodes.extend([
                ('CALL_C_EXTENSION', 0.01, False, True),
            ])
        
        if config.lock_contention:
            opcodes.extend([
                ('ACQUIRE_LOCK', 0.001, False, False, True),
                ('RELEASE_LOCK', 0.0005),
            ])
        
        if not opcodes:
            opcodes = [('NOP', 0.0001)]
        
        weights = []
        for opcode_info in opcodes:
            if len(opcode_info) == 2:
                opcode, duration = opcode_info
                is_io = False
                releases_gil = False
                requires_lock = False
            elif len(opcode_info) == 3:
                opcode, duration, is_io = opcode_info
                releases_gil = False
                requires_lock = False
            elif len(opcode_info) == 4:
                opcode, duration, is_io, releases_gil = opcode_info
                requires_lock = False
            else:
                opcode, duration, is_io, releases_gil, requires_lock = opcode_info
            
            if is_io:
                weights.append(1)
            elif releases_gil:
                weights.append(1)
            elif requires_lock:
                weights.append(2)
            else:
                weights.append(10)
        
        selected = random.choices(opcodes, weights=weights, k=1)[0]
        
        if len(selected) == 2:
            opcode, duration = selected
            is_io = False
            releases_gil = False
            requires_lock = False
        elif len(selected) == 3:
            opcode, duration, is_io = selected
            releases_gil = False
            requires_lock = False
        elif len(selected) == 4:
            opcode, duration, is_io, releases_gil = selected
            requires_lock = False
        else:
            opcode, duration, is_io, releases_gil, requires_lock = selected
        
        return BytecodeInstruction(
            opcode=opcode,
            duration=duration,
            releases_gil=releases_gil,
            is_io=is_io,
            requires_lock=requires_lock
        )


class LockManager:
    def __init__(self):
        self.locks: Dict[int, Optional[int]] = {}
        self.lock_waiters: Dict[int, List[int]] = {}

    def acquire(self, lock_id: int, thread_id: int) -> bool:
        if lock_id not in self.locks:
            self.locks[lock_id] = None
            self.lock_waiters[lock_id] = []
        
        if self.locks[lock_id] is None:
            self.locks[lock_id] = thread_id
            return True
        else:
            if thread_id not in self.lock_waiters[lock_id]:
                self.lock_waiters[lock_id].append(thread_id)
            return False

    def release(self, lock_id: int, thread_id: int) -> Optional[int]:
        if self.locks.get(lock_id) == thread_id:
            self.locks[lock_id] = None
            if self.lock_waiters[lock_id]:
                next_thread = self.lock_waiters[lock_id].pop(0)
                self.locks[lock_id] = next_thread
                return next_thread
        return None

    def is_waiting(self, thread_id: int) -> bool:
        for waiters in self.lock_waiters.values():
            if thread_id in waiters:
                return True
        return False


class EventRecorder:
    def __init__(self):
        self.events: List[Dict[str, Any]] = []

    def record(self, event_type: str, thread_id: int, timestamp: float, **kwargs):
        event = {
            'type': event_type,
            'thread_id': thread_id,
            'timestamp': timestamp,
            **kwargs
        }
        self.events.append(event)

    def get_events(self) -> List[Dict[str, Any]]:
        return self.events

    def get_stats(self) -> Dict[str, int]:
        stats = {}
        for event in self.events:
            event_type = event['type']
            stats[event_type] = stats.get(event_type, 0) + 1
        return stats


class GILSimulator:
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.gil = GIL()
        self.threads: List[Thread] = []
        self.lock_manager = LockManager()
        self.event_recorder = EventRecorder()
        self.current_time = 0.0
        self.total_instructions_executed = 0
        self.start_time = 0.0
        
        instructions_per_thread = config.total_instructions // config.thread_count
        for i in range(config.thread_count):
            self.threads.append(Thread(
                id=i,
                remaining_instructions=instructions_per_thread + (1 if i < config.total_instructions % config.thread_count else 0)
            ))

    def run(self) -> Dict[str, Any]:
        self.start_time = time.time()
        
        ready_threads = [t for t in self.threads if t.state == ThreadState.READY]
        
        while ready_threads or self._has_blocked_threads():
            current_thread = self._select_next_thread()
            
            if current_thread is None:
                self._advance_time_for_io()
                continue
            
            if self.gil.acquire(current_thread.id):
                current_thread.gil_acquisitions += 1
                current_thread.state = ThreadState.RUNNING
                self.event_recorder.record(
                    'gil_acquire', current_thread.id, self.current_time,
                    owner=current_thread.id
                )
                
                self._run_thread_slice(current_thread)
                
                if self.gil.owner_thread_id == current_thread.id:
                    old_owner = self.gil.release()
                    self.event_recorder.record(
                        'gil_release', current_thread.id, self.current_time,
                        released_by=old_owner
                    )
                
                if current_thread.remaining_instructions <= 0:
                    current_thread.state = ThreadState.FINISHED
                elif current_thread.state == ThreadState.RUNNING:
                    current_thread.state = ThreadState.READY
            
            ready_threads = [t for t in self.threads if t.state == ThreadState.READY]
        
        end_time = time.time()
        total_time = end_time - self.start_time
        
        return {
            'summary': self._generate_summary(total_time),
            'events': self.event_recorder.get_events()
        }

    def _select_next_thread(self) -> Optional[Thread]:
        ready_threads = [t for t in self.threads if t.state == ThreadState.READY]
        
        if not ready_threads:
            self._wake_io_threads()
            self._wake_lock_threads()
            ready_threads = [t for t in self.threads if t.state == ThreadState.READY]
            if not ready_threads:
                return None
        
        if self.gil.owner_thread_id is not None:
            owner = next((t for t in self.threads if t.id == self.gil.owner_thread_id), None)
            if owner and owner.state == ThreadState.READY:
                return owner
        
        for thread in self.threads:
            if thread.state == ThreadState.READY:
                if self.gil.waiting_threads and thread.id == self.gil.waiting_threads[0]:
                    return thread
        
        return ready_threads[0] if ready_threads else None

    def _run_thread_slice(self, thread: Thread):
        instructions_this_slice = 0
        
        while (instructions_this_slice < self.gil.switch_interval_instructions and
               thread.remaining_instructions > 0 and
               thread.state == ThreadState.RUNNING):
            
            instruction = thread.generate_instruction(self.config)
            
            if instruction.is_io:
                self._handle_io(thread, instruction)
                break
            
            if instruction.requires_lock:
                if not self._handle_lock_acquire(thread):
                    break
            
            self._execute_instruction(thread, instruction)
            
            thread.instruction_pointer += 1
            thread.instructions_executed += 1
            thread.remaining_instructions -= 1
            instructions_this_slice += 1
            self.total_instructions_executed += 1
            self.current_time += instruction.duration
            
            self.gil.increment_instruction()
            
            self.event_recorder.record(
                'instruction', thread.id, self.current_time,
                opcode=instruction.opcode,
                gil_owner=self.gil.owner_thread_id
            )
            
            if instruction.releases_gil:
                self.event_recorder.record(
                    'gil_release_c_extension', thread.id, self.current_time,
                    reason='c_extension_release'
                )
                self.gil.release()
                thread.state = ThreadState.READY
                
                if thread.id not in self.gil.waiting_threads:
                    self.gil.waiting_threads.append(thread.id)
                break
            
            if self.gil.should_preempt():
                self._handle_preemption(thread)
                break

    def _execute_instruction(self, thread: Thread, instruction: BytecodeInstruction):
        pass

    def _handle_io(self, thread: Thread, instruction: BytecodeInstruction):
        thread.state = ThreadState.BLOCKED_ON_IO
        thread.io_blocked_until = self.current_time + instruction.duration
        
        self.event_recorder.record(
            'io_wait', thread.id, self.current_time,
            duration=instruction.duration,
            io_blocked_until=thread.io_blocked_until
        )
        
        if self.gil.owner_thread_id == thread.id:
            old_owner = self.gil.release()
            self.event_recorder.record(
                'gil_release', thread.id, self.current_time,
                released_by=old_owner,
                reason='io_block'
            )

    def _handle_lock_acquire(self, thread: Thread) -> bool:
        lock_id = 0
        
        if self.lock_manager.acquire(lock_id, thread.id):
            self.event_recorder.record(
                'lock_acquire', thread.id, self.current_time,
                lock_id=lock_id
            )
            return True
        else:
            thread.state = ThreadState.BLOCKED_ON_LOCK
            self.event_recorder.record(
                'lock_wait', thread.id, self.current_time,
                lock_id=lock_id
            )
            
            if self.gil.owner_thread_id == thread.id:
                old_owner = self.gil.release()
                self.event_recorder.record(
                    'gil_release', thread.id, self.current_time,
                    released_by=old_owner,
                    reason='lock_contention'
                )
            return False

    def _handle_preemption(self, thread: Thread):
        self.gil.preemption_pending = True
        
        self.event_recorder.record(
            'preemption', thread.id, self.current_time,
            instruction_count=self.gil.instruction_count
        )
        
        if self.gil.owner_thread_id == thread.id:
            old_owner = self.gil.release()
            self.event_recorder.record(
                'gil_release', thread.id, self.current_time,
                released_by=old_owner,
                reason='preemption'
            )
        
        thread.state = ThreadState.READY
        if thread.id not in self.gil.waiting_threads:
            self.gil.waiting_threads.append(thread.id)
        
        self.gil.preemption_pending = False

    def _wake_io_threads(self):
        for thread in self.threads:
            if thread.state == ThreadState.BLOCKED_ON_IO:
                if self.current_time >= thread.io_blocked_until:
                    thread.state = ThreadState.READY
                    self.event_recorder.record(
                        'io_wake', thread.id, self.current_time
                    )

    def _wake_lock_threads(self):
        pass

    def _advance_time_for_io(self):
        blocked_threads = [t for t in self.threads if t.state == ThreadState.BLOCKED_ON_IO]
        
        if blocked_threads:
            next_wake_time = min(t.io_blocked_until for t in blocked_threads)
            time_to_advance = max(0, next_wake_time - self.current_time)
            self.current_time += time_to_advance
            
            for thread in self.threads:
                if thread.state == ThreadState.BLOCKED_ON_IO:
                    thread.wait_time += time_to_advance
            
            self._wake_io_threads()

    def _has_blocked_threads(self) -> bool:
        return any(t.state in [ThreadState.BLOCKED_ON_IO, ThreadState.BLOCKED_ON_LOCK] 
                   for t in self.threads)

    def _generate_summary(self, total_time: float) -> Dict[str, Any]:
        thread_stats = []
        for thread in self.threads:
            thread_stats.append({
                'thread_id': thread.id,
                'instructions': thread.instructions_executed,
                'wait_time': thread.wait_time,
                'gil_acquisitions': thread.gil_acquisitions
            })
        
        event_stats = self.event_recorder.get_stats()
        
        risk_factors = []
        
        if self.config.thread_count > 16:
            risk_factors.append(
                "⚠️ High thread count ({}) may cause excessive context switching. "
                "Each thread switch requires GIL acquisition which adds overhead.".format(
                    self.config.thread_count
                )
            )
        
        if self.config.lock_contention and self.config.thread_count > 4:
            risk_factors.append(
                "⚠️ Lock contention with many threads ({}) creates a convoy effect. "
                "Threads waiting for locks also hold the GIL waiting position, "
                "preventing other threads from making progress.".format(
                    self.config.thread_count
                )
            )
        
        if self.config.cpu_intensive and self.config.thread_count > 1:
            risk_factors.append(
                "📊 CPU-intensive workload with multiple threads: "
                "Due to GIL, only one thread executes Python bytecode at a time. "
                "Expect no parallel speedup - actually slower due to thread switching overhead."
            )
        
        if not self.config.io_blocking and not self.config.c_extension_gil_release:
            risk_factors.append(
                "ℹ️ Without I/O or C extension GIL release, "
                "threads only switch at preemption intervals ({} instructions). "
                "This shows classic GIL behavior.".format(
                    self.gil.switch_interval_instructions
                )
            )
        
        if not risk_factors:
            risk_factors.append("✅ Configuration looks reasonable for this simulation.")
        
        throughput = self.total_instructions_executed / total_time if total_time > 0 else 0
        
        return {
            'total_instructions': self.total_instructions_executed,
            'total_time': total_time,
            'simulated_time': self.current_time,
            'throughput': throughput,
            'thread_stats': thread_stats,
            'gil_events': {
                'acquisitions': event_stats.get('gil_acquire', 0),
                'releases': event_stats.get('gil_release', 0),
                'preemptions': event_stats.get('preemption', 0),
                'io_waits': event_stats.get('io_wait', 0),
                'lock_waits': event_stats.get('lock_wait', 0)
            },
            'risk_analysis': '\n\n'.join(risk_factors)
        }
