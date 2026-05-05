import pytest
from gil_simulator import (
    GILSimulator, SimulationConfig, GIL, Thread, LockManager,
    ThreadState, GILState, BytecodeInstruction, EventRecorder
)


class TestSimulationConfig:
    def test_default_config(self):
        config = SimulationConfig()
        assert config.cpu_intensive is True
        assert config.io_blocking is False
        assert config.thread_count == 4
        assert config.switch_interval == 0.005
    
    def test_to_dict(self):
        config = SimulationConfig(thread_count=8, seed=42)
        d = config.to_dict()
        assert d['thread_count'] == 8
        assert d['seed'] == 42
    
    def test_seed_reproducibility(self):
        config1 = SimulationConfig(seed=42)
        config2 = SimulationConfig(seed=42)
        assert True


class TestGIL:
    def test_initial_state(self):
        gil = GIL()
        assert gil.state == GILState.FREE
        assert gil.owner_thread_id is None
        assert gil.instruction_count == 0
    
    def test_acquire_free(self):
        gil = GIL()
        assert gil.acquire(1) is True
        assert gil.state == GILState.HELD
        assert gil.owner_thread_id == 1
    
    def test_acquire_held(self):
        gil = GIL()
        gil.acquire(1)
        assert gil.acquire(2) is False
    
    def test_release(self):
        gil = GIL()
        gil.acquire(1)
        released = gil.release()
        assert released == 1
        assert gil.state == GILState.FREE
        assert gil.owner_thread_id is None
    
    def test_should_preempt(self):
        gil = GIL()
        gil.waiting_threads = [2]
        gil.instruction_count = 150
        assert gil.should_preempt() is True
    
    def test_should_not_preempt_no_waiters(self):
        gil = GIL()
        gil.instruction_count = 150
        assert gil.should_preempt() is False


class TestThread:
    def test_initial_state(self):
        thread = Thread(id=1)
        assert thread.id == 1
        assert thread.state == ThreadState.READY
        assert thread.instructions_executed == 0
    
    def test_generate_instruction_cpu_intensive(self):
        config = SimulationConfig(cpu_intensive=True, io_blocking=False)
        thread = Thread(id=0)
        instruction = thread.generate_instruction(config)
        assert instruction is not None
        assert isinstance(instruction.opcode, str)
    
    def test_generate_instruction_io_blocking(self):
        config = SimulationConfig(cpu_intensive=False, io_blocking=True)
        thread = Thread(id=0)
        instruction = thread.generate_instruction(config)
        assert instruction is not None


class TestLockManager:
    def test_initial_state(self):
        lm = LockManager()
        assert len(lm.locks) == 0
    
    def test_acquire_free_lock(self):
        lm = LockManager()
        assert lm.acquire(0, 1) is True
        assert lm.locks[0] == 1
    
    def test_acquire_held_lock(self):
        lm = LockManager()
        lm.acquire(0, 1)
        assert lm.acquire(0, 2) is False
        assert 2 in lm.lock_waiters[0]
    
    def test_release_lock(self):
        lm = LockManager()
        lm.acquire(0, 1)
        next_thread = lm.release(0, 1)
        assert next_thread is None
        assert lm.locks[0] is None
    
    def test_release_with_waiters(self):
        lm = LockManager()
        lm.acquire(0, 1)
        lm.acquire(0, 2)
        next_thread = lm.release(0, 1)
        assert next_thread == 2
        assert lm.locks[0] == 2


class TestEventRecorder:
    def test_initial_state(self):
        er = EventRecorder()
        assert len(er.events) == 0
    
    def test_record_event(self):
        er = EventRecorder()
        er.record('gil_acquire', 1, 0.0, owner=1)
        assert len(er.events) == 1
        assert er.events[0]['type'] == 'gil_acquire'
        assert er.events[0]['thread_id'] == 1
    
    def test_get_stats(self):
        er = EventRecorder()
        er.record('gil_acquire', 1, 0.0)
        er.record('gil_acquire', 2, 0.1)
        er.record('gil_release', 1, 0.2)
        stats = er.get_stats()
        assert stats['gil_acquire'] == 2
        assert stats['gil_release'] == 1


class TestGILSimulator:
    def test_initialization(self):
        config = SimulationConfig(thread_count=4)
        sim = GILSimulator(config)
        assert len(sim.threads) == 4
    
    def test_run_basic(self):
        config = SimulationConfig(
            cpu_intensive=True,
            io_blocking=False,
            thread_count=2,
            total_instructions=1000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert 'summary' in results
        assert 'events' in results
        assert results['summary']['total_instructions'] > 0
        assert len(results['events']) > 0
    
    def test_run_with_io(self):
        config = SimulationConfig(
            cpu_intensive=True,
            io_blocking=True,
            thread_count=2,
            total_instructions=500
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert results['summary']['total_instructions'] > 0
    
    def test_run_with_lock_contention(self):
        config = SimulationConfig(
            cpu_intensive=True,
            lock_contention=True,
            thread_count=4,
            total_instructions=1000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert results['summary']['total_instructions'] > 0
    
    def test_run_with_c_extension(self):
        config = SimulationConfig(
            cpu_intensive=True,
            c_extension_gil_release=True,
            thread_count=4,
            total_instructions=1000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert results['summary']['total_instructions'] > 0
    
    def test_thread_stats_generation(self):
        config = SimulationConfig(
            thread_count=4,
            total_instructions=2000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert len(results['summary']['thread_stats']) == 4
        for stat in results['summary']['thread_stats']:
            assert 'instructions' in stat
            assert 'wait_time' in stat
            assert 'gil_acquisitions' in stat
    
    def test_risk_analysis(self):
        config = SimulationConfig(
            cpu_intensive=True,
            thread_count=8,
            total_instructions=1000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert 'risk_analysis' in results['summary']
        assert len(results['summary']['risk_analysis']) > 0
    
    def test_gil_events_tracking(self):
        config = SimulationConfig(
            thread_count=4,
            total_instructions=2000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        gil_events = results['summary']['gil_events']
        assert 'acquisitions' in gil_events
        assert 'releases' in gil_events
        assert 'preemptions' in gil_events
        assert gil_events['acquisitions'] > 0
        assert gil_events['releases'] > 0
    
    def test_single_thread(self):
        config = SimulationConfig(
            thread_count=1,
            total_instructions=1000
        )
        sim = GILSimulator(config)
        results = sim.run()
        
        assert results['summary']['total_instructions'] == 1000
        assert len(results['summary']['thread_stats']) == 1
    
    def test_seed_reproducibility(self):
        config1 = SimulationConfig(
            thread_count=4,
            total_instructions=2000,
            seed=42
        )
        sim1 = GILSimulator(config1)
        results1 = sim1.run()
        
        config2 = SimulationConfig(
            thread_count=4,
            total_instructions=2000,
            seed=42
        )
        sim2 = GILSimulator(config2)
        results2 = sim2.run()
        
        assert results1['summary']['total_instructions'] == results2['summary']['total_instructions']


class TestBytecodeInstruction:
    def test_default_values(self):
        instr = BytecodeInstruction(opcode='NOP')
        assert instr.opcode == 'NOP'
        assert instr.duration == 0.0001
        assert instr.releases_gil is False
        assert instr.is_io is False
        assert instr.requires_lock is False
    
    def test_custom_values(self):
        instr = BytecodeInstruction(
            opcode='CALL_C_EXTENSION',
            duration=0.01,
            releases_gil=True,
            is_io=False,
            requires_lock=False
        )
        assert instr.releases_gil is True
        assert instr.duration == 0.01


class TestThreadState:
    def test_states_exist(self):
        assert ThreadState.READY.value == "ready"
        assert ThreadState.RUNNING.value == "running"
        assert ThreadState.WAITING.value == "waiting"
        assert ThreadState.BLOCKED_ON_IO.value == "blocked_on_io"
        assert ThreadState.BLOCKED_ON_LOCK.value == "blocked_on_lock"
        assert ThreadState.FINISHED.value == "finished"


class TestGILState:
    def test_states_exist(self):
        assert GILState.FREE.value == "free"
        assert GILState.HELD.value == "held"
        assert GILState.REQUESTED.value == "requested"
